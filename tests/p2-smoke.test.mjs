/**
 * P2 公共依赖改造冒烟测试（任务书§37-§38）
 * 运行方式：node tests/p2-smoke.test.mjs
 * 覆盖：styleRuntime 模块级helper（样式配置键收口、原始读取语义、main1/2/3.js映射）
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

console.log("P2 smoke tests: all passed ✓");
