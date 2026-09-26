/**
 * @fileoverview 资源加载器（P1基础设施，任务书§12/§35）
 * 统一模块资源路径解析与 JS/CSS/图片/音频 加载入口。
 * P1：单体目录——所有模块共享扩展根路径（getAsset 的 moduleId 参数暂不参与寻址）；
 * P3/P4 起按模块根目录（modules/<id>/<version>/）解析。
 * JS/CSS 复用 loader.js 的版本参数缓存与去重机制（禁止任务书§56禁止2的重复造轮子）。
 */
import { createScriptElement, createLinkElement } from "./loader.js";

/**
 * 创建资源加载器
 * @param {Object} [deps]
 * @param {() => string} [deps.getBasePath] - 扩展根路径（默认 window.decadeUIPath）
 * @returns {Object} resourceLoader
 */
export function createResourceLoader({ getBasePath } = {}) {
	const base = () => {
		if (typeof getBasePath === "function") return getBasePath();
		return (typeof window !== "undefined" && window.decadeUIPath) || "";
	};

	return {
		/**
		 * 解析模块内相对资源的完整URL
		 * @param {string} _moduleId - 模块ID（P1单体目录暂不参与寻址，P3/P4启用）
		 * @param {string} path - 扩展根目录下的相对路径（如 "ui/assets/lbtn/uibutton/back.png"）
		 * @returns {string} 完整URL
		 */
		getAsset(_moduleId, path) {
			if (typeof path !== "string" || !path) throw new Error("[ResourceLoader] getAsset 缺少 path");
			return `${base()}${path}`;
		},

		/** 加载JS脚本（同步Promise/异步fire-and-forget由isAsync决定） */
		loadJS(path, isAsync = false) {
			return createScriptElement(this.getAsset(null, path), isAsync);
		},

		/** 加载CSS样式表（带去重） */
		loadCSS(path) {
			return createLinkElement(this.getAsset(null, path));
		},

		/** 加载图片，Promise<HTMLImageElement> */
		loadImage(path) {
			return new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error(`[ResourceLoader] 图片加载失败: ${path}`));
				img.src = this.getAsset(null, path);
			});
		},

		/** 创建音频元素（不自动播放） */
		loadAudio(path) {
			return new Audio(this.getAsset(null, path));
		},
	};
}
