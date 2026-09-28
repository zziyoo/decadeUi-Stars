/**
 * @fileoverview P11 启动时的模块更新提示（任务书§48）
 *
 * 流程：content 阶段之后异步查一次 → 有更新才弹一个可关闭的小窗 → 玩家点"打开模块管理"
 * 去逐项更新（窗口里的更新/进度/取消都是现成的），或点"忽略此版本"记住这次不再提。
 *
 * 三条设计取向（2026-09-28 用户决定）：
 *   - Core 落后只**提示**去更新扩展本体，绝不在这里下载替换（本体就是正在运行的扩展目录）；
 *   - 检查放在启动后异步做，超时/离线/未配置一律**静默返回**，不阻塞进游戏、不写任何状态；
 *   - 每版只提醒一次：忽略记的是"这个 latest 版本号"，版本一变还会再提。
 */
import { lib, game } from "noname";
import { checkUpdates, ignoreAll } from "../core/updateChecker.js";
import { getModuleSystem } from "../core/moduleSystem.js";
import { showModuleManager } from "./moduleManagerWindow.js";

/** 扩展名（与 moduleIo 的 extRoot() 同一兜底：Node 测试里没有注入全局时也能算出确定的键） */
const extName = () => (typeof decadeUIName === "string" && decadeUIName) || "十周年UI-Stars";
/** 与 moduleManagerWindow 的 indexKey() 同一把键（索引地址只此一处配置） */
const indexKey = () => `extension_${extName()}_moduleIndexUrl`;
const autoKey = () => `extension_${extName()}_autoCheckUpdate`;
const ignoredKey = () => `extension_${extName()}_ignoredUpdates`;
/** 配置键（测试与外部接线用同一处定义，别在多处硬编码字符串） */
export const updateConfigKeys = { index: indexKey, auto: autoKey, ignored: ignoredKey };
/** 本体更新入口：本仓库的 Release 页（Core 无包形态，只能整包替换） */
const CORE_UPDATE_URL = "https://github.com/zziyoo/decadeUi-Stars/releases/latest";
const CHECK_TIMEOUT_MS = 5000;
const SHOW_DELAY_MS = 1500;

/** 启动时到底查不查：默认查，只有玩家明确关掉才不查 */
export function shouldAutoCheck(config = lib.config) {
	return config?.[autoKey()] !== false;
}

/** 本机已装模块（注册表视角：id/name/version/type） */
function collectInstalled(api) {
	const manager = api?.moduleManager;
	if (!manager?.list) return [];
	return manager.list().map(item => ({ id: item.id, name: item.name, type: item.type, version: item.version }));
}

/**
 * 查一次更新。任何失败都返回 null（启动期第一要务是别把游戏弄卡）：未配置模块源、离线、
 * 索引坏掉、超时——一律安静收场，绝不抛错、绝不写状态。
 * @param {{api?: Object, config?: Object, timeoutMs?: number}} [deps] - 测试注入用
 * @returns {Promise<null|{updates: Array, ignoredUpdates: Array, core: Object, indexUrl: string}>}
 */
export async function checkForUpdates({ api = getModuleSystem(), config = lib.config, timeoutMs = CHECK_TIMEOUT_MS } = {}) {
	const url = String(config?.[indexKey()] || "").trim();
	if (!url || typeof api?.packageInstaller?.fetchIndex !== "function") return null;

	const fetched = await api.packageInstaller.fetchIndex(url, { timeoutMs, retries: 1 }).catch(() => null);
	if (!fetched?.ok) return null;

	const result = checkUpdates({
		installed: collectInstalled(api),
		index: fetched.index,
		coreVersion: lib.extensionPack?.[decadeUIName]?.version || null,
		ignored: config?.[ignoredKey()],
	});
	if (!result.updates.length && !result.core.behind) return null;
	return { ...result, indexUrl: fetched.indexUrl || url };
}

/** 载入提示窗样式（只挂一次，与 welcomeDialog 同一手法） */
function loadStyles() {
	if (document.getElementById("decade-update-styles")) return;
	const link = document.createElement("link");
	link.id = "decade-update-styles";
	link.rel = "stylesheet";
	link.href = `${decadeUIPath}src/features/updateNotice.css`;
	document.head.appendChild(link);
}

const el = (className, parent, tagName = "div") => {
	const node = document.createElement(tagName);
	node.className = className;
	if (parent) parent.appendChild(node);
	return node;
};

/** 画出提示窗。返回移除函数（测试与"关闭"都用同一个出口） */
export function createUpdateNotice(data, repairs = []) {
	loadStyles();
	// 同一时刻只留一个（重复触发时先清掉旧的）
	document.querySelector(".decade-update-overlay")?.remove();

	const list0 = Array.isArray(repairs) ? repairs.filter(Boolean) : [];
	const hasUpdates = Boolean(data?.updates?.length || data?.core?.behind);
	const overlay = el("decade-update-overlay", document.body);
	const close = () => overlay.remove();

	const dialog = el("decade-update-dialog", overlay);
	const head = el("decade-update-head", dialog);
	el("decade-update-title", head).textContent = hasUpdates
		? (list0.length ? "模块更新与自动修复" : "发现可更新的模块")
		: "已自动修复模块";
	const closeBtn = el("decade-update-close", head, "button");
	closeBtn.textContent = "×";
	closeBtn.addEventListener("click", close);

	const list = el("decade-update-list", dialog);
	// P12：启动时的自动修复（回退成功 / 需要重装）
	for (const note of list0) {
		const row = el("decade-update-repair", list);
		el("decade-update-row-name", row).textContent = note.kind === "restored"
			? `${note.id}：${note.from} → ${note.to}`
			: `${note.id}：需要重装`;
		el("decade-update-core-note", row).textContent = note.message || "";
	}
	if (data?.core?.behind) {
		const core = el("decade-update-core", list);
		el("decade-update-row-name", core).textContent = `扩展本体 ${data.core.current} → ${data.core.latest}`;
		el("decade-update-core-note", core).textContent = "本体更新需要下载整包替换扩展目录（不会自动替换）：";
		const link = el("decade-update-btn", core, "a");
		link.textContent = "打开发布页";
		link.href = CORE_UPDATE_URL;
		link.target = "_blank";
		link.rel = "noopener";
	}
	for (const item of data?.updates || []) {
		const row = el("decade-update-row", list);
		el("decade-update-row-name", row).textContent = item.name || item.id;
		el("decade-update-row-version", row).textContent = `${item.current} → ${item.latest}`;
	}

	const actions = el("decade-update-actions", dialog);
	const openBtn = el("decade-update-btn is-primary", actions, "button");
	openBtn.textContent = "打开模块管理";
	openBtn.addEventListener("click", () => {
		close();
		showModuleManager();
	});
	if (hasUpdates) {
		const ignoreBtn = el("decade-update-btn", actions, "button");
		ignoreBtn.textContent = "忽略此版本";
		ignoreBtn.addEventListener("click", () => {
			// 记的是"这次展示的版本号"：版本一变还会再提（用户决定：每版一次）
			game.saveConfig(ignoredKey(), ignoreAll(lib.config?.[ignoredKey()], data));
			close();
		});
	}
	const laterBtn = el("decade-update-btn", actions, "button");
	laterBtn.textContent = hasUpdates ? "稍后" : "知道了";
	laterBtn.addEventListener("click", close);

	return close;
}

/**
 * 与"欢迎窗口"错开。两个都是启动弹窗，而欢迎窗层级更高（`z-index` 99999 vs 99998），
 * 同时弹会把更新提示整个压在下面——真机上就是这么撞的（看到的是欢迎窗的更新日志，
 * 里面恰好也有"欢乐三国杀"字样，于是以为更新提示少了按钮）。
 * 等欢迎窗关掉再弹；一直不关（玩家在看日志）就放弃这一次，绝不叠两个弹窗。
 * @returns {Promise<boolean>} true=可以弹；false=这次算了（下次启动还会查）
 */
export function waitForWelcome({ hasWelcome = () => Boolean(document.querySelector(".decade-welcome-overlay")), intervalMs = 1000, maxTries = 30 } = {}) {
	return new Promise(resolve => {
		let checked = 0;
		const tick = () => {
			if (checked >= maxTries) return resolve(false);
			checked++;
			if (!hasWelcome()) return resolve(true);
			setTimeout(tick, intervalMs);
		};
		tick();
	});
}

/**
 * 接线：content 阶段调用。
 * @param {{repairs?: Array}} [options] - P12 启动期自动修复的记录（moduleSystem.takeRepairNotes()）
 * 有修复记录时**即使关掉了"启动检查更新"也要弹**——回退已经发生了，玩家有权知道。
 */
export function setupUpdateNotice({ repairs = [] } = {}) {
	const notes = Array.isArray(repairs) ? repairs.filter(Boolean) : [];
	setTimeout(() => {
		const show = async data => {
			if (!data && !notes.length) return;
			if (!(await waitForWelcome())) return;   // 欢迎窗一直开着：这次不打扰
			createUpdateNotice(data, notes);
		};
		const probing = shouldAutoCheck() ? checkForUpdates() : Promise.resolve(null);
		probing.then(show).catch(() => show(null));
	}, SHOW_DELAY_MS);
}
