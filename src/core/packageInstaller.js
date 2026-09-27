/**
 * @fileoverview 包安装器（P5 正式实现，任务书§17/§18/§19/§42）
 *
 * 标准安装流程（任务书§17）：
 *   解析依赖 → HTTP下载(重试/取消/进度) → 临时目录落地 → SHA256 校验落盘内容 →
 *   解压 → 结构与 Manifest 校验 → Core 版本检查 → 发布到 modules/<id>/<version>/ →
 *   更新 modules/installed.json → 注册模块（source="installed"）
 *
 * 失败保护（任务书§17末/§20）：
 *   - 任何一步失败都不得破坏已安装内容：先写临时目录，最后一步才 move 到位；
 *     覆盖同版本时旧目录先改名让位，失败即改回（回滚）。
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
	STATE_FAILED: "STATE_FAILED",
	INSTALLED_CORRUPT: "INSTALLED_CORRUPT",
	NOT_INSTALLED: "NOT_INSTALLED",
	NOT_INDEPENDENT: "NOT_INDEPENDENT",
	IN_USE: "IN_USE",
	DEPENDED: "DEPENDED",
	IO_FAILED: "IO_FAILED",
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
			version,
			url: entry.url,
			sha256: entry.sha256 || "",
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

	/** 校验临时目录内的包结构（任务书§17/§24） */
	async function verifyPackageDir(dir, spec) {
		const manifestText = await io.readText(`${dir}/manifest.json`);
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
		if (raw.id !== spec.id) {
			return failure(INSTALL_CODES.ID_MISMATCH, `包ID(${raw.id})与索引ID(${spec.id})不一致`, { stage: "verifying" });
		}
		if (spec.version && raw.version !== spec.version) {
			return failure(INSTALL_CODES.VERSION_MISMATCH, `包版本(${raw.version})与索引版本(${spec.version})不一致`, { stage: "verifying" });
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
			if (!(await io.exists(`${dir}/${file}`))) missing.push(file);
		}
		if (missing.length) {
			return failure(INSTALL_CODES.ENTRY_MISSING, `entry 声明的文件缺失: ${missing.join(", ")}`, { stage: "verifying", missing });
		}
		return success({ manifest, coreVersionUnknown: coreCheck.unknown });
	}

	// ---------------------------------------------------------------- 安装

	async function installInner(spec, opts = {}, chain = new Set()) {
		if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
		if (!extractZip) return failure(INSTALL_CODES.NO_EXTRACTOR, "未注入解压端口（ZIP），安装器不可用");
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
		const deps = await ensureDependencies(asArray(spec.dependencies), opts, chain);
		if (!deps.ok) return deps.failure;
		for (const item of deps.installed) warnings.push(`已先安装依赖 ${item}`);

		// 2. 已在位检查（避免白下一遍包再拒绝；真正的一致性仍以发布前检查为准）
		const preState = await readInstalled();
		if (!preState.ok) return preState;
		const preEntry = preState.data.modules[id];
		if (spec.version && preEntry?.version === spec.version && !opts.force && (await io.kind(packDir(id, spec.version))) === "dir") {
			return failure(INSTALL_CODES.ALREADY_INSTALLED, `${id}@${spec.version} 已安装（重装需 force）`, {
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

		// 4. 临时落地 + 以**落盘内容**做 SHA256 校验（任务书§17顺序：下载→临时写入→校验）
		try {
			await io.writeBinary(tempZip, payload.buffer);
		} catch (error) {
			await cleanup();
			return failure(INSTALL_CODES.IO_FAILED, `临时文件写入失败: ${error?.message ?? error}`, { stage: "temp" });
		}
		let landed;
		try {
			landed = await io.readBinary(tempZip);
		} catch (error) {
			await cleanup();
			return failure(INSTALL_CODES.IO_FAILED, `临时文件读取失败: ${error?.message ?? error}`, { stage: "temp" });
		}
		if (!landed || !landed.byteLength) {
			await cleanup();
			return failure(INSTALL_CODES.DOWNLOAD_FAILED, "临时文件为空（写入被截断？）", { stage: "temp" });
		}
		if (landed.byteLength !== payload.buffer.byteLength) {
			await cleanup();
			return failure(INSTALL_CODES.DOWNLOAD_FAILED, `临时文件大小不一致：${payload.buffer.byteLength} → ${landed.byteLength}`, { stage: "temp" });
		}
		let digest = "";
		if (spec.sha256) {
			try {
				digest = (await hash(new Uint8Array(landed))).toLowerCase();
			} catch (error) {
				await cleanup();
				if (error?.code === "SHA_UNAVAILABLE") {
					return failure(INSTALL_CODES.DOWNLOAD_FAILED, error.message, { stage: "verifying", cause: error.code });
				}
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "verifying" });
			}
			if (digest !== String(spec.sha256).toLowerCase()) {
				await cleanup();
				return failure(INSTALL_CODES.SHA_MISMATCH, `SHA256 不匹配：期望 ${spec.sha256}，实际 ${digest}`, { stage: "verifying" });
			}
		} else {
			warnings.push("索引未提供 sha256，已跳过完整性校验");
		}

		// 5. 解压到临时目录
		emit(opts, { stage: "extracting", id, message: `解压 ${id}` });
		try {
			await extractZip(landed, tempDir, (done, total) => emit(opts, { stage: "extracting", id, bytes: done, total, ratio: total ? done / total : 0 }));
		} catch (error) {
			await cleanup();
			return failure(INSTALL_CODES.STRUCTURE_INVALID, `解压失败: ${error?.message ?? error}`, { stage: "extracting" });
		}

		// 6. 结构与 Manifest 校验
		const verified = await verifyPackageDir(tempDir, spec);
		if (!verified.ok) {
			await cleanup();
			return verified;
		}
		const { manifest } = verified;
		if (manifest.sha256 && digest && manifest.sha256.toLowerCase() !== digest) {
			await cleanup();
			return failure(INSTALL_CODES.SHA_MISMATCH, "包内 manifest 自述摘要与实际内容不符", { stage: "verifying" });
		}
		if (verified.coreVersionUnknown) warnings.push("Core 版本未知，未做兼容性检查");

		// 7. 发布：旧目录先改名让位，再把临时目录转正；任一步失败都把让位目录改回（回滚）
		const target = packDir(manifest.id, manifest.version);
		const state = await readInstalled();
		if (!state.ok) {
			await cleanup();
			return state;
		}
		const currentEntry = state.data.modules[manifest.id];
		const targetExists = (await io.kind(target)) === "dir";
		if (targetExists && currentEntry?.version === manifest.version && !opts.force) {
			await cleanup();
			return failure(INSTALL_CODES.ALREADY_INSTALLED, `${manifest.id}@${manifest.version} 已安装（重装需 force）`, {
				stage: "publishing",
				path: target,
			});
		}
		let publishError = null;
		try {
			if (targetExists) {
				const bak = `${target}.replacing-${random()}`;
				await io.movePath(target, bak);
				replacedDir = bak;
			}
			await io.movePath(tempDir, target);
		} catch (error) {
			publishError = error;
			if (replacedDir) {
				try {
					await io.movePath(replacedDir, target);
					replacedDir = null;
				} catch (rollbackError) {
					warnings.push(`旧版本回滚失败，残留在 ${replacedDir}: ${rollbackError?.message ?? rollbackError}`);
				}
			}
		}
		if (publishError) {
			await cleanup();
			return failure(INSTALL_CODES.PUBLISH_FAILED, `发布到 ${target} 失败：${publishError.message}`, {
				stage: "publishing",
				rolledBack: replacedDir === null,
			});
		}
		if (replacedDir) {
			// 新包已确认就位，让位的旧内容才可清理
			try {
				await io.removeTree(replacedDir);
			} catch (error) {
				warnings.push(`旧版本临时目录清理失败（不影响使用）: ${error?.message ?? error}`);
			}
			replacedDir = null;
		}

		// 8. 更新 installed.json 指针（失败则删掉刚发布的目录，保持与状态文件一致）
		const previousVersion = currentEntry?.version && currentEntry.version !== manifest.version ? currentEntry.version : currentEntry?.previousVersion;
		const nextEntry = {
			version: manifest.version,
			installedAt: now(),
			source: "local",
			size: payload.bytes,
			sha256: digest || manifest.sha256 || "",
		};
		if (previousVersion) nextEntry.previousVersion = previousVersion;
		try {
			state.data.modules[manifest.id] = nextEntry;
			await writeInstalled(state.data);
		} catch (error) {
			try {
				await io.removeTree(target);
			} catch {}
			await cleanup();
			return failure(INSTALL_CODES.STATE_FAILED, `写入 ${paths.installedFile} 失败：${error?.message ?? error}（已撤销本次安装）`, { stage: "state" });
		}

		// 9. 注册（source="installed" → ResourceLoader.getModuleBase 解析到包根）
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
		} catch {}

		emit(opts, { stage: "done", id: manifest.id, bytes: payload.bytes, ratio: 1, message: `${manifest.id}@${manifest.version} 安装完成` });
		return success({
			id: manifest.id,
			version: manifest.version,
			path: target,
			bytes: payload.bytes,
			sha256: digest,
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

		/** 安装器是否可用（环境探测：P6 界面据此置灰按钮） */
		isAvailable() {
			return { available: !!io && !!extractZip, missingIo: !io, missingExtractor: !extractZip };
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
		 * 安装（任务书§17）。spec: {id, url, version?, sha256?, dependencies?}
		 * @param {Object} spec
		 * @param {Object} [opts] - {signal, onProgress, index?, force?, retries?, timeoutMs?}
		 */
		async install(spec, opts = {}) {
			try {
				return await installInner(spec, opts, new Set([spec?.id].filter(Boolean)));
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
				const spec = opts.spec || (opts.index ? specFromIndex(opts.index, id) : null);
				if (!spec) return failure(INSTALL_CODES.INVALID_SPEC, `更新 ${id} 需要 spec 或可解析的 index 条目`, { stage: "resolving" });
				if (spec.id !== id) return failure(INSTALL_CODES.ID_MISMATCH, `索引条目为 ${spec.id}，不是 ${id}`, { stage: "resolving" });
				const state = await readInstalled();
				if (!state.ok) return state;
				const current = state.data.modules[id]?.version || null;
				if (current && spec.version && spec.version === current && !opts.force) {
					return success({ id, version: current, upToDate: true, message: `${id} 已是 ${current}` });
				}
				const result = await installInner({ ...spec, dependencies: asArray(spec.dependencies) }, { ...opts, force: !!opts.force }, new Set([id]));
				if (result.ok) {
					result.previousVersion = result.previousVersion || current;
					result.message = `已更新 ${id}: ${current || "未安装"} → ${result.version}（旧版本目录保留）`;
				}
				return result;
			} catch (error) {
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "unexpected" });
			}
		},

		/**
		 * 卸载（任务书§19）：使用中检查 → 被依赖检查 → 删除 modules/<id> → 清理引用。
		 * 只删除独立安装目录，绝不删单体源文件。
		 * @param {string} id
		 * @param {Object} [opts] - {force?, onProgress?}
		 */
		async uninstall(id, opts = {}) {
			try {
				if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
				const state = await readInstalled();
				if (!state.ok) return state;

				// 任务书§19 顺序：使用中 → 被依赖 → 才谈删除
				if (!opts.force && isInUse(id)) {
					return failure(INSTALL_CODES.IN_USE, `${id} 正在使用中，请先切换到其他样式再卸载`, { stage: "checking", id });
				}
				const dependents = (registry?.list?.() || [])
					.filter(record => record.manifest.id !== id && asArray(record.manifest.dependencies).includes(id))
					.map(record => record.manifest.id);
				if (dependents.length && !opts.force) {
					return failure(INSTALL_CODES.DEPENDED, `${id} 被以下模块依赖: ${dependents.join(", ")}`, { stage: "checking", dependents });
				}

				const entry = state.data.modules[id];
				if (!entry) return failure(INSTALL_CODES.NOT_INSTALLED, `${id} 不是独立安装的模块`);
				if (moduleManager?.getInstallState && !moduleManager.getInstallState(id).independent) {
					return failure(INSTALL_CODES.NOT_INDEPENDENT, `${id} 未以独立包形式注册，拒绝删除（避免误删单体资源）`, { stage: "checking" });
				}

				const root = `${paths.modulesRoot}/${id}`;
				let removed = [];
				if ((await io.kind(root)) === "dir") {
					const { dirs } = await io.listDir(root);
					removed = dirs.slice();
					await io.removeTree(root);
				}
				delete state.data.modules[id];
				try {
					await writeInstalled(state.data);
				} catch (error) {
					return failure(INSTALL_CODES.STATE_FAILED, `模块目录已删除但 ${paths.installedFile} 写入失败（重启后不会自动注册）: ${error?.message ?? error}`, {
						stage: "state",
						id,
					});
				}
				if (registry?.unregister) registry.unregister(id);
				emit(opts, { stage: "done", id, message: `${id} 已卸载` });
				return success({
					id,
					removedVersions: removed,
					requiresReload: true,
					warnings: removed.length ? [] : [`未发现 ${root} 目录（可能已被手工删除）`],
					message: `已卸载 ${id}`,
				});
			} catch (error) {
				return failure(INSTALL_CODES.UNEXPECTED, String(error?.message ?? error), { stage: "unexpected" });
			}
		},

		/**
		 * 列出某模块本地已有的版本目录（P12 回滚/清理用）
		 * @param {string} id
		 */
		async localVersions(id) {
			if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口");
			const root = `${paths.modulesRoot}/${id}`;
			if ((await io.kind(root)) !== "dir") return success({ id, versions: [] });
			const { dirs } = await io.listDir(root);
			return success({ id, versions: dirs.filter(dir => !/\.replacing-/.test(dir)) });
		},
	};
}
