/**
 * P14 · 能力声明不得漂移（任务书§14/§15 + §51「样式」）
 *
 * 起因：批 1 真机探针 `decadeUI.style.hasCapability("border-style")` 在 yjcm 下返回
 * false、`online-chat/online-gift` 在 online 下返回 [false,false]。查出来不是判据写错，
 * 而是**分包清单与代码声明不一致**：`scripts/migrate-style-packs.mjs:131` 把四个样式的
 * capabilities 全硬编码成 `["player-frame","lbtn"]`，于是 yjcm 丢了 `border-style`、
 * online 丢了 `online-chat`/`online-gift`。清单是发布契约（`build-release.mjs` 会把它
 * 原样写进 `module-index.json`），错了会一路传到客户端索引里。
 *
 * 这条测试盯的就是"代码声明 = 磁盘清单 = 索引"三处一致，防止再漂。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.decadeUIName = "十周年UI-Stars";

const { createModuleRegistry } = await import("../src/core/registry.js");
const { registerBuiltInModules } = await import("../src/core/builtInModules.js");

const PACK_VERSION = "1.4.2";
const registry = createModuleRegistry();
registerBuiltInModules(registry, { version: PACK_VERSION });

const declared = registry.list().filter(item => item?.manifest?.type === "style" || item?.manifest?.type === "feature");
assert.ok(declared.length >= 8, `注册表里只拿到 ${declared.length} 个模块，判据无从对比`);

let checkedOnDisk = 0;
for (const entry of declared) {
	const { manifest } = entry;
	const file = `modules/${manifest.id}/${PACK_VERSION}/manifest.json`;
	if (!fs.existsSync(file)) continue;   // 门控型（pack:false）没有磁盘清单，跳过
	checkedOnDisk++;
	const packed = JSON.parse(fs.readFileSync(file, "utf8"));
	const want = [...(manifest.capabilities ?? [])].sort();
	const have = [...(packed.capabilities ?? [])].sort();
	assert.deepEqual(
		have,
		want,
		`${file} 的 capabilities 与代码声明不一致：清单缺 ${want.filter(c => !have.includes(c)).join(",") || "-"}、多 ${have.filter(c => !want.includes(c)).join(",") || "-"}。清单是发布契约，改声明要同步重生成清单`
	);
}
assert.ok(checkedOnDisk >= 7, `只核对了 ${checkedOnDisk} 份磁盘清单，少于七个分包`);

// 索引是清单的下游：构建脚本必须原样带上 capabilities（这里核对已构建产物，构建缺失则跳过）
{
	const indexFile = "dist/release/module-index.json";
	if (fs.existsSync(indexFile)) {
		const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
		for (const entry of declared) {
			const want = [...(entry.manifest.capabilities ?? [])].sort();
			const got = index.modules?.[entry.manifest.id]?.capabilities;
			if (got === undefined) continue;
			assert.deepEqual([...got].sort(), want, `module-index.json 里 ${entry.manifest.id} 的 capabilities 与声明不一致（客户端会读到假能力）`);
		}
	}
}

console.log(`p14-capability-drift: OK（核对 ${checkedOnDisk} 份清单）`);
