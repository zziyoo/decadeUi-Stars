/**
 * @fileoverview P5 安装器的落地适配层（noname 运行时侧）
 *
 * 分层：PackageInstaller 只依赖注入的 io / extractZip 端口（纯逻辑、可在 Node 测试）；
 * 本文件提供端口的**运行时实现**，复用本体既有能力，不另建文件/解压系统（任务书§56禁止1）。
 *
 * 可靠性契约（P5 审查后收紧）：**端口永远不会永久 pending**，任一路径都会落定：
 *   - 桌面端（lib.node.fs 可用）全部走 Node fs 的真实 error callback，
 *     目录创建用自建递归 mkdir 取代本体 game.ensureDirectory
 *     （后者的失败路径只 console.log、既不回调也不抛出，会让 game.promises.writeFile 永挂）。
 *   - 无 Node fs 的平台回落到 game.* 回调：先 game.createDir（有真实 errorCallback）
 *     把 ensureDirectory 的风险路径变成"目录已存在"的快路径，再写文件。
 *   - 兜底 watchdog：仅用于"本体既不成功也不失败地回调"这一类卡死，
 *     以 ioCode=IO_STALL **reject**（绝不静默当成成功），真实错误优先于兜底。
 *
 * 原子性如实描述：同卷 rename 是原子的；跨卷（EXDEV）与非 Node 平台走 copy+remove，
 * **不是原子操作**，中途失败会留下部分副本——调用方必须按"可能残留"处理（清理+结构化错误）。
 * 平台差异（本体 init/cordova.js，Node 侧无法验证）：其 writeFile 走 `getFile({create:true})` +
 * FileWriter.write()，既可能因目标已存在而失败，也可能不截断而留下尾部残字节；因此非原子搬运
 * 一律"写后回读逐字节校验"，校验不过就保留源、按失败上报。
 * 文件搬运额外带目标事务（见 moveFileNonAtomic）：先把内容暂存校验、再备份旧目标、提交后回读校验，
 * 失败就把旧目标恢复回原内容；恢复不了 → ioCode=IO_ROLLBACK_FAILED + residual，绝不静默成功。
 *
 * 路径约定：端口接受**扩展根相对**的 POSIX 路径（如 `modules/decade/1.5.0/manifest.json`），
 * 调用期拼 `extension/<decadeUIName>/` 前缀。禁止在模块求值期引用 decadeUIName（P2 规则）。
 */
import { lib as nonameLib, game as nonameGame, get as nonameGet } from "noname";

/** IO 失败带 code，供安装器区分"卡死兜底"与"真实错误" */
export class IoError extends Error {
	constructor(code, message, cause) {
		super(message);
		this.name = "IoError";
		this.ioCode = code;
		if (cause) this.cause = cause;
	}
}

/** 扩展根（文件系统视角，相对本体 __dirname）；调用期求值 */
const extRoot = () => `extension/${(typeof window !== "undefined" && window.decadeUIName) || "十周年UI-Stars"}`;
const toPosix = path => String(path).split("\\").join("/");
const safeRel = rel => {
	const cleaned = toPosix(rel).replace(/^\/+/, "");
	// 端口自身再挡一次路径上跳：安装器的临时目录名来自外部索引，不能相信任何输入
	if (cleaned.split("/").includes("..")) throw new IoError("IO_UNSAFE_PATH", `[ModuleIo] 路径越出扩展根: ${rel}`);
	return cleaned;
};
const dirOf = path => {
	const parts = path.split("/");
	parts.pop();
	return parts.join("/");
};
const nameOf = path => path.split("/").pop();
/** 逐字节比对（非原子平台搬运后必须自己验证落盘内容，回调"成功"不代表内容一致） */
const sameBytes = (a, b) => {
	if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer) || a.byteLength !== b.byteLength) return false;
	const left = new Uint8Array(a);
	const right = new Uint8Array(b);
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return false;
	}
	return true;
};

/** 事务临时件后缀：同目录并发搬运也不撞名 */
let txnSeq = 0;
const txnId = () => `${Date.now().toString(36)}-${(txnSeq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 旧目标恢复失败：与普通 IO 失败分开上报（ioCode + residual），调用方不得当成可忽略的错误 */
const rollbackFailed = (message, residual, cause) => {
	const error = new IoError("IO_ROLLBACK_FAILED", message, cause);
	error.residual = residual;
	return error;
};

/** 默认卡死兜底：真实回调永远优先，只有本体彻底不回调时才判失败 */
const DEFAULT_STALL_MS = 15000;

/**
 * 回调式 API → 只落定一次的 Promise。
 * @param {(ok: Function, err: Function) => void} run
 * @param {{label: string, stallMs: number}} meta
 */
function settle(run, { label, stallMs }) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let timer = null;
		const finish = (fn, value) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			fn(value);
		};
		if (stallMs > 0) {
			timer = setTimeout(() => finish(reject, new IoError("IO_STALL", `[ModuleIo] ${label} 无响应：本体回调未触发（已按失败处理，不当作成功）`)), stallMs);
			if (typeof timer?.unref === "function") timer.unref();
		}
		const ok = value => finish(resolve, value === undefined ? null : value);
		const err = error => finish(reject, error instanceof IoError ? error : new IoError("IO_FAILED", `[ModuleIo] ${label} 失败: ${error?.message ?? error}`, error));
		try {
			run(ok, err);
		} catch (thrown) {
			err(thrown);
		}
	});
}

/**
 * 创建文件系统端口
 * @param {Object} [options]
 * @param {Object} [options.game] - 注入本体 game（测试替身）
 * @param {Object} [options.lib] - 注入本体 lib（测试替身）
 * @param {Object|null} [options.fs] - 强制指定 Node fs（缺省取 lib.node.fs）
 * @param {number} [options.stallMs] - 卡死兜底时长，0 关闭
 * @returns {Object} io
 */
export function createNonameIo(options = {}) {
	const game = options.game ?? nonameGame;
	const lib = options.lib ?? nonameLib;
	const fs = "fs" in options ? options.fs : (lib?.node?.fs ?? null);
	const stallMs = options.stallMs ?? DEFAULT_STALL_MS;
	const abs = rel => `${extRoot()}/${safeRel(rel)}`;
	/**
	 * 裸 fs 的绝对基准。本体在 node 初始化时把 window.__dirname 归一成"应用根"
	 * （noname/init/node.js：electron.asar/renderer → resourcesPath/app，否则 resolve()/resources/app），
	 * 本体文件 API 全用它；而裸 fs 的相对路径基准是 process.cwd()，两者可能不一致
	 * （本机 Electron/dev 环境实测不一致：文件明明在，stat 却 ENOENT，而 kind() 会把 ENOENT 当"不存在"
	 * → installed.json 读成空台账、模块管理窗口把所有已装模块显示成"未安装"）。
	 * 拿不到 window.__dirname 时回落相对形式（Node 测试桩、非 Electron 平台）。
	 */
	const fsRoot = () => {
		const base = typeof window !== "undefined" && typeof window.__dirname === "string" ? toPosix(window.__dirname).replace(/\/+$/, "") : "";
		return base ? `${base}/${extRoot()}` : extRoot();
	};
	/** 只有桌面（Node fs）分支用绝对路径；game.* 回调分支仍用相对路径（本体自己拼 __dirname） */
	const fsAbs = rel => `${fsRoot()}/${safeRel(rel)}`;

	// ---------------------------------------------------------- 桌面端（Node fs）

	const desktopListDir = rel =>
		settle(
			(ok, err) => {
				const target = fsAbs(rel);
				fs.readdir(target, (error, names) => {
					if (error) {
						if (error.code === "ENOENT" || error.code === "ENOTDIR") return ok({ dirs: [], files: [] });
						return err(error);
					}
					const dirs = [];
					const files = [];
					// 与本体 getFileList 一致：跳过 . 与 _ 开头的条目（.removing-/.replacing- 让位目录因此不会被当版本目录）
					const visible = names.filter(name => name[0] !== "." && name[0] !== "_");
					const next = index => {
						if (index >= visible.length) return ok({ dirs, files });
						fs.stat(`${target}/${visible[index]}`, (statError, stat) => {
							if (statError) return err(statError);
							(stat.isDirectory() ? dirs : files).push(visible[index]);
							next(index + 1);
						});
					};
					if (!visible.length) return ok({ dirs, files });
					next(0);
				});
			},
			{ label: `listDir ${rel}`, stallMs }
		);

	const desktopMkdir = dir =>
		settle(
			(ok, err) => {
				if (!dir || dir === fsRoot()) return ok(null);
				fs.mkdir(dir, { recursive: true }, error => {
					if (error && error.code !== "EEXIST") return err(error);
					ok(null);
				});
			},
			{ label: `mkdir ${dir}`, stallMs }
		);

	const desktopWrite = (rel, data, encoding) =>
		settle(
			(ok, err) => {
				const target = fsAbs(rel);
				fs.mkdir(dirOf(target), { recursive: true }, mkdirError => {
					// 目录创建失败必须真的抛出：绝不让 game.ensureDirectory 那种"静默挂起"重现
					if (mkdirError && mkdirError.code !== "EEXIST") return err(mkdirError);
					fs.writeFile(target, data, encoding === "utf8" ? "utf8" : undefined, writeError => (writeError ? err(writeError) : ok(null)));
				});
			},
			{ label: `write ${rel}`, stallMs }
		);

	const desktopRemoveTree = rel =>
		settle(
			(ok, err) => {
				const target = fsAbs(rel);
				if (typeof fs.rm === "function") {
					fs.rm(target, { recursive: true, force: true }, error => (error ? err(error) : ok(null)));
					return;
				}
				fs.rmdir(target, { recursive: true }, error => (error && error.code !== "ENOENT" ? err(error) : ok(null)));
			},
			{ label: `removeTree ${rel}`, stallMs }
		);

	// ------------------------------------------------------ 非桌面端（game 回调）

	const legacyKind = rel =>
		settle(
			(ok, err) => {
				if (typeof game?.checkFile !== "function") return ok(null);
				game.checkFile(abs(rel), code => ok(code === 1 ? "file" : code === 0 ? "dir" : null), err);
			},
			{ label: `check ${rel}`, stallMs }
		);

	/** 先 createDir（本体实现有真实 errorCallback），把 game.writeFile 内部 ensureDirectory 的失败面挪到可观测处 */
	const legacyPrepareDir = rel =>
		settle(
			(ok, err) => {
				const dir = dirOf(abs(rel));
				if (typeof game?.createDir !== "function") return ok(null);
				game.createDir(dir, () => ok(null), err);
			},
			{ label: `createDir ${dirOf(rel)}`, stallMs }
		);

	const legacyWrite = (rel, data) =>
		settle(
			(ok, err) => {
				// 本体 game.writeFile 的 callback 在写失败时收到 Error 对象（并非抛出），两种都要转成 reject
				game.writeFile(data, dirOf(abs(rel)), nameOf(rel), result => {
					if (result instanceof Error) return err(result);
					ok(null);
				});
			},
			{ label: `write ${rel}`, stallMs }
		);

	const legacyRemoveFile = rel =>
		settle(
			(ok, err) => game.removeFile(abs(rel), error => (error instanceof Error ? err(error) : ok(null))),
			{ label: `removeFile ${rel}`, stallMs }
		);

	// ---------------------------------------------------------- 统一端口实现

	async function kind(rel) {
		if (fs) {
			return settle(
				(ok, err) => {
					fs.stat(fsAbs(rel), (error, stat) => {
						if (!error) return ok(stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other");
						if (error.code === "ENOENT" || error.code === "ENOTDIR") return ok(null);
						err(error);
					});
				},
				{ label: `stat ${rel}`, stallMs }
			);
		}
		return legacyKind(rel);
	}

	async function readBinary(rel) {
		if ((await kind(rel)) !== "file") return null;
		if (fs) {
			const buffer = await settle((ok, err) => fs.readFile(fsAbs(rel), (error, data) => (error ? err(error) : ok(data))), {
				label: `read ${rel}`,
				stallMs,
			});
			if (buffer instanceof ArrayBuffer) return buffer;
			if (ArrayBuffer.isView(buffer)) return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
			return new Uint8Array(buffer).buffer;
		}
		const data = await settle((ok, err) => game.readFile(abs(rel), ok, err), { label: `read ${rel}`, stallMs });
		if (data instanceof ArrayBuffer) return data;
		if (ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
		return new Uint8Array(data).buffer;
	}

	async function writeBinary(rel, data) {
		const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
		if (fs) return desktopWrite(rel, bytes);
		await legacyPrepareDir(rel);
		return legacyWrite(rel, bytes);
	}

	async function listDir(rel) {
		if (fs) return desktopListDir(rel);
		if ((await kind(rel)) !== "dir") return { dirs: [], files: [] };
		const [dirs = [], files = []] = await settle((ok, err) => game.getFileList(abs(rel), (folders, found) => ok([folders, found]), err), {
			label: `listDir ${rel}`,
			stallMs,
		});
		return { dirs, files };
	}

	async function removeTree(rel) {
		const current = await kind(rel);
		if (current === null) return;
		if (fs) return desktopRemoveTree(rel);
		if (current === "file") return legacyRemoveFile(rel);
		const { dirs, files } = await listDir(rel);
		for (const file of files) {
			await legacyRemoveFile(`${rel}/${file}`);
		}
		for (const dir of dirs) {
			await removeTree(`${rel}/${dir}`);
		}
		await settle(
			(ok, err) => {
				if (typeof game?.removeDir !== "function") return ok(null);
				game.removeDir(abs(rel), () => ok(null), err);
			},
			{ label: `removeDir ${rel}`, stallMs }
		);
	}

	async function copyTree(srcRel, destRel) {
		const { dirs, files } = await listDir(srcRel);
		for (const file of files) {
			const buffer = await readBinary(`${srcRel}/${file}`);
			if (buffer !== null) await writeBinary(`${destRel}/${file}`, buffer);
		}
		for (const dir of dirs) {
			await copyTree(`${srcRel}/${dir}`, `${destRel}/${dir}`);
		}
	}

	async function removeFile(rel) {
		if ((await kind(rel)) !== "file") return;
		if (fs) {
			return settle((ok, err) => fs.unlink(fsAbs(rel), error => (error && error.code !== "ENOENT" ? err(error) : ok(null))), {
				label: `unlink ${rel}`,
				stallMs,
			});
		}
		return legacyRemoveFile(rel);
	}

	/**
	 * 非原子平台的**文件**搬运事务（本平台没有 rename，覆盖写可能失败或半截）。
	 * 只处理 file → file，目录搬运不得走这里。
	 *
	 * 不变量：
	 *   成功                   → dest = 源内容（逐字节校验过），源已删除
	 *   提交未完成             → 源保留；dest 原本存在则恢复旧内容，原本不存在则不留半成品
	 *   提交已校验但源清理失败 → 明确报 IO_FAILED，且**不回滚已提交的 dest**（源残留，内容与目标一致）
	 *   旧目标恢复失败         → IO_ROLLBACK_FAILED + residual，并保留备份/临时件供人工恢复
	 *
	 * 顺序：读源 → 写临时目标并校验（此时正式目标一个字节都没动）→ 备份旧目标 →
	 * 写正式目标并校验 → 删源 → 清理事务件。
	 * 提交那一步就是普通 writeBinary（本平台的覆盖写），所以旧目标必须先有恢复来源（内存副本 + 落盘备份）；
	 * 绝不递归调用本端口的 movePath 去做"原子替换"——那个语义在本平台并不存在。
	 */
	async function moveFileNonAtomic(srcRel, destRel) {
		const source = await readBinary(srcRel);
		if (source === null) throw new IoError("IO_FAILED", `[ModuleIo] move 源文件不可读: ${srcRel}`);

		const destKind = await kind(destRel);
		if (destKind !== null && destKind !== "file") {
			throw new IoError("IO_FAILED", `[ModuleIo] move 目标类型不是文件（拒绝覆盖）: ${destRel} → ${destKind}`);
		}

		const txn = txnId();
		const tempDest = `${destRel}.moving-${txn}`;
		const backupDest = destKind === "file" ? `${destRel}.moving-backup-${txn}` : null;
		/** @type {ArrayBuffer|null} 旧目标内容（内存副本，回滚时用它写回，比读备份文件少一步） */
		let previous = null;

		const cleanup = async () => {
			const leftovers = [];
			for (const rel of [tempDest, backupDest]) {
				if (!rel) continue;
				try {
					await removeFile(rel);
				} catch {
					leftovers.push(rel);
				}
			}
			return leftovers;
		};

		/** 提交失败后的恢复：旧目标原本存在 → 写回旧内容；原本不存在 → 清掉半成品。返回问题描述（null=已恢复） */
		const restoreDest = async () => {
			const problems = [];
			if (backupDest) {
				try {
					// 先核对：提交那一步可能根本没写进去（例如直接被拒绝），此时旧目标完好，不必再冒一次写失败的风险
					if (sameBytes(await readBinary(destRel), previous)) return null;
				} catch {}
				try {
					await writeBinary(destRel, previous);
					const restored = await readBinary(destRel);
					if (!sameBytes(restored, previous)) problems.push(`${destRel} 写回后内容仍不一致`);
				} catch (error) {
					problems.push(`写回 ${destRel} 失败: ${error?.message ?? error}`);
				}
			} else {
				try {
					await removeFile(destRel);
					if ((await readBinary(destRel)) !== null) problems.push(`${destRel} 的半成品仍然存在`);
				} catch (error) {
					problems.push(`清理 ${destRel} 半成品失败: ${error?.message ?? error}`);
				}
			}
			return problems.length ? problems.join("；") : null;
		};

		// 阶段一：暂存与备份（正式目标尚未被触碰）
		try {
			await writeBinary(tempDest, source);
			const staged = await readBinary(tempDest);
			if (!sameBytes(staged, source)) {
				throw new IoError("IO_FAILED", `[ModuleIo] move 临时目标校验失败（源与目标均未动）: ${srcRel} → ${tempDest}`);
			}
			if (backupDest) {
				previous = await readBinary(destRel);
				if (previous === null) throw new IoError("IO_FAILED", `[ModuleIo] 旧目标不可读，无法保证可恢复: ${destRel}`);
				await writeBinary(backupDest, previous);
				if (!sameBytes(await readBinary(backupDest), previous)) {
					throw new IoError("IO_FAILED", `[ModuleIo] 旧目标备份校验失败（源与目标均未动）: ${destRel}`);
				}
			}
		} catch (error) {
			await cleanup();
			throw error;
		}

		// 阶段二：提交（唯一可能损坏正式目标的一步）
		try {
			await writeBinary(destRel, source);
			const landed = await readBinary(destRel);
			if (!sameBytes(landed, source)) {
				throw new IoError("IO_FAILED", `[ModuleIo] move 正式目标校验失败（源已保留）: ${srcRel} → ${destRel}`);
			}
		} catch (error) {
			const problem = await restoreDest();
			if (problem) {
				// 备份与临时件故意保留：它们是旧内容唯一可靠的落盘恢复来源
				throw rollbackFailed(
					`[ModuleIo] move 提交失败（${error?.message ?? error}），且旧目标恢复失败：${problem}`,
					[backupDest, tempDest, destRel].filter(Boolean),
					error
				);
			}
			await cleanup();
			throw error;
		}

		// 阶段三：提交已确认 —— 之后只做清理，任何清理问题都不得回滚目标
		let sourceProblem = null;
		try {
			await removeFile(srcRel);
		} catch (error) {
			sourceProblem = `${srcRel}: ${error?.message ?? error}`;
		}
		const leftovers = await cleanup();
		if (sourceProblem) {
			throw new IoError(
				"IO_FAILED",
				`[ModuleIo] move 已提交并校验 ${destRel}，但源文件删除失败：${sourceProblem}（源残留，未回滚目标${
					leftovers.length ? `；另有残留 ${leftovers.join("、")}` : ""
				}）`
			);
		}
		if (leftovers.length) {
			console.warn(`[ModuleIo] move 事务临时文件清理失败（不影响搬运结果，可手工删除）: ${leftovers.join("、")}`);
		}
	}

	const io = {
		/** 端口能力探测：桌面端 rename 同卷原子，其它平台为 copy+remove（非原子） */
		capabilities: { atomicRename: !!(fs && typeof fs.rename === "function"), desktop: !!fs },
		kind,
		readText: async rel => {
			if (fs) {
				if ((await kind(rel)) !== "file") return null;
				return settle((ok, err) => fs.readFile(fsAbs(rel), "utf8", (error, text) => (error ? err(error) : ok(text))), { label: `read ${rel}`, stallMs });
			}
			if ((await kind(rel)) !== "file") return null;
			return settle((ok, err) => game.readFileAsText(abs(rel), ok, err), { label: `read ${rel}`, stallMs });
		},
		writeText: async (rel, text) => {
			if (fs) return desktopWrite(rel, String(text), "utf8");
			await legacyPrepareDir(rel);
			return legacyWrite(rel, String(text));
		},
		readBinary,
		writeBinary,
		listDir,
		removeFile,
		removeTree,
		copyTree,
		/**
		 * 改名到位：桌面端同卷 rename（原子）；跨卷 EXDEV 或无 Node fs 平台走 copy+remove，
		 * **不是原子操作**——中途失败可能留下部分副本，调用方必须清理并返回结构化错误。
		 *
		 * 必须按源类型分流：copyTree 只列举目录条目，拿它搬**文件**会"一个字节都不复制、
		 * 却把源删掉"（Android/SAF 上表现为 installed.json 永远没被替换、临时文件消失）。
		 * 文件走 moveFileNonAtomic 的完整事务（暂存 → 校验 → 备份旧目标 → 提交 → 校验 → 删源），
		 * 目录仍然只是 copyTree + removeTree（本次不动目录事务）。
		 */
		movePath: async (srcRel, destRel) => {
			const sourceKind = await kind(srcRel);
			if (sourceKind === null) throw new IoError("IO_FAILED", `[ModuleIo] move 源不存在: ${srcRel}`);
			if (sourceKind !== "file" && sourceKind !== "dir") {
				throw new IoError("IO_FAILED", `[ModuleIo] move 源类型不支持（既不是文件也不是目录）: ${srcRel} → ${sourceKind}`);
			}
			// 自我搬运：不挡的话非原子分支会在"写回同一路径"之后把源删掉
			if (safeRel(srcRel) === safeRel(destRel)) return;
			if (fs && typeof fs.rename === "function") {
				const from = fsAbs(srcRel);
				const to = fsAbs(destRel);
				try {
					await desktopMkdir(dirOf(to));
					await settle((ok, err) => fs.rename(from, to, error => (error ? err(error) : ok(null))), { label: `rename ${srcRel}`, stallMs });
					return;
				} catch (error) {
					if (error?.code !== "EXDEV" && error?.cause?.code !== "EXDEV") throw error;
					// 跨卷：回落为非原子的 copy+remove
				}
			}
			if (sourceKind === "file") {
				await moveFileNonAtomic(srcRel, destRel);
				return;
			}
			await copyTree(srcRel, destRel);
			await removeTree(srcRel);
		},
	};

	return io;
}

/**
 * 取得可用的 JSZip **实例**（任务书§56禁止1：不另建解压系统、不 vendor 副本）
 *
 * 单位是实例而不是构造器——这条是实机打脸改的：jszip@2.7.0 用 `JSZip.prototype = {…}`
 * 的整体替换写法，prototype 上没有 `constructor` 属性，于是 `instance.constructor === Object`
 * （Node 里 import 本体那份 `_virtual/index2.js` 复核过）。所以"从 get.zip 给的实例上
 * 反推构造器"必然失败，真机 `ready()` 的 reason 就是那句「get.zip 交出的实例不带 2.x 的 load()」。
 * 2.x 的 `load()` 还是**原地写入**，复用实例会把上一个包的条目带进下一个 —— 每次解压现取一份，
 * 正好对上 `get.zip` 每次 `callback(new JSZip())` 的行为。
 *
 * 取证（2026-09-28 读本体源码）：jszip@2.7.0 在本体里是**内联 ES 模块**
 * （`noname/get/index.js`、`ui/create/menu/pages/optionsMenu.js` 都写
 * `import JSZip from "../../_virtual/index2.js"`），`noname.js` 里
 * `window.JSZip`/`globalThis.JSZip` 出现 0 次，`resources/app/game/jszip.js` 也不存在。
 *
 * 获取顺序（每级都要求实例带 2.x 的 `load()`；3.x 只有 `loadAsync`，一律拒——
 * 若当可用接受，`zip.files` 会是空，症状会伪装成"包结构非法"，比现在更难查）：
 *   1. `window.JSZip`——确实把 JSZip 挂过全局的环境；
 *   2. `get.zip(cb)`——**本体的公开 API**，实现就是 `callback(new JSZip())`；
 *   3. `lib.init.js(assetURL+"game", "jszip")`——仅某些把 jszip.js 放在 game 目录的构建。
 *
 * "哪一级可用"的选型只算一次并缓存（失败也缓存：探测带加载副作用，界面每刷新一次
 * 不该再白等一次 watchdog）；实例每次现取。任何一级都不许永久 pending（settle 兜底），
 * 全断统一落定为 `ioCode=NO_EXTRACTOR`，让界面诚实置灰而不是让玩家白下一遍包。
 * @param {Object} [deps]
 * @param {Object} [deps.win] - 全局对象（测试注入点）
 * @param {Object} [deps.get] - 本体的 get 命名空间（提供 zip）
 * @param {Object} [deps.lib] - 本体的 lib 命名空间（提供 assetURL 与 init.js）
 * @param {number} [deps.stallMs] - 单级探测的兜底超时
 * @returns {{createInstance: () => Promise<Object>, probe: () => Promise<{ok: boolean, reason: string}>}}
 */
export function createJsZipSource({ win, get = nonameGet, lib = nonameLib, stallMs = DEFAULT_STALL_MS } = {}) {
	const globalScope = win !== undefined ? win : typeof window !== "undefined" ? window : {};

	/** 2.x 实例的形状判据：有 load() 才算能用（3.x 只有 loadAsync，一律拒） */
	const usable = instance => !!instance && typeof instance.load === "function";

	/** 从全局构造器要一份新实例；拿不到或不合形状返回 null */
	const fromGlobal = () => {
		const Ctor = globalScope?.JSZip;
		if (typeof Ctor !== "function") return null;
		try {
			const instance = new Ctor();
			return usable(instance) ? instance : null;
		} catch {
			return null;
		}
	};

	const globalWorks = () => typeof globalScope?.JSZip === "function" && fromGlobal() !== null;

	const viaGetZip = () =>
		settle(
			(ok, err) => {
				if (typeof get?.zip !== "function") return err(new Error("本体未提供 get.zip"));
				get.zip(instance => {
					if (!usable(instance)) return err(new Error("get.zip 交出的实例不带 2.x 的 load()（JSZip 版本或形状不符）"));
					ok(instance);
				});
			},
			{ label: "get.zip 取 JSZip 实例", stallMs }
		);

	const viaScript = () =>
		settle(
			(ok, err) => {
				if (typeof lib?.init?.js !== "function") return err(new Error("本体未提供 lib.init.js"));
				// 这一级只负责"把脚本装上"；装完能不能用由 attempt() 再查一次全局
				lib.init.js(`${lib.assetURL ?? ""}game`, "jszip", () => ok(true));
			},
			{ label: "加载 game/jszip", stallMs }
		);

	/** 选型：成功则返回"每次调用给出一份新实例"的工厂 */
	const attempt = async () => {
		const reasons = [];
		if (globalWorks()) return () => Promise.resolve(fromGlobal());
		reasons.push("window.JSZip 不存在或不是 2.x 形状");

		try {
			await viaGetZip();
			return () => viaGetZip();
		} catch (error) {
			reasons.push(String(error?.message ?? error));
		}

		try {
			await viaScript();
			if (globalWorks()) return () => Promise.resolve(fromGlobal());
			reasons.push("脚本加载后 window.JSZip 仍不可用");
		} catch (error) {
			reasons.push(String(error?.message ?? error));
		}

		throw new IoError("NO_EXTRACTOR", `[ModuleIo] 取不到可用的 JSZip 实例（需要 2.x 的 load 接口）：${reasons.join("；")}`);
	};

	/**
	 * 选型缓存（**失败也缓存**）：探测本身带加载副作用，且 watchdog 兜底最长要等 stallMs，
	 * 每次都重探会让界面每刷新一次就白等一次。真机修好 JSZip 需要重载页面，重载时
	 * 本模块重新求值、缓存自然清空，所以不提供 reset。
	 * 注意缓存的是"哪一级可用"，实例本身每次解压现取（2.x 的 load() 原地写入）。
	 */
	let selected = null;
	const select = () => {
		if (!selected) {
			selected = attempt();
			selected.catch(() => {});
		}
		return selected;
	};

	return {
		/** 取一份干净的可用实例（每次解压各取一份，实例之间互不影响） */
		async createInstance() {
			const factory = await select();
			const instance = await factory();
			if (!usable(instance)) throw new IoError("NO_EXTRACTOR", "[ModuleIo] 取得的 JSZip 实例不带 load()，无法解压");
			return instance;
		},
		/** 给界面用的诚实探测口：可用 / 不可用 + 原因 */
		async probe() {
			try {
				await select();
				return { ok: true, reason: "" };
			} catch (error) {
				return { ok: false, reason: String(error?.message ?? error) };
			}
		},
	};
}

/**
 * ZIP 条目名安全检查（zip-slip 防护）：禁止绝对路径、盘符、`..` 上跳与空段。
 * 命中即抛错——模块包来自第三方下载，绝不能让它写到扩展根之外。
 * @param {string} entryName - ZIP 内的条目名
 * @returns {string} 归一化后的 POSIX 相对路径
 */
export function normalizeZipEntry(entryName) {
	const raw = String(entryName);
	const rel = toPosix(raw).replace(/^(\.\/)+/, "");
	if (!rel || raw.includes("\0") || raw.startsWith("/") || raw.startsWith("\\") || /^[a-zA-Z]:/.test(raw)) {
		throw new Error(`[ModuleIo] 非法包内路径: ${entryName}`);
	}
	if (rel.split("/").some(segment => segment === ".." || segment === "")) {
		throw new Error(`[ModuleIo] 包内路径越界: ${entryName}`);
	}
	return rel;
}

/**
 * 创建 ZIP 解压端口
 * @param {Object} [options]
 * @param {Object} [options.io] - 落地用的文件系统端口（缺省新建）
 * @param {Object} [options.jsZip] - JSZip 获取源（createJsZipSource 的返回值；缺省新建）
 * @returns {{extract: (buffer: ArrayBuffer, targetRelDir: string, onEntry?: Function) => Promise<string[]>, probe: () => Promise<{ok: boolean, reason: string}>}}
 */
export function createZipExtractor(options = {}) {
	const io = options.io ?? createNonameIo(options);
	const jsZip = options.jsZip ?? createJsZipSource(options);

	return {
		/** 解压能力是否真的可用（界面据此置灰，不再只看端口对象存不存在） */
		probe: () => jsZip.probe(),

		/**
		 * 解压到扩展根下的目标目录，返回落地的相对路径列表。
		 * 每次解压现取一份干净实例 + `zip.load(buffer)`——与本体 optionsMenu 的读法一字不差；
		 * 实例必须现取，因为 2.x 的 `load()` 是原地写入，复用会把上一个包的条目带进下一个。
		 * @param {ArrayBuffer} buffer - 下载落盘后回读到的包字节
		 * @param {string} targetRelDir - 扩展根相对目标目录
		 * @param {(done: number, total: number) => void} [onEntry]
		 */
		async extract(buffer, targetRelDir, onEntry) {
			const zip = await jsZip.createInstance();
			zip.load(buffer);
			const entries = Object.keys(zip.files || {})
				.filter(raw => !/\/$/.test(raw) && !zip.files[raw].dir)
				.map(raw => ({ raw, rel: normalizeZipEntry(raw) }));
			if (!entries.length) throw new IoError("STRUCTURE_INVALID", "[ModuleIo] 包内没有任何文件条目（解压结果为空）");
			const isNode = !!io.capabilities?.desktop;
			let done = 0;

			for (const { raw, rel } of entries) {
				const file = zip.files[raw];
				const data = isNode && typeof file.asNodeBuffer === "function" ? file.asNodeBuffer() : file.asArrayBuffer();
				await io.writeBinary(`${targetRelDir}/${rel}`, data);
				done++;
				if (onEntry) onEntry(done, entries.length);
			}
			return entries.map(({ rel }) => `${targetRelDir}/${rel}`);
		},
	};
}
