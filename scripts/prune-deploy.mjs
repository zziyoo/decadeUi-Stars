#!/usr/bin/env node
/**
 * 部署形态剪枝：把 dist/ 里的内部件剥掉，得到 build-output 分支要发布的内容。
 *
 * 判据不在这里——与整包（zipFullPackage → distFiles）共用 build-release.mjs 的
 * `isPackagedFile`（总任务书位 README.md、交接台账、P0 审计、docs/superpowers/、tests/），
 * 外加 release/（分包 zip 与索引/说明，只走工作流产物）。两处共用一份判据，整包与分支
 * 形态就不会漂移：分支上有什么，整包里就有什么。
 *
 * 用法：node scripts/prune-deploy.mjs <目录>   （就地删除；重复执行幂等）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPackagedFile } from "./build-release.mjs";

/** 移除 root 下所有整包排除件与 release/，返回被移除的 POSIX 相对路径（排序） */
export function pruneDeployDir(root) {
	const removed = [];
	const walk = dir => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			const rel = path.relative(root, full).split(path.sep).join("/");
			if (rel === "release" || rel.startsWith("release/") || !isPackagedFile(rel)) {
				fs.rmSync(full);
				removed.push(rel);
			}
		}
	};
	walk(root);
	return removed.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const target = process.argv[2];
	if (!target) {
		console.error("用法：node scripts/prune-deploy.mjs <目录>（剪掉内部件与 release/，就地删除）");
		process.exitCode = 1;
	} else {
		const dir = path.resolve(target);
		if (!fs.existsSync(dir)) {
			console.error(`[部署剪枝] 目录不存在：${dir}`);
			process.exitCode = 1;
		} else {
			const removed = pruneDeployDir(dir);
			console.log(`[部署剪枝] 移除 ${removed.length} 个内部件（判据 = 整包同源 isPackagedFile + release/）`);
			for (const rel of removed.slice(0, 12)) console.log(`  - ${rel}`);
			if (removed.length > 12) console.log(`  …另有 ${removed.length - 12} 个`);
		}
	}
}
