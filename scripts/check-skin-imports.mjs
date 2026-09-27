#!/usr/bin/env node
/** 校验包内皮肤 JS 的相对导入目标真实可达 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
	"modules/decade/1.4.2/ui/character/skins/shizhounian.js",
	"modules/decade/1.4.2/ui/skill/skins/shizhounian.js",
	"modules/decade/1.4.2/ui/lbtn/skins/shizhounian.js",
];
let bad = 0;
for (const rel of FILES) {
	const code = readFileSync(join(ROOT, rel), "utf8");
	const dir = dirname(join(ROOT, rel));
	const re = /(?:from|import\()\s*["'](\.[^"']+)["']/g;
	let m;
	while ((m = re.exec(code))) {
		const target = resolve(dir, m[1]);
		if (existsSync(target)) {
			console.log(`OK  ${rel} -> ${m[1]}`);
		} else {
			bad++;
			console.error(`缺失: ${rel} -> ${m[1]}\n  解析: ${target}`);
		}
	}
}
console.log(bad === 0 ? "皮肤相对导入全部可达 ✓" : `缺失 ${bad} 处`);
process.exit(bad ? 1 : 0);
