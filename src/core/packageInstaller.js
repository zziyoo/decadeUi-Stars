/**
 * @fileoverview 包安装器（P5 正式实现，任务书§17/§18/§19/§42）
 *
 * 标准安装流程（任务书§17）：
 *   解析依赖 → HTTP下载(重试/取消/进度) → 临时目录落地 → 用**外部期望摘要**校验落盘内容 →
 *   解压 → 包内 Manifest 的 id/version 必须与外部安装目标一致 → 结构与 Core 检查 →
 *   发布到 modules/<id>/<version>/ → 更新 modules/installed.json → 注册模块（source="installed"）
 *
 * 信任来源（P5 审查后收紧）：只有调用方/索引给出的 expectedId / expectedVersion /
 * expectedSha256 是判据；包内 manifest.sha256 属自述，最多产生 warning，不参与裁决。
 * 缺 expectedSha256 时允许本地/开发安装，但结果与台账都显式标记 hashVerified:false。
 *
 * 失败保护（任务书§17末/§20）：
 *   - 任何一步失败都不得破坏当前可用版本：先写临时目录，最后一步才 move 到位；
 *     覆盖同版本时旧目录先改名让位，**保留到 installed.json 写成功之后**才清理，
 *     中途失败一律把让位目录改回；回滚本身失败 → code=ROLLBACK_FAILED（不假装成功）。
 *   - 卸载同样先让位（.removing-*）再改台账，台账写失败则原样改回。
 *   - IO 端口（moduleIo）保证不会永久 pending：真实 error callback 优先，
 *     本体"既不成功也不失败地回调"那一类才由 IO_STALL 兜底判失败。
 *   - 全部方法返回结构化结果 {ok, code, ...}，不向外抛异常。
 *
 * 本模块**不依赖 noname 运行时**：文件系统与解压能力由调用方（moduleSystem）注入端口，
 * 因此在 Node 中可用假 io/transport 全量测试（tests/p5-installer.test.mjs）。
 */
import { validateManifest, normalizeManifest, checkCoreRequirement } from "./manifest.js";
import { downloadBuffer, sha256Hex, DownloadError } from "./downloader.js";

/** 安装器结果码（P6 管理界面按 code 出文案，任务书§6） */
export const INSTALL_CODES = {
	NO_IO: "NO_IO",
	NO_EXTRACTOR: "NO_EXTRACTOR",
	INVALID_SPEC: "INVALID_SPEC",
	DEP_MISSING: "DEP_MISSING",
	DEP_CYCLE: "DEP_CYCLE",
	DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
	CANCELLED: "CANCELLED",
	SHA_MISMATCH: "SHA_MISMATCH",
	STRUCTURE_INVALID: "STRUCTURE_INVALID",
	MANIFEST_INVALID: "MANIFEST_INVALID",
	ID_MISMATCH: "ID_MISMATCH",
	VERSION_MISMATCH: "VERSION_MISMATCH",
	CORE_INCOMPATIBLE: "CORE_INCOMPATIBLE",
	ENTRY_MISSING: "ENTRY_MISSING",
	ALREADY_INSTALLED: "ALREADY_INSTALLED",
	PUBLISH_FAILED: "PUBLISH_FAILED",
	ROLLBACK_FAILED: "ROLLBACK_FAILED",
	STATE_FAILED: "STATE_FAILED",
	INSTALLED_CORRUPT: "INSTALLED_CORRUPT",
	NOT_INSTALLED: "NOT_INSTALLED",
	NOT_INDEPENDENT: "NOT_INDEPENDENT",
	IN_USE: "IN_USE",
	DEPENDED: "DEPENDED",
	UNINSTALL_FAILED: "UNINSTALL_FAILED",
	IO_FAILED: "IO_FAILED",
	IO_STALL: "IO_STALL",
	UNEXPECTED: "UNEXPECTED",
};

/** 包目录/文件位置（全部为扩展根相对 POSIX 路径） */
const DEFAULTS = {
	modulesRoot: "modules",
	installedFile: "modules/installed.json",
	tempRoot: "tmp/modules",
};

const defaultRandom = () => Math.random().toString(36).slice(2, 8);
const asArray = value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/**
 * 归一化外部安装目标（任务书§17 的"读取 Manifest"= 读外部索引条目，不是读包内自述）。
 * expected* 为正式字段；id/version/sha256 是等值别名，同样只能由调用方（外部）提供。
 * @param {Object} raw - {expectedId|id, expectedVersion|version, url, expectedSha256|sha256, dependencies}
 */
export function externalTarget(raw) {
	return {
		id: raw?.expectedId ?? raw?.id,
		version: raw?.expectedVersion ?? raw?.version,
		url: raw?.url,
		sha256: raw?.expectedSha256 ?? raw?.sha256 ?? "",
		dependencies: asArray(raw?.dependencies),
	};
}

/**
 * 创建包安装器
 * @param {Object} [deps]
 * @param {Object} [deps.registry] - 模块注册表（unregister 用于版本切换）
 * @param {Object} [deps.moduleManager] - 模块管理器（register / getInstallState）
 * @param {Object} [deps.io] - 文件系统端口（createNonameIo 或测试替身）
 * @param {(buffer: ArrayBuffer, targetRelDir: string, onEntry?: Function) => Promise<string[]>} [deps.extractZip]
 * @param {Function} [deps.download] - 传输端口（downloader.downloadBuffer）
 * @param {(data: Uint8Array) => Promise<string>} [deps.hash]
 * @param {() => string|null} [deps.getCoreVersion] - 当前 Core（扩展本体）版本
 * @param {(id: string) => boolean} [deps.isInUse] - 模块是否正在使用（卸载前置检查，任务书§19）
 * @param {() => string} [deps.random]
 * @param {() => number} [deps.now]
 * @returns {Object} packageInstaller
 */
export function createPackageInstaller(deps = {}) {
	const {
		registry = null,
		moduleManager = null,
		io = null,
		extractZip = null,
		download = downloadBuffer,
		hash = sha256Hex,
		getCoreVersion = () => null,
		isInUse = () => false,
		random = defaultRandom,
		now = () => Date.now(),
		...rest
	} = deps;
	const paths = { ...DEFAULTS, ...rest };

	const packDir = (id, version) => `${paths.modulesRoot}/${id}/${version}`;
	const emit = (opts, info) => {
		if (typeof opts.onProgress === "function") {
			try {
				opts.onProgress(info);
			} catch (error) {
				console.warn("[PackageInstaller] onProgress 异常已忽略", error);
			}
		}
	};

	/** 统一成功结构 */
	const success = extra => ({ ok: true, code: "OK", warnings: [], ...extra });
	/** 统一失败结构（stage 便于定位断在哪一步） */
	const failure = (code, message, extra = {}) => ({ ok: false, code, message, warnings: [], ...extra });

	/** 把下载器异常映射为安装器结果（保留 cause 供 UI 显示） */
	function toDownloadFailure(error) {
		if (error instanceof DownloadError) {
			if (error.code === "CANCELLED") return failure(INSTALL_CODES.CANCELLED, error.message, { stage: "downloading" });
			return failure(INSTALL_CODES.DOWNLOAD_FAILED, error.message, {
				stage: "downloading",
				cause: error.code,
				status: error.status,
				attempts: error.attempts,
			});
		}
		return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "downloading" });
	}

	// ---------------------------------------------------------------- 已安装状态

	/**
	 * 读取 modules/installed.json（P3/P5 注册与模块根解析的数据源）
	 * @returns {Promise<{ok: boolean, data?: Object, code?: string, message?: string}>}
	 */
	async function readInstalled() {
		if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
		let text;
		try {
			text = await io.readText(paths.installedFile);
		} catch (error) {
			return failure(INSTALL_CODES.IO_FAILED, `读取 ${paths.installedFile} 失败: ${error?.message ?? error}`);
		}
		if (!text) return success({ data: { schema: 1, modules: {} } });
		try {
			const data = JSON.parse(text);
			if (!data || typeof data !== "object") throw new Error("非对象");
			data.modules = data.modules && typeof data.modules === "object" ? data.modules : {};
			return success({ data });
		} catch (error) {
			return failure(INSTALL_CODES.INSTALLED_CORRUPT, `${paths.installedFile} 无法解析（${error.message}），已拒绝改写以免丢失安装记录`);
		}
	}

	/** 写入 installed.json：先写临时文件再改名覆盖，避免半截状态（.tmp 已被 .gitignore 覆盖） */
	async function writeInstalled(data) {
		const tmp = `${paths.installedFile}.${random()}.tmp`;
		await io.writeText(tmp, `${JSON.stringify(data, null, "\t")}\n`);
		await io.movePath(tmp, paths.installedFile);
	}

	// ---------------------------------------------------------------- 规格与依赖

	/**
	 * 校验安装规格（module-index 条目或手工传入）
	 * @param {Object} spec - {id, url, version?, sha256?, size?, dependencies?}
	 */
	function checkSpec(spec) {
		if (!spec || typeof spec !== "object") return failure(INSTALL_CODES.INVALID_SPEC, "缺少安装规格");
		if (typeof spec.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(spec.id)) {
			return failure(INSTALL_CODES.INVALID_SPEC, `模块ID非法: ${spec.id}（任务书§7）`);
		}
		if (typeof spec.url !== "string" || !/^https?:\/\//.test(spec.url)) {
			return failure(INSTALL_CODES.INVALID_SPEC, `${spec.id} 缺少合法下载地址`);
		}
		if (spec.version !== undefined && typeof spec.version !== "string") {
			return failure(INSTALL_CODES.INVALID_SPEC, `${spec.id} version 必须为字符串`);
		}
		return success({});
	}

	/** 从 module-index.json 取某模块的安装规格（任务书§10） */
	function specFromIndex(index, id) {
		const entry = index?.modules?.[id];
		if (!entry) return null;
		const version = entry.latest || entry.version;
		return {
			id,
			url: entry.url,
			// expected* = 外部信任输入（索引/调用方提供），不与包内自述混用
			expectedVersion: version,
			expectedSha256: entry.sha256 || "",
			size: entry.size || 0,
			dependencies: asArray(entry.dependencies),
			core: entry.core,
		};
	}

	/**
	 * 依赖解析（任务书§11）：缺失→先装；循环→DEP_CYCLE；无索引可装→DEP_MISSING
	 * @returns {Promise<{ok: boolean, installed?: string[], failure?: Object}>}
	 */
	async function ensureDependencies(dependencies, opts, chain) {
		const installedDeps = [];
		for (const depId of dependencies) {
			if (chain.has(depId)) {
				return { ok: false, failure: failure(INSTALL_CODES.DEP_CYCLE, `依赖循环: ${[...chain, depId].join(" -> ")}`, { stage: "dependencies" }) };
			}
			if (moduleManager?.isInstalled?.(depId)) continue;
			const spec = opts.index ? specFromIndex(opts.index, depId) : null;
			if (!spec || !spec.url) {
				return {
					ok: false,
					failure: failure(INSTALL_CODES.DEP_MISSING, `缺少依赖 ${depId}，且索引中无可下载地址`, { stage: "dependencies", dependency: depId }),
				};
			}
			const nextChain = new Set(chain);
			nextChain.add(depId);
			const result = await installInner(spec, opts, nextChain);
			if (!result.ok) return { ok: false, failure: result };
			installedDeps.push(`${result.id}@${result.version}`);
		}
		return { ok: true, installed: installedDeps };
	}

	// ---------------------------------------------------------------- 结构校验

	/** 校验临时目录内的包结构（任务书§17/§24）：包内自述必须与**外部安装目标**一致 */
	async function verifyPackageDir(dir, target) {
		let manifestText;
		try {
			manifestText = await io.readText(`${dir}/manifest.json`);
		} catch (error) {
			return toIoFailure(error, "verifying", { message: `读取包内 manifest.json 失败: ${error?.message ?? error}` });
		}
		if (!manifestText) {
			return failure(INSTALL_CODES.STRUCTURE_INVALID, "包内缺少 manifest.json", { stage: "verifying" });
		}
		let raw;
		try {
			raw = JSON.parse(manifestText);
		} catch (error) {
			return failure(INSTALL_CODES.STRUCTURE_INVALID, `manifest.json 解析失败: ${error.message}`, { stage: "verifying" });
		}
		const check = validateManifest(raw);
		if (!check.ok) {
			return failure(INSTALL_CODES.MANIFEST_INVALID, `manifest 校验失败: ${check.errors.join("; ")}`, { stage: "verifying", errors: check.errors });
		}
		if (raw.id !== target.id) {
			return failure(INSTALL_CODES.ID_MISMATCH, `包内 manifest.id(${raw.id}) 与外部安装目标 expectedId(${target.id}) 不一致`, { stage: "verifying" });
		}
		if (target.version && raw.version !== target.version) {
			return failure(INSTALL_CODES.VERSION_MISMATCH, `包内 manifest.version(${raw.version}) 与外部安装目标 expectedVersion(${target.version}) 不一致`, { stage: "verifying" });
		}
		const coreCheck = checkCoreRequirement(raw.core, getCoreVersion());
		if (!coreCheck.ok) {
			return failure(INSTALL_CODES.CORE_INCOMPATIBLE, coreCheck.message, { stage: "verifying" });
		}
		const manifest = normalizeManifest(raw);
		const entryFiles = [...asArray(manifest.entry.js), ...asArray(manifest.entry.css)];
		const missing = [];
		for (const file of entryFiles) {
			if (typeof file !== "string" || !file) continue;
			if ((await kindOf(`${dir}/${file}`)) === null) missing.push(file);
		}
		if (missing.length) {
			return failure(INSTALL_CODES.ENTRY_MISSING, `entry 声明的文件缺失: ${missing.join(", ")}`, { stage: "verifying", missing });
		}
		return success({ manifest, coreVersionUnknown: coreCheck.unknown });
	}

	// ---------------------------------------------------------------- 安装

	/** IO 端口异常 → 结构化结果；IO_STALL 单列，便于区分"本体回调未触发的兜底失败"与真实错误 */
	function toIoFailure(error, stage, extra = {}) {
		const code =
			error?.ioCode === "IO_STALL" ? INSTALL_CODES.IO_STALL : error?.ioCode === "IO_UNSAFE_PATH" ? INSTALL_CODES.INVALID_SPEC : INSTALL_CODES.IO_FAILED;
		return failure(code, String(error?.message ?? error), { stage, ...extra });
	}

	/** 探测路径类型；IO 异常按"不存在"处理并由调用方的错误路径接管 */
	async function kindOf(rel) {
		try {
			return await io.kind(rel);
		} catch {
			return null;
		}
	}

	async function installInner(rawSpec, opts = {}, chain = new Set()) {
		if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
		if (!extractZip) return failure(INSTALL_CODES.NO_EXTRACTOR, "未注入解压端口（ZIP），安装器不可用");

		// 信任来源只能是外部安装目标（索引条目/调用方），不能是包内自述：见 externalTarget()
		const spec = externalTarget(rawSpec);
		const checked = checkSpec(spec);
		if (!checked.ok) return checked;

		const { id } = spec;
		const stamp = `${id}-${spec.version || "pending"}-${random()}`;
		const tempDir = `${paths.tempRoot}/${stamp}`;
		const tempZip = `${paths.tempRoot}/${stamp}.zip`;
		const warnings = [];
		let replacedDir = null;

		const cleanup = async () => {
			try {
				await io.removeTree(tempDir);
			} catch {}
			try {
				await io.removeFile(tempZip);
			} catch {}
		};

		// 1. 依赖（任务书§11）
		const deps = await ensureDependencies(spec.dependencies, opts, chain);
		if (!deps.ok) return deps.failure;
		for (const item of deps.installed) warnings.push(`已先安装依赖 ${item}`);

		// 2. 已在位检查（避免白下一遍包再拒绝；真正的一致性仍以发布前检查为准）
		const preState = await readInstalled();
		if (!preState.ok) return preState;
		const preEntry = preState.data.modules[id];
		if (spec.version && preEntry?.version === spec.version && !opts.force && (await kindOf(packDir(id, spec.version))) === "dir") {
			return failure(INSTALL_CODES.ALREADY_INSTALLED, `${id}@${spec.version} 已安装（同版本覆盖需 force）`, {
				stage: "resolving",
				path: packDir(id, spec.version),
			});
		}

		// 3. 下载（重试/取消/进度，任务书§42）
		emit(opts, { stage: "downloading", id, message: `开始下载 ${id}` });
		let payload;
		try {
			payload = await download(spec.url, {
				signal: opts.signal,
				retries: opts.retries,
				retryDelayMs: opts.retryDelayMs,
				timeoutMs: opts.timeoutMs,
				onProgress: info => emit(opts, { stage: "downloading", id, ...info }),
			});
		} catch (error) {
			return toDownloadFailure(error);
		}

		// 4. 临时落地 + 以**落盘内容**对**外部期望摘要**做 SHA256 校验（任务书§17顺序：下载→临时写入→校验）
		try {
			await io.writeBinary(tempZip, payload.buffer);
		} catch (error) {
			await cleanup();
			return toIoFailure(error, "temp", { message: `临时文件写入失败: ${error?.message ?? error}` });
		}
		let landed;
		try {
			landed = await io.readBinary(tempZip);
		} catch (error) {
			await cleanup();
			return toIoFailure(error, "temp", { message: `临时文件读取失败: ${error?.message ?? error}` });
		}
		if (!landed || !landed.byteLength) {
			await cleanup();
			return failure(INSTALL_CODES.DOWNLOAD_FAILED, "临时文件为空（写入被截断？）", { stage: "temp" });
		}
		if (landed.byteLength !== payload.buffer.byteLength) {
			await cleanup();
			return failure(INSTALL_CODES.DOWNLOAD_FAILED, `临时文件大小不一致：${payload.buffer.byteLength} → ${landed.byteLength}`, { stage: "temp" });
		}
		/** digest 只表示"外部期望摘要已验证"；包内 manifest.sha256 不是信任来源（可被打包者或中间人改写） */
		let digest = "";
		let verifiedHash = false;
		try {
			const actual = (await hash(new Uint8Array(landed))).toLowerCase();
			if (spec.sha256) {
				if (actual !== String(spec.sha256).toLowerCase()) {
					await cleanup();
					return failure(INSTALL_CODES.SHA_MISMATCH, `SHA256 与外部期望值不符：期望 ${spec.sha256}，实际 ${actual}`, {
						stage: "verifying",
						expected: String(spec.sha256).toLowerCase(),
						actual,
					});
				}
				digest = actual;
				verifiedHash = true;
			} else {
				digest = "";
				warnings.push(`未提供外部 expectedSha256，内容未经完整性校验（实际摘要 ${actual}，仅作记录不作判据）`);
			}
		} catch (error) {
			await cleanup();
			if (error?.code === "SHA_UNAVAILABLE") {
				return failure(INSTALL_CODES.SHA_MISMATCH, spec.sha256 ? error.message : `无法计算摘要且缺少 expectedSha256：${error.message}`, {
					stage: "verifying",
					cause: error.code,
				});
			}
			return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "verifying" });
		}

		// 5. 解压到临时目录
		emit(opts, { stage: "extracting", id, message: `解压 ${id}` });
		try {
			await extractZip(landed, tempDir, (done, total) => emit(opts, { stage: "extracting", id, bytes: done, total, ratio: total ? done / total : 0 }));
		} catch (error) {
			await cleanup();
			if (error?.ioCode) return toIoFailure(error, "extracting", { message: `解压落地失败: ${error?.message ?? error}` });
			return failure(INSTALL_CODES.STRUCTURE_INVALID, `解压失败: ${error?.message ?? error}`, { stage: "extracting" });
		}

		// 6. 结构与 Manifest 校验：包内 id/version 必须等于外部安装目标；自述摘要不作判据
		const verified = await verifyPackageDir(tempDir, spec);
		if (!verified.ok) {
			await cleanup();
			return verified;
		}
		const { manifest } = verified;
		if (verified.coreVersionUnknown) warnings.push("Core 版本未知，未做兼容性检查");
		if (manifest.sha256) {
			const declared = String(manifest.sha256).toLowerCase();
			if (verifiedHash && declared !== digest) {
				warnings.push(`包内 manifest.sha256 与外部已验证摘要不一致，按外部 expectedSha256 为准`);
			} else if (!verifiedHash) {
				warnings.push(`包内 manifest.sha256 是自述值，不作为信任来源（缺外部 expectedSha256 → 本次未校验）`);
			}
		}

		// 7. 发布：旧内容改名让位（**保留到状态更新成功为止**），临时目录转正；失败则回滚
		const target = packDir(manifest.id, manifest.version);
		const state = await readInstalled();
		if (!state.ok) {
			await cleanup();
			return state;
		}
		const currentEntry = state.data.modules[manifest.id];
		const targetExists = (await kindOf(target)) === "dir";
		if (targetExists && currentEntry?.version === manifest.version && !opts.force) {
			await cleanup();
			return failure(INSTALL_CODES.ALREADY_INSTALLED, `${manifest.id}@${manifest.version} 已安装（同版本覆盖需 force）`, {
				stage: "publishing",
				path: target,
			});
		}

		/** 撤销发布：清掉半成品正式目录 + 把让位目录改回原位；返回回滚过程自身的错误（null=干净） */
		const undoPublish = async () => {
			let problem = null;
			try {
				await io.removeTree(target);
			} catch (error) {
				problem = `清理 ${target} 失败: ${error?.message ?? error}`;
			}
			if (replacedDir) {
				try {
					await io.movePath(replacedDir, target);
					replacedDir = null;
				} catch (error) {
					problem = `${problem ? `${problem}；` : ""}旧版本改回 ${target} 失败: ${error?.message ?? error}`;
				}
			}
			return problem;
		};

		try {
			if (targetExists) {
				const bak = `${target}.replacing-${random()}`;
				await io.movePath(target, bak);
				replacedDir = bak;
			}
			await io.movePath(tempDir, target);
		} catch (error) {
			const rollbackProblem = await undoPublish();
			await cleanup();
			if (rollbackProblem) {
				return failure(INSTALL_CODES.ROLLBACK_FAILED, `发布 ${target} 失败（${error?.message ?? error}），且旧版本回滚未完成：${rollbackProblem}`, {
					stage: "publishing",
					rolledBack: false,
					residual: replacedDir || target,
					cause: error?.message,
				});
			}
			return failure(INSTALL_CODES.PUBLISH_FAILED, `发布到 ${target} 失败：${error?.message ?? error}（旧版本已回滚就位）`, {
				stage: "publishing",
				rolledBack: true,
			});
		}

		// 8. 更新 installed.json 指针；失败则撤销发布（旧版本改回），绝不留下"台账说装着、磁盘没有"
		const previousVersion = currentEntry?.version && currentEntry.version !== manifest.version ? currentEntry.version : currentEntry?.previousVersion;
		const nextEntry = {
			version: manifest.version,
			installedAt: now(),
			source: "local",
			size: payload.bytes,
			// 只有经外部期望摘要校验通过的值才写进台账；未校验就留空，不采信包内自述
			sha256: digest,
			hashVerified: verifiedHash,
		};
		if (previousVersion) nextEntry.previousVersion = previousVersion;
		try {
			state.data.modules[manifest.id] = nextEntry;
			await writeInstalled(state.data);
		} catch (error) {
			const rollbackProblem = await undoPublish();
			await cleanup();
			if (rollbackProblem) {
				return failure(INSTALL_CODES.ROLLBACK_FAILED, `写入 ${paths.installedFile} 失败（${error?.message ?? error}），且旧版本回滚未完成：${rollbackProblem}`, {
					stage: "state",
					rolledBack: false,
					residual: replacedDir || target,
				});
			}
			return failure(INSTALL_CODES.STATE_FAILED, `写入 ${paths.installedFile} 失败：${error?.message ?? error}（已撤销本次安装，旧版本仍在）`, {
				stage: "state",
				rolledBack: true,
			});
		}

		// 9. 状态已落定，此时才可以清理让位的旧内容
		if (replacedDir) {
			try {
				await io.removeTree(replacedDir);
			} catch (error) {
				warnings.push(`旧版本让位目录清理失败（不影响使用）: ${replacedDir} — ${error?.message ?? error}`);
			}
			replacedDir = null;
		}

		// 10. 注册（source="installed" → ResourceLoader.getModuleBase 解析到包根）
		try {
			if (registry?.unregister) registry.unregister(manifest.id);
			if (moduleManager?.register) {
				const registered = moduleManager.register(manifest, { source: "installed" });
				if (registered && !registered.ok) warnings.push(`模块注册校验未通过: ${(registered.errors || []).join("; ")}`);
			}
		} catch (error) {
			warnings.push(`模块注册异常（重启后由 installed.json 恢复）: ${error?.message ?? error}`);
		}

		try {
			await io.removeFile(tempZip);
		} catch (error) {
			warnings.push(`临时包清理失败（可手工删除 ${tempZip}）: ${error?.message ?? error}`);
		}

		emit(opts, { stage: "done", id: manifest.id, bytes: payload.bytes, ratio: 1, message: `${manifest.id}@${manifest.version} 安装完成` });
		return success({
			id: manifest.id,
			version: manifest.version,
			path: target,
			bytes: payload.bytes,
			sha256: digest,
			hashVerified: verifiedHash,
			attempts: payload.attempts,
			previousVersion,
			dependencies: asArray(manifest.dependencies),
			requiresReload: true,
			warnings,
			message: `已安装 ${manifest.name || manifest.id} ${manifest.version}（切换生效需重载）`,
		});
	}

	// ---------------------------------------------------------------- 对外 API

	return {
		/**
		 * 校验包manifest（P1即可用）
		 * @param {Object} manifest
		 * @returns {{ok: boolean, errors: string[]}}
		 */
		verifyManifest(manifest) {
			return validateManifest(manifest);
		},

		/**
		 * 安装器可用性/能力探测（P6 界面据此置灰按钮并提示风险）。
		 * atomicRename=false 表示本平台发布走 copy+remove，**不是原子操作**（可能留部分副本），
		 * 安装器仍会尽力回滚，但 UI 应提示"安装中断后建议重做一次"。
		 */
		isAvailable() {
			return {
				available: !!io && !!extractZip,
				missingIo: !io,
				missingExtractor: !extractZip,
				atomicRename: io?.capabilities?.atomicRename ?? false,
			};
		},

		/** 读取 installed.json（结构化，不抛错） */
		readInstalled,

		/** 已安装模块列表（含是否独立安装根、包路径） */
		async listInstalled() {
			const state = await readInstalled();
			if (!state.ok) return state;
			const items = Object.entries(state.data.modules).map(([id, info]) => {
				const installState = moduleManager?.getInstallState?.(id) || { independent: false, version: info.version };
				return {
					id,
					version: info.version,
					previousVersion: info.previousVersion || null,
					path: packDir(id, info.version),
					independent: !!installState.independent,
					size: info.size || 0,
					installedAt: info.installedAt || null,
				};
			});
			return success({ items });
		},

		/**
		 * 获取模块索引（module-index.json，任务书§10）
		 * @param {string} url
		 * @param {Object} [opts] - {signal, onProgress, retries, timeoutMs}
		 */
		async fetchIndex(url, opts = {}) {
			try {
				const { buffer, bytes, attempts } = await download(url, opts);
				let parsed;
				try {
					parsed = JSON.parse(new TextDecoder().decode(buffer));
				} catch (error) {
					return failure(INSTALL_CODES.STRUCTURE_INVALID, `索引 JSON 解析失败: ${error.message}`, { stage: "index" });
				}
				if (!parsed || typeof parsed !== "object") return failure(INSTALL_CODES.STRUCTURE_INVALID, "索引内容不是对象", { stage: "index" });
				return success({ index: parsed, bytes, attempts });
			} catch (error) {
				return toDownloadFailure(error);
			}
		},

		/**
		 * 安装（任务书§17）。安装目标（外部信任输入）：
		 * {id|expectedId, url, version|expectedVersion, sha256|expectedSha256, dependencies?}
		 * @param {Object} spec
		 * @param {Object} [opts] - {signal, onProgress, index?, force?, retries?, timeoutMs?}
		 */
		async install(spec, opts = {}) {
			try {
				return await installInner(spec, opts, new Set([externalTarget(spec).id].filter(Boolean)));
			} catch (error) {
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "unexpected" });
			}
		},

		/**
		 * 更新（任务书§18）：新版本目录 → 校验 → 切指针，旧版本目录保留。
		 * @param {string} id
		 * @param {Object} [opts] - {spec?, index?, force?, signal?, onProgress?}
		 */
		async update(id, opts = {}) {
			try {
				const rawSpec = opts.spec || (opts.index ? specFromIndex(opts.index, id) : null);
				if (!rawSpec) return failure(INSTALL_CODES.INVALID_SPEC, `更新 ${id} 需要 spec 或可解析的 index 条目`, { stage: "resolving" });
				const spec = externalTarget(rawSpec);
				if (spec.id !== id) return failure(INSTALL_CODES.ID_MISMATCH, `安装目标为 ${spec.id}，不是 ${id}`, { stage: "resolving" });
				const state = await readInstalled();
				if (!state.ok) return state;
				const current = state.data.modules[id]?.version || null;
				if (current && spec.version && spec.version === current && !opts.force) {
					return success({ id, version: current, upToDate: true, message: `${id} 已是 ${current}` });
				}
				const result = await installInner(spec, { ...opts, force: !!opts.force }, new Set([id]));
				if (result.ok) {
					result.previousVersion = result.previousVersion || current;
					const keptOld = current && result.version !== current;
					result.message = `已更新 ${id}: ${current || "未安装"} → ${result.version}${
						keptOld ? "（旧版本目录保留，可回退）" : "（同版本覆盖，旧目录已清理）"
					}`;
				}
				return result;
			} catch (error) {
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "unexpected" });
			}
		},

		/**
		 * 卸载（任务书§19）。事务顺序：版本目录先改名让位（.removing-*，非删除）→ 更新
		 * installed.json → 成功后才真正删除让位目录；状态写失败则把让位目录改回原位。
		 * 因此不存在"目录已删、台账仍称已安装"的中间态，也不存在"台账已清、目录还在"的假失败。
		 *
		 * force **不**绕过 §19 的三条硬边界（使用中 / 被依赖 / core）：它们保护的是运行时可用性，
		 * 绕过就等于允许模块把自己脚下抽掉。force 只对安装侧的"同版本覆盖"有意义。
		 * 只删除 modules/ 下的独立安装目录，绝不删单体源文件。
		 * @param {string} id
		 * @param {Object} [opts] - {onProgress?}
		 */
		async uninstall(id, opts = {}) {
			try {
				if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
				const state = await readInstalled();
				if (!state.ok) return state;

				// §19 前置检查：任何 force 都不能绕过
				if (isInUse(id)) {
					return failure(INSTALL_CODES.IN_USE, `${id} 正在使用中，请先切换到其他样式再卸载（force 不绕过此检查）`, { stage: "checking", id });
				}
				const dependents = (registry?.list?.() || [])
					.filter(record => record.manifest.id !== id && asArray(record.manifest.dependencies).includes(id))
					.map(record => record.manifest.id);
				if (dependents.length) {
					return failure(INSTALL_CODES.DEPENDED, `${id} 被以下模块依赖: ${dependents.join(", ")}（force 不绕过此检查）`, {
						stage: "checking",
						dependents,
					});
				}

				const entry = state.data.modules[id];
				if (!entry) return failure(INSTALL_CODES.NOT_INSTALLED, `${id} 不是独立安装的模块`);
				if (moduleManager?.getInstallState && !moduleManager.getInstallState(id).independent) {
					return failure(INSTALL_CODES.NOT_INDEPENDENT, `${id} 未以独立包形式注册，拒绝删除（避免误删单体资源）`, { stage: "checking" });
				}

				const root = `${paths.modulesRoot}/${id}`;
				const removed = [];
				/** @type {Array<{from: string, to: string}>} 让位记录，用于失败回滚 */
				const parked = [];
				const restoreParked = async () => {
					const problems = [];
					for (const item of parked.reverse()) {
						try {
							await io.movePath(item.from, item.to);
						} catch (error) {
							problems.push(`${item.from} → ${item.to}: ${error?.message ?? error}`);
						}
					}
					return problems;
				};

				if ((await kindOf(root)) === "dir") {
					let dirs = [];
					try {
						({ dirs } = await io.listDir(root));
					} catch (error) {
						return toIoFailure(error, "checking", { message: `列举 ${root} 失败: ${error?.message ?? error}` });
					}
					for (const version of dirs) {
						const live = `${root}/${version}`;
						const park = `${root}/.removing-${version}-${random()}`;
						try {
							await io.movePath(live, park);
						} catch (error) {
							const problems = await restoreParked();
							return failure(
								INSTALL_CODES.UNINSTALL_FAILED,
								`让位 ${live} 失败：${error?.message ?? error}${problems.length ? `；已恢复其余目录，未恢复项：${problems.join("；")}` : "（已恢复先前让位的目录）"}`,
								{ stage: "parking", id, residual: problems.length ? root : null }
							);
						}
						parked.push({ from: park, to: live });
						removed.push(version);
					}
				}

				delete state.data.modules[id];
				try {
					await writeInstalled(state.data);
				} catch (error) {
					const problems = await restoreParked();
					if (problems.length) {
						return failure(INSTALL_CODES.ROLLBACK_FAILED, `写入 ${paths.installedFile} 失败（${error?.message ?? error}），且模块目录未能全部改回：${problems.join("；")}`, {
							stage: "state",
							id,
							rolledBack: false,
							residual: root,
						});
					}
					return failure(INSTALL_CODES.STATE_FAILED, `写入 ${paths.installedFile} 失败：${error?.message ?? error}（模块目录已原样恢复，安装状态未变）`, {
						stage: "state",
						id,
						rolledBack: true,
					});
				}

				// 状态已落定，让位目录此时才真正删除
				const notes = removed.length ? [] : [`未发现 ${root} 目录（可能已被手工删除，仅清理了台账记录）`];
				for (const item of parked) {
					try {
						await io.removeTree(item.from);
					} catch (error) {
						notes.push(`让位目录删除失败（不影响卸载结果，可手工删 ${item.from}）: ${error?.message ?? error}`);
					}
				}
				if (registry?.unregister) registry.unregister(id);
				emit(opts, { stage: "done", id, message: `${id} 已卸载` });
				return success({
					id,
					removedVersions: removed,
					requiresReload: true,
					warnings: notes,
					message: `已卸载 ${id}`,
				});
			} catch (error) {
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "unexpected" });
			}
		},

		/**
		 * 列出某模块本地已有的版本目录（P12 回滚/清理用）。
		 * 让位/删除中的 `.replacing-*`、`.removing-*` 由 io.listDir 的隐藏前缀规则自然排除。
		 * @param {string} id
		 */
		async localVersions(id) {
			if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口");
			const root = `${paths.modulesRoot}/${id}`;
			if ((await kindOf(root)) !== "dir") return success({ id, versions: [] });
			try {
				const { dirs } = await io.listDir(root);
				return success({ id, versions: dirs.filter(dir => !/\.(replacing|removing)-/.test(dir)) });
			} catch (error) {
				return toIoFailure(error, "listing", { message: `列举 ${root} 失败: ${error?.message ?? error}` });
			}
		},
	};
}
