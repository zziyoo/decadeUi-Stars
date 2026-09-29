/**
 * P14 · 批2真机查出的缺陷：启动期"已安装的包"注册不过"内置注册"。
 *
 * 真机现象（2026-09-29，完全退出重开后的探针）：把 baby 更新到 1.4.4 后重启，
 *   moduleManager.list() 里 baby 仍是 1.4.2，getModuleBase('baby') 落回扩展根，
 *   而 decadeModule 只在 installState.independent 为真时才读包内 entry.css
 *   ⇒ 已迁移成包的样式**一套 CSS 都不加载**，界面退回裸样式（不是"用了旧版"，是"没有样式"）。
 *
 * 根因是顺序 + 一条既有约定：getModuleSystem() 先按本体版本注册内置（moduleSystem.js:30），
 *   registerInstalledModules() 后到（precontent.js:32），而 registry.register 对
 *   "同 id 不同版本"是**抛错拒绝**的（注释写着版本切换交由安装器处理——安装器运行时会先
 *   unregister，见 packageInstaller.js:787）。启动这条路上没有人 unregister，于是内置那份赢。
 *   平时看不出来，是因为台账版本 == 本体版本 时走的是"同版本覆盖"分支。
 */
import assert from "node:assert/strict";
import { lib } from "noname";

globalThis.decadeUIName = "十周年UI-Stars";
lib.config ??= {};
// 内置注册取的就是这个版本号（moduleSystem.js:31），拿它当"本体版本"造不一致
lib.extensionPack = { [globalThis.decadeUIName]: { version: "1.4.2" } };

const { getModuleSystem, registerInstalledModules } = await import("../src/core/moduleSystem.js");

/** 与盘上真实包清单同形状（schema/id/name/version/type/core/entry/capabilities） */
const packManifest = (id, version, skin) => ({
	schema: 1,
	id,
	name: `${id}样式`,
	version,
	type: "style",
	core: ">=1.4.2",
	dependencies: ["core"],
	entry: { js: [`ui/character/skins/${skin}.js`], css: ["player.css", "styles/character.css"] },
	capabilities: ["player-frame", "lbtn"],
	platform: ["desktop", "mobile"],
	author: "子右",
});

/** 只桩 registerInstalledModules 用到的那两次 fetch（installed.json + 各包清单） */
const serve = files => async url => {
	const hit = files[url];
	if (!hit) return { ok: false, status: 404, json: async () => { throw new Error("not found"); } };
	return { ok: true, status: 200, json: async () => structuredClone(hit) };
};

const { registry, moduleManager, resourceLoader } = getModuleSystem();
const stateOf = id => moduleManager.getInstallState(id);
const metaOf = id => registry.get(id)?.meta ?? null;

// 装配期内置注册必须已经跑过（这条用例的前提，也是"内置先、已安装后"这个顺序本身）
assert.equal(stateOf("baby").version, "1.4.2", "前提：内置注册按本体版本登记");
assert.equal(stateOf("baby").independent, false, "前提：内置那份不算独立安装");

// ── 1. 真机复现：已安装版本 ≠ 本体版本 ⇒ 已安装那份必须赢 ─────────────────────
globalThis.fetch = serve({
	"modules/installed.json": { schema: 1, modules: { baby: { version: "1.4.4" } } },
	"modules/baby/1.4.4/manifest.json": packManifest("baby", "1.4.4", "baby"),
});
await registerInstalledModules();

assert.equal(stateOf("baby").independent, true, "已安装的 1.4.4 必须以 source=installed 登记（否则样式寻址落回扩展根）");
assert.equal(stateOf("baby").version, "1.4.4", "注册表里的版本必须跟台账一致");
assert.equal(resourceLoader.getModuleRel("baby"), "modules/baby/1.4.4/", "资源根必须解析到包目录");
// 别名 meta 是内置注册带进来的（styleValue/skin/playerCssIndex）。眼下只有 meta.source 被
// getInstallState 读，这三个还没有消费者——但它们是"样式↔包"的唯一反查线索，覆盖时不该顺手丢掉。
assert.equal(metaOf("baby").skin, "baby", "覆盖注册不许丢别名 meta");
assert.equal(metaOf("baby").styleValue, "babysha", "覆盖注册不许丢别名 meta");
assert.equal(metaOf("baby").playerCssIndex, 5, "覆盖注册不许丢别名 meta");

// ── 2. 同版本（平时的样子）：仍然以 installed 覆盖，行为不许变 ───────────────────
globalThis.fetch = serve({
	"modules/installed.json": { schema: 1, modules: { codename: { version: "1.4.2" } } },
	"modules/codename/1.4.2/manifest.json": packManifest("codename", "1.4.2", "codename"),
});
await registerInstalledModules();
assert.equal(stateOf("codename").independent, true, "同版本仍要走独立安装寻址");
assert.equal(stateOf("codename").version, "1.4.2");
assert.equal(metaOf("codename").skin, "codename", "同版本覆盖同样不许丢别名");

// ── 3. 清单取不到（404）：不许把内置那份一起弄丢 ──────────────────────────────
//    这条约束实现顺序：必须"先取到并校验清单"，再动注册表（unregister 放前面就会自毁）
globalThis.fetch = serve({ "modules/installed.json": { schema: 1, modules: { yjcm: { version: "9.9.9" } } } });
await registerInstalledModules();
assert.equal(stateOf("yjcm").version, "1.4.2", "清单 404 时内置记录必须原样留着");
assert.equal(metaOf("yjcm")?.skin, "xinsha", "清单 404 时别名 meta 必须原样留着");

// ── 4. 清单非法（校验不过）：同上，不许留下"盘上有包、注册表里什么都没有" ─────────
globalThis.fetch = serve({
	"modules/installed.json": { schema: 1, modules: { mobile: { version: "1.4.4" } } },
	"modules/mobile/1.4.4/manifest.json": { ...packManifest("mobile", "1.4.4", "shousha"), type: "widget" },
});
await registerInstalledModules();
assert.equal(stateOf("mobile").version, "1.4.2", "清单非法时内置记录必须原样留着");
assert.equal(stateOf("mobile").independent, false, "清单非法时不许假装已独立安装");

console.log("p14-boot-installed-override: OK");
