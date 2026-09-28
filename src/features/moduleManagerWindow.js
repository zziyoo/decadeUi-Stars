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
 *   - Feature 的启用/禁用只写它声明的 switchKey 配置键（与外观页同一个开关，不另立状态源）；
 *     装载发生在 content 初始化，所以改完必须重载才生效（任务书§16）。
 */
import { lib, game } from "noname";
import { buildRows, resultText } from "../core/moduleAdmin.js";

const STYLE_ID = "decade-module-manager-styles";
const UNINSTALL_ARM_MS = 4000;

let currentOverlay = null;
let busy = false;
let controller = null;
let notice = null;

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
	const missing = [available.missingIo ? "文件系统端口" : null, available.missingExtractor ? "解压端口" : null].filter(Boolean);
	const installBlocker = available.available ? null : `本平台不支持安装/卸载（缺少：${missing.join("、") || "未知能力"}）`;

	// 提示行可能同时有"台账读取失败"与"模块源状态"两条，不能互相覆盖
	const notes = [];
	if (installBlocker) notes.push(`${installBlocker}；列表仍可浏览，内置功能的启用/禁用仍可用`);
	const installedResult = await installer.readInstalled();
	const ledger = installedResult.ok ? installedResult.data.modules || {} : {};
	if (!installedResult.ok) notes.push(`读取安装台账失败：${resultText(installedResult)}`);

	const sourceUrl = String(lib.config[indexKey()] || "").trim();
	let index = null;
	if (sourceUrl) {
		const fetchResult = await installer.fetchIndex(sourceUrl, { timeoutMs: 10000 });
		if (fetchResult.ok) {
			index = fetchResult.index;
			notes.push(`模块源已连接（索引 schema ${index?.schema ?? "?"}）`);
		} else {
			notes.push(`模块源不可用：${resultText(fetchResult)}`);
		}
	} else {
		notes.push("未配置模块源：可安装/可更新不可用（P10 产出索引后填写地址）");
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
	});
	summaryBox.textContent = `共 ${summary.total} 个模块 · 已独立安装 ${summary.installed} · 可更新 ${summary.updatable} · 可安装 ${summary.installable}${
		installBlocker ? " · 本平台不支持安装/卸载" : available.atomicRename ? "" : " · 本平台发布非原子（中断后请重做一次）"
	}`;
	renderRows(listBox, rows);
	noticeBox.textContent = notice?.text || "";
	noticeBox.className = `decade-module-notice${notice ? ` is-${notice.tone}` : ""}`;
}

function badgeTone(statusKind) {
	if (statusKind === "in_use") return "is-ok";
	if (statusKind === "update_available") return "is-warn";
	if (statusKind === "incompatible" || statusKind === "dep_missing") return "is-error";
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
			result = await installer.install(action.spec, { onProgress, signal: controller.signal });
		} else if (action.kind === "update") {
			result = await installer.update(row.id, { spec: action.spec, onProgress, signal: controller.signal });
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
	sourceInput.placeholder = "模块源地址（module-index.json 的 https URL）";
	sourceInput.value = String(lib.config[indexKey()] || "");
	const saveBtn = el("decade-module-btn", toolbar, "button");
	saveBtn.textContent = "保存并刷新";
	saveBtn.onclick = () => {
		game.saveConfig(indexKey(), sourceInput.value.trim());
		notice = { tone: "ok", text: "模块源已保存" };
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

/** 接线：公开 API + 快捷键（Ctrl+Shift+M），与配置窗口（Ctrl+Shift+C）同风格 */
export function setupModuleManagerWindow() {
	if (window.decadeUI) {
		window.decadeUI.showModuleManager = showModuleManager;
		window.decadeUI.hideModuleManager = hideModuleManager;
	}
	document.addEventListener("keydown", event => {
		if (event.ctrlKey && event.shiftKey && String(event.key).toLowerCase() === "m") {
			event.preventDefault();
			showModuleManager();
		}
	});
}
