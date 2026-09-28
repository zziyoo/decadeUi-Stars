/**
 * P8 Feature 门控接线测试（任务书§45/§16）
 * 运行：node --import ./tests/helpers/register.mjs tests/p8-effects-gate.test.mjs
 *
 * 这里测的是"接线"：featureRuntime 的判定要真的决定 setupEffects 注册什么、加载哪份 CSS。
 * 纯判定矩阵在 tests/p8-feature-runtime.test.mjs；CSS 注入用 resourceLoader.loadCSS 替身观察，
 * 避免依赖真实 DOM。
 */
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.decadeUIName = "十周年UI-Stars";

const { lib } = await import("noname");
lib.config = {};

const { setupEffects } = await import("../src/effects/index.js");
const { getModuleSystem } = await import("../src/core/moduleSystem.js");
const { featureRuntime, resourceLoader } = getModuleSystem();

const loaded = [];
resourceLoader.loadCSS = (moduleId, path) => {
	loaded.push(`${moduleId}:${path}`);
};

// 默认（开关未播种 → 回落 defaultEnabled:true）：击杀/技能特效注册，特效 CSS 由 Feature 自己加载
globalThis.decadeUI = { dialog: { create: () => ({}) } };
setupEffects();
assert.equal(featureRuntime.active("kill-effect"), true, "默认配置下 kill-effect 应当装载");
assert.equal(typeof globalThis.decadeUI.effect.kill, "function");
assert.equal(typeof globalThis.decadeUI.effect.skill, "function");
assert.deepEqual(loaded, ["kill-effect:src/styles/effect.css"], "特效 CSS 必须由 Feature 按需加载（Core 的 layout.css 已不再 @import）");

// 禁用：击杀/技能特效整体不装载、CSS 不加载；"幻影出牌"有独立开关，必须保持可用
lib.config["extension_十周年UI-Stars_killEffect"] = false;
globalThis.decadeUI = { dialog: { create: () => ({}) } };
loaded.length = 0;
setupEffects();
assert.equal(featureRuntime.active("kill-effect"), false);
assert.equal(globalThis.decadeUI.effect.kill, undefined, "禁用后不得注册击杀特效");
assert.equal(globalThis.decadeUI.effect.skill, undefined, "禁用后不得注册技能特效");
assert.equal(typeof globalThis.decadeUI.effect.ghost?.setEnabled, "function", "cardGhost 有自己的开关，不随本 Feature 关停");
assert.deepEqual(loaded, [], "禁用后不得加载特效 CSS");

// 重新开启：装载恢复，且 CSS 路径仍走 Feature 寻址（拆包后会指向 modules/kill-effect/…）
lib.config["extension_十周年UI-Stars_killEffect"] = true;
globalThis.decadeUI = { dialog: { create: () => ({}) } };
loaded.length = 0;
setupEffects();
assert.equal(typeof globalThis.decadeUI.effect.kill, "function", "重新开启后要能恢复装载");
assert.deepEqual(loaded, ["kill-effect:src/styles/effect.css"]);

console.log("P8 effects-gate tests: all passed ✓");
