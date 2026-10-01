/**
 * P6 模块管理界面 —— 行模型纯逻辑测试（任务书§43）
 * 运行方式：node tests/p6-module-admin.test.mjs
 *   （被测模块只依赖 manifest.js / packageInstaller.js，均不依赖 noname 运行时，
 *    因此无需 noname 解析钩子；用 tests/helpers/register.mjs 跑也等价）
 *
 * 覆盖：状态推导（core/使用中/已装/有更新/未装/不兼容/依赖缺失/内置功能）、动作可用性与禁用理由、
 * Feature 行的两种形态（门控型只给启用/禁用、拆包型走安装通道）、文案映射（INSTALL_CODES 全覆盖 + 未知码兜底）、
 * 结果文案、大小格式化、汇总与排序。
 */
import assert from "node:assert/strict";
import { buildRows, summarize, codeText, resultText, formatSize } from "../src/core/moduleAdmin.js";
import { INSTALL_CODES } from "../src/core/packageInstaller.js";

// ------------------------------------------------------------------ 大小格式化

assert.equal(formatSize(0), "未知", "0 视为未知（索引缺 size 时的默认值）");
assert.equal(formatSize(undefined), "未知");
assert.equal(formatSize(null), "未知");
assert.equal(formatSize(-1), "未知");
assert.equal(formatSize(512), "512 B");
assert.equal(formatSize(1024), "1.0 KB");
assert.equal(formatSize(1536), "1.5 KB");
assert.equal(formatSize(12 * 1024 * 1024), "12.0 MB");
assert.equal(formatSize(3 * 1024 * 1024 * 1024), "3.0 GB");

// ------------------------------------------------------------------ 结果码文案

for (const code of Object.values(INSTALL_CODES)) {
	const text = codeText(code);
	assert.equal(typeof text, "string", `${code} 必须有文案`);
	assert.ok(text.length > 0, `${code} 文案不得为空`);
	assert.notEqual(text, code, `${code} 必须是中文文案而不是原样回显 code`);
}
assert.equal(codeText("OK"), "成功");
assert.equal(codeText("NOPE_NOT_A_CODE"), "未知结果（NOPE_NOT_A_CODE）", "未知码要兜底且带上原码便于排查");
assert.equal(codeText(undefined), "未知结果");

const contains = (code, keyword) => assert.ok(codeText(code).includes(keyword), `${code} 文案应包含「${keyword}」，实际「${codeText(code)}」`);
contains("IN_USE", "使用");
contains("DEPENDED", "依赖");
contains("DEP_MISSING", "依赖");
contains("CANCELLED", "取消");
contains("ROLLBACK_FAILED", "回滚");
contains("IO_STALL", "无响应");
contains("SHA_MISMATCH", "校验");
contains("ALREADY_INSTALLED", "已安装");
contains("INSTALLED_CORRUPT", "损坏");
contains("NO_IO", "不可用");
contains("NO_EXTRACTOR", "不可用");
contains("NOT_INDEPENDENT", "独立");

// ------------------------------------------------------------------ 结果文案

{
	const ok = resultText({ ok: true, code: "OK", message: "已安装 十周年样式 1.4.2" });
	assert.equal(ok, "已安装 十周年样式 1.4.2");
	assert.equal(resultText({ ok: false, code: "IN_USE" }), codeText("IN_USE"), "无 message 时用 code 文案");
	const warned = resultText({ ok: true, code: "OK", message: "已安装", warnings: ["未提供外部摘要", "旧版本让位目录清理失败"] });
	assert.ok(warned.includes("已安装") && warned.includes("未提供外部摘要") && warned.includes("旧版本让位目录清理失败"), `告警必须带出来：${warned}`);
	assert.equal(resultText(null), "未知结果");
}

// ------------------------------------------------------------------ 行模型

/** 台账（installed.json 的 modules） */
const ledger = {
	decade: { version: "1.4.2", previousVersion: "1.4.0", size: 12 * 1024 * 1024 },
	mobile: { version: "1.4.2" },
	online: { version: "1.4.2" },
	"shared-ui": { version: "1.0.0" },
	"legacy-pack": { version: "0.9.0" },
};

/** 注册表可见的模块（moduleManager.list() + 各自 manifest.dependencies） */
const modules = [
	{ id: "core", name: "十周年UI-Stars 核心", type: "core", version: "1.4.2", dependencies: [] },
	{ id: "decade", name: "十周年样式", type: "style", version: "1.4.2", dependencies: ["core"] },
	{ id: "mobile", name: "移动版样式", type: "style", version: "1.4.2", dependencies: ["core"] },
	{ id: "online", name: "Online样式", type: "style", version: "1.4.2", dependencies: ["core", "shared-ui"] },
	{ id: "shared-ui", name: "公共界面资源", type: "shared", version: "1.0.0", dependencies: [] },
	{ id: "yjcm", name: "一将成名样式", type: "style", version: "1.4.2", dependencies: ["core"] },
	{ id: "baby", name: "欢乐三国杀样式", type: "style", version: "1.4.2", dependencies: ["core"] },
	{ id: "dracula", name: "第三方样式", type: "style", version: "1.0.0", dependencies: ["core"] },
];

const index = {
	schema: 1,
	core: { latest: "1.5.0" },
	modules: {
		decade: {
			latest: "1.5.0",
			url: "https://test/decade-1.5.0.zip",
			sha256: "a".repeat(64),
			size: 13 * 1024 * 1024,
			dependencies: ["core"],
			core: ">=1.4.0",
		},
		online: { latest: "1.5.0", url: "https://test/online-1.5.0.zip", core: ">=9.9.9" },
		yjcm: { latest: "1.4.2", url: "https://test/yjcm-1.4.2.zip", size: 9 * 1024 * 1024, core: ">=1.4.0" },
		baby: { latest: "1.4.2", url: "https://test/baby-1.4.2.zip", dependencies: ["shared-fonts"], core: ">=1.4.0" },
	},
};

const { rows, summary } = buildRows({
	installed: ledger,
	index,
	modules,
	currentStyleId: "decade",
	coreVersion: "1.4.2",
});
const row = id => {
	const found = rows.find(item => item.id === id);
	assert.ok(found, `应存在 ${id} 行，实际有 ${rows.map(item => item.id).join(", ")}`);
	return found;
};

// 顺序：core 在首，其余按注册表顺序，未注册但台账里有的排最后
assert.deepEqual(rows.map(item => item.id), ["core", "decade", "mobile", "online", "shared-ui", "yjcm", "baby", "dracula", "legacy-pack"]);

// core：不可安装/更新/卸载，只作展示
{
	const core = row("core");
	assert.equal(core.type, "core");
	assert.equal(core.statusKind, "core");
	assert.match(core.statusText, /核心/);
	assert.deepEqual(core.actions, [], "core 不提供任何安装/卸载动作");
	assert.equal(core.installed, false, "installed 表示「有独立安装台账」，core 随扩展发布、不走台账");
}

// 当前使用中的样式：状态优先显示"使用中"，更新可用但卸载被 §19 边界挡住
{
	const decade = row("decade");
	assert.equal(decade.statusKind, "in_use");
	assert.equal(decade.statusText, "当前使用", "徽标文案与任务书§43示例一致");
	assert.equal(decade.version, "1.4.2");
	assert.equal(decade.latest, "1.5.0");
	assert.equal(decade.versionText, "1.4.2 → 1.5.0");
	assert.equal(decade.sizeText, "13.0 MB", "大小优先用索引里的值");
	const update = decade.actions.find(action => action.kind === "update");
	assert.ok(update && update.enabled, "使用中的样式仍可更新（安装器允许）");
	assert.deepEqual(update.spec, {
		id: "decade",
		url: "https://test/decade-1.5.0.zip",
		expectedVersion: "1.5.0",
		expectedSha256: "a".repeat(64),
		size: 13 * 1024 * 1024,
		dependencies: ["core"],
		core: ">=1.4.0",
	});
	const uninstall = decade.actions.find(action => action.kind === "uninstall");
	assert.equal(uninstall.enabled, false, "使用中不许卸载（force 也不许）");
	assert.match(uninstall.reason, /使用中|切换/);
}

// 已安装且索引里没有该模块：离线状态，仍可卸载
{
	const mobile = row("mobile");
	assert.equal(mobile.statusKind, "installed");
	assert.equal(mobile.statusText, "已安装");
	assert.equal(mobile.versionText, "已安装 1.4.2");
	assert.equal(mobile.sizeText, "未知", "台账里没记 size 就如实显示未知");
	assert.equal(mobile.actions.some(action => action.kind === "install" || action.kind === "update"), false);
	assert.equal(mobile.actions.find(action => action.kind === "uninstall").enabled, true);
}

// Core 版本不满足：有更新但按钮禁用且说明原因
{
	const online = row("online");
	assert.equal(online.statusKind, "incompatible");
	assert.match(online.compatibilityText, /9\.9\.9/, `兼容性文案要写出要求：${online.compatibilityText}`);
	const update = online.actions.find(action => action.kind === "update");
	assert.ok(update, "有索引条目就应出现更新动作");
	assert.equal(update.enabled, false);
	assert.match(update.reason, /Core/);
	assert.equal(online.actions.find(action => action.kind === "uninstall").enabled, true, "online 依赖别人、自己不被依赖 → 可卸载");
}

// 未安装 + 索引有地址：可安装，spec 与安装器 externalTarget 兼容
{
	const yjcm = row("yjcm");
	assert.equal(yjcm.installed, false);
	assert.equal(yjcm.statusKind, "not_installed");
	assert.equal(yjcm.statusText, "未安装");
	assert.equal(yjcm.versionText, "未安装");
	assert.equal(yjcm.latest, "1.4.2");
	assert.equal(yjcm.sizeText, "9.0 MB");
	const install = yjcm.actions.find(action => action.kind === "install");
	assert.ok(install && install.enabled);
	assert.deepEqual(install.spec, { id: "yjcm", url: "https://test/yjcm-1.4.2.zip", expectedVersion: "1.4.2", expectedSha256: "", size: 9 * 1024 * 1024, dependencies: [], core: ">=1.4.0" });
	assert.equal(yjcm.actions.some(action => action.kind === "uninstall"), false, "没装就没有卸载按钮");
}

// 依赖缺失：安装按钮禁用并点名缺谁
{
	const baby = row("baby");
	assert.equal(baby.statusKind, "dep_missing");
	assert.match(baby.dependenciesText, /shared-fonts/);
	const install = baby.actions.find(action => action.kind === "install");
	assert.equal(install.enabled, false);
	assert.match(install.reason, /shared-fonts/);
}

// 被依赖的模块：不许卸载（§19 边界），并点名依赖方
{
	const shared = row("shared-ui");
	assert.equal(shared.installed, true);
	const uninstall = shared.actions.find(action => action.kind === "uninstall");
	assert.equal(uninstall.enabled, false);
	assert.match(uninstall.reason, /online/);
}

// 注册表里没有但台账里有的（例如注册表记录丢失）：仍要能看见、能卸载，名称回落到 id
{
	const legacy = row("legacy-pack");
	assert.equal(legacy.installed, true);
	assert.equal(legacy.name, "legacy-pack");
	assert.equal(legacy.statusKind, "installed");
	assert.equal(legacy.actions.find(action => action.kind === "uninstall").enabled, true);
}

// 注册表里有、台账里没有、索引里也没有：未安装且无下载地址 → 按钮禁用并说明
{
	const dracula = row("dracula");
	assert.equal(dracula.statusKind, "not_installed");
	const install = dracula.actions.find(action => action.kind === "install");
	assert.equal(install.enabled, false);
	assert.match(install.reason, /模块源/);
}

// 汇总
assert.deepEqual(summary, { total: 9, installed: 5, updatable: 1, installable: 1, inUse: 1, corrupt: 0 }, "没有 health 输入时 corrupt 恒为 0");

// ------------------------------------------------------------------ 无索引（离线）

{
	const offline = buildRows({ installed: ledger, index: null, modules, currentStyleId: "decade", coreVersion: "1.4.2" });
	assert.equal(offline.rows.length, 9, "离线也要列出全部已装/已知模块");
	const offlineDecade = offline.rows.find(item => item.id === "decade");
	assert.equal(offlineDecade.latest, null);
	assert.equal(offlineDecade.versionText, "已安装 1.4.2");
	assert.deepEqual(offlineDecade.actions.map(action => action.kind), ["uninstall"], "离线不提供安装/更新动作");
	assert.equal(offlineDecade.actions[0].enabled, false, "使用中仍然不许卸载");
	assert.equal(offline.rows.find(item => item.id === "yjcm").actions[0].enabled, false);
	assert.match(offline.rows.find(item => item.id === "yjcm").actions[0].reason, /模块源/);
	assert.deepEqual(summarize(offline.rows), { total: 9, installed: 5, updatable: 0, installable: 0, inUse: 1, corrupt: 0 });
}

// ------------------------------------------------------------------ 缺省输入

{
	const empty = buildRows({});
	assert.deepEqual(empty.rows, []);
	assert.deepEqual(empty.summary, { total: 0, installed: 0, updatable: 0, installable: 0, inUse: 0, corrupt: 0 });
	assert.deepEqual(summarize([]), { total: 0, installed: 0, updatable: 0, installable: 0, inUse: 0, corrupt: 0 });
}

// ------------------------------------------------------------------ Feature 行（任务书§45/§16 启用·禁用）

/** Feature 与样式共用一套行模型，差别由 featureStates 描述：pack=资源是否已拆成独立包 */
const featureModules = [
	{ id: "core", name: "十周年UI-Stars 核心", type: "core", version: "1.4.2", dependencies: [] },
	{ id: "decade", name: "十周年样式", type: "style", version: "1.4.2", dependencies: ["core"] },
	{ id: "kill-effect", name: "击杀/技能特效", type: "feature", version: "1.4.2", dependencies: ["core"] },
	{ id: "card-skin", name: "卡牌皮肤", type: "feature", version: "1.4.2", dependencies: ["core"] },
];
const featureStates = {
	"kill-effect": { pack: false, switchKey: "killEffect", enabled: true },
	"card-skin": { pack: true, switchKey: "cardSkin", enabled: true },
};
/** 门控型 Feature 也可能出现在索引里（第三方打包了资源）——界面仍不许给安装按钮 */
const featureIndex = {
	schema: 1,
	modules: {
		"kill-effect": { latest: "1.0.0", url: "https://test/kill-effect-1.0.0.zip", core: ">=1.4.0" },
		"card-skin": { latest: "1.0.0", url: "https://test/card-skin-1.0.0.zip", size: 5 * 1024 * 1024, core: ">=1.4.0" },
	},
};
const fRow = (result, id) => {
	const found = result.rows.find(item => item.id === id);
	assert.ok(found, `应存在 ${id} 行，实际有 ${result.rows.map(item => item.id).join(", ")}`);
	return found;
};

// 门控型：随扩展发布，只有启用/禁用；拆包型未装：只有安装
{
	const result = buildRows({ installed: {}, index: featureIndex, modules: featureModules, currentStyleId: "decade", coreVersion: "1.4.2", featureStates });
	const gate = fRow(result, "kill-effect");
	assert.equal(gate.type, "feature");
	assert.equal(gate.statusKind, "built_in");
	assert.match(gate.statusText, /内置/);
	assert.equal(gate.installed, false, "installed 仍严格表示「有独立安装台账」");
	assert.match(gate.versionText, /内置/, `内置功能不该显示成「未安装」：${gate.versionText}`);
	assert.deepEqual(gate.actions.map(action => action.kind), ["disable"], "门控型不给安装/卸载，只给禁用");
	assert.deepEqual(gate.actions[0], { kind: "disable", label: "禁用", enabled: true, reason: "", switchKey: "killEffect" });

	const pack = fRow(result, "card-skin");
	assert.equal(pack.statusKind, "not_installed");
	assert.deepEqual(pack.actions.map(action => action.kind), ["install"], "拆包型未装时没有可启用/禁用的东西");
	assert.equal(pack.actions[0].enabled, true);
	assert.equal(pack.actions[0].spec.url, "https://test/card-skin-1.0.0.zip");

	assert.deepEqual(result.summary, { total: 4, installed: 0, updatable: 0, installable: 1, inUse: 1, corrupt: 0 });
}

// 拆包型已装：卸载与禁用并存（两条通道互不替代）
{
	const result = buildRows({
		installed: { decade: { version: "1.4.2" }, "card-skin": { version: "1.0.0" } },
		index: featureIndex,
		modules: featureModules,
		currentStyleId: "decade",
		coreVersion: "1.4.2",
		featureStates,
	});
	const pack = fRow(result, "card-skin");
	assert.equal(pack.installed, true);
	assert.equal(pack.statusKind, "installed");
	assert.deepEqual(pack.actions.map(action => action.kind), ["uninstall", "disable"]);
	assert.equal(pack.actions[1].switchKey, "cardSkin");

	const gate = fRow(result, "kill-effect");
	assert.deepEqual(gate.actions.map(action => action.kind), ["disable"], "门控型即使索引里有条目也不给安装按钮");
}

// 开关已关：按钮变"启用"，状态文案要如实反映"当前是关着的"
{
	const result = buildRows({
		installed: {},
		index: featureIndex,
		modules: featureModules,
		currentStyleId: null,
		coreVersion: "1.4.2",
		featureStates: { ...featureStates, "kill-effect": { pack: false, switchKey: "killEffect", enabled: false } },
	});
	const gate = fRow(result, "kill-effect");
	assert.deepEqual(gate.actions.map(action => action.kind), ["enable"]);
	assert.equal(gate.actions[0].label, "启用");
	assert.equal(gate.actions[0].switchKey, "killEffect");
	assert.match(gate.statusText, /禁用|关/, `关闭状态要在徽标上看得见：${gate.statusText}`);
}

// 门控型却有台账记录（异常状态）：以台账为准，允许卸载，避免留下无人能清的残留
{
	const result = buildRows({
		installed: { "kill-effect": { version: "1.0.0" } },
		index: null,
		modules: featureModules,
		currentStyleId: null,
		coreVersion: "1.4.2",
		featureStates,
	});
	const gate = fRow(result, "kill-effect");
	assert.equal(gate.installed, true);
	assert.equal(gate.statusKind, "installed");
	assert.deepEqual(gate.actions.map(action => action.kind), ["uninstall", "disable"]);
}

// 未声明开关的内置 Feature：不许凭空造一个配置键
{
	const result = buildRows({ installed: {}, index: featureIndex, modules: [{ id: "silent", name: "静默块", type: "feature", version: "1.0.0", dependencies: [] }], featureStates: { silent: { pack: false, switchKey: null, enabled: true } } });
	assert.equal(result.rows[0].statusKind, "built_in");
	assert.deepEqual(result.rows[0].actions, []);
}

// featureStates 缺省（老调用方 / runtime 未就绪）：行为与之前完全一致
{
	const result = buildRows({ installed: {}, index: featureIndex, modules: featureModules, currentStyleId: "decade", coreVersion: "1.4.2" });
	assert.deepEqual(
		fRow(result, "kill-effect").actions.map(action => action.kind),
		["install"],
		"不传 featureStates 时 Feature 行按通用规则处理，不新增判定"
	);
	assert.equal(fRow(result, "kill-effect").statusKind, "not_installed");
}

// ------------------------------------------------------------------ 真实接线（内置注册表 + featureRuntime → 行）

{
	// 界面传的是 moduleManager.list() 与 featureRuntime.list()+switchOn()，这里用真实实现跑一遍，
	// 防止 builtInModules 的 type、list() 的字段形状或 switchKey 改了而界面集体出错
	const { createModuleRegistry } = await import("../src/core/registry.js");
	const { createModuleManager } = await import("../src/core/moduleManager.js");
	const { registerBuiltInModules } = await import("../src/core/builtInModules.js");
	const { createFeatureRuntime, BUILT_IN_FEATURES } = await import("../src/core/featureRuntime.js");

	const registry = createModuleRegistry();
	registerBuiltInModules(registry, { version: "1.4.2" });
	let runtime;
	const moduleManager = createModuleManager({ registry, isModuleEnabled: id => (runtime ? runtime.switchOn(id) : true) });
	const killKey = "extension_十周年UI-Stars_killEffect";
	const config = { [killKey]: true };
	runtime = createFeatureRuntime({
		moduleManager,
		resourceLoader: { getAsset: (id, path) => path },
		configKey: key => `extension_十周年UI-Stars_${key}`,
		readConfig: key => config[key],
	});
	for (const definition of BUILT_IN_FEATURES) runtime.define(definition);

	const featureStates = () => {
		const states = {};
		for (const item of runtime.list()) {
			states[item.id] = { pack: item.pack === true, switchKey: item.switchKey || null, enabled: runtime.switchOn(item.id) !== false };
		}
		return states;
	};
	const modules = moduleManager.list().map(item => ({ id: item.id, name: item.name, type: item.type, version: item.version, dependencies: moduleManager.getManifest?.(item.id)?.dependencies || [] }));
	const result = buildRows({ installed: {}, index: null, modules, currentStyleId: "decade", coreVersion: "1.4.2", featureStates: featureStates() });

	const kill = fRow(result, "kill-effect");
	assert.equal(kill.type, "feature", "注册表必须把 kill-effect 标成 feature，否则界面走通用（样式）判定");
	assert.equal(kill.statusKind, "built_in", "真实声明 pack:false → 内置功能，不能显示成未安装");
	assert.equal(kill.versionText, "内置 1.4.2", "版本取自 moduleManager.list()");
	assert.deepEqual(kill.actions.map(action => action.kind), ["disable"]);
	assert.equal(kill.actions[0].switchKey, "killEffect", "switchKey 必须与外观页的击杀特效开关同名");

	config[killKey] = false;
	const off = buildRows({ installed: {}, index: null, modules, currentStyleId: "decade", coreVersion: "1.4.2", featureStates: featureStates() });
	assert.deepEqual(fRow(off, "kill-effect").actions.map(action => action.kind), ["enable"], "关掉开关后按钮要翻成启用（同一份配置，两个入口同步）");
}

// ------------------------------------------------------------------ 安装器不可用（无文件系统/解压端口的平台）

{
	// 语义边界：installBlocker 只剥夺"安装/更新/卸载"能力，
	// 绝不允许连带把门控型 Feature 的启用/禁用一起挡掉（任务书§16 第一阶段就要启停）
	const blocker = "本平台不支持安装/卸载（缺少：文件系统端口）";
	const result = buildRows({
		installed: { decade: { version: "1.4.2" }, "card-skin": { version: "1.0.0" } },
		index: featureIndex,
		modules: featureModules,
		currentStyleId: null,
		coreVersion: "1.4.2",
		featureStates,
		installBlocker: blocker,
	});

	const gate = fRow(result, "kill-effect");
	assert.deepEqual(gate.actions.map(action => action.kind), ["disable"], "安装器不可用仍要生成门控型 Feature 的启停行");
	assert.equal(gate.actions[0].enabled, true, "启停不碰文件系统，不许被平台能力挡掉");
	assert.equal(gate.actions[0].switchKey, "killEffect");

	const packOn = fRow(result, "card-skin");
	assert.deepEqual(packOn.actions.map(action => action.kind), ["uninstall", "disable"], "已装的拆包型 Feature 仍出卸载+禁用，只是卸载置灰");
	assert.equal(packOn.actions[0].enabled, false, "没有文件端口就不能删目录");
	assert.match(packOn.actions[0].reason, /文件系统端口/);
	assert.equal(packOn.actions[1].enabled, true, "禁用照旧可点");

	const decade = fRow(result, "decade");
	assert.equal(decade.actions.find(action => action.kind === "uninstall").enabled, false);
	assert.match(decade.actions.find(action => action.kind === "uninstall").reason, /文件系统端口/);

	assert.equal(result.summary.installed, 2, "台账读取本身不受影响时计数不变");
}

// 未安装的拆包型 Feature：安装按钮存在但灰掉，spec 必须原样保留（灰≠没有得装）
{
	const result = buildRows({
		installed: {},
		index: featureIndex,
		modules: featureModules,
		currentStyleId: null,
		coreVersion: "1.4.2",
		featureStates,
		installBlocker: "本平台不支持安装/卸载（缺少：解压端口）",
	});
	const pack = fRow(result, "card-skin");
	assert.deepEqual(pack.actions.map(action => action.kind), ["install"], "拆包型未装仍只给安装，不给启停");
	assert.equal(pack.actions[0].enabled, false);
	assert.match(pack.actions[0].reason, /解压端口/);
	assert.equal(pack.actions[0].spec.url, "https://test/card-skin-1.0.0.zip", "禁用理由不能顺手清掉安装规格");
}

// 原有禁用理由要保留，不能只留平台理由（§19 的"使用中"这类信息更靠近玩家）
{
	const result = buildRows({
		installed: { decade: { version: "1.4.2" } },
		index,
		modules,
		currentStyleId: "decade",
		coreVersion: "1.4.2",
		installBlocker: "本平台不支持安装/卸载",
	});
	const uninstall = fRow(result, "decade").actions.find(action => action.kind === "uninstall");
	assert.match(uninstall.reason, /使用中/);
	assert.match(uninstall.reason, /本平台不支持/);
	// 可更新的样式：更新按钮同样被平台能力挡住
	const update = fRow(result, "decade").actions.find(action => action.kind === "update");
	assert.equal(update.enabled, false, "没有文件端口就落不了盘");
	assert.match(update.reason, /本平台不支持/);
}

// 不传 installBlocker：行为与引入该参数之前逐字一致（上方所有断言即基准）
{
	const result = buildRows({ installed: {}, index: featureIndex, modules: featureModules, currentStyleId: null, coreVersion: "1.4.2", featureStates });
	assert.equal(fRow(result, "card-skin").actions[0].enabled, true, "缺省（可用）时安装按钮照旧点亮");
}

// ------------------------------------------------------------------ 损坏行的修复入口（D4）
//
// 真机死锁（2026-10-01 Android）：包被写坏 → 启动注册不过 → 注册表里 `independent:false`，
// 而台账仍写着"已安装"。于是行上是「卸载」，点下去被 `NOT_INDEPENDENT` 拒绝；
// 「安装/更新」又因为 `isInstalled` 而不出现——删不掉也装不回，而他手机上的文件管理器
// 根本进不去 app 私有目录，界面上没有第二条路。`verifyInstalled` 早就能给出
// `action:{kind:"restore"|"reinstall"}`，只是没人消费它。

const dLedger = {
	decade: { version: "1.5.0" },
	online: { version: "1.5.0", previousVersion: "1.4.2" },
	baby: { version: "1.5.0" },
	mobile: { version: "1.5.0" },
};
const dModules = [
	{ id: "core", name: "核心", type: "core", version: "1.5.0", dependencies: [] },
	{ id: "decade", name: "十周年样式", type: "style", version: "1.5.0", dependencies: ["core"] },
	{ id: "online", name: "Online样式", type: "style", version: "1.5.0", dependencies: ["core"] },
	{ id: "baby", name: "欢乐三国杀样式", type: "style", version: "1.5.0", dependencies: ["core"] },
	{ id: "mobile", name: "移动版样式", type: "style", version: "1.5.0", dependencies: ["core"] },
];
const dIndex = {
	schema: 1,
	modules: {
		decade: { latest: "1.5.0", url: "https://test/decade-1.5.0.zip", sha256: "c".repeat(64), size: 4096, core: ">=1.5.0" },
		baby: { latest: "1.5.0", url: "", core: ">=1.5.0" },
		online: { latest: "1.5.0", url: "https://test/online-1.5.0.zip", core: ">=1.5.0" },
		mobile: { latest: "1.5.0", url: "https://test/mobile-1.5.0.zip", core: ">=1.5.0" },
	},
};
const dRow = (result, id) => {
	const found = result.rows.find(item => item.id === id);
	assert.ok(found, `应存在 ${id} 行`);
	return found;
};
const damaged = (kind, extra = {}) => ({ status: "corrupt", reasons: ["manifest.json 缺少 id 字段"], action: { kind }, ...extra });

// 1) 损坏 + 有模块源 ⇒ 修复（重装）可点，规格取自索引；卸载置灰并指向修复
{
	const result = buildRows({
		installed: dLedger,
		index: dIndex,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { decade: damaged("reinstall") },
	});
	const row = dRow(result, "decade");
	assert.equal(row.statusKind, "corrupt");
	assert.match(row.statusText, /损坏/);
	const repair = row.actions.find(action => action.kind === "repair");
	assert.ok(repair, "损坏行必须给出修复入口，否则玩家只剩一个会被拒绝的卸载按钮");
	assert.equal(repair.repairKind, "reinstall");
	assert.equal(repair.enabled, true, `有下载地址就该能重装：${repair.reason}`);
	assert.equal(repair.spec.url, "https://test/decade-1.5.0.zip");
	assert.equal(repair.spec.expectedVersion, "1.5.0", "修复要装回台账记的那一版");
	assert.equal(repair.spec.expectedSha256, "c".repeat(64));
	const uninstall = row.actions.find(action => action.kind === "uninstall");
	assert.equal(uninstall.enabled, false, "损坏行别让人先点那个必然失败的卸载");
	assert.match(uninstall.reason, /损坏|修复/);
}

// 2) 台账版本与索引 latest 不同也不能装错版（重装按台账 version，不是 latest）
{
	const result = buildRows({
		installed: { ...dLedger, mobile: { version: "1.4.9" } },
		index: { schema: 1, modules: { mobile: { latest: "1.5.0", url: "https://test/mobile-1.5.0.zip", core: ">=1.5.0" } } },
		modules: dModules,
		coreVersion: "1.5.0",
		health: { mobile: damaged("reinstall") },
	});
	const repair = dRow(result, "mobile").actions.find(action => action.kind === "repair");
	assert.equal(repair.spec.expectedVersion, "1.4.9", "重装是修复当前台账记录，不是顺带升级");
}

// 3) 有健康的上一版 ⇒ restore（回退不下载，**没配模块源也能修**）
{
	const result = buildRows({
		installed: dLedger,
		index: null,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { online: damaged("restore", { action: { kind: "restore", version: "1.4.2" } }) },
	});
	const repair = dRow(result, "online").actions.find(action => action.kind === "repair");
	assert.equal(repair.repairKind, "restore");
	assert.equal(repair.enabled, true, `回退不联网，未配置模块源也必须能点：${repair.reason}`);
	assert.equal(repair.version, "1.4.2");
}

// 4) 装不回的条件不成立 ⇒ 修复出现但置灰，理由写清楚
{
	const result = buildRows({
		installed: dLedger,
		index: dIndex,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { baby: damaged("reinstall"), mobile: damaged("reinstall") },
	});
	const noUrl = dRow(result, "baby").actions.find(action => action.kind === "repair");
	assert.equal(noUrl.enabled, false, "索引里这个条目没有下载地址，不能让人点了才发现修不了");
	assert.match(noUrl.reason, /下载地址|模块源/);
	const offline = buildRows({
		installed: dLedger,
		index: null,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { mobile: damaged("reinstall") },
	});
	const off = dRow(offline, "mobile").actions.find(action => action.kind === "repair");
	assert.equal(off.enabled, false);
	assert.match(off.reason, /模块源/);
}

// 5) 平台剥夺安装能力 ⇒ 修复同样置灰（它要落盘）
{
	const result = buildRows({
		installed: dLedger,
		index: dIndex,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { decade: damaged("reinstall") },
		installBlocker: "本平台不支持安装/卸载（缺少：文件系统端口）",
	});
	const repair = dRow(result, "decade").actions.find(action => action.kind === "repair");
	assert.equal(repair.enabled, false, "没有文件端口时回退/重装都落不了盘");
	assert.match(repair.reason, /文件系统端口/);
}

// 6) 没坏（health 缺失或 ok）⇒ 行与引入该参数之前逐字一致
{
	const without = buildRows({ installed: dLedger, index: dIndex, modules: dModules, coreVersion: "1.5.0" });
	const withOk = buildRows({
		installed: dLedger,
		index: dIndex,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { decade: { status: "ok", reasons: [], action: null }, online: null },
	});
	assert.deepEqual(withOk.rows, without.rows, "健康检查说 ok（或没查成）时不许改动任何一行");
	for (const id of ["decade", "online"]) {
		assert.equal(dRow(without, id).actions.some(action => action.kind === "repair"), false);
	}
	assert.equal(dRow(without, "online").actions.find(a => a.kind === "uninstall").enabled, true, "正常行的卸载仍然可点");
}

// 7) 汇总把待修复的行数单独报出来（界面顶部一行字要能提示"有 N 个包需要修复"）
{
	const result = buildRows({
		installed: dLedger,
		index: dIndex,
		modules: dModules,
		coreVersion: "1.5.0",
		health: { decade: damaged("reinstall"), online: damaged("restore") },
	});
	assert.equal(result.summary.corrupt, 2);
	assert.equal(result.summary.installed, 4, "损坏不等于未安装，台账口径不变");
}

console.log("P6 module-admin tests: all passed ✓");
