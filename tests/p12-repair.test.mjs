/**
 * P12 回滚 · 模块健康判据与修复计划（任务书§49）。
 *
 * 判据是**结构级四项**（用户决定，2026-09-28）：包目录缺失 / manifest.json 缺失或解析失败 /
 * manifest 的 id 或 version 与台账不符 / 清单声明的 entry.js、entry.css 文件不存在。
 * 关键是"IO 错误不算损坏"——一次读盘抖动不能把一个好包判死（沿用 P5 的"IO 异常 ≠ 不存在"）。
 * 这里全是纯函数：探测结果由调用方（安装器，走真实文件系统）喂进来，所以边角能在 Node 里测全。
 */
import assert from "node:assert/strict";

const { assessModule, planRepair } = await import("../src/core/moduleHealth.js");

const probe = (overrides = {}) => ({
	dirExists: true,
	manifestExists: true,
	manifestParsed: true,
	manifest: { id: "baby", version: "1.4.2", entry: { js: [], css: [] } },
	missingEntries: [],
	...overrides,
});

// ---------------------------------------------------------------- 判据：健康

{
	const result = assessModule({ id: "baby", version: "1.4.2", ...probe() });
	assert.deepEqual(result, { ok: true, reasons: [] });
}

// ---------------------------------------------------------------- 判据：四类损坏各一条

{
	const missingDir = assessModule({ id: "baby", version: "1.4.2", ...probe({ dirExists: false }) });
	assert.equal(missingDir.ok, false);
	assert.match(missingDir.reasons.join("；"), /包目录不存在/);
}
{
	const missingManifest = assessModule({ id: "baby", version: "1.4.2", ...probe({ manifestExists: false }) });
	assert.equal(missingManifest.ok, false);
	assert.match(missingManifest.reasons.join("；"), /manifest\.json 缺失/);
}
{
	const badJson = assessModule({ id: "baby", version: "1.4.2", ...probe({ manifestParsed: false, manifest: null }) });
	assert.equal(badJson.ok, false);
	assert.match(badJson.reasons.join("；"), /解析失败/);
}
{
	const mismatched = assessModule({
		id: "baby",
		version: "1.4.2",
		...probe({ manifest: { id: "baby", version: "1.4.3", entry: {} } }),
	});
	assert.equal(mismatched.ok, false);
	assert.match(mismatched.reasons.join("；"), /manifest\.version=1\.4\.3 与台账 1\.4\.2 不符/);

	const wrongId = assessModule({ id: "baby", version: "1.4.2", ...probe({ manifest: { id: "online", version: "1.4.2" } }) });
	assert.equal(wrongId.ok, false);
	assert.match(wrongId.reasons.join("；"), /manifest\.id=online/);
}
{
	const missingEntry = assessModule({ id: "baby", version: "1.4.2", ...probe({ missingEntries: ["ui/baby.js", "player.css"] }) });
	assert.equal(missingEntry.ok, false);
	assert.match(missingEntry.reasons.join("；"), /入口文件缺失：ui\/baby\.js、player\.css/);
}

// ---------------------------------------------------------------- 修复计划

{
	// 一切正常 ⇒ 什么都不做
	const plan = planRepair({ id: "baby", version: "1.4.2", previousVersion: "1.4.1", probe: probe(), previousProbe: probe({ manifest: { id: "baby", version: "1.4.1" } }) });
	assert.deepEqual(plan, { status: "ok", reasons: [], action: null });
}

{
	// 当前损坏 + 上一版健康 ⇒ 回退
	const plan = planRepair({
		id: "baby",
		version: "1.4.3",
		previousVersion: "1.4.2",
		probe: probe({ manifestExists: false }),
		previousProbe: probe({ manifest: { id: "baby", version: "1.4.2" } }),
	});
	assert.equal(plan.status, "corrupt");
	assert.deepEqual(plan.action, { kind: "restore", version: "1.4.2" });
	assert.match(plan.reasons.join("；"), /manifest\.json 缺失/);
}

{
	// 当前损坏 + 上一版目录本身也坏 ⇒ 只能重装（不许把坏版本换上来）
	const plan = planRepair({
		id: "baby",
		version: "1.4.3",
		previousVersion: "1.4.2",
		probe: probe({ manifestExists: false }),
		previousProbe: probe({ dirExists: false }),
	});
	assert.equal(plan.status, "corrupt");
	assert.deepEqual(plan.action, { kind: "reinstall" });
	assert.match(plan.reasons.join("；"), /上一版 1\.4\.2 也不可用/);
}

{
	// 台账没记上一版 ⇒ 重装
	const plan = planRepair({ id: "baby", version: "1.4.3", previousVersion: null, probe: probe({ dirExists: false }) });
	assert.deepEqual(plan.action, { kind: "reinstall" });
	assert.match(plan.reasons.join("；"), /没有记录上一版本/);
}

{
	// 台账记了上一版、盘上也真没有 ⇒ 重装（探测结果说 dirExists:false）
	const plan = planRepair({ id: "baby", version: "1.4.3", previousVersion: "1.4.2", probe: probe({ dirExists: false }), previousProbe: { dirExists: false } });
	assert.deepEqual(plan.action, { kind: "reinstall" });
}

{
	// 回退目标不能"看起来有目录但内容不符"：id/version 不匹配也算不可用
	const plan = planRepair({
		id: "baby",
		version: "1.4.3",
		previousVersion: "1.4.2",
		probe: probe({ dirExists: false }),
		previousProbe: probe({ manifest: { id: "baby", version: "9.9.9" } }),
	});
	assert.deepEqual(plan.action, { kind: "reinstall" }, "上一版清单版本对不上，不能换上来");
}

// ---------------------------------------------------------------- 安装器：探测与回退事务

const { createPackageInstaller, INSTALL_CODES } = await import("../src/core/packageInstaller.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");

const norm = rel => String(rel).replace(/^\/+/, "");

/** 够用的假文件系统：docs 里只需要"文件树 + 改名"两件事 */
function makeIo(initial = {}) {
	const store = new Map(Object.entries(initial).map(([k, v]) => [norm(k), String(v)]));
	const moves = [];
	const io = {
		capabilities: { atomicRename: true, desktop: true },
		failOnce: new Set(),
		/** 注入"改名失败"用：原子写台账是 temp → rename，只在 writeText 上注入打不中 */
		failMoves: new Set(),
		store,
		moves,
		kind: async rel => {
			const key = norm(rel);
			if (store.has(key)) return "file";
			for (const existing of store.keys()) if (existing.startsWith(`${key}/`)) return "dir";
			return null;
		},
		readText: async rel => (store.has(norm(rel)) ? store.get(norm(rel)) : null),
		writeText: async (rel, text) => {
			if (io.failOnce.has(`writeText:${norm(rel)}`)) {
				io.failOnce.delete(`writeText:${norm(rel)}`);
				throw new Error("注入的写失败");
			}
			store.set(norm(rel), String(text));
		},
		writeBinary: async () => {},
		readBinary: async () => new Uint8Array([1]).buffer,
		removeFile: async rel => { store.delete(norm(rel)); },
		removeTree: async rel => {
			const key = norm(rel);
			for (const existing of [...store.keys()]) if (existing === key || existing.startsWith(`${key}/`)) store.delete(existing);
		},
		createDir: async () => {},
		movePath: async (from, to) => {
			const f = norm(from);
			const t = norm(to);
			if (io.failMoves.has(`movePath:${t}`)) {
				io.failMoves.delete(`movePath:${t}`);
				throw new Error("注入的改名失败");
			}
			moves.push([f, t]);
			for (const key of [...store.keys()]) {
				if (key === f || key.startsWith(`${f}/`)) {
					store.set(t + key.slice(f.length), store.get(key));
					store.delete(key);
				}
			}
		},
		listDir: async rel => {
			const prefix = `${norm(rel)}/`;
			const names = [...new Set([...store.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length).split("/")[0]))];
			return { dirs: names, files: [] };
		},
	};
	return io;
}

const ledgerOf = modules => `${JSON.stringify({ schema: 1, modules }, null, "\t")}\n`;
const HEALTHY_MANIFEST = version => JSON.stringify({ schema: 1, id: "baby", name: "欢乐三国杀样式", version, type: "style", core: ">=1.4.2", entry: { js: ["ui/baby.js"], css: ["player.css"] } });
const packFiles = version => ({
	[`modules/baby/${version}/manifest.json`]: HEALTHY_MANIFEST(version),
	[`modules/baby/${version}/player.css`]: "body{}",
	[`modules/baby/${version}/ui/baby.js`]: "export default {};",
});

function makeInstaller(io) {
	const registry = createModuleRegistry();
	return createPackageInstaller({
		registry,
		moduleManager: createModuleManager({ registry }),
		io,
		extractZip: async () => [],
		download: async () => ({ buffer: new Uint8Array([1]).buffer, bytes: 1, attempts: 1 }),
	});
}

{
	// 健康：探测说 ok，什么都不动
	const io = makeIo({ "modules/installed.json": ledgerOf({ baby: { version: "1.4.2" } }), ...packFiles("1.4.2") });
	const installer = makeInstaller(io);
	const result = await installer.verifyInstalled("baby");
	assert.equal(result.ok, true);
	assert.equal(result.status, "ok");
	assert.equal(result.action, null);
	assert.deepEqual(io.moves, [], "健康时不许动任何文件");
}

{
	// 损坏 + 上一版健康 ⇒ 计划回退
	const io = makeIo({ "modules/installed.json": ledgerOf({ baby: { version: "1.4.3", previousVersion: "1.4.2" } }), ...packFiles("1.4.2") });
	const installer = makeInstaller(io);
	const result = await installer.verifyInstalled("baby");
	assert.equal(result.status, "corrupt");
	assert.deepEqual(result.action, { kind: "restore", version: "1.4.2" });
	assert.match(result.reasons.join("；"), /包目录不存在/);
}

{
	// 回退：坏目录改名 .corrupt-*、台账指回上一版、坏版本不再记作 previousVersion
	const io = makeIo({
		"modules/installed.json": ledgerOf({ baby: { version: "1.4.3", previousVersion: "1.4.2", installedAt: 1 } }),
		...packFiles("1.4.2"),
		"modules/baby/1.4.3/player.css": "body{}",   // 目录在、manifest 丢
	});
	const installer = makeInstaller(io);
	const result = await installer.rollback("baby");
	assert.equal(result.ok, true, `回退应成功，实际 ${result.code} ${result.message ?? ""}`);
	assert.equal(result.version, "1.4.2");
	assert.equal(result.requiresReload, true);
	assert.match(result.parked, /^modules\/baby\/\.corrupt-1\.4\.3-/, "坏目录要改名留证");
	assert.equal(io.store.has("modules/baby/1.4.3/player.css"), false, "坏目录不该留在原位");
	assert.ok(io.store.has(`${result.parked}/player.css`), "坏目录内容整体搬走");

	const ledger = JSON.parse(io.store.get("modules/installed.json"));
	assert.equal(ledger.modules.baby.version, "1.4.2");
	assert.equal(ledger.modules.baby.previousVersion, undefined, "坏版本不当成可回退的上一版");
}

{
	// 回退目标不健康（清单版本对不上）⇒ 拒绝，且不动文件
	const io = makeIo({
		"modules/installed.json": ledgerOf({ baby: { version: "1.4.3", previousVersion: "1.4.2" } }),
		...packFiles("1.4.2"),
		"modules/baby/1.4.2/manifest.json": HEALTHY_MANIFEST("9.9.9"),
	});
	const installer = makeInstaller(io);
	const result = await installer.rollback("baby");
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.NO_ROLLBACK);
	assert.match(result.message, /9\.9\.9/, "要说清为什么不能用这一版");
	assert.deepEqual(io.moves, [], "目标不可用就不许动任何目录");
}

{
	// 台账没记上一版 ⇒ NO_ROLLBACK
	const io = makeIo({ "modules/installed.json": ledgerOf({ baby: { version: "1.4.3" } }) });
	const installer = makeInstaller(io);
	const result = await installer.rollback("baby");
	assert.equal(result.code, INSTALL_CODES.NO_ROLLBACK);
}

{
	// 未安装的模块 ⇒ NOT_INSTALLED
	const io = makeIo({ "modules/installed.json": ledgerOf({}) });
	const installer = makeInstaller(io);
	assert.equal((await installer.rollback("baby")).code, INSTALL_CODES.NOT_INSTALLED);
}

{
	// 台账写失败 ⇒ ROLLBACK_FAILED，且坏目录必须改回原位（不留残骸、不假成功）
	const io = makeIo({
		"modules/installed.json": ledgerOf({ baby: { version: "1.4.3", previousVersion: "1.4.2" } }),
		...packFiles("1.4.2"),
		"modules/baby/1.4.3/player.css": "body{}",
	});
	io.failMoves.add("movePath:modules/installed.json");   // 台账提交那一下失败
	const installer = makeInstaller(io);
	const result = await installer.rollback("baby");
	assert.equal(result.ok, false);
	assert.equal(result.code, INSTALL_CODES.ROLLBACK_FAILED);
	assert.equal(io.store.has("modules/baby/1.4.3/player.css"), true, "回滚失败要把坏目录改回原位");
	const ledger = JSON.parse(io.store.get("modules/installed.json"));
	assert.equal(ledger.modules.baby.version, "1.4.3", "台账保持原样，不许写坏");
}

{
	// localVersions 必须把 .corrupt-* / .replacing-* / .removing-* 都排除在"可用版本"之外
	const io = makeIo({
		"modules/installed.json": ledgerOf({ baby: { version: "1.4.2" } }),
		...packFiles("1.4.2"),
		"modules/baby/.corrupt-1.4.3-abc/manifest.json": HEALTHY_MANIFEST("1.4.3"),
		"modules/baby/.removing-1.4.1-xyz/manifest.json": HEALTHY_MANIFEST("1.4.1"),
		"modules/baby/1.4.1/manifest.json": HEALTHY_MANIFEST("1.4.1"),
	});
	const installer = makeInstaller(io);
	const listed = await installer.localVersions("baby");
	assert.equal(listed.ok, true);
	assert.deepEqual(listed.versions.sort(), ["1.4.1", "1.4.2"], `实际 ${JSON.stringify(listed.versions)}`);
}

console.log("P12 module-health tests: all passed ✓");
