/**
 * 分包磁盘版本解析（测试/校验工具共用）
 *
 * 背景：Core（info.json）与七个分包（modules/<id>/<version>/）是**独立版本管理**的——
 * Core 升到 1.5.1 时分包可以仍是 1.5.0，运行时按 modules/installed.json 的台账版本
 * 寻址（moduleSystem.registerInstalledModules → modules/<id>/<台账版本>/），
 * builtIn 登记只是启动期的单体兼容回落，会被已装清单覆盖。
 * 此前一批测试用 info.json.version 拼分包磁盘路径，Core 一 bump 就去找不存在的
 * modules/<id>/<新版本>/（v1.5.1 CI 六连红的根因）。这里把正确的解析次序固化成
 * 唯一入口，测试不得再各自读 info.json：
 *
 *   1. modules/installed.json 的 modules[id].version（安装台账，与运行时寻址同源）；
 *   2. 台账没登记时，扫 modules/<id>/ 下形如语义化版本且含 manifest.json 的目录，
 *      取最高版（盘上有包、台账还没写的过渡态，如刚执行完搬迁脚本）；
 *   3. 都没有 → 返回 null（调用方按"该模块没有磁盘分包"处理，典型是门控型
 *      Feature：pack:false，本来就没有包目录）。
 *
 * 注意：本文件只认"盘上真实存在的分包"，绝不回落 info.json.version——那正是
 * 要修掉的耦合。要拿 Core 自己的版本（模拟启动期 builtIn 登记、断言索引 core
 * 字段等场景）用 coreVersion()，两个概念不要混。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions } from "../../src/core/manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const VERSION_DIR_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** 读取 modules/installed.json（缺文件/坏 JSON 时返回 null，不抛错） */
function readInstalled() {
	try {
		const parsed = JSON.parse(fs.readFileSync(path.join(ROOT, "modules", "installed.json"), "utf8"));
		return parsed?.modules && typeof parsed.modules === "object" ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * 解析某模块当前盘上分包的版本
 * @param {string} id - 模块 id（如 "decade"、"card-skin"）
 * @returns {string|null} 分包版本；没有磁盘分包时为 null
 */
export function packVersion(id) {
	const registered = readInstalled()?.modules[id]?.version;
	if (registered && fs.existsSync(path.join(ROOT, "modules", id, registered, "manifest.json"))) {
		return registered;
	}
	const dir = path.join(ROOT, "modules", id);
	if (!fs.existsSync(dir)) return null;
	const versions = fs
		.readdirSync(dir)
		.filter(name => VERSION_DIR_PATTERN.test(name) && fs.existsSync(path.join(dir, name, "manifest.json")));
	return versions.length ? versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best)) : null;
}

/**
 * Core（扩展本体）版本——只该用于模拟运行时启动登记（registerBuiltInModules
 * 收到的就是 info.json 版本）或核对索引 core 字段；分包路径一律走 packVersion()。
 * @returns {string}
 */
export function coreVersion() {
	return JSON.parse(fs.readFileSync(path.join(ROOT, "info.json"), "utf8")).version;
}
