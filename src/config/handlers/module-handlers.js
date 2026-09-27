/**
 * @fileoverview 模块管理相关配置处理函数
 * @description 处理模块源地址等模块管理配置项的保存回写
 * @module config/handlers/module-handlers
 */
import { game } from "noname";

/**
 * 模块源地址保存（本体扩展菜单的 contentEditable 与配置窗口的 input 两种载体都要兼容）
 * 键与 src/features/moduleManagerWindow.js 的 indexKey() 一致：extension_<扩展名>_moduleIndexUrl
 */
export function onModuleIndexUrlBlur() {
	const isInput = this.tagName === "INPUT";
	const raw = isInput ? this.value : this.innerHTML;
	const value = String(raw ?? "")
		.replace(/<br>/g, "")
		.trim();
	if (isInput) this.value = value;
	else this.innerHTML = value;
	game.saveConfig(`extension_${decadeUIName}_moduleIndexUrl`, value);
}
