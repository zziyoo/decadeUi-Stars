/**
 * P22 打包面卫生：整目录复制区垃圾扫描 + 部署形态剪枝（build-output 分支）
 *
 * 背景（2026-10-03 打包面审计）：产物有三条通道——分包 zip（整个 modules/<id>/<version>/）、
 * 整包（dist/ 减 isPackagedFile 排除）、build-output 分支（dist/ 剪枝后整份发布）。审计发现
 * assets/animation/desktop.ini（基线 b4a84b7 随上游源码带入的 Windows 资源管理器配置，262B，
 * 其 [LocalizedFileNames] 指向的三个 SF_zhuangbeipai_eff_renwangdun02.* 早已不存在）随 dist、
 * 整包与 build-output 分支一路出货（七个分包未见同款）。本轮剔除该文件并把"垃圾文件不许进
 * 打包面"钉成门禁：
 *
 *   A. viteStaticCopy 的整目录复制区与模块版本目录不得存在桌面/编辑器垃圾文件——源树扫到即红
 *      （dist、整包、分包、分支全是这些目录的派生）。通配复制的目录（src/config/*.css、
 *      src/features/*.css|txt、ui/{character,lbtn,skill}/skins/*.js）按扩展名过滤，天然不带垃圾，不在扫描面。
 *   B. 部署剪枝 pruneDeployDir 与整包共用同一排除判据（build-release.mjs 的 isPackagedFile）：
 *      沙盒里内部件与 release/ 被移除、对外文档与运行时件保留、重复执行幂等；build.yml 必须
 *      接线到该脚本（源码级断言，防"改回只删 release/"式回归）。
 *
 * 运行：node --import ./tests/helpers/register.mjs tests/p22-package-hygiene.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pruneDeployDir } from "../scripts/prune-deploy.mjs";

const exists = rel => fs.existsSync(rel);
const readText = rel => fs.readFileSync(rel, "utf8");

// ── A. 源树打包面：整目录复制区 + 模块版本目录零垃圾文件（按文件名判，不看目录） ──
{
	/** 与 vite.config.ts 的整目录复制目标一致 */
	const WHOLESALE_ZONES = ["assets", "audio", "image", "ui/assets", "ui/styles", "src/libs", "src/styles", "docs"];
	const JUNK_RULES = [
		[/^desktop\.ini$|^thumbs\.db$|^\.ds_store$/i, "Windows/macOS 目录视图或桌面垃圾"],
		[/^\._/, "macOS 资源分叉残留"],
		[/\.(bak|tmp|orig|swp|swo|log|lnk|url)$/i, "编辑器备份/临时件或快捷方式"],
		[/~$/, "编辑器备份件"],
	];

	const offenders = [];
	const scan = (root, relDir = "") => {
		for (const name of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
			const rel = relDir ? `${relDir}/${name.name}` : name.name;
			if (name.isDirectory()) {
				scan(path.join(root, name.name), rel);
				continue;
			}
			const rule = JUNK_RULES.find(([re]) => re.test(name.name));
			if (rule) offenders.push(`${rel}（${rule[1]}）`);
		}
	};
	for (const zone of WHOLESALE_ZONES) if (exists(zone)) scan(zone);
	// 分包是整目录压缩：模块版本目录同样不许带垃圾
	for (const id of fs.readdirSync("modules").sort()) {
		const idDir = path.join("modules", id);
		if (!fs.statSync(idDir).isDirectory()) continue;
		for (const version of fs.readdirSync(idDir).sort()) {
			if (!/^\d+\.\d+\.\d+/.test(version)) continue;
			const packDir = path.join(idDir, version);
			if (fs.statSync(packDir).isDirectory()) scan(packDir, `modules/${id}/${version}`);
		}
	}
	assert.deepEqual(offenders, [], `打包面（整目录复制区/模块版本目录）存在会被原样打包的垃圾文件：\n${offenders.join("\n")}`);
	console.log(`A ok：${WHOLESALE_ZONES.length} 个整目录复制区 + 模块版本目录零垃圾文件`);
}

// ── B. 部署剪枝：与整包同判据（分支形态 == 整包形态）+ build.yml 接线 ──
{
	const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "decadeui-deploy-"));
	const put = (rel, text = "x") => {
		const full = path.join(sandbox, rel);
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, text);
	};
	const KEEP = [
		"info.json",
		"extension.js",
		"src/styles/card.css",
		"image/character/ns_liuzhang.jpg",
		"docs/extension-readme.md",
		"docs/card-skin-api.md",
		"docs/secret.md",
		"modules/baby/1.5.0/manifest.json",
		"modules/module-index.json",
	];
	const DROP = [
		"README.md", // 总任务书位（整包判据同样排除）
		"docs/PROGRESS.md", // 交接台账
		"docs/modularization-audit.md", // P0 审计
		"docs/superpowers/plans/2026-09-29-p14-final-testing.md", // 计划文档
		"tests/p22-package-hygiene.test.mjs", // 扫描面兜底（dist 里本不该有）
		"release/module-index.json", // 分包产物
		"release/baby-1.5.0.zip",
	];
	for (const rel of [...KEEP, ...DROP]) put(rel);
	const removed = pruneDeployDir(sandbox);
	assert.deepEqual(removed, [...DROP].sort(), "剪枝集必须恰为 内部件 + release/（与整包 isPackagedFile 同判据）");
	for (const rel of KEEP) assert.ok(exists(path.join(sandbox, rel)), `对外/运行时件被误剪：${rel}`);
	for (const rel of DROP) assert.ok(!exists(path.join(sandbox, rel)), `内部件未被剪掉：${rel}`);
	assert.deepEqual(pruneDeployDir(sandbox), [], "重复剪枝必须为空（幂等）");
	fs.rmSync(sandbox, { recursive: true, force: true });

	// 接线断言：部署步骤必须调剪枝脚本，不得回退成只删 release/
	const workflow = readText(".github/workflows/build.yml");
	assert.match(workflow, /node scripts\/prune-deploy\.mjs \/tmp\/deploy/, "部署步骤必须调 scripts/prune-deploy.mjs（与整包同判据剪枝）");
	assert.ok(!/rm -rf \/tmp\/deploy\/release/.test(workflow), "部署步骤不得回退成只删 release/（内部文档会漏进分支）");
	console.log("B ok：部署剪枝与整包同判据（沙盒行为 + 幂等 + build.yml 接线）");
}

console.log("p22-package-hygiene: OK（源树垃圾扫描 + 部署剪枝/接线 两类）");
