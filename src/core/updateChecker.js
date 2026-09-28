/**
 * @fileoverview P11 自动更新的纯逻辑（任务书§48）
 *
 * 只做一件事：拿"本机已装模块 + 远程索引 + 本机 Core 版本"算出**该提示什么**。
 * 不联网、不读文件、不写配置、不下载——这样"本机比索引新""本地版本读不出来""索引里
 * latest 是垃圾"这些边角都能在 Node 里测干净，真机上只剩"提示窗能不能弹、跳转对不对"。
 *
 * 版本比较复用 `manifest.compareVersions`（与安装器§18 的更新判定同一口径，不写第二套）。
 * 判断原则：**读不出来就沉默**——本地版本未知、latest 非法、索引比本机旧，一律不提示。
 * 宁可漏一次提示，也不要把垃圾数据变成一次白下载。
 */
import { compareVersions } from "./manifest.js";

/** 版本号形状：数字段 + 可选预发布后缀（与清单校验的取值范围一致） */
const VERSION_LIKE = /^\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?$/;

/** 版本号能不能拿来比：读不出来就沉默，绝不猜 */
export function isVersionLike(value) {
	return typeof value === "string" && VERSION_LIKE.test(value.trim());
}

/**
 * 归一"已忽略的版本"记录：调用方可能给对象或存进配置的 JSON 字符串，坏数据一律当空。
 * 结构：`{ [模块id]: 被忽略的那个 latest 版本号 }`
 */
export function normalizeIgnored(raw) {
	if (!raw) return {};
	if (typeof raw === "object") return Array.isArray(raw) ? {} : { ...raw };
	try {
		const parsed = JSON.parse(String(raw));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const out = {};
		for (const [id, version] of Object.entries(parsed)) {
			if (typeof version === "string" && version) out[id] = version;
		}
		return out;
	} catch {
		return {};
	}
}

/** 记下"这个模块的这个版本不再提醒"，返回可直接写进配置的 JSON 字符串（纯函数，便于测） */
export function ignoreVersion(ignored, id, version) {
	return JSON.stringify({ ...normalizeIgnored(ignored), [id]: String(version) });
}

/**
 * 把"当前展示的全部更新"一次性记进忽略清单（提示窗上那个按钮的纯逻辑）。
 * Core 只有真的落后才记——否则会把"本机版本"当成被忽略的版本记下来，将来真落后时反而不提。
 */
export function ignoreAll(ignored, result) {
	let next = normalizeIgnored(ignored);
	for (const item of Array.isArray(result?.updates) ? result.updates : []) {
		next = normalizeIgnored(ignoreVersion(next, item.id, item.latest));
	}
	if (result?.core?.behind && result.core.latest) {
		next = normalizeIgnored(ignoreVersion(next, "core", result.core.latest));
	}
	return JSON.stringify(next);
}

/**
 * 算出更新提示的内容。
 * @param {{installed?: Array<{id: string, name?: string, type?: string, version?: string|null}>, index?: Object|null, coreVersion?: string|null, ignored?: Object|string|null}} input
 *   - `installed`：本机已装模块（调用方从注册表拿，core 由 coreVersion 单独表示）
 *   - `index`：module-index.json 的内容
 *   - `coreVersion`：本机扩展本体版本（info.json）
 *   - `ignored`：`{id: latest}` —— 玩家点过"忽略此版本"的模块
 * @returns {{updates: Array<{id: string, name: string, type: string|null, current: string, latest: string}>, ignoredUpdates: Array<Object>, core: {behind: boolean, current: string|null, latest: string|null}>}}
 */
export function checkUpdates({ installed, index, coreVersion, ignored } = {}) {
	const list = Array.isArray(installed) ? installed : [];
	const modules = index && typeof index === "object" && index.modules && typeof index.modules === "object" ? index.modules : {};
	const ignoreMap = normalizeIgnored(ignored);

	const updates = [];
	const ignoredUpdates = [];
	for (const item of list) {
		const id = item?.id;
		if (!id || id === "core") continue;   // core 不是包，落后与否由 core.behind 表达
		const entry = modules[id];
		if (!entry) continue;                 // 索引里没有这个模块：本机自装/第三方，无事可做
		if (!isVersionLike(item.version) || !isVersionLike(entry.latest)) continue;
		if (compareVersions(entry.latest, item.version) <= 0) continue;   // 同版本或本机更新：不提示
		const record = {
			id,
			name: item.name || entry.name || id,
			type: item.type || entry.type || null,
			current: item.version.trim(),
			latest: entry.latest.trim(),
		};
		if (ignoreMap[id] === record.latest) ignoredUpdates.push(record);
		else updates.push(record);
	}
	const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	updates.sort(byId);
	ignoredUpdates.sort(byId);

	// Core：本体即扩展目录，落后时只提示"去更新扩展本体"，绝不在这里替换（用户决定）。
	// 同样尊重"忽略此版本"：忽略的是同一个 latest 才闭嘴，版本一变还要提。
	const localCore = isVersionLike(coreVersion) ? coreVersion.trim() : null;
	const indexCore = index && typeof index === "object" && index.core ? index.core.latest : null;
	const targetCore = isVersionLike(indexCore) ? indexCore.trim() : localCore;
	const core = {
		behind: Boolean(localCore && targetCore && ignoreMap.core !== targetCore && compareVersions(targetCore, localCore) > 0),
		current: localCore,
		latest: targetCore,
	};

	return { updates, ignoredUpdates, core };
}
