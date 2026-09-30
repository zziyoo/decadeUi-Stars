/**
 * P15 · boot 期样式读数不得依赖 window.lib（真机查出的功能缺陷）
 *
 * 真机证据（2026-09-30，用户探针）：切到一将成名后
 *   document.body.dataset.style === "on"        ← decadeModule.init() 在 precontent 读到的
 *   ui.arena.dataset.newDecadeStyle === "othersOff"  ← 同一份配置，晚一点读到的
 * 而 link[href] 里加载的是 modules/decade/1.4.2/*.css ⇒ **六套全部渲染成十周年套**。
 *
 * 根因：styleRuntime.readRawStyleValue() 走的是 window.lib，而本体只在开发者模式被打开时
 * 才把 lib 挂到 window（noname/library/index.js:1513 的 lib.cheat.i()，以及 setLibrary 里
 * `if (lib.config.dev) window.lib = lib`）。precontent 阶段 window.lib 还不存在 ⇒
 * 读数 undefined ⇒ 回落默认 "on"。原版十周年UI 用的是 import 进来的 lib 绑定
 * （十周年UI/src/core/decadeModule.js:95 getConfigValue），所以同样的时机能读对 —— 这是
 * "参照实现"给出的差异，不是时机问题。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.decadeUIName = "十周年UI-Stars";
// 刻意不定义 globalThis.window：这就是 precontent 阶段的真实环境

const { readRawStyleValue, bindStyleConfigReader, STYLE_TO_MODULE } = await import("../src/core/styleRuntime.js");

// ── 1. 复现旧缺陷：没有 window.lib 时读数就是 undefined（于是 init 回落 "on"） ──
assert.equal(readRawStyleValue(), undefined, "未绑定取值器且无 window.lib ⇒ 读不到（这正是缺陷现场）");

// ── 2. 绑定 import 的 lib 之后，同一个调用点必须读到玩家配置的值 ────────────────
const bootConfig = { "extension_十周年UI-Stars_newDecadeStyle": "othersOff" };
bindStyleConfigReader(key => bootConfig[key]);
assert.equal(readRawStyleValue(), "othersOff", "绑定后必须读得到玩家设置的样式");
assert.equal(STYLE_TO_MODULE[readRawStyleValue()], "yjcm", "读数正确才会选对样式包");

// ── 3. 取值器优先，window.lib 只作兜底（两条路径都在时以注入的为准） ─────────────
globalThis.window = { lib: { config: { "extension_十周年UI-Stars_newDecadeStyle": "babysha" } } };
assert.equal(readRawStyleValue(), "othersOff", "绑定过就不许再被 window.lib 覆盖");
// 取值器读不到该键时回落 window.lib（保持既有调用点在晚阶段的语义不变）
bindStyleConfigReader(key => (key === "别的键" ? "x" : undefined));
assert.equal(readRawStyleValue(), "babysha", "注入源没有值时仍要回落到 window.lib");
// 解绑后回到纯 window.lib 行为
bindStyleConfigReader(null);
assert.equal(readRawStyleValue(), "babysha");

// ── 4. 静态不变量：precontent 必须在 initDecadeModule 之前绑定，否则等于没修 ─────
{
	const src = fs.readFileSync(new URL("../src/precontent.js", import.meta.url), "utf8");
	const bindAt = src.indexOf("bindStyleConfigReader(");
	const initAt = src.indexOf("initDecadeModule()");
	assert.ok(bindAt >= 0, "precontent 必须绑定样式读数源（找不到 bindStyleConfigReader 调用）");
	assert.ok(initAt >= 0, "precontent 仍应初始化 decadeModule");
	assert.ok(bindAt < initAt, "绑定必须发生在 initDecadeModule() 之前 —— 晚了 CSS 已经按错的样式加载完");
	assert.match(src, /bindStyleConfigReader\(\s*key\s*=>\s*lib\.config\[key\]\s*\)/, "绑定的必须是 import 进来的 lib.config（不是 window.lib 的快照）");
}

console.log("p15-boot-style-reader: OK（boot 期样式读数不再依赖 window.lib）");
