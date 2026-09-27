#!/usr/bin/env node
/**
 * P4+：剩余样式包批量迁移脚本（一次性）
 *
 * 对 online/yjcm/baby/codename 逐包执行：
 *   1. CSS 组迁移（playerN.css + ui/styles/{x}/{skin}.css + window×2）：
 *      url() 重写——自有资源复制进包并改包内相对路径；共享资源/死引用指向扩展根并登记 deadRefs
 *   2. 皮肤 JS 迁移（ui/{character,skill,lbtn}/skins/{skin}.js，镜像路径）：
 *      相对导入重写为跨包引用（回溯扩展根）
 *   3. 生成 manifest.json（entry.js/css + deadRefs）并更新 modules/installed.json
 *
 * 本脚本不执行 git 操作：迁移后由调用方 git rm 源文件、git add 包文件。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const info = JSON.parse(readFileSync(join(REPO_ROOT, "info.json"), "utf8"));
const VERSION = info.version;

const STYLES = [
	{ id: "yjcm", skin: "xinsha", playerIndex: 3, owned: ["image/styles/xinsha/", "ui/assets/character/xinsha/", "ui/assets/skill/xinsha/"] },
	{ id: "online", skin: "online", playerIndex: 4, owned: ["image/styles/online/", "ui/assets/character/online/", "ui/assets/skill/online/"] },
	{ id: "baby", skin: "baby", playerIndex: 5, owned: ["image/styles/baby/", "ui/assets/character/baby/", "ui/assets/skill/baby/"] },
	{ id: "codename", skin: "codename", playerIndex: 6, owned: ["image/styles/codename/", "ui/assets/skill/codename/"] },
];

const toPosix = p => p.split("\\").join("/");
const repoRel = absPath => toPosix(relative(REPO_ROOT, absPath));

/** CSS url() 重写（与 build-mobile-pack.mjs 同语义：自有复制/共享与死引用指向扩展根） */
function rewriteCss(css, originalDir, newDir, packDir, ownedPrefixes, deadRefs, report) {
	const rewritten = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
		const target = ref.trim();
		if (target.startsWith("#") || target.startsWith("data:")) return match;
		const absTarget = resolve(REPO_ROOT, originalDir, target);
		const rootRef = repoRel(absTarget);
		report.refs++;
		if (!existsSync(absTarget)) {
			deadRefs.push(rootRef);
			const ups = "../".repeat(newDir.split("/").filter(Boolean).length);
			return `url("${ups}${rootRef}")`;
		}
		if (ownedPrefixes.some(prefix => rootRef.startsWith(prefix))) {
			const dstFile = join(packDir, rootRef);
			mkdirSync(dirname(dstFile), { recursive: true });
			copyFileSync(absTarget, dstFile);
			report.copied++;
			return `url("${toPosix(relative(newDir, rootRef))}")`;
		}
		const ups = "../".repeat(newDir.split("/").filter(Boolean).length);
		return `url("${ups}${rootRef}")`;
	});
	return rewritten.replace(/^\s*@import\s+["']animation\.css["'];?\s*\r?\n?/gm, "");
}

/** 皮肤 JS 相对导入重写（跨包引用：回溯扩展根 + 原解析目标） */
function rewriteSkinImports(code, originalDir, newDir, report) {
	return code.replace(/(from\s*|import\()\s*(["'])(\.[^"']+)\2/g, (match, kw, quote, spec) => {
		const absTarget = resolve(REPO_ROOT, originalDir, spec);
		const rootRef = repoRel(absTarget);
		if (!existsSync(absTarget)) {
			report.missingImports.push(`${originalDir} -> ${spec}`);
			return match;
		}
		const ups = "../".repeat(newDir.split("/").filter(Boolean).length);
		report.imports++;
		return `${kw}${quote}${ups}${rootRef}${quote}`;
	});
}

for (const style of STYLES) {
	const packDir = join(REPO_ROOT, "modules", style.id, VERSION);
	const report = { copied: 0, refs: 0, imports: 0, missingImports: [] };
	const deadRefs = [];

	// 1. CSS 组
	const cssMoves = [
		[`src/styles/player${style.playerIndex}.css`, "player.css"],
		[`ui/styles/character/${style.skin}.css`, "styles/character.css"],
		[`ui/styles/lbtn/${style.skin}.css`, "styles/lbtn.css"],
		[`ui/styles/skill/${style.skin}.css`, "styles/skill.css"],
		[`ui/styles/lbtn/window/${style.skin}.css`, "styles/lbtn-window.css"],
		[`ui/styles/skill/window/${style.skin}.css`, "styles/skill-window.css"],
	];
	mkdirSync(packDir, { recursive: true });
	for (const [srcRel, packRel] of cssMoves) {
		const srcFile = join(REPO_ROOT, srcRel);
		if (!existsSync(srcFile)) {
			console.error(`[错误] 源文件不存在: ${srcRel}`);
			process.exit(1);
		}
		const originalDir = toPosix(dirname(srcRel));
		const newDir = toPosix(dirname(join("modules", style.id, VERSION, packRel)));
		let css = readFileSync(srcFile, "utf8");
		css = rewriteCss(css, originalDir, newDir, packDir, style.owned, deadRefs, report);
		const dstFile = join(packDir, packRel);
		mkdirSync(dirname(dstFile), { recursive: true });
		writeFileSync(dstFile, css, "utf8");
	}

	// 2. 皮肤 JS（镜像路径 + 相对导入重写）
	for (const dirName of ["character", "skill", "lbtn"]) {
		const srcRel = `ui/${dirName}/skins/${style.skin}.js`;
		const srcFile = join(REPO_ROOT, srcRel);
		const originalDir = toPosix(dirname(srcRel));
		const newDir = toPosix(dirname(join("modules", style.id, VERSION, srcRel)));
		let code = readFileSync(srcFile, "utf8");
		code = rewriteSkinImports(code, originalDir, newDir, report);
		const dstJs = join(packDir, srcRel);
		mkdirSync(dirname(dstJs), { recursive: true });
		writeFileSync(dstJs, code, "utf8");
	}

	// 3. manifest + installed.json
	const manifest = {
		schema: 1,
		id: style.id,
		name: `${{ yjcm: "一将成名", online: "Online", baby: "欢乐三国杀", codename: "名将杀" }[style.id]}样式`,
		version: VERSION,
		type: "style",
		core: `>=${VERSION}`,
		dependencies: ["core"],
		entry: {
			js: [`ui/character/skins/${style.skin}.js`, `ui/skill/skins/${style.skin}.js`, `ui/lbtn/skins/${style.skin}.js`],
			css: cssMoves.map(([, packRel]) => packRel),
		},
		deadRefs: [...new Set(deadRefs)],
		capabilities: ["player-frame", "lbtn"],
		platform: ["desktop", "mobile"],
		author: info.author || "子右",
	};
	writeFileSync(join(packDir, "manifest.json"), JSON.stringify(manifest, null, "\t") + "\n", "utf8");

	const installedPath = join(REPO_ROOT, "modules", "installed.json");
	let installed = { schema: 1, modules: {} };
	try {
		installed = JSON.parse(readFileSync(installedPath, "utf8"));
	} catch {}
	installed.modules ??= {};
	installed.modules[style.id] = { version: VERSION };
	writeFileSync(installedPath, JSON.stringify(installed, null, "\t") + "\n", "utf8");

	console.log(
		`[${style.id}] 完成：CSS 6 + 皮肤 3（导入 ${report.imports} 处重写）+ 资源复制 ${report.copied} + 引用重写 ${report.refs} + 死引用 ${new Set(deadRefs).size}` +
			(report.missingImports.length ? ` | 警告：未解析导入 ${report.missingImports.join(" ; ")}` : "")
	);
}
console.log("\n四个样式包迁移完成。请执行 git rm 源文件并提交。");
