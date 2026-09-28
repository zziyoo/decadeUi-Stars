/**
 * P8 Feature 门控接线测试（任务书§45/§16）
 * 运行：node --import ./tests/helpers/register.mjs tests/p8-effects-gate.test.mjs
 *
 * 这里测的是"接线"：featureRuntime 的判定要真的决定 setupEffects 注册什么。
 * 门控边界以**原版行为**为准（../十周年UI/src/effects/index.js 无条件注册 line/kill/skill/ghost/dialog，
 * killEffect 配置只在 skills/animate.js 的击杀技能 filter 里读），Feature 只许管它真正管辖的那一路。
 * CSS 注入用 resourceLoader.loadCSS 替身观察，避免依赖真实 DOM。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.window = globalThis;
globalThis.decadeUIName = "十周年UI-Stars";

const { lib } = await import("noname");
lib.config = {};

const { setupEffects } = await import("../src/effects/index.js");
const { getModuleSystem } = await import("../src/core/moduleSystem.js");
const { featureRuntime, resourceLoader } = getModuleSystem();

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const loaded = [];
resourceLoader.loadCSS = (moduleId, path) => {
	loaded.push(`${moduleId}:${path}`);
};

// 默认（开关未播种 → 回落 defaultEnabled:true）：三条特效通道全在，与原版一致
globalThis.decadeUI = { dialog: { create: () => ({}) } };
setupEffects();
assert.equal(featureRuntime.active("kill-effect"), true, "默认配置下 kill-effect 应当装载");
assert.equal(typeof globalThis.decadeUI.effect.kill, "function");
assert.equal(typeof globalThis.decadeUI.effect.skill, "function", "技能特效是 Core 行为（原版无开关），默认必须在");
assert.equal(typeof globalThis.decadeUI.effect.line, "function", "划线通道原版就无条件注册（§57 公开面）");
assert.deepEqual(loaded, [], "setupEffects 不该自行加载特效 CSS——它由 layout.css 的 @import 链无条件带入");

// 禁用击杀特效：只有 kill 消失；skill/line/ghost/dialog 必须原样可用
lib.config["extension_十周年UI-Stars_killEffect"] = false;
globalThis.decadeUI = { dialog: { create: () => ({}) } };
loaded.length = 0;
setupEffects();
assert.equal(featureRuntime.active("kill-effect"), false);
assert.equal(globalThis.decadeUI.effect.kill, undefined, "禁用后不得注册击杀特效");
assert.equal(typeof globalThis.decadeUI.effect.skill, "function", "killEffect 只管击杀：技能特效不得被一起关掉（原版无此联动，且 playerSkill 会白等 2.5 秒再什么都不做）");
assert.equal(typeof globalThis.decadeUI.effect.line, "function", "禁用击杀不许顺手撤掉划线通道");
assert.equal(typeof globalThis.decadeUI.effect.ghost?.setEnabled, "function", "cardGhost 有自己的开关 cardGhostEffect，不随本 Feature 关停");
assert.equal(typeof globalThis.decadeUI.effect.dialog?.create, "function", "特效对话框容器始终可用");
assert.deepEqual(loaded, []);

// 重新开启：kill 恢复
lib.config["extension_十周年UI-Stars_killEffect"] = true;
globalThis.decadeUI = { dialog: { create: () => ({}) } };
loaded.length = 0;
setupEffects();
assert.equal(typeof globalThis.decadeUI.effect.kill, "function", "重新开启后要能恢复装载");
assert.equal(typeof globalThis.decadeUI.effect.skill, "function");
assert.deepEqual(loaded, []);

// 门控边界的依据（夹具前提，任一条变了就说明 CSS 归属需要重新设计）
assert.ok(/@import\s+"effect\.css"/.test(read("../src/styles/layout.css")), "effect.css 必须由 layout.css @import：位置在 layout 自身规则之前，与原版级联一致");
assert.ok(read("../src/styles/effect.css").includes(".skill-name"), "夹具前提：effect.css 里有技能特效用的 .skill-name");
assert.ok(read("../src/effects/skill.js").includes('"skill-name"'), "夹具前提：技能特效确实创建 .skill-name 元素");
assert.equal(featureRuntime.cssOf("kill-effect").length, 0, "与 Core 共用样式的门控型 Feature 不在 manifest 登记 entry.css");
assert.deepEqual(featureRuntime.get("kill-effect").capabilities, ["kill-effect"], "能力声明只覆盖击杀那一路");

// 调用点边界（防止有人把击杀开关顺手加到技能特效那一路）
assert.equal(read("../src/overrides/player/animations.js").includes("killEffect"), false, "技能特效调用点不读击杀开关（原版如此）");
assert.equal(read("../src/skills/animate.js").includes('"extension_十周年UI-Stars_killEffect"'), true, "击杀技能 filter 必须继续读这个键（禁用后连 2.5 秒延迟都不该产生）");

console.log("P8 effects-gate tests: all passed ✓");
