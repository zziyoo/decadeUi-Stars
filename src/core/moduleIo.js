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
 *
 * 路径约定：端口接受**扩展根相对**的 POSIX 路径（如 `modules/decade/1.5.0/manifest.json`），
 * 调用期拼 `extension/<decadeUIName>/` 前缀。禁止在模块求值期引用 decadeUIName（P2 规则）。
 */
import { lib as nonameLib, game as nonameGame } from "noname";

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

	// ---------------------------------------------------------- 桌面端（Node fs）

	const desktopListDir = rel =>
		settle(
			(ok, err) => {
				const target = abs(rel);
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
				if (!dir || dir === extRoot()) return ok(null);
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
				const target = abs(rel);
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
				const target = abs(rel);
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
					fs.stat(abs(rel), (error, stat) => {
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
			const buffer = await settle((ok, err) => fs.readFile(abs(rel), (error, data) => (error ? err(error) : ok(data))), {
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
			return settle((ok, err) => fs.unlink(abs(rel), error => (error && error.code !== "ENOENT" ? err(error) : ok(null))), {
				label: `unlink ${rel}`,
				stallMs,
			});
		}
		return legacyRemoveFile(rel);
	}

	const io = {
		/** 端口能力探测：桌面端 rename 同卷原子，其它平台为 copy+remove（非原子） */
		capabilities: { atomicRename: !!(fs && typeof fs.rename === "function"), desktop: !!fs },
		kind,
		readText: async rel => {
			if (fs) {
				if ((await kind(rel)) !== "file") return null;
				return settle((ok, err) => fs.readFile(abs(rel), "utf8", (error, text) => (error ? err(error) : ok(text))), { label: `read ${rel}`, stallMs });
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
		 * 非原子分支的顺序是硬约束：读源 → 写目标 → 回读逐字节校验 → 才删源；
		 * 任一步失败都保持"源还在、旧目标未被提前删除"，让上层（writeInstalled 的备份）有恢复来源。
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
				const from = abs(srcRel);
				const to = abs(destRel);
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
				const buffer = await readBinary(srcRel);
				if (buffer === null) throw new IoError("IO_FAILED", `[ModuleIo] move 源文件不可读: ${srcRel}`);
				await writeBinary(destRel, buffer);
				const landed = await readBinary(destRel);
				if (!sameBytes(landed, buffer)) {
					throw new IoError("IO_FAILED", `[ModuleIo] move 目标内容校验不一致（源已保留）: ${srcRel} → ${destRel}`);
				}
				await removeFile(srcRel);
				return;
			}
			await copyTree(srcRel, destRel);
			await removeTree(srcRel);
		},
	};

	return io;
}

/** 本体自带 JSZip 的就绪（与 app.importPlugin 同一加载路径，避免第二套解压方案） */
function defaultLoadJsZip({ lib = nonameLib, stallMs = DEFAULT_STALL_MS } = {}) {
	return settle(
		(ok, err) => {
			if (typeof window !== "undefined" && window.JSZip) return ok(window.JSZip);
			if (typeof lib?.init?.js !== "function") return err(new Error("无法加载 JSZip（lib.init.js 不可用）"));
			lib.init.js(`${lib.assetURL ?? ""}game`, "jszip", () => {
				if (window.JSZip) return ok(window.JSZip);
				err(new Error("JSZip 加载后仍不可用"));
			});
		},
		{ label: "加载 JSZip", stallMs }
	);
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
 * @param {Function} [options.loadJsZip] - JSZip 装载函数
 * @returns {{extract: (buffer: ArrayBuffer, targetRelDir: string, onEntry?: Function) => Promise<string[]>}}
 */
export function createZipExtractor(options = {}) {
	const io = options.io ?? createNonameIo(options);
	const loadJsZip = options.loadJsZip ?? (async () => defaultLoadJsZip(options));

	return {
		/**
		 * 解压到扩展根下的目标目录，返回落地的相对路径列表。
		 * JSZip 2.x 用法与 app.importPlugin 保持一致（new JSZip(data) + files[i].asNodeBuffer/asArrayBuffer）。
		 */
		async extract(buffer, targetRelDir, onEntry) {
			const JSZip = await loadJsZip();
			if (!JSZip) throw new Error("[ModuleIo] JSZip 不可用，无法解压模块包");
			const zip = new JSZip(buffer);
			const entries = Object.keys(zip.files || {})
				.filter(raw => !/\/$/.test(raw) && !zip.files[raw].dir)
				.map(raw => ({ raw, rel: normalizeZipEntry(raw) }));
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
