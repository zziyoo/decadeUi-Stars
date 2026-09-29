/**
 * P15 · online 卸载的可观测判据（任务书§19 + §51「模块」）
 *
 * 批 3 把 online 的卸载留在待验，因为它有一条自己的判据：「卸载后两个能力同时不可用」。
 * 读码后先纠正一件事 —— **那条判据不可观测**：
 *   · capability 取自注册表清单（`styleRuntime.getCapability` → `moduleManager.getManifest`）；
 *   · 卸载确实会把 online 从注册表摘掉，于是**当下** `hasCapability("online-chat")` 变假；
 *   · 但每次启动 `registerBuiltInModules` 都会按内置声明（`builtInModules.js:31` 写死
 *     `online-chat`/`online-gift`）把它注册回来 ⇒ 重启后又是真，而此时该样式的 CSS
 *     **一条都不会加载**（`decadeModule` 只在 `independent` 为真时读包内 `entry.css`）。
 *   ⇒ capability 不能当"卸没卸"的判据；可观测的是 independent / 资源根 / 台账 / 目录。
 *
 * 卸载事务本身（让位、失败回滚、IN_USE、DEPENDED、残留清理）已由 `tests/p5-installer.test.mjs:773-846`
 * 覆盖，这里只补 online 这条"卸完之后客户端看得见什么"的链，并把 capability 与可用性脱钩这件事钉成断言。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.decadeUIName = "十周年UI-Stars";
globalThis.window = { decadeUIName: "十周年UI-Stars", decadeUIPath: "file:///ext/extension/十周年UI-Stars/" };
const ROOT = globalThis.window.decadeUIPath;

const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { createResourceLoader } = await import("../src/core/resourceLoader.js");
const { createStyleRuntime } = await import("../src/core/styleRuntime.js");
const { registerBuiltInModules } = await import("../src/core/builtInModules.js");
const { normalizeManifest } = await import("../src/core/manifest.js");
const { createPackageInstaller, INSTALL_CODES } = await import("../src/core/packageInstaller.js");
const { buildRows } = await import("../src/core/moduleAdmin.js");

const CORE_VERSION = "1.4.2";
const { createFakeIo } = await import("./helpers/fake-io.mjs");

const onlineManifest = (version, extra = {}) => ({
	schema: 1,
	id: "online",
	name: "Online样式",
	version,
	type: "style",
	core: `>=${CORE_VERSION}`,
	dependencies: ["core"],
	entry: { js: ["ui/lbtn/skins/online.js"], css: ["player.css", "styles/character.css"] },
	capabilities: ["player-frame", "lbtn", "online-chat", "online-gift"],
	...extra,
});

const registry = createModuleRegistry();
registerBuiltInModules(registry, { version: CORE_VERSION });
const moduleManager = createModuleManager({ registry });
const resourceLoader = createResourceLoader({ moduleManager });
/** 可变的样式配置：activate 写它、isInUse 读它，与真机同一状态源（不另立第二份） */
const config = { "extension_十周年UI-Stars_newDecadeStyle": "onlineUI" };
const styleRuntime = createStyleRuntime({
	moduleManager,
	resourceLoader,
	getConfig: key => config[key],
	setConfig: (key, value) => {
		config[key] = value;
	},
});
const io = createFakeIo({
	"modules/installed.json": JSON.stringify({
		schema: 1,
		modules: { online: { version: CORE_VERSION, installedAt: 1, source: "local", size: 12, sha256: "", hashVerified: false } },
	}),
	"modules/online/1.4.2/manifest.json": JSON.stringify(onlineManifest(CORE_VERSION)),
	"modules/online/1.4.2/player.css": "online",
});
const installer = createPackageInstaller({
	registry,
	moduleManager,
	io,
	extractZip: async () => [],
	download: async () => {
		throw new Error("本用例不下载");
	},
	getCoreVersion: () => CORE_VERSION,
	// 与真机一致：online 是当前使用中的样式
	isInUse: id => id === styleRuntime.id,
	random: () => "t0",
});

// ── 1. 装包态：一切正常 ────────────────────────────────────────────────
assert.equal(moduleManager.register(onlineManifest(CORE_VERSION), { source: "installed" }).ok, true);
assert.equal(moduleManager.getInstallState("online").independent, true);
assert.equal(resourceLoader.getModuleRel("online"), "modules/online/1.4.2/");
assert.equal(styleRuntime.hasCapability("online-chat"), true, "装包态下 online 的两个能力应为真");
assert.equal(styleRuntime.hasCapability("online-gift"), true);

// ── 2. 使用中不许卸：走真安装器，文件与台账都不许动 ──────────────────────
{
	const before = [...io.files.keys()].sort().join("|");
	const blocked = await installer.uninstall("online");
	assert.equal(blocked.code, INSTALL_CODES.IN_USE, "online 是当前样式时必须拒绝卸载");
	assert.match(blocked.message, /正在使用中/);
	assert.equal([...io.files.keys()].sort().join("|"), before, "被拒的卸载不许动任何文件");
	assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.online.version, CORE_VERSION, "被拒的卸载不许改台账");
}

// ── 3. 卸走之后：可观测的四件事 ────────────────────────────────────────
styleRuntime.activate("decade");   // 等价于玩家切到别的样式（写配置；isInUse 桩读它）
const removed = await installer.uninstall("online");
assert.equal(removed.ok, true, removed.message);
assert.deepEqual(removed.removedVersions, [CORE_VERSION]);
assert.equal(JSON.parse(io.files.get("modules/installed.json")).modules.online, undefined, "台账条目必须消失");
assert.equal(
	[...io.files.keys()].some(key => key.startsWith("modules/online/")),
	false,
	"modules/online/ 下不许留任何目录（含 .removing-*）"
);
assert.equal(moduleManager.getInstallState("online").independent, false, "注册状态必须不再是独立安装");
assert.equal(moduleManager.getInstallState("online").version, null, "注册表里没有 online 了");
assert.equal(resourceLoader.getModuleRel("online"), "", "资源根回落扩展根（decadeModule 因此不会加载该样式 CSS）");

// ── 4. capability 与"样式可用性"脱钩：这条就是 online.md 判据要更正的原因 ──
// 注意用 getCapability("online", …) 显式点名：上一步已把当前样式切到 decade，
// hasCapability 读的是"当前样式"的能力，用它测 online 会测错对象。
assert.equal(styleRuntime.getCapability("online", "online-chat"), false, "卸载当下：清单没了，能力判假");
// 重启：内置注册按 builtInModules 的声明把它重新登记（这是设计，不是 bug）
registerBuiltInModules(registry, { version: CORE_VERSION });
assert.equal(styleRuntime.getCapability("online", "online-chat"), true, "重启后内置声明回来 ⇒ capability 又变真");
assert.equal(styleRuntime.getCapability("online", "online-gift"), true, "两个能力一起变真（与清单声明同源）");
assert.equal(moduleManager.getInstallState("online").independent, false, "而样式包依然没装：CSS 一条都不会加载");
assert.notEqual(
	styleRuntime.getCapability("online", "online-chat"),
	moduleManager.getInstallState("online").independent,
	"钉住这个不一致：capability 报告 ≠ 包是否装着（所以它不能当卸载判据）"
);

// ── 5. 模块管理窗口那行该显示什么（真清单，不是合成 id） ───────────────────
{
	const ledger = { online: { version: CORE_VERSION } };
	const index = { modules: { online: { name: "Online样式", type: "style", latest: CORE_VERSION, url: "online.zip", sha256: "a".repeat(64), dependencies: ["core"] } } };
	const modules = registry.list().map(record => ({ id: record.manifest.id, name: record.manifest.name, version: record.manifest.version, type: record.manifest.type }));

	const inUse = buildRows({ installed: ledger, index, modules, currentStyleId: "online", coreVersion: CORE_VERSION });
	const onlineRow = inUse.rows.find(row => row.id === "online");
	assert.equal(onlineRow.statusKind, "in_use");
	const blockedAction = onlineRow.actions.find(action => action.kind === "uninstall");
	assert.equal(blockedAction.enabled, false, "使用中：卸载键必须置灰");
	assert.match(blockedAction.reason, /正在使用中，请先切换到其他样式/, "置灰必须给得出理由（UI 拿它写 title）");

	const free = buildRows({ installed: ledger, index, modules, currentStyleId: "decade", coreVersion: CORE_VERSION });
	const freeRow = free.rows.find(row => row.id === "online");
	assert.equal(freeRow.actions.find(action => action.kind === "uninstall").enabled, true, "切走后必须可以卸载");
	assert.ok(!freeRow.actions.find(action => action.kind === "uninstall").reason, "可卸载时不该带理由（空串/未定义都算不带）");

	// 卸载后（台账空、注册表里只剩内置）：行仍在，动作变回"安装"
	const gone = buildRows({ installed: {}, index, modules: [], currentStyleId: "decade", coreVersion: CORE_VERSION });
	const goneRow = gone.rows.find(row => row.id === "online");
	assert.ok(goneRow, "索引里有的模块，卸载后仍要能被看见（否则装不回来）");
	assert.equal(goneRow.actions[0].kind, "install");
}

// ── 6. 卸载不许伤到留在扩展根的那份资源：死亡特效图走的是根，不是包 ─────────
{
	const src = fs.readFileSync(new URL("../src/overrides/player/animations.js", import.meta.url), "utf8");
	assert.match(src, /const basePath = window\.decadeUIPath \+ "image\/styles\/";/, "死亡特效图必须走扩展根（卸载样式包不该影响它）");
	assert.ok(!/getModuleBase|getAsset\(/.test(src.slice(src.indexOf("function getDeathImageUrl"), src.indexOf("function getDeathImageUrl") + 900)), "死亡特效不许改成按模块根寻址（那样卸包就 404）");
	for (const file of ["image/styles/online/dead4_dizhu.png", "image/styles/baby/dead3_dizhu.png", "image/styles/decade/dead_bZhu.png"]) {
		assert.ok(fs.existsSync(file), `${file} 必须仍在扩展根里（样式包被卸后唯一还能取到的那份）`);
	}
}

console.log("p15-online-uninstall-observability: OK（online 卸载链 + capability 脱钩 + 置灰理由 + 根资源不受影响）");
