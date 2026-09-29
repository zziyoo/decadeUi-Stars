/**
 * P14 · §51「游戏模式」：UI 插件装载的模式闸门。
 *
 * 为什么单独测它：这段判断原来直接写在 `content.js` 的 `loadUIPlugins()` 里，
 * 而 content.js 一 import 就会拉起整条 DOM/本体依赖链，Node 里根本测不到 ——
 * 于是我在矩阵里把它标成了「已做」却拿不出用例。挪成纯函数才是真的可测。
 */
import assert from "node:assert/strict";

const { UI_PLUGIN_EXCLUDED_MODES, shouldLoadUIPlugins } = await import("../src/core/uiMode.js");

// 自走棋 / 塔防 / 炉石：这些模式有自己的界面，十周年的按钮与面板进去只会挡路
for (const mode of ["chess", "tafang", "hs_hearthstone"]) {
	assert.equal(shouldLoadUIPlugins(mode), false, `${mode} 模式不该装载 UI 插件`);
}
assert.deepEqual([...UI_PLUGIN_EXCLUDED_MODES].sort(), ["chess", "hs_hearthstone", "tafang"]);

// 常规模式必须装载：漏判比误判更糟（整个 UI 直接消失）
for (const mode of ["identity", "guozhan", "doudizhu", "versus", "connect"]) {
	assert.equal(shouldLoadUIPlugins(mode), true, `${mode} 模式应正常装载 UI 插件`);
}

// 读不到模式时保持装载（与原实现 `excludedModes.includes(undefined)` 为假同义）
assert.equal(shouldLoadUIPlugins(undefined), true, "模式取不到时不得静默关掉整个 UI");
assert.equal(shouldLoadUIPlugins(null), true);
assert.equal(shouldLoadUIPlugins(""), true);

// 接线处必须真的用这个闸门，而不是又写一份内联名单（判据只此一处）
{
	const fs = await import("node:fs");
	const src = fs.readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
	assert.match(src, /if \(!shouldLoadUIPlugins\(get\.mode\(\)\)\) return;/, "content.js 必须改用同一个纯函数");
	assert.equal(src.includes('const excludedModes = ["chess"'), false, "content.js 里不许再留第二份排除名单");
}

console.log("p14-ui-mode: OK");
