/**
 * @fileoverview P8 第二刀：把五套内置卡牌皮肤迁入 modules/card-skin/<version>/（任务书§45/§60）
 *
 * 为什么可以直接搬：卡面是**数据**，不是 CSS/JS —— 没有 url() 需要重写，运行时靠
 * `game.getFileList` 列目录 + 拼 URL 取图，所以搬迁只需保证三件事：
 *   1. 数量守恒（每套的文件数与字节数一份都不许少）；
 *   2. 包内路径与 `statics`/`skin-loader` 的寻址一致（`<包根>/image/card-skins/<folder>/<name>.<ext>`）；
 *   3. 单体根 `image/card-skins/` 继续存在——玩家自己丢进去的文件夹要照常可用（既有行为）。
 *
 * 用法：
 *   node scripts/build-card-skin-pack.mjs            # 搬迁（幂等：已搬过就只校验）
 *   node scripts/build-card-skin-pack.mjs --verify   # 只校验（供门禁复跑）
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_ONLY = process.argv.includes("--verify");

/** 与 statics 扫描口径一致的皮肤清单（改这里必须同步 src/config/utils.js 的 cardSkinPresets） */
const EXPECTED = [
	{ key: "online", dir: "online", extension: "jpg" },
	{ key: "caise", dir: "caise", extension: "webp" },
	{ key: "decade", dir: "decade", extension: "png" },
	{ key: "bingkele", dir: "bingkele", extension: "png" },
	{ key: "gold", dir: "gold", extension: "webp" },
];

const MONO_REL = path.join("image", "card-skins");
const infoVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "info.json"), "utf8")).version;
const VERSION = infoVersion || "0.0.0";
const PACK_REL = path.join("modules", "card-skin", VERSION);
const PACK_SKINS_REL = path.join(PACK_REL, MONO_REL);

const fail = message => {
	console.error(`[card-skin包] ${message}`);
	process.exitCode = 1;
	throw new Error(message);
};

/** 列出一层目录（不存在返回 null，便于区分"没搬"与"搬空了"） */
const listDir = abs => (fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? fs.readdirSync(abs) : null);

/** 统计一套皮肤的文件数与字节数（只算一层，皮肤目录不放子目录） */
const statSet = abs => {
	const entries = listDir(abs);
	if (entries === null) return null;
	let files = 0;
	let bytes = 0;
	for (const name of entries) {
		const full = path.join(abs, name);
		if (!fs.statSync(full).isFile()) continue;
		files++;
		bytes += fs.statSync(full).size;
	}
	return { files, bytes };
};

const manifestPath = path.join(ROOT, PACK_REL, "manifest.json");
const installedPath = path.join(ROOT, "modules", "installed.json");

// ------------------------------------------------------------------ 幂等判定：已搬过就直接进校验

const alreadyMoved = EXPECTED.every(skin => listDir(path.join(ROOT, MONO_REL, skin.dir)) === null);
const packPresent = EXPECTED.every(skin => listDir(path.join(ROOT, PACK_SKINS_REL, skin.dir)) !== null);

if (!alreadyMoved && !packPresent && !VERIFY_ONLY) {
	console.log(`[card-skin包] 开始搬迁 → ${PACK_REL.replace(/\\/g, "/")}`);
} else if ((alreadyMoved && packPresent) || VERIFY_ONLY) {
	console.log(`[card-skin包] 校验模式（搬迁已完成）`);
} else if (alreadyMoved || packPresent) {
	fail(`状态不自洽：单体侧已搬=${alreadyMoved} 包内侧齐备=${packPresent}。请先人工确认目录，勿自动重跑`);
}

// ------------------------------------------------------------------ 搬迁

if (!alreadyMoved && !packPresent && !VERIFY_ONLY) {
	fs.mkdirSync(path.join(ROOT, PACK_SKINS_REL), { recursive: true });
	for (const skin of EXPECTED) {
		const from = path.join(MONO_REL, skin.dir);
		const to = path.join(PACK_SKINS_REL, skin.dir);
		if (listDir(path.join(ROOT, from)) === null) fail(`源目录不存在：${from}`);
		// git mv 保留历史；未跟踪文件（理论上不该有）会由 git 报错并中止，绝不静默 copy 后删源
		try {
			execFileSync("git", ["mv", from, to], { cwd: ROOT, stdio: "pipe" });
		} catch (error) {
			fail(`git mv 失败：${from} → ${to}\n${error.stderr?.toString() || error.message}`);
		}
		console.log(`  moved ${from.replace(/\\/g, "/")} → ${to.replace(/\\/g, "/")}`);
	}
}

// ------------------------------------------------------------------ 计数（以包内实际为准）

const cardSkins = EXPECTED.map(skin => {
	const stats = statSet(path.join(ROOT, PACK_SKINS_REL, skin.dir));
	if (!stats || stats.files === 0) fail(`包内缺少皮肤目录或为空：${path.join(PACK_SKINS_REL, skin.dir).replace(/\\/g, "/")}`);
	if (listDir(path.join(ROOT, MONO_REL, skin.dir)) !== null) fail(`单体根仍残留内置皮肤目录：image/card-skins/${skin.dir}（双根会互相复活，必须删净）`);
	return { key: skin.key, dir: skin.dir, extension: skin.extension, files: stats.files, bytes: stats.bytes };
});
const totalBytes = cardSkins.reduce((sum, skin) => sum + skin.bytes, 0);

// ------------------------------------------------------------------ manifest.json

const manifest = {
	schema: 1,
	id: "card-skin",
	name: "卡牌皮肤",
	version: VERSION,
	type: "feature",
	core: `>=${VERSION}`,
	dependencies: ["core"],
	// 卡面是数据：没有需要登记的 JS/CSS 入口，牌面文件名由运行时列目录得出
	entry: { js: [], css: [] },
	capabilities: ["card-skin"],
	platform: ["desktop", "mobile"],
	size: totalBytes,
	author: "子右",
	/**
	 * 包内皮肤集台账（搬迁时的数量快照，供 --verify 与门禁复跑）：
	 * 运行时不读这里，读的是目录本身；这里只负责"少了一个文件就报警"。
	 */
	cardSkins,
	/** 双根约定：包根只放内置皮肤；玩家自建的皮肤文件夹一律放扩展根的 image/card-skins/ 下 */
	note: "built-in sets live here; user-dropped folders stay in <extension>/image/card-skins/",
};

const expectedManifest = JSON.stringify(manifest, null, "\t") + "\n";
if (VERIFY_ONLY) {
	const onDisk = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : "";
	if (onDisk !== expectedManifest) fail("manifest.json 与实际目录计数不一致（皮肤文件被增删过？）——搬迁模式下会自动重写，--verify 模式要求二者相同");
} else {
	fs.writeFileSync(manifestPath, expectedManifest);
	console.log(`  manifest → ${path.relative(ROOT, manifestPath).replace(/\\/g, "/")}（${cardSkins.length} 套 / ${totalBytes} 字节）`);
}

// ------------------------------------------------------------------ installed.json

const installed = JSON.parse(fs.readFileSync(installedPath, "utf8"));
if (!installed.modules || typeof installed.modules !== "object") fail("modules/installed.json 结构异常");
if (installed.modules["card-skin"]?.version !== VERSION) {
	if (VERIFY_ONLY) fail(`installed.json 未登记 card-skin ${VERSION}（包在盘上但没人注册它 → 运行时会回落单体根）`);
	installed.modules["card-skin"] = { version: VERSION };
	// 与仓库既有条目保持一致：只记 version，sha256/hashVerified 由安装器写入时才出现
	fs.writeFileSync(installedPath, JSON.stringify(installed, null, "\t") + "\n");
	console.log("  installed.json 已登记 card-skin");
}

// ------------------------------------------------------------------ 单体根保留（玩家丢文件夹的位置）

const keepFile = path.join(ROOT, MONO_REL, ".gitkeep");
if (!fs.existsSync(keepFile)) {
	if (VERIFY_ONLY) fail("单体根 image/card-skins/ 的 .gitkeep 不见了——玩家自建皮肤的目录必须继续随仓库存在");
	fs.mkdirSync(path.join(ROOT, MONO_REL), { recursive: true });
	fs.writeFileSync(keepFile, "// 玩家自建卡牌皮肤放这里：每个皮肤一个子文件夹，丢进去重启即可（内置皮肤已迁至 modules/card-skin/）\n");
	console.log("  已写 image/card-skins/.gitkeep（保留玩家皮肤根）");
}

// ------------------------------------------------------------------ 汇总

if (process.exitCode !== 1) {
	console.log("[card-skin包] 完成：");
	for (const skin of cardSkins) console.log(`  ${skin.dir.padEnd(10)} ${String(skin.files).padStart(4)} 文件 / ${(skin.bytes / 1024 / 1024).toFixed(2)} MB (${skin.extension})`);
	console.log(`  合计 ${cardSkins.reduce((s, x) => s + x.files, 0)} 文件 / ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}
