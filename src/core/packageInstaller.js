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
 *   - installed.json 是唯一的状态落盘点：桌面端 temp → 原子 rename；无原子 rename 的平台
 *     （Android/SAF）先备份旧台账 → 提交 → 回读校验，失败即用备份还原，还原也失败
 *     → code=ROLLBACK_FAILED + residual，绝不带着半截台账返回成功。
 *   - io.kind 的权限/磁盘/卡死异常一律按 IO_FAILED / IO_STALL 返回，不伪装成"路径不存在"。
 *   - IO 端口（moduleIo）保证不会永久 pending：真实 error callback 优先，
 *     本体"既不成功也不失败地回调"那一类才由 IO_STALL 兜底判失败。
 *   - 全部方法返回结构化结果 {ok, code, ...}，不向外抛异常。
 *
 * 本模块**不依赖 noname 运行时**：文件系统与解压能力由调用方（moduleSystem）注入端口，
 * 因此在 Node 中可用假 io/transport 全量测试（tests/p5-installer.test.mjs）。
 */
import { validateManifest, normalizeManifest, checkCoreRequirement } from "./manifest.js";
import { downloadBuffer, sha256Hex, DownloadError } from "./downloader.js";
import { assessModule, planRepair } from "./moduleHealth.js";

/**
 * 索引/调用方给的相对地址 → 绝对下载地址（任务书§46/§47：P9 产物与发布共用一条解析）
 *
 * 解析点**只在这里一个**：`installInner` 在校验之前调用它，所以
 *   - 直接给的规格、索引里的依赖条目、依赖递归再进来时，走的是同一份逻辑；
 *   - 对绝对地址幂等（`new URL(绝对, base)` 返回绝对本身），重复解析没有副作用。
 * 必须在 `checkSpec` 之前调用——那里只收 `http(s)` 绝对地址，相对条目会被当成 INVALID_SPEC。
 *
 * 不传 `indexUrl` 时原样返回，保持引入本参数之前的行为（调用方自己给绝对地址的用法不受影响）。
 * @param {string} url - 索引条目里的 url（可为裸文件名、子路径或绝对地址）
 * @param {string} [indexUrl] - 索引文件自身的绝对地址（fetchIndex 回带），作为解析基准
 * @returns {string} 解析后的地址；无法解析时原样交回，由下载器给出 INVALID_URL
 */
export function resolveModuleUrl(url, indexUrl) {
	if (typeof url !== "string" || !url) return "";
	if (typeof indexUrl !== "string" || !indexUrl) return url;
	try {
		return new URL(url, indexUrl).href;
	} catch {
		return url;
	}
}

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
	NO_ROLLBACK: "NO_ROLLBACK",
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
 * @param {(buffer: ArrayBuffer, targetRelDir: string, onEntry?: Function) => Promise<string[]>|{extract: Function, probe?: Function}} [deps.extractZip] - 解压端口（函数或 createZipExtractor() 返回的对象）
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

	/**
	 * 解压端口的两种合法形状：函数 `(buffer, target, onEntry) => Promise`，
	 * 或 `createZipExtractor()` 返回的 `{ extract, probe }` 对象。
	 *
	 * 这里必须归一：moduleSystem 注入的是对象，而安装器一路当函数调，
	 * 真机上会得到 `extractZip is not a function` 的 TypeError——它不带 ioCode，
	 * 于是被下面第 5 步误报成 `STRUCTURE_INVALID「解压失败」`，看着像包坏了。
	 * 归一之后没有可用形状就是 `NO_EXTRACTOR`，不再伪装成包结构问题。
	 */
	const extractArchive =
		typeof extractZip === "function"
			? extractZip
			: extractZip && typeof extractZip.extract === "function"
				? (...args) => extractZip.extract(...args)
				: null;

	/**
	 * 解压能力的**真实**探测缓存（null=尚未探测）。
	 *
	 * `extractArchive` 只说明"端口对象在"，真正能不能解压要看运行时取不取得到一份可用的 JSZip
	 * （本体把它内联成 ES 模块、不挂全局，历史上正是"端口在但取不到库"）。这里把 probe 的结论
	 * 缓存下来：成功失败都缓存、并发复用同一次探测，于是
	 *   - `ready()` 可以随便被窗口反复调用，不会把 JSZip 反复加载；
	 *   - `isAvailable()` 同步拿到"当前已知"的真实能力；
	 *   - 安装路径能在**下载之前**就知道该不该拒（不再白下 20MB 才失败）。
	 * 重载游戏会重建安装器，缓存自然清空；刻意不提供 reset（任务书§四）。
	 */
	let extractorReadiness = null;
	let extractorProbe = null;

	function ensureExtractorReadiness() {
		if (extractorReadiness) return Promise.resolve(extractorReadiness);
		if (extractorProbe) return extractorProbe;
		extractorProbe = (async () => {
			if (!io) return { ok: false, reason: "未注入文件系统端口" };
			if (!extractArchive) return { ok: false, reason: "未注入解压端口（ZIP）" };
			// 端口没提供 probe（注入的替身/单测/纯函数端口）时按既有事实报可用，绝不凭空判死
			if (typeof extractZip?.probe !== "function") return { ok: true, reason: "" };
			try {
				const probed = await extractZip.probe();
				return { ok: probed?.ok === true, reason: probed?.reason || "" };
			} catch (error) {
				return { ok: false, reason: `探测解压能力时抛错：${error?.message ?? error}` };
			}
		})().then(result => {
			extractorReadiness = result;
			return result;
		});
		return extractorProbe;
	}

	const packDir = (id, version) => `${paths.modulesRoot}/${id}/${version}`;

	/**
	 * 让位/隔离中的暂存目录名（安装器自己造的，不是版本目录）。
	 *
	 * 端口的两条分支口径不同：桌面 `desktopListDir` 顺手跳过点开头条目，legacy（`game.getFileList`）
	 * 不跳。2026-10-01 Android 真机上卸载把上一次失败留下的 `.removing-1.5.0-*` 当成版本又让位一次，
	 * 造出 `.removing-.removing-1.5.0-*` 并在复制校验处失败 —— 所以**凡按"版本"枚举 `modules/<id>/`
	 * 的地方都必须过这道筛子**，不许依赖端口过滤。
	 */
	const PARKED_DIR = /\.(removing|replacing|corrupt)-/;
	const isParkedDir = name => PARKED_DIR.test(String(name));
	const versionDirs = dirs => (Array.isArray(dirs) ? dirs : []).filter(name => !isParkedDir(name));

	/**
	 * 探测某个版本目录的健康状况（结构级四项，喂给 moduleHealth 的判据）。
	 * **IO 错误一律抛出**，由调用方转成 IO_FAILED——不许把"读盘失败"当成"文件不存在"，
	 * 否则一次读盘抖动就会让 planRepair 把好包判成损坏。
	 */
	async function probeModuleVersion(id, version) {
		const dir = packDir(id, version);
		if ((await kindOf(dir)) !== "dir") return { dirExists: false };
		const text = await io.readText(`${dir}/manifest.json`);
		if (text === null || text === undefined) return { dirExists: true, manifestExists: false };
		let manifest = null;
		let manifestParsed = true;
		try {
			manifest = JSON.parse(text);
		} catch {
			manifestParsed = false;
		}
		const missingEntries = [];
		if (manifestParsed && manifest && typeof manifest === "object") {
			for (const kind of ["js", "css"]) {
				for (const rel of Array.isArray(manifest.entry?.[kind]) ? manifest.entry[kind] : []) {
					if ((await kindOf(`${dir}/${rel}`)) === null) missingEntries.push(rel);
				}
			}
		}
		return { dirExists: true, manifestExists: true, manifestParsed, manifest, missingEntries };
	}
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
		// 只有"文件不存在"才是"还没有台账"；空文件是被截断的台账，不能当空台账覆盖掉
			if (text === null || text === undefined) return success({ data: { schema: 1, modules: {} } });
		try {
			const data = JSON.parse(text);
			if (!data || typeof data !== "object") throw new Error("非对象");
			data.modules = data.modules && typeof data.modules === "object" ? data.modules : {};
			return success({ data });
		} catch (error) {
			return failure(INSTALL_CODES.INSTALLED_CORRUPT, `${paths.installedFile} 无法解析（${error.message}），已拒绝改写以免丢失安装记录`);
		}
	}

	/** writeInstalled 提交失败且旧台账还原不了时抛出：调用方必须转成 ROLLBACK_FAILED，不得当普通失败或成功 */
	class StateCommitError extends Error {
		constructor(message, residual, cause) {
			super(message);
			this.name = "StateCommitError";
			this.installCode = INSTALL_CODES.ROLLBACK_FAILED;
			this.residual = residual;
			if (cause) this.cause = cause;
		}
	}

	/** 尽力清除事务残留文件；清不掉不改变结论（台账好不好另说），但绝不借此把失败说成成功 */
	const removeQuiet = async rel => {
		if (!rel) return;
		try {
			await io.removeFile(rel);
		} catch {}
	};

	/**
	 * 安全提交 installed.json —— 安装/卸载唯一的状态落盘点。契约：
	 *   成功        → 新台账已完整落盘且可解析
	 *   普通失败    → 旧台账内容保持原样（没动过，或已由备份还原回去）
	 *   还原也失败  → 抛 StateCommitError（带 residual=台账路径），调用方必须报 ROLLBACK_FAILED
	 * 桌面端同卷 rename 本身原子，保持 temp → rename；无原子 rename 的平台（Android/SAF 走
	 * copy+remove）不能拿唯一一份台账当赌注，因此先备份、提交后回读校验、失败即还原。
	 */
	async function writeInstalled(data) {
		const text = `${JSON.stringify(data, null, "\t")}\n`;
		const tmp = `${paths.installedFile}.${random()}.tmp`;

		if (io.capabilities?.atomicRename) {
			try {
				await io.writeText(tmp, text);
				await io.movePath(tmp, paths.installedFile);
			} finally {
				await removeQuiet(tmp);
			}
			return;
		}

		let previousText;
		try {
			previousText = await io.readText(paths.installedFile);
		} catch (error) {
			throw new StateCommitError(`读取 ${paths.installedFile} 失败，无法安全提交新台账：${error?.message ?? error}`, paths.installedFile, error);
		}
		const backup = previousText === null || previousText === undefined ? null : `${paths.installedFile}.backup-${random()}`;

		let problem = null;
		try {
			if (backup) await io.writeText(backup, previousText);
			await io.writeText(tmp, text);
			// 覆盖唯一台账之前先验证待提交内容本身可读且合法
			const staged = await io.readText(tmp);
			if (staged !== text) throw new Error(`临时台账回读不一致: ${tmp}`);
			JSON.parse(staged);
			await io.movePath(tmp, paths.installedFile);
			const committed = await io.readText(paths.installedFile);
			if (committed === null) throw new Error(`${paths.installedFile} 提交后不可读`);
			JSON.parse(committed);
		} catch (error) {
			problem = error;
		}
		await removeQuiet(tmp);
		if (!problem) {
			await removeQuiet(backup);
			return;
		}

		let intact;
		try {
			intact = (await io.readText(paths.installedFile)) === previousText;
		} catch {
			intact = false; // 连读都读不出来，按"旧台账已不可用"处理
		}
		if (intact) {
			await removeQuiet(backup);
			throw problem; // 旧台账完好，调用方按普通失败处理
		}

		try {
			if (backup) {
				const saved = await io.readText(backup);
				if (saved !== previousText) throw new Error(`备份内容不完整: ${backup}`);
				await io.movePath(backup, paths.installedFile);
			} else {
				await io.removeFile(paths.installedFile); // 原本没有台账：清掉半成品就是还原
			}
			const restored = await io.readText(paths.installedFile);
			if (restored !== previousText) throw new Error("还原后内容与旧台账不一致");
		} catch (restoreError) {
			throw new StateCommitError(
				`写入 ${paths.installedFile} 失败（${problem?.message ?? problem}），且旧台账还原失败：${restoreError?.message ?? restoreError}`,
				paths.installedFile,
				restoreError
			);
		}
		throw problem;
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
			let type;
			try {
				type = await kindOf(`${dir}/${file}`);
			} catch (error) {
				return toIoFailure(error, "verifying", { message: `检查 entry 文件 ${file} 失败: ${error?.message ?? error}` });
			}
			if (type === null) missing.push(file);
		}
		if (missing.length) {
			return failure(INSTALL_CODES.ENTRY_MISSING, `entry 声明的文件缺失: ${missing.join(", ")}`, { stage: "verifying", missing });
		}
		// 资源边界声明必须可达（资源热插拔）：文件声明逐个 kindOf，目录声明列到任一内容即算命中。
		// 与 verify-pack / build-release --verify 共用同一语义（manifest.findMissingResources）。
		if (Array.isArray(manifest.resources) && manifest.resources.length) {
			const missingResources = [];
			for (const entry of manifest.resources) {
				if (entry.endsWith("/")) {
					let listed = null;
					try {
						listed = typeof io.listDir === "function" ? await io.listDir(`${dir}/${entry}`) : null;
					} catch (error) {
						return toIoFailure(error, "verifying", { message: `检查资源目录 ${entry} 失败: ${error?.message ?? error}` });
					}
					const hasAny = listed && ((listed.files?.length ?? 0) > 0 || (listed.dirs?.length ?? 0) > 0);
					if (!hasAny) missingResources.push(entry);
				} else {
					let type;
					try {
						type = await kindOf(`${dir}/${entry}`);
					} catch (error) {
						return toIoFailure(error, "verifying", { message: `检查资源 ${entry} 失败: ${error?.message ?? error}` });
					}
					if (type === null) missingResources.push(entry);
				}
			}
			if (missingResources.length) {
				return failure(INSTALL_CODES.ENTRY_MISSING, `resources 声明的资源缺失: ${missingResources.join(", ")}`, { stage: "verifying", missing: missingResources });
			}
		}
		return success({ manifest, coreVersionUnknown: coreCheck.unknown });
	}

	// ---------------------------------------------------------------- 安装

	/** IO 端口异常 → 结构化结果；IO_STALL 单列，便于区分"本体回调未触发的兜底失败"与真实错误 */
	function toIoFailure(error, stage, extra = {}) {
		const code =
			error?.ioCode === "IO_STALL" ? INSTALL_CODES.IO_STALL
				: error?.ioCode === "IO_UNSAFE_PATH" ? INSTALL_CODES.INVALID_SPEC
				// 解压能力取不到不是包的问题：报 NO_EXTRACTOR，别让它伪装成 STRUCTURE_INVALID
				: error?.ioCode === "NO_EXTRACTOR" ? INSTALL_CODES.NO_EXTRACTOR
				: INSTALL_CODES.IO_FAILED;
		return failure(code, String(error?.message ?? error), { stage, ...extra });
	}

	/**
	 * 探测路径类型。**`null` 只表示"确定不存在"**：权限错误、磁盘错误、IO_STALL 等真实异常
	 * 一律向上传播，由调用点转成 IO_FAILED / IO_STALL（P5 审查：吞掉异常当"不存在"会让安装器
	 * 覆盖掉可能存在的旧目录，或让卸载删掉台账却留下磁盘目录）。
	 */
	async function kindOf(rel) {
		return await io.kind(rel);
	}

	async function installInner(rawSpec, opts = {}, chain = new Set()) {
		if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
		if (!extractArchive) return failure(INSTALL_CODES.NO_EXTRACTOR, "未注入可用的解压端口（ZIP），安装器不可用");
		// 真实能力检查必须在**下载之前**：已知取不到 JSZip 时先把包下完再失败是白费流量
		// （窗口那侧靠同一次缓存，不会因此多探测一遍）。尚未探测的走这里探一次再决定。
		const readiness = await ensureExtractorReadiness();
		if (!readiness.ok) {
			return failure(INSTALL_CODES.NO_EXTRACTOR, `解压能力不可用：${readiness.reason || "原因未知"}`, {
				stage: "resolving",
				extractor: false,
			});
		}

		// 信任来源只能是外部安装目标（索引条目/调用方），不能是包内自述：见 externalTarget()
		const spec = externalTarget(rawSpec);
		// 索引条目常写裸文件名，先按索引地址解析再校验（checkSpec 只收 http(s) 绝对地址）
		spec.url = resolveModuleUrl(spec.url, opts.indexUrl);
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
		if (spec.version && preEntry?.version === spec.version && !opts.force) {
			const installedDir = packDir(id, spec.version);
			let preKind;
			try {
				preKind = await kindOf(installedDir);
			} catch (error) {
				return toIoFailure(error, "resolving", { message: `检查 ${installedDir} 失败: ${error?.message ?? error}` });
			}
			if (preKind === "dir") {
				return failure(INSTALL_CODES.ALREADY_INSTALLED, `${id}@${spec.version} 已安装（同版本覆盖需 force）`, {
					stage: "resolving",
					path: installedDir,
				});
			}
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
			await extractArchive(landed, tempDir, (done, total) => emit(opts, { stage: "extracting", id, bytes: done, total, ratio: total ? done / total : 0 }));
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
		// 发布前必须先探明目标状态：探测失败绝不按"不存在"继续（否则会把可能存在的旧目录直接覆盖掉）
		let targetKind;
		try {
			targetKind = await kindOf(target);
		} catch (error) {
			await cleanup();
			return toIoFailure(error, "publishing", { message: `检查发布目标 ${target} 失败: ${error?.message ?? error}` });
		}
		const targetExists = targetKind === "dir";
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
			// writeInstalled 自己已把台账还原；还原不了会带 StateCommitError 上来，两种都要算"回滚未完成"
			const ledgerProblem = error instanceof StateCommitError ? error.message : null;
			const rollbackProblem = await undoPublish();
			await cleanup();
			if (ledgerProblem || rollbackProblem) {
				return failure(INSTALL_CODES.ROLLBACK_FAILED, `安装状态未能回滚：${[ledgerProblem, rollbackProblem].filter(Boolean).join("；")}`, {
					stage: "state",
					rolledBack: false,
					residual: [error.residual, rollbackProblem ? replacedDir || target : null].filter(Boolean).join("、"),
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
		/**
		 * 同步能力快照：表示"当前**已知**的可执行安装能力"，不再只是"端口对象挂没挂"。
		 *
		 * - 端口缺失 → available:false + 对应 missing* 标记；
		 * - 端口在但还没探测 → `ready:false`、available 保持 false（**未知 ≠ 可用**）；
		 * - 探测过 → available 就是 probe 的结论，失败时带 `reason`。
		 *
		 * 真值来源只有一处：`ready()` 那次探测（与安装路径共用同一缓存）。
		 */
		isAvailable() {
			const state = {
				available: false,
				missingIo: !io,
				missingExtractor: !extractArchive,
				atomicRename: io?.capabilities?.atomicRename ?? false,
				ready: extractorReadiness !== null,
			};
			if (state.missingIo || state.missingExtractor) return state;
			if (!extractorReadiness) return state;
			if (!extractorReadiness.ok) return { ...state, reason: extractorReadiness.reason };
			return { ...state, available: true };
		},

		/**
		 * 异步能力探测（界面置灰用）。
		 *
		 * `isAvailable()` 只能说明"端口对象在"，而解压能力真正的条件是
		 * "运行时取得到一份可用的 JSZip"——本体把它内联成 ES 模块、不挂全局，
		 * 所以端口在但取不到库是完全可能的（历史上正是这一情形，症状还被误报成包结构非法）。
		 * 端口没提供 probe 时（注入的替身/单测）按既有事实报可用，绝不凭空判死。
		 * @returns {Promise<{ok: boolean, reason: string}>}
		 */
		async ready() {
			return ensureExtractorReadiness();
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
				return success({ index: parsed, indexUrl: url, bytes, attempts });
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
				/** @type {Array<{from: string, to: string}>} 让位记录，用于失败回滚（回滚需逆序遍历，故不得就地 reverse） */
				const parked = [];
				const restoreParked = async () => {
					const problems = [];
					for (const item of [...parked].reverse()) {
						try {
							await io.movePath(item.from, item.to);
						} catch (error) {
							problems.push(`${item.from} → ${item.to}: ${error?.message ?? error}`);
						}
					}
					return problems;
				};

				// 探测不到就什么都不动：绝不能把"检查失败"当"目录不存在"，那会留下目录却删掉台账
				let rootKind;
				try {
					rootKind = await kindOf(root);
				} catch (error) {
					return toIoFailure(error, "checking", { id, message: `检查 ${root} 失败: ${error?.message ?? error}` });
				}
				/** 上一次失败留下的让位残骸：不是版本，但卸载成功后要一并带走（手机上没人能手删 app 私有目录） */
				let debris = [];
				if (rootKind === "dir") {
					let dirs = [];
					try {
						({ dirs } = await io.listDir(root));
					} catch (error) {
						return toIoFailure(error, "checking", { message: `列举 ${root} 失败: ${error?.message ?? error}` });
					}
					debris = dirs.filter(isParkedDir).map(name => `${root}/${name}`);
					for (const version of versionDirs(dirs)) {
						const live = `${root}/${version}`;
						const park = `${root}/.removing-${version}-${random()}`;
						try {
							await io.movePath(live, park);
						} catch (error) {
							const problems = await restoreParked();
							if (problems.length) {
								return failure(INSTALL_CODES.ROLLBACK_FAILED, `让位 ${live} 失败：${error?.message ?? error}，且已让位的目录未能全部改回：${problems.join("；")}`, {
									stage: "parking",
									id,
									rolledBack: false,
									residual: root,
								});
							}
							return failure(INSTALL_CODES.UNINSTALL_FAILED, `让位 ${live} 失败：${error?.message ?? error}（先前让位的目录已全部改回原位）`, {
								stage: "parking",
								id,
								rolledBack: true,
							});
						}
						parked.push({ from: park, to: live });
						removed.push(version);
					}
				}

				delete state.data.modules[id];
				try {
					await writeInstalled(state.data);
				} catch (error) {
					const ledgerProblem = error instanceof StateCommitError ? error.message : null;
					const problems = await restoreParked();
					if (ledgerProblem || problems.length) {
						return failure(
							INSTALL_CODES.ROLLBACK_FAILED,
							`卸载状态未能回滚：${[ledgerProblem, problems.length ? problems.join("；") : null].filter(Boolean).join("；")}`,
							{
								stage: "state",
								id,
								rolledBack: false,
								residual: [error.residual, problems.length ? root : null].filter(Boolean).join("、"),
							}
						);
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
				for (const dir of debris) {
					try {
						await io.removeTree(dir);
					} catch (error) {
						notes.push(`让位残骸清理失败（不影响卸载结果，可手工删 ${dir}）: ${error?.message ?? error}`);
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
		 * 健康检查（任务书§49）：只探测、不写任何状态，供启动注册阶段与界面调用。
		 * @param {string} id
		 * @returns {Promise<Object>} success({id, version, previousVersion, status, reasons, action})
		 */
		async verifyInstalled(id) {
			if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
			const state = await readInstalled();
			if (!state.ok) return state;
			const entry = state.data.modules[id];
			if (!entry) return failure(INSTALL_CODES.NOT_INSTALLED, `${id} 不在安装台账里`, { stage: "checking", id });

			const version = entry.version;
			const previousVersion = entry.previousVersion || null;
			let probe;
			let previousProbe;
			try {
				probe = await probeModuleVersion(id, version);
				if (previousVersion) previousProbe = await probeModuleVersion(id, previousVersion);
			} catch (error) {
				return toIoFailure(error, "checking", { id, message: `检查 ${id} 的健康状况失败: ${error?.message ?? error}` });
			}
			const plan = planRepair({ id, version, previousVersion, probe, previousProbe });
			return success({ id, version, previousVersion, ...plan });
		},

		/**
		 * 回退到台账记的上一版（§49 自动恢复的后半段，也可手动调用）。
		 *
		 * 顺序：先验上一版健康（坏的不许换上来）→ 当前（坏）目录改名 `.corrupt-<版本>-<随机>` 留证 →
		 * 写台账把 version 指回上一版。任一步失败都把已改名的目录改回原位，按 ROLLBACK_FAILED +
		 * residual 如实上报，绝不留下"台账说装着、盘上没有"。
		 *
		 * 使用中的样式也能回退——修复优先，重载后生效（结果里带 requiresReload）。
		 * @param {string} id
		 * @param {{version?: string}} [opts] - 缺省用台账里的 previousVersion
		 */
		async rollback(id, opts = {}) {
			if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口，安装器不可用");
			const state = await readInstalled();
			if (!state.ok) return state;
			const entry = state.data.modules[id];
			if (!entry) return failure(INSTALL_CODES.NOT_INSTALLED, `${id} 不在安装台账里`, { stage: "checking", id });

			const current = entry.version;
			const target = opts.version || entry.previousVersion;
			if (!target) {
				return failure(INSTALL_CODES.NO_ROLLBACK, `${id} 没有记录上一版本，无法回退（可重装）`, { stage: "checking", id });
			}
			if (String(target) === String(current)) {
				return failure(INSTALL_CODES.NO_ROLLBACK, `${id} 的上一版与当前版都是 ${current}，无需回退`, { stage: "checking", id });
			}

			let targetProbe;
			try {
				targetProbe = await probeModuleVersion(id, target);
			} catch (error) {
				return toIoFailure(error, "checking", { id, message: `检查上一版 ${target} 失败: ${error?.message ?? error}` });
			}
			const health = assessModule({ id, version: target, ...targetProbe });
			if (!health.ok) {
				return failure(INSTALL_CODES.NO_ROLLBACK, `上一版 ${target} 不可用（${health.reasons.join("；")}），请重装`, {
					stage: "checking",
					id,
					target,
					reasons: health.reasons,
				});
			}

			// 坏目录改名留证；目录本来就不在（也是损坏的一种）就跳过这一步
			let parked = null;
			const currentDir = packDir(id, current);
			try {
				if ((await kindOf(currentDir)) === "dir") {
					parked = `${paths.modulesRoot}/${id}/.corrupt-${current}-${random()}`;
					await io.movePath(currentDir, parked);
				}
			} catch (error) {
				return toIoFailure(error, "publishing", { id, message: `让位损坏目录失败: ${error?.message ?? error}` });
			}

			const next = { ...state.data, modules: { ...state.data.modules } };
			next.modules[id] = { ...entry, version: target };
			delete next.modules[id].previousVersion;   // 坏版本不再充当"可回退的上一版"
			try {
				await writeInstalled(next);
			} catch (error) {
				if (parked) {
					try {
						await io.movePath(parked, currentDir);
					} catch (restoreError) {
						return failure(INSTALL_CODES.ROLLBACK_FAILED, `回退 ${id} 失败（台账写失败：${error?.message ?? error}），且损坏目录改回失败：${restoreError?.message ?? restoreError}`, {
							stage: "state",
							id,
							rolledBack: false,
							residual: parked,
						});
					}
				}
				return failure(INSTALL_CODES.ROLLBACK_FAILED, `回退 ${id} 失败：台账未更新（${error?.message ?? error}）`, {
					stage: "state",
					id,
					rolledBack: true,
				});
			}

			return success({
				id,
				version: target,
				from: current,
				parked,
				requiresReload: true,
				message: `${id} 已回退到 ${target}${parked ? `（损坏的 ${current} 已改名为 ${parked}）` : `（原本就没有 ${current} 目录）`}`,
			});
		},

		/**
		 * 列出某模块本地已有的版本目录（P12 回滚/清理用）。
		 * 让位/删除/隔离中的 `.replacing-*`、`.removing-*`、`.corrupt-*` 一律不算"可用版本"。
		 * @param {string} id
		 */
		async localVersions(id) {
			if (!io) return failure(INSTALL_CODES.NO_IO, "未注入文件系统端口");
			const root = `${paths.modulesRoot}/${id}`;
			// 探测失败 ≠ "本地没有版本"：P12 的回滚/清理界面据此决策，误报空列表会诱导误删
			let rootKind;
			try {
				rootKind = await kindOf(root);
			} catch (error) {
				return toIoFailure(error, "listing", { id, message: `检查 ${root} 失败: ${error?.message ?? error}` });
			}
			if (rootKind !== "dir") return success({ id, versions: [] });
			try {
				const { dirs } = await io.listDir(root);
				return success({ id, versions: versionDirs(dirs) });
			} catch (error) {
				return toIoFailure(error, "listing", { message: `列举 ${root} 失败: ${error?.message ?? error}` });
			}
		},
	};
}
