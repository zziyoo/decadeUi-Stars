/**
 * @fileoverview 模块索引来源（P19：内置默认模块源）
 *
 * 语义只有一条：`moduleIndexUrl` 配置为空 ⇒ 使用扩展本体内置的 `modules/module-index.json`；
 * 非空 ⇒ 使用用户自定义的远程索引。没有第二份持久化状态——"内置还是远程"不落盘，
 * 每次都从这一个配置键现场判定，因此升级扩展后内置索引随本体自动更新，永不过期。
 *
 * 内置索引的读取边界（不因它是"本体文件"而放宽任何检查）：
 *   - 只读固定路径 `modules/module-index.json`，不接受任何用户传入的路径，不存在 `../`；
 *   - JSON parse 后必须过结构校验：schema===1、modules 对象、core.version、带尾斜杠的 https
 *     releaseBase（构建期必然写入，缺一项即索引已损坏），否则按 STRUCTURE_INVALID 拒绝；
 *   - 返回的 indexUrl 取索引自带的 `releaseBase`（构建期写入的 Release 资产目录），
 *     裸文件名仍由安装器唯一的 `resolveModuleUrl` 解析、仍过 http(s) 校验——
 *     本模块不碰下载，不碰文件系统，不引入第二套 URL 配置。
 *
 * 远程索引照旧走 `installer.fetchIndex`（PackageInstaller 不感知"来源是哪类"，
 * 只接收 index / indexUrl，见任务书边界：source state 只此一处）。
 */
import { INSTALL_CODES } from "./packageInstaller.js";

/** 内置索引在扩展根下的固定位置（构建期由 build-release.mjs 生成，与 Release 资产同源） */
export const BUILT_IN_INDEX_PATH = "modules/module-index.json";

/**
 * 判定模块索引来源（纯函数，Node 可测）。
 * @param {string} raw - `extension_<扩展名>_moduleIndexUrl` 的原始配置值
 * @returns {{kind: "builtin"|"remote", url: string}} kind=builtin 时 url 恒为空串
 */
export function resolveIndexSource(raw) {
	const url = String(raw ?? "").trim();
	return url ? { kind: "remote", url } : { kind: "builtin", url: "" };
}

/**
 * 读取内置索引。只许 fetch 固定路径：基准是扩展根（`window.decadeUIPath`），
 * 按当前页面基址解析成可读地址（decadeUIPath 可能是相对形态，不能交给对说明符严格的 API）。
 * @param {{basePath?: string, fetchImpl?: Function}} [deps] - 测试注入用
 * @returns {Promise<{ok: boolean, code?: string, message?: string, index?: Object, indexUrl?: string}>}
 *   ok 时 indexUrl = 索引内的 releaseBase（结构校验已保证它是带尾斜杠的 https 地址，可直接作下载基址）
 */
export async function loadBuiltInIndex({ basePath = (typeof window !== "undefined" && window.decadeUIPath) || "", fetchImpl = globalThis.fetch } = {}) {
	if (typeof fetchImpl !== "function") {
		return { ok: false, code: INSTALL_CODES.IO_FAILED, message: "当前环境无 fetch，读取内置模块索引不可用" };
	}
	const rel = `${basePath}${BUILT_IN_INDEX_PATH}`;
	let target = rel;
	try {
		target = new URL(rel, document.baseURI || location.href).href;
	} catch {
		// 基址不可解析时交给 fetch 自己报错，不在这一步伪造失败
	}
	let text;
	try {
		const res = await fetchImpl(target);
		if (!res.ok) {
			return { ok: false, code: INSTALL_CODES.IO_FAILED, message: `读取 ${BUILT_IN_INDEX_PATH} 失败（HTTP ${res.status}）` };
		}
		text = await res.text();
	} catch (error) {
		return { ok: false, code: INSTALL_CODES.IO_FAILED, message: `读取 ${BUILT_IN_INDEX_PATH} 失败：${error?.message ?? error}` };
	}
	let index;
	try {
		index = JSON.parse(text);
	} catch (error) {
		return { ok: false, code: INSTALL_CODES.STRUCTURE_INVALID, message: `内置索引 JSON 解析失败: ${error.message}` };
	}
	const invalid = message => ({ ok: false, code: INSTALL_CODES.STRUCTURE_INVALID, message: `内置索引结构不合法：${message}` });
	if (!index || typeof index !== "object" || Array.isArray(index)) return invalid("根必须是对象");
	if (index.schema !== 1) return invalid(`schema 必须为 1（实际 ${JSON.stringify(index.schema ?? null)}）`);
	if (!index.modules || typeof index.modules !== "object" || Array.isArray(index.modules)) return invalid("缺少 modules 对象");
	// 构建期必然写入 core.version 与 releaseBase（build-release 有同名硬校验），缺失即索引已损坏
	if (!index.core || typeof index.core !== "object" || Array.isArray(index.core) || !index.core.version) return invalid("缺少 core.version");
	if (typeof index.releaseBase !== "string" || !/^https:\/\/.+\/$/.test(index.releaseBase)) {
		return invalid(`releaseBase 必须是以 / 结尾的 https 绝对地址（实际 ${JSON.stringify(index.releaseBase ?? null)}）`);
	}
	return { ok: true, index, indexUrl: index.releaseBase };
}

/**
 * 按配置选择来源并加载模块索引（模块管理窗口与启动更新检查共用这一条路）。
 * @param {{rawUrl?: string, installer?: Object|null, fetchOpts?: Object, basePath?: string, fetchImpl?: Function}} [deps]
 *   - `fetchOpts` 原样透传给远程 fetchIndex（timeoutMs / retries…），内置读取不联网、忽略它
 * @returns {Promise<{ok: boolean, kind: "builtin"|"remote", index?: Object, indexUrl?: string, code?: string, message?: string}>}
 */
export async function loadModuleIndex({ rawUrl, installer = null, fetchOpts = {}, basePath, fetchImpl } = {}) {
	const source = resolveIndexSource(rawUrl);
	if (source.kind === "remote") {
		if (typeof installer?.fetchIndex !== "function") {
			return { ok: false, kind: "remote", code: INSTALL_CODES.NO_IO, message: "安装器不可用，无法读取自定义模块源" };
		}
		const res = await installer.fetchIndex(source.url, fetchOpts);
		return res.ok
			? { ok: true, kind: "remote", index: res.index, indexUrl: res.indexUrl || source.url }
			: { ...res, kind: "remote" };
	}
	const res = await loadBuiltInIndex({ basePath, fetchImpl });
	return res.ok
		? { ok: true, kind: "builtin", index: res.index, indexUrl: res.indexUrl }
		: { ...res, kind: "builtin" };
}
