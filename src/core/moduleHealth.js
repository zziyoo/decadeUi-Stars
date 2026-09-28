/**
 * @fileoverview P12 模块健康判据与修复计划（任务书§49）
 *
 * 纯逻辑：探测结果由调用方（packageInstaller，走真实文件系统/网络）喂进来，这里只回答两个问题：
 *   1. 这个已安装的模块**坏了吗**（`assessModule`）；
 *   2. 坏了的话**怎么修**（`planRepair`：能回退就回退，回退目标不健康就重装）。
 *
 * 判据是结构级四项（用户决定 2026-09-28）：
 *   - 包目录不存在；
 *   - `manifest.json` 缺失，或存在但解析失败；
 *   - `manifest.id` / `manifest.version` 与台账不符；
 *   - 清单声明的 `entry.js` / `entry.css` 文件在盘上不存在。
 *
 * 两条刻意的边界：
 *   - **IO 错误不算损坏**：调用方必须把"读盘失败"与"文件不存在"分开（沿用 P5 的"IO 异常 ≠ 不存在"），
 *     一次读盘抖动不许把好包判死——这也是本模块只吃"探测结果"而不自己碰 IO 的原因。
 *   - **不许把坏的换上来**：回退目标自己也得过同一套判据（目录在、清单在且对得上、入口文件在）。
 */

/**
 * 单个版本目录的健康判据。
 * @param {Object} input
 * @param {string} input.id - 台账里的模块 id
 * @param {string} input.version - 要检查的版本（台账当前版本，或回退目标版本）
 * @param {boolean} input.dirExists - 包目录是否存在
 * @param {boolean} [input.manifestExists] - manifest.json 是否存在（目录不存在时忽略）
 * @param {boolean} [input.manifestParsed] - manifest.json 能否解析为对象
 * @param {{id?: string, version?: string}|null} [input.manifest] - 解析后的清单
 * @param {string[]} [input.missingEntries] - 清单声明但盘上不存在的入口文件（相对包根）
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function assessModule({ id, version, dirExists, manifestExists, manifestParsed, manifest, missingEntries } = {}) {
	const reasons = [];
	if (!dirExists) {
		reasons.push(`包目录不存在：modules/${id}/${version}`);
		return { ok: false, reasons };
	}
	if (!manifestExists) {
		reasons.push("manifest.json 缺失");
	} else if (!manifestParsed) {
		reasons.push("manifest.json 解析失败");
	} else if (manifest && typeof manifest === "object") {
		if (manifest.id && String(manifest.id) !== String(id)) reasons.push(`manifest.id=${manifest.id} 与台账 ${id} 不符`);
		if (manifest.version && String(manifest.version) !== String(version)) reasons.push(`manifest.version=${manifest.version} 与台账 ${version} 不符`);
	}
	const missing = Array.isArray(missingEntries) ? missingEntries.filter(Boolean) : [];
	if (missing.length) reasons.push(`清单声明的入口文件缺失：${missing.join("、")}`);
	return { ok: reasons.length === 0, reasons };
}

/**
 * 要不要修、怎么修。
 * @param {Object} input
 * @param {string} input.id
 * @param {string} input.version - 台账当前版本
 * @param {string|null} [input.previousVersion] - 台账记的上一版
 * @param {Object} input.probe - 当前版本的探测结果（见 assessModule 入参）
 * @param {Object} [input.previousProbe] - 上一版的探测结果（没有上一版目录时可省）
 * @returns {{status: "ok"|"corrupt", reasons: string[], action: null|{kind: "restore"|"reinstall", version?: string}}}
 */
export function planRepair({ id, version, previousVersion, probe, previousProbe } = {}) {
	const current = assessModule({ id, version, ...probe });
	if (current.ok) return { status: "ok", reasons: [], action: null };

	if (previousVersion) {
		const previous = assessModule({ id, version: previousVersion, ...(previousProbe || { dirExists: false }) });
		if (previous.ok) {
			return { status: "corrupt", reasons: current.reasons, action: { kind: "restore", version: previousVersion } };
		}
		return {
			status: "corrupt",
			reasons: [...current.reasons, `上一版 ${previousVersion} 也不可用：${previous.reasons.join("；")}`],
			action: { kind: "reinstall" },
		};
	}

	return { status: "corrupt", reasons: [...current.reasons, "没有记录上一版本"], action: { kind: "reinstall" } };
}
