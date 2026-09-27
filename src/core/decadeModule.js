/**
 * @fileoverview DecadeModule初始化模块，负责加载样式和资源
 */
import { lib, game, ui, get, ai, _status } from "noname";
import { createScriptElement, createLinkElement } from "./loader.js";
import { prefixMarkModule } from "../ui/prefixMark.js";
import { STYLE_CONFIG_VALUES, STYLE_TO_SKIN, STYLE_TO_MODULE, DEFAULT_SKIN, readRawStyleValue } from "./styleRuntime.js";
import { getModuleSystem } from "./moduleSystem.js";

/** @type {Array<string>} 排除的游戏模式 */
const EXCLUDED_MODES = ["chess", "tafang", "hs_hearthstone"];

/** 已拆分为独立样式包的样式ID（其单体CSS副本已删除，未安装时跳过加载） */
const MIGRATED_STYLE_IDS = new Set(["decade", "mobile"]);

// P1：样式映射唯一数据源已收口至 styleRuntime.js（任务书§13）。
// P2：本模块的JS/CSS加载经 resourceLoader.getAsset(moduleId, path) 寻址——
//     核心资源用 "core"，样式资源用当前样式模块ID（P2阶段均解析到扩展根，P3切换模块根只改 getModuleBase）。

/**
 * 获取配置项值
 * @param {string} key - 配置键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 配置值
 */
function getConfigValue(key, defaultValue) {
	const configKey = `extension_${decadeUIName}_${key}`;
	const value = lib.config[configKey];
	return value !== undefined ? value : defaultValue;
}

/**
 * 初始化decadeModule
 * @returns {Object} 模块对象
 */
export function initDecadeModule() {
	if (!ui.css.layout) return {};
	// 本体游戏资源（layout/long2），不属于扩展模块资源，不经 ResourceLoader
	if (!ui.css.layout.href?.includes("long2")) {
		ui.css.layout.href = `${lib.assetURL}layout/long2/layout.css`;
	}

	const { resourceLoader, moduleManager } = getModuleSystem();

	const module = {
		/**
		 * 加载模块JS文件
		 * @param {string} moduleId - 模块ID（core/decade/mobile/...）
		 * @param {string} path - 模块根下相对路径
		 * @returns {HTMLScriptElement|null} script元素
		 */
		js: (moduleId, path) => path && createScriptElement(resourceLoader.getAsset(moduleId, path), false),
		/**
		 * 异步加载模块JS文件
		 * @param {string} moduleId - 模块ID
		 * @param {string} path - 模块根下相对路径
		 * @returns {HTMLScriptElement|null} script元素
		 */
		jsAsync: (moduleId, path) => path && createScriptElement(resourceLoader.getAsset(moduleId, path), true),
		/**
		 * 加载模块CSS文件
		 * @param {string} moduleId - 模块ID
		 * @param {string} path - 模块根下相对路径
		 * @returns {HTMLLinkElement|null} link元素
		 */
		css: (moduleId, path) => path && createLinkElement(resourceLoader.getAsset(moduleId, path)),
		/** @type {Array<Function>} 模块列表 */
		modules: [],
		/**
		 * 导入模块
		 * @param {Function} mod - 模块函数
		 */
		import(mod) {
			if (typeof mod === "function") this.modules.push(mod);
		},
		prefixMark: prefixMarkModule,
	};

	/**
	 * 初始化模块
	 * @returns {Promise<Object>} this
	 */
	module.init = async function () {
		const CORE = "core";

		const cssFiles = ["src/styles/extension.css", "src/styles/decadeLayout.css", "src/styles/card.css", "src/styles/meihua.css"];
		cssFiles.forEach(path => this.css(CORE, path));

		// 样式配置值经 styleRuntime 收口读取（原始语义不变：undefined 时取默认 "on"）
		const _rawStyle = readRawStyleValue();
		const style = _rawStyle !== undefined ? _rawStyle : "on";
		const styleIndex = STYLE_CONFIG_VALUES.indexOf(style);
		const styleId = STYLE_TO_MODULE[style] || "decade";
		document.body.setAttribute("data-style", style);

		// P3：样式主CSS。已安装独立样式包 → 从包根按 manifest.entry.css 加载（首项为
		// player 主样式）；已拆分但未安装（包被移除）时跳过（样式不可用而 Core 正常，
		// P3/P4验收路径）；其余未拆分样式走单体路径。
		const installState = moduleManager.getInstallState(styleId);
		const packCss = installState.independent ? moduleManager.getManifest(styleId)?.entry?.css || null : null;

		// 共享动画样式（原由各 playerN.css @import 引入，拆包后由 Core 统一加载）
		this.css(CORE, "src/styles/animation.css");

		if (packCss) {
			this.css(styleId, packCss[0]);
		} else if (!MIGRATED_STYLE_IDS.has(styleId)) {
			this.css(CORE, `src/styles/player${styleIndex !== -1 ? styleIndex + 1 : 2}.css`);
		}
		this.css(CORE, "src/styles/equip.css");
		this.css(CORE, "src/styles/layout.css");

		if (getConfigValue("meanPrettify", false)) {
			ui.css.decadeMenu = this.css(CORE, "src/styles/menu.css");
		}

		// 同步等待 spine.js 加载完成
		await this.js(CORE, "src/libs/spine.js");

		const currentMode = get.mode();
		const isPhoneLayout = lib.config.phonelayout;

		if (!EXCLUDED_MODES.includes(currentMode)) {
			const skinName = STYLE_TO_SKIN[style] || DEFAULT_SKIN;

			// 共享基础样式归 Core（字体/基础UI）
			this.css(CORE, "ui/styles/fonts.css");
			this.css(CORE, "ui/styles/base.css");

			if (packCss) {
				// 包内 UI 样式（character/lbtn/skill + window 桌面变体），保持原级联顺序
				for (const p of packCss.slice(1)) {
					if (p.includes("/window/") && isPhoneLayout) continue;
					this.css(styleId, p);
				}
			} else if (!MIGRATED_STYLE_IDS.has(styleId)) {
				this.css(styleId, `ui/styles/character/${skinName}.css`);
				this.css(styleId, `ui/styles/lbtn/${skinName}.css`);
				this.css(styleId, `ui/styles/skill/${skinName}.css`);

				if (!isPhoneLayout) {
					this.css(styleId, `ui/styles/lbtn/window/${skinName}.css`);
					this.css(styleId, `ui/styles/skill/window/${skinName}.css`);
				}
			}
		}

		// 初始化亮将钩子
		this.prefixMark.setupShowCharacterHook();

		return this;
	};

	return module.init();
}

export { EXCLUDED_MODES };
