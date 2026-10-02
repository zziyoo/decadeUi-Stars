/**
 * P9 构建产物测试（任务书§46）
 * 运行：node --import ./tests/helpers/register.mjs tests/p9-release-index.test.mjs
 *
 * 本轮要锁的是"索引里的相对地址到底在哪儿被解析"：
 * 解析点只有一个（安装器内部），且对绝对地址幂等 —— 所以调用方可以重复传、
 * 依赖递归也走同一条路，不会出现"界面算一套、安装器算一套"。
 * packageInstaller 不依赖 noname（io/解压/下载全部注入），因此本文件无需浏览器桩。
 */
import assert from "node:assert/strict";

const pkg = await import("../src/core/packageInstaller.js");
const { resolveModuleUrl } = pkg;

// ------------------------------------------------------------------ resolveModuleUrl 语义

{
	assert.equal(typeof resolveModuleUrl, "function", "P9：索引里的 url 必须能按索引地址解析成绝对地址");

	const IDX = "https://host/releases/v1/module-index.json";
	assert.equal(resolveModuleUrl("decade-1.4.2.zip", IDX), "https://host/releases/v1/decade-1.4.2.zip", "裸文件名按索引所在目录解析");
	assert.equal(resolveModuleUrl("packs/decade.zip", IDX), "https://host/releases/v1/packs/decade.zip", "索引可以带子路径");
	assert.equal(resolveModuleUrl("https://cdn.example.com/decade.zip", IDX), "https://cdn.example.com/decade.zip", "绝对地址原样保留（同一份索引可混用 CDN）");
	assert.equal(resolveModuleUrl("//cdn.example.com/decade.zip", IDX), "https://cdn.example.com/decade.zip", "协议相对地址继承索引协议");
	assert.equal(resolveModuleUrl("decade.zip", "https://host/rel/module-index.json?rev=3"), "https://host/rel/decade.zip", "查询串属于索引文件自身，不跟着资产走");
	assert.equal(resolveModuleUrl("decade.zip", undefined), "decade.zip", "没有索引地址时不改写（保持引入本参数之前的行为）");
	assert.equal(resolveModuleUrl("", IDX), "", "空 url 不许拼出索引目录地址（留给 INVALID_SPEC 拒绝）");
	assert.equal(resolveModuleUrl("decade.zip", "definitely not a url"), "decade.zip", "索引地址本身不可解析时原样交给下载器，由它报 INVALID_URL");
	assert.equal(resolveModuleUrl(resolveModuleUrl("decade.zip", IDX), IDX), "https://host/releases/v1/decade.zip", "解析必须幂等（依赖递归会再来一遍）");
}

// ------------------------------------------------------------------ 安装器：opts.indexUrl 贯穿到下载

const IDX = "https://host/releases/v1/module-index.json";
const fakeIo = {
	capabilities: { atomicRename: true },
	kind: async () => null,
	readText: async () => JSON.stringify({ schema: 1, modules: {} }),
	writeText: async () => {},
	writeBinary: async () => {},
	removeFile: async () => {},
	removeTree: async () => {},
	createDir: async () => {},
	listFiles: async () => [],
	movePath: async () => {},
};
const fakeExtract = { extract: async () => [] };

const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { DownloadError } = await import("../src/core/downloader.js");

function harness(extra = {}) {
	const registry = createModuleRegistry();
	const moduleManager = createModuleManager({ registry });
	const asked = [];
	const installer = pkg.createPackageInstaller({
		registry,
		moduleManager,
		io: fakeIo,
		extractZip: fakeExtract,
		download: async url => {
			asked.push(url);
			throw new DownloadError("NETWORK", "测试用截断下载");
		},
		...extra,
	});
	return { installer, asked, registry, moduleManager };
}

{
	// 直接安装：相对 url + indexUrl → 下载器必须收到绝对地址
	const { installer, asked } = harness();
	const result = await installer.install({ id: "decade", version: "1.4.2", url: "decade-1.4.2.zip" }, { indexUrl: IDX });
	assert.equal(result.ok, false, "下载被测试桩截断，本用例只关心请求了哪个地址");
	assert.equal(result.code, "DOWNLOAD_FAILED");
	assert.deepEqual(asked, ["https://host/releases/v1/decade-1.4.2.zip"], "install 必须按索引地址解析相对 url");

	// 不传 indexUrl：保持引入本参数之前的既有契约——相对地址根本到不了下载器，
	// 由 checkSpec 以 INVALID_SPEC 拒绝（本轮不放宽它，避免把"没有基准"当成"地址合法"）
	const bare = harness();
	const bareResult = await bare.installer.install({ id: "decade", version: "1.4.2", url: "decade-1.4.2.zip" }, {});
	assert.equal(bareResult.ok, false);
	assert.equal(bareResult.code, "INVALID_SPEC", "没有索引基准时相对地址应照旧被拒，而不是硬拼一个地址");
	assert.deepEqual(bare.asked, [], "被拒的规格不许发起下载");

	// 绝对地址传了 indexUrl 也不该被动过
	const abs = harness();
	await abs.installer.install({ id: "decade", version: "1.4.2", url: "https://cdn/decade.zip" }, { indexUrl: IDX });
	assert.deepEqual(abs.asked, ["https://cdn/decade.zip"], "解析必须幂等");
}

{
	// 依赖递归：缺失依赖从索引取条目，同样要按索引地址解析
	const { createPackageInstaller } = pkg;
	const registry = createModuleRegistry();
	const moduleManager = createModuleManager({ registry });
	moduleManager.register({ schema: 1, id: "core", name: "核心", version: "1.4.2", type: "core" });
	const asked = [];
	const installer = createPackageInstaller({
		registry,
		moduleManager,
		io: fakeIo,
		extractZip: fakeExtract,
		download: async url => {
			asked.push(url);
			throw new DownloadError("NETWORK", "测试用截断下载");
		},
	});
	const index = { schema: 1, modules: { shared: { latest: "1.0.0", url: "shared-1.0.0.zip", core: ">=1.0.0" } } };
	const result = await installer.install({ id: "online", version: "1.4.2", url: "online-1.4.2.zip", dependencies: ["shared"] }, { index, indexUrl: IDX });
	assert.equal(result.ok, false);
	assert.deepEqual(asked, ["https://host/releases/v1/shared-1.0.0.zip"], "先装依赖且地址已解析；依赖装失败就不该继续下主包（§11 既有语义）");

	// 依赖已在注册表里 → 不必下载依赖，主包地址同样按索引解析
	const okRegistry = createModuleRegistry();
	const okManager = createModuleManager({ registry: okRegistry });
	for (const fixture of [
		{ schema: 1, id: "core", name: "核心", version: "1.4.2", type: "core" },
		{ schema: 1, id: "shared", name: "共享", version: "1.0.0", type: "shared", core: ">=1.4.2" },
	]) {
		const registered = okManager.register(fixture);
		assert.equal(registered.ok, true, `夹具注册失败: ${fixture.id} ${(registered.errors || []).join(", ")}`);
	}
	const askedMain = [];
	const mainInstaller = createPackageInstaller({
		registry: okRegistry,
		moduleManager: okManager,
		io: fakeIo,
		extractZip: fakeExtract,
		download: async url => {
			askedMain.push(url);
			throw new DownloadError("NETWORK", "测试用截断下载");
		},
	});
	await mainInstaller.install({ id: "online", version: "1.4.2", url: "online-1.4.2.zip", dependencies: ["shared"] }, { index, indexUrl: IDX });
	assert.deepEqual(askedMain, ["https://host/releases/v1/online-1.4.2.zip"], "主包地址必须已解析");
}

// ------------------------------------------------------------------ fetchIndex 回带索引地址

{
	const registry = createModuleRegistry();
	const withIndex = pkg.createPackageInstaller({
		registry,
		moduleManager: createModuleManager({ registry }),
		io: fakeIo,
		extractZip: fakeExtract,
		download: async () => ({ buffer: new TextEncoder().encode(JSON.stringify({ schema: 1, modules: {} })).buffer, bytes: 2, attempts: 1 }),
	});
	const fetched = await withIndex.fetchIndex(IDX);
	assert.equal(fetched.ok, true, `索引获取应成功：${fetched.message}`);
	assert.equal(fetched.indexUrl, IDX, "fetchIndex 要把索引自身的地址回带给调用方，否则相对 url 无从解析");
}

// ------------------------------------------------------------------ 构建脚本：索引生成与 zip 结构

{
	let script = null;
	try {
		script = await import("../scripts/build-release.mjs");
	} catch {
		/* 脚本尚不存在：下面按缺函数失败，而不是让整份测试崩在 import */
	}
	assert.equal(typeof script?.buildIndex, "function", "P9：module-index 的生成必须是可单测的纯函数");
	assert.equal(typeof script?.zipDir, "function", "P9：分包 zip 的生成必须可单测（不绑死在命令行流程里）");

	const packs = [
		{ id: "core", version: "1.4.2", manifest: { id: "core", name: "核心", type: "core", version: "1.4.2" }, zip: { file: "core-1.4.2.zip", bytes: 10, sha256: "b".repeat(64) } },
		{ id: "decade", version: "1.4.2", manifest: { id: "decade", name: "十周年样式", type: "style", version: "1.4.2", core: ">=1.4.2", dependencies: ["core"], capabilities: ["player-frame"] }, zip: { file: "decade-1.4.2.zip", bytes: 123, sha256: "a".repeat(64) } },
		{ id: "card-skin", version: "1.4.2", manifest: { id: "card-skin", name: "卡牌皮肤", type: "feature", version: "1.4.2", core: ">=1.4.2", dependencies: ["core"], capabilities: ["card-skin"] }, zip: { file: "card-skin-1.4.2.zip", bytes: 456, sha256: "c".repeat(64) } },
	];
	const index = script.buildIndex({ packs, coreVersion: "1.4.2" });

	assert.equal(index.schema, 1);
	assert.deepEqual(index.core, { version: "1.4.2", latest: "1.4.2" }, "顶层 core 段供客户端做兼容判断");
	assert.equal(index.modules.core, undefined, "本轮 Core 无包形态，不许混进可安装列表（否则界面会出现装不上的 Core）");
	assert.deepEqual(Object.keys(index.modules).sort(), ["card-skin", "decade"]);

	const decade = index.modules.decade;
	assert.equal(decade.url, "decade-1.4.2.zip", "url 写裸文件名：同一份索引可指本地服务也可指 Release 资产");
	assert.equal(decade.latest, "1.4.2");
	assert.equal(decade.sha256, "a".repeat(64), "外部摘要取 zip 自身（安装器校验的是下载落盘那段字节）");
	assert.equal(decade.size, 123, "size 必须是 zip 字节数，不是包内文件之和");
	assert.equal(decade.type, "style");
	assert.deepEqual(decade.dependencies, ["core"]);
	assert.equal(decade.core, ">=1.4.2", "缺 core 要求的条目会被安装器拒绝，这里必须带上");

	// 索引条目交给安装器后必须能解析成绝对地址（与 §47 发布地址无关的闭环）
	assert.equal(resolveModuleUrl(decade.url, IDX), "https://host/releases/v1/decade-1.4.2.zip");

	// P19：releaseBase 是内置默认源解析裸文件名的基址。缺省为空串（纯索引形态不变），传入则原样保留。
	assert.equal(index.releaseBase, "", "未传 releaseBase 时为空串，索引 schema 不变");
	const BASE = "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2/";
	const withBase = script.buildIndex({ packs, coreVersion: "1.4.2", releaseBase: BASE });
	assert.equal(withBase.releaseBase, BASE, "releaseBase 原样写入索引");
	assert.equal(
		resolveModuleUrl(withBase.modules.decade.url, withBase.releaseBase),
		`${BASE}decade-1.4.2.zip`,
		"内置索引按 releaseBase 把裸文件名解析成 Release 资产地址（基址带尾斜杠，最后一段不会丢）"
	);
}

// ------------------------------------------------------------------ 构建脚本：zip 结构（manifest 必须在根）

{
	const fs = await import("node:fs");
	const os = await import("node:os");
	const path = await import("node:path");
	const JSZip = (await import("jszip")).default;
	const script = await import("../scripts/build-release.mjs");

	// 所有产物与源目录都在同一个临时根里，删除只及本临时根（绝不让 rmSync 指向 os.tmpdir()）
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p9-release-"));
	const src = path.join(tmp, "pack");
	fs.mkdirSync(src, { recursive: true });
	// 故意做出"有子目录、有非 ASCII 文件名"的包，验证条目名与结构
	fs.writeFileSync(path.join(src, "manifest.json"), JSON.stringify({ schema: 1, id: "demo", name: "演示包", version: "1.0.0", type: "style", core: ">=1.0.0", entry: { css: ["styles/主样式.css"] } }));
	fs.mkdirSync(path.join(src, "styles"), { recursive: true });
	fs.writeFileSync(path.join(src, "styles", "主样式.css"), ".demo{color:red}");
	const out = path.join(tmp, "demo-1.0.0.zip");

	const info = await script.zipDir(src, out, {});
	assert.equal(info.file, "demo-1.0.0.zip");
	assert.match(info.sha256, /^[0-9a-f]{64}$/, `sha256 必须是 64 位十六进制：${info.sha256}`);
	assert.equal(info.bytes, fs.statSync(out).size, "上报字节数必须等于落盘 zip 的实际大小");
	assert.equal(info.files, 2, "只打源目录里的两个文件");

	const zip = await JSZip.loadAsync(fs.readFileSync(out));
	const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
	assert.deepEqual(names.sort(), ["manifest.json", "styles/主样式.css"], "条目用正斜杠相对路径，且 manifest.json 直接在根");
	// 目录条目一律不写：JSZip 自动补的父目录条目取的是当前时间（DOS 时间 2 秒粒度），
	// 留着它，同样内容的两次构建就会算出不同摘要；解压侧（moduleIo.extract）按路径自建目录。
	assert.deepEqual(Object.keys(zip.files).filter(name => zip.files[name].dir), [], "不得含目录条目");
	const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
	assert.equal(manifest.id, "demo", "回读根位 manifest 才能过安装器§24 的结构校验");

	// 确定性：同一内容两次打包必须得到同一个摘要，否则索引每次构建都在无意义地变
	const out2 = path.join(tmp, "demo-1.0.0-again.zip");
	const info2 = await script.zipDir(src, out2, {});
	assert.equal(info2.sha256, info.sha256, "zip 内容确定性：不许把当前时间写进条目时间戳");

	// 输出落在源目录里时不许把自己打进去（构建脚本dist 套 dist 的情况真实存在）
	const inside = path.join(src, "self.zip");
	const info3 = await script.zipDir(src, inside, {});
	assert.equal(info3.files, 2, "生成中的 zip 不得自我包含");

	fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("P9 release-index tests: all passed ✓");
