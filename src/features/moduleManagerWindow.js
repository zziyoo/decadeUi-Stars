/**
 * @fileoverview P6 模块管理界面（任务书§43）
 *
 * 形态与 config-window.js 一致：独立 overlay 窗口 + 列表 + 行内操作按钮。
 * 职责边界：本文件只做渲染与交互，行状态/动作判定全部来自 core/moduleAdmin.js（纯逻辑、Node 可测）；
 * 安装/更新/卸载一律经 decadeUI.packageInstaller（§57 公开面），不在 UI 里碰文件系统。
 *
 * 能力缺失的降级边界：`packageInstaller.isAvailable()` 为 false（无文件端口或无解压能力）时
 * **不整窗拒绝**——列表照出、台账与模块源照读，只有 install/update/uninstall 三个动作置灰并说明原因；
 * 门控型 Feature 的启用/禁用不碰文件系统，任何平台都必须可用。
 *
 * 安全与语义：
 *   - 卸载需要二次确认（按钮变"确认卸载"，4 秒后自动复原），不使用原生 confirm。
 *   - 动作进行中禁止并发（busy 门闩）；下载可取消（AbortController，安装器支持 CANCELLED）。
 *   - 反馈文案按 INSTALL_CODES 出（moduleAdmin.resultText），安装/卸载成功后提示需重载。
 *   - 模块源只有一种判定（moduleIndexUrl 是否为空，P19）：空＝本体内置 modules/module-index.json
 *     （随扩展更新），非空＝自定义远程索引；「恢复默认模块源」只是清空该键，不写回固定地址。
 *   - Feature 的启用/禁用只写它声明的 switchKey 配置键（与外观页同一个开关，不另立状态源）；
 *     装载发生在 content 初始化，所以改完必须重载才生效（任务书§16）。
 */
import { lib, game } from "noname";
import { buildRows, resultText } from "../core/moduleAdmin.js";
import { loadModuleIndex } from "../core/moduleIndexSource.js";

const STYLE_ID = "decade-module-manager-styles";
const UNINSTALL_ARM_MS = 4000;

let currentOverlay = null;
let busy = false;
let controller = null;
let notice = null;
/**
 * 最近一次成功读取的模块源地址与索引内容。
 * indexUrl 是索引内相对 url 的解析基准（安装器只解析一次且对绝对地址幂等）：
 * 自定义远程源时是索引自身地址，内置源时是索引自带的 releaseBase（Release 资产目录）。
 * index 让安装器§11 的"缺依赖先按索引装依赖"在界面上真正可用——此前窗口从未把索引交给安装器，
 * 该分支只有 Node 测试跑得通。
 */
let indexBaseUrl = null;
let indexSnapshot = null;

const STAGE_TEXT = {
	resolving: "解析",
	dependencies: "安装依赖",
	downloading: "下载中",
	temp: "落盘",
	extracting: "解压中",
	verifying: "校验中",
	publishing: "发布中",
	state: "写台账",
	done: "完成",
};

/** 模块源配置键（与 src/config/definitions/misc.js 的 moduleIndexUrl 同键） */
const indexKey = () => `extension_${decadeUIName}_moduleIndexUrl`;

function loadStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const link = document.createElement("link");
	link.id = STYLE_ID;
	link.rel = "stylesheet";
	link.href = `${decadeUIPath}src/features/module-manager-window.css`;
	document.head.appendChild(link);
}

function el(className, parent, tagName = "div") {
	const node = document.createElement(tagName);
	node.className = className;
	if (parent) parent.appendChild(node);
	return node;
}

/** 注册表可见模块 → 行模型输入（moduleManager.list() 不含 dependencies/core，这里从 manifest 补上） */
function collectModules(api) {
	const manager = api?.moduleManager;
	if (!manager?.list) return [];
	return manager.list().map(item => {
		const manifest = manager.getManifest?.(item.id) || {};
		return {
			id: item.id,
			name: item.name,
			type: item.type,
			version: item.version,
			dependencies: manifest.dependencies || [],
			core: manifest.core,
		};
	});
}

/** Feature 行判定输入：pack 取自声明，enabled 走 switchOn（与门控同一实现，不在 UI 里重读配置规则） */
function collectFeatureStates(api) {
	const feature = api?.feature;
	if (!feature?.list) return {};
	const states = {};
	for (const item of feature.list()) {
		states[item.id] = {
			pack: item.pack === true,
			switchKey: item.switchKey || null,
			enabled: feature.switchOn?.(item.id) !== false,
		};
	}
	return states;
}

/**
 * 逐包健康检查（结构级四项，D4 的入口数据源）。
 *
 * 并发跑：手机上串行探测会把首屏拖成"每个包四次 IO × 包数"。任何一个包查失败（IO 抖动、
 * 端口不可用、抛异常）都只让**那一行**没有修复按钮，不许拖垮整窗——列表仍可浏览是本窗的底线。
 * @param {Object} installer - decadeUI.packageInstaller
 * @param {string[]} ids - 台账里记着的模块 id
 * @returns {Promise<Object>} `{ id: { status, reasons, action } }`
 */
async function collectHealth(installer, ids) {
	if (typeof installer?.verifyInstalled !== "function") return {};
	const results = await Promise.all(
		ids.map(async id => {
			try {
				const verified = await installer.verifyInstalled(id);
				if (!verified?.ok) return [id, null];
				return [id, { status: verified.status, reasons: verified.reasons || [], action: verified.action || null }];
			} catch {
				return [id, null];
			}
		})
	);
	const health = {};
	for (const [id, value] of results) if (value) health[id] = value;
	return health;
}

/** 读取当前数据并整窗重绘 */
async function refresh() {
	if (!currentOverlay) return;
	const listBox = currentOverlay.querySelector(".decade-module-list");
	const summaryBox = currentOverlay.querySelector(".decade-module-summary");
	const noteBox = currentOverlay.querySelector(".decade-module-source-note");
	const noticeBox = currentOverlay.querySelector(".decade-module-notice");
	listBox.innerHTML = "";
	noteBox.textContent = "";

	const api = window.decadeUI;
	const installer = api?.packageInstaller;
	if (!installer) {
		summaryBox.textContent = "安装器未挂载";
		el("decade-module-empty", listBox).textContent = "安装器不可用：扩展尚未完成 content 初始化。";
		return;
	}

	const available = installer.isAvailable?.() || {};
	// 端口缺失只剥夺"安装/更新/卸载"这三条落盘通道，不剥夺整窗浏览，
	// 更不剥夺门控型 Feature 的启用/禁用（它只写一个配置键，任务书§16 第一阶段就要它）。
	// 注意：`available.available` 在"解压能力尚未探测"时也是 false（未知 ≠ 可用），
	// 所以这里只按**端口是否缺失**判定；真实能力交给下面的 ready() 探明后再定夺。
	const missing = [available.missingIo ? "文件系统端口" : null, available.missingExtractor ? "解压端口" : null].filter(Boolean);
	let installBlocker = missing.length ? `本平台不支持安装/卸载（缺少：${missing.join("、")}）` : null;

	// 端口对象在 ≠ 解压能力在：本体把 JSZip 当内联 ES 模块用、不挂全局，
	// 真机上完全可能"能下载却解不开"。这里异步探一次，探不过就同样置灰三个动作
	// （以前只看 isAvailable()，于是按钮是亮的、包下完了才失败）。
	if (!installBlocker && typeof installer.ready === "function") {
		let readiness = { ok: true, reason: "" };
		try {
			readiness = await installer.ready();
		} catch (error) {
			readiness = { ok: false, reason: String(error?.message ?? error) };
		}
		if (!readiness.ok) installBlocker = `本机取不到解压能力（ZIP）：${readiness.reason || "原因未知"}`;
	}

	// 提示行可能同时有"台账读取失败"与"模块源状态"两条，不能互相覆盖
	const notes = [];
	if (installBlocker) notes.push(`${installBlocker}；列表仍可浏览，内置功能的启用/禁用仍可用`);
	const installedResult = await installer.readInstalled();
	const ledger = installedResult.ok ? installedResult.data.modules || {} : {};
	if (!installedResult.ok) notes.push(`读取安装台账失败：${resultText(installedResult)}`);
	const health = await collectHealth(installer, Object.keys(ledger));

	const sourceUrl = String(lib.config[indexKey()] || "").trim();
	let index = null;
	indexBaseUrl = null;
	indexSnapshot = null;
	const loaded = await loadModuleIndex({ rawUrl: sourceUrl, installer, fetchOpts: { timeoutMs: 10000 } });
	if (loaded.ok) {
		index = loaded.index;
		indexSnapshot = index;
		indexBaseUrl = loaded.indexUrl || "";
		// 状态只有两种（判定只看 moduleIndexUrl 是否为空，没有第三套状态源）：
		notes.push(
			loaded.kind === "builtin"
				? `正在使用扩展内置模块源（随扩展更新，索引 schema ${index?.schema ?? "?"}）`
				: `自定义远程模块源已连接（索引 schema ${index?.schema ?? "?"}）`
		);
	} else {
		notes.push(loaded.kind === "builtin" ? `内置模块源不可用：${resultText(loaded)}` : `自定义模块源不可用：${resultText(loaded)}`);
	}
	noteBox.textContent = notes.join("；");

	const { rows, summary } = buildRows({
		installed: ledger,
		index,
		modules: collectModules(api),
		currentStyleId: api?.style?.id ?? null,
		coreVersion: api?.version ?? null,
		featureStates: collectFeatureStates(api),
		installBlocker,
		health,
	});
	if (summary.corrupt) {
		// 损坏行可能不在首屏，提示行里点名，否则玩家只会看到"卸不掉"
		const ids = rows.filter(row => row.statusKind === "corrupt").map(row => row.id);
		const lead = notes.length ? `${notes.join("；")}；` : "";
		noteBox.textContent = `${lead}已损坏 ${summary.corrupt} 个（${ids.join("、")}）：点该行的「修复」`;
	}
	summaryBox.textContent = `共 ${summary.total} 个模块 · 已独立安装 ${summary.installed} · 可更新 ${summary.updatable} · 可安装 ${summary.installable}${
		summary.corrupt ? ` · 待修复 ${summary.corrupt}` : ""
	}${installBlocker ? " · 本平台不支持安装/卸载" : available.atomicRename ? "" : " · 本平台发布非原子（中断后请重做一次）"}`;
	renderRows(listBox, rows);
	noticeBox.textContent = notice?.text || "";
	noticeBox.className = `decade-module-notice${notice ? ` is-${notice.tone}` : ""}`;
}

function badgeTone(statusKind) {
	if (statusKind === "in_use") return "is-ok";
	if (statusKind === "update_available") return "is-warn";
	if (statusKind === "incompatible" || statusKind === "dep_missing" || statusKind === "corrupt") return "is-error";
	return "is-muted";
}

function renderRows(listBox, rows) {
	if (!rows.length) {
		el("decade-module-empty", listBox).textContent = "没有可显示的模块。";
		return;
	}
	for (const row of rows) {
		const rowEl = el("decade-module-row", listBox);

		const main = el("decade-module-main", rowEl);
		const head = el("decade-module-head-line", main);
		el("decade-module-name", head).textContent = row.name;
		el(`decade-module-badge ${badgeTone(row.statusKind)}`, head).textContent = row.statusText;
		el("decade-module-version", head).textContent = row.versionText;
		const meta = el("decade-module-meta", main);
		meta.textContent = [row.sizeText, row.dependenciesText, row.compatibilityText].filter(Boolean).join(" · ");

		const actions = el("decade-module-actions", rowEl);
		for (const action of row.actions) {
			const btn = el("decade-module-btn", actions, "button");
			btn.dataset.action = action.kind;
			btn.textContent = action.label;
			if (!action.enabled || busy) {
				btn.disabled = true;
				if (action.reason) btn.title = action.reason;
			} else if (action.kind === "uninstall") {
				armConfirm(btn, action.label, "确认卸载", () => runAction(row, action, rowEl));
			} else if (action.kind === "enable" || action.kind === "disable") {
				btn.title = "改写外观页的同一开关；重载游戏后生效";
				btn.onclick = () => toggleFeature(row, action);
			} else {
				btn.classList.add("is-primary");
				btn.onclick = () => runAction(row, action, rowEl);
			}
		}

		const progress = el("decade-module-progress", rowEl);
		el("decade-module-progress-bar", progress);
		const progressText = el("decade-module-progress-text", progress);
		progressText.textContent = "";
		const cancel = el("decade-module-cancel", progress, "button");
		cancel.textContent = "取消";
		cancel.classList.add("hidden");
		cancel.onclick = () => controller?.abort();
	}
}

/** 二次确认：第一次点击进入"确认"态，4 秒无操作自动复原（卸载/重载这类不可逆操作用） */
function armConfirm(btn, label, confirmLabel, run) {
	let timer = null;
	btn.onclick = () => {
		if (btn.dataset.armed === "1") {
			clearTimeout(timer);
			btn.dataset.armed = "";
			btn.textContent = label;
			btn.classList.remove("armed");
			run();
			return;
		}
		btn.dataset.armed = "1";
		btn.textContent = confirmLabel;
		btn.classList.add("armed");
		timer = setTimeout(() => {
			if (!btn.isConnected) return;
			btn.dataset.armed = "";
			btn.textContent = label;
			btn.classList.remove("armed");
		}, UNINSTALL_ARM_MS);
	};
}

/** Feature 启停：只写它声明的 switchKey（与配置页同一个键，不另立状态源）。装载在 content 初始化时发生，故需重载才生效（任务书§16） */
function toggleFeature(row, action) {
	if (busy || !action.switchKey) return;
	game.saveConfig(`extension_${decadeUIName}_${action.switchKey}`, action.kind === "enable");
	notice = { tone: "ok", text: `${row.name}：已${action.kind === "enable" ? "启用" : "禁用"}，点上方「重载游戏」后生效` };
	refresh();
}

/** 执行一个动作：busy 门闩 + 进度 + 取消 + 结果文案 */
async function runAction(row, action, rowEl) {
	if (busy) return;
	const installer = window.decadeUI?.packageInstaller;
	if (!installer) return;

	busy = true;
	controller = new AbortController();
	const bar = rowEl.querySelector(".decade-module-progress-bar");
	const text = rowEl.querySelector(".decade-module-progress-text");
	const cancel = rowEl.querySelector(".decade-module-cancel");
	rowEl.classList.add("is-busy");
	cancel.classList.remove("hidden");
	for (const btn of currentOverlay.querySelectorAll(".decade-module-btn")) btn.disabled = true;

	const onProgress = info => {
		const ratio = Number.isFinite(info?.ratio) ? info.ratio : info?.stage === "done" ? 1 : 0;
		bar.style.width = `${Math.round(ratio * 100)}%`;
		text.textContent = `${STAGE_TEXT[info?.stage] || info?.stage || "处理中"}${ratio ? ` ${Math.round(ratio * 100)}%` : ""}`;
	};

	let result;
	try {
		if (action.kind === "install") {
			result = await installer.install(action.spec, { onProgress, signal: controller.signal, index: indexSnapshot, indexUrl: indexBaseUrl });
		} else if (action.kind === "update") {
			result = await installer.update(row.id, { spec: action.spec, onProgress, signal: controller.signal, index: indexSnapshot, indexUrl: indexBaseUrl });
		} else if (action.kind === "repair") {
			// restore 是本地改名回退到健康的上一版（不下载）；reinstall 按**台账版本**从模块源覆盖重装
			result =
				action.repairKind === "restore"
					? await installer.rollback(row.id, action.version ? { version: action.version } : {})
					: await installer.install(action.spec, {
							force: true,
							onProgress,
							signal: controller.signal,
							index: indexSnapshot,
							indexUrl: indexBaseUrl,
						});
		} else {
			result = await installer.uninstall(row.id, { onProgress });
		}
	} catch (error) {
		result = { ok: false, code: "UNEXPECTED", message: String(error?.message ?? error) };
	}
	busy = false;
	controller = null;
	notice = { tone: result?.ok ? "ok" : "error", text: `${row.name}：${resultText(result)}${result?.requiresReload ? "（需重载游戏生效）" : ""}` };
	await refresh();
}

function createWindow() {
	if (currentOverlay) return;
	loadStyles();
	notice = null;

	const overlay = el("decade-module-overlay");
	const dialog = el("decade-module-dialog", overlay);
	el("decade-module-pattern", dialog);

	const head = el("decade-module-head", dialog);
	el("decade-module-title", head).textContent = "模块管理";
	const reloadBtn = el("decade-module-btn", head, "button");
	reloadBtn.textContent = "重载游戏";
	reloadBtn.title = "安装/卸载后需要重载才会生效；对局中重载会丢失本局，请先结束对局";
	armConfirm(reloadBtn, "重载游戏", "确认重载", () => game.reload());
	const closeBtn = el("decade-module-close", head, "button");
	closeBtn.textContent = "×";
	closeBtn.onclick = () => hideModuleManager();

	el("decade-module-summary", dialog).textContent = "正在读取模块状态…";

	const toolbar = el("decade-module-toolbar", dialog);
	const sourceInput = el("decade-module-source", toolbar, "input");
	sourceInput.type = "text";
	// 空输入框不再表示"没配置"：placeholder 直接写明默认语义（§20）
	sourceInput.placeholder = "自定义模块源地址（留空＝使用扩展内置模块源）";
	sourceInput.value = String(lib.config[indexKey()] || "");
	const saveBtn = el("decade-module-btn", toolbar, "button");
	saveBtn.textContent = "保存并刷新";
	saveBtn.onclick = () => {
		game.saveConfig(indexKey(), sourceInput.value.trim());
		notice = { tone: "ok", text: "模块源已保存" };
		refresh();
	};
	const restoreBtn = el("decade-module-btn", toolbar, "button");
	restoreBtn.textContent = "恢复默认模块源";
	// 恢复默认＝清空自定义地址回到内置索引，**不**写回某个带版本号的固定地址——
	// 否则升级扩展后这串 URL 就过期了，又得手工再改一遍（P19 要治的正是这个）。
	restoreBtn.title = "清除自定义模块源地址，改用扩展内置的 modules/module-index.json（随扩展更新）";
	restoreBtn.onclick = () => {
		game.saveConfig(indexKey(), "");
		sourceInput.value = "";
		notice = { tone: "ok", text: "已恢复默认模块源：使用扩展内置 modules/module-index.json" };
		refresh();
	};
	const refreshBtn = el("decade-module-btn", toolbar, "button");
	refreshBtn.textContent = "刷新";
	refreshBtn.onclick = () => refresh();
	el("decade-module-source-note", dialog);

	el("decade-module-list", dialog);
	el("decade-module-notice", dialog);

	overlay.addEventListener("click", event => {
		if (event.target === overlay) hideModuleManager();
	});
	document.body.appendChild(overlay);
	currentOverlay = overlay;
	refresh();
}

/** 打开模块管理窗口 */
export function showModuleManager() {
	createWindow();
}

/** 关闭模块管理窗口（动作进行中时会先取消下载） */
export function hideModuleManager() {
	if (controller) controller.abort();
	if (currentOverlay) {
		currentOverlay.remove();
		currentOverlay = null;
	}
}

/** 接线：公开 API。入口是配置窗口里的「模块管理界面 → 打开」按钮（Stars 不自绘快捷键） */
export function setupModuleManagerWindow() {
	if (window.decadeUI) {
		window.decadeUI.showModuleManager = showModuleManager;
		window.decadeUI.hideModuleManager = hideModuleManager;
	}
}
