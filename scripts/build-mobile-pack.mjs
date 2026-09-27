#!/usr/bin/env node
/**
 * P4：mobile Style Pack 组装脚本（一次性迁移；沿用 P3 decade 模式）
 *
 * 用法：node scripts/build-mobile-pack.mjs
 * 职责：组装 modules/mobile/<版本>/（manifest.json + 迁移CSS(url重写) + 自有图片）
 *       并维护 modules/installed.json
 * 边界：不移动共享资源；不修改源CSS；皮肤JS与骨骼包资产不迁移（保持单体，路径有效）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const MODULE_ID = "mobile";
const info = JSON.parse(readFileSync(join(REPO_ROOT, "info.json"), "utf8"));
const VERSION = info.version;
const PACK_DIR = join(REPO_ROOT, "modules", MODULE_ID, VERSION);

/** 迁移清单：[源文件(仓库相对), 包内路径]。顺序即 CSS 级联顺序。 */
const CSS_MOVES = [
	["src/styles/player2.css", "player.css"],
	["ui/styles/character/shousha.css", "styles/character.css"],
	["ui/styles/lbtn/shousha.css", "styles/lbtn.css"],
	["ui/styles/skill/shousha.css", "styles/skill.css"],
	["ui/styles/lbtn/window/shousha.css", "styles/lbtn-window.css"],
	["ui/styles/skill/window/shousha.css", "styles/skill-window.css"],
];

/** mobile 自有资源前缀（其中的引用文件复制进包）；其余引用视为共享，回落扩展根 */
const OWNED_PREFIXES = ["image/styles/shousha/", "ui/assets/skill/shousha/", "ui/assets/character/shousha/"];

const toPosix = p => p.split("\\").join("/");
const repoRel = absPath => toPosix(relative(REPO_ROOT, absPath));

let copiedFiles = 0;
let rewrittenRefs = 0;
const deadRefs = []; // 上游死引用（解析目标在仓库中不存在），改写指针后记录进 manifest 供 verify-pack 识别
const missingRefs = [];

function rewriteRef(ref, originalCssRepoDir, newCssPackDir) {
	const target = ref.trim();
	if (target.startsWith("#") || target.startsWith("data:")) return null;
	const absTarget = resolve(REPO_ROOT, originalCssRepoDir, target);
	const rootRef = repoRel(absTarget);
	rewrittenRefs++;
	if (!existsSync(absTarget)) {
		// 上游死引用：目标文件在仓库中不存在。仍按原解析目标改写指针
		//（行为=404，与原版一致），登记进 manifest.deadRefs 供 verify-pack 告警。
		missingRefs.push(`${originalCssRepoDir} -> ${target}`);
		deadRefs.push(rootRef);
		const ups = "../".repeat(newCssPackDir.split("/").filter(Boolean).length);
		return `${ups}${rootRef}`;
	}
	if (OWNED_PREFIXES.some(prefix => rootRef.startsWith(prefix))) {
		const dstFile = join(PACK_DIR, rootRef);
		mkdirSync(dirname(dstFile), { recursive: true });
		copyFileSync(absTarget, dstFile);
		copiedFiles++;
		return toPosix(relative(newCssPackDir, rootRef));
	}
	const ups = "../".repeat(newCssPackDir.split("/").filter(Boolean).length);
	return `${ups}${rootRef}`;
}

mkdirSync(PACK_DIR, { recursive: true });

for (const [srcRel, packRel] of CSS_MOVES) {
	const srcFile = join(REPO_ROOT, srcRel);
	if (!existsSync(srcFile)) {
		console.error(`[错误] 源文件不存在: ${srcRel}`);
		process.exit(1);
	}
	let css = readFileSync(srcFile, "utf8");
	const originalDir = toPosix(dirname(srcRel));
	const newDir = toPosix(dirname(join("modules", MODULE_ID, VERSION, packRel)));

	// 共享动画样式由 Core 统一加载（拆包后删除 @import 行）
	css = css.replace(/^\s*@import\s+["']animation\.css["'];?\s*\r?\n?/gm, "");

	css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
		const rewritten = rewriteRef(ref, originalDir, newDir);
		return rewritten === null ? match : `url("${rewritten}")`;
	});
	if (deadRefs.length) css += `\n/* NOTE: 上游死引用已按原解析目标改写指针（目标文件上游不存在，行为=404），详见 manifest.deadRefs */\n`;

	const dstFile = join(PACK_DIR, packRel);
	mkdirSync(dirname(dstFile), { recursive: true });
	writeFileSync(dstFile, css, "utf8");
	console.log(`已迁移: ${srcRel} -> modules/${MODULE_ID}/${VERSION}/${packRel}`);
}

const manifest = {
	schema: 1,
	id: MODULE_ID,
	name: "移动版样式",
	version: VERSION,
	type: "style",
	core: `>=${VERSION}`,
	dependencies: ["core"],
	entry: {
		js: [
			`ui/character/skins/shousha.js`,
			`ui/skill/skins/shousha.js`,
			`ui/lbtn/skins/shousha.js`,
		],
		css: CSS_MOVES.map(([, packRel]) => packRel),
	},
	deadRefs: [...new Set(deadRefs)],
	capabilities: ["player-frame", "lbtn"],
	platform: ["desktop", "mobile"],
	author: info.author || "子右",
};
writeFileSync(join(PACK_DIR, "manifest.json"), JSON.stringify(manifest, null, "\t") + "\n", "utf8");

const installedPath = join(REPO_ROOT, "modules", "installed.json");
let installed = { schema: 1, modules: {} };
if (existsSync(installedPath)) {
	try {
		installed = JSON.parse(readFileSync(installedPath, "utf8"));
	} catch {}
	installed.modules ??= {};
}
installed.modules[MODULE_ID] = { version: VERSION };
writeFileSync(installedPath, JSON.stringify(installed, null, "\t") + "\n", "utf8");

console.log(`\n完成：modules/${MODULE_ID}/${VERSION}/（复制资源 ${copiedFiles} 个，重写引用 ${rewrittenRefs} 处）`);
if (missingRefs.length) {
	console.warn(`警告：${missingRefs.length} 个引用目标不存在（原样保留）：`);
	missingRefs.forEach(ref => console.warn("  " + ref));
}
