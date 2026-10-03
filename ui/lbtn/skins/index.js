/**
 * @fileoverview 左侧按钮样式管理器 - 动态加载样式模块
 */
import { readRawStyleValue, STYLE_TO_MODULE, DEFAULT_STYLE_VALUE } from "./../../../src/core/styleRuntime.js";
import { getModuleSystem } from "./../../../src/core/moduleSystem.js";
import { lib, game, ui, get, ai, _status } from "noname";
import { STYLE_TO_SKIN, DEFAULT_SKIN } from "../../constants.js";

/**
 * 获取当前样式名
 * @returns {string}
 */
export function getCurrentSkin() {
	return STYLE_TO_SKIN[readRawStyleValue()] || DEFAULT_SKIN;
}

/**
 * 动态加载lbtn插件
 * P3-2路由：已安装独立样式包 → 从包根加载皮肤模块；未安装 → 单体路径。
 * 已拆分但未安装（包被移除）时单体副本已删除，加载失败被捕获 → 皮肤不可用而 Core 正常。
 * @param {string} skinName - 样式名
 * @param {*} lib
 * @param {*} game
 * @param {*} ui
 * @param {*} get
 * @param {*} ai
 * @param {*} _status
 * @param {*} app
 * @returns {Promise<Object|null>}
 */
export async function createLbtnPluginForSkin(skinName, lib, game, ui, get, ai, _status, app) {
	try {
		const styleId = STYLE_TO_MODULE[readRawStyleValue() ?? DEFAULT_STYLE_VALUE] || "decade";
		const { moduleManager, resourceLoader } = getModuleSystem();
		const specifier = moduleManager.getInstallState(styleId).independent
			? resourceLoader.getModuleUrl(styleId, `ui/lbtn/skins/${skinName}.js`)
			: `./${skinName}.js`;
		const module = await import(/* @vite-ignore */ specifier);
		const creator = module[`create${skinName.charAt(0).toUpperCase() + skinName.slice(1)}LbtnPlugin`];
		return creator?.(lib, game, ui, get, ai, _status, app) ?? null;
	} catch (e) {
		console.error(`[LbtnSkin] 加载失败: ${skinName}`, e);
		return null;
	}
}
