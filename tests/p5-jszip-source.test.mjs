/**
 * P5 解压能力获取（A+C 修复）测试：JSZip 到底从哪儿来、拿不到时怎么说
 * 运行：node --import ./tests/helpers/register.mjs tests/p5-jszip-source.test.mjs
 *
 * 背景（真机静态取证）：本体把 jszip@2.7.0 当 ES 模块内联使用，
 * **从不**给 window.JSZip 赋值，也没有 resources/app/game/jszip.js 这个脚本，
 * 所以旧实现的 defaultLoadJsZip 两条路都断在运行时。
 * 这里锁三件事：
 *   1. 获取顺序 window.JSZip → 本体公开 API get.zip → lib.init.js，且结果缓存；
 *   2. 全拿不到时以 ioCode=NO_EXTRACTOR 落定（永不 pending、也不伪装成包结构非法）；
 *   3. 安装器把这类失败映射成 NO_EXTRACTOR 且零落地，并新增 ready() 供界面诚实置灰。
 * 用 mimic 2.x API 的假构造器：测的是"取哪份构造器"，不是 jszip 内部（2.7 真读产物
 * 已由一次性探针逐字节验过）。
 */
import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.decadeUIName = "十周年UI-Stars";

const mod = await import("../src/core/moduleIo.js");

/** 造一个 mimicking 本体 JSZip 2.x 用法的构造器：`new Ctor()` 带 load()，load 后 .files 可用 */
function makeCtor(tag) {
	return class JSZipMock {
		constructor(data) {
			this.tag = tag;
			this.data = data;
			this.files = {};
		}
		/** 2.x 的读法：new JSZip() 之后 .load(buffer) —— 本体 optionsMenu 就是这么用的 */
		load(data) {
			this.data = data;
			this.files = { "a.txt": { dir: false, asArrayBuffer: () => new Uint8Array([97, 98]).buffer } };
			return this;
		}
	};
}

// ------------------------------------------------------------------ 获取必须可独立注入

assert.equal(typeof mod.createJsZipSource, "function", "P5：JSZip 的获取必须独立可测（不能埋在 defaultLoadJsZip 里）");

// 1) 全局可用时优先用它，不去动本体的其它入口
{
	const ctor = makeCtor("global");
	let getZipCalls = 0;
	const source = mod.createJsZipSource({ win: { JSZip: ctor }, get: { zip: () => getZipCalls++ }, lib: {} });
	assert.equal(await source.load(), ctor, "window.JSZip 存在就直接用");
	assert.equal(getZipCalls, 0, "全局可用时不许再去动用 get.zip");
}

// 1b) 形状不对的一律不许当可用：3.x 只有 loadAsync、没有 load，
//     若当可用接受，zip.files 会是空对象 → 最后报成"包结构非法"，比现在更难查
{
	class JSZipV3 {
		constructor() { this.files = {}; this.loadAsync = () => {}; }
	}
	const source = mod.createJsZipSource({ win: { JSZip: JSZipV3 }, get: {}, lib: {} });
	const error = await source.load().then(() => null, err => err);
	assert.equal(error?.ioCode, "NO_EXTRACTOR", "JSZip 3.x 形状必须被拒（我们用的是 2.x 的 load 契约）");
}

// 2) 本体的正规入口：get.zip(cb) 把实例交出来，构造器就从实例上取
{
	const ctor = makeCtor("noname");
	let calls = 0;
	const source = mod.createJsZipSource({
		win: {},
		get: { zip: cb => { calls++; cb({ constructor: ctor }); } },
		lib: {},
	});
	assert.equal(await source.load(), ctor, "本体 get.zip 的实现就是 callback(new JSZip())，实例的 constructor 即那份 JSZip");
	await source.load();
	await source.load();
	assert.equal(calls, 1, "探测结果必须缓存：不能每个包解压都重新加载一遍");
}

// 3) 连 get.zip 都没有的老构建：才回落到 lib.init.js 脚本加载
{
	const ctor = makeCtor("script");
	const win = {};
	const lib = { assetURL: "http://x/", init: { js: (dir, name, cb) => { win.JSZip = ctor; cb(); } } };
	const source = mod.createJsZipSource({ win, get: {}, lib });
	assert.equal(await source.load(), ctor, "脚本加载后 window.JSZip 出现仍算成功");
}

// 4) 全部拿不到：ioCode=NO_EXTRACTOR，且 probe 给出原因
{
	const source = mod.createJsZipSource({ win: {}, get: {}, lib: {} });
	const error = await source.load().then(() => null, err => err);
	assert.ok(error, "拿不到 JSZip 必须以失败落定，绝不静默当成功");
	assert.equal(error.ioCode, "NO_EXTRACTOR", "能力缺失要报 NO_EXTRACTOR，不能留成裸 Error");
	assert.match(error.message, /JSZip/);
	const probed = await source.probe();
	assert.equal(probed.ok, false);
	assert.match(probed.reason, /JSZip/);
}

// 5) 本体不回调时不得永挂（watchdog 兜底仍归为能力缺失）
{
	const source = mod.createJsZipSource({ win: {}, get: { zip: () => {} }, lib: {}, stallMs: 200 });
	const started = Date.now();
	// settle() 的 watchdog 计时器是 unref 的（P5 就不想让兜底拖住进程），
	// 浏览器里 setTimeout 返回值没有 unref、行为不受影响；在 Node 里本用例得自己保持事件循环存活。
	const keepAlive = setTimeout(() => {}, 5000);
	let error = null;
	try {
		error = await source.load().then(() => null, err => err);
	} finally {
		clearTimeout(keepAlive);
	}
	assert.ok(error, "get.zip 不回调也必须落定");
	assert.equal(error.ioCode, "NO_EXTRACTOR", "落定原因归能力缺失");
	assert.match(error.message, /JSZip/);
	assert.ok(Date.now() - started < 3000, `不许长挂，实际 waited ${Date.now() - started}ms`);
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
		writeBinary: async (rel, data) => { writes.push(rel); },
		// 安装器会回读落盘内容算摘要（SHA 判据取自磁盘而非内存），缺了这个方法会先炸在这一步
		readBinary: async () => new Uint8Array([1, 2, 3, 4]).buffer,
		removeFile: async rel => { removed.push(rel); },
		removeTree: async () => {},
		createDir: async () => {},
		listFiles: async () => [],
		movePath: async () => {},
	};
}

assert.equal(typeof mod.createZipExtractor, "function", "解压端口必须仍然可注入创建");
{
	const io = makeIo();
	const extractor = mod.createZipExtractor({ io, jsZip: mod.createJsZipSource({ win: { JSZip: makeCtor("g") }, get: {}, lib: {} }) });
	const landed = await extractor.extract(new Uint8Array([1, 2, 3]).buffer, "tmp/pack");
	assert.deepEqual(landed, ["tmp/pack/a.txt"], "解压落地路径仍按扩展根相对返回");
	assert.deepEqual(io.writes, ["tmp/pack/a.txt"]);
	assert.equal(typeof extractor.probe, "function", "端口要能被探测，界面才不会谎报可安装");
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

// ------------------------------------------------------------------ 安装器：映射与 ready()

const { createPackageInstaller } = await import("../src/core/packageInstaller.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { DownloadError } = await import("../src/core/downloader.js");

function installerHarness(extractZip) {
	const registry = createModuleRegistry();
	const io = makeIo();
	const installer = createPackageInstaller({
		registry,
		moduleManager: createModuleManager({ registry }),
		io,
		extractZip,
		download: async () => ({ buffer: new Uint8Array([1, 2, 3, 4]).buffer, bytes: 4, attempts: 1 }),
		hash: async () => "0".repeat(64),
	});
	return { installer, io };
}

{
	const noZip = Object.assign(new Error("[ModuleIo] 取不到本体 JSZip"), { ioCode: "NO_EXTRACTOR" });
	const { installer, io } = installerHarness({ extract: async () => { throw noZip; }, probe: async () => ({ ok: false, reason: "取不到本体 JSZip" }) });
	const result = await installer.install({ id: "decade", expectedVersion: "1.4.2", url: "https://x/decade.zip", expectedSha256: "0".repeat(64) });
	assert.equal(result.ok, false);
	assert.equal(result.code, "NO_EXTRACTOR", `解压能力缺失必须报 NO_EXTRACTOR，实际 ${result.code}——以前会被误报成 STRUCTURE_INVALID（像包自己的问题）`);
	assert.equal(result.stage, "extracting");
	assert.deepEqual(io.writes.filter(rel => rel.startsWith("modules/")), [], "失败不得在正式模块目录下落一个文件");
	assert.ok(io.removed.some(rel => rel.startsWith("tmp/")), "临时 zip 必须被清理");

	const ready = await installer.ready();
	assert.equal(ready.ok, false, "界面置灰要看 ready()，不能只看同端口是否注入");
	assert.match(ready.reason, /JSZip/);
	assert.equal(result.message !== undefined, true, "面向玩家的 message 必须还在");
}
{
	// 注入了没有 probe 的端口（单测常用替身）：不得因此误判不可用
	const { installer } = installerHarness({ extract: async () => ["tmp/pack/a.txt"] });
	const ready = await installer.ready();
	assert.equal(ready.ok, true, "端口没提供探测能力时按现有事实（已注入）报可用");
}

console.log("P5 jszip-source tests: all passed ✓");
