/**
 * P5 解压能力获取（A+C 修复）测试：JSZip 到底怎么拿到、拿不到时怎么说
 * 运行：node --import ./tests/helpers/register.mjs tests/p5-jszip-source.test.mjs
 *
 * 实机反馈修正了本文件的第一版假设。用户 Console 的 reason 是：
 *   「get.zip 交出的实例不带 2.x 的 load()」+「加载 game/jszip 无响应」
 * 在 Node 里用本体真正 import 的那份 JSZip 复核后确认：jszip@2.7.0 是
 * **整体替换 JSZip.prototype** 的老写法，prototype 上没有 `constructor` 属性，
 * 于是 `instance.constructor === Object`——"从实例反推构造器"这条路根本走不通。
 *
 * 因此端口的抽象单位是**实例**，不是构造器：`get.zip(cb)` 每次 `callback(new JSZip())`
 * 给一个干净实例（2.x 的 `load()` 是原地写入，复用会把上一个包的条目带进下一个）。
 * 本文件锁的就是这两件事：实例必须每次新取，而"哪一级可用"的选型只算一次。
 */
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.decadeUIName = "十周年UI-Stars";

const mod = await import("../src/core/moduleIo.js");

/** 2.x 用法的假实例：有 load()，load 后 .files 出条目 */
function makeInstance(tag = "noname") {
	return {
		tag,
		files: {},
		load(data) {
			this.data = data;
			this.files = { "a.txt": { dir: false, asArrayBuffer: () => new Uint8Array([97, 98]).buffer, asNodeBuffer: () => Buffer.from([97, 98]) } };
			return this;
		},
	};
}

/** 复刻 jszip@2.7.0 的原型形状：实例有 load，但 constructor 指向 Object */
function makeJszip27Like() {
	const inst = makeInstance();
	assert.equal(inst.constructor, Object, "夹具前提：普通对象的 constructor 就是 Object（2.7 替换 prototype 后正是这样）");
	return inst;
}

assert.equal(typeof mod.createJsZipSource, "function", "JSZip 的获取必须独立可测");
assert.equal(typeof (mod.createJsZipSource({ win: {}, get: {}, lib: {} })?.createInstance), "function", "端口对外要的是一份**实例**，不是构造器（2.7 的 constructor 链是断的）");

// ------------------------------------------------------------------ 全局 JSZip（带 load 才行）

{
	class GlobalZip2x {
		constructor() { this.files = {}; }
		load() { this.files = { "a.txt": { dir: false, asArrayBuffer: () => new Uint8Array([97]).buffer } }; return this; }
	}
	let getZipCalls = 0;
	const source = mod.createJsZipSource({ win: { JSZip: GlobalZip2x }, get: { zip: () => getZipCalls++ }, lib: {} });
	const inst = await source.createInstance();
	assert.ok(inst && typeof inst.load === "function", "全局可用时直接 new 一个实例");
	assert.equal(getZipCalls, 0, "全局可用时不该再去动 get.zip");
	assert.equal((await source.probe()).ok, true);
}

// ------------------------------------------------------------------ 3.x 形状必须被拒（不能悄悄写出空条目）

{
	class GlobalZip3x {
		constructor() { this.files = {}; this.loadAsync = () => {}; }
	}
	const source = mod.createJsZipSource({ win: { JSZip: GlobalZip3x }, get: {}, lib: {} });
	const error = await source.createInstance().then(() => null, err => err);
	assert.equal(error?.ioCode, "NO_EXTRACTOR", "只有 loadAsync 的 3.x 不许当可用：否则 zip.files 为空，症状会伪装成「包结构非法」");
}

// ------------------------------------------------------------------ 实机回归锁：constructor 是 Object 也要能干活

{
	let issued = 0;
	const source = mod.createJsZipSource({
		win: {},
		get: { zip: cb => { issued++; cb(makeJszip27Like()); } },
		lib: {},
	});
	const first = await source.createInstance();
	assert.equal(typeof first?.load, "function", "本体 get.zip 给的实例就是能用的那份，不去反推构造器");
	assert.equal(first.constructor, Object, "夹具形状与 jszip@2.7.0 一致（prototype 被整体替换）");

	const second = await source.createInstance();
	assert.notEqual(first, second, "2.x 的 load() 原地写入：每次解压必须拿新实例，否则上一个包的条目会串进下一个");
	// 选型时要一份来验形状（只此一次），此后每次解压现取一份
	assert.equal(issued, 3, "选型一次 + 两次解压各一次");
	await source.createInstance();
	assert.equal(issued, 4, "第三次解压再要一份新实例（选型不重复）");

	// 用第二个实例装载后，第一个不得被污染
	second.load("x");
	assert.equal(Object.keys(first.files).length, 0, "实例之间互不影响");
}

// ------------------------------------------------------------------ 选型只算一次，失败不许反复白等

{
	let entered = 0;
	const source = mod.createJsZipSource({
		win: {},
		get: { zip: () => { entered++; } },
		lib: {},
		stallMs: 200,
	});
	const keepAlive = setTimeout(() => {}, 5000);
	let error = null;
	let elapsed = 0;
	try {
		const started = Date.now();
		error = await source.createInstance().then(() => null, err => err);
		elapsed = Date.now() - started;
	} finally {
		clearTimeout(keepAlive);
	}
	assert.ok(error, "get.zip 不回调也必须落定（本体不回调时 watchdog 兜底，不静默当成功）");
	assert.equal(error.ioCode, "NO_EXTRACTOR", "落定原因归能力缺失");
	assert.match(error.message, /JSZip/);
	assert.ok(elapsed < 3000, `不许长挂，实际 waited ${elapsed}ms`);
	assert.equal(entered, 1, "一次探测进了一次");

	// 失败也被缓存：再要实例不该再白等一遍 watchdog
	const again = Date.now();
	const error2 = await source.createInstance().then(() => null, err => err);
	assert.equal(error2?.ioCode, "NO_EXTRACTOR", "第二次仍是能力缺失，不许假装成功");
	assert.ok(Date.now() - again < 100, `选型失败要缓存，第二次几乎零耗时，实际 ${Date.now() - again}ms`);
	assert.equal(entered, 1, "失败后不许反复重探");
	const probed = await source.probe();
	assert.equal(probed.ok, false);
	assert.match(probed.reason, /JSZip/);
}

// ------------------------------------------------------------------ 全断：三级都不给

{
	const source = mod.createJsZipSource({ win: {}, get: {}, lib: {} });
	const error = await source.createInstance().then(() => null, err => err);
	assert.equal(error?.ioCode, "NO_EXTRACTOR");
	assert.match(error.message, /get\.zip|JSZip/, "原因要能指到具体哪一级，玩家回贴时才有用");
}

// ------------------------------------------------------------------ 老构建：lib.init.js 脚本加载后出现全局

{
	class ScriptZip {
		constructor() { this.files = {}; }
		load() { this.files = { "a.txt": { dir: false, asArrayBuffer: () => new Uint8Array([97]).buffer } }; return this; }
	}
	const win = {};
	const lib = { assetURL: "http://x/", init: { js: (dir, name, cb) => { win.JSZip = ScriptZip; cb(); } } };
	const source = mod.createJsZipSource({ win, get: {}, lib });
	assert.equal(typeof (await source.createInstance())?.load, "function", "脚本加载后 window.JSZip 出现仍算成功");
}

// ------------------------------------------------------------------ 解压端口

function makeIo() {
	const writes = [];
	const removed = [];
	return {
		writes,
		removed,
		capabilities: { desktop: false, atomicRename: true },
		kind: async () => null,
		readText: async () => JSON.stringify({ schema: 1, modules: {} }),
		writeText: async () => {},
		writeBinary: async rel => { writes.push(rel); },
		readBinary: async () => new Uint8Array([1, 2, 3, 4]).buffer,
		removeFile: async rel => { removed.push(rel); },
		removeTree: async () => {},
		createDir: async () => {},
		listFiles: async () => [],
		movePath: async () => {},
	};
}

{
	const io = makeIo();
	const extractor = mod.createZipExtractor({ io, jsZip: mod.createJsZipSource({ win: {}, get: { zip: cb => cb(makeInstance()) }, lib: {} }) });
	const landed = await extractor.extract(new Uint8Array([1, 2, 3]).buffer, "tmp/pack");
	assert.deepEqual(landed, ["tmp/pack/a.txt"], "落地路径按扩展根相对返回");
	assert.deepEqual(io.writes, ["tmp/pack/a.txt"]);
	assert.equal(typeof extractor.probe, "function", "端口要可探测，界面才不会谎报可安装");
	assert.equal((await extractor.probe()).ok, true);
}
{
	const io = makeIo();
	const dead = mod.createZipExtractor({ io, jsZip: mod.createJsZipSource({ win: {}, get: {}, lib: {} }) });
	const error = await dead.extract(new Uint8Array([1]).buffer, "tmp/dead").then(() => null, err => err);
	assert.equal(error?.ioCode, "NO_EXTRACTOR");
	assert.deepEqual(io.writes, [], "取不到库时一个字节都不许写");
	assert.equal((await dead.probe()).ok, false);
}

// ------------------------------------------------------------------ 安装器：映射、置灰依据与端口形状

const { createPackageInstaller } = await import("../src/core/packageInstaller.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");

function installerHarness(extractZip, hooks = {}) {
	const registry = createModuleRegistry();
	const io = makeIo();
	const calls = { download: 0 };
	const installer = createPackageInstaller({
		registry,
		moduleManager: createModuleManager({ registry }),
		io,
		extractZip,
		download: async (...args) => {
			calls.download++;
			return hooks.download ? hooks.download(...args) : { buffer: new Uint8Array([1, 2, 3, 4]).buffer, bytes: 4, attempts: 1 };
		},
		hash: async () => "0".repeat(64),
	});
	return { installer, io, calls };
}

{
	// 已知取不到解压能力 ⇒ 必须在**下载之前**拒绝：能力都没有，不该先把包下下来再失败
	const noZip = Object.assign(new Error("[ModuleIo] 取不到可用的 JSZip"), { ioCode: "NO_EXTRACTOR" });
	const { installer, io, calls } = installerHarness({ extract: async () => { throw noZip; }, probe: async () => ({ ok: false, reason: "取不到本体 JSZip" }) });
	const result = await installer.install({ id: "decade", expectedVersion: "1.4.2", url: "https://x/decade.zip", expectedSha256: "0".repeat(64) });
	assert.equal(result.code, "NO_EXTRACTOR", `能力缺失必须报 NO_EXTRACTOR，实际 ${result.code}——报成 STRUCTURE_INVALID 会让人以为下载到的包坏了`);
	assert.equal(result.stage, "resolving", "早拒要发生在 resolving，不该走到 extracting");
	assert.equal(calls.download, 0, "能力缺失时不许发生下载（20MB 白下一遍是这一轮要消除的现象）");
	assert.deepEqual(io.writes, [], "既没下载也不该落下任何文件（含 tmp/）");

	const ready = await installer.ready();
	assert.equal(ready.ok, false, "界面置灰看 ready()，不是只看端口对象在不在");
	assert.match(ready.reason, /JSZip/);
}
{
	// 函数形状的旧端口仍要能用（P5 既有测试与外部注入都是这种）
	const { installer } = installerHarness({ extract: async () => ["tmp/pack/a.txt"], probe: async () => ({ ok: true, reason: "" }) });
	assert.equal((await installer.ready()).ok, true);
	const fn = installerHarness(async () => ["tmp/pack/a.txt"]);
	const result = await fn.installer.install({ id: "decade", expectedVersion: "1.4.2", url: "https://x/decade.zip", expectedSha256: "0".repeat(64) });
	assert.equal(result.code, "MANIFEST_INVALID", "函数形状端口能被调用（走到结构校验才因夹具 manifest 不合而停）");
	assert.equal(fn.calls.download, 1, "旧端口没有 probe 时不得被误判成取不到能力从而拒装");
}

// -------------------------------------------------- 能力语义：isAvailable() 与 ready() 必须说同一件事

{
	// A) 未注入解压端口：两边都必须是"不可用"，且 ready() 之后结论不许反转
	const { installer } = installerHarness(null);
	const before = installer.isAvailable();
	assert.equal(before.available, false);
	assert.equal(before.missingExtractor, true);
	assert.equal((await installer.ready()).ok, false);
	const after = installer.isAvailable();
	assert.equal(after.available, false, "ready() 之后不能被端口在不在顶回可用");
	assert.equal(after.ready, true, "探测已完成");
}

{
	// B) probe 通过：探测前是"未验证"（不许声称可用），探测后两边一致为可用
	let probes = 0;
	const probe = async () => { probes++; return { ok: true, reason: "" }; };
	const { installer } = installerHarness({ extract: async () => [], probe });
	const before = installer.isAvailable();
	assert.equal(before.available, false, "还没探测就不能声称可用");
	assert.equal(before.ready, false, "ready 字段要如实反映尚未验证过");
	assert.equal((await installer.ready()).ok, true);
	const after = installer.isAvailable();
	assert.equal(after.available, true);
	assert.equal(after.ready, true);
	assert.equal(after.missingExtractor, false);
	assert.equal(after.missingIo, false);
	assert.equal(probes, 1);
}

{
	// C) probe 失败：缓存失败，isAvailable() 永久转为不可用（同一次运行内不再翻供）
	let probes = 0;
	const probe = async () => { probes++; return { ok: false, reason: "取不到本体 JSZip" }; };
	const { installer } = installerHarness({ extract: async () => [], probe });
	assert.equal((await installer.ready()).ok, false);
	const after = installer.isAvailable();
	assert.equal(after.available, false);
	assert.equal(after.ready, true);
	assert.match(after.reason, /JSZip/, "失败原因要透出来，界面才能给出可诊断的置灰理由");
	assert.equal(installer.isAvailable().available, false, "再问一次也不许变回 true");
	assert.equal(probes, 1, "失败同样要缓存，不能每次问都重探");
}

{
	// D) 并发 ready()：复用同一次探测（窗口频繁 refresh 不该把 JSZip 反复加载）
	let probes = 0;
	const probe = async () => { probes++; await new Promise(resolve => setTimeout(resolve, 20)); return { ok: true, reason: "" }; };
	const { installer } = installerHarness({ extract: async () => [], probe });
	const results = await Promise.all([installer.ready(), installer.ready(), installer.ready()]);
	assert.ok(results.every(item => item.ok === true), "三次并发都要拿到同一个结论");
	assert.equal(probes, 1, `并发必须复用同一次 probe，实际 ${probes} 次`);
	assert.equal((await installer.ready()).ok, true);
	assert.equal(probes, 1, "后续调用直接读缓存");
}

{
	// E) 没有 probe 方法的端口（注入替身/纯函数端口）：按既有事实视为可用，不凭空判死
	const { installer } = installerHarness({ extract: async () => [] });
	assert.equal((await installer.ready()).ok, true);
	const after = installer.isAvailable();
	assert.equal(after.available, true);
	assert.equal(after.ready, true);
}

console.log("P5 jszip-source tests: all passed ✓");
