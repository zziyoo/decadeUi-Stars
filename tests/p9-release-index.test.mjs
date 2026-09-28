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

console.log("P9 release-index tests: all passed ✓");
