/**
 * P8 第二刀：card-skin 拆包（第一个 pack:true 的 Feature）—— 双根扫描与降级测试
 * 运行：node --import ./tests/helpers/register.mjs tests/p8-card-skin-pack.test.mjs
 *
 * 用假 game.getFileList（目录表）驱动真实的 statics 扫描，锁四件事：
 *   1. 内置五套的根随安装状态切换（getModuleRel → modules/card-skin/<ver>/ 或扩展根）；
 *   2. 玩家自己丢进 image/card-skins/ 的文件夹**永远**扫单体根（既有行为不许破）；
 *   3. 未装包时内置五套扫到空 → 发布"不可用" → 下拉里消失、buildSkinUrl 出空串（不产生 404）；
 *   4. 第三方 window.registerDecadeCardSkin({extensionName}) 的根完全不受影响。
 */
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.decadeUIName = "十周年UI-Stars";
globalThis.decadeUIPath = "http://localhost:8089/extension/十周年UI-Stars/";

const { lib, game } = await import("noname");
lib.config = {};
lib.assetURL = "http://localhost:8089/";

const EXT = "extension/十周年UI-Stars";
const MONO = `${EXT}/image/card-skins`;
const PACK = `${EXT}/modules/card-skin/1.4.2/image/card-skins`;

/** 假目录表：dir → { folders, files }；本体签名是 success(folders, files) */
const table = new Map();
const scanned = [];
const put = (dir, { folders = [], files = [] }) => table.set(dir, { folders, files });

game.getFileList = (dir, success, error) => {
	scanned.push(dir);
	const hit = table.get(dir);
	if (hit) success(hit.folders, hit.files);
	else if (typeof error === "function") error();
};
game.readFileAsText = (path, success, error) => {
	if (path === `${MONO}/myself/meta.json`) success(JSON.stringify({ label: "我的皮肤", extension: "jpg" }));
	else if (typeof error === "function") error();
};

/** 内置五套：装包后只存在于包根 */
const BUILTIN_SETS = [
	{ folder: "decade", ext: "png" },
	{ folder: "caise", ext: "webp" },
	{ folder: "online", ext: "jpg" },
	{ folder: "gold", ext: "webp" },
	{ folder: "bingkele", ext: "png" },
];
for (const { folder, ext } of BUILTIN_SETS) {
	put(`${PACK}/${folder}`, { files: [`sha.${ext}`, `huasuo.${ext}`, "meta.json"] });
}
/** 玩家自己丢的文件夹：永远在单体根 */
put(MONO, { folders: ["myself"] });
put(`${MONO}/myself`, { files: ["sha.jpg", "meta.json"] });

const settle = async () => {
	for (let i = 0; i < 6; i++) await Promise.resolve();
	await new Promise(resolve => setTimeout(resolve, 5));
};

const { getModuleSystem } = await import("../src/core/moduleSystem.js");
const { createStaticsModule } = await import("../src/core/statics.js");
const { isCardSkinAvailable, getAvailableCardSkinPresets } = await import("../src/config/utils.js");
const { buildSkinUrl } = await import("../src/overrides/card/skin-loader.js");
const { buildRows } = await import("../src/core/moduleAdmin.js");
const { featureRuntime, moduleManager, registry, resourceLoader } = getModuleSystem();

// ------------------------------------------------------------------ Feature 声明与门控

{
	const declaration = featureRuntime.get("card-skin");
	assert.ok(declaration, "card-skin 必须声明为 Feature（任务书§45 第二刀）");
	assert.equal(declaration.pack, true, "card-skin 是第一个拆包型 Feature");
	assert.equal(declaration.switchKey, null, "开关语义仍归 cardPrettify（off=关闭），不许造第二个状态源");
	assert.deepEqual(declaration.capabilities, ["card-skin"]);
	assert.equal(featureRuntime.active("card-skin"), false, "pack:true 而包未装 → 不得激活");
	assert.equal(resourceLoader.getModuleRel("card-skin"), "", "未装 → 相对根为空（回落扩展根）");
}

// ------------------------------------------------------------------ 未装包：内置扫到空即不可用，玩家皮肤照旧

{
	scanned.length = 0;
	const statics = createStaticsModule();
	await settle();

	assert.ok(scanned.includes(`${MONO}/myself`), "玩家目录必须继续在单体根下被发现");
	assert.ok(scanned.includes(`${MONO}/decade`), "未装包时内置套的扫描根回落单体（找不到就是找不到，不许猜包路径）");
	assert.equal(statics.cards.READ_OK.decade, true, "扫描流程照常结束（空目录不等于卡住）");
	assert.equal(isCardSkinAvailable("decade"), false, "内置五套扫到空 → 如实不可用");
	assert.equal(isCardSkinAvailable("myself"), true, "玩家皮肤不受包安装状态影响");

	const options = getAvailableCardSkinPresets().map(s => s.key);
	assert.equal(options.includes("decade"), false, "未装包：内置五项从下拉消失");
	assert.equal(options.includes("caise"), false);
	assert.ok(options.includes("myself"), "未装包：玩家自己的皮肤仍在列表");

	assert.equal(buildSkinUrl("decade", "sha"), "", "不可用的内置套不许生成 404 地址（等同 off 走本体默认卡面）");
	assert.equal(buildSkinUrl("myself", "sha"), `${decadeUIPath}image/card-skins/myself/sha.jpg`, "玩家皮肤地址不进包根");
}

// ------------------------------------------------------------------ 装上包：双根并存

{
	registry.unregister("card-skin");
	const registered = moduleManager.register(
		{ schema: 1, id: "card-skin", name: "卡牌皮肤", version: "1.4.2", type: "feature", core: ">=0.0.0", entry: { js: [], css: [] }, capabilities: ["card-skin"] },
		{ source: "installed" }
	);
	assert.equal(registered.ok, true, `夹具注册失败: ${(registered.errors || []).join(", ")}`);
	assert.equal(featureRuntime.active("card-skin"), true, "装包后激活（无开关 ⇒ 资源在场即可用）");
	assert.equal(resourceLoader.getModuleRel("card-skin"), "modules/card-skin/1.4.2/", "相对根切到包内");

	scanned.length = 0;
	const statics = createStaticsModule();
	await settle();

	assert.ok(scanned.includes(`${PACK}/decade`), "内置五套改扫包根");
	assert.equal(scanned.includes(`${MONO}/decade`), false, "同一套皮肤不许两个根都扫（避免旧副本复活）");
	assert.ok(scanned.includes(`${MONO}/myself`), "双根并存：玩家目录仍扫单体根");

	assert.equal(isCardSkinAvailable("decade"), true);
	assert.equal(statics.cards.decade.sha.url, `${decadeUIPath}modules/card-skin/1.4.2/image/card-skins/decade/sha.png`, "缓存里的 baseUrl 必须落在包根");
	assert.equal(statics.cards.myself.sha.url, `${decadeUIPath}image/card-skins/myself/sha.jpg`, "玩家皮肤仍落单体根");

	assert.equal(buildSkinUrl("decade", "sha"), `${decadeUIPath}modules/card-skin/1.4.2/image/card-skins/decade/sha.png`);
	assert.equal(buildSkinUrl("myself", "sha"), `${decadeUIPath}image/card-skins/myself/sha.jpg`);

	const options = getAvailableCardSkinPresets().map(s => s.key);
	for (const { folder } of BUILTIN_SETS) assert.ok(options.includes(folder), `装包后内置套 ${folder} 要回到下拉`);

	// 第三方约定：皮肤根在别人扩展的目录里，与 card-skin 包无关
	statics.registerCardSkin({ extensionName: "别的扩展", skinKey: "outsider", folder: "outsider", extension: "png", cardNames: ["sha"] });
	assert.equal(statics.cards.outsider.sha.url, `${lib.assetURL}extension/别的扩展/image/card-skins/outsider/sha.png`, "§57 不可破坏 API：外部扩展皮肤根不许被改写");
}

// ------------------------------------------------------------------ P6 行：只有安装/卸载，没有启停

{
	const modules = moduleManager.list().map(item => ({ id: item.id, name: item.name, type: item.type, version: item.version, dependencies: moduleManager.getManifest?.(item.id)?.dependencies || [] }));
	const states = {};
	for (const item of featureRuntime.list()) {
		states[item.id] = { pack: item.pack === true, switchKey: item.switchKey || null, enabled: featureRuntime.switchOn(item.id) !== false };
	}
	const rowOf = rows => rows.find(item => item.id === "card-skin");

	const offline = buildRows({ installed: {}, index: null, modules, coreVersion: "1.4.2", featureStates: states });
	const notInstalled = rowOf(offline.rows);
	assert.equal(notInstalled.type, "feature");
	assert.deepEqual(notInstalled.actions.map(a => a.kind), ["install"], "拆包型 Feature 未装只给安装");
	assert.equal(notInstalled.actions[0].enabled, false, "没有模块源就装不了，理由要说清");
	assert.match(notInstalled.actions[0].reason, /模块源/);

	const installedRows = buildRows({ installed: { "card-skin": { version: "1.4.2" } }, index: null, modules, coreVersion: "1.4.2", featureStates: states }).rows;
	assert.deepEqual(
		installedRows.find(item => item.id === "card-skin").actions.map(a => a.kind),
		["uninstall"],
		"装好后只有卸载；switchKey 为 null 不许冒出启用/禁用按钮"
	);
	const kill = installedRows.find(item => item.id === "kill-effect");
	assert.deepEqual(kill.actions.map(a => a.kind), ["disable"], "同一列表里门控型 Feature 的启停不受拆包型影响");
}

// ------------------------------------------------------------------ 第三方注册不得污染可用性（P1 兼容性回归）

{
	// 上一块已把 card-skin 注册为已安装；重起一次内部扫描作为干净起点
	const statics = createStaticsModule();
	await settle();
	assert.equal(isCardSkinAvailable("decade"), true, "A：包装上且内置 decade 扫到牌面 → 可用");

	// B：第三方用**已有** skinKey 注册，而它自己的目录不存在/为空
	statics.registerCardSkin({ extensionName: "空壳扩展", skinKey: "decade", extension: "png" });
	await settle();
	assert.equal(isCardSkinAvailable("decade"), true, "B：第三方的空目录不许把内置 decade 整体标成不可用");
	assert.equal(getAvailableCardSkinPresets().some(skin => skin.key === "decade"), true, "B：下拉里内置 decade 必须还在（否则 skin-applier 会当成 off）");

	// C：第三方用已有 skinKey + cardNames → 它补的牌面走它自己的根，内置同名条目不被覆盖
	statics.registerCardSkin({ extensionName: "同行扩展", skinKey: "decade", extension: "png", cardNames: ["sha", "yijie"] });
	assert.equal(statics.cards.decade.yijie.url, `${lib.assetURL}extension/同行扩展/image/card-skins/decade/yijie.png`, "第三方补的牌面指向它的扩展目录（§57 根不变）");
	assert.equal(statics.cards.decade.sha.url, `${decadeUIPath}modules/card-skin/1.4.2/image/card-skins/decade/sha.png`, "内置同名条目优先，第三方不许覆盖（原版去重行为）");
	assert.equal(isCardSkinAvailable("decade"), true, "C：第三方注册根本不写 cardSkinAvailability");

	// D：第三方用新 skinKey → 原有行为保持；空目录也不得写出一条"不可用"（不写＝乐观可用）
	statics.registerCardSkin({ extensionName: "另一扩展", skinKey: "fresh", extension: "png" });
	await settle();
	assert.equal(isCardSkinAvailable("fresh"), true, "D：第三方路径完全不参与可用性发布，否则就是第二个状态源");
	assert.equal(Object.keys(statics.cards.fresh).length, 0, "D：空目录注册后仍按原样留下空缓存");
	assert.equal(statics.cards.READ_OK.fresh, true, "D：READ_OK 语义未变（可用性是另一个维度，不许搭车改写）");
}

console.log("P8 card-skin-pack tests: all passed ✓");
