/**
 * P10 构建产物测试：Full Package 打包/校验、Release 说明（上传清单）、GitHub Release 形状的地址解析。
 *
 * 这些是构建脚本里的纯函数与打包工具，全部在临时目录上跑，不碰仓库产物。
 * 注意：负例走的是脚本里的 `die()`——它会 `process.exitCode = 1`，所以每个负例后用
 * `process.exitCode = 0` 复位，否则测试进程会以非零码退出（这正是它在 CLI 里该有的行为）。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";

const mod = await import("../scripts/build-release.mjs");
const { resolveModuleUrl } = await import("../src/core/packageInstaller.js");

const sha = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

// 一个自足的临时沙盒：dist/ 下有部署形态的文件 + 一个 release/ 子目录（不该进整包）
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "p10-release-"));
const distDir = path.join(sandbox, "dist");
const outDir = path.join(distDir, "release");
fs.mkdirSync(path.join(distDir, "src"), { recursive: true });
fs.mkdirSync(path.join(distDir, "ui", "styles"), { recursive: true });
fs.writeFileSync(path.join(distDir, "info.json"), JSON.stringify({ name: "十周年UI-Stars", version: "1.4.2" }));
fs.writeFileSync(path.join(distDir, "extension.js"), "export default {};\n");
fs.writeFileSync(path.join(distDir, "src", "main.js"), "export const a = 1;\n");
fs.writeFileSync(path.join(distDir, "ui", "styles", "base.css"), "body{}\n");
fs.mkdirSync(path.join(distDir, "modules", "baby", "1.4.2"), { recursive: true });
fs.writeFileSync(path.join(distDir, "modules", "baby", "1.4.2", "manifest.json"), JSON.stringify({ id: "baby", version: "1.4.2" }));
// P19：运行时内置默认索引是 dist 的正式成员（verifyFullPackage 会对整包硬校验它）
fs.writeFileSync(path.join(distDir, "modules", "module-index.json"), "{}\n");
// 内部件（整包必须排除）与对外文档（整包必须保留）各来一份
fs.writeFileSync(path.join(distDir, "README.md"), "# 总任务书\n");
fs.mkdirSync(path.join(distDir, "docs"), { recursive: true });
fs.writeFileSync(path.join(distDir, "docs", "PROGRESS.md"), "# 交接台账\n");
fs.writeFileSync(path.join(distDir, "docs", "modularization-audit.md"), "# P0 审计\n");
fs.writeFileSync(path.join(distDir, "docs", "extension-readme.md"), "# 扩展说明（对外）\n");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "module-index.json"), "{}\n");
fs.writeFileSync(path.join(outDir, "baby-1.4.2.zip"), "not a real zip");

const packs = [
	{ id: "baby", version: "1.4.2", manifest: { id: "baby", version: "1.4.2", type: "style", name: "欢乐三国杀样式" }, file: "baby-1.4.2.zip" },
];

// ---------------------------------------------------------------- 整包打包

{
	const outZip = path.join(outDir, "十周年UI-Stars-1.4.2-full.zip");
	const info = await mod.zipFullPackage({ distDir, outZip, rootName: "十周年UI-Stars" });
	const zip = await JSZip.loadAsync(fs.readFileSync(outZip));
	const names = Object.keys(zip.files).filter(name => !zip.files[name].dir).sort();

	assert.deepEqual(
		names,
		[
			"docs/extension-readme.md",
			"extension.js",
			"info.json",
			"modules/baby/1.4.2/manifest.json",
			"modules/module-index.json",
			"src/main.js",
			"ui/styles/base.css",
		],
		"整包条目名必须逐条等于 dist/ 的相对路径（同原版 `cd dist && zip … .`，不套外层根目录）"
	);
	// 原版结构对照不变量：条目集合逐条等于 distFiles(distDir)，且不得再出现人为根目录前缀
	assert.deepEqual(names, mod.distFiles(distDir), "整包条目集合必须等于 distFiles(distDir)");
	assert.equal(names.some(name => name.startsWith("十周年UI-Stars/")), false, "整包不得套扩展名根目录（导入端显示乱码）");
	assert.equal(names.some(name => name.startsWith("release/")), false, "release/ 是分包产物，不进整包");
	assert.equal(names.includes("README.md"), false, "总任务书是内部件，不进整包");
	assert.equal(names.includes("docs/PROGRESS.md"), false, "交接台账不进整包（否则改台账就变摘要）");
	assert.equal(names.includes("docs/modularization-audit.md"), false, "P0 审计报告是内部件，不进整包");
	assert.equal(names.includes("docs/extension-readme.md"), true, "原版对外文档要保留");
	assert.equal(names.includes("modules/module-index.json"), true, "内置默认模块索引必须随整包发布（P19）");
	assert.equal(names.some(name => name.endsWith("/")), false, "不写目录条目（否则摘要会随构建时间变）");
	assert.equal(info.files, 7);
	assert.equal(info.bytes, fs.readFileSync(outZip).length);
	assert.equal(info.sha256, sha(fs.readFileSync(outZip)));

	// 确定性：同样内容两次打包必须逐字节一致
	const again = await mod.zipFullPackage({ distDir, outZip: path.join(outDir, "again.zip"), rootName: "十周年UI-Stars" });
	assert.equal(again.sha256, info.sha256, "两次打包摘要必须一致");
	fs.rmSync(path.join(outDir, "again.zip"));
}

{
	// distFiles：排除 release/ 与内部文档，并排除指定的输出文件自身
	const files = mod.distFiles(distDir);
	assert.equal(files.some(rel => rel.startsWith("release/")), false);
	assert.equal(files.includes("README.md"), false, "总任务书不进整包");
	assert.equal(files.includes("docs/PROGRESS.md"), false, "交接台账不进整包");
	assert.equal(files.includes("docs/modularization-audit.md"), false, "审计报告不进整包");
	assert.equal(files.includes("docs/extension-readme.md"), true, "对外文档保留");
	const excluded = mod.distFiles(distDir, path.resolve(distDir, "info.json"));
	assert.equal(excluded.includes("info.json"), false, "输出文件若落在 dist 内不能自我包含");
}

// ---------------------------------------------------------------- 整包校验（负例与正例）

{
	const fullPath = path.join(outDir, "十周年UI-Stars-1.4.2-full.zip");
	const note = await mod.verifyFullPackage({ zipPath: fullPath, rootName: "十周年UI-Stars", packs, distDir });
	assert.match(note, /7 文件/);

	const expectDie = async (label, mutate, pattern) => {
		const target = path.join(sandbox, `${label}.zip`);
		fs.copyFileSync(fullPath, target);
		await mutate(target);
		let error = null;
		try {
			await mod.verifyFullPackage({ zipPath: target, rootName: "十周年UI-Stars", packs, distDir });
		} catch (caught) {
			error = caught;
		}
		assert.ok(error, `${label}：应当校验失败`);
		assert.match(String(error.message), pattern, `${label}：失败原因要能说清哪里不符，实际 ${error?.message}`);
		process.exitCode = 0;   // die() 会把退出码置 1，负例跑完复位，别污染测试进程
		fs.rmSync(target);
	};

	// ① 少了根位文件
	await expectDie("缺少 info", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		delete zip.files["info.json"];
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /缺少根位文件/);

	// ② 少了分包清单
	await expectDie("缺少分包", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		delete zip.files["modules/baby/1.4.2/manifest.json"];
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /缺少分包清单/);

	// ②b 少了内置默认模块索引（P19 硬校验：整包必须能开箱即用默认模块源）
	await expectDie("缺少内置索引", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		delete zip.files["modules/module-index.json"];
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /缺少根位文件 modules\/module-index\.json/);

	// ③ 把 release/ 打进去
	await expectDie("混入 release", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		zip.file("release/module-index.json", "{}", { date: new Date(Date.UTC(1980, 0, 1)), createFolders: false });
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /不得把 release\//);

	// ④ 多塞一个 dist 里没有的文件（条目数不符）
	await expectDie("多余条目", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		zip.file("偷渡.txt", "x", { date: new Date(Date.UTC(1980, 0, 1)), createFolders: false });
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /条目数/);

	// ⑤ 整包被重新套一层根目录（历史回归：曾用 <扩展名>/ 前缀，导入端中文根目录乱码）
	await expectDie("重加根目录", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		const wrapped = new JSZip();
		for (const [name, file] of Object.entries(zip.files)) {
			if (file.dir) continue;
			wrapped.file(`十周年UI-Stars/${name}`, await file.async("nodebuffer"), { date: new Date(Date.UTC(1980, 0, 1)), createFolders: false });
		}
		fs.writeFileSync(target, await wrapped.generateAsync({ type: "nodebuffer" }));
	}, /包在 十周年UI-Stars\/ 之下/);

	// ⑥ 条目数不变但名字被改（集合与 dist 不再逐条一致）
	await expectDie("改名条目", async target => {
		const zip = await JSZip.loadAsync(fs.readFileSync(target));
		const moved = await zip.file("src/main.js").async("nodebuffer");
		delete zip.files["src/main.js"];
		zip.file("src/renamed.js", moved, { date: new Date(Date.UTC(1980, 0, 1)), createFolders: false });
		fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
	}, /不一致/);
}

// ---------------------------------------------------------------- Release 说明（上传清单）

{
	const full = { file: "十周年UI-Stars-1.4.2-full.zip", bytes: 12345678, sha256: "a".repeat(64) };
	const indexAsset = { file: "module-index.json", bytes: 2452, sha256: "b".repeat(64) };
	const zipped = [{ ...packs[0], zip: { file: "baby-1.4.2.zip", bytes: 112079, sha256: "c".repeat(64) } }];
	const notes = mod.buildReleaseNotes({
		tag: mod.releaseTag("1.4.2"),
		name: "十周年UI-Stars",
		version: "1.4.2",
		coreVersion: "1.4.2",
		index: { schema: 1, core: { version: "1.4.2", latest: "1.4.2" }, modules: { baby: {} } },
		packs: zipped,
		full,
		indexAsset,
	});

	assert.equal(mod.releaseTag("1.4.2"), "v1.4.2", "tag 与上游同号：两个发行物靠扩展身份区分，不加分支后缀");
	assert.match(notes, /^# 十周年UI-Stars v1\.4\.2\b/, "标题行用的就是不带后缀的 tag");
	assert.match(notes, /Core 随扩展本体发布/);
	assert.match(notes, /https:\/\/github\.com\/zziyoo\/decadeUi-Stars\/releases\/download\/v1\.4\.2\/module-index\.json/);
	for (const asset of [full, indexAsset, zipped[0].zip]) {
		assert.ok(notes.includes(asset.file), `清单必须列出 ${asset.file}`);
		assert.ok(notes.includes(asset.sha256), `清单必须给出 ${asset.file} 的 sha256`);
		assert.ok(notes.includes(String(asset.bytes)), `清单必须给出 ${asset.file} 的字节数`);
	}
	assert.match(notes, /node scripts\/build-release\.mjs --verify/, "要写上校验命令");
	assert.match(notes, /整包不含仓库内部文档/, "要说明整包排除了哪些内部件");
	// 表格行不许被内容里的竖线撑坏（本文件所有表格行都是 5 个竖线）
	for (const line of notes.split("\n").filter(text => text.startsWith("| `"))) {
		assert.equal(line.split("|").length - 1, 5, `表格行列数不对：${line.slice(0, 60)}`);
	}
}

// ---------------------------------------------------------------- GitHub Release 形状的地址解析

{
	const base = "https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2/module-index.json";
	assert.equal(
		resolveModuleUrl("baby-1.4.2.zip", base),
		"https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2/baby-1.4.2.zip",
		"裸文件名必须能按索引地址解析成同一个 Release 下的资产地址"
	);
	assert.equal(
		resolveModuleUrl("十周年UI-Stars-1.4.2-full.zip", base),
		"https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2/%E5%8D%81%E5%91%A8%E5%B9%B4UI-Stars-1.4.2-full.zip",
		"非 ASCII 资产名会被 URL 规范百分号编码——这是正确行为，fetch 时 GitHub 自行解码"
	);
	assert.equal(mod.releaseTag("1.4.2"), "v1.4.2");
}

{
	// 整包不得夹带内部文档：精确路径与目录前缀两种都要挡。
	// 为什么要判据化：排除表原本是"精确路径 Set"，P14 新增的 tests/modules/*.md 与
	// docs/superpowers/plans/*.md 会照样打进 112MB 整包 —— 每改一次文档就 churn 一次整包 sha。
	for (const rel of [
		"README.md",
		"docs/PROGRESS.md",
		"docs/modularization-audit.md",
		"docs/superpowers/plans/2026-09-29-p14-final-testing.md",
		"tests/modules/mobile.md",
		"tests/p14-module-tables.test.mjs",
	]) {
		assert.equal(mod.isPackagedFile(rel), false, `内部文档不该进整包：${rel}`);
	}
	for (const rel of ["info.json", "extension.js", "src/content.js", "modules/installed.json", "image/card-skins/.gitkeep", "ui/lbtn/base.js"]) {
		assert.equal(mod.isPackagedFile(rel), true, `玩家要用的文件被误排了：${rel}`);
	}
	// distFiles 必须真的用上这条判据（否则排除表改了也白改）
	fs.mkdirSync(path.join(distDir, "tests", "modules"), { recursive: true });
	fs.writeFileSync(path.join(distDir, "tests", "modules", "mobile.md"), "# mobile\n");
	fs.writeFileSync(path.join(distDir, "tests", "p14.test.mjs"), "//\n");
	const listed = mod.distFiles(distDir);
	assert.equal(listed.some(rel => rel.startsWith("tests/")), false, "distFiles 仍把 tests/ 打进整包");
	assert.ok(listed.includes("info.json"), "distFiles 不该把玩家文件也剔掉");
	fs.rmSync(path.join(distDir, "tests"), { recursive: true, force: true });
}

// ---------------------------------------------------------------- module-index 一致性（发布源两份一致 + 开发态基址分叉）

{
	const idxDir = fs.mkdtempSync(path.join(os.tmpdir(), "p10-index-"));
	const ref = path.join(idxDir, "release-module-index.json");
	const runtime = path.join(idxDir, "runtime-module-index.json");
	const dev = path.join(idxDir, "dev-module-index.json");

	// 正例：三份逐字节一致（同一构建里只许有一份生成逻辑）
	for (const file of [ref, runtime, dev]) fs.writeFileSync(file, '{"schema":1}\n');
	assert.match(mod.verifyIndexCopies(ref, [runtime, dev]), /逐字节一致/, "三份一致时应回报说明行");

	// 负例 1：副本只多一个换行也算不一致（Buffer.equals 语义：pretty-print/BOM 差异一样抓）
	let error = null;
	fs.writeFileSync(dev, '{"schema":1}\n\n');
	try {
		mod.verifyIndexCopies(ref, [runtime, dev]);
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, "副本不一致必须失败（换行差异也算）");
	assert.match(String(error.message), /不一致/, `失败原因要点名不一致，实际 ${error?.message}`);
	process.exitCode = 0; // die() 会置 1，负例后复位
	fs.writeFileSync(dev, '{"schema":1}\n');

	// 负例 2：副本缺失 → 点名"需要产物存在"
	fs.rmSync(runtime);
	error = null;
	try {
		mod.verifyIndexCopies(ref, [runtime, dev]);
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, "副本缺失必须失败");
	assert.match(String(error.message), /需要产物存在/, `缺失必须点名文件，实际 ${error?.message}`);
	process.exitCode = 0;
	fs.writeFileSync(runtime, '{"schema":1}\n');

	// 负例 3：基准缺失 → 同样拒绝
	fs.rmSync(ref);
	error = null;
	try {
		mod.verifyIndexCopies(ref, [runtime, dev]);
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, "基准缺失必须失败");
	assert.match(String(error.message), /需要产物存在/);
	process.exitCode = 0;

	fs.rmSync(idxDir, { recursive: true, force: true });
}

{
	// 接线不变量：发布源两份逐字节比对 + 开发态那份按 DEV_RELEASE_BASE 重建比对
	// （抽出来不接上等于白写）；静态扫描源码，与"distFiles 必须用上 isPackagedFile"同法。
	const scriptSrc = fs.readFileSync(new URL("../scripts/build-release.mjs", import.meta.url), "utf8");
	assert.match(scriptSrc, /verifyIndexCopies\(indexPath,\s*\[RUNTIME_INDEX_PATH\]/, "verifyAll 必须把发布源两份（release/dist.modules）送进逐字节一致性检查");
	assert.match(scriptSrc, /buildIndex\(\{ packs: zipped, coreVersion: info\.version, releaseBase: DEV_RELEASE_BASE \}\)/, "开发态索引必须按 DEV_RELEASE_BASE 重建比对");
	assert.match(scriptSrc, /fs\.writeFileSync\(DEV_INDEX_PATH, devText\)/, "开发态索引写出必须是带本机基址的 devText，不许与发布源共用同一字符串");
	assert.match(scriptSrc, /http:\/\/127\.0\.0\.1:8099\//, "DEV_RELEASE_BASE 默认值应指向本机发布源 8099");
}

fs.rmSync(sandbox, { recursive: true, force: true });
console.log("P10 release tests: all passed ✓");
