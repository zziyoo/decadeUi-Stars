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
let knownDead = 0;
/**
 * 上游已知的死引用（原版 css 引用了仓库中不存在的资源，行为=404）。
 * 迁移包内指针已修正为与原版相同的解析目标，故仅告警不判失败。
 */
const KNOWN_DEAD = new Set(["ui/assets/character/shizhounian/dialog3.png"]);
for (const rel of CSS_FILES) {
	const cssPath = join(ROOT, rel);
	const css = readFileSync(cssPath, "utf8");
	const dir = dirname(cssPath);
	const refs = css.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g) || [];
	for (const m of refs) {
		const ref = m.replace(/^url\(\s*(['"]?)/, "").replace(/(['"]?)\s*\)$/, "").trim();
		if (ref.startsWith("#") || ref.startsWith("data:")) continue;
		const abs = resolve(dir, ref);
		const rootRef = relative(ROOT, abs).split("\\").join("/");
		if (existsSync(abs)) {
			ok++;
		} else if (KNOWN_DEAD.has(rootRef)) {
			knownDead++;
			console.warn(`已知上游死引用（指针正确）: ${rel} -> ${rootRef}`);
		} else {
			bad++;
			console.error(`缺失: ${rel} -> ${ref}\n  解析: ${abs}`);
		}
	}
	console.log(`${rel}: 引用计毕`);
}
console.log(`\n可达 ${ok}，已知上游死引用 ${knownDead}，未知缺失 ${bad}`);
process.exit(bad ? 1 : 0);
