/**
 * @fileoverview P1模块系统装配入口（任务书§35）
 * 进程内单例：precontent 阶段首次创建；content 阶段挂载到 decadeUI 公开API（任务书§57）：
 *   decadeUI.modules / decadeUI.moduleManager / decadeUI.resource / decadeUI.style
 */
import { lib, game } from "noname";
import { createModuleRegistry } from "./registry.js";
import { registerBuiltInModules } from "./builtInModules.js";
import { createModuleManager } from "./moduleManager.js";
import { createStyleRuntime } from "./styleRuntime.js";
import { createResourceLoader } from "./resourceLoader.js";
import { createPackageInstaller } from "./packageInstaller.js";

/** @type {Object|null} 模块系统单例 */
let instance = null;

/**
 * 获取模块系统单例（首次调用时装配）
 * @returns {{registry: Object, moduleManager: Object, styleRuntime: Object, resourceLoader: Object, packageInstaller: Object}}
 */
export function getModuleSystem() {
	if (instance) return instance;

	const registry = createModuleRegistry();
	registerBuiltInModules(registry, {
		version: lib.extensionPack?.[decadeUIName]?.version || "0.0.0",
	});

	const moduleManager = createModuleManager({ registry });
	const resourceLoader = createResourceLoader();
	const styleRuntime = createStyleRuntime({
		moduleManager,
		resourceLoader,
		getConfig: key => lib.config[key],
		setConfig: (key, value) => game.saveConfig(key, value),
	});
	const packageInstaller = createPackageInstaller();

	instance = { registry, moduleManager, styleRuntime, resourceLoader, packageInstaller };
	return instance;
}
