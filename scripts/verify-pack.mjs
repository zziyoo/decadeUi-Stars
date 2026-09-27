#!/usr/bin/env node
/** 校验包内 CSS 的全部 url() 引用在包内/扩展根中真实可达 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_FILES = [
	"modules/decade/1.4.2/player.css",
	"modules/decade/1.4.2/styles/character.css",
	"modules/decade/1.4.2/styles/lbtn.css",
	"modules/decade/1.4.2/styles/skill.css",
	"modules/decade/1.4.2/styles/lbtn-window.css",
	"modules/decade/1.4.2/styles/skill-window.css",
];
let bad = 0;
let ok = 0;
for (const rel of CSS_FILES) {
	const cssPath = join(ROOT, rel);
	const css = readFileSync(cssPath, "utf8");
	const dir = dirname(cssPath);
	const refs = css.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g) || [];
	for (const m of refs) {
		const ref = m.replace(/^url\(\s*(['"]?)/, "").replace(/(['"]?)\s*\)$/, "").trim();
		if (ref.startsWith("#") || ref.startsWith("data:")) continue;
		const abs = resolve(dir, ref);
		if (existsSync(abs)) ok++;
		else {
			bad++;
			console.error(`缺失: ${rel} -> ${ref}\n  解析: ${abs}`);
		}
	}
	console.log(`${rel}: ${refs.length} 处引用`);
}
console.log(`\n可达 ${ok}，缺失 ${bad}`);
process.exit(bad ? 1 : 0);
