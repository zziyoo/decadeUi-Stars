/**
 * @fileoverview Style Runtime（P1基础设施，任务书§13/§14/§15）
 * 样式映射的【唯一数据源】：src/core/decadeModule.js 与 ui/constants.js 均由此取值。
 * P1范围：只接管映射与查询，不接管CSS/JS实际加载（仍由 decadeModule 负责，P2起收口）。
 * 不依赖 noname 运行时（配置访问通过依赖注入），可在 Node 中独立测试。
 */

/** 配置键 newDecadeStyle 的全部合法取值（顺序即 playerN.css 序号顺序，见任务书§9与P0审计§1.4） */
export const STYLE_CONFIG_VALUES = ["on", "off", "othersOff", "onlineUI", "babysha", "codename"];

/** 默认样式配置值 */
export const DEFAULT_STYLE_VALUE = "on";

/** 配置值 → 皮肤模块名（唯一权威映射；ui/constants.js 由此re-export保持兼容） */
export const STYLE_TO_SKIN = {
	on: "shizhounian",
	off: "shousha",
	othersOff: "xinsha",
	onlineUI: "online",
	babysha: "baby",
	codename: "codename",
};

/** 配置值 → 模块ID（任务书§7模块ID命名规范） */
export const STYLE_TO_MODULE = {
	on: "decade",
	off: "mobile",
	othersOff: "yjcm",
	onlineUI: "online",
	babysha: "baby",
	codename: "codename",
};

/** 默认皮肤 */
export const DEFAULT_SKIN = "shizhounian";

// ---------------- 模块级便捷函数（游戏运行时专用；不依赖实例化） ----------------
// 依赖 window.lib / window.decadeUIName（分别由本体与 extension.js 注入，均先于本扩展代码执行）。
// 设为模块级而非实例方法的原因：38处历史读取点分布在 src/ui 等无法取得实例引用的层，
// 以一行 import + 一行调用完成收口（任务书§14"分阶段迁移"第一步：先收口配置键，再逐步换成语义API）。

/**
 * 样式配置键：extension_{扩展名}_newDecadeStyle
 * 扩展名运行时取自 window.decadeUIName（extension.js 从 info.json 注入），
 * 全代码库中 newDecadeStyle 配置键只允许在此处拼接。
 * @returns {string}
 */
export function getStyleConfigKey() {
	const name = (typeof window !== "undefined" && window.decadeUIName) || "十周年UI-Stars";
	return `extension_${name}_newDecadeStyle`;
}

/**
 * 原始读取样式配置值：与直接读 lib.config[getStyleConfigKey()] 完全等价，
 * 不做合法性校验、不做默认值归一化（保证历史调用点语义零变化）。
 * @returns {*} 配置原始值；未设置或运行环境不可用时为 undefined
 */
export function readRawStyleValue() {
	const config = typeof window !== "undefined" && window.lib ? window.lib.config : undefined;
	return config ? config[getStyleConfigKey()] : undefined;
}

/**
 * 第三方插件入口文件名（app.loadPlugins 的 main1/2/3.js 约定——存量兼容API，约定本身不可更改）。
 * 原映射写死于 src/core/app.js，P2 迁出 Core：on→main1.js、othersOff→main3.js、其余→main2.js。
 * @returns {string}
 */
export function getExternalPluginFileName() {
	const value = readRawStyleValue();
	if (value === "on") return "main1.js";
	if (value === "othersOff") return "main3.js";
	return "main2.js";
}

/**
 * 创建 StyleRuntime 实例
 * @param {Object} deps
 * @param {Object} deps.moduleManager - 模块管理器
 * @param {Object} [deps.resourceLoader] - 资源加载器（getAsset需要）
 * @param {(key: string) => *} deps.getConfig - 读取配置（lib.config[key]）
 * @param {(key: string, value: *) => void} [deps.setConfig] - 写配置（game.saveConfig）
 * @param {() => string} [deps.getConfigKey] - 样式配置键生成（默认 extension_{扩展名}_newDecadeStyle）
 * @returns {Object} styleRuntime
 */
export function createStyleRuntime({ moduleManager, resourceLoader, getConfig, setConfig, getConfigKey } = {}) {
	if (!moduleManager) throw new Error("[StyleRuntime] 缺少 moduleManager");
	if (typeof getConfig !== "function") throw new Error("[StyleRuntime] 缺少 getConfig");

	const styleKey = () => {
		if (typeof getConfigKey === "function") return getConfigKey();
		const name = typeof window !== "undefined" && window.decadeUIName ? window.decadeUIName : "十周年UI-Stars";
		return `extension_${name}_newDecadeStyle`;
	};

	const styleRuntime = {
		/** 当前样式配置值（"on"/"off"/...；非法值回退默认） */
		getConfigValue() {
			const value = getConfig(styleKey());
			return STYLE_CONFIG_VALUES.includes(value) ? value : DEFAULT_STYLE_VALUE;
		},

		/** 原始配置值（不归一化；与模块级 readRawStyleValue() 等价，实例内走注入的 getConfig，Node 可测） */
		getRawConfigValue() {
			return getConfig(styleKey());
		},

		/** 当前样式信息 {value, id, skin} */
		getCurrent() {
			const value = this.getConfigValue();
			return { value, id: STYLE_TO_MODULE[value], skin: STYLE_TO_SKIN[value] };
		},

		/** 任务书§14目标形态：decadeUI.style.id */
		get id() {
			return this.getCurrent().id;
		},

		/** 当前皮肤模块名 */
		get skin() {
			return this.getCurrent().skin;
		},

		/** 模块是否已安装（P1：内置模块恒可用） */
		isInstalled(id) {
			if (id === "core") return true;
			return Object.values(STYLE_TO_MODULE).includes(id) && moduleManager.isInstalled(id);
		},

		/** 确保已安装（P1内置恒真；P5起触发下载） */
		async ensureInstalled(id) {
			return this.isInstalled(id);
		},

		/**
		 * 加载样式（P1：实际加载仍由 decadeModule 执行，此处仅校验并声明加载方）
		 * @returns {Promise<{ok: boolean, loader?: string, reason?: string}>}
		 */
		async load(id) {
			if (!this.isInstalled(id)) return { ok: false, reason: "not-installed" };
			return { ok: true, loader: "decadeModule" };
		},

		/**
		 * 切换样式：仅写配置并提示需要重启（任务书§16：保存设置→game.reload()→新模块初始化）
		 * @param {string} id - 样式模块ID（decade/mobile/yjcm/online/baby/codename）
		 * @returns {{ok: boolean, reloadRequired?: boolean, reason?: string}}
		 */
		activate(id) {
			const value = Object.keys(STYLE_TO_MODULE).find(key => STYLE_TO_MODULE[key] === id);
			if (!value) return { ok: false, reason: "unknown-style" };
			if (typeof setConfig !== "function") return { ok: false, reason: "read-only" };
			setConfig(styleKey(), value);
			return { ok: true, reloadRequired: true };
		},

		/** 获取样式manifest（委托moduleManager） */
		getManifest(id) {
			return moduleManager.getManifest(id);
		},

		/** 列出全部样式模块 */
		listStyles() {
			return moduleManager.list({ type: "style" });
		},

		/** 指定样式是否声明某能力（任务书§15） */
		getCapability(id, name) {
			const manifest = moduleManager.getManifest(id);
			return manifest ? manifest.capabilities.includes(name) : false;
		},

		/** 当前样式是否具备某能力（任务书§14目标形态：decadeUI.style.hasCapability） */
		hasCapability(name) {
			return this.getCapability(this.getCurrent().id, name);
		},

		/** 解析模块资源URL（委托resourceLoader） */
		getAsset(id, path) {
			if (!resourceLoader) throw new Error("[StyleRuntime] 未接入 resourceLoader");
			return resourceLoader.getAsset(id, path);
		},
	};
	return styleRuntime;
}
