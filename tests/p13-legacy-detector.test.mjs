/**
 * P13 旧版本迁移（任务书§50 + §21）。
 *
 * 判据来自用户批准的四条决定（2026-09-28 转录可查）：
 *   Q1 配置搬迁 = **只填未设置的键**（等于默认值也算没设）；
 *   Q2 触发方式 = **提示窗里给「导入」按钮**（零点击不写玩家配置）；
 *   Q3 共存处理 = **自动禁用原版**（启动即写，不按钮）；
 *   Q4 玩家自建卡面 = **自动复制过来**（读旧目录、只写我们自己的目录）。
 *
 * 所以这一层的分工是：`core/legacyDetector.js` 只出事实，
 * `features/legacyMigration.js` 只出动作与记录条目，文案在提示窗里。
 *
 * 最容易被后人改坏的一条：**"玩家没动过"按「当前值 === init 默认值」判，
 * 不按「键是否存在」判**——本体与 content 阶段都会把 init 播种进 lib.config，
 * 首次启动后新键几乎必然存在，照后者判会得到零迁移（功能等于没做）。
 */
import assert from "node:assert/strict";

const {
	LEGACY_EXTENSION_NAME,
	DEFAULT_CURRENT_NAME,
	MIGRATION_MARK_KEY,
	collectLegacyConfig,
	planMigration,
	planSkins,
	detectLegacy,
} = await import("../src/core/legacyDetector.js");

const LEGACY = `extension_${LEGACY_EXTENSION_NAME}_`;
const CURRENT = `extension_${DEFAULT_CURRENT_NAME}_`;
/** 内置五套：Stars 整包自带，旧目录里的同名文件夹不是玩家自建 */
const BUILTIN = ["online", "caise", "decade", "bingkele", "gold"];

/** 造一份"Stars 侧已播种默认值"的配置 */
const seeded = (overrides = {}) => ({
	[`${CURRENT}killEffect`]: true,
	[`${CURRENT}cardPrettify`]: "off",
	[`${CURRENT}rightLayout`]: "on",
	...overrides,
});
const DEFAULTS = { killEffect: true, cardPrettify: "off", rightLayout: "on" };

// ---------------------------------------------------------------- 旧配置枚举

{
	const keys = collectLegacyConfig({
		config: {
			[`${LEGACY}killEffect`]: false,
			[`${LEGACY}enable`]: true,
			[`${LEGACY}characters_enable`]: false,
			[`${LEGACY}cards_enable`]: true,
			[`${LEGACY}nothing`]: null,
			[`${LEGACY}gone`]: undefined,
			[`${CURRENT}killEffect`]: true,
			"extension_其他扩展_x": 1,
		},
	});
	assert.deepEqual(keys, [{ name: "killEffect", value: false }], "只收旧前缀、排除本体开关与空值");
}
{
	// 新旧前缀互不命中：Stars 的键绝不能被当成旧键收进来
	const keys = collectLegacyConfig({ config: { [`${CURRENT}rightLayout`]: "on" } });
	assert.equal(keys.length, 0);
}
{
	// 排序稳定（大量键时迁移列表顺序可预期）
	const keys = collectLegacyConfig({
		config: { [`${LEGACY}b`]: 1, [`${LEGACY}a`]: 2, [`${LEGACY}c`]: 3 },
	});
	assert.deepEqual(keys.map(k => k.name), ["a", "b", "c"]);
}

// ---------------------------------------------------------------- 迁移计划：只补没动过的键

{
	const plan = planMigration({
		config: seeded({ [`${LEGACY}killEffect`]: false }),
		defaults: DEFAULTS,
		keys: [{ name: "killEffect", value: false }],
	});
	assert.equal(plan.needed, true);
	assert.deepEqual(plan.items, [
		{ name: "killEffect", from: `${LEGACY}killEffect`, to: `${CURRENT}killEffect`, value: false },
	]);
}
{
	// 玩家在 Stars 侧改过（值 ≠ 默认）⇒ 绝不覆盖
	const plan = planMigration({
		config: seeded({ [`${CURRENT}killEffect`]: false, [`${LEGACY}killEffect`]: true }),
		defaults: DEFAULTS,
		keys: [{ name: "killEffect", value: true }],
	});
	assert.equal(plan.needed, false);
	assert.match(plan.skipped[0].reason, /已设置/);
}
{
	// 旧值恰好等于默认值 ⇒ 迁了也没变化，跳过
	const plan = planMigration({
		config: seeded({ [`${LEGACY}killEffect`]: true }),
		defaults: DEFAULTS,
		keys: [{ name: "killEffect", value: true }],
	});
	assert.equal(plan.needed, false);
	assert.match(plan.skipped[0].reason, /相同/);
}
{
	// Stars 没有这项配置（旧版独有键）⇒ 不凭空造键
	const plan = planMigration({
		config: seeded({ [`${LEGACY}newDecadeStyle`]: "on" }),
		defaults: DEFAULTS,
		keys: [{ name: "newDecadeStyle", value: "on" }],
	});
	assert.equal(plan.needed, false);
	assert.match(plan.skipped[0].reason, /没有这项配置/);
}
{
	// 新键尚未播种（undefined）也算"没动过"，允许补
	const plan = planMigration({
		config: { [`${LEGACY}rightLayout`]: "off" },
		defaults: DEFAULTS,
		keys: [{ name: "rightLayout", value: "off" }],
	});
	assert.equal(plan.needed, true);
	assert.equal(plan.items[0].value, "off");
}
{
	// 对象值按内容比较（配置里存在数组/对象型的值）
	const plan = planMigration({
		config: seeded({ [`${LEGACY}cardPrettify`]: ["a", "b"] }),
		defaults: DEFAULTS,
		keys: [{ name: "cardPrettify", value: ["a", "b"] }],
	});
	assert.equal(plan.needed, true);
	assert.deepEqual(plan.items[0].value, ["a", "b"]);
}

// ---------------------------------------------------------------- 卡面计划：内置五套不算玩家自建

{
	const plan = planSkins({ legacyFolders: [...BUILTIN, "myOl", "手搓套"], builtinFolders: BUILTIN, currentFolders: [] });
	assert.deepEqual(plan.items, [{ name: "myOl" }, { name: "手搓套" }], "只留非内置的文件夹");
	assert.equal(plan.needed, true);
}
{
	// 同名已存在 ⇒ 跳过并在原因里说明（这是"重复启动不重复复制"的幂等保证）
	const plan = planSkins({ legacyFolders: ["myOl"], builtinFolders: BUILTIN, currentFolders: ["myOl"] });
	assert.equal(plan.items.length, 0);
	assert.match(plan.skipped[0].reason, /已有|已存在/);
}
{
	// 内置五套不是玩家自建，但也不能被"跳过原因"漏掉（旧目录里那五套是原版的，不用搬）
	const plan = planSkins({ legacyFolders: ["decade"], builtinFolders: BUILTIN, currentFolders: [] });
	assert.equal(plan.items.length, 0);
	assert.match(plan.skipped[0].reason, /内置/);
}
{
	// 名称必须能安全拼路径：带分隔符/上跳/点开头的条目一律不收
	const plan = planSkins({
		legacyFolders: ["..", "a/b", "c\\d", ".hidden", "_x", "ok"],
		builtinFolders: BUILTIN,
		currentFolders: [],
	});
	assert.deepEqual(plan.items, [{ name: "ok" }]);
}
{
	const plan = planSkins({ legacyFolders: null, builtinFolders: null, currentFolders: null });
	assert.equal(plan.needed, false);
	assert.deepEqual(plan.items, []);
}

// ---------------------------------------------------------------- 环境判定

{
	const r = detectLegacy({ config: seeded(), installed: [DEFAULT_CURRENT_NAME], extensionPack: {} });
	assert.equal(r.kind, "absent");
	assert.equal(r.conflict, false);
	assert.equal(r.migration.needed, false);
}
{
	// 旧版装了且启用 ⇒ 冲突（这一条与"要不要迁配置"无关，启动即关）
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}enable`]: true, [`${LEGACY}killEffect`]: false }),
		installed: [LEGACY_EXTENSION_NAME],
		extensionPack: { [LEGACY_EXTENSION_NAME]: { version: "1.4.2" } },
		defaults: DEFAULTS,
	});
	assert.equal(r.kind, "active");
	assert.equal(r.conflict, true);
	assert.equal(r.legacy.present, true);
	assert.equal(r.legacy.enabled, true);
	assert.equal(r.legacy.version, "1.4.2");
	assert.equal(r.migration.needed, true, "关掉旧版不影响配置照常可迁");
}
{
	// 冲突判据必须与本体装载扩展的判据同形：本体用的是**真值**
	// （game/index.js `if (... || !lib.config['extension_<名>_enable']) return;`），
	// 写成 === true 会把 "true"/1 这类真值漏掉——旧版照样在跑而我们判定"没冲突"。
	for (const truthy of ["true", 1, "yes"]) {
		const r = detectLegacy({ config: { [`${LEGACY}enable`]: truthy }, installed: [LEGACY_EXTENSION_NAME] });
		assert.equal(r.conflict, true, `真值 ${JSON.stringify(truthy)} 必须判为冲突`);
		assert.equal(r.legacy.enabled, true);
	}
	// 假值一律不算冲突：本体那条判据同样不会装载它（含"键不存在"）
	for (const falsy of [false, 0, "", null, undefined]) {
		const r = detectLegacy({ config: falsy === undefined ? {} : { [`${LEGACY}enable`]: falsy }, installed: [LEGACY_EXTENSION_NAME] });
		assert.equal(r.conflict, false, `假值 ${JSON.stringify(falsy)} 不该判冲突`);
	}
}
{
	// 装了但没启用 ⇒ 不冲突，仍可迁配置
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}enable`]: false, [`${LEGACY}killEffect`]: false }),
		installed: [LEGACY_EXTENSION_NAME],
		extensionPack: { [LEGACY_EXTENSION_NAME]: { version: "1.4.2" } },
		defaults: DEFAULTS,
	});
	assert.equal(r.kind, "idle");
	assert.equal(r.conflict, false);
	assert.equal(r.migration.needed, true);
}
{
	// 旧扩展已删但配置残留（最常见的迁移场景）
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}killEffect`]: false }),
		installed: [DEFAULT_CURRENT_NAME],
		extensionPack: {},
		defaults: DEFAULTS,
	});
	assert.equal(r.kind, "residual");
	assert.equal(r.legacy.present, false);
	assert.equal(r.migration.needed, true);
}
{
	// 已迁移过 ⇒ 只报事实，不再给"可导入"
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}killEffect`]: false, [`${CURRENT}${MIGRATION_MARK_KEY}`]: "1.4.2" }),
		installed: [LEGACY_EXTENSION_NAME],
		defaults: DEFAULTS,
	});
	assert.equal(r.alreadyMigrated, true);
	assert.equal(r.current.migratedFrom, "1.4.2");
}
{
	// 迁移标记存在 ≠ 旧版就不会被重新打开：冲突判定独立于迁移
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}enable`]: true, [`${CURRENT}${MIGRATION_MARK_KEY}`]: "1.4.2" }),
		installed: [LEGACY_EXTENSION_NAME],
		defaults: DEFAULTS,
	});
	assert.equal(r.conflict, true);
}

// ---------------------------------------------------------------- 降级：缺参数一律不抛

{
	const r = detectLegacy();
	assert.equal(r.kind, "absent");
	assert.equal(r.migration.needed, false);
	assert.equal(r.conflict, false);
	assert.equal(r.alreadyMigrated, false);
}
{
	const r = detectLegacy({ config: null, installed: null, extensionPack: null, defaults: null, modules: null });
	assert.equal(r.kind, "absent");
	assert.equal(r.current.moduleCount, 0);
}
{
	const r = detectLegacy({
		config: seeded({ [`${LEGACY}killEffect`]: false }),
		installed: [LEGACY_EXTENSION_NAME],
		defaults: DEFAULTS,
		modules: { decade: { version: "1.4.2" }, card: { version: "1.4.2" } },
		extensionPack: { [DEFAULT_CURRENT_NAME]: { version: "1.4.2" } },
	});
	assert.equal(r.current.version, "1.4.2");
	assert.equal(r.current.moduleCount, 2);
}

// ---------------------------------------------------------------- 接线层：真的写什么

const { runLegacyMigration, applyLegacyImport, collectDefaults, BUILTIN_SKIN_FOLDERS } = await import("../src/features/legacyMigration.js");

/**
 * 跑一次接线。`skinIo` 是卡面目录端口（Node 测试用替身；真机是裸 lib.node.fs）。
 * 传 `null` 表示本平台拿不到文件系统（Android/SAF）。
 *
 * 返回的 `entries` 是**等卡面扫完**的条目列表（关旧版那一步是同步写死的，不等它）。
 */
async function runWith(config, { installed = [], extensionPack = {}, defaults = DEFAULTS, modules = {}, skinIo = null, throwing = false } = {}) {
	const calls = [];
	const save = (key, value) => {
		if (throwing) throw new Error("boom");
		calls.push([key, value]);
	};
	const result = runLegacyMigration({ config, installed, extensionPack, defaults, modules, skinIo, save });
	return { ...result, calls, save, entries: await result.ready };
}

/** 造一个卡面端口替身：记录每一次目录读取与复制，便于断言"只复制该复制的那几个" */
function fakeSkinIo({ legacy = {}, current = {} } = {}) {
	const ops = [];
	return {
		ops,
		async listFolders(which) {
			ops.push(`list:${which}`);
			return [...(which === "legacy" ? Object.keys(legacy) : Object.keys(current))];
		},
		/** @returns {Promise<number>} 复制的文件数 */
		async copyFolder(name) {
			ops.push(`copy:${name}`);
			return legacy[name]?.length ?? 0;
		},
	};
}

{
	// 默认值表：来自 config.js 的真实默认值，且不含 clear 项（那些是按钮不是配置项）
	const defaults = collectDefaults();
	assert.equal(Object.keys(defaults).length > 30, true);
	assert.equal("extensionToggle" in defaults, false, "带 clear 的按钮项不算配置项");
	assert.equal("killEffect" in defaults, true);
}

{
	// 内置五套名单与 config/utils 的预设同源（别在迁移层再硬编码一份）
	assert.deepEqual([...BUILTIN_SKIN_FOLDERS].sort(), [...BUILTIN].sort());
}

{
	// 最关键的一条：启动**只关旧版**，一个配置键都不写、标记也不打（Q2：要点一下才写）
	const { calls, entries } = await runWith(
		{ [`${LEGACY}enable`]: true, [`${LEGACY}killEffect`]: false, [`${CURRENT}killEffect`]: true },
		{ installed: [LEGACY_EXTENSION_NAME], extensionPack: { [LEGACY_EXTENSION_NAME]: { version: "1.4.2" } } },
	);
	assert.deepEqual(calls, [[`${LEGACY}enable`, false]], "启动只能写旧版的 enable=false");
	const importable = entries.find(item => item.kind === "importable");
	assert.ok(importable, "可导入项要作为条目交给提示窗（按钮在那里）");
	assert.equal(importable.count, 1);
	assert.equal(importable.from, "1.4.2");
	assert.equal(typeof importable.apply, "function");
	assert.equal(entries.find(item => item.kind === "closed").id, LEGACY_EXTENSION_NAME);
}

{
	// 点「导入」才写配置：逐项 saveConfig，最后打标记；标记值 = 旧版版本号
	const { calls, entries, save } = await runWith(
		{ [`${LEGACY}killEffect`]: false, [`${LEGACY}rightLayout`]: "off", [`${CURRENT}killEffect`]: true },
		{ installed: [LEGACY_EXTENSION_NAME], extensionPack: { [LEGACY_EXTENSION_NAME]: { version: "1.4.2" } } },
	);
	assert.deepEqual(calls, [], "没点按钮就一个键都不写");
	const note = applyLegacyImport(entries.find(item => item.kind === "importable"), { save });
	assert.deepEqual(calls, [
		[`${CURRENT}killEffect`, false],
		[`${CURRENT}rightLayout`, "off"],
		[`${CURRENT}${MIGRATION_MARK_KEY}`, "1.4.2"],
	]);
	assert.equal(note.kind, "migrated");
	assert.equal(note.count, 2);
}

{
	// 卡面端口抛错也不能拖垮迁移：条目里没有 skins，配置导入仍然可用
	const originalWarn = console.warn;
	console.warn = () => {};
	const broken = {
		async listFolders() {
			throw new Error("EACCES");
		},
		async copyFolder() {
			throw new Error("EACCES");
		},
	};
	try {
		const { entries } = await runWith({ [`${LEGACY}killEffect`]: false }, { installed: [LEGACY_EXTENSION_NAME], skinIo: broken });
		assert.equal(entries.find(item => item.kind === "skins"), undefined);
		assert.equal(entries.find(item => item.kind === "importable").count, 1);
	} finally {
		console.warn = originalWarn;
	}
}
{
	// 卡面自动复制（Q4）：读旧目录、只写我们自己的目录，复制成功才有条目
	const skinIo = fakeSkinIo({ legacy: { decade: [1], myOl: [1, 2] }, current: {} });
	const { entries } = await runWith({ [`${LEGACY}killEffect`]: false }, { installed: [LEGACY_EXTENSION_NAME], skinIo });
	assert.deepEqual(skinIo.ops, ["list:legacy", "list:current", "copy:myOl"], "内置五套不复制");
	const skins = entries.find(item => item.kind === "skins");
	assert.equal(skins.count, 1);
	assert.equal(skins.items[0].name, "myOl");
	assert.equal(skins.files, 2);
}

{
	// 幂等：Stars 里已有同名文件夹 ⇒ 不覆盖、不复制、不条目（重复启动不会反复搬）
	const skinIo = fakeSkinIo({ legacy: { myOl: [1] }, current: { myOl: [9] } });
	const { entries } = await runWith({ [`${LEGACY}killEffect`]: false }, { installed: [LEGACY_EXTENSION_NAME], skinIo });
	assert.equal(skinIo.ops.includes("copy:myOl"), false);
	assert.equal(entries.find(item => item.kind === "skins"), undefined);
}

{
	// 非桌面（拿不到文件系统）：卡面这一路整个静默跳过，配置照旧可导入
	const { entries } = await runWith({ [`${LEGACY}killEffect`]: false }, { installed: [LEGACY_EXTENSION_NAME], skinIo: null });
	assert.equal(entries.find(item => item.kind === "skins"), undefined);
	assert.equal(entries.find(item => item.kind === "importable").count, 1);
}

{
	// 已迁移过 ⇒ 不再给「导入」条目（但旧版被重新启用时仍要关）
	const { entries, calls } = await runWith(
		{ [`${LEGACY}enable`]: true, [`${LEGACY}killEffect`]: false, [`${CURRENT}${MIGRATION_MARK_KEY}`]: "1.4.2" },
		{ installed: [LEGACY_EXTENSION_NAME] },
	);
	assert.equal(entries.find(item => item.kind === "importable"), undefined);
	assert.deepEqual(calls, [[`${LEGACY}enable`, false]]);
}

{
	// 没有旧版 ⇒ 一次都不写、一条都不报（绝不给玩家的配置添乱）
	const { calls, entries } = await runWith({ [`${CURRENT}killEffect`]: true }, { installed: [DEFAULT_CURRENT_NAME] });
	assert.deepEqual(calls, []);
	assert.equal(entries.length, 0);
}

{
	// 旧版装着、没启用、也没有可迁键 ⇒ 不写不报
	const { calls, entries } = await runWith(
		{ [`${LEGACY}enable`]: false, [`${CURRENT}killEffect`]: true },
		{ installed: [LEGACY_EXTENSION_NAME] },
	);
	assert.deepEqual(calls, []);
	assert.equal(entries.length, 0);
}

{
	// 写入炸了也不能影响进游戏：吞掉、返回空条目
	const originalError = console.error;
	console.error = () => {};
	try {
		const { entries } = await runWith({ [`${LEGACY}enable`]: true, [`${LEGACY}killEffect`]: false }, { installed: [LEGACY_EXTENSION_NAME], throwing: true });
		assert.equal(entries.length, 0);
	} finally {
		console.error = originalError;
	}
}

{
	// applyLegacyImport 自己抛错也不能带崩窗口
	const originalError = console.error;
	console.error = () => {};
	try {
		const note = applyLegacyImport({ kind: "importable", items: [{ to: `${CURRENT}killEffect`, value: false }] }, {
			save: () => {
				throw new Error("boom");
			},
		});
		assert.equal(note.kind, "migrate_failed");
	} finally {
		console.error = originalError;
	}
}

{
	// 接线顺序不变量（真机踩出来的）：两个扩展共用 `window.decadeUI`，谁先 content()
	// 谁占住、后加载的整段 return。自动禁用必须在那道守卫**之前**，否则恰好在
	// "两套都启用"这个唯一需要它的场景里不执行。
	const { readFileSync } = await import("node:fs");
	const src = readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
	// 只认真正的代码行（制表符缩进 + 语句开头）：注释里也会引用这两句，indexOf 会被骗
	const holderAt = src.search(/\n\tconst holder = window\.decadeUI;/);
	const call = src.search(/\n\tconst legacy = runLegacyMigration\(\);/);
	const guard = src.search(/\n\tif \(holder\) \{/);
	assert.ok(holderAt > -1 && call > -1 && guard > -1, `content.js 里找不到取全局(${holderAt})/调用点(${call})/守卫(${guard})`);
	assert.ok(call < guard, "自动禁用必须排在 window.decadeUI 守卫之前");
	const bail = src.slice(guard, src.indexOf("return;", guard));
	assert.match(bail, /setupUpdateNotice\(\{ legacy \}\)/, "守卫里提前退出时也要把处置结果告诉玩家");
	assert.match(bail, /holder\.isStars/, "本扩展热重载不该被谎报成「界面被旧版占用」");
	assert.match(src, /\n\tdecadeUI\.isStars = true;/, "必须给自己打标记，否则上面那条判据无从判断");
}

console.log("p13-legacy-detector: OK");
