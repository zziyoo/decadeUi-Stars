/**
 * @fileoverview P14 · UI 插件装载的模式闸门（任务书§51「游戏模式」）
 *
 * 纯逻辑，单独成模块只为了一件事：**可测**。这段判断原来内联在
 * `content.js` 的 `loadUIPlugins()` 里，而 content.js 一 import 就拉起整条
 * DOM/本体依赖链，Node 侧够不着 —— 于是§51 的这一条长期"声称已做、无用例"。
 *
 * 语义与原实现保持一致（不做任何行为变更）：名单内的游戏模式有自己的界面，
 * 十周年的按钮/技能/武将面板进去只会挡路；取不到模式时**保持装载**，
 * 因为漏判的代价是整个 UI 消失，比误判更糟。
 */

/** 不装载 UI 插件的游戏模式：自走棋、塔防、炉石类 */
export const UI_PLUGIN_EXCLUDED_MODES = ["chess", "tafang", "hs_hearthstone"];

/**
 * @param {string|undefined|null} mode - `get.mode()` 的结果
 * @returns {boolean} true = 应装载 UI 插件
 */
export function shouldLoadUIPlugins(mode) {
	return !UI_PLUGIN_EXCLUDED_MODES.includes(mode);
}
