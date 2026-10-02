/**
 * @fileoverview P9/P10 构建产物：分包 zip + Full Package + module-index.json + Release 说明（任务书§46/§47）
 *
 * 为什么 zip 根必须直接是 manifest.json：安装器 `verifyPackageDir` 就是按"根位 manifest"
 * 认包的（§24），套一层 `<version>/` 目录会直接被 STRUCTURE_INVALID 拒绝。
 * 为什么索引里 url 写裸文件名：同一份 module-index.json 既能指本地 http 服务、也能指
 * GitHub Release 资产，发布地址变了不必重新生成索引——相对解析交给安装器唯一的
 * `resolveModuleUrl(url, indexUrl)`（见 src/core/packageInstaller.js）。远程索引按索引
 * 自身地址解析；内置索引（P19）按索引自带的 `releaseBase` 解析——那是构建期写进索引的
 * 本版 Release 资产目录（带尾斜杠，才能当 URL 基址用），随索引一起发布、随本体一起升级。
 *
 * P10 追加：
 *   - Full Package（`<扩展名>-<版本>-full.zip`）：整份部署形态（Core + 全部包）打一个 zip，
 *     包内根目录是 `<扩展名>/`，玩家解压到 `resources/app/extension/` 即用；
 *   - `RELEASE-NOTES.md`：Release 说明草稿 + 上传清单（每个资产的字节数与 sha256）。
 *
 * P19 追加：同一份索引对象输出三处——`dist/release/`（Release 资产）、
 *   `dist/modules/`（整包内的运行时默认索引）、仓库根 `modules/`（开发态直接加载源码时的
 *   运行时默认索引，已 gitignore）。前两者 = 发布源（GitHub 基址），逐字节一致（verifyIndexCopies）；
 * 2026-10-03 起开发态那份**基址分叉**为本机发布源 `DEV_RELEASE_BASE`（见下），
 *   这样模块源地址留空（内置源）即可全本地装卸，每次构建自动刷新基址与 sha，无需改任何配置。
 *
 * 用法：
 *   node scripts/build-release.mjs            # 生成全部产物并完整校验
 *   node scripts/build-release.mjs --verify   # 只校验已存在的产物（不写盘），供门禁复跑
 *   node scripts/build-release.mjs --list     # 只打印将要打包的包与版本
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { checkCoreRequirement, compareVersions, findMissingResources, validateManifest } from "../src/core/manifest.js";
import { resolveModuleUrl } from "../src/core/packageInstaller.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = path.join(ROOT, "modules");
const DIST_DIR = path.join(ROOT, "dist");
const OUT_DIR = path.join(ROOT, "dist", "release");
const INDEX_FILE = "module-index.json";
/** 运行时内置默认索引（整包内的位置）；与 OUT_DIR 那份同源同字节（P19） */
const RUNTIME_INDEX_PATH = path.join(DIST_DIR, "modules", INDEX_FILE);
/** 开发态运行时内置索引：游戏直接加载仓库根源码，扩展根就是仓库根（P19，已 gitignore） */
const DEV_INDEX_PATH = path.join(MODULES_DIR, INDEX_FILE);
const NOTES_FILE = "RELEASE-NOTES.md";
const CORE_ID = "core";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
/** zip 条目时间戳固定为 ZIP 纪元：否则同样内容每次构建摘要都变，索引无法做差异比对 */
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1));
/** 校验相对 url 时用的样例索引地址（真实索引地址由客户端在 fetchIndex 时给出） */
const SAMPLE_INDEX_URL = "https://example.invalid/module-index.json";
/** Release 页面地址（说明草稿里给玩家填模块源用） */
const REPO_SLUG = "zziyoo/decadeUi-Stars";
/** 整包里 release/ 不参与：那是给装包流程用的分包产物，不是运行时资源 */
const RELEASE_SUBDIR = "release";
/**
 * 整包排除的仓库内部件（其余 docs/ 是原版就有的对外文档，随包发布）：
 * 总任务书、交接台账、P0 审计报告。台账每次会话都在改，打进去会让 112MB 资产的
 * 摘要随文档变动——Release 上的 sha 与后续重建就对不上号了。
 */
/**
 * 整包排除判据：精确路径 + 目录前缀。
 *
 * 原来是一个精确路径 Set —— 那样每新增一份内部文档（P14 的 `tests/modules/*.md`、
 * 计划文档）都会照样打进 112MB 整包，改一个字就 churn 一次整包 sha。
 * 判据只此一处：`distFiles` 与测试都用 `isPackagedFile`，不留第二份。
 */
const PACK_EXCLUDE_FILES = new Set(["README.md", "docs/PROGRESS.md", "docs/modularization-audit.md"]);
const PACK_EXCLUDE_DIRS = ["docs/superpowers/", "tests/"];
export const isPackagedFile = rel => !PACK_EXCLUDE_FILES.has(rel) && !PACK_EXCLUDE_DIRS.some(dir => rel.startsWith(dir));

const VERIFY_ONLY = process.argv.includes("--verify");
const LIST_ONLY = process.argv.includes("--list");

const die = message => {
	console.error(`[P10产物] ${message}`);
	process.exitCode = 1;
	throw new Error(message);
};

const posix = rel => rel.split(path.sep).join("/");

/** 递归列出目录内的文件（相对路径， POSIX 分隔，已排序） */
export function listFiles(dir) {
	const out = [];
	const walk = current => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile()) out.push(posix(path.relative(dir, full)));
		}
	};
	if (fs.existsSync(dir)) walk(dir);
	return out.sort();
}

const listDirs = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : []);

/**
 * 收集可打包的模块：modules/<id>/<version>/manifest.json
 * 同一 id 只取最新语义化版本（索引里每模块一个 latest，与安装器§18 的更新判定同口径）。
 * `.replacing-*` / `.removing-*` 这类事务目录因为不匹配版本号形状而自然被排除。
 */
export function collectPacks(modulesDir = MODULES_DIR) {
	const packs = [];
	for (const id of listDirs(modulesDir).sort()) {
		const versions = listDirs(path.join(modulesDir, id)).filter(v => VERSION_PATTERN.test(v));
		if (!versions.length) continue;
		const version = versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best));
		const dir = path.join(modulesDir, id, version);
		const manifestFile = path.join(dir, "manifest.json");
		if (!fs.existsSync(manifestFile)) continue;
		let manifest;
		try {
			manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
		} catch (error) {
			manifest = null;
			console.warn(`[P10产物] 跳过 ${id}：manifest.json 解析失败 ${error.message}`);
		}
		if (!manifest) continue;
		packs.push({ id, version, dir, manifest, file: `${id}-${version}.zip` });
	}
	return packs;
}

/**
 * 把一个目录打成 zip：条目名是相对源目录的 POSIX 路径，manifest.json 落在根
 * @param {string} srcDir
 * @param {string} outZip
 * @param {Object} [_opts]
 * @returns {Promise<{file: string, bytes: number, sha256: string, files: number}>}
 */
export async function zipDir(srcDir, outZip, _opts = {}) {
	const outAbs = path.resolve(outZip);
	// 输出写在源目录里时不能把自己也打进去（dist 套 dist 的情况真实存在）
	const names = listFiles(srcDir).filter(rel => path.resolve(srcDir, rel) !== outAbs);
	if (!names.length) die(`源目录为空，拒绝产出 ${path.basename(outZip)}：${srcDir}`);

	const zip = new JSZip();
	for (const rel of names) {
		// createFolders:false 很关键：JSZip 默认会为父目录自动补"目录条目"，而那些条目的
		// 时间戳取的是当前时间（DOS 时间 2 秒粒度），于是同一内容两次构建摘要会不同。
		// 我们的解压端口（moduleIo.extract）本来就按文件路径自己建目录，不需要目录条目。
		zip.file(rel, fs.readFileSync(path.join(srcDir, rel)), { date: FIXED_DATE, createFolders: false });
	}
	const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
	fs.mkdirSync(path.dirname(outAbs), { recursive: true });
	fs.writeFileSync(outAbs, buffer);

	const written = fs.readFileSync(outAbs);
	return {
		file: path.basename(outAbs),
		bytes: written.length,
		sha256: crypto.createHash("sha256").update(written).digest("hex"),
		files: names.length,
	};
}

/**
 * Full Package：把 dist/ 打成一个 zip（包内根目录 `<rootName>/`），玩家解压到
 * `resources/app/extension/` 即得一份完整可用的扩展（Core + 全部包都在里面）。
 *
 * 源就是 dist/ 而不是仓库根：vite 已经按部署形态备好了 info.json / extension.js /
 * ui / image / audio / assets / modules，且天然排除 node_modules、scripts、tests 等
 * 开发件——不另立第二份排除表（两份清单迟早会漂移）。`release/` 单独排除：那是分包
 * 产物，不是运行时资源，否则整包会把自己套一层、且每次构建摘要都变。
 *
 * @param {{distDir?: string, outZip: string, rootName: string}} input
 * @returns {Promise<{file: string, bytes: number, sha256: string, files: number}>}
 */
export async function zipFullPackage({ distDir = DIST_DIR, outZip, rootName }) {
	const outAbs = path.resolve(outZip);
	const names = distFiles(distDir);
	if (!names.length) die(`dist 目录为空，无法产出整包：${distDir}（先跑 pnpm build）`);

	const zip = new JSZip();
	for (const rel of names) {
		zip.file(`${rootName}/${rel}`, fs.readFileSync(path.join(distDir, rel)), { date: FIXED_DATE, createFolders: false });
	}
	const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
	fs.mkdirSync(path.dirname(outAbs), { recursive: true });
	fs.writeFileSync(outAbs, buffer);

	const written = fs.readFileSync(outAbs);
	return {
		file: path.basename(outAbs),
		bytes: written.length,
		sha256: crypto.createHash("sha256").update(written).digest("hex"),
		files: names.length,
	};
}

/** dist/ 里参与整包的文件（POSIX 相对路径，已排序）：排除 release/、内部文档与本次输出自身 */
export function distFiles(distDir = DIST_DIR, excludeAbs = null) {
	return listFiles(distDir)
		.filter(rel => rel !== RELEASE_SUBDIR && !rel.startsWith(`${RELEASE_SUBDIR}/`))
		.filter(rel => isPackagedFile(rel))
		.filter(rel => (excludeAbs ? path.resolve(distDir, rel) !== excludeAbs : true));
}

/**
 * Release 说明草稿 + 上传清单（纯函数，可单测）。
 * 资产顺序：整包 → 索引 → 各分包（与 Release 页面上的阅读顺序一致）。
 */
export function buildReleaseNotes({ tag, name, version, coreVersion, index, packs, full, indexAsset }) {
	const rows = [
		`| \`${full.file}\` | ${full.bytes} | \`${full.sha256}\` | 整份扩展（Core + 全部包），解压到 \`resources/app/extension/\` 即用 |`,
		`| \`${indexAsset.file}\` | ${indexAsset.bytes} | \`${indexAsset.sha256}\` | 模块索引（Release 远程索引）。整包内已内置同一份作默认模块源；这份供自定义模块源与外部客户端使用，**必须**上传 |`,
		...packs.map(pack => `| \`${pack.zip.file}\` | ${pack.zip.bytes} | \`${pack.zip.sha256}\` | ${pack.id}@${pack.version} 分包（${pack.manifest.type}） |`),
	];
	return [
		`# ${name} ${tag}`,
		"",
		`模块化版（Stars）${version}，基于无名杀扩展「十周年UI」。**Core 随扩展本体发布**（本仓库源码即本体），`,
		"不在本 Release 的资产里；下面的分包供模块管理窗口按需下载安装。",
		"",
		"## 资产清单（上传后请逐项核对 sha256）",
		"",
		"| 文件 | 字节数 | sha256 | 说明 |",
		"|---|---|---|---|",
		...rows,
		"",
		"## 安装",
		"",
		"1. 下载整包 `" + full.file + "`，解压出的 `" + name + "/` 放进 `无名杀/resources/app/extension/`（目录名可改，`info.json` 在里面就行）；",
		"2. 或者只装本体源码，再在游戏里用模块管理窗口逐个装分包。",
		"",
		"整包不含仓库内部文档（总任务书、交接台账、P0 审计报告），原版的对外文档（extension-readme、各类 API 说明）照旧随包发布。",
		"",
		"## 模块源",
		"",
		"扩展本体自带 `modules/module-index.json`（与本 Release 的索引资产同一份内容），模块管理默认直接使用它：",
		"新装整包后**不填任何地址**即可安装/更新模块；升级扩展后内置索引随本体自动更新，无需改配置。",
		"",
		"若要自定义模块源，在「模块管理」窗口的模块源地址里填远程索引地址（例如本 Release 的）：",
		"",
		"```",
		`https://github.com/${REPO_SLUG}/releases/download/${tag}/${INDEX_FILE}`,
		"```",
		"",
		"点「恢复默认模块源」清除自定义地址，即回到本体内置索引。",
		"",
		`索引里的 url 是裸文件名（如 \`${packs[0]?.zip.file ?? "baby-1.5.0.zip"}\`）：内置索引按索引自带的 \`releaseBase\` 解析，`,
		"远程索引按索引自身地址解析成同目录的绝对地址——所以索引与全部 zip **必须挂在同一个 Release 下**（同一 tag），不要手动编辑索引。",
		"",
		"## 校验",
		"",
		"```",
		"pnpm build && node scripts/build-release.mjs --verify",
		"```",
		"",
		`Core 版本：${coreVersion}；索引 schema：${index.schema}；可安装模块 ${Object.keys(index.modules).length} 个（core 不在其中，属预期）。`,
		"",
	].join("\n");
}

/**
 * 校验整包：根目录、两个入口文件、每个分包的 manifest 都在里面，且条目数与 dist/ 一致
 * @param {{zipPath: string, rootName: string, packs: Array, distDir?: string}} input
 * @returns {Promise<string>} 人类可读的条目
 */
export async function verifyFullPackage({ zipPath, rootName, packs, distDir = DIST_DIR }) {
	if (!fs.existsSync(zipPath)) die(`整包缺失 ${posix(path.relative(ROOT, zipPath))}`);
	const bytes = fs.readFileSync(zipPath);
	const zip = await JSZip.loadAsync(bytes);
	const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);

	for (const rel of ["info.json", "extension.js", `modules/${INDEX_FILE}`]) {
		if (!names.includes(`${rootName}/${rel}`)) die(`整包缺少根位文件 ${rootName}/${rel}`);
	}
	for (const pack of packs) {
		const rel = `${rootName}/modules/${pack.id}/${pack.version}/manifest.json`;
		if (!names.includes(rel)) die(`整包缺少分包清单 ${rel}`);
	}
	if (names.some(name => name.startsWith(`${rootName}/${RELEASE_SUBDIR}/`))) die(`整包不得把 ${RELEASE_SUBDIR}/ 打进去（那是分包产物）`);

	const source = distFiles(distDir);
	if (source.length !== names.length) die(`整包条目数 ${names.length} 与 dist 文件数 ${source.length} 不符`);

	return `整包 ${path.basename(zipPath)}：${names.length} 文件 / ${bytes.length} 字节 / sha256 ${crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12)}…`;
}

/**
 * 由"包 + 已落盘 zip 的信息"生成 module-index.json 的内容（纯函数，可单测）
 * 字段名沿用 §10 与安装器/界面已经在读的名字：latest / url / sha256 / size / dependencies / core。
 * `releaseBase`（P19）是内置索引把裸文件名解析成 Release 资产地址的基址，构建期随版本写入；
 * 远程索引不含它时照旧按索引自身地址解析，互不影响。
 * @param {{packs: Array<{id: string, version: string, manifest: Object, zip: {file: string, bytes: number, sha256: string}}>, coreVersion: string, releaseBase?: string}} input
 * @returns {Object} 索引对象
 */
export function buildIndex({ packs, coreVersion, releaseBase = "" }) {
	const modules = {};
	for (const pack of packs) {
		// Core 本轮无包形态：混进可安装列表会让界面出现一个装不上的 Core
		if (pack.id === CORE_ID || pack.manifest.type === "core") continue;
		modules[pack.id] = {
			name: pack.manifest.name || pack.id,
			type: pack.manifest.type,
			latest: pack.version,
			url: pack.zip.file,
			sha256: pack.zip.sha256,
			size: pack.zip.bytes,
			dependencies: Array.isArray(pack.manifest.dependencies) ? pack.manifest.dependencies : [],
			core: pack.manifest.core,
			capabilities: Array.isArray(pack.manifest.capabilities) ? pack.manifest.capabilities : [],
		};
	}
	return { schema: 1, core: { version: coreVersion, latest: coreVersion }, releaseBase, modules };
}

const sha256hex = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

/** Release tag：与上游同号（两个发行物靠扩展身份区分，玩家看版本号即可对上） */
export const releaseTag = version => `v${version}`;

/**
 * 内置索引（P19）的下载基址：本版 Release 的资产目录。**必须带尾斜杠**——
 * `new URL("decade-1.5.0.zip", base)` 只有在 base 以 `/` 结尾时才把最后一段当目录。
 * 随索引生成、随本体升级，不设任何持久化配置（没有第二套 URL 配置）。
 */
export const releaseBaseFor = version => `https://github.com/${REPO_SLUG}/releases/download/${releaseTag(version)}/`;

/**
 * 开发态内置索引的下载基址：仓库根 `modules/module-index.json` 是"游戏直接加载仓库源码"时
 * 的内置源（模块源地址留空即用它），基址指向**本机发布源**（`tmp/dev-release-server.mjs` 伺服
 * `dist/release/`）而不是 GitHub——本地装卸的索引与 zip 天然同源，构建后无需改任何配置。
 * 端口被占可用环境变量覆盖；它只影响这份 gitignore 的开发文件，不随任何发布物出厂。
 */
export const DEV_RELEASE_BASE = process.env.DECADEUI_DEV_RELEASE_BASE || "http://127.0.0.1:8099/";

/** 扩展名与版本只认 info.json（不设第二版本源） */
const readExtInfo = () => {
	const info = JSON.parse(fs.readFileSync(path.join(ROOT, "info.json"), "utf8"));
	return { name: info.name || "十周年UI-Stars", version: info.version || "0.0.0" };
};

const indexText = obj => JSON.stringify(obj, null, "\t") + "\n";

// ------------------------------------------------------------------ 校验（任务书§46"并进行完整校验"）

/**
 * 校验产物：任何一项不符都直接失败，不做"警告着通过"
 * @param {{packs: Array, index: Object, coreVersion: string, outDir?: string}} input
 * @returns {Promise<string[]>} 通过时返回人类可读的条目
 */
export async function verifyArtifacts({ packs, index, coreVersion, outDir = OUT_DIR }) {
	const notes = [];
	const fail = message => die(`${message}`);

	if (index.schema !== 1) fail(`索引 schema 必须为 1，实际 ${index.schema}`);
	if (!index.modules || !Object.keys(index.modules).length) fail("索引里没有任何可安装模块");
	if (index.modules[CORE_ID]) fail("索引不得把 core 列为可安装模块");
	// P19：内置默认模块源把裸文件名解析成 Release 资产地址，靠的就是这个构建期写入的基址
	if (typeof index.releaseBase !== "string" || !/^https:\/\/.+\/$/.test(index.releaseBase)) {
		fail(`索引缺少合法的 releaseBase（内置索引按它解析下载地址，必须是以 / 结尾的 https 绝对地址），实际 ${JSON.stringify(index.releaseBase ?? null)}`);
	}

	for (const pack of packs) {
		const entry = index.modules[pack.id];
		if (!entry) fail(`索引缺少 ${pack.id}`);
		if (entry.latest !== pack.version) fail(`${pack.id}：索引 latest=${entry.latest} 与盘上版本 ${pack.version} 不一致`);
		if (entry.url !== pack.file) fail(`${pack.id}：索引 url=${entry.url} 期望 ${pack.file}`);

		const resolved = resolveModuleUrl(entry.url, SAMPLE_INDEX_URL);
		if (!/^https?:\/\//.test(resolved) || !resolved.endsWith(`/${entry.url}`)) {
			fail(`${pack.id}：相对 url 解析不出可下载地址（${entry.url} → ${resolved}）`);
		}
		// 内置索引路径（P19）也要走一遍解析：releaseBase 必须真能把裸文件名变成资产地址
		const builtinResolved = resolveModuleUrl(entry.url, index.releaseBase);
		if (!/^https?:\/\//.test(builtinResolved) || !builtinResolved.endsWith(`/${entry.url}`)) {
			fail(`${pack.id}：按 releaseBase 解析不出可下载地址（${entry.url} → ${builtinResolved}）`);
		}
		const compat = checkCoreRequirement(entry.core, coreVersion);
		if (!compat.ok) fail(`${pack.id}：与当前 Core ${coreVersion} 不兼容（${compat.message}）`);

		const zipPath = path.join(outDir, entry.url);
		if (!fs.existsSync(zipPath)) fail(`${pack.id}：产物缺失 ${posix(path.relative(ROOT, zipPath))}`);
		const bytes = fs.readFileSync(zipPath);
		const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
		if (sha256 !== entry.sha256) fail(`${pack.id}：索引摘要与 zip 实际内容不符（索引 ${entry.sha256.slice(0, 12)}… 实际 ${sha256.slice(0, 12)}…）`);
		if (bytes.length !== entry.size) fail(`${pack.id}：索引 size=${entry.size} 与 zip 实际字节 ${bytes.length} 不符`);

		const zip = await JSZip.loadAsync(bytes);
		const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
		if (!names.includes("manifest.json")) fail(`${pack.id}：manifest.json 不在 zip 根（安装器§24 会直接拒收）`);
		const packed = JSON.parse(await zip.file("manifest.json").async("string"));
		const checked = validateManifest(packed);
		if (!checked.ok) fail(`${pack.id}：包内 manifest 校验失败 ${checked.errors.join("；")}`);
		if (packed.id !== pack.id) fail(`${pack.id}：包内 manifest.id=${packed.id} 与目标不一致`);
		if (packed.version !== pack.version) fail(`${pack.id}：包内 manifest.version=${packed.version} 与目标不一致`);

		const source = listFiles(pack.dir);
		if (source.length !== names.length) fail(`${pack.id}：zip 条目数 ${names.length} 与源目录文件数 ${source.length} 不符`);
		for (const rel of source) {
			if (!names.includes(rel)) fail(`${pack.id}：zip 缺少源目录里的 ${rel}`);
		}

		// 清单声明的入口文件必须真在包里（§24 的运行前置）
		for (const kind of ["js", "css"]) {
			for (const rel of Array.isArray(packed.entry?.[kind]) ? packed.entry[kind] : []) {
				if (!names.includes(rel)) fail(`${pack.id}：manifest.entry.${kind} 声明的 ${rel} 不在包里`);
			}
		}

		// 资源边界声明必须可达（资源热插拔）：缺资源却放行，等于把"CSS 在而图 404"的损坏包
		// 发给玩家。与 verify-pack / 安装器共用 manifest.findMissingResources 一套语义。
		if (Array.isArray(packed.resources)) {
			const missingResources = findMissingResources(packed.resources, names);
			if (missingResources.length) fail(`${pack.id}：manifest.resources 声明的资源缺失：${missingResources.join("、")}`);
			notes.push(`${pack.id}：resources 声明 ${packed.resources.length} 项全部可达`);
		}

		// card-skin 这类数据包：按 manifest 自己声明的数量快照逐套核对
		if (Array.isArray(packed.cardSkins)) {
			for (const set of packed.cardSkins) {
				const prefix = `image/card-skins/${set.dir}/`;
				const inZip = names.filter(name => name.startsWith(prefix) && !name.slice(prefix.length).includes("/")).length;
				if (inZip !== set.files) fail(`${pack.id}：皮肤套 ${set.dir} 包内 ${inZip} 个文件，manifest 记的是 ${set.files}`);
			}
			notes.push(`${pack.id}：${packed.cardSkins.length} 套皮肤数量逐套核对`);
		}
		notes.push(`${pack.id}：${names.length} 文件 / ${entry.size} 字节 / sha256 ${entry.sha256.slice(0, 12)}…`);
	}

	const extra = Object.keys(index.modules).filter(id => !packs.some(p => p.id === id));
	if (extra.length) fail(`索引里有盘上不存在的产品条目：${extra.join("、")}`);
	return notes;
}

/**
 * module-index 基准与其副本必须逐字节一致（发布源两份：Release 资产 / 整包内运行时索引）：
 * 同一构建里只许有一份生成逻辑，pretty-print/换行/BOM 的任何差异都算不一致（Buffer.equals 语义）。
 * 开发态那份基址分叉（DEV_RELEASE_BASE），由 verifyAll 单独重建比对。
 * 导出供单测；构建与 --verify 共用同一条判据。
 * @param {string} indexPath - 基准：dist/release/module-index.json
 * @param {string[]} copyPaths - 副本的绝对路径（dist/modules/…）
 * @returns {string} 通过时的说明行
 */
export function verifyIndexCopies(indexPath, copyPaths) {
	if (!fs.existsSync(indexPath)) die(`需要产物存在：${posix(path.relative(ROOT, indexPath))}（重新跑一次构建）`);
	const reference = fs.readFileSync(indexPath);
	for (const copyPath of copyPaths) {
		const rel = posix(path.relative(ROOT, copyPath));
		if (!fs.existsSync(copyPath)) die(`需要产物存在：${rel}（重新跑一次构建）`);
		if (!fs.readFileSync(copyPath).equals(reference)) {
			die(`${rel} 与 dist/release/${INDEX_FILE} 不一致（发布源各份必须来自同一次 buildIndex 的同一字符串）`);
		}
	}
	return `${INDEX_FILE} 逐字节一致（${[indexPath, ...copyPaths].map(p => posix(path.relative(ROOT, p))).join("、")}）`;
}

// ------------------------------------------------------------------ 命令行入口

/** 给包补上"已落盘 zip"的实际字节数与摘要（--verify 时由盘上重算，不信任索引里的自述） */
const withZipInfo = packs => packs.map(pack => {
	const bytes = fs.readFileSync(path.join(OUT_DIR, pack.file));
	return { ...pack, zip: { file: pack.file, bytes: bytes.length, sha256: sha256hex(bytes) } };
});

/**
 * 完整校验（构建与 --verify 共用同一套规则）：分包 → 索引 → 整包 → 说明文件。
 * 说明文件按"由盘上产物重算"逐字节比对，手改过就会被抓住。
 */
async function verifyAll({ info, packs }) {
	const indexPath = path.join(OUT_DIR, INDEX_FILE);
	if (!fs.existsSync(indexPath)) die(`需要产物存在：${posix(path.relative(ROOT, indexPath))}`);
	const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
	const zipped = withZipInfo(packs);

	const notes = await verifyArtifacts({ packs: zipped, index, coreVersion: info.version });
	const rebuilt = buildIndex({ packs: zipped, coreVersion: info.version, releaseBase: releaseBaseFor(info.version) });
	if (indexText(rebuilt) !== fs.readFileSync(indexPath, "utf8")) die(`${INDEX_FILE} 与盘上产物重算结果不一致（重新跑一次构建）`);

	// P19：发布源两份（Release 资产 / 整包内运行时索引）逐字节一致；开发态那份按
	// "同一生成逻辑、基址为本机发布源"重建比对（2026-10-03 起基址分叉，见 DEV_RELEASE_BASE）。
	const indexNote = verifyIndexCopies(indexPath, [RUNTIME_INDEX_PATH]);
	const devExpected = indexText(buildIndex({ packs: zipped, coreVersion: info.version, releaseBase: DEV_RELEASE_BASE }));
	if (!fs.existsSync(DEV_INDEX_PATH)) die(`需要产物存在：${posix(path.relative(ROOT, DEV_INDEX_PATH))}（重新跑一次构建）`);
	if (fs.readFileSync(DEV_INDEX_PATH, "utf8") !== devExpected) {
		die(`modules/${INDEX_FILE} 与"本机源基址 ${DEV_RELEASE_BASE}"的重算结果不一致（重新跑一次构建）`);
	}

	const fullPath = path.join(OUT_DIR, `${info.name}-${info.version}-full.zip`);
	const fullNote = await verifyFullPackage({ zipPath: fullPath, rootName: info.name, packs: zipped });

	const indexBytes = fs.readFileSync(indexPath);
	const fullBytes = fs.readFileSync(fullPath);
	const expectNotes = buildReleaseNotes({
		tag: releaseTag(info.version),
		name: info.name,
		version: info.version,
		coreVersion: info.version,
		index,
		packs: zipped,
		full: { file: path.basename(fullPath), bytes: fullBytes.length, sha256: sha256hex(fullBytes) },
		indexAsset: { file: INDEX_FILE, bytes: indexBytes.length, sha256: sha256hex(indexBytes) },
	});
	const notesPath = path.join(OUT_DIR, NOTES_FILE);
	if (!fs.existsSync(notesPath) || fs.readFileSync(notesPath, "utf8") !== expectNotes) {
		die(`${NOTES_FILE} 与盘上产物重算结果不一致（重新跑一次构建，别手改它）`);
	}
	return [...notes, indexNote, `${INDEX_FILE}（开发态）：本机源基址 ${DEV_RELEASE_BASE} 与重算一致`, fullNote, `${NOTES_FILE} 与产物一致（含 ${zipped.length + 2} 项资产的字节数与 sha256）`];
}

async function main() {
	const info = readExtInfo();
	const coreVersion = info.version;
	const packs = collectPacks();
	if (!packs.length) die("modules/ 下没有找到任何可打包的模块版本目录");

	if (LIST_ONLY) {
		for (const pack of packs) console.log(`${pack.id}@${pack.version} → ${pack.file}`);
		console.log(`${info.name}@${info.version} → ${info.name}-${info.version}-full.zip（整包）`);
		return;
	}

	if (VERIFY_ONLY) {
		const notes = await verifyAll({ info, packs });
		console.log(`[P10产物] 校验通过：${packs.length} 个包 + 整包 + 索引 + 说明`);
		for (const note of notes) console.log(`  ${note}`);
		return;
	}

	fs.mkdirSync(OUT_DIR, { recursive: true });
	const zipped = [];
	for (const pack of packs) {
		const zipInfo = await zipDir(pack.dir, path.join(OUT_DIR, pack.file));
		zipped.push({ ...pack, zip: zipInfo });
		console.log(`  ${pack.id}@${pack.version} → ${zipInfo.file}（${zipInfo.files} 文件 / ${zipInfo.bytes} 字节）`);
	}
	const index = buildIndex({ packs: zipped, coreVersion, releaseBase: releaseBaseFor(info.version) });
	// 发布源两份（Release 资产 / 整包内运行时索引）同一字符串；开发态那份基址为本机发布源（P19 + 2026-10-03）。
	// 整包此刻还没打，dist/modules/ 这份会被自然打进去。
	const text = indexText(index);
	fs.writeFileSync(path.join(OUT_DIR, INDEX_FILE), text);
	fs.mkdirSync(path.dirname(RUNTIME_INDEX_PATH), { recursive: true });
	fs.writeFileSync(RUNTIME_INDEX_PATH, text);
	const devText = indexText(buildIndex({ packs: zipped, coreVersion, releaseBase: DEV_RELEASE_BASE }));
	fs.mkdirSync(path.dirname(DEV_INDEX_PATH), { recursive: true });
	fs.writeFileSync(DEV_INDEX_PATH, devText);
	console.log(`  ${INDEX_FILE}：${Object.keys(index.modules).length} 个可安装模块（core 除外）；发布源 → dist/release 与 dist/modules，本地源（${DEV_RELEASE_BASE}）→ modules/`);

	// 整包与说明：整包只吃 dist/（除 release/），说明紧随其后写（它也落在 release/ 里，不进整包）
	const full = await zipFullPackage({ outZip: path.join(OUT_DIR, `${info.name}-${info.version}-full.zip`), rootName: info.name });
	console.log(`  整包 → ${full.file}（${full.files} 文件 / ${full.bytes} 字节）`);
	const indexBytes = fs.readFileSync(path.join(OUT_DIR, INDEX_FILE));
	fs.writeFileSync(
		path.join(OUT_DIR, NOTES_FILE),
		buildReleaseNotes({
			tag: releaseTag(info.version),
			name: info.name,
			version: info.version,
			coreVersion,
			index,
			packs: zipped,
			full,
			indexAsset: { file: INDEX_FILE, bytes: indexBytes.length, sha256: sha256hex(indexBytes) },
		})
	);
	console.log(`  ${NOTES_FILE}：Release 说明 + 上传清单（${zipped.length + 2} 项资产）`);

	const notes = await verifyAll({ info, packs });
	console.log(`[P10产物] 生成并校验通过：${packs.length} 个包 + 整包 + 索引 + 说明`);
	for (const note of notes) console.log(`  ${note}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(error => {
		console.error(`[P10产物] 失败：${error?.message ?? error}`);
		process.exitCode = 1;
	});
}
