/**
 * P8 Feature 运行时测试（任务书§45/§16）
 * 运行方式：node tests/p8-feature-runtime.test.mjs
 *   featureRuntime 与 registry/moduleManager 一样不依赖 noname，纯 Node 可测。
 *
 * 覆盖：内置 Feature 声明、门控矩阵（声明态 × 注册态 × 开关态 × 是否已拆包）、
 * moduleManager.enabled 钩子的真实接线、CSS 由 manifest 驱动的资源寻址、能力归属查询、define 校验。
 */
import assert from "node:assert/strict";
import { createModuleRegistry } from "../src/core/registry.js";
import { createModuleManager } from "../src/core/moduleManager.js";
import { createFeatureRuntime, BUILT_IN_FEATURES } from "../src/core/featureRuntime.js";

const EXT = "file:///ext/十周年UI-Stars/";
const configKey = key => `extension_十周年UI-Stars_${key}`;

/**
 * 造一套运行时。
 * installed=独立安装（source:"installed"，资源在 modules/<id>/<ver>/）；
 * builtin=内置记录（source:"builtin"，资源位置由该 Feature 的 pack 声明决定）。
 */
function makeEnv({ installed = [], builtin = [], config = {}, bases = {}, css = {} } = {}) {
	let runtime = null;
	const registry = createModuleRegistry();
	const moduleManager = createModuleManager({
		registry,
		// 与 moduleSystem 同样的晚绑定：runtime 建好前钩子也要能用
		isModuleEnabled: id => (runtime ? runtime.switchOn(id) : true),
	});
	for (const id of ["core", ...builtin, ...installed]) {
		const result = moduleManager.register(
			{
				schema: 1,
				id,
				name: `${id}模块`,
				version: "1.4.2",
				type: id === "core" ? "core" : "feature",
				core: ">=1.0.0",
				entry: { css: css[id] || [] },
				capabilities: [],
			},
			{ source: installed.includes(id) ? "installed" : "builtin" }
		);
		assert.equal(result.ok, true, `夹具注册失败: ${id} ${(result.errors || []).join(", ")}`);
	}
	const resourceLoader = { getAsset: (moduleId, path) => `${bases[moduleId] ?? EXT}${path}` };
	runtime = createFeatureRuntime({ moduleManager, resourceLoader, configKey, readConfig: key => config[key] });
	for (const definition of BUILT_IN_FEATURES) runtime.define(definition);
	return { runtime, moduleManager, config, bases };
}

// ------------------------------------------------------------------ 内置 Feature 声明

{
	const kill = BUILT_IN_FEATURES.find(item => item.id === "kill-effect");
	assert.ok(kill, "必须内置声明 kill-effect（任务书§45 第一刀）");
	assert.equal(kill.switchKey, "killEffect", "启停复用既有配置开关，不新增状态源");
	assert.equal(kill.defaultEnabled, true, "与 definitions/appearance.js 的 init:true 保持一致");
	assert.ok(kill.capabilities.includes("kill-effect"), "能力声明供§15 的能力查询");
	assert.equal(typeof kill.pack, "boolean", "必须显式声明资源是否已拆进包（与样式侧 STYLES[].pack 同构）");
	assert.equal(kill.css, undefined, "CSS 路径只在 manifest.entry.css 里，runtime 不重复登记第二份");
	assert.equal(kill.pack, false, "kill-effect 定性为门控型 Feature：资源随 Core 发布，不走拆包通道");

	// P6 模块管理界面（collectFeatureStates）按这三个字段出行，改动字段名要同步界面
	const shape = makeEnv({ builtin: ["kill-effect"] }).runtime.list()[0];
	assert.deepEqual(Object.keys(shape).sort(), ["capabilities", "defaultEnabled", "id", "name", "pack", "switchKey"], `声明字段即界面契约：${Object.keys(shape).join(", ")}`);
}

// ------------------------------------------------------------------ 门控矩阵

{
	// 没有注册记录（既没内置也没安装）→ 绝不激活，哪怕开关为真
	const a = makeEnv({ config: { [configKey("killEffect")]: true } });
	assert.equal(a.runtime.active("kill-effect"), false, "没有模块记录就没有资源，不得激活");
	assert.ok(a.runtime.get("kill-effect"), "define 过就该查得到定义");
	assert.deepEqual(a.runtime.cssOf("kill-effect"), [], "不激活就不产生任何 CSS 加载项");

	// 开关为假 → 不激活（这就是"禁用 Feature"）
	const c = makeEnv({ builtin: ["kill-effect"], config: { [configKey("killEffect")]: false } });
	assert.equal(c.runtime.active("kill-effect"), false, "禁用后不得装载特效");

	// 配置尚未播种 → 回落声明里的 defaultEnabled，不能当成"关"
	const d = makeEnv({ builtin: ["kill-effect"], config: {} });
	assert.equal(d.runtime.active("kill-effect"), true, "未初始化配置时要回落 defaultEnabled");

	// 独立安装 + 开关为真 → 激活
	const e = makeEnv({ installed: ["kill-effect"], config: {}, bases: { "kill-effect": `${EXT}modules/kill-effect/1.4.2/` } });
	assert.equal(e.runtime.active("kill-effect"), true);

	// 无 switchKey 的 Feature：门控不看配置，只看资源
	const g = makeEnv({ builtin: ["plain-feature"], config: { [configKey("whatever")]: false } });
	g.runtime.define({ id: "plain-feature", capabilities: [], pack: false });
	assert.equal(g.runtime.active("plain-feature"), true);
	g.runtime.define({ id: "absent-feature", capabilities: [], pack: false });
	assert.equal(g.runtime.active("absent-feature"), false, "没注册就是没资源，不能凭声明就激活");
}

// ------------------------------------------------------------------ pack：资源已搬进包 vs 仍在单体

{
	// pack:true 且只有内置记录（包没装）→ 不得激活（P3 的"样式不可用而 Core 正常"同一语义）
	const missing = makeEnv({ builtin: ["fx-packed"] });
	missing.runtime.define({ id: "fx-packed", capabilities: [], pack: true });
	assert.equal(missing.runtime.active("fx-packed"), false, "资源已拆进包但包未装 → 不激活");

	// pack:true 且包已装 → 激活；CSS 路径取自 manifest.entry.css（单一来源，绝对地址由 resourceLoader 负责）
	const packed = makeEnv({
		installed: ["fx-packed"],
		bases: { "fx-packed": `${EXT}modules/fx-packed/1.4.2/` },
		css: { "fx-packed": ["effect.css"] },
	});
	packed.runtime.define({ id: "fx-packed", capabilities: [], pack: true });
	assert.equal(packed.runtime.active("fx-packed"), true);
	assert.deepEqual(packed.runtime.cssOf("fx-packed"), ["effect.css"]);
	assert.equal(packed.runtime.asset("fx-packed", "effect.css"), `${EXT}modules/fx-packed/1.4.2/effect.css`, "寻址必须经 getModuleBase 落到包根");

	// pack:false（资源仍在单体）→ CSS 是单体路径，寻址回落扩展根
	const mono = makeEnv({ builtin: ["fx-loose"], css: { "fx-loose": ["src/styles/effect.css"] } });
	mono.runtime.define({ id: "fx-loose", capabilities: [], pack: false });
	assert.equal(mono.runtime.active("fx-loose"), true);
	assert.deepEqual(mono.runtime.cssOf("fx-loose"), ["src/styles/effect.css"]);
	assert.equal(mono.runtime.asset("fx-loose", "src/styles/effect.css"), `${EXT}src/styles/effect.css`);
}

// ------------------------------------------------------------------ moduleManager.enabled 钩子真实接线

{
	const env = makeEnv({ builtin: ["kill-effect"], config: { [configKey("killEffect")]: true } });
	assert.equal(env.moduleManager.isEnabled("kill-effect"), true);
	env.config[configKey("killEffect")] = false;
	assert.equal(env.moduleManager.isEnabled("kill-effect"), false, "P1 悬空的 isModuleEnabled 钩子必须真实反映 Feature 开关");
	assert.equal(env.runtime.switchOn("core"), true, "非 Feature 的 id 不受 Feature 开关影响");
	assert.equal(env.moduleManager.isEnabled("core"), true, "core 不能被 Feature 开关误伤");
}

// ------------------------------------------------------------------ define 校验与查询

{
	const { runtime } = makeEnv({});
	assert.equal(runtime.define({}).ok, false, "缺 id 必须拒绝");
	assert.equal(runtime.define({ id: "bad", capabilities: "x" }).ok, false, "capabilities 必须为数组");
	assert.equal(runtime.define({ id: "bad2", capabilities: [], pack: "yes" }).ok, false, "pack 必须为布尔值");
	assert.equal(runtime.define({ id: "bad3", capabilities: [], defaultEnabled: 1 }).ok, false, "defaultEnabled 必须为布尔值");
	assert.equal(runtime.define({ id: "my-feature", capabilities: ["my-cap"] }).ok, true);
	assert.equal(runtime.define({ id: "my-feature", capabilities: [] }).ok, false, "重复声明要拒绝，不能悄悄覆盖");

	assert.equal(runtime.capabilityOwner("my-cap"), "my-feature");
	assert.equal(runtime.capabilityOwner("kill-effect"), "kill-effect");
	assert.equal(runtime.capabilityOwner("no-such-cap"), null);
	assert.deepEqual(
		runtime.list().map(item => item.id),
		["kill-effect", "card-skin", "my-feature"],
		"list 按 define 顺序，内置声明在前（kill-effect 门控型 → card-skin 拆包型）"
	);
	assert.deepEqual(runtime.cssOf("ghost-feature"), [], "未声明的 id 不得抛错");
	assert.equal(runtime.active("ghost-feature"), false);
	assert.equal(runtime.get("ghost-feature"), null);
}

console.log("P8 feature-runtime tests: all passed ✓");
