/**
 * P1 模块基础设施冒烟测试（任务书§36验收）
 * 运行方式：node tests/p1-smoke.test.mjs
 * 被测模块均为纯逻辑（依赖注入配置存取），不依赖 noname 运行时。
 */
import assert from "node:assert/strict";
import { validateManifest, normalizeManifest, MANIFEST_SCHEMA } from "../src/core/manifest.js";
import { createModuleRegistry } from "../src/core/registry.js";
import { createModuleManager } from "../src/core/moduleManager.js";
import { registerBuiltInModules } from "../src/core/builtInModules.js";
import { createStyleRuntime, STYLE_TO_SKIN, STYLE_TO_MODULE } from "../src/core/styleRuntime.js";
import { createPackageInstaller } from "../src/core/packageInstaller.js";

// ---------- 注册表 + 模块管理器 ----------
const registry = createModuleRegistry();
registerBuiltInModules(registry, { version: "1.4.2" });
const moduleManager = createModuleManager({ registry });

// 任务书§36验收接口（P8 起内置清单还含 Feature，声明源见 core/featureRuntime.BUILT_IN_FEATURES）
assert.equal(registry.size, 8, "core + 6 styles + 1 feature");
assert.equal(moduleManager.isInstalled("core"), true);
assert.equal(moduleManager.isInstalled("decade"), true);
assert.equal(moduleManager.isInstalled("kill-effect"), true, "P8：Feature 也进注册表，否则资源寻址与门控都无从判断");
assert.equal(moduleManager.list().length, 8);
assert.equal(moduleManager.list({ type: "style" }).length, 6);
assert.equal(moduleManager.list({ type: "feature" }).length, 1);
assert.deepEqual(moduleManager.getManifest("kill-effect").entry.css, [], "kill-effect 的样式与技能特效共用 effect.css（内含 .skill-name），留在 layout.css 的 @import 链里，不在 Feature 入口登记——否则会出现登记了却不加载、或加载了却随击杀开关卸载的双重语义");
assert.deepEqual(moduleManager.getManifest("kill-effect").capabilities, ["kill-effect"], "能力声明不得含 skill-effect：killEffect 开关不管辖技能特效（原版只在击杀技能 filter 里读它）");

const decade = moduleManager.getManifest("decade");
assert.equal(decade.type, "style");
assert.equal(decade.name, "十周年样式");
assert.ok(decade.entry.css.includes("player.css"), "decade(on) 已拆包 → 包内 player.css");
assert.ok(moduleManager.getManifest("mobile").entry.css.includes("player.css"), "mobile(off) 已拆包 → 包内 player.css");
assert.ok(moduleManager.getManifest("yjcm").capabilities.includes("border-style"));
assert.ok(moduleManager.getManifest("online").capabilities.includes("online-chat"));
assert.equal(moduleManager.getManifest("nope"), null);
assert.equal(moduleManager.get("decade").meta.styleValue, "on");
assert.equal(moduleManager.get("mobile").meta.skin, "shousha");

// 注册校验
assert.equal(moduleManager.register({ schema: 1, id: "BAD_ID", name: "x", version: "1.0.0", type: "style" }).ok, false, "非法id拒绝");
assert.equal(moduleManager.register({ schema: 1, id: "good-mod", name: "x", version: "1.0.0", type: "feature" }).ok, false, "非core缺core声明拒绝");
assert.equal(moduleManager.register({ schema: 1, id: "good-mod", name: "x", version: "1.0.0", type: "feature", core: ">=1.0.0" }).ok, true, "合法feature注册");
assert.equal(registry.size, 9, "内置 8 个（core+6样式+1功能）+ 上面注册的 good-mod");

// 重复注册：同版本幂等，异版本拒绝
assert.doesNotThrow(() => registry.register(moduleManager.getManifest("decade")));
assert.throws(() => registry.register({ ...moduleManager.getManifest("decade"), version: "9.9.9" }));

// ---------- manifest ----------
assert.equal(MANIFEST_SCHEMA, 1);
assert.equal(validateManifest(null).ok, false);
assert.equal(validateManifest({ schema: 1, id: "x", name: "X", version: "1.0.0", type: "style", core: ">=1.0.0" }).ok, true);
const norm = normalizeManifest({ id: "t", name: "T", version: "1.0.0", type: "shared" });
assert.deepEqual(norm.capabilities, []);
assert.deepEqual(norm.entry.js, []);
assert.deepEqual(norm.platform, ["desktop", "mobile"]);

// ---------- StyleRuntime（注入配置存取，不依赖noname） ----------
const KEY = "extension_测试_newDecadeStyle";
const store = { [KEY]: "off" };
const styleRuntime = createStyleRuntime({
	moduleManager,
	getConfig: key => store[key],
	setConfig: (key, value) => { store[key] = value; },
	getConfigKey: () => KEY,
});

assert.deepEqual(styleRuntime.getCurrent(), { value: "off", id: "mobile", skin: "shousha" });
assert.equal(styleRuntime.id, "mobile");
assert.equal(styleRuntime.skin, "shousha");
assert.equal(styleRuntime.hasCapability("online-chat"), false);
assert.equal(styleRuntime.getCapability("online", "online-chat"), true);
assert.equal(styleRuntime.isInstalled("core"), true);
assert.equal(styleRuntime.isInstalled("decade"), true);
assert.equal(styleRuntime.isInstalled("not-a-style"), false);
assert.deepEqual(await styleRuntime.ensureInstalled("baby"), true);
assert.deepEqual(await styleRuntime.load("decade"), { ok: true, loader: "decadeModule" });
assert.deepEqual(await styleRuntime.load("nope"), { ok: false, reason: "not-installed" });

// activate：写配置值并要求reload（任务书§16，不主动reload）
const activated = styleRuntime.activate("online");
assert.equal(activated.ok, true);
assert.equal(activated.reloadRequired, true);
assert.equal(store[KEY], "onlineUI");
assert.equal(styleRuntime.getConfigValue(), "onlineUI");
assert.equal(styleRuntime.id, "online");
assert.equal(styleRuntime.activate("nope").ok, false);

// 非法配置值回退默认（on -> decade）
store[KEY] = "hack";
assert.equal(styleRuntime.getConfigValue(), "on");
assert.equal(styleRuntime.id, "decade");
assert.equal(styleRuntime.skin, "shizhounian");

// 映射表键集合一致性
assert.deepEqual(Object.keys(STYLE_TO_SKIN), Object.keys(STYLE_TO_MODULE));
assert.deepEqual(Object.values(STYLE_TO_MODULE).sort(), ["baby", "codename", "decade", "mobile", "online", "yjcm"]);

// ---------- PackageInstaller（P1 清单校验能力 + P5 端口缺失时的结构化拒绝） ----------
const installer = createPackageInstaller();
assert.equal(installer.verifyManifest({ schema: 1, id: "x", name: "X", version: "1.0.0", type: "style", core: ">=1.0.0" }).ok, true);
const unsupported = await installer.install();
assert.equal(unsupported.ok, false);
assert.equal(unsupported.code, "NO_IO");

console.log("P1 smoke tests: all passed ✓");
