/**
 * P6 模块管理界面 —— 行模型纯逻辑测试（任务书§43）
 * 运行方式：node tests/p6-module-admin.test.mjs
 *   （被测模块只依赖 manifest.js / packageInstaller.js，均不依赖 noname 运行时，
 *    因此无需 noname 解析钩子；用 tests/helpers/register.mjs 跑也等价）
 *
 * 覆盖：状态推导（core/使用中/已装/有更新/未装/不兼容/依赖缺失）、动作可用性与禁用理由、
 * 文案映射（INSTALL_CODES 全覆盖 + 未知码兜底）、结果文案、大小格式化、汇总与排序。
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
assert.deepEqual(summary, { total: 9, installed: 5, updatable: 1, installable: 1, inUse: 1 });

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
	assert.deepEqual(summarize(offline.rows), { total: 9, installed: 5, updatable: 0, installable: 0, inUse: 1 });
}

// ------------------------------------------------------------------ 缺省输入

{
	const empty = buildRows({});
	assert.deepEqual(empty.rows, []);
	assert.deepEqual(empty.summary, { total: 0, installed: 0, updatable: 0, installable: 0, inUse: 0 });
	assert.deepEqual(summarize([]), { total: 0, installed: 0, updatable: 0, installable: 0, inUse: 0 });
}

console.log("P6 module-admin tests: all passed ✓");
