/**
 * P18 · 非原子平台的**目录**搬运必须"复制全等才许删源"（D2，2026-10-01 Android 真机）
 *
 * 真机经过：手机上卸载样式 → 安装器把包目录 `copyTree` 到 `.removing-*` 让位目录、再删源。
 * 这条路径上有两个洞（`src/core/moduleIo.js`）：
 *   1. `if (buffer !== null) await writeBinary(...)` —— 列得出来却读不到的文件被**静默跳过**；
 *   2. 复制完成后**不校验**就 `removeTree(src)` —— 半截落盘也照样删源。
 * 两个洞叠在一起，一次"目录改名"就能把包内容永久销毁（配合 D1 的 JSON 化写入，手机上四个包全废）。
 *
 * 对照事实：**文件**搬运 `moveFileNonAtomic` 早就有读回校验（moduleIo.js:430-452），只有目录分支没有。
 * 夹具用 p17 那份（含桥的序列化规则）加故障注入。
 */
import assert from "node:assert/strict";
import { createNonameIo } from "../src/core/moduleIo.js";
import { makeFakeGame, bytesOf, textOf, absOf } from "./helpers/fake-android-game.mjs";

const MANIFEST = '{"schema":1,"id":"decade","version":"1.5.0"}';
const CSS = "body{color:#fff}\n";

/** 铺一个好包：两个文件 + 一个带文件的子目录 */
async function seedPack(io) {
	await io.writeBinary("pack/manifest.json", bytesOf(MANIFEST));
	await io.writeBinary("pack/player.css", bytesOf(CSS));
	await io.writeBinary("pack/ui/skins/special.js", bytesOf("export const x=1;\n"));
}

// ---------------------------------------------------------------- 1. 读不到的文件不许被静默跳过

{
	const game = makeFakeGame({ hidden: new Set([absOf("pack/player.css")]) });
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);

	const error = await io.movePath("pack", "parked").then(
		() => null,
		error => error
	);
	assert.ok(error, "条目录得出来却读不到时必须报错，不许当无事发生");
	assert.match(String(error.message ?? error), /不可读|校验/, `实际错误：${error?.message ?? error}`);
	assert.ok(game.files.has(absOf("pack/player.css")), "复制不全绝不许删源——真机上这一步把包内容永久销毁了");
	assert.ok(game.files.has(absOf("pack/manifest.json")), "整棵源树都要留着，不能删一半");
}

// ---------------------------------------------------------------- 2. 落盘只有半截也不许删源

{
	const game = makeFakeGame({ truncateOnWrite: new Set([absOf("parked/manifest.json")]) });
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);

	const error = await io.movePath("pack", "parked").then(
		() => null,
		error => error
	);
	assert.ok(error, "写入被截断（真机上 Cordova 覆盖写就会这样）必须被读回校验抓到");
	assert.match(String(error.message ?? error), /校验/, `实际错误：${error?.message ?? error}`);
	assert.match(
		String(error.message ?? error),
		/期望 \d+ 字节，实得 \d+ 字节/,
		`错误消息必须自带差异摘要（只说"落盘校验失败"分不清是截断还是内容漂移）：${error?.message ?? error}`
	);
	assert.equal(textOf(await io.readBinary("pack/manifest.json")), MANIFEST, "源目录必须还是完整内容");
	assert.equal(textOf(await io.readBinary("pack/ui/skins/special.js")), "export const x=1;\n");
}

// ---------------------------------------------------------------- 3. 写失败（回调 Error）不许继续

{
	const game = makeFakeGame({ failOnWrite: new Set([absOf("parked/ui/skins/special.js")]) });
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);

	const error = await io.movePath("pack", "parked").then(
		() => null,
		error => error
	);
	assert.ok(error, "game.writeFile 回调 Error 也要转成搬运失败");
	assert.ok(game.files.has(absOf("pack/ui/skins/special.js")), "深层子目录写失败同样不许删源");
}

// ---------------------------------------------------------------- 5. 首字节偶发变 0（真机抓到的形状）：重写要救得回来

// 真机原文：`期望 10493 字节，实得 10493 字节，首个不同 @0(137→0)，本次已复制 504 个文件`
// 与 `期望 6502 字节，实得 6502 字节，首个不同 @0(47→0)，本次已复制 25 个文件` —— 长度不变、
// 首字节变 0、而且是在几百个文件里随机中招。手写 game.* 探针复现不出来，所以按"设备间歇性缺陷"
// 处理：写入后读回不符就**重写重试**（校验强度不变），三次都验不过才把它当失败上报。
{
	const game = makeFakeGame({ zeroFirstByteOnce: new Set([absOf("parked/manifest.json")]) });
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);

	const thrown = await io.movePath("pack", "parked").then(() => null, error => error);
	assert.equal(thrown, null, `偶发首字节损坏必须被重写救回来，不该让整次搬运失败：${thrown?.message ?? thrown}`);
	assert.equal(textOf(await io.readBinary("parked/manifest.json")), MANIFEST, "重写之后内容必须逐字节等于源");
	assert.equal(await io.kind("pack"), null, "全等确认后才允许删源");
}

// ---------------------------------------------------------------- 6. 每次都坏：三次重试后仍要如实失败

{
	const game = makeFakeGame({ alwaysZeroFirstByte: new Set([absOf("parked/manifest.json")]) });
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);

	const error = await io.movePath("pack", "parked").then(() => null, error => error);
	assert.ok(error, "每次都坏就必须失败，不许假装成功");
	assert.match(String(error.message ?? error), /连试 3 次/, `消息要说清重试过：${error?.message ?? error}`);
	assert.match(String(error.message ?? error), /期望 \d+ 字节，实得 \d+ 字节/, "差异摘要要保留");
	assert.ok(game.files.has(absOf("pack/manifest.json")), "三次都验不过时源目录必须完整保留");
}

// ---------------------------------------------------------------- 4. 成功路径：全等 + 源清走 + 空目录不丢

{
	const game = makeFakeGame();
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	await seedPack(io);
	// zip 里带目录条目时真机上会留下空目录；搬运不该把它变没
	game.dirs.add(absOf("pack/assets"));

	const thrown = await io.movePath("pack", "parked").then(() => null, error => error);
	assert.equal(thrown, null, `正常搬运不该报错：${thrown?.message ?? thrown}`);

	assert.equal(await io.kind("pack"), null, "复制全等之后才允许删源");
	assert.equal(textOf(await io.readBinary("parked/manifest.json")), MANIFEST);
	assert.equal(textOf(await io.readBinary("parked/ui/skins/special.js")), "export const x=1;\n");
	assert.equal(await io.kind("parked/assets"), "dir", "空目录也是目录树的一部分");
}

console.log("p18-dir-move-verify: 见文件头（D2 目录搬运全等校验）");
