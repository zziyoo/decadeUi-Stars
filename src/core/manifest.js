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
 * 比较两个语义化版本（仅数字段与预发布后缀，缺省段按 0 处理）
 * @param {string} a
 * @param {string} b
 * @returns {number} a>b → 1，a<b → -1，相等 → 0
 */
export function compareVersions(a, b) {
	const split = version => {
		const raw = String(version);
		const separator = raw.indexOf("-");
		const main = separator === -1 ? raw : raw.slice(0, separator);
		const pre = separator === -1 ? "" : raw.slice(separator + 1);
		const numbers = main.split(".").map(part => Number(part) || 0);
		while (numbers.length < 3) numbers.push(0);
		return { numbers, pre };
	};
	const left = split(a);
	const right = split(b);
	for (let i = 0; i < 3; i++) {
		if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] > right.numbers[i] ? 1 : -1;
	}
	if (left.pre === right.pre) return 0;
	// 无预发布标记的版本高于带标记者（SemVer§11）
	if (!left.pre) return 1;
	if (!right.pre) return -1;
	return left.pre > right.pre ? 1 : -1;
}

/**
 * 校验 Manifest 的 core 版本要求（任务书§17"检查Core版本"、§11"版本不满足"）
 * 仅支持任务书§6示例使用的 `>=x.y.z` 与精确 `=x.y.z`；其他写法判为不满足，不猜语义。
 *
 * @param {string} requirement - manifest.core（如 ">=1.4.2"）
 * @param {string|null} coreVersion - 当前 Core 版本；null 表示未知
 * @returns {{ok: boolean, unknown: boolean, message: string}}
 */
export function checkCoreRequirement(requirement, coreVersion) {
	if (!requirement) return { ok: true, unknown: false, message: "" };
	const matched = /^(>=|=|>)\s*(\d+(?:\.\d+){0,2}(?:-[\w.-]+)?)$/.exec(String(requirement).trim());
	if (!matched) {
		return { ok: false, unknown: false, message: `无法识别的 core 版本要求: ${requirement}` };
	}
	if (!coreVersion) {
		return { ok: true, unknown: true, message: `Core 版本未知，跳过 ${requirement} 检查` };
	}
	const [, operator, target] = matched;
	const cmp = compareVersions(coreVersion, target);
	const satisfied = operator === ">" ? cmp > 0 : operator === "=" ? cmp === 0 : cmp >= 0;
	return {
		ok: satisfied,
		unknown: false,
		message: satisfied ? "" : `需要 Core ${requirement}，当前 ${coreVersion}`,
	};
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
