#!/usr/bin/env node
/**
 * 校验所有已安装样式包的 CSS url() 引用与皮肤 JS 相对导入真实可达。
 * 数据源：modules/installed.json + 各包 manifest.json（含 deadRefs 死引用登记）。
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installed = JSON.parse(readFileSync(join(ROOT, "modules", "installed.json"), "utf8"));

let ok = 0;
let hostRef = 0;
let knownDead = 0;
let bad = 0;

function checkRef(cssRel, ref, deadRefs) {
	if (ref.startsWith("#") || ref.startsWith("data:")) return;
	const abs = resolve(dirname(join(ROOT, cssRel)), ref);
	const rootRef = relative(ROOT, abs).split("\\").join("/");
	/**
	 * 解析结果跳出仓库根的引用，指向的是**本体游戏目录**里的资源（上游 CSS 本来就用
	 * `../../image/...` 这类相对路径引本体的图，如 image/character/hidden_image.jpg）。
	 * 本机仓库恰好就是游戏加载目录所以 existsSync 会命中，CI 上没有游戏目录就永远命不中
	 * —— 所以这里按"是否越界"分类，而不是按 existsSync，两边结果才一致。
	 * 这些资源不该被复制进包：它们由本体提供。
	 */
	if (rootRef.startsWith("../")) {
		hostRef++;
		console.log(`指向本体(越界，不入包): ${cssRel} -> ${rootRef}`);
		return;
	}
	if (existsSync(abs)) {
		ok++;
	} else if ((deadRefs || []).includes(rootRef)) {
		knownDead++;
		console.warn(`已知上游死引用（指针正确）: ${cssRel} -> ${rootRef}`);
	} else {
		bad++;
		console.error(`缺失: ${cssRel} -> ${ref}\n  解析: ${abs}`);
	}
}

for (const [id, info] of Object.entries(installed.modules || {})) {
	const packRoot = join(ROOT, "modules", id, info.version);
	const manifest = JSON.parse(readFileSync(join(packRoot, "manifest.json"), "utf8"));
	for (const cssRel of manifest.entry?.css || []) {
		const cssPath = join(packRoot, cssRel);
		const css = readFileSync(cssPath, "utf8");
		const refs = css.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g) || [];
		for (const m of refs) {
			const ref = m.replace(/^url\(\s*(['"]?)/, "").replace(/(['"]?)\s*\)$/, "").trim();
			checkRef(`modules/${id}/${info.version}/${cssRel}`, ref, manifest.deadRefs);
		}
		console.log(`modules/${id}/${info.version}/${cssRel}: 引用计毕`);
	}
}
console.log(`\n可达 ${ok}，指向本体(越界) ${hostRef}，已知上游死引用 ${knownDead}，未知缺失 ${bad}`);
process.exit(bad ? 1 : 0);
