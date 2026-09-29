/**
 * P15 · card-skin 卸载后的两根行为（任务书§19 + §51「模块」，批 3 留下的那条特殊判据）
 *
 * card-skin 不能套用普通样式包的卸载判据，因为它有**两个资源根**：
 *   · 内置五套（online/caise/decade/bingkele/gold）的根随包的安装状态切换 —— 决策唯一来源是
 *     `resourceLoader.getModuleRel("card-skin")`（`statics.js:253` 扫描与 `skin-loader.js:73` 拼地址共用它）；
 *   · 玩家自己丢进 `image/card-skins/` 的文件夹永远在扩展根（"丢进去就能用"是既有行为，不该被卸载牵连）。
 * 卸载后期望：内置五套扫到 0 张 ⇒ 可用性判假 ⇒ `buildSkinUrl` 返回空串（等价 off，走本体默认卡面），
 * 而自建套地址一字不变。可用性只能由内部那一次扫描发布（`registerSkins` 的 publishAvailability），
 * 第三方 `registerDecadeCardSkin` 无权改写 —— 这条也在下面钉住。
 *
 * Node 里跑不了真实目录扫描（要 fs 端口），所以"扫描产出"用 `setCardSkinAvailable` 如实模拟，
 * 而**根决策**走真实的 resourceLoader + 注册表，不模拟。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.decadeUIName = "十周年UI-Stars";
const ROOT = "file:///ext/extension/十周年UI-Stars/";
globalThis.window = { decadeUIName: "十周年UI-Stars", decadeUIPath: ROOT };
globalThis.decadeUIPath = ROOT;
globalThis.lib = globalThis.lib ?? { config: {} };

const { getModuleSystem } = await import("../src/core/moduleSystem.js");
const { normalizeManifest } = await import("../src/core/manifest.js");
const { buildSkinUrl, getFallbackKey } = await import("../src/overrides/card/skin-loader.js");
const {
	cardSkinPresets,
	cardSkinMeta,
	isBuiltinCardSkin,
	registerDynamicSkin,
	setCardSkinAvailable,
	isCardSkinAvailable,
	getAvailableCardSkinPresets,
} = await import("../src/config/utils.js");

const { registry, moduleManager, resourceLoader } = getModuleSystem();
const packManifest = JSON.parse(fs.readFileSync("modules/card-skin/1.4.2/manifest.json", "utf8"));
const BUILTIN_KEYS = cardSkinPresets.map(skin => skin.key);

// ── 1. 内置五套的名单与"内置判定"必须同源（判错就会拿错根） ───────────────────
assert.equal(BUILTIN_KEYS.length, 5, "内置五套");
assert.deepEqual(
	BUILTIN_KEYS,
	["online", "caise", "decade", "bingkele", "gold"],
	"内置套名单变了要同步检查 statics 扫描与包内资源"
);
for (const key of BUILTIN_KEYS) assert.equal(isBuiltinCardSkin(key), true, `${key} 必须是内置套`);
registerDynamicSkin({ key: "myskin", dir: "myskin", label: "我自己丢的", extension: "png" });
assert.equal(isBuiltinCardSkin("myskin"), false, "玩家自建套不许被当成内置（否则它的根会被包状态带走）");

// ── 2. 未装包：内置套回落扩展根，自建套同址（此时盘上真有副本才谈得上可用） ──
assert.equal(resourceLoader.getModuleRel("card-skin"), "", "未装包时 card-skin 资源根应为扩展根");
const builtinWhenBare = buildSkinUrl("decade", "sha");
const mineWhenBare = buildSkinUrl("myskin", "sha");
assert.ok(builtinWhenBare.startsWith(`${ROOT}image/card-skins/decade/`), `未装包时内置套地址异常：${builtinWhenBare}`);
assert.ok(mineWhenBare.startsWith(`${ROOT}image/card-skins/myskin/`), `自建套必须始终在扩展根：${mineWhenBare}`);

// ── 3. 装包：内置套改指包内目录，自建套一个字都不许变 ───────────────────────
// 注册协议与启动/安装器一致：registry 对"同 id 不同版本"抛错拒绝，先 unregister 再覆盖
// （40f7933 修的就是启动路径漏了这一步）
registry.unregister("card-skin");
assert.equal(moduleManager.register(normalizeManifest(packManifest), { source: "installed" }).ok, true);
assert.equal(resourceLoader.getModuleRel("card-skin"), `modules/card-skin/${packManifest.version}/`);
const builtinInstalled = buildSkinUrl("decade", "sha");
assert.ok(
	builtinInstalled.startsWith(`${ROOT}modules/card-skin/${packManifest.version}/image/card-skins/decade/`),
	`装包后内置套必须从包根取资源：${builtinInstalled}`
);
assert.equal(buildSkinUrl("myskin", "sha"), mineWhenBare, "装包不许改变玩家自建套的地址（两根决策互不牵连）");
assert.ok(builtinInstalled !== mineWhenBare, "两条地址必须来自两个不同的根");

// ── 4. 卸载：注册状态与根回落，且不许留下任何版本目录 ───────────────────────
registry.unregister("card-skin");
assert.equal(moduleManager.getInstallState("card-skin").independent, false, "卸载后不再是独立安装");
assert.equal(resourceLoader.getModuleRel("card-skin"), "", "卸载后资源根必须回落扩展根，不许指向已删掉的包目录");
assert.ok(!buildSkinUrl("decade", "sha").includes("modules/card-skin/"), "卸载后地址里不许再出现包目录（否则牌面 404）");
assert.equal(buildSkinUrl("myskin", "sha"), mineWhenBare, "卸载后自建套地址依旧不变");

// ── 5. 可用性：扫描是唯一真相；判假就不给地址，未发布过则乐观可用 ─────────────
assert.equal(isCardSkinAvailable("myskin"), true, "没扫描过之前不许把皮肤抹掉（菜单在扫描完成前要能列出）");
setCardSkinAvailable("decade", false);   // 等价于卸载后内部扫描"内置五套 0 张"的产出
assert.equal(isCardSkinAvailable("decade"), false);
assert.equal(buildSkinUrl("decade", "sha"), "", "不可用的内置套必须返回空串，让卡面等价 off 走本体默认");
assert.ok(buildSkinUrl("myskin", "sha").length > 0, "同一次卸载里自建套必须仍然可用（双根行为不同）");
assert.equal(getAvailableCardSkinPresets().some(skin => skin.key === "decade"), false, "下拉里不该再列出不可用的内置套");
assert.ok(getAvailableCardSkinPresets().some(skin => skin.key === "myskin"), "下拉里必须还能看到自建套");
setCardSkinAvailable("decade", true);
assert.ok(buildSkinUrl("decade", "sha").length > 0, "重新装包并扫到牌面后应恢复（可用性可逆，不是一次性）");

// ── 6. 回退链不许把不可用的套当目标 ─────────────────────────────────────────
{
	// bingkele → decade、gold → caise 的回退映射存在，但目标必须"真有牌面"才允许回退，
	// 否则会拼出一个不存在的地址去 new Image()（skin-loader.js:54-55 的判据）。
	setCardSkinAvailable("decade", true);
	assert.equal(getFallbackKey("bingkele"), "decade", "目标可用时应回退到它");
	setCardSkinAvailable("decade", false);
	assert.equal(getFallbackKey("bingkele"), null, "目标不可用时不许回退（宁可不给地址走本体默认）");
	setCardSkinAvailable("caise", false);
	assert.equal(getFallbackKey("gold"), null, "gold 的回退目标 caise 同样受可用性把关");
	setCardSkinAvailable("decade", true);
	setCardSkinAvailable("caise", true);
}

// ── 7. 静态不变量：根决策只许有一处，扫描与拼地址必须读同一个来源 ──────────────
{
	const statics = fs.readFileSync(new URL("../src/core/statics.js", import.meta.url), "utf8");
	const loader = fs.readFileSync(new URL("../src/overrides/card/skin-loader.js", import.meta.url), "utf8");
	assert.match(statics, /const packRel = getModuleSystem\(\)\.resourceLoader\.getModuleRel\("card-skin"\);/, "扫描的包根必须取自 getModuleRel");
	assert.match(statics, /const rel = isBuiltinCardSkin\(skin\.key\) \? packRel : "";/, "内置套走包根、自建套走扩展根，判据只此一处");
	assert.match(loader, /isBuiltinCardSkin\(skinKey\) \? getModuleSystem\(\)\.resourceLoader\.getModuleBase\("card-skin"\) : decadeUIPath/, "拼地址必须复用同一个根决策");
	// 不许出现第二份"内置套名单"或手写包路径
	assert.equal(/card-skin\/1\.4\.\d/.test(statics + loader), false, "不许在扫描/加载里硬编码版本号目录");
	assert.equal(statics.split("getModuleRel(\"card-skin\")").length - 1, 1, "getModuleRel(\"card-skin\") 在扫描里只许出现一次");
}

console.log("p15-card-skin-uninstall-roots: OK（双根切换、卸载回落、可用性单一来源、回退目标、静态不变量）");
