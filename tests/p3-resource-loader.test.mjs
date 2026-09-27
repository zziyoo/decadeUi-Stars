/**
 * P3 ResourceLoader 模块根路径解析测试（任务书 P3第一阶段）
 * 运行方式：node --import ./tests/helpers/register.mjs tests/p3-resource-loader.test.mjs
 * （resourceLoader 经 loader.js 依赖 noname 模块，需挂解析钩子）
 * 覆盖：P2兼容模式、独立模块根（decade/mobile/core）、未知moduleId、
 *       尾斜杠规范化、状态切换点（同一业务代码两种模块状态）、真实 ModuleManager 集成。
 */
import assert from "node:assert/strict";
import { createResourceLoader } from "../src/core/resourceLoader.js";
import { createModuleRegistry } from "../src/core/registry.js";
import { createModuleManager } from "../src/core/moduleManager.js";
import { registerBuiltInModules } from "../src/core/builtInModules.js";

// ---------- 测试1：P2兼容模式（未注入模块状态，全部回落扩展根） ----------
const rlCompat = createResourceLoader({ getBasePath: () => "ROOT/" });
assert.equal(rlCompat.getAsset("decade", "x.png"), "ROOT/x.png", "未独立安装 → 扩展根");
assert.equal(rlCompat.getAsset("core", "x.png"), "ROOT/x.png");
assert.equal(rlCompat.getAsset("mobile", "x.png"), "ROOT/x.png");

// ---------- 注入模块安装状态的工具 ----------
function makeLoader(states, basePath = "ROOT/") {
	return createResourceLoader({
		getBasePath: () => basePath,
		moduleManager: {
			getInstallState: id => states[id] || { independent: false, version: null, type: null },
		},
	});
}
const states = {
	decade: { independent: true, version: "1.5.0", type: "style" },
	mobile: { independent: true, version: "1.4.2", type: "style" },
	core: { independent: true, version: "1.5.0", type: "core" },
	broken: { independent: true, version: null, type: "style" },
};
const rl = makeLoader(states);

// ---------- 测试2：独立安装的 decade → modules/decade/<version>/ ----------
assert.equal(rl.getAsset("decade", "x.png"), "ROOT/modules/decade/1.5.0/x.png");
assert.equal(rl.getAsset("decade", "image/styles/decade/a.png"), "ROOT/modules/decade/1.5.0/image/styles/decade/a.png");

// ---------- 测试3：mobile 同规则（通用解析，非写死 decade） ----------
assert.equal(rl.getAsset("mobile", "x.png"), "ROOT/modules/mobile/1.4.2/x.png");

// ---------- core 独立根 = core/（区别于 modules/core/...） ----------
assert.equal(rl.getAsset("core", "x.png"), "ROOT/core/x.png");
assert.equal(rl.getModuleBase("core"), "ROOT/core/");

// ---------- 测试4：未知模块 → 扩展根（绝不产生 modules/undefined/...） ----------
assert.equal(rl.getAsset("unknown", "x.png"), "ROOT/x.png");
assert.equal(rl.getModuleBase("unknown"), "ROOT/");
// version 缺失的"独立"模块 → 兜底扩展根
assert.equal(rl.getAsset("broken", "x.png"), "ROOT/x.png");

// ---------- 测试5：尾斜杠规范化 ----------
assert.ok(rl.getModuleBase("decade").endsWith("/"));
assert.equal(rl.getModuleBase("decade"), "ROOT/modules/decade/1.5.0/");
// basePath 不带尾斜杠时同样规范化
const rlNoSlash = makeLoader(states, "ROOT");
assert.equal(rlNoSlash.getAsset("decade", "x.png"), "ROOT/modules/decade/1.5.0/x.png");
// 注入的 getModuleBase 覆盖结果同样被规范化
const rlOverride = createResourceLoader({ getBasePath: () => "ROOT/", getModuleBase: id => `ROOT/m/${id}` });
assert.equal(rlOverride.getAsset("decade", "x.png"), "ROOT/m/decade/x.png");

// ---------- 测试：P3核心切换点（§19 同一份业务代码 × 两种模块状态） ----------
const businessAsset = loader => loader.getAsset("decade", "x.png");
assert.equal(businessAsset(rlCompat), "ROOT/x.png", "状态A：decade 未独立安装 → 扩展根");
assert.equal(businessAsset(rl), "ROOT/modules/decade/1.5.0/x.png", "状态B：decade 已独立安装 1.5.0 → 模块根");

// ---------- 测试：与真实 ModuleManager 集成（内置模块 → 兼容根） ----------
const registry = createModuleRegistry();
registerBuiltInModules(registry, { version: "1.5.0" });
const mm = createModuleManager({ registry });
assert.equal(mm.getInstallState("decade").independent, false, "内置模块非独立安装");
assert.equal(mm.getInstallState("decade").version, "1.5.0");
assert.equal(mm.getInstallState("decade").type, "style");
assert.equal(mm.getInstallState("core").type, "core");
assert.deepEqual(mm.getInstallState("not-exist"), { independent: false, version: null, type: null });

const rlReal = createResourceLoader({ getBasePath: () => "ROOT/", moduleManager: mm });
assert.equal(rlReal.getModuleBase("decade"), "ROOT/");
assert.equal(rlReal.getAsset("decade", "x.png"), "ROOT/x.png");
assert.equal(rlReal.getAsset("core", "x.png"), "ROOT/x.png");

// ---------- StyleRuntime.getAsset 仍然委托 ResourceLoader（回归） ----------
const { createStyleRuntime } = await import("../src/core/styleRuntime.js");
const rt = createStyleRuntime({
	moduleManager: mm,
	getConfig: () => undefined,
	getConfigKey: () => "extension_测试_newDecadeStyle",
	resourceLoader: rlReal,
});
assert.equal(rt.getAsset("decade", "x.png"), "ROOT/x.png");

console.log("P3 resource-loader tests: all passed ✓");
