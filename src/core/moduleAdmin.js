/**
 * @fileoverview P6 模块管理界面的行模型（任务书§43）
 *
 * 只做"数据 → 界面行"的纯计算：不碰 DOM、不依赖 noname 运行时，可在 Node 全量测试。
 * 窗口层（src/features/moduleManagerWindow.js）只负责渲染这些行，并把 action.spec 原样交给安装器。
 *
 * 判定口径与后端保持一致（避免 UI 说"可点"而安装器拒绝）：
 *   - 卸载边界按任务书§19：使用中 / 被依赖 / 非独立安装 一律禁用（force 也不绕过，见 P5 审查修订）；
 *     依赖方取自注册表（含未安装的内置模块），与 packageInstaller.uninstall 的算法一致。
 *   - 依赖是否满足按 packageInstaller.ensureDependencies 的口径：注册表里存在（或 core）即视为已满足。
 *   - Core 兼容性复用 manifest.checkCoreRequirement（与安装器同一实现，不另立规则）。
 *   - 索引条目 → 安装规格沿用 packageInstaller.specFromIndex 的字段形状
 *     （expectedVersion / expectedSha256 / url / size / dependencies / core），可直接交给 install/update。
 */
import { compareVersions, checkCoreRequirement } from "./manifest.js";

/** 结果码 → 玩家可读文案（P6 按 code 出文案，任务书§6/§43；键集必须覆盖 packageInstaller.INSTALL_CODES） */
const CODE_TEXT = {
	OK: "成功",
	NO_IO: "文件系统端口不可用（本平台不支持安装）",
	NO_EXTRACTOR: "解压端口不可用（ZIP 能力缺失）",
	INVALID_SPEC: "安装规格非法（缺少模块ID或下载地址）",
	DEP_MISSING: "缺少依赖模块",
	DEP_CYCLE: "依赖出现循环",
	DOWNLOAD_FAILED: "下载失败（网络不可达或服务器错误）",
	CANCELLED: "已取消",
	SHA_MISMATCH: "内容校验不通过（SHA256 与期望值不符）",
	STRUCTURE_INVALID: "包结构不正确",
	MANIFEST_INVALID: "包清单（manifest）校验失败",
	ID_MISMATCH: "包内模块ID与安装目标不一致",
	VERSION_MISMATCH: "包内版本与安装目标不一致",
	CORE_INCOMPATIBLE: "与当前 Core 版本不兼容",
	ENTRY_MISSING: "清单声明的入口文件缺失",
	ALREADY_INSTALLED: "已安装同版本（需要覆盖重装时请选强制）",
	PUBLISH_FAILED: "发布到模块目录失败",
	ROLLBACK_FAILED: "回滚未完成，可能留下残留文件",
	STATE_FAILED: "安装状态写入失败",
	INSTALLED_CORRUPT: "安装台账损坏，已拒绝改写",
	NOT_INSTALLED: "不是独立安装的模块",
	NOT_INDEPENDENT: "未以独立包形式安装（内置）",
	IN_USE: "正在使用中，请先切换到其他样式",
	DEPENDED: "被其他模块依赖，请先卸载依赖方",
	UNINSTALL_FAILED: "卸载失败",
	IO_FAILED: "文件系统读写失败",
	IO_STALL: "文件系统无响应（已按失败处理）",
	UNEXPECTED: "未预期的错误",
};

/**
 * 结果码 → 中文文案
 * @param {string} code - INSTALL_CODES 之一（"OK" 表示成功）
 * @returns {string}
 */
export function codeText(code) {
	if (!code) return "未知结果";
	return CODE_TEXT[code] || `未知结果（${code}）`;
}

/**
 * 安装器结果 → 给玩家看的一句话（message 优先，附上全部告警；无 message 时回落到 code 文案）
 * @param {Object} result - packageInstaller 的结构化返回
 * @returns {string}
 */
export function resultText(result) {
	if (!result || typeof result !== "object") return "未知结果";
	const message = result.message || codeText(result.code);
	const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
	return warnings.length ? `${message}（${warnings.join("；")}）` : message;
}

/**
 * 字节数 → 可读大小；0/负数/非数字一律"未知"（索引缺 size 时不要假装是 0 字节）
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
	const value = Number(bytes);
	if (!Number.isFinite(value) || value <= 0) return "未知";
	if (value < 1024) return `${value} B`;
	const units = ["KB", "MB", "GB"];
	let size = value / 1024;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit++;
	}
	return `${size.toFixed(1)} ${units[unit]}`;
}

const asArray = value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/** 索引条目 → 安装规格（形状与 packageInstaller.specFromIndex 一致） */
function specFromEntry(id, entry) {
	return {
		id,
		url: entry?.url || "",
		expectedVersion: entry?.latest || entry?.version || "",
		expectedSha256: entry?.sha256 || "",
		size: entry?.size || 0,
		dependencies: asArray(entry?.dependencies),
		core: entry?.core,
	};
}

/**
 * 汇总行状态（界面顶部一行字）
 * @param {Array} rows - buildRows 产出的行
 * @returns {{total: number, installed: number, updatable: number, installable: number, inUse: number}}
 */
export function summarize(rows = []) {
	const list = Array.isArray(rows) ? rows : [];
	const hasEnabled = kind => row => (row.actions || []).some(action => action.kind === kind && action.enabled);
	return {
		total: list.length,
		installed: list.filter(row => row.installed).length,
		updatable: list.filter(hasEnabled("update")).length,
		installable: list.filter(hasEnabled("install")).length,
		inUse: list.filter(row => row.statusKind === "in_use").length,
	};
}

/**
 * 组装模块管理界面的行
 * @param {Object} [input]
 * @param {Object} [input.installed] - installed.json 的 `modules`（有记录＝独立安装）
 * @param {Object|null} [input.index] - module-index.json 内容；null 表示未配置模块源（离线）
 * @param {Array} [input.modules] - 注册表可见模块 `{id,name,type,version,dependencies}`（moduleManager.list() + manifest.dependencies）
 * @param {string|null} [input.currentStyleId] - 当前使用中的样式模块 id（styleRuntime.id）
 * @param {string|null} [input.coreVersion] - 当前 Core 版本
 * @returns {{rows: Array, summary: Object}}
 */
export function buildRows({ installed = {}, index = null, modules = [], currentStyleId = null, coreVersion = null } = {}) {
	const ledger = installed && typeof installed === "object" ? installed : {};
	const registry = asArray(modules).filter(item => item && item.id);
	const registryIds = new Set(registry.map(item => item.id));
	const entries = index && typeof index.modules === "object" ? index.modules : null;

	// 行集合 = 注册表顺序（core 自然在最前）+ 只在台账里的 + 只在索引里的；三类都要能看见
	const order = [];
	const seen = new Set();
	const push = item => {
		if (seen.has(item.id)) return;
		seen.add(item.id);
		order.push(item);
	};
	for (const item of registry) push({ id: item.id, name: item.name || item.id, type: item.type || "style", dependencies: asArray(item.dependencies), core: item.core });
	for (const id of Object.keys(ledger)) push({ id, name: id, type: "style", dependencies: [], core: undefined });
	for (const id of Object.keys(entries || {})) push({ id, name: id, type: "style", dependencies: [], core: undefined });

	const rows = order.map(item => {
		const ledgerEntry = ledger[item.id] || null;
		const isInstalled = Boolean(ledgerEntry);
		const entry = entries?.[item.id] || null;
		const isCore = item.type === "core";
		const inUse = Boolean(currentStyleId) && item.id === currentStyleId;

		const version = ledgerEntry?.version || null;
		const latest = entry?.latest || entry?.version || null;
		const deps = entry?.dependencies !== undefined ? asArray(entry.dependencies) : item.dependencies;
		const shownDeps = deps.filter(dep => dep !== "core");
		const missingDeps = deps.filter(dep => dep !== "core" && !registryIds.has(dep) && !ledger[dep]);
		const coreCheck = checkCoreRequirement(entry?.core ?? item.core, coreVersion);
		const updatable = Boolean(isInstalled && latest && version && compareVersions(latest, version) > 0);
		const dependents = order.filter(other => other.id !== item.id && other.dependencies.includes(item.id)).map(other => other.id);

		// 状态优先级：core > 使用中 > 不兼容 > 依赖缺失 > 有更新 > 已安装 > 未安装
		let statusKind = "not_installed";
		if (isCore) statusKind = "core";
		else if (inUse) statusKind = "in_use";
		else if (entry && !coreCheck.ok) statusKind = "incompatible";
		else if (missingDeps.length) statusKind = "dep_missing";
		else if (updatable) statusKind = "update_available";
		else if (isInstalled) statusKind = "installed";

		const actions = [];
		if (!isCore) {
			if (!isInstalled) {
				if (!index) {
					actions.push({ kind: "install", label: "安装", enabled: false, reason: "未配置模块源（P10 产出索引后可安装）", spec: null });
				} else if (!entry || !entry.url) {
					actions.push({ kind: "install", label: "安装", enabled: false, reason: "模块源未提供该模块", spec: entry ? specFromEntry(item.id, entry) : null });
				} else {
					const spec = specFromEntry(item.id, entry);
					const blocker = !coreCheck.ok ? coreCheck.message : missingDeps.length ? `缺少依赖：${missingDeps.join("、")}` : "";
					actions.push({ kind: "install", label: "安装", enabled: !blocker, reason: blocker, spec });
				}
			} else if (entry && updatable) {
				const spec = specFromEntry(item.id, entry);
				const blocker = !spec.url ? "模块源未提供下载地址" : !coreCheck.ok ? coreCheck.message : missingDeps.length ? `缺少依赖：${missingDeps.join("、")}` : "";
				actions.push({ kind: "update", label: "更新", enabled: !blocker, reason: blocker, spec });
			}
			if (isInstalled) {
				const blocker = inUse ? "正在使用中，请先切换到其他样式再卸载" : dependents.length ? `被以下模块依赖，请先卸载它们：${dependents.join("、")}` : "";
				actions.push({ kind: "uninstall", label: "卸载", enabled: !blocker, reason: blocker, spec: null });
			}
		}

		const STATUS_TEXT = {
			core: "核心组件（随扩展发布）",
			in_use: "当前使用",
			incompatible: "与当前 Core 不兼容",
			dep_missing: "缺少依赖",
			update_available: "有更新",
			installed: "已安装",
			not_installed: "未安装",
		};

		return {
			id: item.id,
			name: item.name || item.id,
			type: item.type,
			installed: isInstalled,
			version,
			latest,
			previousVersion: ledgerEntry?.previousVersion || null,
			statusKind,
			statusText: STATUS_TEXT[statusKind],
			versionText: updatable ? `${version} → ${latest}` : isInstalled ? `已安装 ${version}` : "未安装",
			sizeText: formatSize(entry?.size || ledgerEntry?.size || 0),
			dependenciesText: shownDeps.length ? `依赖：${shownDeps.join("、")}` : "依赖：无",
			compatibilityText: coreCheck.unknown ? "Core 版本未知，未做兼容性检查" : coreCheck.ok ? (entry?.core || item.core ? `需要 Core ${entry?.core || item.core}` : "未声明 Core 要求") : coreCheck.message,
			actions,
		};
	});

	return { rows, summary: summarize(rows) };
}
