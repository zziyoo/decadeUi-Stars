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
import { createNonameIo, createZipExtractor } from "./moduleIo.js";
import { createFeatureRuntime, BUILT_IN_FEATURES } from "./featureRuntime.js";
import { normalizeManifest } from "./manifest.js";

/** @type {Object|null} 模块系统单例 */
let instance = null;
/** @type {Object|null} Feature 运行时；晚绑定给 moduleManager 的启停钩子用 */
let featureRuntime = null;

/**
 * 获取模块系统单例（首次调用时装配）
 * @returns {{registry: Object, moduleManager: Object, styleRuntime: Object, resourceLoader: Object, packageInstaller: Object, featureRuntime: Object}}
 */
export function getModuleSystem() {
	if (instance) return instance;

	const registry = createModuleRegistry();
	registerBuiltInModules(registry, {
		version: lib.extensionPack?.[decadeUIName]?.version || "0.0.0",
	});

	const moduleManager = createModuleManager({
		registry,
		// P8：接上 P1 起悬空的启停钩子。Feature 的开关就是它声明的配置键（不另立状态源）；
		// 未声明为 Feature 的 id 恒真，不会误伤 core/style。runtime 晚绑定以免构造期互相引用。
		isModuleEnabled: id => (featureRuntime ? featureRuntime.switchOn(id) : true),
	});
	// P3：resourceLoader 经 moduleManager.getInstallState 查询模块安装状态，
	// 内置模块回落扩展根（单体兼容），独立安装模块解析 modules/<id>/<version>/
	const resourceLoader = createResourceLoader({ moduleManager });
	featureRuntime = createFeatureRuntime({
		moduleManager,
		resourceLoader,
		configKey: key => `extension_${decadeUIName}_${key}`,
		readConfig: key => lib.config[key],
	});
	for (const definition of BUILT_IN_FEATURES) {
		const declared = featureRuntime.define(definition);
		if (!declared.ok) console.warn(`[十周年UI-Stars] Feature 声明被拒绝: ${definition.id}`, declared.errors);
	}
	const styleRuntime = createStyleRuntime({
		moduleManager,
		resourceLoader,
		getConfig: key => lib.config[key],
		setConfig: (key, value) => game.saveConfig(key, value),
	});
	const packageInstaller = createPackageInstaller({
		registry,
		moduleManager,
		// P5 端口落地：文件系统与 ZIP 解压全部复用本体既有能力（见 moduleIo.js）
		io: createNonameIo(),
		extractZip: createZipExtractor(),
		getCoreVersion: () => lib.extensionPack?.[decadeUIName]?.version || null,
		// 任务书§19：卸载前置检查——当前使用中的样式与 Core 不允许被卸走
		isInUse: id => id === "core" || styleRuntime.id === id,
	});

	instance = { registry, moduleManager, styleRuntime, resourceLoader, packageInstaller, featureRuntime };
	return instance;
}

/**
 * 探测并注册已安装的独立样式包（P3）
 *
 * 读取 modules/installed.json 清单，对每个条目探测其 manifest.json 并以
 * meta.source="installed" 注册（同版本覆盖内置注册）→ getModuleBase 解析至
 * modules/<id>/<version>/。清单或清单文件缺失（404）时静默跳过，
 * 全部回落单体目录（P2 兼容）。
 *
 * @returns {Promise<void>}
 */
export async function registerInstalledModules() {
	const { moduleManager } = getModuleSystem();
	const base = (typeof window !== "undefined" && window.decadeUIPath) || "";
	let installed;
	try {
		const res = await fetch(`${base}modules/installed.json`);
		if (!res.ok) return;
		installed = await res.json();
	} catch {
		return;
	}
	const entries = installed?.modules || {};
	for (const [id, info] of Object.entries(entries)) {
		try {
			const res = await fetch(`${base}modules/${id}/${info.version}/manifest.json`);
			if (!res.ok) {
				console.warn(`[十周年UI-Stars] 已安装模块的清单缺失，回退单体目录: modules/${id}/${info.version}`);
				continue;
			}
			const result = moduleManager.register(normalizeManifest(await res.json()), { source: "installed" });
			if (!result.ok) {
				console.warn(`[十周年UI-Stars] 模块清单校验失败: ${id}`, result.errors);
			}
		} catch (e) {
			console.warn(`[十周年UI-Stars] 注册模块失败: ${id}`, e);
		}
	}
}
