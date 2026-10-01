/**
 * P18 · 损坏包 → 应用内「修复」入口（D4 端到端接线）
 *
 * 为什么这条必须存在：手机上**没有第二条恢复通道**。
 *   - 扩展装在 app 私有目录，QQ/系统文件管理器看到的 extension 目录是空的（2026-10-01 真机），
 *     所以"手工删 installed.json 再重装"这种恢复方式在 Android 上根本不成立；
 *   - 包坏了 ⇒ 启动注册失败 ⇒ 注册表 `independent:false` ⇒ 卸载被 `NOT_INDEPENDENT` 拒绝；
 *   - 台账仍写"已安装" ⇒ 界面上连「安装」都不出现。
 * `verifyInstalled` 一直能给出 `action:{kind:"restore"|"reinstall"}`，缺的是把它变成按钮。
 *
 * 窗口层带 DOM，本仓没有 DOM 夹具，所以第 3 节按既有做法（p15-overlay-css-invariants）
 * 对源码做静态接线断言；第 1、2 节是真集成：假 io + 真安装器 + 真行模型。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { createPackageInstaller } = await import("../src/core/packageInstaller.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { buildRows } = await import("../src/core/moduleAdmin.js");

const norm = rel => String(rel).replace(/^\/+/, "");

/** 只读够用的假文件系统：verifyInstalled 只探测、不写盘 */
function makeIo(initial = {}) {
	const store = new Map(Object.entries(initial).map(([key, value]) => [norm(key), String(value)]));
	return {
		capabilities: { atomicRename: true, desktop: true },
		store,
		kind: async rel => {
			const key = norm(rel);
			if (store.has(key)) return "file";
			for (const existing of store.keys()) if (existing.startsWith(`${key}/`)) return "dir";
			return null;
		},
		readText: async rel => (store.has(norm(rel)) ? store.get(norm(rel)) : null),
		readBinary: async rel => (store.has(norm(rel)) ? new TextEncoder().encode(store.get(norm(rel))).buffer : null),
		writeText: async () => {
			throw new Error("健康检查不该写盘");
		},
		listDir: async rel => {
			const prefix = `${norm(rel)}/`;
			const names = [...new Set([...store.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length).split("/")[0]))];
			return { dirs: names, files: [] };
		},
	};
}

const ledgerOf = modules => JSON.stringify({ schema: 1, modules });
const healthyManifest = (id, version) =>
	JSON.stringify({ schema: 1, id, name: `${id}样式`, version, type: "style", core: ">=1.5.0", entry: { js: [`ui/${id}.js`], css: ["player.css"] } });
/** 真机上那份坏清单的形状：被 JSON 化的小端数组（解析得过，但没有 id/version/entry） */
const corruptedManifest = JSON.stringify(Object.fromEntries([...'{"schema":1,"id":"decade"}'].entries().map(([i, ch]) => [i, ch.charCodeAt(0)])));

const pack = (id, version) => ({
	[`modules/${id}/${version}/manifest.json`]: healthyManifest(id, version),
	[`modules/${id}/${version}/player.css`]: "body{}",
	[`modules/${id}/${version}/ui/${id}.js`]: "export default {};",
});

const modules = [
	{ id: "core", name: "核心", type: "core", version: "1.5.0", dependencies: [] },
	{ id: "decade", name: "十周年样式", type: "style", version: "1.5.0", dependencies: ["core"] },
	{ id: "yjcm", name: "一将成名样式", type: "style", version: "1.5.0", dependencies: ["core"] },
];
const index = {
	schema: 1,
	modules: {
		decade: { latest: "1.5.0", url: "https://test/decade-1.5.0.zip", sha256: "d".repeat(64), size: 2048, core: ">=1.5.0" },
		yjcm: { latest: "1.5.0", url: "https://test/yjcm-1.5.0.zip", core: ">=1.5.0" },
	},
};

const makeInstaller = io => {
	const registry = createModuleRegistry();
	return createPackageInstaller({
		registry,
		moduleManager: createModuleManager({ registry }),
		io,
		extractZip: async () => [],
		download: async () => ({ buffer: new Uint8Array([1]).buffer, bytes: 1, attempts: 1 }),
	});
};

/** 把窗口的做法原样搬过来：台账 id → verifyInstalled → 喂 buildRows */
async function healthOf(installer, ids) {
	const out = {};
	for (const id of ids) {
		const verified = await installer.verifyInstalled(id);
		if (verified?.ok) out[id] = { status: verified.status, reasons: verified.reasons, action: verified.action };
	}
	return out;
}

// ---------------------------------------------------------------- 1. 真机形状：坏清单 → 可点的重装

{
	const io = makeIo({
		"modules/installed.json": ledgerOf({ decade: { version: "1.5.0" }, yjcm: { version: "1.5.0" } }),
		"modules/decade/1.5.0/manifest.json": corruptedManifest,
		...pack("decade", "1.5.0"),
		...pack("yjcm", "1.5.0"),
	});
	// 清单被覆盖成坏内容（入口文件还在——这正是 D3 之前看不出来的原因）
	io.store.set("modules/decade/1.5.0/manifest.json", corruptedManifest);
	const installer = makeInstaller(io);

	const health = await healthOf(installer, ["decade", "yjcm"]);
	assert.equal(health.decade.status, "corrupt", `被 JSON 化的清单必须判损坏：${JSON.stringify(health.decade)}`);
	assert.equal(health.decade.action.kind, "reinstall", "台账没记上一版 ⇒ 只能重装");
	assert.equal(health.yjcm.status, "ok", "健康包不受影响");

	const result = buildRows({ installed: { decade: { version: "1.5.0" }, yjcm: { version: "1.5.0" } }, index, modules, coreVersion: "1.5.0", health });
	const row = result.rows.find(item => item.id === "decade");
	const repair = row.actions.find(action => action.kind === "repair");
	assert.equal(row.statusKind, "corrupt");
	assert.equal(repair.enabled, true, `玩家必须能点：${repair.reason}`);
	assert.equal(repair.repairKind, "reinstall");
	assert.equal(repair.spec.id, "decade");
	assert.equal(repair.spec.url, "https://test/decade-1.5.0.zip");
	assert.equal(repair.spec.expectedVersion, "1.5.0");
	assert.equal(repair.spec.expectedSha256, "d".repeat(64));
	assert.equal(
		row.actions.find(action => action.kind === "uninstall").enabled,
		false,
		"损坏行的卸载必然被注册表守卫拒绝，不该点亮"
	);
	assert.equal(result.summary.corrupt, 1);
	assert.equal(result.rows.find(item => item.id === "yjcm").actions.some(action => action.kind === "repair"), false);
}

// ---------------------------------------------------------------- 2. 有健康的上一版：离线也能回退

{
	const io = makeIo({
		"modules/installed.json": ledgerOf({ decade: { version: "1.5.0", previousVersion: "1.4.2" } }),
		"modules/decade/1.5.0/manifest.json": corruptedManifest,
		...pack("decade", "1.4.2"),
	});
	const installer = makeInstaller(io);
	const health = await healthOf(installer, ["decade"]);
	assert.equal(health.decade.action.kind, "restore", `上一版健康就该优先本地回退，不下载：${JSON.stringify(health.decade.action)}`);
	assert.equal(health.decade.action.version, "1.4.2");

	const result = buildRows({ installed: { decade: { version: "1.5.0", previousVersion: "1.4.2" } }, index: null, modules, coreVersion: "1.5.0", health });
	const repair = result.rows.find(item => item.id === "decade").actions.find(action => action.kind === "repair");
	assert.equal(repair.enabled, true, "没配模块源也要能修——这是为断网的手机留的路");
	assert.equal(repair.repairKind, "restore");
	assert.equal(repair.version, "1.4.2");
}

// ---------------------------------------------------------------- 3. 静态接线：窗口真的把 health 用起来了

{
	const src = readFileSync(fileURLToPath(new URL("../src/features/moduleManagerWindow.js", import.meta.url)), "utf8");
	assert.match(src, /const health = await collectHealth\(installer, Object.keys\(ledger\)\);/, "台账里的每个包都要过一遍健康检查");
	assert.match(src, /installBlocker,\n\t\thealth,\n\t\}\);/, "health 必须真的进 buildRows（少了这一句整套入口都是死的）");
	assert.match(src, /action\.kind === "repair"/, "点击分发要认 repair 这个动作");
	assert.match(src, /await installer\.rollback\(row\.id/, "restore 走 rollback");
	assert.match(src, /action\.repairKind === "restore"/, "两种修法按 verifyInstalled 的计划分流");
	assert.match(src, /installer\.install\(action\.spec, \{\s*force: true/, "reinstall 走 install(force)——同版本覆盖必须有 force，否则被 ALREADY_INSTALLED 挡住");
	assert.match(src, /statusKind === "corrupt"\) return "is-error"/, "损坏徽标要用错误色，别和「未安装」混在一起");
	assert.match(src, /summary\.corrupt/, "汇总行要点出待修复数量");
}

{
	const src = readFileSync(fileURLToPath(new URL("../src/core/moduleSystem.js", import.meta.url)), "utf8");
	assert.match(
		src,
		/reinstall[\s\S]{0,400}?模块管理/,
		"启动提示要说清去哪儿修——手机上他看不到这一句就还是死锁"
	);
}

// ---------------------------------------------------------------- 4. 入口可达性：本体扩展设置页里要有「打开模块管理界面」
//
// 手机上没有键盘（Ctrl+Shift+C 按不出来），而模块管理是损坏包唯一的应用内自愈通道 ——
// 入口不能只藏在配置窗口里面。做法与原版一致：`clear:true` 的按钮项交给本体 addOptions 渲染。
{
	const { config } = await import("../src/config/index.js");
	const entry = config.moduleManagerWindow;
	assert.ok(entry, "本体扩展设置页里必须有打开模块管理的按钮项");
	assert.equal(entry.clear, true, "按钮项不该往 lib.config 里写值");
	assert.match(entry.name, /模块管理/);
	const keys = Object.keys(config);
	assert.equal(keys.indexOf("moduleManagerWindow"), keys.indexOf("newConfigWindow") + 1, "紧跟「打开新版菜单」，两个窗口在同一处");

	const src = readFileSync(fileURLToPath(new URL("../src/config/definitions/appearance.js", import.meta.url)), "utf8");
	assert.match(src, /window\.decadeUI\?\.showModuleManager/, "点击要走 decadeUI.showModuleManager（与配置窗口里那行同一个入口，不另起一套）");
}

console.log("p18-repair-wiring: OK（损坏→修复入口的端到端与接线都在）");
