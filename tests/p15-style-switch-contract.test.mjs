/**
 * P15 · 六套样式切换的契约（任务书§14/§16 + §51「样式」）
 *
 * 起因：批 3 真机回报「前几套看着像共用一个样式」。查下来不是包内容重复，而是
 * **切换样式按设计只写配置、必须重载才生效**（`styleRuntime.activate()` → `reloadRequired:true`，
 * 任务书§16 的保存设置→game.reload()→新模块初始化）。所以本阶段不改这个生命周期，
 * 而是把三件事钉成测试，防止以后有人"为了让切换立即生效"把它改坏：
 *   1) 切换只写配置：不碰注册表、不加载任何资源、如实回 reloadRequired；
 *   2) 六套的映射一一对应且与内置注册不漂移，资源根各自指向自己的包目录；
 *   3) "加载谁的 CSS"这条判据仍在 decadeModule 里（independent 才读包内 entry.css），
 *      且"已迁移"名单与六套齐全 —— 名单漏一套就会去加载不存在的单体路径。
 * 另附包内容指纹核对：六套的六个 CSS 文件与 image 目录互不相同（批3 那次人工核查固化下来）。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

globalThis.decadeUIName = "十周年UI-Stars";
globalThis.window = { decadeUIName: "十周年UI-Stars", decadeUIPath: "file:///ext/extension/十周年UI-Stars/" };
const ROOT = globalThis.window.decadeUIPath;

const {
	STYLE_CONFIG_VALUES,
	DEFAULT_STYLE_VALUE,
	STYLE_TO_MODULE,
	STYLE_TO_SKIN,
	createStyleRuntime,
} = await import("../src/core/styleRuntime.js");
const { createModuleRegistry } = await import("../src/core/registry.js");
const { createModuleManager } = await import("../src/core/moduleManager.js");
const { createResourceLoader } = await import("../src/core/resourceLoader.js");
const { registerBuiltInModules } = await import("../src/core/builtInModules.js");
const { normalizeManifest } = await import("../src/core/manifest.js");

const CORE_VERSION = "1.4.2";
const SIX = ["decade", "mobile", "yjcm", "online", "baby", "codename"];

// ── 1. 切换的生命周期：只写配置，别的什么都不做 ────────────────────────────
{
	const registry = createModuleRegistry();
	registerBuiltInModules(registry, { version: CORE_VERSION });
	const moduleManager = createModuleManager({ registry });
	const writes = [];
	const runtime = createStyleRuntime({
		moduleManager,
		getConfig: key => getConfigOf(key, writes),
		setConfig: (key, value) => writes.push([key, value]),
	});

	for (const id of SIX) {
		writes.length = 0;
		const result = runtime.activate(id);
		assert.equal(result.ok, true, `activate(${id}) 应成功：${result.reason}`);
		assert.equal(result.reloadRequired, true, `${id}：切换必须如实上报"需要重载"，不许假装已生效`);
		assert.equal(writes.length, 1, `${id}：切换只允许一次配置写入，不许顺手加载资源或改注册表`);
		assert.equal(writes[0][0], "extension_十周年UI-Stars_newDecadeStyle", "配置键必须走唯一拼接点");
		assert.equal(writes[0][1], Object.keys(STYLE_TO_MODULE).find(key => STYLE_TO_MODULE[key] === id));
		// 注册表不许被切换动作改动（重载前生效样式仍是启动那套 —— 这是设计，不是 bug）
		assert.equal(registry.get(id).meta.source, "builtin", "activate 不许改注册表里的来源标记");
	}

	// 未知 id 与只读环境：都不许写
	for (const bad of ["nope", "", null, undefined, "core"]) {
		writes.length = 0;
		assert.deepEqual(runtime.activate(bad), { ok: false, reason: "unknown-style" }, `未知样式 ${bad} 必须被拒`);
		assert.equal(writes.length, 0, "被拒的切换不许写配置");
	}
	const readOnly = createStyleRuntime({ moduleManager, getConfig: () => "on" });
	assert.deepEqual(readOnly.activate("baby"), { ok: false, reason: "read-only" }, "没有 setConfig 时不许谎报成功");
}

function getConfigOf(key, writes) {
	const hit = writes.find(([name]) => name === key);
	return hit ? hit[1] : undefined;
}

// ── 2. 映射表与内置注册不许漂移 ────────────────────────────────────────
{
	assert.deepEqual([...STYLE_CONFIG_VALUES].sort(), Object.keys(STYLE_TO_MODULE).sort(), "配置值集合与映射表键集必须一致");
	assert.equal(new Set(Object.values(STYLE_TO_MODULE)).size, 6, "六个配置值必须映射到六个不同模块 id");
	assert.equal(new Set(Object.values(STYLE_TO_SKIN)).size, 6, "六个配置值必须映射到六个不同皮肤名");
	assert.deepEqual(Object.keys(STYLE_TO_MODULE).sort(), Object.keys(STYLE_TO_SKIN).sort(), "两张表的配置值必须同集");
	assert.deepEqual([...SIX].sort(), Object.values(STYLE_TO_MODULE).sort(), "六套样式 id 必须齐全");

	// 内置注册（builtInModules）是启动期那一份声明：与映射表对不上就会出现"能选到但没模块"
	const registry = createModuleRegistry();
	registerBuiltInModules(registry, { version: CORE_VERSION });
	const builtinStyles = registry.list({ type: "style" }).map(item => item.manifest.id).sort();
	assert.deepEqual(builtinStyles, [...SIX].sort(), "内置注册的样式集必须与六套映射一致");
	for (const [value, id] of Object.entries(STYLE_TO_MODULE)) {
		const meta = registry.get(id).meta;
		assert.equal(meta.styleValue, value, `${id} 的别名 styleValue 与 STYLE_TO_MODULE 反查不一致`);
		assert.equal(meta.skin, STYLE_TO_SKIN[value], `${id} 的别名 skin 与 STYLE_TO_SKIN 不一致`);
	}
}

// ── 3. 资源根：装了指向包目录，没装回落扩展根（不许拼出 modules/undefined/） ──
{
	const registry = createModuleRegistry();
	registerBuiltInModules(registry, { version: CORE_VERSION });
	const moduleManager = createModuleManager({ registry });
	const resourceLoader = createResourceLoader({ moduleManager });

	for (const id of SIX) {
		assert.equal(resourceLoader.getModuleRel(id), "", `未装包时 ${id} 应回落扩展根`);
		moduleManager.register(normalizeManifest(packManifest(id, CORE_VERSION)), { source: "installed" });
		assert.equal(resourceLoader.getModuleRel(id), `modules/${id}/${CORE_VERSION}/`, `${id} 装了包必须解析到自己的版本目录`);
		assert.ok(resourceLoader.getModuleBase(id).startsWith(ROOT), "getModuleBase 必须以扩展根为前缀");
	}

	// 台账版本 ≠ 本体版本时也必须跟着走（40f7933 那条缺陷的寻址侧；注册协议与启动/安装器一致：
	// 先 unregister 再以 source="installed" 覆盖 —— registry 对"同 id 不同版本"是抛错拒绝的）
	const registry2 = createModuleRegistry();
	registerBuiltInModules(registry2, { version: CORE_VERSION });
	const manager2 = createModuleManager({ registry: registry2 });
	const loader2 = createResourceLoader({ moduleManager: manager2 });
	registry2.unregister("baby");
	manager2.register(normalizeManifest(packManifest("baby", "1.4.4")), { source: "installed" });
	assert.equal(loader2.getModuleRel("baby"), "modules/baby/1.4.4/", "已装版本与本体版本不同时必须解析到已装版本目录");
	assert.equal(manager2.getInstallState("baby").independent, true);
}

function packManifest(id, version) {
	return {
		schema: 1,
		id,
		name: `${id}样式`,
		version,
		type: "style",
		core: `>=${CORE_VERSION}`,
		dependencies: ["core"],
		entry: { js: [`ui/${id}.js`], css: ["player.css"] },
		capabilities: ["player-frame", "lbtn"],
	};
}

// ── 4. 启动期"读谁的 CSS"这条判据不许漂走（decadeModule 不可在 Node 实例化，走静态不变量）──
{
	const src = fs.readFileSync(new URL("../src/core/decadeModule.js", import.meta.url), "utf8");
	assert.match(
		src,
		/const packCss = installState\.independent \? moduleManager\.getManifest\(styleId\)\?\.entry\?\.css \|\| null : null;/,
		"样式主 CSS 必须只在 independent（已装包）时取包内 entry.css"
	);
	assert.match(src, /MIGRATED_STYLE_IDS = new Set\(\[([^\]]+)\]\)/, "已迁移样式名单必须存在");
	const listed = src.match(/MIGRATED_STYLE_IDS = new Set\(\[([^\]]+)\]\)/)[1].match(/"([^"]+)"/g).map(text => text.replaceAll('"', ""));
	assert.deepEqual([...listed].sort(), [...SIX].sort(), "已迁移名单必须恰好是这六套：漏一套会去加载不存在的单体 CSS");
	assert.equal(DEFAULT_STYLE_VALUE, "on", "默认样式配置值必须是 on（decade）");
}

// ── 5. 六套包内容互不相同（把"看起来一样≠包重复"的核查固化，防搬迁时误覆盖）──
{
	const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
	const cssFiles = ["player.css", "styles/character.css", "styles/lbtn.css", "styles/skill.css", "styles/lbtn-window.css", "styles/skill-window.css"];
	for (const rel of cssFiles) {
		const seen = new Map();
		for (const id of SIX) {
			const file = path.join("modules", id, CORE_VERSION, rel);
			assert.ok(fs.existsSync(file), `${file} 不存在：六套都应自带 ${rel}（包内 entry.css 声明了它）`);
			const hex = digest(file);
			assert.ok(!seen.has(hex), `${rel} 在 ${seen.get(hex)} 与 ${id} 两包里内容完全相同 —— 搬迁被覆盖了？`);
			seen.set(hex, id);
		}
	}
	// image 目录：mobile 是纯 CSS 变体（0 张图），其余五套的目录指纹必须互不相同
	const fingerprints = SIX.map(id => {
		const dir = path.join("modules", id, CORE_VERSION, "image");
		const files = fs.existsSync(dir) ? [...fs.readdirSync(dir, { recursive: true })].map(String).filter(rel => fs.statSync(path.join(dir, rel)).isFile()) : [];
		return [id, files.length, crypto.createHash("sha256").update(files.map(rel => rel + digest(path.join(dir, rel))).sort().join("|")).digest("hex")];
	});
	assert.equal(fingerprints.find(([id]) => id === "mobile")[1], 0, "mobile 是纯 CSS 变体，image 应为空（这条若变红说明布局改了判据）");
	const nonEmpty = fingerprints.filter(([, count]) => count > 0);
	assert.equal(nonEmpty.length, 5, "应有五套带图片");
	assert.equal(new Set(nonEmpty.map(([, , hex]) => hex)).size, nonEmpty.length, "五套的 image 目录指纹必须互不相同");
}

console.log("p15-style-switch-contract: OK（六套切换契约 + 资源根 + CSS/图片指纹）");
