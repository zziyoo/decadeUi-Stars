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
 * 损坏行的修复动作（D4，2026-10-01 Android 真机死锁）。
 *
 * `verifyInstalled` 早就给出 `action`，只是没人消费：包坏掉 ⇒ 启动注册失败 ⇒ 注册表里
 * `independent:false`，而台账仍写"已安装" ⇒ 行上只有一个必然被 `NOT_INDEPENDENT` 拒绝的
 * 卸载按钮，安装/更新又因为 `isInstalled` 不出现——删不掉也装不回。手机上文件管理器
 * 进不去 app 私有目录，所以这个按钮是**唯一**恢复通道。
 *
 * 两种修法按健康检查的计划走：
 *   - `restore`：上一版自己健康 ⇒ 本地改名回退，不下载、**不要求配置模块源**；
 *   - `reinstall`：没有可用上一版 ⇒ 按**台账记的版本**（不是索引 latest）从模块源重装，
 *     顺带升级会把"修复"变成另一件事。
 */
function repairAction(damage, id, entry, version, coreCheck) {
	const plan = damage.action || {};
	if (plan.kind === "restore") {
		return { kind: "repair", label: "修复", repairKind: "restore", version: plan.version || null, enabled: true, reason: "", spec: null };
	}
	const blocker = !entry || !entry.url
		? "未配置模块源，或模块源没给这个模块的下载地址，无法重装"
		: !coreCheck.ok
			? coreCheck.message
			: "";
	const spec = entry ? { ...specFromEntry(id, entry), expectedVersion: version || entry.latest || entry.version || "" } : null;
	return { kind: "repair", label: "修复", repairKind: "reinstall", version: version || null, enabled: !blocker, reason: blocker, spec };
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
		corrupt: list.filter(row => row.statusKind === "corrupt").length,
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
 * @param {Object} [input.featureStates] - Feature 模块的状态（featureRuntime.list() + switchOn）：
 *   `{ id: { pack: 资源是否已拆成独立包, switchKey: 开关配置键, enabled: 当前是否开启 } }`。
 *   缺省（空对象）时 Feature 行按通用规则处理，行为与引入本参数之前完全一致。
 * @param {string|null} [input.installBlocker] - 平台剥夺安装能力时给玩家看的一句话
 *   （如"本平台不支持安装/卸载（缺少：文件系统端口）"）；null/空表示能力齐备。
 *   它只把 `install/update/uninstall` 三个动作置灰并**附加**到既有理由之前，
 *   不许影响 Feature 的启用/禁用（启停不碰文件系统，任务书§16 第一阶段就要它），
 *   也不许顺手清掉 `spec`（置灰不等于没有可装的东西）。
 * @param {Object} [input.health] - `verifyInstalled(id)` 的结果按 id 归档：
 *   `{ id: { status:"ok"|"corrupt", reasons:string[], action:null|{kind:"restore"|"reinstall", version?} } }`。
 *   缺省、或某 id 缺失/判 ok 时，那一行与引入本参数之前**逐字一致**；
 *   判 corrupt 的行换成"修复 + 置灰的卸载"（理由见 repairAction，是真机上唯一的恢复通道）。
 * @returns {{rows: Array, summary: Object}}
 */
export function buildRows({
	installed = {},
	index = null,
	modules = [],
	currentStyleId = null,
	coreVersion = null,
	featureStates = {},
	installBlocker = null,
	health = {},
} = {}) {
	const ledger = installed && typeof installed === "object" ? installed : {};
	const healthMap = health && typeof health === "object" ? health : {};
	const registry = asArray(modules).filter(item => item && item.id);
	const registryIds = new Set(registry.map(item => item.id));
	const entries = index && typeof index.modules === "object" ? index.modules : null;
	const states = featureStates && typeof featureStates === "object" ? featureStates : {};

	// 行集合 = 注册表顺序（core 自然在最前）+ 只在台账里的 + 只在索引里的；三类都要能看见
	const order = [];
	const seen = new Set();
	const push = item => {
		if (seen.has(item.id)) return;
		seen.add(item.id);
		order.push(item);
	};
	for (const item of registry) push({ id: item.id, name: item.name || item.id, type: item.type || "style", version: item.version || null, dependencies: asArray(item.dependencies), core: item.core });
	for (const id of Object.keys(ledger)) push({ id, name: id, type: "style", version: null, dependencies: [], core: undefined });
	for (const id of Object.keys(entries || {})) push({ id, name: id, type: "style", version: null, dependencies: [], core: undefined });

	const rows = order.map(item => {
		const ledgerEntry = ledger[item.id] || null;
		const isInstalled = Boolean(ledgerEntry);
		// 损坏判定只作用于"台账说装着"的行：health 来自 verifyInstalled，未装的包没有可查的目录
		const damage = isInstalled && healthMap[item.id] && healthMap[item.id].status === "corrupt" ? healthMap[item.id] : null;
		const entry = entries?.[item.id] || null;
		const isCore = item.type === "core";
		const inUse = Boolean(currentStyleId) && item.id === currentStyleId;

		// Feature 判定（任务书§45）：门控型（资源随扩展发布）不走安装通道，只有启用/禁用；
		// 拆包型资源未装上时谈不上启停，未装只给安装、装上后安装通道与启停通道并存。
		const feature = item.type === "feature" ? states[item.id] || null : null;
		const packed = Boolean(feature) && feature.pack === true;
		const builtIn = Boolean(feature) && !packed && !isInstalled;
		const toggleKey = feature && typeof feature.switchKey === "string" && feature.switchKey ? feature.switchKey : null;
		const featureOn = Boolean(feature) && feature.enabled !== false;
		const canToggle = Boolean(toggleKey) && (!packed || isInstalled);

		const version = ledgerEntry?.version || null;
		const latest = entry?.latest || entry?.version || null;
		const deps = entry?.dependencies !== undefined ? asArray(entry.dependencies) : item.dependencies;
		const shownDeps = deps.filter(dep => dep !== "core");
		const missingDeps = deps.filter(dep => dep !== "core" && !registryIds.has(dep) && !ledger[dep]);
		const coreCheck = checkCoreRequirement(entry?.core ?? item.core, coreVersion);
		const updatable = Boolean(isInstalled && latest && version && compareVersions(latest, version) > 0);
		const dependents = order.filter(other => other.id !== item.id && other.dependencies.includes(item.id)).map(other => other.id);

		// 状态优先级：core > 内置功能 > 已损坏 > 使用中 > 不兼容 > 依赖缺失 > 有更新 > 已安装 > 未安装
		let statusKind = "not_installed";
		if (isCore) statusKind = "core";
		else if (builtIn) statusKind = "built_in";
		else if (damage) statusKind = "corrupt";
		else if (inUse) statusKind = "in_use";
		else if (entry && !coreCheck.ok) statusKind = "incompatible";
		else if (missingDeps.length) statusKind = "dep_missing";
		else if (updatable) statusKind = "update_available";
		else if (isInstalled) statusKind = "installed";

		const actions = [];
		if (!isCore) {
			if (!builtIn) {
				if (damage) {
					actions.push(repairAction(damage, item.id, entry, version, coreCheck));
				} else if (!isInstalled) {
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
			}
			if (isInstalled) {
				// 损坏行别让人先点那个必然失败的卸载：包坏掉时启动注册没通过，
				// 注册表里它不是独立安装（independent:false），卸载守卫会按 NOT_INDEPENDENT 拒绝。
				const blocker = damage
					? "包已损坏：请先点「修复」（它此刻没以独立包形式注册，卸载会被拒绝）"
					: inUse
						? "正在使用中，请先切换到其他样式再卸载"
						: dependents.length
							? `被以下模块依赖，请先卸载它们：${dependents.join("、")}`
							: "";
				actions.push({ kind: "uninstall", label: "卸载", enabled: !blocker, reason: blocker, spec: null });
			}
			if (canToggle) {
				actions.push({
					kind: featureOn ? "disable" : "enable",
					label: featureOn ? "禁用" : "启用",
					enabled: true,
					reason: "",
					switchKey: toggleKey,
				});
			}
		}

		const STATUS_TEXT = {
			core: "核心组件（随扩展发布）",
			built_in: "内置功能",
			in_use: "当前使用",
			corrupt: "已损坏（需修复）",
			incompatible: "与当前 Core 不兼容",
			dep_missing: "缺少依赖",
			update_available: "有更新",
			installed: "已安装",
			not_installed: "未安装",
		};

		// 平台剥夺安装能力：只挡落盘/删目录那四个动作（repair 也要落盘），Feature 的启停不受影响
		if (installBlocker) {
			for (const action of actions) {
				if (!["install", "update", "uninstall", "repair"].includes(action.kind)) continue;
				action.enabled = false;
				action.reason = action.reason ? `${installBlocker}；${action.reason}` : String(installBlocker);
			}
		}

		return {
			id: item.id,
			name: item.name || item.id,
			type: item.type,
			installed: isInstalled,
			version,
			latest,
			previousVersion: ledgerEntry?.previousVersion || null,
			statusKind,
			statusText: builtIn && toggleKey && !featureOn ? `${STATUS_TEXT.built_in}（已禁用）` : STATUS_TEXT[statusKind],
			versionText: updatable ? `${version} → ${latest}` : isInstalled ? `已安装 ${version}` : builtIn ? (item.version ? `内置 ${item.version}` : "内置") : "未安装",
			sizeText: formatSize(entry?.size || ledgerEntry?.size || 0),
			dependenciesText: shownDeps.length ? `依赖：${shownDeps.join("、")}` : "依赖：无",
			compatibilityText: coreCheck.unknown ? "Core 版本未知，未做兼容性检查" : coreCheck.ok ? (entry?.core || item.core ? `需要 Core ${entry?.core || item.core}` : "未声明 Core 要求") : coreCheck.message,
			actions,
		};
	});

	return { rows, summary: summarize(rows) };
}
