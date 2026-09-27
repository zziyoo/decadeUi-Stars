/**
 * @fileoverview P5 安装器的落地适配层（noname 运行时侧）
 *
 * 分层：PackageInstaller 只依赖注入的 io / extractZip 端口（纯逻辑、可在 Node 测试）；
 * 本文件提供端口的**运行时实现**，全部复用本体既有能力，不另建文件/解压系统（任务书§56禁止1）：
 *   - 读写列删：game.promises.{readFile,readFileAsText,writeFile,getFileList,removeFile,removeDir}
 *   - 存在性：game.checkFile（1=文件 0=目录 -1=不存在）
 *   - 改名（发布/回滚的原子切换）：lib.node.fs.rename，缺失时回落 copy+remove
 *   - ZIP：window.JSZip，加载方式与 app.importPlugin 完全一致（lib.init.js 本体自带 jszip）
 *
 * 路径约定：端口一律接受**扩展根相对**的 POSIX 路径（如 `modules/decade/1.5.0/manifest.json`），
 * 由本文件在调用期拼 `extension/<decadeUIName>/` 前缀。禁止在模块求值期引用 decadeUIName（P2 规则）。
 */
import { lib, game } from "noname";

/** 扩展根（文件系统视角，相对本体 __dirname）；调用期求值 */
const extRoot = () => `extension/${(typeof window !== "undefined" && window.decadeUIName) || "十周年UI-Stars"}`;
const toPosix = path => String(path).split("\\").join("/");
const abs = rel => {
	const cleaned = toPosix(rel).replace(/^\/+/, "");
	// 端口自身再挡一次路径上跳：安装器的临时目录名来自外部索引，不能相信任何输入
	if (cleaned.split("/").includes("..")) throw new Error(`[ModuleIo] 路径越出扩展根: ${rel}`);
	return `${extRoot()}/${cleaned}`;
};
const dirOf = rel => {
	const parts = abs(rel).split("/");
	parts.pop();
	return parts.join("/");
};
const nameOf = rel => abs(rel).split("/").pop();

/** 回调式本体 API → Promise，并把"不存在"归一化为 null 而非抛错 */
const checkKind = rel =>
	new Promise(resolve => {
		if (typeof game?.checkFile !== "function") {
			resolve(null);
			return;
		}
		game.checkFile(
			abs(rel),
			code => resolve(code === 1 ? "file" : code === 0 ? "dir" : null),
			() => resolve(null)
		);
	});

/**
 * 创建文件系统端口
 * @returns {Object} io
 */
export function createNonameIo() {
	/** 递归复制（rename 不可用时的发布回落路径） */
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

	async function removeTree(rel) {
		const kind = await checkKind(rel);
		if (kind === "file") {
			await game.promises.removeFile(abs(rel));
			return;
		}
		if (kind !== "dir") return;
		const { dirs, files } = await listDir(rel);
		for (const file of files) {
			await game.promises.removeFile(abs(`${rel}/${file}`));
		}
		for (const dir of dirs) {
			await removeTree(`${rel}/${dir}`);
		}
		try {
			await game.promises.removeDir(abs(rel));
		} catch {
			// 浏览器/cordova 无递归删目录能力时，空目录残留不影响模块根解析（Manifest 版本目录才是寻址依据）
		}
	}

	const listDir = async rel => {
		const kind = await checkKind(rel);
		if (kind !== "dir") return { dirs: [], files: [] };
		const [folders, files] = await game.promises.getFileList(abs(rel));
		return { dirs: folders || [], files: files || [] };
	};

	const readBinary = async rel => {
		const kind = await checkKind(rel);
		if (kind !== "file") return null;
		const data = await game.promises.readFile(abs(rel));
		if (data instanceof ArrayBuffer) return data;
		if (ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
		return new Uint8Array(data).buffer;
	};

	const writeBinary = async (rel, data) => {
		const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
		await game.promises.writeFile(bytes, dirOf(rel), nameOf(rel));
	};

	const io = {
		kind: checkKind,
		exists: async rel => (await checkKind(rel)) !== null,
		readText: async rel => {
			const kind = await checkKind(rel);
			return kind === "file" ? await game.promises.readFileAsText(abs(rel)) : null;
		},
		writeText: async (rel, text) => {
			await game.promises.writeFile(String(text), dirOf(rel), nameOf(rel));
		},
		readBinary,
		writeBinary,
		listDir,
		removeFile: async rel => {
			if ((await checkKind(rel)) === "file") await game.promises.removeFile(abs(rel));
		},
		removeTree,
		copyTree,
		/** 目录/文件改名：桌面端 fs.rename（同卷原子）；不可用时 copy+remove */
		movePath: async (srcRel, destRel) => {
			const fs = lib.node?.fs;
			if (typeof fs?.rename === "function") {
				await new Promise((resolve, reject) => {
					const from = abs(srcRel);
					const to = abs(destRel);
					fs.mkdir?.(dirOf(destRel), { recursive: true }, () => {
						fs.rename(from, to, error => (error ? reject(error) : resolve()));
					});
				});
				return;
			}
			if ((await checkKind(srcRel)) === "dir") {
				await copyTree(srcRel, destRel);
				await removeTree(srcRel);
			} else {
				const buffer = await readBinary(srcRel);
				if (buffer === null) throw new Error(`[ModuleIo] move 源不存在: ${srcRel}`);
				await writeBinary(destRel, buffer);
				await io.removeFile(srcRel);
			}
		},
	};

	return io;
}

/** 本体自带 JSZip 的就绪（与 app.importPlugin 同一加载路径，避免第二套解压方案） */
function jsZipReady() {
	return new Promise(resolve => {
		if (window.JSZip) return resolve(window.JSZip);
		lib.init.js(`${lib.assetURL}game`, "jszip", () => resolve(window.JSZip));
	});
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
 * @returns {{extract: (buffer: ArrayBuffer, targetRelDir: string, onEntry?: (done: number, total: number) => void) => Promise<string[]>}}
 */
export function createZipExtractor() {
	return {
		/**
		 * 解压到扩展根下的目标目录，返回落地的相对路径列表。
		 * JSZip 2.x 用法与 app.importPlugin 保持一致（new JSZip(data) + files[i].asNodeBuffer/asArrayBuffer）。
		 */
		async extract(buffer, targetRelDir, onEntry) {
			const JSZip = await jsZipReady();
			if (!JSZip) throw new Error("[ModuleIo] JSZip 不可用，无法解压模块包");
			const zip = new JSZip(buffer);
			const io = createNonameIo();
			const entries = Object.keys(zip.files || {})
				.filter(raw => !/\/$/.test(raw) && !zip.files[raw].dir)
				.map(raw => ({ raw, rel: normalizeZipEntry(raw) }));
			const isNode = !!lib.node?.fs;
			let done = 0;

			for (const { raw, rel } of entries) {
				const file = zip.files[raw];
				const data = isNode ? file.asNodeBuffer() : file.asArrayBuffer();
				await io.writeBinary(`${targetRelDir}/${rel}`, data);
				done++;
				if (onEntry) onEntry(done, entries.length);
			}
			return entries.map(({ rel }) => `${targetRelDir}/${rel}`);
		},
	};
}
