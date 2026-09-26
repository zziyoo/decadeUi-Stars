/**
 * @fileoverview 模块管理器（P1基础设施，任务书§35-§36）
 * 验收接口：list() / get(id) / isInstalled(id) / getManifest(id)。
 * P1阶段 isInstalled 对内置模块恒为 true；真正的下载安装由 PackageInstaller（P5）实现。
 * 不依赖 noname 运行时，可在 Node 中独立测试。
 */
import { normalizeManifest, validateManifest } from "./manifest.js";

/**
 * 创建模块管理器
 * @param {Object} deps
 * @param {Object} deps.registry - 模块注册表
 * @param {(id: string) => boolean} [deps.isModuleEnabled] - 启用状态判定（P1默认恒为启用）
 * @returns {Object} moduleManager
 */
export function createModuleManager({ registry, isModuleEnabled } = {}) {
	if (!registry) throw new Error("[ModuleManager] 缺少 registry");
	const isEnabledImpl = isModuleEnabled || (() => true);

	return {
		/**
		 * 列出全部模块摘要
		 * @param {{type?: string}} [filter] - 按类型过滤
		 * @returns {Array<{id, name, version, type, installed, enabled, capabilities}>}
		 */
		list(filter = {}) {
			return registry.list(filter).map(record => ({
				id: record.manifest.id,
				name: record.manifest.name,
				version: record.manifest.version,
				type: record.manifest.type,
				installed: true,
				enabled: isEnabledImpl(record.manifest.id),
				capabilities: [...record.manifest.capabilities],
			}));
		},

		/** 按ID获取完整记录（含manifest与meta），不存在返回 null */
		get(id) {
			return registry.get(id);
		},

		/** 模块是否已安装 */
		isInstalled(id) {
			return registry.has(id);
		},

		/** 获取模块manifest，不存在返回 null */
		getManifest(id) {
			const record = registry.get(id);
			return record ? record.manifest : null;
		},

		/** 模块是否已安装且处于启用状态 */
		isEnabled(id) {
			return this.isInstalled(id) && isEnabledImpl(id);
		},

		/**
		 * 注册外部模块（供安装器使用；内置模块由 registerBuiltInModules 注册）
		 * @param {Object} manifest - 待注册的manifest（内部先归一化再校验）
		 * @param {Object} [meta]
		 * @returns {{ok: boolean, errors?: string[]}}
		 */
		register(manifest, meta) {
			const check = validateManifest(manifest);
			if (!check.ok) return { ok: false, errors: check.errors };
			registry.register(normalizeManifest(manifest), meta);
			return { ok: true };
		},
	};
}
