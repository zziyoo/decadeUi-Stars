#!/usr/bin/env node
/** 校验所有已安装样式包内皮肤 JS 的相对导入真实可达（数据源：installed.json + 各包 manifest.entry.js） */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installed = JSON.parse(readFileSync(join(ROOT, "modules", "installed.json"), "utf8"));

let bad = 0;
let ok = 0;
for (const [id, info] of Object.entries(installed.modules || {})) {
	const packRoot = join(ROOT, "modules", id, info.version);
	const manifest = JSON.parse(readFileSync(join(packRoot, "manifest.json"), "utf8"));
	for (const jsRel of manifest.entry?.js || []) {
		const jsPath = join(packRoot, jsRel);
		const code = readFileSync(jsPath, "utf8");
		const dir = dirname(jsPath);
		const re = /(?:from|import\()\s*["'](\.[^"']+)["']/g;
		let m;
		while ((m = re.exec(code))) {
			const target = resolve(dir, m[1]);
			const display = `modules/${id}/${info.version}/${jsRel} -> ${m[1]}`;
			if (existsSync(target)) {
				ok++;
				console.log(`OK  ${display}`);
			} else {
				bad++;
				console.error(`缺失: ${display}\n  解析: ${target}`);
			}
		}
	}
}
console.log(`\n可达 ${ok}，缺失 ${bad}`);
process.exit(bad ? 1 : 0);
