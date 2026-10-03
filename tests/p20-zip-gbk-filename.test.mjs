/**
 * ZIP 条目文件名编码测试（build-release.mjs）：
 * 本项目生成的所有 zip 条目名必须按 GBK 写入原始字节，且不得置位 General Purpose Bit
 * Flag 的 UTF-8 标志（0x0800）——无名杀现有的部分扩展导入/拖拽读取链路按 GBK 解析文件
 * 名字节，JSZip 默认的 UTF-8 名会在导入时变乱码。除文件名编码外一切保持原样：
 * 目录结构、压缩方式（DEFLATE）、条目内容字节都不许动。
 *
 * 断言手段分两层，防止"读端兜底掩盖写端问题"：
 *   ① 直接解析 ZIP 原始字节（中央目录 + 本地文件头），不经任何文件名解码——GBK 解码
 *      必须还原原始路径、字节不得等于 UTF-8 序列、0x0800 标志必须为 0；
 *   ② JSZip.loadAsync 默认参数回读（本脚本 verify 与 p9/p10 既有测试的读取路径）——
 *      靠 0x7075 Unicode Path 附加字段必须照样还原原名与内容（两头兼容的验收线）。
 *
 * zipDir()（分包）与 zipFullPackage()（整包）两条打包路径都覆盖；中文路径刻意取自
 * 真实产物的形状（十周年UI-Stars/ 根、image/卡牌/、audio/背景/），避免"纯 ASCII 路径
 * 假通过"。源码级接线断言锁死两个 generateAsync 都传 encodeFileName，防回归。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import iconv from "iconv-lite";
import JSZip from "jszip";

const mod = await import("../scripts/build-release.mjs");

const sha = buffer => crypto.createHash("sha256").update(buffer).digest("hex");

// ---------------------------------------------------------------- ZIP 原始字节解析（不借助 JSZip 的文件名解码）

const SIG_EOCD = 0x06054b50;
const SIG_CDH = 0x02014b50;
const SIG_LFH = 0x04034b50;

/** 解析中央目录：每条 {nameBytes, utf8Flag, method, localHeaderOffset}（文件名一律以原始字节给出） */
function parseCentralDirectory(bytes) {
	let eocd = -1;
	for (let i = bytes.length - 22; i >= 0; i--) {
		if (bytes.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
	}
	assert.notEqual(eocd, -1, "找不到 End of Central Directory（产物不是 zip？）");
	const count = bytes.readUInt16LE(eocd + 10);
	let p = bytes.readUInt32LE(eocd + 16);
	const entries = [];
	for (let n = 0; n < count; n++) {
		assert.equal(bytes.readUInt32LE(p), SIG_CDH, `中央目录签名不符 @${p}`);
		entries.push({
			utf8Flag: (bytes.readUInt16LE(p + 8) & 0x0800) !== 0,
			method: bytes.readUInt16LE(p + 10),
			localHeaderOffset: bytes.readUInt32LE(p + 42),
			nameBytes: (() => {
				const nameLen = bytes.readUInt16LE(p + 28);
				return bytes.subarray(p + 46, p + 46 + nameLen);
			})(),
		});
		p += 46 + bytes.readUInt16LE(p + 28) + bytes.readUInt16LE(p + 30) + bytes.readUInt16LE(p + 32);
	}
	return entries;
}

/** 本地文件头：GBK 导入器更可能扫它——名字字节必须与中央目录一致，0x0800 同样为 0 */
function parseLocalHeader(bytes, offset) {
	assert.equal(bytes.readUInt32LE(offset), SIG_LFH, `本地文件头签名不符 @${offset}`);
	const nameLen = bytes.readUInt16LE(offset + 26);
	return {
		utf8Flag: (bytes.readUInt16LE(offset + 6) & 0x0800) !== 0,
		nameBytes: bytes.subarray(offset + 30, offset + 30 + nameLen),
	};
}

// ---------------------------------------------------------------- 测试沙盒：中文路径 + 文本/二进制混放

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p20-zip-gbk-"));
const src = path.join(tmp, "十周年UI-Stars");

/** 相对路径 → 源文件内容（二进制用随机字节，任何转码都会被发现） */
const fileDefs = {
	"manifest.json": Buffer.from(JSON.stringify({ id: "demo", version: "1.0.0", name: "演示包" }), "utf8"),
	"image/卡牌/关羽·武圣.png": crypto.randomBytes(731),
	"image/卡牌/皮肤.png": crypto.randomBytes(512),
	"audio/背景/音乐.mp3": crypto.randomBytes(1024),
	"ui/界面/主面板.json": Buffer.from('{"style":"主面板"}\n', "utf8"),
};
for (const [rel, content] of Object.entries(fileDefs)) {
	fs.mkdirSync(path.join(src, rel, ".."), { recursive: true });
	fs.writeFileSync(path.join(src, rel), content);
}

/**
 * 对一个落盘 zip 断言全部不变量：
 * 条目集合 == 期望路径集；GBK 解码还原原名；非 ASCII 名不是 UTF-8 字节；
 * 中央目录与本地头的 0x0800 都是 0；压缩方式 DEFLATE；内容逐字节与源一致。
 */
async function assertGbkZip(zipPath, expectNames) {
	const bytes = fs.readFileSync(zipPath);
	const entries = parseCentralDirectory(bytes);
	assert.equal(entries.length, expectNames.length, `${path.basename(zipPath)}：条目数应与源文件数一致`);

	for (const entry of entries) {
		const name = iconv.decode(entry.nameBytes, "gbk");
		assert.ok(expectNames.includes(name), `GBK 解码必须还原原始路径，实际 ${JSON.stringify(name)}`);
		// 非 ASCII 名：GBK 字节与 UTF-8 字节序列必然不同——相等即说明还在写 UTF-8
		if (/[^\x00-\x7F]/.test(name)) {
			assert.equal(entry.nameBytes.equals(Buffer.from(name, "utf8")), false, `条目名字节不应是 UTF-8：${name}`);
		} else {
			assert.equal(entry.nameBytes.equals(Buffer.from(name, "utf8")), true, `纯 ASCII 名应与 UTF-8 字节一致：${name}`);
		}
		assert.equal(entry.utf8Flag, false, `General Purpose Bit Flag 不得声明 UTF-8（0x0800）：${name}`);
		assert.equal(entry.method, 8, `压缩方式必须保持 DEFLATE：${name}`);
		const local = parseLocalHeader(bytes, entry.localHeaderOffset);
		assert.equal(local.utf8Flag, false, `本地文件头同样不得声明 UTF-8：${name}`);
		assert.equal(local.nameBytes.equals(entry.nameBytes), true, `本地头与中央目录的名字字节应一致：${name}`);
	}

	// 内容逐字节不变：默认 loadAsync（verify 与既有测试的读取路径）按原名回读，逐条对 sha256
	const zip = await JSZip.loadAsync(bytes);
	assert.deepEqual(
		Object.keys(zip.files).filter(name => !zip.files[name].dir).sort(),
		[...expectNames].sort(),
		"默认 loadAsync 也必须还原全部原始条目名（0x7075 附加字段兜底）"
	);
	for (const [rel, content] of Object.entries(fileDefs)) {
		const name = expectNames.find(n => n === rel || n.endsWith(`/${rel}`));
		assert.ok(name, `期望路径集中找不到 ${rel}`);
		const file = zip.file(name);
		assert.ok(file, `缺条目 ${name}`);
		const read = Buffer.from(await file.async("nodebuffer"));
		assert.equal(read.equals(content), true, `条目内容必须与源文件逐字节一致：${name}`);
		assert.equal(sha(read), sha(content), `条目内容 sha256 必须与源文件一致：${name}`);
	}
	return bytes;
}

// ---------------------------------------------------------------- zipDir：分包路径

{
	const relNames = Object.keys(fileDefs).sort();
	const outZip = path.join(tmp, "demo-1.0.0.zip");
	const info = await mod.zipDir(src, outZip, {});
	assert.equal(info.files, relNames.length, "zipDir 上报的文件数应与源目录一致");
	await assertGbkZip(outZip, relNames);

	// 确定性不受编码改动影响：同内容两次构建仍须逐字节一致
	const out2 = path.join(tmp, "demo-1.0.0-again.zip");
	await mod.zipDir(src, out2, {});
	assert.equal(sha(fs.readFileSync(out2)), sha(fs.readFileSync(outZip)), "两次打包摘要必须一致（GBK 编码不许引入时间性因素）");
}

// ---------------------------------------------------------------- zipFullPackage：整包路径（根目录 <扩展名>/）

{
	const fullNames = Object.keys(fileDefs).map(rel => `十周年UI-Stars/${rel}`).sort();
	const outZip = path.join(tmp, "十周年UI-Stars-1.0.0-full.zip");
	const info = await mod.zipFullPackage({ distDir: src, outZip, rootName: "十周年UI-Stars" });
	assert.equal(info.files, fullNames.length, "整包上报的文件数应与源目录一致");
	await assertGbkZip(outZip, fullNames);
}

// ---------------------------------------------------------------- 接线不变量：两条打包路径共用同一个 GBK 编码函数

{
	// 编码函数必须可单测且确实走 GBK（不许手写码表、不许悄悄换编码）
	assert.equal(typeof mod.encodeZipFileName, "function", "build-release 必须导出 encodeZipFileName");
	for (const sample of ["十周年UI-Stars", "image/卡牌/皮肤.png", "audio/背景/音乐.mp3", "manifest.json"]) {
		assert.equal(iconv.decode(mod.encodeZipFileName(sample), "gbk"), sample, `encodeZipFileName 必须能按 GBK 还原：${sample}`);
	}

	// 源码级锁定：两个 generateAsync 都必须传 encodeFileName（少一处，就有产物回到 UTF-8 名）
	const scriptSrc = fs.readFileSync(new URL("../scripts/build-release.mjs", import.meta.url), "utf8");
	assert.equal((scriptSrc.match(/encodeFileName: encodeZipFileName/g) ?? []).length, 2, "zipDir 与 zipFullPackage 的 generateAsync 都必须统一传 encodeFileName");
	assert.match(scriptSrc, /import iconv from "iconv-lite";/, "必须引入 iconv-lite（不许手写 GBK 编码表）");
	assert.match(scriptSrc, /iconv\.encode\(name, "gbk"\)/, "编码函数必须统一走 GBK");

	// 依赖声明：构建期依赖（devDependencies），绝不进扩展运行时
	const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	assert.ok(pkg.devDependencies["iconv-lite"], "iconv-lite 必须声明为 devDependency");
	assert.equal(pkg.dependencies?.["iconv-lite"], undefined, "iconv-lite 不得进入 runtime dependencies");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log("P20 zip GBK filename tests: all passed ✓");
