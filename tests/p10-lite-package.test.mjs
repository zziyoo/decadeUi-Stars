/** 次完整包必须保留本体与下载索引，且不能携带可选模块或虚假的安装记录。 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import * as release from "../scripts/build-release.mjs";

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "stars-lite-"));
const distDir = path.join(sandbox, "dist");
const zipPath = path.join(distDir, "release", "Stars-1.5.1-lite.zip");
const put = (rel, content) => {
	const target = path.join(distDir, rel);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content);
};
const ids = ["baby", "card-skin", "codename", "decade", "mobile", "online", "yjcm"];
const installed = JSON.stringify({ schema: 1, modules: Object.fromEntries(ids.map(id => [id, { version: "1.5.0" }])) });
const index = JSON.stringify({ schema: 1, modules: Object.fromEntries(ids.map(id => [id, { url: `${id}-1.5.0.zip` }])) });
put("info.json", '{"name":"Stars","version":"1.5.1"}');
put("extension.js", "export default {};\n");
put("src/styles/base.css", "body{}\n");
put("image/卡牌/共享.png", Buffer.from([0, 1, 2, 255]));
put("docs/extension-readme.md", "public docs\n");
put("README.md", "internal docs\n");
put("modules/installed.json", installed);
put("modules/module-index.json", index);
for (const id of ids) put(`modules/${id}/1.5.0/manifest.json`, JSON.stringify({ id, version: "1.5.0" }));
put("modules/baby/1.4.2/manifest.json", '{"id":"baby","version":"1.4.2"}');
put("release/old.zip", "previous release\n");

try {
	assert.equal(typeof release.zipLitePackage, "function", "发布构建应能生成不包含七个分包的次完整包");
	const result = await release.zipLitePackage({ distDir, outZip: zipPath });
	const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
	const names = Object.keys(zip.files).filter(name => !zip.files[name].dir).sort();
	assert.deepEqual(names, [
		"docs/extension-readme.md", "extension.js", "image/卡牌/共享.png", "info.json",
		"modules/installed.json", "modules/module-index.json", "src/styles/base.css",
	], "次完整包只保留本体、共享资源及模块管理元数据，不携带任何版本的七个模块");
	for (const rel of names.filter(name => name !== "modules/installed.json")) {
		assert.deepEqual(await zip.file(rel).async("nodebuffer"), fs.readFileSync(path.join(distDir, rel)), `本体文件不得改写：${rel}`);
	}
	assert.deepEqual(JSON.parse(await zip.file("modules/installed.json").async("string")), { schema: 1, modules: {} });
	assert.equal(fs.readFileSync(path.join(distDir, "modules/installed.json"), "utf8"), installed, "不能改动 dist 的整包安装记录");
	assert.ok(fs.existsSync(path.join(distDir, "modules/decade/1.5.0/manifest.json")), "不能删除 dist 的整包模块");
	const again = await release.zipLitePackage({ distDir, outZip: path.join(distDir, "release", "again.zip") });
	assert.equal(again.sha256, result.sha256, "次完整包构建必须可复现");
	await release.verifyLitePackage({ zipPath, distDir });

	const reject = async (mutate, pattern) => {
		const changed = await JSZip.loadAsync(fs.readFileSync(zipPath));
		mutate(changed);
		const target = path.join(sandbox, "invalid.zip");
		fs.writeFileSync(target, await changed.generateAsync({ type: "nodebuffer" }));
		try {
			await assert.rejects(release.verifyLitePackage({ zipPath: target, distDir }), pattern);
		} finally {
			process.exitCode = 0;
		}
	};
	await reject(changed => changed.file("modules/baby/1.5.0/manifest.json", "{}"), /分包|条目/);
	await reject(changed => changed.file("modules/installed.json", installed), /安装记录/);
	await reject(changed => changed.remove("modules/module-index.json"), /缺少根位文件/);
	await reject(changed => changed.file("modules/module-index.json", "{}"), /索引.*不一致/);
	await reject(changed => changed.remove("extension.js"), /缺少根位文件/);
} finally {
	fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log("P10 lite package tests: all passed ✓");
