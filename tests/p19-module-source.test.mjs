/**
 * P19 内置默认模块源测试。
 * 运行：node --import ./tests/helpers/register.mjs tests/p19-module-source.test.mjs
 *
 * 锁三件事：
 *   1. 模块源只有一种判定：`moduleIndexUrl` 为空 ⇒ 内置 modules/module-index.json；
 *      非空 ⇒ 自定义远程索引（已有自定义地址绝不会被内置源顶掉）。
 *   2. 内置索引只读固定路径、JSON 结构不合法就拒绝，indexUrl 取索引自带的 releaseBase。
 *   3. 启动更新检查与模块管理窗口走同一条规则；"恢复默认"在源码层只能写空串，不能写死版本地址。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const src = await import("../src/core/moduleIndexSource.js");
const { resolveIndexSource, loadBuiltInIndex, loadModuleIndex } = src;

// ------------------------------------------------------------------ resolveIndexSource：唯一判定

{
	assert.deepEqual(resolveIndexSource(""), { kind: "builtin", url: "" }, "空配置＝内置模块源");
	assert.deepEqual(resolveIndexSource("   "), { kind: "builtin", url: "" }, "纯空白等同空配置");
	assert.deepEqual(resolveIndexSource(null), { kind: "builtin", url: "" }, "配置缺失等同空配置");
	assert.deepEqual(resolveIndexSource(undefined), { kind: "builtin", url: "" });
	assert.deepEqual(resolveIndexSource("https://example.com/module-index.json"), { kind: "remote", url: "https://example.com/module-index.json" }, "非空＝自定义远程源");
	assert.deepEqual(resolveIndexSource("  https://mirror.example.com/mi.json  "), { kind: "remote", url: "https://mirror.example.com/mi.json" }, "首尾空白要修剪");
	assert.deepEqual(resolveIndexSource("not-a-url"), { kind: "remote", url: "not-a-url" }, "来源判定不校验 URL 形状（那由下载器/安装器负责），只看空不空");
}

// ------------------------------------------------------------------ loadBuiltInIndex：固定路径 + 结构校验

/** fetch 替身：记录请求并按表回内容 */
const fetchStub = (table, { capture = [] } = {}) => async url => {
	capture.push(String(url));
	const hit = table[url] ?? table["*"];
	if (!hit) return { ok: false, status: 404, text: async () => "" };
	if (hit instanceof Error) throw hit;
	return { ok: true, status: 200, text: async () => hit };
};

{
	const index15 = {
		schema: 1,
		core: { version: "1.5.0", latest: "1.5.0" },
		releaseBase: "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.5.0/",
		modules: { decade: { name: "decade", latest: "1.5.0", url: "decade-1.5.0.zip" } },
	};
	const capture = [];
	const fetchImpl = fetchStub({ "*": JSON.stringify(index15) }, { capture });
	const res = await loadBuiltInIndex({ fetchImpl });
	assert.equal(res.ok, true, `合法内置索引应读成功：${res.message}`);
	assert.equal(res.index.modules.decade.latest, "1.5.0");
	assert.equal(res.indexUrl, index15.releaseBase, "indexUrl 取索引自带的 releaseBase（裸文件名靠它解析成 Release 资产地址）");
	assert.equal(capture.length, 1);
	assert.ok(capture[0].endsWith("modules/module-index.json"), `只许读固定路径，实际请求 ${capture[0]}`);

	// 结构校验（P19 加固）：构建期必然写入 schema/core.version/releaseBase，任何一项缺失或坏形
	// 都说明这份内置索引已损坏——明确报 STRUCTURE_INVALID，不静默接受（旧行为"缺 releaseBase 也算读成功"已作废）。
	const badIndexes = [
		[{ schema: 1, core: { version: "1.5.0" }, modules: {} }, /releaseBase/, "缺 releaseBase"],
		[{ core: { version: "1.5.0" }, releaseBase: "https://github.com/x/y/", modules: {} }, /schema/, "缺 schema"],
		[{ schema: 2, core: { version: "1.5.0" }, releaseBase: "https://github.com/x/y/", modules: {} }, /schema/, "schema 不是 1"],
		[{ schema: 1, releaseBase: "https://github.com/x/y/", modules: {} }, /core/, "缺 core 段"],
		[{ schema: 1, core: {}, releaseBase: "https://github.com/x/y/", modules: {} }, /core\.version/, "core 缺 version"],
		[{ schema: 1, core: { version: "1.5.0" }, releaseBase: "http://github.com/x/y/", modules: {} }, /releaseBase/, "releaseBase 不是 https"],
		[{ schema: 1, core: { version: "1.5.0" }, releaseBase: "https://github.com/x/y", modules: {} }, /releaseBase/, "releaseBase 没有尾斜杠（基址会丢最后一段）"],
		[{ schema: 1, core: { version: "1.5.0" }, releaseBase: "", modules: {} }, /releaseBase/, "releaseBase 为空串"],
		[{ schema: 1, core: { version: "1.5.0" }, releaseBase: 42, modules: {} }, /releaseBase/, "releaseBase 不是字符串"],
		[{ schema: 1, core: { version: "1.5.0" }, releaseBase: "https://github.com/x/y/", modules: [] }, /modules/, "modules 是数组不是对象"],
	];
	for (const [bad, pattern, why] of badIndexes) {
		const res = await loadBuiltInIndex({ fetchImpl: fetchStub({ "*": JSON.stringify(bad) }) });
		assert.equal(res.ok, false, `${why}：必须拒绝`);
		assert.equal(res.code, "STRUCTURE_INVALID", `${why}：错误码必须是 STRUCTURE_INVALID`);
		assert.match(res.message, pattern, `${why}：错误信息要点名问题字段，实际 ${res.message}`);
	}

	// HTTP 失败 / 坏 JSON / 结构不对：全部结构化失败，绝不抛出
	const notFound = await loadBuiltInIndex({ fetchImpl: fetchStub({}) });
	assert.equal(notFound.ok, false);
	assert.equal(notFound.code, "IO_FAILED");
	const badJson = await loadBuiltInIndex({ fetchImpl: fetchStub({ "*": "{oops" }) });
	assert.equal(badJson.ok, false);
	assert.equal(badJson.code, "STRUCTURE_INVALID");
	const notIndex = await loadBuiltInIndex({ fetchImpl: fetchStub({ "*": JSON.stringify({ hello: 1 }) }) });
	assert.equal(notIndex.ok, false);
	assert.equal(notIndex.code, "STRUCTURE_INVALID", "缺 modules 对象的 JSON 不是索引");
	const throws = await loadBuiltInIndex({ fetchImpl: fetchStub({ "*": new Error("断网") }) });
	assert.equal(throws.ok, false);
	assert.match(throws.message, /断网/);

	// 安全边界：无论 basePath 传什么，路径都锁死在 modules/module-index.json，没有 ../ 的自由
	const probe = [];
	await loadBuiltInIndex({ basePath: "../somewhere/else/", fetchImpl: fetchStub({}, { capture: probe }) });
	assert.ok(probe[0].endsWith("modules/module-index.json"), `内置索引读取不许变成任意路径读取器，实际 ${probe[0]}`);

	// 无 fetch 的环境：结构化失败
	const noFetch = await loadBuiltInIndex({ fetchImpl: undefined });
	assert.equal(noFetch.ok, false);
}

// ------------------------------------------------------------------ loadModuleIndex：来源路由

const installerStub = ({ index = { schema: 1, modules: {} }, fail = false } = {}) => {
	const calls = [];
	return {
		calls,
		fetchIndex: async (url, opts) => {
			calls.push({ url, opts });
			if (fail) return { ok: false, code: "DOWNLOAD_FAILED", message: "网络不可达" };
			return { ok: true, index, indexUrl: url };
		},
	};
};

{
	// 空配置 ⇒ 走内置：安装器根本不该被碰（空配置不是"完全不可安装"）
	const installer = installerStub();
	const builtinIndex = {
		schema: 1,
		core: { version: "1.5.0", latest: "1.5.0" },
		releaseBase: "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.5.0/",
		modules: {},
	};
	const loaded = await loadModuleIndex({ rawUrl: "", installer, fetchImpl: fetchStub({ "*": JSON.stringify(builtinIndex) }) });
	assert.equal(loaded.ok, true);
	assert.equal(loaded.kind, "builtin", "空 moduleIndexUrl ⇒ sourceKind === builtin");
	assert.deepEqual(loaded.index, builtinIndex);
	assert.equal(installer.calls.length, 0, "内置源不经过外部 HTTP 下载层，不该对 installer 发请求");

	// 非空配置 ⇒ 走远程，fetchOpts 原样透传
	const remoteInstaller = installerStub({ index: { schema: 1, modules: { baby: { latest: "9.9.9" } } } });
	const remote = await loadModuleIndex({
		rawUrl: "https://example.com/module-index.json",
		installer: remoteInstaller,
		fetchOpts: { timeoutMs: 1234, retries: 0 },
	});
	assert.equal(remote.ok, true);
	assert.equal(remote.kind, "remote", "非空 moduleIndexUrl ⇒ sourceKind === remote");
	assert.equal(remote.indexUrl, "https://example.com/module-index.json");
	assert.deepEqual(remoteInstaller.calls, [{ url: "https://example.com/module-index.json", opts: { timeoutMs: 1234, retries: 0 } }]);

	// 远程失败：错误结构原样带回并标注 kind，调用方文案要能分清"哪种源坏了"
	const badRemote = await loadModuleIndex({ rawUrl: "https://example.com/mi.json", installer: installerStub({ fail: true }) });
	assert.equal(badRemote.ok, false);
	assert.equal(badRemote.kind, "remote");
	assert.equal(badRemote.code, "DOWNLOAD_FAILED");

	// 远程 + 安装器缺失：结构化失败，不抛
	const noInstaller = await loadModuleIndex({ rawUrl: "https://example.com/mi.json", installer: null });
	assert.equal(noInstaller.ok, false);
	assert.equal(noInstaller.kind, "remote");

	// 已有自定义地址时，**不能**因为本体内置索引存在就被切回内置（§32/§48）
	const stubborn = await loadModuleIndex({
		rawUrl: "https://mirror.example.com/module-index.json",
		installer: installerStub(),
		fetchImpl: fetchStub({ "*": JSON.stringify({ schema: 1, modules: {} }) }),
	});
	assert.equal(stubborn.ok, true);
	assert.equal(stubborn.kind, "remote", "自定义远程源必须继续生效");
}

{
	// §33 默认源随版本自然更新：moduleIndexUrl 始终为空，本体 1.5.0 → 1.6.0 后
	// 内置索引内容变了，读到的 latest / releaseBase 必须跟着走，不许停留在旧版本。
	const make = (version, latest) =>
		JSON.stringify({
			schema: 1,
			core: { version, latest: version },
			releaseBase: `https://github.com/zziyoo/decadeUi-Stars/releases/download/v${version}/`,
			modules: { decade: { name: "decade", latest, url: `decade-${latest}.zip` } },
		});
	let payload = make("1.5.0", "1.5.0");
	const before = await loadModuleIndex({ rawUrl: "", fetchImpl: () => Promise.resolve({ ok: true, status: 200, text: async () => payload }) });
	assert.equal(before.index.modules.decade.latest, "1.5.0");
	assert.equal(before.indexUrl, "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.5.0/");
	payload = make("1.6.0", "1.6.0"); // 扩展升级后：同一份空配置，新的内置索引
	const after = await loadModuleIndex({ rawUrl: "", fetchImpl: () => Promise.resolve({ ok: true, status: 200, text: async () => payload }) });
	assert.equal(after.index.modules.decade.latest, "1.6.0", "空配置读到的就是当前本体的内置索引");
	assert.equal(after.indexUrl, "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.6.0/");
}

// ------------------------------------------------------------------ 启动更新检查同规则（§35）

const notice = await import("../src/features/updateNoticeWindow.js");
const { checkForUpdates, updateConfigKeys } = notice;

{
	const URL_KEY = updateConfigKeys.index();
	const installed = [{ id: "decade", name: "十周年", type: "style", version: "1.5.0" }];
	const index16 = {
		schema: 1,
		core: { version: "1.6.0", latest: "1.6.0" },
		modules: { decade: { name: "十周年", type: "style", latest: "1.6.0" } },
	};

	// 内置源（空配置）也能查更新：两套规则必须统一
	const api = {
		moduleManager: { list: () => installed },
		packageInstaller: { fetchIndex: async () => { throw new Error("空配置不该走远程"); } },
	};
	const seen = [];
	const result = await checkForUpdates({
		api,
		config: {},
		loadIndex: async input => {
			seen.push(input);
			return { ok: true, kind: "builtin", index: index16, indexUrl: "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.6.0/" };
		},
	});
	assert.ok(result, "内置源有更新时必须能查出来，不许因为'没填地址'而沉默");
	assert.deepEqual(result.updates, [{ id: "decade", name: "十周年", type: "style", current: "1.5.0", latest: "1.6.0" }]);
	assert.equal(result.indexUrl, "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.6.0/");
	assert.equal(seen[0].rawUrl ?? "", "", "空配置（未播种/空串）以空 rawUrl 进入统一加载器");
	assert.equal(seen[0].installer, api.packageInstaller, "installer 只作为远程通道透传，不承载来源状态");

	// 自定义源照旧：rawUrl 原样进入加载器
	await checkForUpdates({
		api,
		config: { [URL_KEY]: "https://mirror.example.com/module-index.json" },
		loadIndex: async input => {
			assert.equal(input.rawUrl, "https://mirror.example.com/module-index.json", "自定义地址必须原样生效，不被内置源覆盖");
			return { ok: false, kind: "remote", code: "DOWNLOAD_FAILED", message: "镜像挂了" };
		},
	}).then(r => assert.equal(r, null, "加载失败静默收场（启动期第一要务）"));

	// 内置源读不到（如开发态未构建）：静默 null，不弹窗、不抛错
	assert.equal(
		await checkForUpdates({ api, config: {}, loadIndex: async () => ({ ok: false, kind: "builtin", code: "IO_FAILED", message: "404" }) }),
		null
	);
}

// ------------------------------------------------------------------ 恢复默认按钮的源码级约束（§31）

{
	// 「恢复默认」的唯一合法动作是 saveConfig(indexKey(), "")。这里对源码静态扫描：
	// 凡对 indexKey() 的 saveConfig，参数只许是输入框现值或空串——出现任何字面量 URL
	// （尤其是带版本号的）都说明有人把默认源写死了，正是本任务要治的病。
	const js = fs.readFileSync(new URL("../src/features/moduleManagerWindow.js", import.meta.url), "utf8");
	const args = [...js.matchAll(/game\.saveConfig\(\s*indexKey\(\)\s*,\s*([^;]+?)\);/g)].map(m => m[1].trim());
	assert.ok(args.length >= 2, `模块源保存点应至少有 2 处（保存并刷新 / 恢复默认），实际 ${args.length}`);
	assert.deepEqual(
		args.filter(arg => arg !== 'sourceInput.value.trim()' && arg !== '""'),
		[],
		`saveConfig(indexKey, …) 只许写输入框现值或空串，实际：${args.join(" | ")}`
	);
	assert.ok(args.includes('""'), "必须存在'恢复默认＝写空串'这一处");
	assert.ok(js.includes('"恢复默认模块源"'), "恢复默认按钮必须存在");
	assert.ok(js.includes('loadModuleIndex'), "模块管理必须经由统一的 loadModuleIndex 取索引");
	assert.ok(!js.includes("installer.fetchIndex"), "窗口不得绕过 loadModuleIndex 直连 installer.fetchIndex（来源判定只此一处）");
}

console.log("P19 module-source tests: all passed ✓");
