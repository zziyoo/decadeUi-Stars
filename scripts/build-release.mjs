/**
 * @fileoverview P9 构建产物：分包 zip + module-index.json + 完整校验（任务书§46）
 *
 * 为什么 zip 根必须直接是 manifest.json：安装器 `verifyPackageDir` 就是按"根位 manifest"
 * 认包的（§24），套一层 `<version>/` 目录会直接被 STRUCTURE_INVALID 拒绝。
 * 为什么索引里 url 写裸文件名：同一份 module-index.json 既能指本地 http 服务、也能指
 * GitHub Release 资产，发布地址变了不必重新生成索引——相对解析交给安装器唯一的
 * `resolveModuleUrl(url, indexUrl)`（见 src/core/packageInstaller.js）。
 *
 * 用法：
 *   node scripts/build-release.mjs            # 生成 dist/release/*.zip 与 module-index.json，随后完整校验
 *   node scripts/build-release.mjs --verify   # 只校验已存在的产物（不写盘），供门禁复跑
 *   node scripts/build-release.mjs --list     # 只打印将要打包的包与版本
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { checkCoreRequirement, compareVersions, validateManifest } from "../src/core/manifest.js";
import { resolveModuleUrl } from "../src/core/packageInstaller.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_DIR = path.join(ROOT, "modules");
const OUT_DIR = path.join(ROOT, "dist", "release");
const INDEX_FILE = "module-index.json";
const CORE_ID = "core";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
/** zip 条目时间戳固定为 ZIP 纪元：否则同样内容每次构建摘要都变，索引无法做差异比对 */
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1));
/** 校验相对 url 时用的样例索引地址（真实索引地址由客户端在 fetchIndex 时给出） */
const SAMPLE_INDEX_URL = "https://example.invalid/module-index.json";

const VERIFY_ONLY = process.argv.includes("--verify");
const LIST_ONLY = process.argv.includes("--list");

const die = message => {
	console.error(`[P9产物] ${message}`);
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
			console.warn(`[P9产物] 跳过 ${id}：manifest.json 解析失败 ${error.message}`);
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
 * 由"包 + 已落盘 zip 的信息"生成 module-index.json 的内容（纯函数，可单测）
 * 字段名沿用 §10 与安装器/界面已经在读的名字：latest / url / sha256 / size / dependencies / core。
 * @param {{packs: Array<{id: string, version: string, manifest: Object, zip: {file: string, bytes: number, sha256: string}}>, coreVersion: string}} input
 * @returns {Object} 索引对象
 */
export function buildIndex({ packs, coreVersion }) {
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
	return { schema: 1, core: { version: coreVersion, latest: coreVersion }, modules };
}

const readCoreVersion = () => {
	const info = JSON.parse(fs.readFileSync(path.join(ROOT, "info.json"), "utf8"));
	return info.version || "0.0.0";
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

	for (const pack of packs) {
		const entry = index.modules[pack.id];
		if (!entry) fail(`索引缺少 ${pack.id}`);
		if (entry.latest !== pack.version) fail(`${pack.id}：索引 latest=${entry.latest} 与盘上版本 ${pack.version} 不一致`);
		if (entry.url !== pack.file) fail(`${pack.id}：索引 url=${entry.url} 期望 ${pack.file}`);

		const resolved = resolveModuleUrl(entry.url, SAMPLE_INDEX_URL);
		if (!/^https?:\/\//.test(resolved) || !resolved.endsWith(`/${entry.url}`)) {
			fail(`${pack.id}：相对 url 解析不出可下载地址（${entry.url} → ${resolved}）`);
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

// ------------------------------------------------------------------ 命令行入口

async function main() {
	const coreVersion = readCoreVersion();
	const packs = collectPacks();
	if (!packs.length) die("modules/ 下没有找到任何可打包的模块版本目录");

	if (LIST_ONLY) {
		for (const pack of packs) console.log(`${pack.id}@${pack.version} → ${pack.file}`);
		return;
	}

	if (VERIFY_ONLY) {
		const indexPath = path.join(OUT_DIR, INDEX_FILE);
		if (!fs.existsSync(indexPath)) die(`--verify 需要产物存在：${posix(path.relative(ROOT, indexPath))}`);
		const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
		const notes = await verifyArtifacts({ packs, index, coreVersion });
		console.log(`[P9产物] 校验通过：${packs.length} 个包`);
		for (const note of notes) console.log(`  ${note}`);
		// 索引本身也必须与"由盘上产物重算出的索引"完全一致，防止改了包忘了重新生成索引
		const rebuilt = buildIndex({
			packs: packs.map(pack => {
				const bytes = fs.readFileSync(path.join(OUT_DIR, pack.file));
				return { ...pack, zip: { file: pack.file, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") } };
			}),
			coreVersion,
		});
		if (indexText(rebuilt) !== fs.readFileSync(indexPath, "utf8")) die("module-index.json 与盘上产物重算结果不一致（重新跑一次构建）");
		console.log("  module-index.json 与产物一致");
		return;
	}

	fs.mkdirSync(OUT_DIR, { recursive: true });
	const zipped = [];
	for (const pack of packs) {
		const info = await zipDir(pack.dir, path.join(OUT_DIR, pack.file));
		zipped.push({ ...pack, zip: info });
		console.log(`  ${pack.id}@${pack.version} → ${info.file}（${info.files} 文件 / ${info.bytes} 字节）`);
	}
	const index = buildIndex({ packs: zipped, coreVersion });
	fs.writeFileSync(path.join(OUT_DIR, INDEX_FILE), indexText(index));
	console.log(`  ${INDEX_FILE}：${Object.keys(index.modules).length} 个可安装模块（core 除外）`);

	const notes = await verifyArtifacts({ packs: zipped, index, coreVersion });
	console.log(`[P9产物] 生成并校验通过：${packs.length} 个包`);
	for (const note of notes) console.log(`  ${note}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(error => {
		console.error(`[P9产物] 失败：${error?.message ?? error}`);
		process.exitCode = 1;
	});
}
