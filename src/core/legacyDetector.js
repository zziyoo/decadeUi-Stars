/**
 * @fileoverview P13 旧版本迁移检测（任务书§50 + §21）
 *
 * 纯逻辑：只回答"现在是什么环境、该做什么"。不碰 IO、不写配置——写入是接线层
 * （`features/legacyMigration.js`）的事，这样边角能在 Node 里测全。
 *
 * 四条判据来源（2026-09-28 用户批准的批量决定）：
 *   - 旧扩展（十周年UI）装了**且启用** ⇒ 冲突，启动就强制关闭：两套 UI 同时 hook 同一批函数会界面错乱；
 *   - 配置迁移＝全量复制「旧键有值、新键还是默认值」的键，但**由提示窗里的「导入」按钮触发**（零点击不写玩家配置）；
 *   - 旧目录里的**玩家自建卡面自动复制**进我们自己的 `image/card-skins/`（只读旧目录、只写我们目录）；
 *   - 旧样式包/源码**不复用**（Stars 整包自带 `modules/` 全量），只检测并说明。
 *
 * 两条刻意的边界：
 *   - **"新键没被玩家动过"用默认值判定，不用"键是否存在"**。本体与 content 阶段都会把
 *     `init` 播种进 `lib.config`，首次启动后新键几乎必然存在；照"存在就不迁"判会得到零迁移。
 *   - **本体自管的开关不迁**：`enable` / `characters_enable` / `cards_enable` 是开关不是配置。
 */

/** 旧单体 UI 的扩展名（玩家在用的那一版） */
export const LEGACY_EXTENSION_NAME = "十周年UI";
/** 当前模块化 UI 的扩展名（Node 测试里没有注入全局 `decadeUIName` 时的兜底） */
export const DEFAULT_CURRENT_NAME = "十周年UI-Stars";
/** 迁移标记键（写在当前扩展名下，值为迁移来源的旧版本号） */
export const MIGRATION_MARK_KEY = "legacyMigratedFrom";

/** 配置键前缀 */
const prefixOf = name => `extension_${name}_`;

/** 本体自管的开关后缀：不是玩家配置，不参与迁移 */
function isBodyManaged(name) {
	return name === "enable" || name.endsWith("_enable");
}

/** 值比较：原语直接比，对象用序列化（配置里主要是 bool/string/number，对象是兜底） */
function sameValue(a, b) {
	if (a === b) return true;
	if (a === undefined || b === undefined) return false;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;
	if (typeof a === "object") {
		try {
			return JSON.stringify(a) === JSON.stringify(b);
		} catch {
			return false;
		}
	}
	return false;
}

/**
 * 枚举旧扩展留在配置里的键。
 * 只能按前缀扫（`lib.config` 里同时存在新旧两套键，而旧前缀 `extension_十周年UI_` 与
 * 新前缀 `extension_十周年UI-Stars_` 不会互相命中：后者中间多了 `-Stars`）。
 * @param {Object} input
 * @param {Object} [input.config] - `lib.config`
 * @param {string} [input.legacyName]
 * @returns {Array<{name: string, value: any}>} 按 name 排序
 */
export function collectLegacyConfig({ config = {}, legacyName = LEGACY_EXTENSION_NAME } = {}) {
	const prefix = prefixOf(legacyName);
	const out = [];
	for (const key of Object.keys(config || {})) {
		if (!key.startsWith(prefix)) continue;
		const name = key.slice(prefix.length);
		if (!name || isBodyManaged(name)) continue;
		const value = config[key];
		if (value === undefined || value === null) continue;
		out.push({ name, value });
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 迁移计划：只补玩家没动过的键。
 *
 * 判定顺序：Stars 没有这项配置（unknown）→ 旧值等于默认值（迁了没变化）→
 * 新键已被玩家改过（不覆盖）→ 其余进 items。
 *
 * @param {Object} input
 * @param {Object} [input.config] - `lib.config`
 * @param {Object} [input.defaults] - Stars 配置项名 → `init` 默认值
 * @param {string} [input.legacyName]
 * @param {string} [input.currentName]
 * @param {Array<{name: string, value: any}>} [input.keys] - `collectLegacyConfig` 的结果
 * @returns {{needed: boolean, items: Array<{name: string, from: string, to: string, value: any}>, skipped: Array<{name: string, reason: string}>}}
 */
export function planMigration({ config = {}, defaults = {}, legacyName = LEGACY_EXTENSION_NAME, currentName = DEFAULT_CURRENT_NAME, keys = [] } = {}) {
	const currentPrefix = prefixOf(currentName);
	const items = [];
	const skipped = [];

	for (const { name, value } of keys) {
		if (!(name in defaults)) {
			skipped.push({ name, reason: "Stars 没有这项配置" });
			continue;
		}
		const def = defaults[name];
		const to = `${currentPrefix}${name}`;
		const cur = config?.[to];
		// 未播种（undefined/null）或还是默认值 ⇒ 视为玩家没动过，可以补
		const untouched = cur === undefined || cur === null || sameValue(cur, def);
		if (!untouched) {
			skipped.push({ name, reason: "Stars 侧已设置，不覆盖" });
			continue;
		}
		if (sameValue(value, def) || sameValue(value, cur)) {
			skipped.push({ name, reason: "与现有值相同" });
			continue;
		}
		items.push({ name, from: `${prefixOf(legacyName)}${name}`, to, value });
	}

	return { needed: items.length > 0, items, skipped };
}

/**
 * 卡面搬迁计划：旧目录里的**玩家自建**文件夹（排除内置五套与同名已存在的）。
 *
 * 幂等靠"同名不覆盖"保证：复制过一次后 Stars 侧就有同名文件夹了，再启动不会重复搬。
 * 名字来自对方目录的 readdir，一律当作不可信输入：带路径分隔符或 `.`/`_` 前缀的直接丢。
 *
 * @param {Object} input
 * @param {string[]} [input.legacyFolders] - 旧扩展 `image/card-skins/` 下的文件夹名
 * @param {string[]} [input.builtinFolders] - 内置套的文件夹名（在 Stars 包里已有，不用搬）
 * @param {string[]} [input.currentFolders] - Stars `image/card-skins/` 下已有的文件夹名
 * @returns {{needed: boolean, items: Array<{name: string}>, skipped: Array<{name: string, reason: string}>}}
 */
export function planSkins({ legacyFolders = [], builtinFolders = [], currentFolders = [] } = {}) {
	const builtin = new Set(Array.isArray(builtinFolders) ? builtinFolders : []);
	const current = new Set(Array.isArray(currentFolders) ? currentFolders : []);
	const items = [];
	const skipped = [];
	const seen = new Set();
	for (const name of Array.isArray(legacyFolders) ? legacyFolders : []) {
		if (typeof name !== "string" || !name || name[0] === "." || name[0] === "_" || /[/\\]/.test(name)) continue;
		if (builtin.has(name)) {
			skipped.push({ name, reason: "内置套已在 Stars 包里" });
			continue;
		}
		if (current.has(name)) {
			skipped.push({ name, reason: "Stars 已有同名文件夹，不覆盖" });
			continue;
		}
		if (seen.has(name)) continue;
		seen.add(name);
		items.push({ name });
	}
	return { needed: items.length > 0, items, skipped };
}

/**
 * 环境判定：只回答"旧版在不在、有没有启用、哪些配置可迁"。
 * 卡面不在这里判：那要先读盘，由接线层拿到目录名单后调 `planSkins`（同一处判定，不做两份）。
 *
 * @param {Object} input
 * @param {Object} [input.config] - `lib.config`
 * @param {string[]} [input.installed] - 已安装扩展名（`lib.config.extensions`）
 * @param {Object} [input.extensionPack] - `lib.extensionPack`（取版本）
 * @param {Object} [input.defaults] - Stars 配置默认值表
 * @param {Object} [input.modules] - 当前已装模块 `{id: {version}}`
 * @param {string} [input.legacyName]
 * @param {string} [input.currentName]
 * @returns {{kind: "absent"|"active"|"idle"|"residual", conflict: boolean, alreadyMigrated: boolean, legacy: Object, current: Object, migration: Object}}
 */
export function detectLegacy({
	config = {},
	installed = [],
	extensionPack = {},
	defaults = {},
	modules = {},
	legacyName = LEGACY_EXTENSION_NAME,
	currentName = DEFAULT_CURRENT_NAME,
} = {}) {
	const present = Array.isArray(installed) && installed.includes(legacyName);
	// 判据与本体装载扩展的那一条同形（game/index.js：`!lib.config['extension_<名>_enable']` 就 return）：
	// 是**真值**就算在跑。写成 === true 会把 "true"/1 这类值漏掉——旧版照样 hook 着，我们却判"没冲突"。
	const enabled = Boolean(config?.[`${prefixOf(legacyName)}enable`]);
	const version = extensionPack?.[legacyName]?.version ?? null;
	const legacyConfig = collectLegacyConfig({ config, legacyName });
	const migratedFrom = config?.[`${prefixOf(currentName)}${MIGRATION_MARK_KEY}`] ?? null;

	const current = {
		name: currentName,
		version: extensionPack?.[currentName]?.version ?? null,
		moduleCount: Object.keys(modules || {}).length,
		migratedFrom,
	};
	const legacy = { name: legacyName, present, enabled, version, configCount: legacyConfig.length };

	return {
		kind: present ? (enabled ? "active" : "idle") : legacyConfig.length ? "residual" : "absent",
		conflict: enabled,
		alreadyMigrated: Boolean(migratedFrom),
		legacy,
		current,
		migration: planMigration({ config, defaults, legacyName, currentName, keys: legacyConfig }),
	};
}
