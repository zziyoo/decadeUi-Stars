/**
 * @fileoverview 模块注册表（P1基础设施，任务书§35）
 * 内存中的模块记录表：内置模块启动时注册，未来安装的模块同样注册到此。
 * 不依赖 noname 运行时，可在 Node 中独立测试。
 */

/**
 * 创建模块注册表
 * @returns {Object} registry
 */
export function createModuleRegistry() {
	/** @type {Map<string, {manifest: Object, meta: Object, registeredAt: number}>} */
	const modules = new Map();

	return {
		/**
		 * 注册模块记录（同ID同版本重复注册 = 以新元信息覆盖更新，
		 * 供"内置→已安装"的升级路径使用；同ID不同版本拒绝，交由安装器处理版本切换）
		 * @param {Object} manifest - 已归一化的manifest
		 * @param {Object} [meta] - 运行时附加信息（来源、安装目录、样式别名等）
		 * @returns {Object} 注册后的记录
		 */
		register(manifest, meta = {}) {
			if (!manifest?.id) throw new Error("[ModuleRegistry] register 缺少 id");
			const existing = modules.get(manifest.id);
			if (existing) {
				if (existing.manifest.version === manifest.version) {
					const record = { manifest, meta: { source: "builtin", ...meta }, registeredAt: existing.registeredAt };
					modules.set(manifest.id, record);
					return record;
				}
				throw new Error(`[ModuleRegistry] 模块 ${manifest.id} 已存在（v${existing.manifest.version}），拒绝注册 v${manifest.version}`);
			}
			const record = { manifest, meta: { source: "builtin", ...meta }, registeredAt: Date.now() };
			modules.set(manifest.id, record);
			return record;
		},

		/** 按ID获取记录，不存在返回 null */
		get(id) {
			return modules.get(id) || null;
		},

		has(id) {
			return modules.has(id);
		},

		/**
		 * 注销模块记录（P5 安装器切换模块版本时使用：内置注册 → 已安装注册）
		 * @param {string} id - 模块ID
		 * @returns {boolean} 是否存在并被移除
		 */
		unregister(id) {
			return modules.delete(id);
		},

		/** 列出全部记录，可按类型过滤 */
		list(filter = {}) {
			const all = [...modules.values()];
			return filter.type ? all.filter(record => record.manifest.type === filter.type) : all;
		},

		ids() {
			return [...modules.keys()];
		},

		get size() {
			return modules.size;
		},
	};
}
