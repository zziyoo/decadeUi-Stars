/**
 * @fileoverview P8 Feature 运行时（任务书§45/§16）
 *
 * Feature = 有独立开关与独立资源、可选装载的功能块（kill-effect / card-skin / …）。
 * 与样式包的分工：样式包换的是"长什么样"，Feature 决定"这项功能要不要在"。
 *
 * 本轮拆分深度（用户已定）：**JS 仍打进 bundle，资源拆包 + 注册/启停门控**。
 * 所以这里只做三件事：声明 Feature、判定它该不该装载、把它的资源路径解析到正确的模块根
 * （委托 resourceLoader.getAsset → getModuleBase，不建第二套寻址）。
 *
 * 启停不新增状态源：Feature 的开关就是它声明的 switchKey（kill-effect 用既有的 killEffect
 * 配置键），玩家看到的仍是同一个开关；moduleSystem 把 P1 起悬空的 isModuleEnabled 钩子接到
 * switchOn 上，moduleManager.isEnabled 从此真实。
 *
 * 纯逻辑：不 import noname、不碰 DOM，可在 Node 全量测试（tests/p8-feature-runtime.test.mjs）。
 */

/** 内置 Feature 声明（§45 第一刀；其余按批次补，progress-bar 受 precontent 时序限制另议） */
export const BUILT_IN_FEATURES = [
	{
		id: "kill-effect",
		// 只管击杀/技能特效；"幻影出牌"(cardGhost) 有自己的开关 cardGhostEffect，不随本 Feature 关停
		name: "击杀/技能特效",
		capabilities: ["kill-effect", "skill-effect"],
		// 复用既有开关（src/config/definitions/appearance.js 的 killEffect），不另立状态源
		switchKey: "killEffect",
		defaultEnabled: true,
		// 资源是否已拆进 modules/kill-effect/：拆包那一刀翻成 true（与样式侧 STYLES[].pack 同构）。
		// CSS/图片的实际路径只在模块 manifest.entry 里登记一份，runtime 不重复持有。
		pack: false,
	},
];

const asArray = value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : null);

/**
 * 创建 Feature 运行时
 * @param {Object} deps
 * @param {Object} deps.moduleManager - 提供 isInstalled/isEnabled（enabled 钩子回指本 runtime 的 switchOn）
 * @param {Object} deps.resourceLoader - 提供 getAsset(moduleId, path)
 * @param {(key: string) => string} deps.configKey - 配置键拼接（扩展名在调用期解析，P2 规则）
 * @param {(fullKey: string) => any} deps.readConfig - 读配置值
 * @returns {Object} featureRuntime
 */
export function createFeatureRuntime({ moduleManager, resourceLoader, configKey, readConfig } = {}) {
	if (!moduleManager || !resourceLoader || typeof configKey !== "function" || typeof readConfig !== "function") {
		throw new Error("[FeatureRuntime] 缺少必需依赖：moduleManager/resourceLoader/configKey/readConfig");
	}
	/** @type {Map<string, {id: string, name: string, capabilities: string[], switchKey: string|null, defaultEnabled: boolean, css: string[]}>} */
	const definitions = new Map();

	/**
	 * 声明一个 Feature。重复声明同一 id 会被拒绝——静默覆盖会让"谁提供了这个能力"变得不可追。
	 * @param {Object} definition - {id, name?, capabilities?, switchKey?, defaultEnabled?, pack?}
	 * @returns {{ok: boolean, errors: string[]}}
	 */
	function define(definition) {
		const errors = [];
		if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
			errors.push("definition 必须为对象");
		} else {
			if (typeof definition.id !== "string" || !definition.id) errors.push("缺少 id");
			if (asArray(definition.capabilities) === null) errors.push("capabilities 必须为数组");
			if (definition.pack !== undefined && typeof definition.pack !== "boolean") errors.push("pack 必须为布尔值");
			if (definition.defaultEnabled !== undefined && typeof definition.defaultEnabled !== "boolean") {
				errors.push("defaultEnabled 必须为布尔值");
			}
			if (!errors.length && definitions.has(definition.id)) errors.push(`重复声明: ${definition.id}`);
		}
		if (errors.length) return { ok: false, errors };

		definitions.set(definition.id, {
			id: definition.id,
			name: definition.name || definition.id,
			capabilities: asArray(definition.capabilities),
			switchKey: definition.switchKey || null,
			defaultEnabled: definition.defaultEnabled !== false,
			pack: definition.pack === true,
		});
		return { ok: true, errors: [] };
	}

	/** 取声明（不代表它可用） */
	function get(id) {
		return definitions.get(id) || null;
	}

	/** 全部声明，按 define 顺序 */
	function list() {
		return [...definitions.values()];
	}

	/**
	 * 只看开关、不看资源在场与否。供 moduleManager 的 isModuleEnabled 钩子使用。
	 * 未声明的 id 一律返回 true：Feature 开关不许误伤 core/style。
	 * @param {string} id
	 * @returns {boolean}
	 */
	function switchOn(id) {
		const definition = definitions.get(id);
		if (!definition || !definition.switchKey) return true;
		const value = readConfig(configKey(definition.switchKey));
		// 配置未播种（undefined）时回落声明里的默认值，不能当成"关"
		return value === undefined ? definition.defaultEnabled : !!value;
	}

	/**
	 * 资源是否在场：已拆包（pack:true）的必须真的装上了包，未拆包的看注册表记录。
	 * 与 P3 样式包"已拆分但未安装 → 功能不可用而 Core 正常"同一语义。
	 */
	function hasResources(id, definition) {
		if (!definition.pack) return moduleManager.isInstalled(id);
		return moduleManager.getInstallState(id).independent === true;
	}

	/**
	 * 该 Feature 是否应当装载：已声明 × 资源在场 × 开关为真。
	 * 任一条件不满足都不装载，Core 侧调用点必须能安全降级。
	 * @param {string} id
	 * @returns {boolean}
	 */
	function active(id) {
		const definition = definitions.get(id);
		if (!definition) return false;
		return hasResources(id, definition) && switchOn(id);
	}

	/** 资源寻址：一律委托 resourceLoader（→ getModuleBase），不另建机制 */
	function asset(id, path) {
		return resourceLoader.getAsset(id, path);
	}

	/**
	 * 该 Feature 要加载的 CSS（**模块相对路径**，取自 manifest.entry.css——单一来源）。
	 * 绝对地址由 resourceLoader.loadCSS → getModuleBase 负责，这里不另算一份，避免两套寻址。
	 * 未激活时返回空数组：禁用就真的什么都不加载。
	 * @param {string} id
	 * @returns {string[]}
	 */
	function cssOf(id) {
		if (!active(id)) return [];
		const entry = moduleManager.getManifest(id)?.entry || {};
		if (Array.isArray(entry.css)) return [...entry.css];
		return typeof entry.css === "string" ? [entry.css] : [];
	}

	/** 能力归属查询（任务书§15：用能力判断替代 id/样式字面量比较） */
	function capabilityOwner(name) {
		for (const definition of definitions.values()) {
			if (definition.capabilities.includes(name)) return definition.id;
		}
		return null;
	}

	return { define, get, list, switchOn, active, asset, cssOf, capabilityOwner };
}
