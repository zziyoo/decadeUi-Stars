/**
 * P5 下载器 / 包安装器冒烟测试（任务书§42 + §17/§18/§19/§11/§20）
 * 运行方式：node --import ./tests/helpers/register.mjs tests/p5-installer.test.mjs
 *   （钩子仅为本体自带模块 moduleIo.js 的 `noname` 解析提供桩；被测主体均为纯逻辑）
 */
import assert from "node:assert/strict";
import { createModuleRegistry } from "../src/core/registry.js";
import { createModuleManager } from "../src/core/moduleManager.js";
import { createResourceLoader } from "../src/core/resourceLoader.js";
import { registerBuiltInModules } from "../src/core/builtInModules.js";
import { compareVersions, checkCoreRequirement } from "../src/core/manifest.js";
import { downloadBuffer, DownloadError, DOWNLOAD_CODES, sha256Hex } from "../src/core/downloader.js";
import { createPackageInstaller, INSTALL_CODES } from "../src/core/packageInstaller.js";
import { createNonameIo, normalizeZipEntry, IoError } from "../src/core/moduleIo.js";

/** ResourceLoader 在测试环境下的扩展根（window 桩） */
globalThis.window = { decadeUIPath: "file:///ext/extension/十周年UI-Stars/" };
const ROOT = globalThis.window.decadeUIPath;

const encoder = new TextEncoder();
const norm = path => String(path).split("\\").join("/").replace(/^\.?\//, "");

// ------------------------------------------------------------------ 虚拟文件系统端口

function createFakeIo(options = {}) {
	/** @type {Map<string, string|Uint8Array>} */
	const files = new Map();
	const io = {
		files,
		/** 端口能力：默认按桌面端（同卷原子 rename）；atomicRename:false 走安装器的备份事务分支 */
		capabilities: { atomicRename: options.atomicRename !== false, desktop: options.desktop !== false },
		/** 一次性故障注入：命中即抛错并清除 */
		failOnce: new Set(),
		/** 一次性"半截落盘"：命中则把目标写成被截断的内容并当作成功（模拟 copy 中断） */
		corruptOnce: new Set(),
		kind: rel => {
			const key = norm(rel);
			if (files.has(key)) return "file";
			for (const existing of files.keys()) {
				if (existing.startsWith(`${key}/`)) return "dir";
			}
			return null;
		},
		exists: async rel => io.kind(rel) === "file",
		readText: async rel => {
			const value = files.get(norm(rel));
			if (value === undefined) return null;
			return typeof value === "string" ? value : new TextDecoder().decode(value);
		},
		writeText: async (rel, text) => {
			const key = norm(rel);
			io.guard(`writeText:${key}`);
			files.set(key, String(text));
		},
		readBinary: async rel => {
			const value = files.get(norm(rel));
			if (value === undefined) return null;
			const bytes = typeof value === "string" ? encoder.encode(value) : value;
			return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
		},
		writeBinary: async (rel, data) => {
			const key = norm(rel);
			io.guard(`writeBinary:${key}`);
			files.set(key, new Uint8Array(data));
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
			for (const existing of [...files.keys()]) {
				if (existing === key || existing.startsWith(`${key}/`)) files.delete(existing);
			}
		},
		copyTree: async (src, dest) => {
			const from = norm(src);
			const to = norm(dest);
			for (const [key, value] of [...files.entries()]) {
				if (key === from) files.set(to, value);
				else if (key.startsWith(`${from}/`)) files.set(`${to}/${key.slice(from.length + 1)}`, value);
			}
		},
		movePath: async (src, dest) => {
			const from = norm(src);
			const to = norm(dest);
			io.guard(`movePath:${from}`);
			if (io.corruptOnce.has(`movePath:${from}`)) {
				io.corruptOnce.delete(`movePath:${from}`);
				const value = files.get(from);
				if (value === undefined) throw new Error(`move 源不存在: ${from}`);
				files.delete(from);
				files.set(to, typeof value === "string" ? value.slice(0, Math.max(1, value.length >> 1)) : value.slice(0, Math.max(1, value.byteLength >> 1)));
				return;
			}
			if (files.has(from)) {
				files.set(to, files.get(from));
				files.delete(from);
				return;
			}
			let moved = 0;
			for (const [key, value] of [...files.entries()]) {
				if (key.startsWith(`${from}/`)) {
					files.set(`${to}/${key.slice(from.length + 1)}`, value);
					files.delete(key);
					moved++;
				}
			}
			if (!moved) throw new Error(`move 源不存在: ${from}`);
		},
		guard(label) {
			if (io.failOnce.has(label)) {
				io.failOnce.delete(label);
				throw new Error(`注入故障: ${label}`);
			}
		},
		tempLeftovers: () => [...files.keys()].filter(key => key.startsWith("tmp/")),
		published: id => [...files.keys()].filter(key => key.startsWith(`modules/${id}/`)),
	};
	return io;
}

// ------------------------------------------------------------------ 无 Node fs 平台的 game 替身（Android / SAF）

/**
 * 按本体 noname/init/cordova.js 的回调契约实现的最小虚拟盘：
 * checkFile / createDir / writeFile / readFile / readFileAsText / getFileList / removeFile / removeDir。
 * 故障注入：failOnce 命中 `op:path` → 走错误回调；corruptOnce 命中 → 半截落盘后"成功"
 * （Cordova 的 FileWriter 不做 truncate，短写正是这种结果）。
 */
function createLegacyGame(initial = {}) {
	const strip = path => String(path).split("\\").join("/").replace(/^extension\/[^/]+\//, "").replace(/^\/+/, "");
	/** @type {Map<string, Uint8Array>} */
	const store = new Map();
	const dirs = new Set();
	for (const [rel, text] of Object.entries(initial)) store.set(strip(rel), encoder.encode(String(text)));

	const hit = (bucket, label) => (bucket.has(label) ? (bucket.delete(label), true) : false);
	const hitPattern = (op, key) => {
		const index = game.failMatch.findIndex(entry => entry.op === op && String(key).includes(entry.contains));
		if (index === -1) return false;
		const entry = game.failMatch[index];
		entry.times = (entry.times ?? 1) - 1;
		if (entry.times <= 0) game.failMatch.splice(index, 1);
		return true;
	};
	const bytesOf = value => (value instanceof Uint8Array ? value : encoder.encode(String(value)));

	const game = {
		store,
		key: strip,
		failOnce: new Set(),
		corruptOnce: new Set(),
		/** 按模式注入（用于名字里含随机事务号的临时件）：[{op, contains, times?}] */
		failMatch: [],
		has: rel => store.has(strip(rel)),
		readText: rel => (store.has(strip(rel)) ? new TextDecoder().decode(store.get(strip(rel))) : null),
		movingLeftovers: () => [...store.keys()].filter(key => key.includes(".moving-")),
		checkFile: (path, callback, onerror) => {
			const key = strip(path);
			if (hit(game.failOnce, `checkFile:${key}`)) return onerror(new Error(`注入故障: checkFile ${key}`));
			if (store.has(key)) return callback(1);
			if (dirs.has(key) || [...store.keys()].some(existing => existing.startsWith(`${key}/`))) return callback(0);
			return callback(-1);
		},
		createDir: (path, callback, onerror) => {
			const key = strip(path);
			if (hit(game.failOnce, `createDir:${key}`)) return onerror(new Error(`注入故障: createDir ${key}`));
			dirs.add(key);
			callback();
		},
		writeFile: (data, dir, name, callback) => {
			const key = strip(`${dir}/${name}`);
			if (hit(game.failOnce, `writeFile:${key}`) || hitPattern("writeFile", key)) return callback(new Error(`注入故障: writeFile ${key}`));
			const bytes = bytesOf(data);
			if (hit(game.corruptOnce, `writeFile:${key}`)) {
				store.set(key, bytes.slice(0, Math.max(1, Math.floor(bytes.byteLength / 2))));
				return callback(null);
			}
			store.set(key, new Uint8Array(bytes));
			dirs.add(key.slice(0, key.lastIndexOf("/")));
			callback(null);
		},
		readFile: (path, callback, onerror) => {
			const key = strip(path);
			if (hit(game.failOnce, `readFile:${key}`) || hitPattern("readFile", key)) return onerror(new Error(`注入故障: readFile ${key}`));
			const bytes = store.get(key);
			if (bytes === undefined) return onerror(new Error(`ENOENT ${key}`));
			callback(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
		},
		readFileAsText: (path, callback, onerror) => {
			const key = strip(path);
			if (hit(game.failOnce, `readFileAsText:${key}`)) return onerror(new Error(`注入故障: readFileAsText ${key}`));
			const bytes = store.get(key);
			if (bytes === undefined) return onerror(new Error(`ENOENT ${key}`));
			callback(new TextDecoder().decode(bytes));
		},
		getFileList: (dir, success, failure) => {
			const prefix = `${strip(dir)}/`;
			if (hit(game.failOnce, `getFileList:${strip(dir)}`)) return failure(new Error(`注入故障: getFileList ${strip(dir)}`));
			const files = [];
			const folders = new Set();
			for (const key of store.keys()) {
				if (!key.startsWith(prefix)) continue;
				const rest = key.slice(prefix.length);
				const slash = rest.indexOf("/");
				if (slash === -1) files.push(rest);
				else folders.add(rest.slice(0, slash));
			}
			success([...folders], files);
		},
		removeFile: (path, callback) => {
			const key = strip(path);
			if (hit(game.failOnce, `removeFile:${key}`) || hitPattern("removeFile", key)) return callback(new Error(`注入故障: removeFile ${key}`));
			store.delete(key);
			callback(null);
		},
		removeDir: (path, callback, onerror) => {
			const key = strip(path);
			if (hit(game.failOnce, `removeDir:${key}`)) return onerror(new Error(`注入故障: removeDir ${key}`));
			dirs.delete(key);
			callback();
		},
	};
	return game;
}

/** 只给 rename 会 EXDEV 的桌面虚拟 fs（跨卷场景：movePath 必须走非原子 copy+remove 分支） */
function createDesktopStore(initial = {}) {
	/** @type {Map<string, Uint8Array>} */
	const store = new Map();
	for (const [rel, text] of Object.entries(initial)) store.set(rel, encoder.encode(String(text)));
	const key = path => String(path).replace(/^extension\/[^/]+\//, "");
	const dirNames = new Set();
	const fs = {
		failOnce: new Set(),
		exdev: false,
		store,
		calls: [],
		has: rel => store.has(rel),
		readText: rel => (store.has(rel) ? new TextDecoder().decode(store.get(rel)) : null),
		stat: (path, cb) => {
			const name = key(path);
			if (fs.failOnce.has(`stat:${name}`)) return cb(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			if (store.has(name)) return cb(null, { isDirectory: () => false, isFile: () => true });
			if ([...store.keys()].some(existing => existing.startsWith(`${name}/`))) return cb(null, { isDirectory: () => true, isFile: () => false });
			return cb(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
		},
		mkdir: (path, options, cb) => {
			const name = key(path);
			if (fs.failOnce.has(`mkdir:${name}`)) return cb(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			dirNames.add(name);
			cb(null);
		},
		readFile: (path, encoding, cb) => {
			const done = typeof encoding === "function" ? encoding : cb;
			const name = key(path);
			if (fs.failOnce.has(`readFile:${name}`)) return done(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			const bytes = store.get(name);
			if (bytes === undefined) return done(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
			done(null, typeof encoding === "string" ? new TextDecoder().decode(bytes) : bytes);
		},
		writeFile: (path, data, encoding, cb) => {
			const done = typeof encoding === "function" ? encoding : cb;
			const name = key(path);
			if (fs.failOnce.has(`writeFile:${name}`)) return done(Object.assign(new Error("ENOSPC"), { code: "ENOSPC" }));
			store.set(name, typeof data === "string" ? encoder.encode(data) : new Uint8Array(data));
			done(null);
		},
		unlink: (path, cb) => {
			const name = key(path);
			if (fs.failOnce.has(`unlink:${name}`)) return cb(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			store.delete(name);
			cb(null);
		},
		rm: (path, options, cb) => {
			const name = key(path);
			if (fs.failOnce.has(`rm:${name}`)) return cb(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			for (const existing of [...store.keys()]) {
				if (existing === name || existing.startsWith(`${name}/`)) store.delete(existing);
			}
			cb(null);
		},
		readdir: (path, cb) => {
			const prefixPath = `${key(path)}/`;
			if (fs.failOnce.has(`readdir:${key(path)}`)) return cb(Object.assign(new Error("EACCES"), { code: "EACCES" }));
			const names = [...new Set([...store.keys()].filter(name => name.startsWith(prefixPath)).map(name => name.slice(prefixPath.length).split("/")[0]))];
			cb(null, names);
		},
		rename: (from, to, cb) => {
			if (fs.exdev) return cb(Object.assign(new Error("EXDEV: cross-device link not permitted"), { code: "EXDEV" }));
			const fromKey = key(from);
			const toKey = key(to);
			if (!store.has(fromKey)) return cb(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
			store.set(toKey, store.get(fromKey));
			store.delete(fromKey);
			cb(null);
		},
	};
	return fs;
}

// ------------------------------------------------------------------ ZIP 与传输替身

/** 用 JSON 描述"包"（避免测试引入 JSZip）：解压端口按同一描述写入虚拟文件系统 */
function makePackage(manifest, files = {}) {
	const entries = { "manifest.json": JSON.stringify(manifest), ...files };
	return { entries, buffer: encoder.encode(JSON.stringify(entries)).buffer };
}

function createFakeExtractor(io) {
	return async (buffer, targetDir) => {
		const entries = JSON.parse(new TextDecoder().decode(buffer));
		for (const [rel, text] of Object.entries(entries)) {
			await io.writeBinary(`${targetDir}/${rel}`, encoder.encode(String(text)));
		}
		return Object.keys(entries).map(rel => `${targetDir}/${rel}`);
	};
}

/**
 * 按 URL 供货的传输端口（契约：resolve 出 ArrayBuffer）；
 * 未登记的地址判为网络不可达（模拟断网/404）。script 用于注入逐步故障。
 */
function createTransport(packages, script = []) {
	let cursor = 0;
	const calls = [];
	const deliver = payload => (payload instanceof ArrayBuffer ? payload : payload?.buffer);
	const transport = async (url, options = {}) => {
		calls.push(url);
		if (options.signal?.aborted) throw new DownloadError(DOWNLOAD_CODES.CANCELLED, "下载已取消", { url });
		const step = script[cursor++];
		if (step !== undefined) {
			if (typeof step === "function") {
				const value = step(options);
				if (value instanceof Error) throw value;
				return deliver(value);
			}
			if (step instanceof Error) throw step;
			return deliver(step);
		}
		const pkg = packages[url];
		if (!pkg) {
			throw new DownloadError(DOWNLOAD_CODES.NETWORK, `地址不可达（测试未登记）: ${url}`, { url });
		}
		return deliver(pkg);
	};
	transport.calls = calls;
	return transport;
}

const networkError = () => new DownloadError(DOWNLOAD_CODES.NETWORK, "网络不可达", { url: "x" });
const shaOf = async buffer => sha256Hex(new Uint8Array(buffer));
/** 读取虚拟文件内容为文本（解压端口按二进制写入） */
const textAt = (io, key) => {
	const value = io.files.get(key);
	if (value === undefined) return undefined;
	return typeof value === "string" ? value : new TextDecoder().decode(value);
};

const styleManifest = (id, version, extra = {}) => ({
	schema: 1,
	id,
	name: `${id}样式`,
	version,
	type: "style",
	core: ">=1.0.0",
	dependencies: ["core"],
	entry: { js: [`ui/${id}.js`], css: ["player.css"] },
	capabilities: ["player-frame"],
	...extra,
});
const styleFiles = id => ({ "player.css": `${id} 样式`, [`ui/${id}.js`]: "export default {}" });

/** 安装器的 download 端口 = 下载器（重试/取消/超时在内），测试只替身传输层 */
const makeDownload = transport => (url, options = {}) => downloadBuffer(url, { ...options, transport });

/** 组装一套可测环境 */
function makeEnv({ packages = {}, script = [], manifest, files, coreVersion = "1.4.2", isInUse = () => false, random, atomicRename = true } = {}) {
	const io = createFakeIo({ atomicRename });
	const allPackages = { "https://test/a.zip": makePackage(manifest || styleManifest("testmod", "1.0.0"), files || styleFiles("testmod")), ...packages };
	const registry = createModuleRegistry();
	registerBuiltInModules(registry, { version: coreVersion });
	const moduleManager = createModuleManager({ registry });
	const resourceLoader = createResourceLoader({ moduleManager });
	const transport = createTransport(allPackages, script);
	const installer = createPackageInstaller({
		registry,
		moduleManager,
		io,
		extractZip: createFakeExtractor(io),
		download: makeDownload(transport),
		getCoreVersion: () => coreVersion,
		isInUse,
		random,
	});
	return { io, registry, moduleManager, resourceLoader, installer, transport, packages: allPackages };
}

// ------------------------------------------------------------------ 版本比较与 Core 检查

assert.equal(compareVersions("1.4.2", "1.4.2"), 0);
assert.equal(compareVersions("1.5.0", "1.4.9"), 1);
assert.equal(compareVersions("1.4.10", "1.4.9"), 1);
assert.equal(compareVersions("1.4.2", "1.4.3"), -1);
assert.equal(compareVersions("1.4.2", "1.4.2-beta.1"), 1);
assert.equal(checkCoreRequirement(">=1.4.2", "1.4.2").ok, true);
assert.equal(checkCoreRequirement(">=1.5.0", "1.4.2").ok, false);
assert.equal(checkCoreRequirement(">=1.5.0", null).unknown, true);
assert.equal(checkCoreRequirement("~1.5.0", "1.9.0").ok, false, "不认识的写法判为不满足，不猜语义");

// ------------------------------------------------------------------ 下载器（任务书§42）

{
	const buffer = encoder.encode("payload").buffer;
	const digest = await shaOf(buffer);

	const progress = [];
	const result = await downloadBuffer("https://test/a.zip", {
		transport: createTransport({ "https://test/a.zip": { buffer } }),
		sha256: digest,
		onProgress: info => progress.push(info),
	});
	assert.equal(result.bytes, 7);
	assert.equal(result.sha256, digest);
	assert.equal(result.attempts, 1);

	// 摘要不符 = 内容问题，重试无意义
	let hashTries = 0;
	await assert.rejects(
		downloadBuffer("https://test/a.zip", {
			sha256: "0".repeat(64),
			transport: createTransport({}, [() => (hashTries++, { buffer })]),
		}),
		error => error.code === DOWNLOAD_CODES.SHA_MISMATCH
	);
	assert.equal(hashTries, 1);

	// 网络失败按 retries 重试（retries=2 → 共 3 次），且仍失败
	const alwaysDown = createTransport({});
	await assert.rejects(
		downloadBuffer("https://test/a.zip", { retries: 2, retryDelayMs: 0, transport: alwaysDown }),
		error => error.code === DOWNLOAD_CODES.NETWORK && error.attempts === 3
	);
	assert.equal(alwaysDown.calls.length, 3);

	// 前两次失败第三次成功（不假设一定联网成功，也不假设一定失败）
	let tries = 0;
	const recovered = await downloadBuffer("https://test/a.zip", {
		retries: 3,
		retryDelayMs: 0,
		transport: createTransport({}, [
			() => (tries++, networkError()),
			() => (tries++, new DownloadError(DOWNLOAD_CODES.TIMEOUT, "超时", {})),
			{ buffer },
		]),
	});
	assert.equal(recovered.attempts, 3);
	assert.equal(tries, 2, "失败两次后第三次成功");

	// 取消：已 abort → 直接 CANCELLED；未 abort → 正常完成
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(
		downloadBuffer("https://test/a.zip", { signal: controller.signal, transport: createTransport({}, [{ buffer }]) }),
		error => error.code === DOWNLOAD_CODES.CANCELLED
	);
	assert.equal((await downloadBuffer("https://test/a.zip", { signal: new AbortController().signal, transport: createTransport({}, [{ buffer }]) })).bytes, 7);

	// 404 不重试、5xx 重试、非法地址直接拒绝
	await assert.rejects(
		downloadBuffer("https://test/a.zip", {
			retries: 1,
			retryDelayMs: 0,
			transport: createTransport({}, [new DownloadError(DOWNLOAD_CODES.HTTP, "Not Found", { status: 404 })]),
		}),
		error => error.code === DOWNLOAD_CODES.HTTP && error.attempts === 1
	);
	const badGateway = new DownloadError(DOWNLOAD_CODES.HTTP, "Bad Gateway", { status: 502 });
	let gatewayTries = 0;
	const gatewayTransport = createTransport({}, [
		() => (gatewayTries++, badGateway),
		() => (gatewayTries++, { buffer }),
	]);
	const retried = await downloadBuffer("https://test/a.zip", { retries: 1, retryDelayMs: 0, transport: gatewayTransport });
	assert.equal(retried.attempts, 2);
	assert.equal(gatewayTries, 2);
	await assert.rejects(downloadBuffer("relative/path.zip", {}), error => error.code === DOWNLOAD_CODES.INVALID_URL);
}

// ------------------------------------------------------------------ 安装（任务书§17）

{
	const { io, installer, packages, moduleManager, resourceLoader, registry } = makeEnv({});
	const digest = await shaOf(packages["https://test/a.zip"].buffer);
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip", sha256: digest });

	assert.equal(result.ok, true, result.message);
	assert.equal(result.path, "modules/testmod/1.0.0");
	assert.equal(result.requiresReload, true);
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "testmod 样式");
	assert.deepEqual(io.tempLeftovers(), [], "临时产物必须清理");
	const state = JSON.parse(io.files.get("modules/installed.json"));
	assert.equal(state.modules.testmod.version, "1.0.0");
	assert.equal(state.modules.testmod.sha256, digest);
	assert.equal(state.modules.testmod.source, "local");
	// 注册后模块根解析切到包根（P3 抽象与 P5 落地的接合点）
	assert.equal(moduleManager.getInstallState("testmod").independent, true);
	assert.equal(resourceLoader.getModuleBase("testmod"), `${ROOT}modules/testmod/1.0.0/`);
	// 未独立安装的内置样式仍回落扩展根
	assert.equal(resourceLoader.getModuleBase("decade"), ROOT);
	assert.equal(registry.get("core").manifest.type, "core");
}

// 缺外部 expectedSha256：允许安装，但显式标记"未校验"（不假装校验过）
{
	const { io, installer } = makeEnv({});
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, true);
	assert.match(result.warnings.join(" "), /expectedSha256/);
	assert.equal(result.hashVerified, false);
	const entry = JSON.parse(io.files.get("modules/installed.json")).modules.testmod;
	assert.equal(entry.sha256, "", "未校验时不得把任何摘要写成已验证");
	assert.equal(entry.hashVerified, false);
}

// SHA 不符：一个文件都不落地，installed.json 与临时目录保持干净
{
	const { io, installer } = makeEnv({});
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip", sha256: "f".repeat(64) });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.SHA_MISMATCH);
	assert.equal(io.files.get("modules/installed.json"), before, "校验失败不得改动安装状态");
	assert.deepEqual(io.published("testmod"), []);
	assert.deepEqual(io.tempLeftovers(), []);
}

// 断网：结构化失败，Core 与既有安装毫发无损（任务书§42"不得假设一定联网成功"、§20）
{
	const { io, installer, transport } = makeEnv({ script: [networkError(), networkError(), networkError()] });
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/offline.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.DOWNLOAD_FAILED);
	assert.equal(result.cause, DOWNLOAD_CODES.NETWORK);
	assert.equal(result.attempts, 3, "默认重试 2 次");
	assert.equal(io.files.get("modules/installed.json"), before);
	assert.deepEqual(io.published("testmod"), []);
	assert.deepEqual(io.tempLeftovers(), []);
	assert.equal(transport.calls.length, 3);
}

// 取消下载：不落地、不清空既有状态
{
	const { io, installer } = makeEnv({});
	const controller = new AbortController();
	controller.abort();
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }, { signal: controller.signal });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.CANCELLED);
	assert.deepEqual(io.published("testmod"), []);
	assert.deepEqual(io.tempLeftovers(), []);
}

// 结构 / 清单 / entry / Core 兼容性 校验（任务书§24）
{
	const cases = [
		{ name: "entry 文件缺失", manifest: styleManifest("testmod", "1.0.0"), files: {}, code: INSTALL_CODES.ENTRY_MISSING },
		{ name: "包ID与索引ID不符", manifest: styleManifest("other", "1.0.0"), files: styleFiles("other"), code: INSTALL_CODES.ID_MISMATCH },
		{ name: "包版本与索引版本不符", manifest: styleManifest("testmod", "9.9.9"), files: styleFiles("testmod"), code: INSTALL_CODES.VERSION_MISMATCH },
		{
			name: "Core 版本不满足",
			manifest: styleManifest("testmod", "1.0.0", { core: ">=9.9.9" }),
			files: styleFiles("testmod"),
			code: INSTALL_CODES.CORE_INCOMPATIBLE,
		},
		{
			name: "schema 不支持",
			manifest: { ...styleManifest("testmod", "1.0.0"), schema: 2 },
			files: styleFiles("testmod"),
			code: INSTALL_CODES.MANIFEST_INVALID,
		},
		{ name: "包内无 manifest.json", manifest: null, files: {}, code: INSTALL_CODES.STRUCTURE_INVALID },
	];
	for (const item of cases) {
		const entries = item.manifest ? { "manifest.json": JSON.stringify(item.manifest), ...item.files } : { "player.css": "x" };
		const pkg = { entries, buffer: encoder.encode(JSON.stringify(entries)).buffer };
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: item.manifest || styleManifest("testmod", "1.0.0") });
		const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
		assert.equal(result.ok, false, `${item.name} 应当失败`);
		assert.equal(result.code, item.code, `${item.name} 期望 ${item.code}，实际 ${result.code}: ${result.message}`);
		assert.deepEqual(io.published("testmod"), [], `${item.name} 不得发布`);
		assert.deepEqual(io.tempLeftovers(), [], `${item.name} 临时目录未清理`);
	}
}

// ------------------------------------------------------------------ 依赖（任务书§11）

{
	const sharedManifest = { schema: 1, id: "shared-fonts", name: "字体", version: "1.0.0", type: "shared", core: ">=1.0.0", dependencies: [], entry: { css: ["font.css"] } };
	const packages = {
		"https://test/yjcm2.zip": makePackage(styleManifest("yjcm2", "1.0.0", { dependencies: ["core", "shared-fonts"] }), styleFiles("yjcm2")),
		"https://test/yjcm3.zip": makePackage(styleManifest("yjcm3", "1.0.0", { dependencies: ["shared-fonts"] }), styleFiles("yjcm3")),
		"https://test/fonts.zip": makePackage(sharedManifest, { "font.css": "@font-face{}" }),
	};
	const { io, installer, moduleManager, transport } = makeEnv({ packages, manifest: styleManifest("placeholder", "0.0.0") });
	const index = { schema: 1, modules: { "shared-fonts": { latest: "1.0.0", url: "https://test/fonts.zip" } } };
	const result = await installer.install({ id: "yjcm2", version: "1.0.0", url: "https://test/yjcm2.zip", dependencies: ["core", "shared-fonts"] }, { index });

	assert.equal(result.ok, true, result.message);
	assert.match(result.warnings.join(" "), /shared-fonts/);
	assert.equal(io.files.has("modules/shared-fonts/1.0.0/font.css"), true, "依赖须先装");
	assert.equal(io.files.has("modules/yjcm2/1.0.0/manifest.json"), true);
	assert.equal(moduleManager.getInstallState("shared-fonts").independent, true);
	// 依赖已就位 → 下一个消费者不再重复下载依赖
	const fontsCallsBefore = transport.calls.filter(url => url === "https://test/fonts.zip").length;
	const second = await installer.install({ id: "yjcm3", version: "1.0.0", url: "https://test/yjcm3.zip", dependencies: ["shared-fonts"] }, { index });
	assert.equal(second.ok, true, second.message);
	assert.equal(transport.calls.filter(url => url === "https://test/fonts.zip").length, fontsCallsBefore, "已装依赖不应重复下载");

	// 索引里没有依赖 → 明确拒绝，不做半截安装
	const empty = makeEnv({ manifest: styleManifest("solo", "1.0.0") });
	const missing = await empty.installer.install({ id: "solo", version: "1.0.0", url: "https://test/a.zip", dependencies: ["nobody"] });
	assert.equal(missing.code, INSTALL_CODES.DEP_MISSING);
	assert.deepEqual(empty.io.published("solo"), []);

	// 依赖循环 → 立即识别
	const cyclic = makeEnv({ manifest: styleManifest("loopa", "1.0.0") });
	const cyclicResult = await cyclic.installer.install({ id: "loopa", version: "1.0.0", url: "https://test/a.zip", dependencies: ["loopb"] }, {
		index: { schema: 1, modules: { loopb: { latest: "1.0.0", url: "https://test/a.zip", dependencies: ["loopa"] } } },
	});
	assert.equal(cyclicResult.code, INSTALL_CODES.DEP_CYCLE);
	assert.match(cyclicResult.message, /loopa -> loopb -> loopa/);
}

// ------------------------------------------------------------------ 更新（任务书§18）与重复安装

{
	const packages = {
		"https://test/1.zip": makePackage(styleManifest("testmod", "1.0.0"), { "player.css": "v1", "ui/testmod.js": "v1" }),
		"https://test/2.zip": makePackage(styleManifest("testmod", "1.1.0"), { "player.css": "v2", "ui/testmod.js": "v2" }),
	};
	const { io, installer, resourceLoader, transport } = makeEnv({ packages, manifest: styleManifest("unused", "0.0.0") });

	const first = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/1.zip" });
	assert.equal(first.ok, true, first.message);

	// 已安装同版本：提前拒绝，不再白下一遍包
	const callsAfterFirst = transport.calls.length;
	const duplicate = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/1.zip" });
	assert.equal(duplicate.code, INSTALL_CODES.ALREADY_INSTALLED);
	assert.equal(transport.calls.length, callsAfterFirst, "重复安装不应触发下载");

	const updated = await installer.update("testmod", { index: { schema: 1, modules: { testmod: { latest: "1.1.0", url: "https://test/2.zip" } } } });
	assert.equal(updated.ok, true, updated.message);
	assert.equal(updated.version, "1.1.0");
	assert.equal(updated.previousVersion, "1.0.0");
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "v1", "旧版本目录必须保留（§18）");
	assert.equal(textAt(io, "modules/testmod/1.1.0/player.css"), "v2");
	assert.equal(resourceLoader.getModuleBase("testmod"), `${ROOT}modules/testmod/1.1.0/`, "版本指针即模块根");
	assert.deepEqual((await installer.localVersions("testmod")).versions.sort(), ["1.0.0", "1.1.0"]);

	const noop = await installer.update("testmod", { index: { schema: 1, modules: { testmod: { latest: "1.1.0", url: "https://test/2.zip" } } } });
	assert.equal(noop.ok, true);
	assert.equal(noop.upToDate, true);

	const reinstalled = await installer.install({ id: "testmod", version: "1.1.0", url: "https://test/2.zip" }, { force: true });
	assert.equal(reinstalled.ok, true, reinstalled.message);
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".replacing-")),
		false,
		"让位目录应已清理"
	);
}

// 发布失败 → 旧版本回滚就位（任务书§17末/§20）
{
	const packages = { "https://test/a.zip": makePackage(styleManifest("testmod", "1.0.0"), { ...styleFiles("testmod"), "player.css": "new" }) };
	const { io, installer } = makeEnv({ packages, manifest: styleManifest("testmod", "1.0.0"), random: () => "t1" });

	const first = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }, { force: true });
	assert.equal(first.ok, true, first.message);
	io.files.set("modules/testmod/1.0.0/player.css", "old");

	// 让位于成功后，转正那一步失败
	io.failOnce.add("movePath:tmp/modules/testmod-1.0.0-t1");
	const failed = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }, { force: true });
	assert.equal(failed.ok, false);
	assert.equal(failed.code, INSTALL_CODES.PUBLISH_FAILED);
	assert.equal(failed.rolledBack, true);
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "old", "旧版本必须被回滚就位");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.testmod.version, "1.0.0");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".replacing-")),
		false,
		"回滚后不留让位目录"
	);
}

// 状态文件写不进去 → 撤销刚发布的目录，磁盘与 installed.json 保持一致
{
	const { io, installer } = makeEnv({ manifest: styleManifest("testmod", "1.0.0") });
	const originalWriteText = io.writeText;
	io.writeText = async (rel, text) => {
		if (rel.startsWith("modules/installed.json")) throw new Error("磁盘已满");
		return originalWriteText(rel, text);
	};
	const failed = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(failed.ok, false);
	assert.equal(failed.code, INSTALL_CODES.STATE_FAILED);
	assert.deepEqual(io.published("testmod"), [], "状态写不进就不该留下模块目录");
	io.writeText = originalWriteText;
	// 恢复正常后可再次安装成功
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
}

// installed.json 损坏 → 拒绝改写，不丢既有安装记录
{
	const { io, installer } = makeEnv({ manifest: styleManifest("testmod", "1.0.0") });
	await io.writeText("modules/installed.json", "{ 坏掉的 json");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.code, INSTALL_CODES.INSTALLED_CORRUPT);
	assert.equal(io.files.get("modules/installed.json"), "{ 坏掉的 json");
}

// ------------------------------------------------------------------ 卸载（任务书§19）

{
	const packages = {
		"https://test/a.zip": makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod")),
		"https://test/b.zip": makePackage(
			{ schema: 1, id: "shared-ui", name: "公共", version: "1.0.0", type: "shared", core: ">=1.0.0", dependencies: [], entry: { css: ["ui.css"] } },
			{ "ui.css": "x" }
		),
		"https://test/c.zip": makePackage(styleManifest("depender", "1.0.0", { dependencies: ["core", "shared-ui"] }), styleFiles("depender")),
	};
	const { io, installer, moduleManager } = makeEnv({
		packages,
		manifest: styleManifest("placeholder", "0.0.0"),
		isInUse: id => id === "core" || id === "testmod",
	});
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	assert.equal((await installer.install({ id: "shared-ui", version: "1.0.0", url: "https://test/b.zip" })).ok, true);
	assert.equal((await installer.install({ id: "depender", version: "1.0.0", url: "https://test/c.zip", dependencies: ["core", "shared-ui"] })).ok, true);

	// 使用中：§19 硬边界，force 也不许绕过
	for (const opts of [{}, { force: true }]) {
		const inUse = await installer.uninstall("testmod", opts);
		assert.equal(inUse.code, INSTALL_CODES.IN_USE);
		assert.equal(io.files.has("modules/testmod/1.0.0/player.css"), true, "拒绝卸载时不得动文件");
	}

	// 被其他模块依赖：force 同样不许绕过
	for (const opts of [{}, { force: true }]) {
		const depended = await installer.uninstall("shared-ui", opts);
		assert.equal(depended.code, INSTALL_CODES.DEPENDED);
		assert.match(depended.message, /depender/);
		assert.equal(io.files.has("modules/shared-ui/1.0.0/ui.css"), true);
	}

	// Core：既使用中又被依赖，force 无效
	for (const opts of [{}, { force: true }]) {
		assert.equal((await installer.uninstall("core", opts)).code, INSTALL_CODES.IN_USE);
	}

	// 让位（rename）失败要等依赖解除后才谈得上，见下方 shared-ui 卸载事务测试

	// 正常卸载：让位 → 清台账 → 才真删；成功后不留 .removing- 残骸
	const removed = await installer.uninstall("depender");
	assert.equal(removed.ok, true, removed.message);
	assert.deepEqual(removed.removedVersions, ["1.0.0"]);
	assert.equal(io.files.has("modules/depender/1.0.0/player.css"), false);
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.depender, undefined);
	assert.equal(moduleManager.isInstalled("depender"), false);
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".removing-")),
		false,
		"让位目录应在状态落定后被清理"
	);

	// 让位（rename）失败 → 结构化错误，台账与文件都不变
	io.failOnce.add("movePath:modules/shared-ui/1.0.0");
	const parkFailed = await installer.uninstall("shared-ui");
	assert.equal(parkFailed.code, INSTALL_CODES.UNINSTALL_FAILED);
	assert.equal(io.files.has("modules/shared-ui/1.0.0/ui.css"), true);
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules["shared-ui"].version, "1.0.0");

	// 台账写失败 → 模块目录原样改回，不出现"目录没了但台账说装着"
	const originalWriteText = io.writeText;
	io.writeText = async (rel, text) => {
		if (rel.startsWith("modules/installed.json")) throw new Error("磁盘已满");
		return originalWriteText(rel, text);
	};
	const stateFailed = await installer.uninstall("shared-ui");
	assert.equal(stateFailed.ok, false);
	assert.equal(stateFailed.code, INSTALL_CODES.STATE_FAILED);
	assert.equal(stateFailed.rolledBack, true);
	assert.equal(textAt(io, "modules/shared-ui/1.0.0/ui.css"), "x", "卸载失败必须可恢复");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules["shared-ui"].version, "1.0.0");
	io.writeText = originalWriteText;

	// 未安装 / 内置（非独立安装）模块：一律拒绝，绝不删单体资源
	assert.equal((await installer.uninstall("ghost")).code, INSTALL_CODES.NOT_INSTALLED);
	assert.equal((await installer.uninstall("decade")).code, INSTALL_CODES.NOT_INSTALLED);
	assert.equal(io.files.has("modules/testmod/1.0.0/player.css"), true);

	// 依赖解除后可正常卸载；台账只剩使用中的 testmod
	assert.equal((await installer.uninstall("shared-ui")).ok, true);
	assert.deepEqual(
		(await installer.listInstalled()).items.map(item => item.id),
		["testmod"]
	);
}

// ------------------------------------------------------------------ 端口缺失（替代 P1 骨架行为）

{
	const bare = createPackageInstaller();
	assert.deepEqual(bare.isAvailable(), { available: false, missingIo: true, missingExtractor: true, atomicRename: false });
	assert.equal((await bare.install({ id: "x", url: "https://test/a.zip" })).code, INSTALL_CODES.NO_IO);
	assert.equal((await bare.uninstall("x")).code, INSTALL_CODES.NO_IO);
	assert.equal((await bare.listInstalled()).code, INSTALL_CODES.NO_IO);
	assert.equal(
		bare.verifyManifest({ schema: 1, id: "x", name: "X", version: "1.0.0", type: "style", core: ">=1.0.0" }).ok,
		true,
		"P1 的清单校验能力保持"
	);
	const noZip = createPackageInstaller({ io: createFakeIo() });
	assert.equal((await noZip.install({ id: "x", url: "https://test/a.zip" })).code, INSTALL_CODES.NO_EXTRACTOR);
}

// ------------------------------------------------------------------ 模块索引（任务书§10）

{
	const io = createFakeIo();
	const index = { schema: 1, core: { latest: "1.4.2" }, modules: { testmod: { latest: "1.5.0", url: "https://test/a.zip", size: 12 } } };
	const online = createPackageInstaller({
		io,
		download: makeDownload(createTransport({ "https://test/index.json": { buffer: encoder.encode(JSON.stringify(index)).buffer } })),
	});
	const fetched = await online.fetchIndex("https://test/index.json");
	assert.equal(fetched.ok, true);
	assert.equal(fetched.index.modules.testmod.latest, "1.5.0");

	const offline = createPackageInstaller({ io, download: makeDownload(createTransport({}, [networkError(), networkError(), networkError()])) });
	const failed = await offline.fetchIndex("https://test/index.json");
	assert.equal(failed.ok, false);
	assert.equal(failed.code, INSTALL_CODES.DOWNLOAD_FAILED);
	assert.equal(failed.cause, DOWNLOAD_CODES.NETWORK);

	const corrupt = createPackageInstaller({ io, download: makeDownload(createTransport({ "https://test/index.json": { buffer: encoder.encode("{ 坏").buffer } })) });
	assert.equal((await corrupt.fetchIndex("https://test/index.json")).code, INSTALL_CODES.STRUCTURE_INVALID);
}

// ------------------------------------------------------------------ SHA256 的信任来源

{
	// 1) 外部 expectedSha256 正确 → 成功，且标记 hashVerified
	const honest = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const honestHash = await shaOf(honest.buffer);
	{
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": honest }, manifest: honest });
		const ok = await installer.install({ id: "testmod", expectedVersion: "1.0.0", url: "https://test/a.zip", expectedSha256: honestHash });
		assert.equal(ok.ok, true, ok.message);
		assert.equal(ok.hashVerified, true);
		assert.equal(ok.sha256, honestHash);
		assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.testmod.hashVerified, true);
	}

	// 2) 外部 expectedSha256 错误 → SHA_MISMATCH，零落地
	{
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": honest }, manifest: honest });
		const bad = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip", expectedSha256: "a".repeat(64) });
		assert.equal(bad.ok, false);
		assert.equal(bad.code, INSTALL_CODES.SHA_MISMATCH);
		assert.deepEqual(io.published("testmod"), []);
		assert.deepEqual(io.tempLeftovers(), []);
	}

	// 3) 包内 manifest.sha256 被改成假值，但外部摘要正确 → 仍按外部值放行并告警
	const lying = makePackage(styleManifest("testmod", "1.0.0", { sha256: "b".repeat(64) }), styleFiles("testmod"));
	{
		const { installer } = makeEnv({ packages: { "https://test/a.zip": lying }, manifest: lying });
		const result = await installer.install({
			id: "testmod",
			version: "1.0.0",
			url: "https://test/a.zip",
			expectedSha256: await shaOf(lying.buffer),
		});
		assert.equal(result.ok, true, "包内自述摘要不得拥有裁决权");
		assert.match(result.warnings.join(" "), /自述|不作判据|为准/);
	}

	// 3b) 没有外部摘要、包内自述值"恰好正确" → 仍算未校验（不采信自述）
	{
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": lying }, manifest: lying });
		const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
		assert.equal(result.ok, true);
		assert.equal(result.hashVerified, false);
		assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.testmod.sha256, "");
	}

	// 4) 包内 manifest.id 与外部目标不一致 → 拒绝
	const idClash = makePackage(styleManifest("evil", "1.0.0"), { "player.css": "x", "ui/evil.js": "x" });
	{
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": idClash }, manifest: idClash });
		const result = await installer.install({
			expectedId: "testmod",
			url: "https://test/a.zip",
			expectedVersion: "1.0.0",
			expectedSha256: await shaOf(idClash.buffer),
		});
		assert.equal(result.code, INSTALL_CODES.ID_MISMATCH);
		assert.match(result.message, /expectedId\(testmod\)/);
		assert.deepEqual(io.published("testmod"), []);
		assert.deepEqual(io.published("evil"), []);
	}

	// 5) 包内 manifest.version 与外部目标不一致 → 拒绝
	const verClash = makePackage(styleManifest("testmod", "6.6.6"), styleFiles("testmod"));
	{
		const { io, installer } = makeEnv({ packages: { "https://test/a.zip": verClash }, manifest: verClash });
		const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
		assert.equal(result.code, INSTALL_CODES.VERSION_MISMATCH);
		assert.match(result.message, /expectedVersion\(1\.0\.0\)/);
		assert.deepEqual(io.published("testmod"), []);
	}

	// 6) id/version/sha256 与 expected* 等价（向后兼容既有调用方）
	{
		const { installer } = makeEnv({ packages: { "https://test/a.zip": honest }, manifest: honest });
		const legacy = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip", sha256: honestHash });
		assert.equal(legacy.ok, true, legacy.message);
		assert.equal(legacy.hashVerified, true);
	}
}

// ------------------------------------------------------------------ 事务一致性（更新/回滚/残留）

{
	const v1 = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const packages = { "https://test/v1.zip": v1 };
	const { io, installer } = makeEnv({ packages, manifest: v1 });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/v1.zip" })).ok, true);

	// 更新下载失败 → 旧版本目录与台账原样可用
	const failedUpdate = await installer.update("testmod", {
		index: { schema: 1, modules: { testmod: { latest: "9.9.9", url: "https://test/offline.zip" } } },
	});
	assert.equal(failedUpdate.ok, false);
	assert.equal(failedUpdate.code, INSTALL_CODES.DOWNLOAD_FAILED);
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "testmod 样式");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.testmod.version, "1.0.0");
	assert.deepEqual(io.tempLeftovers(), []);
}

{
	// 转正失败 + 回滚也失败 → 明确 ROLLBACK_FAILED，不假装成功
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, random: () => "t2" });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }, { force: true })).ok, true);
	io.files.set("modules/testmod/1.0.0/player.css", encoder.encode("old"));

	io.failOnce.add("movePath:tmp/modules/testmod-1.0.0-t2"); // 转正失败
	io.failOnce.add("movePath:modules/testmod/1.0.0.replacing-t2"); // 回滚也失败
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }, { force: true });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.ROLLBACK_FAILED);
	assert.equal(result.rolledBack, false);
	assert.match(result.message, /回滚/);
	assert.ok(result.residual, "必须给出残留路径供人工恢复");
}

{
	// 首次安装转正失败 → 不留正式模块目录
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, random: () => "t3" });
	io.failOnce.add("movePath:tmp/modules/testmod-1.0.0-t3");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.PUBLISH_FAILED);
	assert.equal(result.rolledBack, true);
	assert.deepEqual(io.published("testmod"), [], "首装失败不得留下正式模块目录");
	const ledger = io.files.get("modules/installed.json");
	assert.ok(ledger === undefined || JSON.parse(ledger).modules.testmod === undefined, "首装失败不得写入台账");
	assert.deepEqual(io.tempLeftovers(), []);
}

// ------------------------------------------------------------------ IO 异常不得伪装成"不存在"（P0-2）

{
	// 安装：kind 抛真实 IO_FAILED → 必须原样失败，不得当作"目标不存在"继续发布
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	io.kind = async rel => {
		throw new IoError("IO_FAILED", `permission denied: ${rel}`);
	};
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false, `真实 IO 异常不得被当成"不存在"（实际 ${result.code}）`);
	assert.equal(result.code, INSTALL_CODES.IO_FAILED, `期望 IO_FAILED，实际 ${result.code}: ${result.message}`);
	assert.deepEqual(io.published("testmod"), [], "IO 异常时不得发布模块目录");
	assert.equal(io.files.get("modules/installed.json"), before, "IO 异常不得改动台账");
	assert.deepEqual(io.tempLeftovers(), [], "IO 失败仍要清理临时产物");
}

{
	// kind 的 IO_STALL 同样不得被吞：单列成 IO_STALL，便于与真实错误区分
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	io.kind = async () => {
		throw new IoError("IO_STALL", "本体回调未触发");
	};
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.IO_STALL, `期望 IO_STALL，实际 ${result.code}: ${result.message}`);
	assert.deepEqual(io.published("testmod"), []);
}

{
	// 卸载：检查 modules/<id> 时权限失败 → 直接失败，台账与目录都原样保持
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	const before = io.files.get("modules/installed.json");
	io.kind = async rel => {
		throw new IoError("IO_FAILED", `permission denied: ${rel}`);
	};
	const result = await installer.uninstall("testmod");
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.IO_FAILED, `卸载检查失败必须显式报错，实际 ${result.code}: ${result.message}`);
	assert.equal(io.files.get("modules/installed.json"), before, "检查失败时不得删台账（否则目录还在、记录没了）");
	assert.equal(io.files.get("modules/installed.json").includes("testmod"), true, "台账仍须登记 testmod");
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "testmod 样式", "模块目录必须原样");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".removing-")),
		false,
		"检查失败时不应已经让位"
	);
}

{
	// 发布前的"目标在不在"检查失败 → 不得覆盖可能存在的旧目录
	const v1 = makePackage(styleManifest("testmod", "1.0.0"), { ...styleFiles("testmod"), "player.css": "old" });
	const v2 = makePackage(styleManifest("testmod", "1.0.0"), { ...styleFiles("testmod"), "player.css": "new" });
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": v1, "https://test/b.zip": v2 }, manifest: v1 });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	const before = io.files.get("modules/installed.json");
	const originalKind = io.kind;
	// 只让发布目标这一条路径探测失败：不带 expectedVersion，跳过已在位预检，逼到发布前检查
	io.kind = rel => {
		if (norm(rel) === "modules/testmod/1.0.0") throw new IoError("IO_FAILED", "permission denied");
		return originalKind(rel);
	};
	const result = await installer.install({ id: "testmod", url: "https://test/b.zip" }, { force: true });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.IO_FAILED, `期望 IO_FAILED，实际 ${result.code}: ${result.message}`);
	assert.equal(result.stage, "publishing");
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "old", "检查失败时旧目录一个字节都不能动");
	assert.equal(io.files.get("modules/installed.json"), before, "检查失败时台账不变");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".replacing-")),
		false,
		"检查失败时不得让位"
	);
	assert.deepEqual(io.tempLeftovers(), []);
}

{
	// localVersions：IO 异常不得当成"本地没有版本"
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	io.kind = async rel => {
		throw new IoError("IO_FAILED", `permission denied: ${rel}`);
	};
	const result = await installer.localVersions("testmod");
	assert.equal(result.ok, false, "列举失败不得返回空列表");
	assert.equal(result.code, INSTALL_CODES.IO_FAILED);
}

{
	// entry 文件存在性检查失败 → 不能伪装成 ENTRY_MISSING，也不能放行
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	const originalKind = io.kind;
	io.kind = rel => {
		if (norm(rel).startsWith("tmp/modules/")) throw new IoError("IO_FAILED", "permission denied");
		return originalKind(rel);
	};
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.IO_FAILED, `entry 检查失败应报 IO 错误，实际 ${result.code}: ${result.message}`);
	assert.deepEqual(io.published("testmod"), []);
}

// ------------------------------------------------------------------ 无原子 rename 平台的 installed.json 事务（P1）

{
	// 桌面端保持 temp → rename：不为了理论一致性平白造备份
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	assert.equal(
		[...io.files.keys()].filter(key => key.includes(".backup-")).length,
		0,
		"原子 rename 平台不应产生备份文件"
	);
}

{
	// 提交这一步把台账写坏（copy 中断）→ 必须用备份还原旧内容，并按普通失败上报
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, atomicRename: false, random: () => "t4" });
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	io.corruptOnce.add("movePath:modules/installed.json.t4.tmp");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.STATE_FAILED, `旧台账已还原时该报 STATE_FAILED，实际 ${result.code}: ${result.message}`);
	assert.equal(result.rolledBack, true);
	assert.equal(io.files.get("modules/installed.json"), before, "installed.json 必须恢复为旧内容");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".backup-")),
		false,
		"恢复完成后不留备份文件"
	);
	assert.equal(
		[...io.files.keys()].some(key => key.endsWith(".tmp")),
		false,
		"失败后不留临时台账"
	);
	assert.deepEqual(io.published("testmod"), [], "台账没更新就不该留下新模块目录");
}

{
	// 提交 outright 失败（目标根本没被动过）→ 旧台账原样，且不留下备份与临时文件
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, atomicRename: false, random: () => "t5" });
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	io.failOnce.add("movePath:modules/installed.json.t5.tmp");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.STATE_FAILED);
	assert.equal(io.files.get("modules/installed.json"), before, "旧台账一个字节都不能变");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".backup-") || key.endsWith(".tmp")),
		false,
		"失败路径必须清掉备份与临时文件"
	);
}

{
	// 备份也恢复不了 → 必须是 ROLLBACK_FAILED + rolledBack:false + 点出台账残留，绝不假装已恢复
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, atomicRename: false, random: () => "t6" });
	await io.writeText("modules/installed.json", JSON.stringify({ schema: 1, modules: { decade: { version: "1.4.2" } } }));
	const before = io.files.get("modules/installed.json");
	io.corruptOnce.add("movePath:modules/installed.json.t6.tmp"); // 提交写坏
	io.failOnce.add("movePath:modules/installed.json.backup-t6"); // 还原也失败
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.ROLLBACK_FAILED, `实际 ${result.code}: ${result.message}`);
	assert.equal(result.rolledBack, false);
	assert.equal(result.stage, "state");
	assert.match(String(result.residual), /modules\/installed\.json/, "必须给出待人工恢复的台账路径");
	assert.notEqual(io.files.get("modules/installed.json"), before, "此时台账确实仍是坏的（不得谎报已恢复）");
	assert.throws(() => JSON.parse(io.files.get("modules/installed.json")), "残留的应是被截断的台账");
}

{
	// 原本没有台账：提交写坏后应清掉半成品，而不是留下一份坏台账
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, atomicRename: false, random: () => "t8" });
	io.corruptOnce.add("movePath:modules/installed.json.t8.tmp");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.STATE_FAILED, `实际 ${result.code}: ${result.message}`);
	assert.equal(io.files.has("modules/installed.json"), false, "旧状态是不存在，半成品必须清掉");
	assert.deepEqual(io.published("testmod"), []);
}

{
	// 卸载侧同样受保护：非原子平台台账提交失败 → 目录改回原位、旧台账保持
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg, atomicRename: false, random: () => "t9" });
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" })).ok, true);
	const before = io.files.get("modules/installed.json");
	io.corruptOnce.add("movePath:modules/installed.json.t9.tmp");
	const result = await installer.uninstall("testmod");
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.STATE_FAILED, `卸载失败应报 STATE_FAILED，实际 ${result.code}: ${result.message}`);
	assert.equal(result.rolledBack, true);
	assert.equal(io.files.get("modules/installed.json"), before, "卸载失败不得破坏安装状态");
	assert.equal(textAt(io, "modules/testmod/1.0.0/player.css"), "testmod 样式", "让位的目录必须改回原位");
	assert.equal(
		[...io.files.keys()].some(key => key.includes(".removing-") || key.includes(".backup-")),
		false,
		"不留让位/备份残骸"
	);
}

{
	// 让位做到一半失败，且已让位的目录改不回去 → 只能是 ROLLBACK_FAILED（台账没写，但磁盘已不对称）
	const v1 = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const v2 = makePackage(styleManifest("testmod", "1.2.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({
		packages: { "https://test/1.zip": v1, "https://test/2.zip": v2 },
		manifest: v1,
		random: () => "rp",
	});
	assert.equal((await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/1.zip" })).ok, true);
	assert.equal((await installer.install({ id: "testmod", version: "1.2.0", url: "https://test/2.zip" })).ok, true);
	const before = io.files.get("modules/installed.json");
	io.failOnce.add("movePath:modules/testmod/1.2.0"); // 第二个目录让位失败
	io.failOnce.add("movePath:modules/testmod/.removing-1.0.0-rp"); // 把第一个改回去也失败
	const result = await installer.uninstall("testmod");
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.ROLLBACK_FAILED, `恢复失败必须报 ROLLBACK_FAILED，实际 ${result.code}: ${result.message}`);
	assert.equal(result.rolledBack, false);
	assert.match(String(result.residual), /modules\/testmod/, "要给出残留的让位目录");
	assert.equal(io.files.get("modules/installed.json"), before, "让位阶段失败不得改台账");
}

{
	// 空文件是被截断的台账，不是"什么都没装"：必须拒绝改写，不能顺手当空台账覆盖
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));
	const { io, installer } = makeEnv({ packages: { "https://test/a.zip": pkg }, manifest: pkg });
	await io.writeText("modules/installed.json", "");
	const result = await installer.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(result.code, INSTALL_CODES.INSTALLED_CORRUPT, `空台账应判损坏，实际 ${result.code}: ${result.message}`);
	assert.equal(io.files.get("modules/installed.json"), "", "判损坏时不得改写台账");
	assert.deepEqual(io.published("testmod"), []);
}

// ------------------------------------------------------------------ IO 适配层：失败与卡死都必须落定

{
	const pkg = makePackage(styleManifest("testmod", "1.0.0"), styleFiles("testmod"));

	// 1) createDir 真实报错 → writeBinary reject（IoError），不再有静默挂起
	const deniedGame = {
		checkFile: (path, cb) => cb(-1),
		createDir: (path, ok, err) => err(new Error("EACCES: 目录创建被拒绝")),
		writeFile: () => {
			throw new Error("createDir 已失败，不应再写文件");
		},
	};
	const deniedIo = createNonameIo({ game: deniedGame, fs: null, stallMs: 500 });
	await assert.rejects(() => deniedIo.writeBinary("modules/x/1.0.0/a.css", new Uint8Array([1])), error => error instanceof IoError && /EACCES/.test(error.message));

	// 端到端：目录创建失败必须变成安装器的结构化错误，而不是永远 pending
	const deniedInstaller = createPackageInstaller({
		io: deniedIo,
		extractZip: createFakeExtractor(createFakeIo()),
		download: makeDownload(createTransport({ "https://test/a.zip": pkg })),
	});
	const deniedResult = await Promise.race([
		deniedInstaller.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" }),
		new Promise(resolve => setTimeout(() => resolve("PENDING"), 3000)),
	]);
	assert.notEqual(deniedResult, "PENDING", "IO 失败不得让安装器永久 pending");
	assert.equal(deniedResult.ok, false);
	assert.equal(deniedResult.code, INSTALL_CODES.IO_FAILED);
	assert.equal(deniedResult.stage, "temp");

	// 2) 本体既不成功也不失败地回调（ensureDirectory 的失败路径就是这样）→ 兜底判失败，不当成功
	const hungGame = { checkFile: (path, cb) => cb(-1), createDir: () => {}, writeFile: () => {} };
	const hungIo = createNonameIo({ game: hungGame, fs: null, stallMs: 60 });
	await assert.rejects(
		() => hungIo.writeText("modules/x/1.0.0/a.css", "x"),
		error => error instanceof IoError && error.ioCode === "IO_STALL" && /不当作成功/.test(error.message)
	);
	const hungInstaller = createPackageInstaller({
		io: hungIo,
		extractZip: createFakeExtractor(createFakeIo()),
		download: makeDownload(createTransport({ "https://test/a.zip": pkg })),
	});
	const hungResult = await hungInstaller.install({ id: "testmod", version: "1.0.0", url: "https://test/a.zip" });
	assert.equal(hungResult.ok, false);
	assert.equal(hungResult.code, INSTALL_CODES.IO_STALL, "卡死兜底必须单列成 IO_STALL，便于与普通 IO 失败区分");

	// 3) 桌面端 Node fs 的真实错误同样进入 reject
	const deadFs = {
		stat: (path, cb) => cb(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
		mkdir: (path, options, cb) => cb(Object.assign(new Error("EROFS: 只读文件系统"), { code: "EROFS" })),
		writeFile: () => {},
		rename: (from, to, cb) => cb(null),
	};
	const roIo = createNonameIo({ fs: deadFs, stallMs: 500 });
	await assert.rejects(() => roIo.writeBinary("modules/x/a.css", new Uint8Array([1])), /EROFS/);

	// 4) 路径上跳在端口层就被拒绝
	await assert.rejects(() => roIo.writeBinary("../../outside.css", new Uint8Array([1])), /越出扩展根/);

	// 5) 能力如实上报：无 Node fs 的平台没有原子 rename
	assert.equal(deniedIo.capabilities.atomicRename, false);
	assert.equal(deniedIo.capabilities.desktop, false);
	assert.equal(roIo.capabilities.desktop, true);
}

// ------------------------------------------------------------------ movePath：无 Node fs 平台的文件搬运（P0-1）

{
	// 1) 纯 game 回调平台：move 一个文件必须把内容搬过去，搬成功后才删源
	const game = createLegacyGame({ "modules/installed.json": "OLD", "modules/installed.json.tmp": "NEW" });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	assert.equal(io.capabilities.atomicRename, false);
	await io.movePath("modules/installed.json.tmp", "modules/installed.json");
	assert.equal(game.readText("modules/installed.json"), "NEW", "目标内容必须等于源内容");
	assert.equal(game.has("modules/installed.json.tmp"), false, "搬运成功后源必须消失");
}

{
	// 2) 目标写失败：源必须原样保留，旧目标不许被提前删除
	const game = createLegacyGame({ "modules/installed.json": "OLD", "modules/installed.json.tmp": "NEW" });
	game.failOnce.add("writeFile:modules/installed.json");
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/installed.json.tmp", "modules/installed.json"),
		error => error instanceof IoError && error.ioCode === "IO_FAILED"
	);
	assert.equal(game.readText("modules/installed.json.tmp"), "NEW", "写目标失败时源必须还在");
	assert.equal(game.readText("modules/installed.json"), "OLD", "写目标失败时旧目标内容不得消失");
}

{
	// 2b) 目标"写回调成功但内容半截"（Cordova 的 FileWriter 不 truncate）→ 判失败并保住源
	const game = createLegacyGame({ "modules/installed.json": "OLD", "modules/installed.json.tmp": "NEW-LEDGER" });
	game.corruptOnce.add("writeFile:modules/installed.json");
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/installed.json.tmp", "modules/installed.json"),
		error => error instanceof IoError && /校验|不一致/.test(error.message)
	);
	assert.equal(game.readText("modules/installed.json.tmp"), "NEW-LEDGER", "内容校验失败时源必须仍在，供上层用备份回滚");
}

{
	// 2c) 目录 move 在无 Node fs 平台仍走 copyTree + removeTree（防止只修文件把目录改坏）
	const game = createLegacyGame({ "tmp/modules/x/1.0.0/manifest.json": "M", "tmp/modules/x/1.0.0/ui/a.css": "A" });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await io.movePath("tmp/modules/x/1.0.0", "modules/x/1.0.0");
	assert.equal(game.readText("modules/x/1.0.0/manifest.json"), "M");
	assert.equal(game.readText("modules/x/1.0.0/ui/a.css"), "A");
	assert.equal(game.has("tmp/modules/x/1.0.0/ui/a.css"), false, "目录搬运后源目录必须消失");
}

{
	// 2d) 源既不是文件也不是目录（FIFO/设备）→ 明确拒绝，不静默什么都不做
	const weirdIo = createNonameIo({
		fs: { stat: (path, cb) => cb(null, { isDirectory: () => false, isFile: () => false }) },
		stallMs: 300,
	});
	await assert.rejects(
		() => weirdIo.movePath("modules/fifo", "modules/fifo2"),
		error => error instanceof IoError && error.ioCode === "IO_FAILED" && /不支持/.test(error.message)
	);
}

{
	// 3) 桌面端：文件 move 优先原子 rename，不因上面的修复退化成复制
	const fs = createDesktopStore({ "modules/installed.json": "OLD", "modules/installed.json.tmp": "NEW" });
	let writes = 0;
	const originalWrite = fs.writeFile;
	fs.writeFile = (...args) => (writes++, originalWrite(...args));
	const io = createNonameIo({ fs, stallMs: 500 });
	await io.movePath("modules/installed.json.tmp", "modules/installed.json");
	assert.equal(io.capabilities.atomicRename, true);
	assert.equal(fs.readText("modules/installed.json"), "NEW");
	assert.equal(fs.has("modules/installed.json.tmp"), false);
	assert.equal(writes, 0, "rename 可用时不得走复制路径");
}

{
	// 4) 桌面端跨卷 EXDEV：回落 copy+remove 时文件同样必须搬对
	const fs = createDesktopStore({ "modules/installed.json": "OLD", "modules/installed.json.tmp": "NEW" });
	fs.exdev = true;
	const io = createNonameIo({ fs, stallMs: 500 });
	await io.movePath("modules/installed.json.tmp", "modules/installed.json");
	assert.equal(fs.readText("modules/installed.json"), "NEW", "EXDEV 回落路径必须真的搬运内容");
	assert.equal(fs.has("modules/installed.json.tmp"), false);
}

// -------------------------------------------- 非原子平台：file → 已存在文件的目标事务保护

{
	// A) 已有目标，正常成功：dest = 源内容、源消失、不留事务残骸
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await io.movePath("modules/a.json.tmp", "modules/a.json");
	assert.equal(game.readText("modules/a.json"), "NEW");
	assert.equal(game.has("modules/a.json.tmp"), false);
	assert.deepEqual(game.movingLeftovers(), [], "成功后不应留下 .moving-* 事务文件");
}

{
	// B) 已有目标，提交写入直接失败 → 源与旧目标都保持原样
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	game.failOnce.add("writeFile:modules/a.json");
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(() => io.movePath("modules/a.json.tmp", "modules/a.json"), error => error instanceof IoError);
	assert.equal(game.readText("modules/a.json.tmp"), "NEW", "提交失败时源必须保留");
	assert.equal(game.readText("modules/a.json"), "OLD", "提交失败时旧目标必须原样");
	assert.deepEqual(game.movingLeftovers(), []);
}

{
	// C) 已有目标，提交写成半截 → 回读校验失败 → 旧目标必须回滚成原内容（旧实现会留下 NEW_HALF）
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW-LEDGER", "modules/a.json": "OLD-LEDGER" });
	game.corruptOnce.add("writeFile:modules/a.json");
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/a.json.tmp", "modules/a.json"),
		error => error instanceof IoError && /校验|不一致/.test(error.message)
	);
	assert.equal(game.readText("modules/a.json"), "OLD-LEDGER", "半截写入后旧目标必须恢复");
	assert.equal(game.readText("modules/a.json.tmp"), "NEW-LEDGER", "源必须保留");
	assert.deepEqual(game.movingLeftovers(), []);
}

{
	// D) 已有目标，写成功但回读失败 → 不能假设写成功，同样回滚旧内容
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	const originalRead = game.readFile;
	let destReads = 0;
	game.readFile = (path, callback, onerror) => {
		// 第 1 次读目标是取旧内容做备份，第 2 次是提交后的回读校验
		if (game.key(path) === "modules/a.json" && ++destReads === 2) return onerror(new Error("注入故障: 回读失败"));
		return originalRead(path, callback, onerror);
	};
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(() => io.movePath("modules/a.json.tmp", "modules/a.json"), error => error instanceof IoError);
	assert.equal(game.readText("modules/a.json"), "OLD", "回读失败时不得认为提交成功");
	assert.equal(game.readText("modules/a.json.tmp"), "NEW");
}

{
	// E) 旧目标备份失败 → 正式目标一个字节都没动，且不留残骸
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	game.failMatch.push({ op: "writeFile", contains: ".moving-backup-", times: 1 });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/a.json.tmp", "modules/a.json"),
		error => error instanceof IoError && /moving-backup-/.test(error.message)
	);
	assert.equal(game.readText("modules/a.json"), "OLD", "备份失败时正式目标不得被触碰");
	assert.equal(game.readText("modules/a.json.tmp"), "NEW");
	assert.deepEqual(game.movingLeftovers(), [], "备份失败也要清掉临时件");
}

{
	// F) 提交写坏 + 旧目标恢复也失败 → 明确 IO_ROLLBACK_FAILED + residual，绝不静默成功
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	game.corruptOnce.add("writeFile:modules/a.json"); // 提交写坏
	const originalWrite = game.writeFile;
	let destWrites = 0;
	game.writeFile = (data, dir, name, callback) => {
		if (game.key(`${dir}/${name}`) === "modules/a.json" && ++destWrites === 2) return callback(new Error("注入故障: 回写旧目标失败"));
		return originalWrite(data, dir, name, callback);
	};
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/a.json.tmp", "modules/a.json"),
		error =>
			error instanceof IoError &&
			error.ioCode === "IO_ROLLBACK_FAILED" &&
			/恢复失败/.test(error.message) &&
			Array.isArray(error.residual) &&
			error.residual.join(" ").includes(".moving-backup-")
	);
	assert.equal(game.readText("modules/a.json.tmp"), "NEW", "回滚失败也必须保住源");
	assert.notEqual(game.readText("modules/a.json"), "OLD", "此时目标确实没能恢复，不得谎报");
	assert.equal(
		game.movingLeftovers().some(key => key.includes(".moving-backup-")),
		true,
		"备份必须留着，作为旧内容唯一可靠的落盘恢复来源"
	);
}

{
	// G) 提交已校验成功但源删除失败 → 明确失败，但绝不把已提交的新目标回滚成旧内容
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json": "OLD" });
	game.failOnce.add("removeFile:modules/a.json.tmp");
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/a.json.tmp", "modules/a.json"),
		error => error instanceof IoError && error.ioCode === "IO_FAILED" && /源文件删除失败/.test(error.message)
	);
	assert.equal(game.readText("modules/a.json"), "NEW", "已提交的目标不得回滚");
	assert.equal(game.readText("modules/a.json.tmp"), "NEW", "源残留（内容与目标一致，由上层决定如何处理）");
	assert.deepEqual(game.movingLeftovers(), [], "提交之后仍要清理事务件");
}

{
	// H) 自我搬运：内容不变、文件还在、不会把自己删掉
	const game = createLegacyGame({ "modules/a.json": "KEEP" });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await io.movePath("modules/a.json", "modules/a.json");
	assert.equal(game.readText("modules/a.json"), "KEEP");
	assert.equal(game.has("modules/a.json"), true);
	assert.deepEqual(game.movingLeftovers(), []);
}

{
	// I) 目标位置是个目录 → 明确拒绝，不许把文件写到目录路径上搅乱内容
	const game = createLegacyGame({ "modules/a.json.tmp": "NEW", "modules/a.json/inside.txt": "X" });
	const io = createNonameIo({ game, fs: null, stallMs: 800 });
	await assert.rejects(
		() => io.movePath("modules/a.json.tmp", "modules/a.json"),
		error => error instanceof IoError && /目标类型/.test(error.message)
	);
	assert.equal(game.readText("modules/a.json/inside.txt"), "X");
	assert.equal(game.readText("modules/a.json.tmp"), "NEW");
	assert.deepEqual(game.movingLeftovers(), []);
}

// ------------------------------------------------------------------ ZIP 条目越界防护（zip-slip）

{
	assert.equal(normalizeZipEntry("styles/player.css"), "styles/player.css");
	assert.equal(normalizeZipEntry("./assets/a.png"), "assets/a.png");
	for (const bad of ["../evil.js", "/etc/passwd", "a/../../b", "C:/Windows/system32", "a\0b", ""]) {
		assert.throws(() => normalizeZipEntry(bad), /非法包内路径|越界/, `应拒绝条目 ${bad}`);
	}
}

console.log("P5 installer tests: all passed ✓");
