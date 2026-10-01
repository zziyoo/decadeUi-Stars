/**
 * P17 · Android 二进制写入被桥 JSON 化（真机数据损坏，v1.5.0 发布后由用户报出）
 *
 * 真机证据（2026-10-01，Android eruda）：
 *   fetch(...modules/decade/1.5.0/manifest.json) 的文本长度 57593，内容以
 *   `{"0":123,"1":34,"2":48,"3":34,"4":58,...}` 开头；
 *   同一台机器上没被卸载过的包（yjcm）清单仍是 751 字节的合法 JSON。
 *   而 `JSON.stringify(new Uint8Array([123,34,48,...]))` 正是 `{"0":123,"1":34,...}` 这个形状。
 *
 * 机制：`writeBinary` 的 legacy 分支把 ArrayBuffer 转成 **Uint8Array** 再交给本体
 * `game.writeFile`（moduleIo.js:292 → noname/init/cordova.js:289 `fileWriter.write(data)`），
 * 而 Cordova 桥对非 ArrayBuffer 参数按 JSON 序列化传递 ⇒ 落盘的是"字节数组的 JSON"，
 * 不是字节本身。文本写入走字符串不受影响 ⇒ 所以 installed.json 完好、包内文件全废。
 * 卸载在非原子平台是 copyTree + 删源，于是"让位→回滚"这一对复制把原内容彻底换成了坏内容。
 *
 * 夹具刻意复刻桥的这个行为（`tests/helpers/fake-android-game.mjs`，与 p18 共用），否则这条用例只会自证自。
 */
import assert from "node:assert/strict";
import { createNonameIo } from "../src/core/moduleIo.js";
import { bridgeSerialize, makeFakeGame, bytesOf, textOf } from "./helpers/fake-android-game.mjs";

// ---------------------------------------------------------- 1. 夹具自证：它真的会 JSON 化 typed array
{
	const typed = new Uint8Array([123, 34, 105, 100, 34, 58, 49]);
	assert.equal(bridgeSerialize(typed), '{"0":123,"1":34,"2":105,"3":100,"4":34,"5":58,"6":49}', "夹具必须复刻真机看到的形状，否则这条用例等于自证自");
	assert.ok(bridgeSerialize(typed).startsWith('{"0":'), "真机那份坏清单就是以 {\"0\": 开头的");
}

// ---------------------------------------------------------- 2. writeBinary 必须逐字节落盘
{
	const game = makeFakeGame();
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	const payload = '{"schema":1,"id":"decade","version":"1.5.0"}';

	await io.writeBinary("t/a.json", bytesOf(payload));
	const back = await io.readBinary("t/a.json");
	assert.ok(back, "写进去的必须读得回来");
	assert.equal(textOf(back), payload, "二进制写入不得被改写成别的形式（真机：被写成字节数组的 JSON）");

	const stored = game.files.get("extension/十周年UI-Stars/t/a.json");
	assert.notEqual(typeof stored, "string", "落盘内容不该是字符串（字符串意味着 typed array 被 JSON 化了）");
}

// ---------------------------------------------------------- 3. 目录搬运（非原子）后每个文件都要原样
{
	const game = makeFakeGame();
	const io = createNonameIo({ game, lib: {}, fs: null, stallMs: 3000 });
	const manifest = '{"schema":1,"id":"decade","name":"十周年样式","version":"1.5.0","type":"style"}';
	const css = "body{color:#fff}\n";

	await io.writeBinary("pack/manifest.json", bytesOf(manifest));
	await io.writeBinary("pack/player.css", bytesOf(css));

	const moved = await io.movePath("pack", "pack-parked");
	assert.ok(!moved, `目录搬运不该返回错误：${moved?.message ?? moved}`);

	const movedManifest = await io.readBinary("pack-parked/manifest.json");
	assert.ok(movedManifest, "搬运后清单必须还在");
	assert.equal(textOf(movedManifest), manifest, "搬运必须逐字节保真——真机上它把清单写成了字节数组的 JSON");
	assert.equal(textOf(await io.readBinary("pack-parked/player.css")), css, "同样要保真第二个文件");

	assert.equal(await io.readBinary("pack/manifest.json"), null, "源目录该在复制成功后清走");
}

console.log('p17-android-binary-write: OK（二进制写入与目录搬运逐字节保真，桥不再有机会 JSON 化）');
