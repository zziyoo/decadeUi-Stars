/**
 * P11 自动更新 · 版本比较纯逻辑测试（任务书§48）。
 *
 * 只测"读了本地与远程版本之后得出什么结论"，不碰网络、文件与配置——所以这里能覆盖
 * 各种"本机更新/本地版本未知/索引缺模块/忽略清单"的边角，而真机只需验提示与跳转。
 */
import assert from "node:assert/strict";

const mod = await import("../src/core/updateChecker.js");
const { checkUpdates, normalizeIgnored, ignoreVersion, ignoreAll, isVersionLike } = mod;

const index = modules => ({ schema: 1, core: { version: "1.4.2", latest: "1.4.2" }, modules });
const entry = (id, latest, extra = {}) => [id, { name: id, type: "style", latest, url: `${id}-${latest}.zip`, sha256: "0".repeat(64), size: 1, dependencies: [], core: ">=1.4.2", capabilities: [], ...extra }];

// 1) 常规：本机旧、索引新 ⇒ 报一条更新，字段齐
{
	const result = checkUpdates({
		installed: [{ id: "decade", name: "十周年", type: "style", version: "1.4.2" }],
		index: index(Object.fromEntries([entry("decade", "1.5.0")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates, [{ id: "decade", name: "十周年", type: "style", current: "1.4.2", latest: "1.5.0" }]);
	assert.equal(result.core.behind, false);
}

// 2) 本机比索引新（玩家装过更新的包）⇒ 绝不提示降级
{
	const result = checkUpdates({
		installed: [{ id: "decade", version: "1.6.0" }],
		index: index(Object.fromEntries([entry("decade", "1.5.0")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates, [], "索引比本机旧时不许提示更新");
}

// 3) 同版本 ⇒ 无更新
{
	const result = checkUpdates({
		installed: [{ id: "decade", version: "1.4.2" }],
		index: index(Object.fromEntries([entry("decade", "1.4.2")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates, []);
}

// 4) 索引有、本机没装的 ⇒ 那是"可安装"，不是"可更新"
{
	const result = checkUpdates({
		installed: [{ id: "decade", version: "1.4.2" }],
		index: index(Object.fromEntries([entry("decade", "1.5.0"), entry("online", "9.9.9")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates.map(item => item.id), ["decade"], "未安装的模块不该出现在更新列表里");
}

// 5) 本地版本未知（null/空/非法）⇒ 跳过，不许瞎报
{
	const result = checkUpdates({
		installed: [
			{ id: "a", version: null },
			{ id: "b", version: "" },
			{ id: "c", version: "unknown" },
			{ id: "d", version: "1.4.2" },
		],
		index: index(Object.fromEntries([entry("a", "2.0.0"), entry("b", "2.0.0"), entry("c", "2.0.0"), entry("d", "2.0.0")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates.map(item => item.id), ["d"], "本地版本读不出来时只能沉默，不能猜");
	assert.equal(isVersionLike("1.4.2"), true);
	assert.equal(isVersionLike("1.4.2-beta.1"), true);
	assert.equal(isVersionLike("unknown"), false);
	assert.equal(isVersionLike(""), false);
	assert.equal(isVersionLike(null), false);
}

// 6) 索引里的 latest 非法 ⇒ 不报（避免把垃圾数据变成一次白下载）
{
	const result = checkUpdates({
		installed: [{ id: "a", version: "1.4.2" }],
		index: index(Object.fromEntries([entry("a", "abc"), entry("b", "")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates, []);
}

// 7) Core 落后：只看索引 core.latest 与本机扩展版本；索引没有 core 就当没这回事
{
	const behind = checkUpdates({ installed: [], index: index({}), coreVersion: "1.4.2", });
	assert.deepEqual(behind.core, { behind: false, current: "1.4.2", latest: "1.4.2" });

	const newer = checkUpdates({
		installed: [],
		index: { schema: 1, core: { version: "1.5.0", latest: "1.5.0" }, modules: {} },
		coreVersion: "1.4.2",
	});
	assert.deepEqual(newer.core, { behind: true, current: "1.4.2", latest: "1.5.0" });

	const noCore = checkUpdates({ installed: [], index: { schema: 1, modules: {} }, coreVersion: "1.4.2" });
	assert.deepEqual(noCore.core, { behind: false, current: "1.4.2", latest: "1.4.2" });
}

// 8) 忽略清单：只忽略"已被忽略的那个版本"，且不影响其它模块
{
	const args = {
		installed: [{ id: "decade", version: "1.4.2" }, { id: "online", version: "1.4.2" }],
		index: index(Object.fromEntries([entry("decade", "1.5.0"), entry("online", "1.5.0")])),
		coreVersion: "1.4.2",
	};
	const withIgnore = checkUpdates({ ...args, ignored: { decade: "1.5.0" } });
	assert.deepEqual(withIgnore.updates.map(item => item.id), ["online"], "被忽略的那条不再出现");
	assert.deepEqual(withIgnore.ignoredUpdates.map(item => item.id), ["decade"], "但要从结果里能看出它被忽略过");

	const staleIgnore = checkUpdates({ ...args, ignored: { decade: "1.4.9" } });
	assert.deepEqual(staleIgnore.updates.map(item => item.id), ["decade", "online"], "忽略的是旧版本号时不该生效");
}

// 9) 输出稳定排序（界面列表与测试都要可预期）
{
	const result = checkUpdates({
		installed: [{ id: "z", version: "1.0.0" }, { id: "a", version: "1.0.0" }, { id: "m", version: "1.0.0" }],
		index: index(Object.fromEntries([entry("z", "2.0.0"), entry("a", "2.0.0"), entry("m", "2.0.0")])),
		coreVersion: "1.4.2",
	});
	assert.deepEqual(result.updates.map(item => item.id), ["a", "m", "z"]);
}

// 10) 空输入不抛错（启动期第一要务是别把游戏弄崩）
{
	for (const input of [{}, { installed: [] }, { installed: [], index: null }, { installed: null, index: null, coreVersion: null }]) {
		const result = checkUpdates(input);
		assert.deepEqual(result.updates, []);
		assert.equal(result.core.behind, false);
	}
}

// 11) 忽略清单的读写靠纯函数（配置读写由调用方注入，便于测与替换）
{
	assert.deepEqual(normalizeIgnored(null), {});
	assert.deepEqual(normalizeIgnored(""), {});
	assert.deepEqual(normalizeIgnored('{"decade":"1.5.0"}'), { decade: "1.5.0" });
	assert.deepEqual(normalizeIgnored("垃圾"), {}, "坏数据当空处理，不抛");
	assert.equal(ignoreVersion({ decade: "1.4.9" }, "decade", "1.5.0"), '{"decade":"1.5.0"}', "记住最新被忽略的版本");
	assert.equal(ignoreVersion({ online: "1.5.0" }, "decade", "1.5.0"), '{"online":"1.5.0","decade":"1.5.0"}', "合并不丢别人");
}

// 12) Core 也能被"忽略此版本"：忽略的是同一个 latest 才生效
{
	const args = { installed: [], index: { schema: 1, core: { version: "1.5.0", latest: "1.5.0" }, modules: {} }, coreVersion: "1.4.2" };
	assert.equal(checkUpdates(args).core.behind, true);
	const ignored = checkUpdates({ ...args, ignored: { core: "1.5.0" } });
	assert.equal(ignored.core.behind, false, "忽略此版本后 Core 不该继续提示");
	assert.equal(ignored.core.latest, "1.5.0", "但仍要能看出索引里的版本（下次版本变了还要提）");
	assert.equal(checkUpdates({ ...args, ignored: { core: "1.4.9" } }).core.behind, true, "忽略的是旧版本号时不生效");
}

// 13) 批量忽略（提示窗上"忽略此版本"按钮的纯逻辑）：把当前展示的全部更新一次性记住
{
	assert.equal(
		ignoreAll("", { updates: [{ id: "a", latest: "2.0.0" }], core: { behind: true, latest: "1.5.0" } }),
		'{"a":"2.0.0","core":"1.5.0"}',
		"显示的每一项都要记住，含 Core"
	);
	assert.equal(
		ignoreAll('{"z":"9.9.9"}', { updates: [{ id: "a", latest: "2.0.0" }], core: { behind: false, latest: "1.4.2" } }),
		'{"z":"9.9.9","a":"2.0.0"}',
		"Core 没落后就不记 core；已有的忽略记录不丢"
	);
	assert.equal(ignoreAll("垃圾", { updates: [], core: {} }), "{}", "坏数据当空处理，不抛");
}

// -------------------------------------------------- 启动检查的接线（静默失败是硬要求）

const notice = await import("../src/features/updateNoticeWindow.js");
const { checkForUpdates, shouldAutoCheck, updateConfigKeys, waitForWelcome } = notice;

const URL_KEY = updateConfigKeys.index();
const AUTO_KEY = updateConfigKeys.auto();
const IGNORED_KEY = updateConfigKeys.ignored();

const fakeApi = ({ index = null, fail = false, throwError = false, modules = [] } = {}) => {
	const calls = { fetchIndex: 0 };
	return {
		calls,
		api: {
			moduleManager: { list: () => modules },
			packageInstaller: {
				fetchIndex: async () => {
					calls.fetchIndex++;
					if (throwError) throw new Error("网络炸了");
					return fail ? { ok: false, code: "DOWNLOAD_FAILED" } : { ok: true, index, indexUrl: "https://x/index.json" };
				},
			},
		},
	};
};

{
	assert.equal(shouldAutoCheck({}), true, "默认检查（配置体系会把 init:true 播种进来）");
	assert.equal(shouldAutoCheck({ [AUTO_KEY]: false }), false, "玩家明确关掉就不查");
	assert.equal(shouldAutoCheck({ [AUTO_KEY]: true }), true);
}

{
	// 未配置模块源：连请求都不该发
	const { api, calls } = fakeApi({ index: { schema: 1, modules: {} } });
	const result = await checkForUpdates({ api, config: {} });
	assert.equal(result, null);
	assert.equal(calls.fetchIndex, 0, "没填地址时不该发请求");
}

{
	// 索引拉不到（离线/CORS/404）：静默 null，不抛错
	const { api } = fakeApi({ fail: true });
	assert.equal(await checkForUpdates({ api, config: { [URL_KEY]: "https://x/index.json" } }), null);
	const thrown = fakeApi({ throwError: true });
	assert.equal(await checkForUpdates({ api: thrown.api, config: { [URL_KEY]: "https://x/index.json" } }), null, "连抛错都要吞掉（启动期不许把游戏弄崩）");
}

{
	// 有更新：返回可展示的数据 + 索引地址（界面用它跳模块管理）
	const { api } = fakeApi({
		modules: [{ id: "decade", name: "十周年", type: "style", version: "1.4.2" }],
		index: { schema: 1, core: { latest: "1.4.2" }, modules: { decade: { name: "十周年", type: "style", latest: "1.5.0" } } },
	});
	const result = await checkForUpdates({ api, config: { [URL_KEY]: "https://x/index.json" } });
	assert.deepEqual(result.updates, [{ id: "decade", name: "十周年", type: "style", current: "1.4.2", latest: "1.5.0" }]);
	assert.equal(result.indexUrl, "https://x/index.json");
}

{
	// 全被忽略 ⇒ 返回 null（界面根本不弹）
	const { api } = fakeApi({
		modules: [{ id: "decade", name: "十周年", type: "style", version: "1.4.2" }],
		index: { schema: 1, core: { latest: "1.4.2" }, modules: { decade: { name: "十周年", type: "style", latest: "1.5.0" } } },
	});
	const result = await checkForUpdates({ api, config: { [URL_KEY]: "https://x/index.json", [IGNORED_KEY]: '{"decade":"1.5.0"}' } });
	assert.equal(result, null, "忽略过这一版就不再打扰");
}

{
	// 无更新 ⇒ null（不弹空窗）
	const { api } = fakeApi({
		modules: [{ id: "decade", name: "十周年", type: "style", version: "1.5.0" }],
		index: { schema: 1, core: { latest: "1.4.2" }, modules: { decade: { name: "十周年", type: "style", latest: "1.5.0" } } },
	});
	assert.equal(await checkForUpdates({ api, config: { [URL_KEY]: "https://x/index.json" } }), null);
}

// -------------------------------------------------- 与欢迎窗口抢窗（真机上真撞过）

{
	// 欢迎窗在 ⇒ 等它关掉再弹；一直不关（超过上限）就这次不弹，绝不叠两个弹窗
	let open = true;
	let calls = 0;
	const gone = await waitForWelcome({ hasWelcome: () => (calls++, open), intervalMs: 1, maxTries: 5 });
	assert.equal(gone, false, "欢迎窗一直开着就放弃这次提示（下次启动还会查）");
	assert.equal(calls, 5, `最多检查 maxTries 次，实际 ${calls}`);

	open = false;
	const closed = await waitForWelcome({ hasWelcome: () => (++calls, open), intervalMs: 1, maxTries: 5 });
	assert.equal(closed, true, "欢迎窗已关闭就该放行");

	let seen = 0;
	const laterClosed = await waitForWelcome({
		hasWelcome: () => { seen++; return seen < 3; },
		intervalMs: 1,
		maxTries: 10,
	});
	assert.equal(laterClosed, true, "欢迎窗中途关掉也要能等到");
}

// -------------------------------------------------- 本体 div{position:absolute} 漏网检查
// 真机踩过：只给一部分类写了 position，漏掉的那几个 div 被本体全局规则带走、全部叠在
// 对话框左上角（截图里"扩展本体…"与"欢乐三国杀样式…"叠印在一起）。这条测试直接对着
// 源码扫：**JS 里用到的每个 decade-update-* 类，CSS 里都必须有一处显式 position**。

{
	const fs = await import("node:fs");
	const css = fs.readFileSync(new URL("../src/features/updateNotice.css", import.meta.url), "utf8");
	const jsSource = fs.readFileSync(new URL("../src/features/updateNoticeWindow.js", import.meta.url), "utf8");

	const used = new Set();
	// 只扫 el("类名", …) 的第一参数：<link> 的 id（decade-update-styles）不是类名，别混进来
	for (const match of jsSource.matchAll(/\bel\(\s*"([^"]*decade-update-[^"]*)"/g)) {
		for (const cls of match[1].split(/\s+/)) if (cls.startsWith("decade-update-")) used.add(cls);
	}
	assert.ok(used.size >= 8, `至少要扫到 8 个类名，实际 ${used.size}`);

	const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({ selector, body }));
	const hasExplicitPosition = cls =>
		blocks.some(block => {
			const hit = block.selector.split(",").some(part => part.trim().split(/\s+/).includes(`.${cls}`));
			return hit && /position\s*:/.test(block.body);
		});

	const missing = [...used].filter(cls => !hasExplicitPosition(cls));
	assert.deepEqual(missing, [], `这些类没有显式 position，会被本体 div{position:absolute} 带走：${missing.join("、")}`);
}

console.log("P11 update-check tests: all passed ✓");
