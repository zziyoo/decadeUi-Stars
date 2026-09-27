/**
 * @fileoverview 资源加载器（P3：模块根路径解析正式接入 ModuleManager/Manifest）
 *
 * 访问边界：
 *   业务代码 → resourceLoader.getAsset(moduleId, path)
 *            → getModuleBase(moduleId) —— 经 ModuleManager 查询模块安装状态
 *            → 模块资源根 + path
 *
 * getModuleBase 解析规则（通用，不针对任何具体模块，任务书§8安装目录标准）：
 *   1. 经 ModuleManager.getInstallState(moduleId) 查询安装状态与版本
 *      （版本仅取自 Manifest，不设第二版本源）；
 *   2. 模块已独立安装（meta.source="installed"，由 PackageInstaller 注册）：
 *      - core                → <扩展根>/core/
 *      - style/feature/shared → <扩展根>/modules/<id>/<manifest.version>/
 *   3. 未独立安装（内置模块/未知 moduleId）→ 当前扩展根（P2 单体目录兼容，
 *      绝不拼出 modules/undefined/... 之类的路径）。
 *
 * 返回值一律以 / 结尾（规范化），保证 `${getModuleBase(id)}${path}` 拼接稳定。
 *
 * JS/CSS 加载复用 src/core/loader.js 的版本缓存与去重机制，不建立第二套
 * script/link 机制。
 */
import { createScriptElement, createLinkElement } from "./loader.js";

/** 目录路径规范化：确保以 / 结尾 */
const toDir = path => (path.endsWith("/") ? path : `${path}/`);

/**
 * 创建资源加载器
 * @param {Object} [deps]
 * @param {() => string} [deps.getBasePath] - 扩展根路径（默认 window.decadeUIPath）
 * @param {Object} [deps.moduleManager] - 模块管理器（getInstallState 数据源；缺省时全部回落扩展根）
 * @param {(moduleId: string) => string} [deps.getModuleBase] - 模块根解析覆盖（测试/P3切换实验注入点）
 * @returns {Object} resourceLoader
 */
export function createResourceLoader({ getBasePath, moduleManager, getModuleBase: getModuleBaseOverride } = {}) {
	const base = () => {
		if (typeof getBasePath === "function") return getBasePath();
		return (typeof window !== "undefined" && window.decadeUIPath) || "";
	};

	/**
	 * 模块根路径解析（P3正式实现）
	 * @param {string} moduleId - 模块ID（core/decade/mobile/online/yjcm/baby/codename/...）
	 * @returns {string} 模块资源根目录（以 / 结尾）
	 */
	const resolveModuleBase = moduleId => {
		const root = toDir(base());
		if (moduleManager && typeof moduleId === "string" && moduleId) {
			const state = moduleManager.getInstallState(moduleId);
			if (state && state.independent && state.version) {
				// core 的独立安装根为 core/（任务书§60），其余模块为 modules/<id>/<version>/
				return toDir(state.type === "core" ? `${root}core/` : `${root}modules/${moduleId}/${state.version}/`);
			}
		}
		// 兼容阶段 / 内置模块 / 未知模块：回落扩展根
		return root;
	};

	const getModuleBase = moduleId => {
		if (typeof getModuleBaseOverride === "function") return toDir(getModuleBaseOverride(moduleId));
		return resolveModuleBase(moduleId);
	};

	return {
		getModuleBase,

		/**
		 * 解析模块内相对资源的完整URL
		 * @param {string} moduleId - 模块ID（模块寻址正式参数，禁止省略）
		 * @param {string} path - 模块根目录下的相对路径（如 "image/styles/decade/xxx.png"）
		 * @returns {string} 完整URL
		 */
		getAsset(moduleId, path) {
			if (typeof moduleId !== "string" || !moduleId) {
				throw new Error("[ResourceLoader] getAsset 缺少 moduleId（模块寻址正式参数）");
			}
			if (typeof path !== "string" || !path) {
				throw new Error("[ResourceLoader] getAsset 缺少 path");
			}
			return `${getModuleBase(moduleId)}${path}`;
		},

		/** 加载模块JS脚本（复用loader.js版本缓存与去重；isAsync=true时fire-and-forget） */
		loadJS(moduleId, path, isAsync = false) {
			return createScriptElement(this.getAsset(moduleId, path), isAsync);
		},

		/** 加载模块CSS（复用loader.js去重） */
		loadCSS(moduleId, path) {
			return createLinkElement(this.getAsset(moduleId, path));
		},

		/** 加载模块图片，Promise<HTMLImageElement> */
		loadImage(moduleId, path) {
			return new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error(`[ResourceLoader] 图片加载失败: ${path}`));
				img.src = this.getAsset(moduleId, path);
			});
		},

		/** 创建模块音频元素（不自动播放） */
		loadAudio(moduleId, path) {
			return new Audio(this.getAsset(moduleId, path));
		},
	};
}
