/**
 * P2 公共依赖改造冒烟测试（任务书§37-§38 + P2阻塞问题修复回归）
 * 运行方式：node --import ./tests/helpers/register.mjs tests/p2-smoke.test.mjs
 * （--import 注册 noname 解析钩子，使依赖 noname 的源码模块可在 Node 中加载）
 * 覆盖：styleRuntime 模块级helper、ResourceLoader moduleId寻址/模块根、
 *       loader.js 复用校验、StyleRuntime.getAsset 委托、extension.js 首次初始化顺序
 */
import assert from "node:assert/strict";
import { getStyleConfigKey, readRawStyleValue, getExternalPluginFileName, createStyleRuntime } from "../src/core/styleRuntime.js";

// 模拟游戏全局（window.lib 由本体注入、window.decadeUIName 由 extension.js 注入）
globalThis.window = { decadeUIName: "十周年UI-Stars", lib: { config: {} } };
const KEY = "extension_十周年UI-Stars_newDecadeStyle";

// 配置键拼接
assert.equal(getStyleConfigKey(), KEY);

// 未设置时：原始读取返回 undefined（与直接读 lib.config 完全等价），插件文件名回退 main2.js
assert.equal(readRawStyleValue(), undefined);
assert.equal(getExternalPluginFileName(), "main2.js");

// main1/2/3.js 映射（原 app.js styleFileMap 行为）
globalThis.window.lib.config[KEY] = "on";
assert.equal(readRawStyleValue(), "on");
assert.equal(getExternalPluginFileName(), "main1.js");
globalThis.window.lib.config[KEY] = "othersOff";
assert.equal(getExternalPluginFileName(), "main3.js");
globalThis.window.lib.config[KEY] = "off";
assert.equal(getExternalPluginFileName(), "main2.js");
globalThis.window.lib.config[KEY] = "onlineUI";
assert.equal(getExternalPluginFileName(), "main2.js");

// window.decadeUIName 缺失时回退默认键
globalThis.window.decadeUIName = undefined;
assert.equal(getStyleConfigKey(), KEY);
globalThis.window.decadeUIName = "十周年UI-Stars";

// 实例方法 getRawConfigValue（依赖注入，不归一化）
const fakeManager = { getManifest: () => null };
const store = { "extension_测试_newDecadeStyle": "codename" };
const rt = createStyleRuntime({
	moduleManager: fakeManager,
	getConfig: key => store[key],
	getConfigKey: () => "extension_测试_newDecadeStyle",
});
assert.equal(rt.getRawConfigValue(), "codename");
store["extension_测试_newDecadeStyle"] = undefined;
assert.equal(rt.getRawConfigValue(), undefined, "原始读取不做归一化");

// ---------- ResourceLoader（P2修复：moduleId 正式参与模块寻址） ----------
const { createResourceLoader } = await import("../src/core/resourceLoader.js");

// §11.2 不同 moduleId 在 P2 单体目录阶段均解析到扩展根
const rl = createResourceLoader({ getBasePath: () => "http://game/extension/十周年UI-Stars/" });
assert.equal(rl.getAsset("core", "x.png"), "http://game/extension/十周年UI-Stars/x.png");
assert.equal(rl.getAsset("decade", "x.png"), "http://game/extension/十周年UI-Stars/x.png");
assert.equal(rl.getAsset("mobile", "x.png"), "http://game/extension/十周年UI-Stars/x.png");
assert.equal(rl.getAsset("yjcm", "image/styles/yjcm/a.png"), "http://game/extension/十周年UI-Stars/image/styles/yjcm/a.png");

// getModuleBase 是 P3 唯一切换层：注入即可切换 modules/<id>/<version>/，业务代码无需再改
const rlP3 = createResourceLoader({
	getBasePath: () => "http://game/extension/E/",
	getModuleBase: id => `http://game/extension/E/modules/${id}/1.0.0/`,
});
assert.equal(rlP3.getModuleBase("decade"), "http://game/extension/E/modules/decade/1.0.0/");
assert.equal(rlP3.getAsset("decade", "x.png"), "http://game/extension/E/modules/decade/1.0.0/x.png");

// moduleId 是正式寻址参数：缺失必须报错（禁止回退 _moduleId 忽略模式）
assert.throws(() => rl.getAsset(undefined, "x.png"), /moduleId/);
assert.throws(() => rl.getAsset("core", ""), /path/);

// §11.3 load* 必须复用 src/core/loader.js，不得出现第二套 script/link 去重机制
const fs = await import("node:fs");
const rlSource = fs.readFileSync(new URL("../src/core/resourceLoader.js", import.meta.url), "utf8");
assert.ok(rlSource.includes('from "./loader.js"'), "load* 必须复用 loader.js");
assert.ok(!rlSource.includes('createElement("script")') && !rlSource.includes('createElement("link")'), "禁止自建 script/link 元素");
assert.ok(rlSource.includes("createScriptElement") && rlSource.includes("createLinkElement"));

// ---------- StyleRuntime.getAsset 委托 ResourceLoader（§11.4） ----------
const delegating = createStyleRuntime({
	moduleManager: fakeManager,
	getConfig: () => undefined,
	getConfigKey: () => KEY,
	resourceLoader: { getAsset: (id, p) => `R:${id}:${p}` },
});
assert.equal(delegating.getAsset("decade", "x.png"), "R:decade:x.png");
const noRl = createStyleRuntime({ moduleManager: fakeManager, getConfig: () => undefined, getConfigKey: () => KEY });
assert.throws(() => noRl.getAsset("decade", "x.png"), /resourceLoader/);

// ---------- extension.js 首次初始化顺序（§11.1 修复回归） ----------
// 修复前：infoUrl 引用尚未赋值的 window.decadeUIPath → "undefinedinfo.json" → 初始化失败
// 修复后：目录锚点定位 info.json → 读取 name → 注入 decadeUIName/decadeUIPath
const stub = await import("./fixtures/noname-stub.mjs");
const jsonCalls = [];
stub.lib.assetURL = "http://game/assets/";
stub.lib.config = {};
stub.lib.init = {
	promises: {
		json: async url => {
			jsonCalls.push(url);
			return { name: "十周年UI-Stars", version: "1.4.2" };
		},
	},
};
const freshWindow = {};
globalThis.window = freshWindow;

const extension = await import("../extension.js");
const info = await extension.default();

assert.deepEqual(jsonCalls, ["http://game/assets/extension/十周年UI-Stars/info.json"], "首次初始化必须用目录锚点读取 info.json（不得引用未定义的 decadeUIPath）");
assert.equal(freshWindow.decadeUIName, "十周年UI-Stars", "首次初始化设置 decadeUIName");
assert.equal(freshWindow.decadeUIPath, "http://game/assets/extension/十周年UI-Stars/", "首次初始化设置 decadeUIPath");
assert.equal(info.name, "十周年UI-Stars");
assert.equal(typeof info.content, "function");
assert.equal(typeof info.precontent, "function");

console.log("P2 smoke tests: all passed ✓");
// 导入 extension.js 全量依赖图会留下存活的事件循环句柄，冒烟测试显式退出
process.exit(0);
