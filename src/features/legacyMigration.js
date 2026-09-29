/**
 * @fileoverview P13 旧版本迁移的接线层（任务书§50 + §21）
 *
 * 判定全在纯逻辑 `core/legacyDetector.js`，这里只执行三类动作，各自的"必须"来自用户批准的决定：
 *   1. 旧版（十周年UI）仍处于启用状态 ⇒ 启动就写 `extension_十周年UI_enable = false`（自动禁用）。
 *      **本次启动里旧版代码已经被加载过了**，所以只能"重载后生效"，UI 必须如实写出来。
 *      只写这一个开关：`game.removeExtension()` 会连删玩家的配置、localStorage 与导入的武将图，**绝不能碰**。
 *   2. 玩家自建卡面 ⇒ 从旧目录**只读**、复制进我们自己的 `image/card-skins/`（自动复制）。
 *      同名不覆盖 ⇒ 重复启动自然幂等。
 *   3. 配置迁移 ⇒ **不做成静默自动**：只准备一份"可导入"条目交给提示窗，玩家点「导入」才写（半自动）。
 *
 * 启动期第一要务是别把游戏弄卡：任何异常一律吞掉并返回空记录（不弹窗、不阻塞进游戏）。
 */
import { lib, game } from "noname";
import { LEGACY_EXTENSION_NAME, DEFAULT_CURRENT_NAME, MIGRATION_MARK_KEY, detectLegacy, planSkins } from "../core/legacyDetector.js";
import { getModuleSystem } from "../core/moduleSystem.js";
import { config as extensionConfig, cardSkinPresets } from "../config.js";

/** 卡面目录（相对各扩展根，两侧路径同形） */
const SKIN_SUBDIR = "image/card-skins";
/** 内置套的文件夹名：与 config/utils 的预设同源，不在这里另立一份名单 */
export const BUILTIN_SKIN_FOLDERS = cardSkinPresets.map(skin => skin.dir || skin.key);

/** 配置键（`game.saveConfig` 用的全名） */
const legacyEnableKey = name => `extension_${name}_enable`;
const migrationMarkKey = name => `extension_${name}_${MIGRATION_MARK_KEY}`;

/**
 * 从配置定义里抽出默认值表。
 * 口径与 content 阶段播种默认值时一致：有 `init` 且**没有** `clear`（带 clear 的是按钮不是配置项）。
 * @param {Object} [source] - `config.js` 导出的配置聚合
 * @returns {Object<string, any>}
 */
export function collectDefaults(source = extensionConfig) {
	const out = {};
	for (const [key, def] of Object.entries(source || {})) {
		if (def && typeof def === "object" && "init" in def && !("clear" in def)) out[key] = def.init;
	}
	return out;
}

/** 本机已装模块（注册表视角，仅用于报告"新版在用几个模块"） */
function collectModules(api) {
	const manager = api?.moduleManager;
	if (!manager?.list) return {};
	const out = {};
	for (const item of manager.list()) {
		if (item?.id) out[item.id] = { version: item.version ?? null };
	}
	return out;
}

const toPosix = path => String(path).split("\\").join("/");

function fsCall(fn, ...args) {
	return new Promise((resolve, reject) => {
		fn(...args, (error, value) => (error ? reject(error) : resolve(value)));
	});
}

/**
 * 卡面目录端口（桌面端裸 `lib.node.fs`）。
 *
 * 与 `core/moduleIo.js` 的端口**不同根**：那边的 `safeRel` 把路径锁死在本扩展目录内（安装器不能越界），
 * 而这里必须读**同级另一个扩展**的目录，所以自己按应用根拼绝对路径——
 * 基准取 `window.__dirname`（本体在 node 初始化时归一成应用根，与 moduleIo 的 `fsRoot()` 同一口径）。
 *
 * 三条硬约束：只读旧目录、只写我们自己的目录、不删任何东西。
 * @returns {Object|null} 拿不到 Node fs（Android/SAF）或拿不到应用根时返回 null，调用方整段静默跳过
 */
export function createSkinIo({ legacyName = LEGACY_EXTENSION_NAME, currentName = DEFAULT_CURRENT_NAME, fs } = {}) {
	// 整个建端口都要吞错：默认参数是在函数体外求值的，这里抛出去就会卡住启动
	try {
		const nodeFs = fs === undefined ? lib?.node?.fs : fs;
		const base = typeof window !== "undefined" && typeof window.__dirname === "string" ? toPosix(window.__dirname).replace(/\/+$/, "") : "";
		if (!nodeFs || !base) return null;
		return buildSkinIo(nodeFs, base, legacyName, currentName);
	} catch {
		return null;
	}
}

function buildSkinIo(fs, base, legacyName, currentName) {
	const legacyRoot = `${base}/extension/${legacyName}/${SKIN_SUBDIR}`;
	const currentRoot = `${base}/extension/${currentName}/${SKIN_SUBDIR}`;
	// 两侧同根（旧版名字与新版名字相同这类异常配置）：复制就是自己往自己里灌，直接不提供端口
	if (legacyRoot === currentRoot) return null;

	/** readdir + stat 两段：与 moduleIo 的 desktopListDir 同一手法，且同样跳过 `.`/`_` 开头的条目 */
	const scan = async dir => {
		let names;
		try {
			names = await fsCall(fs.readdir, dir);
		} catch (error) {
			if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return { dirs: [], files: [] };
			throw error;
		}
		const visible = names.filter(name => name[0] !== "." && name[0] !== "_");
		const dirs = [];
		const files = [];
		for (const name of visible) {
			const stat = await fsCall(fs.stat, `${dir}/${name}`);
			(stat.isDirectory() ? dirs : files).push(name);
		}
		return { dirs, files };
	};

	const copyInto = async (srcDir, destDir) => {
		const { dirs, files } = await scan(srcDir);
		if (dirs.length || files.length) {
			await fsCall(fs.mkdir, destDir, { recursive: true });
		}
		let count = 0;
		for (const name of files) {
			const buffer = await fsCall(fs.readFile, `${srcDir}/${name}`);
			await fsCall(fs.writeFile, `${destDir}/${name}`, buffer);
			count++;
		}
		for (const name of dirs) {
			count += await copyInto(`${srcDir}/${name}`, `${destDir}/${name}`);
		}
		return count;
	};

	return {
		/** @param {"legacy"|"current"} which */
		async listFolders(which) {
			const { dirs } = await scan(which === "legacy" ? legacyRoot : currentRoot);
			return dirs;
		},
		async copyFolder(name) {
			// 端口自己再挡一次路径上跳：名字来自对方目录，不能相信任何输入
			if (!name || name[0] === "." || /[/\\]/.test(name)) return 0;
			return copyInto(`${legacyRoot}/${name}`, `${currentRoot}/${name}`);
		},
	};
}

/**
 * 点「导入」时真正写配置：逐项 `game.saveConfig`，最后打标记。
 * @param {{items?: Array, count?: number, from?: string|null}} entry - `importable` 条目
 * @param {{save?: Function, currentName?: string}} [deps]
 * @returns {{kind: "migrated"|"migrate_failed", count?: number, from?: string|null, message?: string}}
 */
export function applyLegacyImport(entry, { save = (key, value) => game.saveConfig(key, value), currentName } = {}) {
	const items = Array.isArray(entry?.items) ? entry.items : [];
	const name = currentName || (typeof decadeUIName === "string" && decadeUIName) || DEFAULT_CURRENT_NAME;
	try {
		for (const item of items) save(item.to, item.value);
		save(migrationMarkKey(name), entry?.from || "unknown");
		return { kind: "migrated", count: items.length, from: entry?.from ?? null };
	} catch (e) {
		console.error("[十周年UI] 导入旧版设置失败：", e);
		return { kind: "migrate_failed", count: 0, message: String(e?.message ?? e) };
	}
}

/**
 * 启动时跑一次。
 *
 * 依赖全部在 `try` 里解出来：默认参数是在函数体外求值的，
 * 一旦 `getModuleSystem()` 之类抛错就会直接卡住启动——这里必须先把它们关进兜底里。
 * @param {Object} [options] - 测试注入用（config/installed/extensionPack/defaults/modules/save/skinIo/名字）
 * @returns {{report: Object|null, entries: Array, ready: Promise<Array>}}
 *   `entries` 是同步就能定下来的部分（关旧版 / 可导入），`ready` 等卡面复制完再解析为完整列表。
 */
export function runLegacyMigration(options = {}) {
	let report;
	let entries;
	let deps;
	try {
		deps = {
			config: options.config ?? lib?.config,
			extensionPack: options.extensionPack ?? lib?.extensionPack,
			installed: options.installed ?? lib?.config?.extensions,
			defaults: options.defaults ?? collectDefaults(),
			modules: options.modules ?? collectModules(getModuleSystem()),
			save: options.save ?? ((key, value) => game.saveConfig(key, value)),
			skinIo: "skinIo" in options ? options.skinIo : createSkinIo(),
			currentName: options.currentName ?? (typeof decadeUIName === "string" && decadeUIName ? decadeUIName : DEFAULT_CURRENT_NAME),
			legacyName: options.legacyName ?? LEGACY_EXTENSION_NAME,
		};
		report = detectLegacy({
			config: deps.config,
			installed: deps.installed,
			extensionPack: deps.extensionPack,
			defaults: deps.defaults,
			modules: deps.modules,
			legacyName: deps.legacyName,
			currentName: deps.currentName,
		});
		entries = [];

		if (report.conflict) {
			deps.save(legacyEnableKey(report.legacy.name), false);
			entries.push({ kind: "closed", id: report.legacy.name, version: report.legacy.version });
		}

		// 配置只准备计划，不写：写动作在提示窗的「导入」按钮里（用户决定：半自动）
		if (report.migration.needed && !report.alreadyMigrated) {
			const entry = {
				kind: "importable",
				count: report.migration.items.length,
				items: report.migration.items,
				from: report.legacy.version,
			};
			entry.apply = () => applyLegacyImport(entry, { save: deps.save, currentName: deps.currentName });
			entries.push(entry);
		}
	} catch (e) {
		console.error("[十周年UI] 旧版本检测失败（已忽略）：", e);
		return { report: null, entries: [], ready: Promise.resolve([]) };
	}

	const { skinIo, currentName } = deps;
	const ready = (async () => {
		if (!skinIo) return entries;
		const [legacyFolders, currentFolders] = await Promise.all([skinIo.listFolders("legacy"), skinIo.listFolders("current")]);
		const plan = planSkins({ legacyFolders, builtinFolders: BUILTIN_SKIN_FOLDERS, currentFolders });
		if (!plan.needed) return entries;
		const copied = [];
		let files = 0;
		for (const item of plan.items) {
			const count = await skinIo.copyFolder(item.name);
			if (count > 0) {
				copied.push({ name: item.name });
				files += count;
			}
		}
		if (copied.length) entries.push({ kind: "skins", count: copied.length, items: copied, files });
		return entries;
	})().catch(error => {
		// 读不到旧目录（权限/平台/旧版没装过卡面）都不值得打扰玩家：卡面这一路整个放弃，配置导入照常可用
		console.warn("[十周年UI] 旧版卡面复制已跳过：", error?.message ?? error);
		return entries;
	});

	return { report, entries, ready };
}
