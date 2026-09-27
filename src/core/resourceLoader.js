/**
 * @fileoverview 资源加载器（P2：模块资源路径正式抽象，任务书§12/§35）
 *
 * 访问边界（P2确立）：
 *   业务代码 → ResourceLoader / StyleRuntime.getAsset → getModuleBase(moduleId) → 模块资源根
 * 业务代码不得直接拼接 decadeUIPath 访问模块资源（window.decadeUIPath 仅作为第三方兼容接口保留）。
 *
 * getModuleBase(moduleId) 是 P3 唯一需要修改的层：
 *   P2（单体目录兼容阶段）：core/decade/mobile/online/yjcm/baby/codename 及未登记ID
 *   一律解析到当前扩展根目录，保证所有资源仍从现有单体目录加载；
 *   P3：按 manifest 切换为 modules/<id>/<version>/，业务代码无需再改。
 *
 * JS/CSS 加载复用 src/core/loader.js 的版本缓存与去重机制，不建立第二套 script/link 机制。
 */
import { createScriptElement, createLinkElement } from "./loader.js";

/**
 * 创建资源加载器
 * @param {Object} [deps]
 * @param {() => string} [deps.getBasePath] - 扩展根路径（默认 window.decadeUIPath）
 * @param {(moduleId: string) => string} [deps.getModuleBase] - 模块根解析覆盖（P2默认全映射扩展根；测试与P3注入点）
 * @returns {Object} resourceLoader
 */
export function createResourceLoader({ getBasePath, getModuleBase: getModuleBaseOverride } = {}) {
	const base = () => {
		if (typeof getBasePath === "function") return getBasePath();
		return (typeof window !== "undefined" && window.decadeUIPath) || "";
	};

	/**
	 * 模块根路径解析
	 * @param {string} moduleId - 模块ID（core/decade/mobile/online/yjcm/baby/codename/...）
	 * @returns {string} 模块资源根目录（以 / 结尾）
	 */
	const getModuleBase = moduleId => {
		if (typeof getModuleBaseOverride === "function") return getModuleBaseOverride(moduleId);
		// P2单体目录：所有模块同根（P3在此按模块 manifest 切换）
		return base();
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
