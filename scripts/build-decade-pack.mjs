#!/usr/bin/env node
/**
 * P3：decade Style Pack 构建脚本（部署模式）
 *
 * 用法：
 *   node scripts/build-decade-pack.mjs <目标根>    把仓库内 modules/（含 installed.json）
 *                                                  部署复制到 <目标根>/modules/
 *   pnpm build 会自动对 dist 执行（见 package.json）
 *
 * 仓库根的 modules/decade/<版本>/ 是样式包的**源与本体**（已提交 git）；
 * 一次性迁移（从单体CSS组装包）已在此前完成，如需重做见 git 历史。
 *
 * 边界：仅部署复制，不做任何内容改写；共享资源不随包移动。
 */
import { existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 递归复制（cpSync 在本机触发 Node fail-fast 崩溃，故手工实现） */
function copyDir(src, dest) {
	mkdirSync(dest, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		const s = join(src, entry.name);
		const d = join(dest, entry.name);
		if (entry.isDirectory()) copyDir(s, d);
		else copyFileSync(s, d);
	}
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = resolve(REPO_ROOT, process.argv[2] || ".");
const MODULES_SRC = join(REPO_ROOT, "modules");

if (!existsSync(MODULES_SRC)) {
	console.error("[错误] 仓库内不存在 modules/ 目录（样式包未生成）");
	process.exit(1);
}

copyDir(MODULES_SRC, join(OUT_ROOT, "modules"));
console.log(`样式包已部署: modules/ -> ${join(OUT_ROOT, "modules")}`);
