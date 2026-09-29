/**
 * P15 · 传输层与安装规格失败路径（任务书§42 + §17，联网分支的缺口清单）
 *
 * 盘点现有覆盖时发现三处系统性缺口，本文件补齐：
 *   1) `xhrTransport`（生产环境真正跑的那层）**零断言** —— 状态码分档、空响应体、onerror、
 *      onabort 与"超时触发的 abort"要区分成 TIMEOUT/CANCELLED、无 XHR 环境、send 直接抛；
 *      以前所有失败用例都注入在替身 transport 上，这层从来没被跑到。
 *   2) 重试环里"取消发生在等待重试的间隙"这条路径没测过（p5 只测了进环前就已 abort）。
 *   3) 安装器侧的失败分类：`checkSpec` 的 INVALID_SPEC 四种形状、404 不重试/429·5xx 重试、
 *      解压抛错 vs IO 抛错（STRUCTURE_INVALID / IO_FAILED）、摘要算不出来（SHA_UNAVAILABLE →
 *      SHA_MISMATCH + cause）。
 * 另附两条"现状确认"：索引是数组时 `fetchIndex` 现在会放行（下游取不到条目）；
 * `../` 越界的资产地址现在会被解析成同 host 的另一个路径而不被拒 —— 都不改行为，只钉住，
 * 将来收紧时这里会红，逼着同步判据。
 */
import assert from "node:assert/strict";

globalThis.decadeUIName = "十周年UI-Stars";
globalThis.window = { decadeUIName: "十周年UI-Stars", decadeUIPath: "file:///ext/extension/十周年UI-Stars/" };

const { xhrTransport, downloadBuffer, DownloadError, DOWNLOAD_CODES, sha256Hex } = await import("../src/core/downloader.js");
const { createPackageInstaller, INSTALL_CODES } = await import("../src/core/packageInstaller.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { registerBuiltInModules } = await import("../src/core/builtInModules.js");
const { resolveModuleUrl } = await import("../src/core/packageInstaller.js");
const { IoError } = await import("../src/core/moduleIo.js");
const { createFakeIo, toArrayBuffer } = await import("./helpers/fake-io.mjs");

const encoder = new TextEncoder();
const URL_INDEX = "https://example.test/module-index.json";
const URL_ZIP = "https://example.test/mod-1.0.0.zip";

// ---------------------------------------------------------------- xhrTransport 替身

/** 记录每个被创建的假 XHR，便于断言 open/responseType 与事件顺序 */
let instances = [];
/** 下一个请求的响应形状（send 时消费）：{status,statusText,body,error,timeout,hold} */
let nextBehavior = {};
const behavior = value => {
	nextBehavior = value;
};

function installFakeXhr() {
	instances = [];
	nextBehavior = {};
	globalThis.XMLHttpRequest = class FakeXhr {
		constructor() {
			this.readyState = 1;
			this.status = 0;
			this.statusText = "";
			this.response = null;
			this.timeout = 0;
			this.opened = null;
			this.aborted = false;
			this.sent = 0;
			instances.push(this);
		}
		open(method, url, asyncFlag) {
			this.opened = { method, url, asyncFlag };
		}
		addEventListener() {}
		removeEventListener() {}
		send() {
			this.sent++;
			this.serve(nextBehavior);
			nextBehavior = {};
		}
		abort() {
			this.aborted = true;
			queueMicrotask(() => this.onabort?.());
		}
		/** 测试驱动：按给定形状落事件；hold 表示永不响应（交给自家超时定时器） */
		serve({ status = 200, statusText = "OK", body = "payload", error = false, timeout = false, hold = false } = {}) {
			if (hold) return;
			queueMicrotask(async () => {
				this.response = typeof body === "string" ? toArrayBuffer(body) : body;
				if (this.onprogress) this.onprogress({ loaded: 4, lengthComputable: true, total: 8 });
				if (error) return this.onerror?.();
				if (timeout) return this.ontimeout?.();
				this.status = status;
				this.statusText = statusText;
				this.onload?.();
			});
		}
	};
}

function uninstallFakeXhr() {
	delete globalThis.XMLHttpRequest;
}

installFakeXhr();

// ── 1. 成功路径与请求形状 ───────────────────────────────────────────────
{
	const progress = [];
	const buffer = await xhrTransport(URL_ZIP, { onProgress: info => progress.push(info) });
	assert.ok(buffer instanceof ArrayBuffer, "xhrTransport 必须回传 ArrayBuffer");
	assert.ok(buffer.byteLength > 0);
	const xhr = instances[0];
	assert.deepEqual(xhr.opened, { method: "GET", url: URL_ZIP, asyncFlag: true }, "必须异步 GET 原地址");
	assert.equal(xhr.responseType, "arraybuffer", "响应类型必须是 arraybuffer");
	assert.deepEqual(progress, [{ bytes: 4, total: 8 }], "progress 要翻成 {bytes,total} 给上层算 ratio");
}

// ── 2. 状态码分档 ───────────────────────────────────────────────────────
{
	behavior({ status: 404, statusText: "Not Found", body: "" });
	const err = await xhrTransport(URL_ZIP, {}).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.HTTP, "非 2xx 必须是 HTTP 类失败（带状态码，UI 才能分文案）");
	assert.equal(err.status, 404);
	assert.match(err.message, /404/);
}
{
	behavior({ status: 200, body: null });
	const err = await xhrTransport(URL_ZIP, {}).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.NETWORK, "200 但响应体为空属传输异常，不许当成功");
	assert.equal(err.status, 200);
}
{
	behavior({ error: true });
	const err = await xhrTransport(URL_ZIP, {}).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.NETWORK, "onerror（断网/CORS/解析失败）归 NETWORK");
	assert.match(err.message, /网络不可达/);
}

// ── 3. 超时 vs 用户取消：两者都走 abort，必须分得开 ───────────────────────
{
	behavior({ hold: true });   // 永不响应，交给 xhrTransport 自己的超时定时器
	const err = await xhrTransport(URL_ZIP, { timeoutMs: 5 }).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.TIMEOUT, "超时触发的 abort 必须报 TIMEOUT，不能混成用户取消");
	assert.ok(instances.at(-1).aborted, "超时后必须真的 abort 掉请求");
}
{
	const controller = new AbortController();
	behavior({ hold: true });
	const promise = xhrTransport(URL_ZIP, { signal: controller.signal, timeoutMs: 0 });
	controller.abort();
	const err = await promise.then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.CANCELLED, "玩家点取消必须是 CANCELLED");
	assert.ok(instances.at(-1).aborted, "取消要传导到 xhr.abort()");
}
{
	// 进环前就已取消：连请求都不该发出
	const controller = new AbortController();
	controller.abort();
	instances = [];
	const err = await xhrTransport(URL_ZIP, { signal: controller.signal }).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.CANCELLED);
	assert.equal(instances.length, 0, "预先取消不许还去发请求");
}

// ── 4. 环境缺 XHR 与 send 直接抛 ────────────────────────────────────────
{
	const saved = globalThis.XMLHttpRequest;
	uninstallFakeXhr();
	const err = await xhrTransport(URL_ZIP, {}).then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.NETWORK, "没有 XMLHttpRequest 时如实报不可用，不假装成功");
	assert.match(err.message, /XMLHttpRequest/);
	globalThis.XMLHttpRequest = class extends saved {
		send() {
			throw new Error("浏览器拒绝发起请求");
		}
	};
	const thrown = await xhrTransport(URL_ZIP, {}).then(() => null, error => error);
	assert.equal(thrown.code, DOWNLOAD_CODES.NETWORK);
	assert.match(thrown.message, /请求发起失败/);
	assert.ok(thrown.cause, "要带上原始错误供日志追溯");
	globalThis.XMLHttpRequest = saved;
}

// ── 5. 重试环：可重试分档、次数、以及"等待间隙被取消" ──────────────────────
{
	// 替身 transport 只服务重试语义（第 1~4 节已经用真 xhrTransport 验过分类）
	const calls = [];
	const flaky = (url, options) => {
		calls.push(url);
		if (calls.length < 3) return Promise.reject(new DownloadError(DOWNLOAD_CODES.HTTP, "HTTP 503", { url, status: 503 }));
		return Promise.resolve(toArrayBuffer("ok"));
	};
	const result = await downloadBuffer(URL_ZIP, { transport: flaky, retries: 3, retryDelayMs: 0 });
	assert.equal(result.attempts, 3, "5xx 必须重试直到成功");
	assert.equal(calls.length, 3);

	const once = async (url, options) => {
		calls.push(url);
		throw new DownloadError(DOWNLOAD_CODES.HTTP, "HTTP 404", { url, status: 404 });
	};
	const notFound = await downloadBuffer(URL_ZIP, { transport: once, retries: 3, retryDelayMs: 0 }).then(() => null, error => error);
	assert.equal(notFound.code, DOWNLOAD_CODES.HTTP);
	assert.equal(notFound.attempts, 1, "404 属地址不对，重试只是白耗流量");
}
{
	// 取消发生在"等下一次重试"的间隙里：必须在 sleep 前后各查一次，不能等满退避时间
	let calls = 0;
	const controller = new AbortController();
	const failing = async () => {
		calls++;
		throw new DownloadError(DOWNLOAD_CODES.NETWORK, "断网", { url: URL_ZIP });
	};
	const promise = downloadBuffer(URL_ZIP, {
		transport: failing,
		retries: 3,
		retryDelayMs: 50,
		signal: controller.signal,
		sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
	});
	setTimeout(() => controller.abort(), 10);
	const err = await promise.then(() => null, error => error);
	assert.equal(err.code, DOWNLOAD_CODES.CANCELLED, "退避等待中被取消 ⇒ 必须立刻以 CANCELLED 收场");
	assert.equal(calls, 1, "取消后不许再发起下一次尝试");
}

// ---------------------------------------------------------------- 安装器侧的失败分类

const registry = createModuleRegistry();
registerBuiltInModules(registry, { version: "1.4.2" });
const moduleManager = createModuleManager({ registry });

function makeInstaller({ transport, extractZip, hash, io } = {}) {
	const download = (url, options = {}) => downloadBuffer(url, { ...options, transport, retryDelayMs: 0 });
	return createPackageInstaller({
		registry,
		moduleManager,
		io: io ?? createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) }),
		extractZip: extractZip ?? (async () => []),
		download,
		hash,
		getCoreVersion: () => "1.4.2",
		isInUse: () => false,
		random: () => "t1",
	});
}

const goodManifest = {
	schema: 1,
	id: "mod",
	name: "测试包",
	version: "1.0.0",
	type: "style",
	core: ">=1.0.0",
	dependencies: ["core"],
	entry: { css: ["player.css"] },
	capabilities: ["player-frame"],
};
/** 解压端口：把包"展开"成清单声明的文件 */
const extracting = (io, manifest = goodManifest, extra = { "player.css": "x" }) => async (buffer, targetDir) => {
	await io.writeText(`${targetDir}/manifest.json`, JSON.stringify(manifest));
	for (const [rel, text] of Object.entries(extra)) await io.writeText(`${targetDir}/${rel}`, text);
	return [`${targetDir}/manifest.json`];
};

// ── 6. checkSpec：四种非法形状都要以 INVALID_SPEC 挡住，且不动盘 ─────────────
{
	const io = createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	const installer = makeInstaller({
		io,
		transport: async () => {
			throw new Error("非法规格不该走到下载");
		},
	});
	const cases = [
		[{ id: "Bad Id", url: URL_ZIP }, /模块ID非法/],
		[{ id: "mod" }, /缺少合法下载地址/],
		[{ id: "mod", url: "ftp://example.test/mod.zip" }, /缺少合法下载地址/],
		[{ id: "mod", url: URL_ZIP, version: 100 }, /version 必须为字符串/],
		// 空规格：externalTarget 先把 null 摊平成 {id:undefined}，所以命中的是"ID 非法"那条；
		// checkSpec 里"缺少安装规格"那条从公开入口进不去（防御性代码），这里如实记录现状
		[null, /模块ID非法/],
	];
	for (const [spec, pattern] of cases) {
		const result = await installer.install(spec);
		assert.equal(result.ok, false, `非法规格必须被拒：${JSON.stringify(spec)}`);
		assert.equal(result.code, INSTALL_CODES.INVALID_SPEC, `非法规格的错误码应为 INVALID_SPEC：${JSON.stringify(spec)}`);
		assert.match(result.message, pattern);
	}
	assert.equal([...io.files.keys()].filter(key => key.startsWith("tmp/modules/")).length, 0, "非法规格不许留下任何临时件");
}

// ── 7. 安装器侧的下载失败：结构化 + 零残留 + 不重试 404 ────────────────────
{
	const io = createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	let calls = 0;
	const installer = makeInstaller({
		io,
		transport: async url => {
			calls++;
			throw new DownloadError(DOWNLOAD_CODES.HTTP, "HTTP 404", { url, status: 404 });
		},
	});
	const result = await installer.install({ id: "mod", url: URL_ZIP, version: "1.0.0" });
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.DOWNLOAD_FAILED, "下载失败在安装器侧统一为 DOWNLOAD_FAILED");
	assert.equal(result.stage, "downloading");
	assert.equal(result.cause?.code ?? result.cause, DOWNLOAD_CODES.HTTP, "要带上底层原因，UI 才能分文案");
	assert.equal(calls, 1, "404 不该被安装器重试");
	assert.equal([...io.files.keys()].filter(key => key.startsWith("tmp/modules/")).length, 0, "下载失败不许留半成品");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.mod, undefined, "下载失败不许写台账");
}

// ── 8. 解压失败 vs IO 抛错：两条不同的分类，都不许留残骸 ────────────────────
{
	const io = createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	const broken = makeInstaller({
		io,
		transport: async () => toArrayBuffer("zipbytes"),
		extractZip: async () => {
			throw new Error("不是合法的 zip");
		},
	});
	const structure = await broken.install({ id: "mod", url: URL_ZIP, version: "1.0.0" });
	assert.equal(structure.code, INSTALL_CODES.STRUCTURE_INVALID, "解压失败属包结构非法");
	assert.equal(structure.stage, "extracting");
	assert.equal([...io.files.keys()].filter(key => key.includes("tmp/modules")).length, 0, "解压失败必须清掉临时 zip");

	const ioBroken = makeInstaller({
		io: io2(),
		transport: async () => toArrayBuffer("zipbytes"),
		extractZip: async () => {
			throw new IoError("EACCES", "解压落地被拒");
		},
	});
	const ioResult = await ioBroken.install({ id: "mod2", url: URL_ZIP, version: "1.0.0" });
	assert.equal(ioResult.code, INSTALL_CODES.IO_FAILED, "带 ioCode 的失败必须归 IO_FAILED，不能混成结构非法");
	assert.equal(ioResult.stage, "extracting");
	function io2() {
		return createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	}
}

// ── 9. 摘要算不出来：拒绝安装，且两种文案都区分开 ──────────────────────────
{
	const noHash = async () => {
		const error = new Error("当前环境无 SHA-256 实现");
		error.code = DOWNLOAD_CODES.SHA_UNAVAILABLE;
		throw error;
	};
	const withExpected = makeInstaller({
		io: createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) }),
		transport: async () => toArrayBuffer("zipbytes"),
		hash: noHash,
	});
	const a = await withExpected.install({ id: "mod", url: URL_ZIP, version: "1.0.0", sha256: "abc123" });
	assert.equal(a.code, INSTALL_CODES.SHA_MISMATCH, "算不出摘要时宁可判失败，绝不「无校验通过」");
	assert.equal(a.cause, DOWNLOAD_CODES.SHA_UNAVAILABLE);

	const withoutExpected = makeInstaller({
		io: createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) }),
		transport: async () => toArrayBuffer("zipbytes"),
		hash: noHash,
		extractZip: async () => []
	});
	const b = await withoutExpected.install({ id: "mod", url: URL_ZIP, version: "1.0.0" });
	assert.equal(b.code, INSTALL_CODES.SHA_MISMATCH);
	assert.match(b.message, /缺少 expectedSha256/, "没给期望摘要又算不出实际值：文案要说明是「缺外部摘要」这一类");
}

// ── 10. 正常安装仍然成立（防我把失败路径改成一律拒绝） ─────────────────────
{
	const io = createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	const zipBytes = toArrayBuffer("zipbytes");
	const sha = await sha256Hex(new Uint8Array(zipBytes));
	const installer = makeInstaller({ io, transport: async () => zipBytes, extractZip: extracting(io) });
	const ok = await installer.install({ id: "mod", url: URL_ZIP, version: "1.0.0", sha256: sha });
	assert.equal(ok.ok, true, ok.message);
	assert.equal(ok.hashVerified, true, "外部期望摘要通过才写 hashVerified");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.mod.sha256, sha);
	assert.equal(moduleManager.getInstallState("mod").independent, true);
}

// ── 11. 现状确认（不改行为，只钉住；收紧时这里会红） ────────────────────────
{
	const io = createFakeIo({ "modules/installed.json": JSON.stringify({ schema: 1, modules: {} }) });
	const installer = makeInstaller({ io, transport: async () => toArrayBuffer({ schema: 1, modules: [] }) });
	const arrayIndex = await installer.fetchIndex(URL_INDEX);
	assert.equal(arrayIndex.ok, true, "现状：数组索引能过 fetchIndex 的对象判定（下游取不到条目）");
	assert.equal(Array.isArray(arrayIndex.index.modules), true);
	const missing = await installer.update("nothing", { index: arrayIndex.index, indexUrl: URL_INDEX });
	assert.equal(missing.ok, false, "但拿不到条目时下游必须拒绝，不能装个空东西");

	// `../` 越界：现状被解析成同 host 的另一个路径（索引本身是信任根，绝对地址本来就允许）
	assert.equal(resolveModuleUrl("../evil.zip", "https://host/releases/download/v1/index.json"), "https://host/releases/download/evil.zip");
	// 坏 JSON 仍是结构化失败
	const bad = makeInstaller({ io, transport: async () => toArrayBuffer("{ 坏") });
	const badIndex = await bad.fetchIndex(URL_INDEX);
	assert.equal(badIndex.code, INSTALL_CODES.STRUCTURE_INVALID);
	assert.equal(badIndex.stage, "index");
}

console.log("p15-transport-and-spec-failures: OK（xhrTransport 全事件 + 重试/取消语义 + 安装器失败分类 + 现状钉住）");
