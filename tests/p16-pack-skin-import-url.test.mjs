/**
 * P16 · 包内皮肤 JS 的动态 import 说明符必须可解析（真机报"技能按钮点不动"）
 *
 * 真机现象（2026-09-30 用户报）：六套样式下点技能按钮都无法确认发动技能。
 *
 * 根因链（本用例把每一环钉成断言）：
 *   1. 本体 `util/index.js:2` 是 `const assetURL = "";` ⇒ `window.decadeUIPath`
 *      形如 `extension/十周年UI-Stars/`，**没有协议、也没有前导 `./`**
 *      （用户此前探针回过的 `getModuleBase` 值正是这个形状）；
 *   2. `ui/{skill,lbtn,character}/skins/index.js` 把 `resourceLoader.getAsset()` 的返回值
 *      直接交给 `import()`。CSS 走 `<link href>`、JS 走 `<script src>` 都能按文档基址解析，
 *      所以六套 CSS 全在（探针 2/3 全绿）；**但 ES module 的说明符解析不接受裸名**
 *      （浏览器：`Failed to resolve module specifier`；Node：`ERR_MODULE_NOT_FOUND`）；
 *   3. 抛错被那三个文件的 try/catch 吞掉并 `return null` ⇒ `src/content.js:131-139`
 *      拿到 null 就什么都不注册 ⇒ lbtn/skill/character 三个 UI 插件**静默缺席**，
 *      表现正是"点了没反应"，且与样式无关（六套都走包路由）。
 *
 * 原版为什么没这问题：它 import 的是 `./${skinName}.js`（模块自身相对路径），是合法说明符。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { createResourceLoader } from "../src/core/resourceLoader.js";

/** 真机形状：lib.assetURL 为空串 ⇒ decadeUIPath 是相对串 */
const PACK_VERSION = JSON.parse(fs.readFileSync("info.json", "utf8")).version;

/**
 * 布局无关地复刻真机形状。`decadeUIPath` = 「从文档根到扩展目录」的相对串，
 * 本机仓库恰好就是游戏加载目录（`resources/app/extension/十周年UI-Stars`），
 * CI 的 checkout 在 `/home/runner/work/<repo>/<repo>` —— 所以文档根与相对串都必须
 * 按当前仓库位置推出来，写死 "extension/十周年UI-Stars/" 会在别的布局上指到不存在的文件。
 */
const ROOT_URL = pathToFileURL(`${process.cwd()}/`).href;
const DOC_BASE = new URL("../../", ROOT_URL).href; // 文档根 = 扩展目录的上两级
const REL_BASE = ROOT_URL.slice(DOC_BASE.length);  // 形如 extension/十周年UI-Stars/
/** 另一种部署形状：lib.assetURL 非空 ⇒ decadeUIPath 本身就是绝对地址 */
const ABS_BASE = ROOT_URL;

/** 六套都已独立安装（真机探针 5 的结论）：getModuleRel 走 modules/<id>/<version>/ */
const installedManager = {
	getInstallState: id => ({ id, independent: true, version: PACK_VERSION, type: "style" }),
};

const relLoader = createResourceLoader({ getBasePath: () => REL_BASE, moduleManager: installedManager });
const absLoader = createResourceLoader({ getBasePath: () => ABS_BASE, moduleManager: installedManager });

// -------------------------------------------------- 1. 复现缺陷现场
{
	const raw = relLoader.getAsset("yjcm", "ui/skill/skins/xinsha.js");
	assert.equal(raw, `${REL_BASE}modules/yjcm/${PACK_VERSION}/ui/skill/skins/xinsha.js`, "getAsset 的既有语义不得改动（CSS/href 依赖它）");

	let err = null;
	try {
		await import(raw);
	} catch (error) {
		err = error;
	}
	assert.ok(err, "拿相对串直接 import() 必须失败 —— 这条断言若在真机也成立，插件缺席就是它造成的");
	assert.match(String(err?.code ?? err?.message), /ERR_MODULE_NOT_FOUND|Cannot find package|Failed to resolve/, `实际错误：${err?.message}`);
}

// -------------------------------------------------- 2. 修复契约：解析成绝对 URL 后真能 import
{
	// 文档基址按当前仓库位置推出（见上面 DOC_BASE 的注释）：真机上页面在 `resources/app/`，
	// 扩展目录是它下面的 `extension/<name>/`，所以相对串按文档基址解析才对得上磁盘。
	// 这与 <link href> 用的是同一套解析规则 —— "CSS 能加载"就证明这个基址是对的。
	globalThis.document.baseURI = DOC_BASE;
	// 皮肤模块求值期会引用本体注入的全局（浏览器里由 extension.js 挂上）
	globalThis.decadeUIPath = REL_BASE;
	globalThis.decadeUIName = "十周年UI-Stars";
	// 资源热插拔迁移后，包内皮肤顶层常量经 window.decadeUI.resource.getAsset 求值
	// （真机由 src/content 在皮肤求值前挂载）；Node 里补同形状的桩，别为迁就测试把皮肤改回硬拼路径。
	globalThis.window = globalThis;
	globalThis.window.decadeUI = { resource: relLoader };

	const url = relLoader.getModuleUrl("yjcm", "ui/skill/skins/xinsha.js");
	assert.ok(/^(file|https?):/.test(url), `getModuleUrl 必须给带协议的绝对 URL，实际 ${url}`);

	const mod = await import(url);
	assert.equal(typeof mod.createXinshaSkillPlugin, "function", "解析出来的必须真能 import 到皮肤工厂");

	for (const [kind, name] of [
		["lbtn", "createXinshaLbtnPlugin"],
		["character", "createXinshaCharacterPlugin"],
	]) {
		const one = await import(relLoader.getModuleUrl("yjcm", `ui/${kind}/skins/xinsha.js`));
		assert.equal(typeof one[name], "function", `ui/${kind}/skins/xinsha.js 应导出 ${name}`);
	}
}

// -------------------------------------------------- 3. 已是绝对地址时不得二次加工
{
	const url = absLoader.getModuleUrl("yjcm", "ui/skill/skins/xinsha.js");
	// ABS_BASE 本身就是规范化的 file URL，绝对地址进 `new URL()` 原样出来，不该被二次加工。
	assert.equal(url, `${ABS_BASE}modules/yjcm/${PACK_VERSION}/ui/skill/skins/xinsha.js`);
	assert.ok(!url.includes("//modules"), "不该出现被拼坏的双斜杠路径");

	// 无文档基址（Node 里没 DOM 的极端情形）时退回原串，不抛
	const saved = globalThis.document.baseURI;
	delete globalThis.document.baseURI;
	const savedHref = globalThis.location.href;
	globalThis.location.href = "";
	try {
		assert.equal(relLoader.getModuleUrl("yjcm", "ui/skill/skins/xinsha.js"), `${REL_BASE}modules/yjcm/${PACK_VERSION}/ui/skill/skins/xinsha.js`);
	} finally {
		globalThis.document.baseURI = saved;
		globalThis.location.href = savedHref;
	}
}

// -------------------------------------------------- 4. 静态不变量：三处 import 只能吃 getModuleUrl
{
	for (const kind of ["skill", "lbtn", "character"]) {
		const file = `ui/${kind}/skins/index.js`;
		assert.ok(fs.existsSync(file), `${file} 应存在`);
		const src = fs.readFileSync(file, "utf8");
		assert.match(src, /resourceLoader\.getModuleUrl\(/, `${file} 的包分支必须改用 getModuleUrl`);
		assert.doesNotMatch(src, /resourceLoader\.getAsset\(\s*styleId\s*,\s*`ui\//, `${file} 不该再把 getAsset 的结果直接交给 import()`);
		assert.match(src, /`\.\/\$\{skinName\}\.js`/, `${file} 未安装分支应保持模块相对的 ./ 写法`);
	}
}

console.log("p16-pack-skin-import-url: OK（皮肤模块的动态 import 说明符已解析为绝对 URL）");
