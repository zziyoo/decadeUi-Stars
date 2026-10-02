/**
 * Android/Cordova 侧 `game.*` 的内存替身（p17、p18 共用一份，免得夹具各说各话）。
 *
 * 刻意复刻真机的两件事：
 *   1. **桥的序列化规则**——非 `ArrayBuffer` 参数按 JSON 传递，`Uint8Array` 会被写成
 *      `{"0":123,"1":34,...}`（2026-10-01 手机上四个样式包就是这么全废的）；
 *      存进 `files` 的内容**原样保留**（字符串就还是字符串），否则"有没有被 JSON 化"这条
 *      断言会被夹具自己抹平。
 *   2. **可注入的 IO 故障**——`hidden` 让"目录里列得出来、checkFile 却说不是文件"的条目存在
 *      （SAF 权限抖动、条目类型误判都会这样），`truncateOnWrite` 让落盘只写进前半截字节。
 *
 * 键是本体拼出来的相对布局路径（`extension/十周年UI-Stars/...`），与 `io` 端口看到的一致。
 */

const dirOf = p => {
	const parts = p.split("/");
	parts.pop();
	return parts.join("/");
};

/** 桥的序列化规则：字符串原样、ArrayBuffer 按字节，其余一律 JSON 化（真机实测到的那一条） */
export const bridgeSerialize = data => {
	if (typeof data === "string") return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	return JSON.stringify(data);
};

const halve = value =>
	typeof value === "string"
		? value.slice(0, Math.max(1, Math.floor(value.length / 2)))
		: value.slice(0, Math.max(1, Math.floor(value.byteLength / 2)));

/**
 * @param {Object} [options]
 * @param {Set<string>} [options.hidden] - 这些路径 `checkFile` 报"不存在"、`readFile` 报错，但 `getFileList` 仍能列出
 * @param {Set<string>} [options.truncateOnWrite] - 这些路径写入时只落前半截字节
 * @param {Set<string>} [options.failOnWrite] - 这些路径写入时回调 Error（真·写失败）
 * @param {Set<string>} [options.zeroFirstByteOnce] - 这些路径**第一次**写入时首字节变 0（之后正常）—— 真机观测到的间歇性缺陷
 * @param {Set<string>} [options.alwaysZeroFirstByte] - 这些路径**每次**写入首字节都变 0（用来验"三次都不过就报错"）
 */
export function makeFakeGame({
	hidden = new Set(),
	truncateOnWrite = new Set(),
	failOnWrite = new Set(),
	zeroFirstByteOnce = new Set(),
	alwaysZeroFirstByte = new Set(),
} = {}) {
	const files = new Map();
	const dirs = new Set(["", "extension"]);
	const later = (fn, ...args) => setTimeout(() => fn?.(...args), 0);
	const isUnder = dir => [...dirs].some(d => d === dir || d.startsWith(`${dir}/`));
	/** 真机上抓到的那一型损坏：长度不变、第一个字节变 0 */
	const zeroHead = value => {
		if (typeof value === "string") return value.length ? `\0${value.slice(1)}` : value;
		const copy = value.slice();
		if (copy.length) copy[0] = 0;
		return copy;
	};

	return {
		files,
		dirs,
		checkFile(path, ok, err) {
			if (hidden.has(path)) return later(ok, -1);
			if (files.has(path)) return later(ok, 1);
			if (dirs.has(path) || isUnder(path)) return later(ok, 0);
			return later(ok, -1);
		},
		createDir(path, ok, err) {
			dirs.add(path);
			let cursor = dirOf(path);
			while (cursor && !dirs.has(cursor)) {
				dirs.add(cursor);
				cursor = dirOf(cursor);
			}
			return later(ok, null);
		},
		writeFile(data, path, name, callback) {
			dirs.add(path);
			const key = `${path}/${name}`;
			if (failOnWrite.has(key)) return later(callback, new Error(`注入故障: writeFile ${key}`));
			let stored = bridgeSerialize(data);
			if (truncateOnWrite.has(key)) stored = halve(stored);
			if (alwaysZeroFirstByte.has(key)) stored = zeroHead(stored);
			else if (zeroFirstByteOnce.has(key)) {
				zeroFirstByteOnce.delete(key);
				stored = zeroHead(stored);
			}
			files.set(key, stored);
			return later(callback, null);
		},
		readFile(path, ok, err) {
			if (hidden.has(path)) return later(err, new Error(`EACCES ${path}`));
			const stored = files.get(path);
			if (stored === undefined) return later(err, new Error(`ENOENT ${path}`));
			return later(ok, typeof stored === "string" ? stored : stored.slice());
		},
		getFileList(path, ok, err) {
			const folders = [];
			const found = [];
			const prefix = `${path}/`;
			for (const key of files.keys()) {
				if (!key.startsWith(prefix)) continue;
				const rest = key.slice(prefix.length);
				const slash = rest.indexOf("/");
				if (slash === -1) found.push(rest);
				else if (!folders.includes(rest.slice(0, slash))) folders.push(rest.slice(0, slash));
			}
			for (const d of dirs) {
				if (!d.startsWith(prefix) || d === path) continue;
				const rest = d.slice(prefix.length);
				if (!rest.includes("/") && !folders.includes(rest)) folders.push(rest);
			}
			return later(ok, folders, found);
		},
		removeFile(path, callback) {
			files.delete(path);
			return later(callback, null);
		},
		removeDir(path, ok, err) {
			for (const key of [...files.keys()]) if (key === path || key.startsWith(`${path}/`)) files.delete(key);
			for (const d of [...dirs]) if (d === path || d.startsWith(`${path}/`)) dirs.delete(d);
			return later(ok, null);
		},
	};
}

export const bytesOf = text => Uint8Array.from(new TextEncoder().encode(text)).buffer;
export const textOf = buffer => new TextDecoder().decode(new Uint8Array(buffer));
/** 端口写的相对路径 → 夹具里的绝对键（本体在扩展根下拼路径） */
export const absOf = rel => `extension/十周年UI-Stars/${rel}`;
