/**
 * @fileoverview 模块Manifest解析与校验（P1基础设施，任务书§6/§35）
 * 不依赖 noname 运行时，可在 Node 中独立测试。
 */

/** 当前支持的Manifest规范版本 */
export const MANIFEST_SCHEMA = 1;

/** 模块类型枚举（任务书§5） */
export const MODULE_TYPES = ["core", "style", "feature", "shared"];

/** 模块ID规范（任务书§7）：小写字母开头，仅小写字母/数字/连字符 */
const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** 语义化版本 */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/;

/**
 * 校验Manifest是否符合任务书§6标准
 * @param {Object} manifest - 待校验的manifest对象
 * @returns {{ok: boolean, errors: string[]}} 校验结果
 */
export function validateManifest(manifest) {
	const errors = [];
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		return { ok: false, errors: ["manifest 必须为对象"] };
	}
	if (manifest.schema !== MANIFEST_SCHEMA) {
		errors.push(`schema 必须为 ${MANIFEST_SCHEMA}，收到 ${manifest.schema}`);
	}
	if (typeof manifest.id !== "string" || !MODULE_ID_PATTERN.test(manifest.id)) {
		errors.push(`id 非法：${manifest.id}（须匹配 ${MODULE_ID_PATTERN}）`);
	}
	if (typeof manifest.name !== "string" || !manifest.name) {
		errors.push("name 缺失");
	}
	if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
		errors.push(`version 非法：${manifest.version}`);
	}
	if (!MODULE_TYPES.includes(manifest.type)) {
		errors.push(`type 非法：${manifest.type}（允许：${MODULE_TYPES.join("/")}）`);
	}
	if (manifest.type !== "core" && (typeof manifest.core !== "string" || !manifest.core)) {
		errors.push("非 core 模块必须声明 core 版本要求");
	}
	if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies)) {
		errors.push("dependencies 必须为数组");
	}
	if (manifest.entry !== undefined) {
		if (typeof manifest.entry !== "object" || manifest.entry === null) {
			errors.push("entry 必须为对象");
		} else {
			const { js, css } = manifest.entry;
			if (js !== undefined && typeof js !== "string" && !Array.isArray(js)) {
				errors.push("entry.js 必须为字符串或数组");
			}
			if (css !== undefined && !Array.isArray(css)) {
				errors.push("entry.css 必须为数组");
			}
		}
	}
	if (manifest.capabilities !== undefined && !Array.isArray(manifest.capabilities)) {
		errors.push("capabilities 必须为数组");
	}
	if (manifest.platform !== undefined && !Array.isArray(manifest.platform)) {
		errors.push("platform 必须为数组");
	}
	return { ok: errors.length === 0, errors };
}

/**
 * 归一化Manifest：补全默认字段（不修改原对象）
 * @param {Object} raw - 原始manifest
 * @returns {Object} 补全后的manifest
 */
export function normalizeManifest(raw) {
	const manifest = {
		schema: MANIFEST_SCHEMA,
		id: undefined,
		name: undefined,
		version: undefined,
		type: undefined,
		core: ">=0.0.0",
		dependencies: [],
		entry: { js: [], css: [] },
		capabilities: [],
		platform: ["desktop", "mobile"],
		size: 0,
		sha256: "",
		author: "",
		...raw,
	};
	if (typeof manifest.entry.js === "string") manifest.entry.js = [manifest.entry.js];
	if (typeof manifest.entry.css === "string") manifest.entry.css = [manifest.entry.css];
	return manifest;
}
