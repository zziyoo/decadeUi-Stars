/**
 * 测试用的最小文件系统端口：只覆盖 packageInstaller 真正会调到的那几扇门
 * （capabilities / kind / exists / read·writeText / read·writeBinary / listDir /
 *  removeFile / removeTree / movePath）。
 *
 * `tests/p5-installer.test.mjs` 里那份是它自己的完整替身（含 EXDEV、hang、半截落盘等注入），
 * 这里这份只服务"卸载/失败分类"这类不需要故障注入的用例 —— 两边都按 io 端口的契约写，
 * 端口签名变了会同时红，不会只验到一边。
 */
const encoder = new TextEncoder();
const norm = p => String(p).split("\\").join("/").replace(/^\.?\//, "");

export function createFakeIo(initial = {}, options = {}) {
	const files = new Map(Object.entries(initial).map(([key, value]) => [norm(key), String(value)]));
	const io = {
		files,
		capabilities: { atomicRename: options.atomicRename !== false, desktop: options.desktop !== false },
		/** 一次性故障注入：命中即抛并清除（键形如 `movePath:modules/x/1.0.0`） */
		failOnce: new Set(),
		kind: rel => {
			const key = norm(rel);
			if (files.has(key)) return "file";
			return [...files.keys()].some(existing => existing.startsWith(`${key}/`)) ? "dir" : null;
		},
		exists: async rel => io.kind(rel) === "file",
		readText: async rel => {
			const value = files.get(norm(rel));
			return value === undefined ? null : value;
		},
		writeText: async (rel, text) => {
			io.guard(`writeText:${norm(rel)}`);
			files.set(norm(rel), String(text));
		},
		readBinary: async rel => {
			const value = files.get(norm(rel));
			if (value === undefined) return null;
			const bytes = encoder.encode(value);
			return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		},
		writeBinary: async (rel, data) => {
			io.guard(`writeBinary:${norm(rel)}`);
			files.set(norm(rel), new TextDecoder().decode(new Uint8Array(data)));
		},
		listDir: async rel => {
			const prefix = `${norm(rel)}/`;
			const dirs = new Set();
			const found = [];
			for (const key of files.keys()) {
				if (!key.startsWith(prefix)) continue;
				const rest = key.slice(prefix.length);
				const slash = rest.indexOf("/");
				if (slash === -1) found.push(rest);
				else dirs.add(rest.slice(0, slash));
			}
			return { dirs: [...dirs], files: found };
		},
		removeFile: async rel => {
			io.guard(`removeFile:${norm(rel)}`);
			files.delete(norm(rel));
		},
		removeTree: async rel => {
			io.guard(`removeTree:${norm(rel)}`);
			const key = norm(rel);
			for (const existing of [...files.keys()]) if (existing === key || existing.startsWith(`${key}/`)) files.delete(existing);
		},
		movePath: async (from, to) => {
			const src = norm(from);
			io.guard(`movePath:${src}`);
			const dest = norm(to);
			const moved = new Map();
			for (const [key, value] of [...files.entries()]) {
				if (key === src) moved.set(dest, value);
				else if (key.startsWith(`${src}/`)) moved.set(`${dest}/${key.slice(src.length + 1)}`, value);
			}
			for (const key of [...files.keys()]) if (key === src || key.startsWith(`${src}/`)) files.delete(key);
			for (const [key, value] of moved) files.set(key, value);
		},
		guard(label) {
			if (io.failOnce.has(label)) {
				io.failOnce.delete(label);
				throw new Error(`注入故障: ${label}`);
			}
		},
	};
	return io;
}

/** 把对象/字符串变成 transport 需要的 ArrayBuffer */
export function toArrayBuffer(value) {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	const bytes = encoder.encode(text);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
