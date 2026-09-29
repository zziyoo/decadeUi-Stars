/**
 * P14 · §52 静态不变量：每个注册模块都必须有一份独立测试表，且表结构合规。
 *
 * 为什么要用测试盯文档：任务书§52 要求"每个模块一个测试表"，而模块清单是代码里的
 * （`builtInModules` 的六个样式 + core + 两个 Feature）。文档不会自己跟着代码走 ——
 * 加了模块忘了加表、表头被改列、结果列填了值却没证据，这些都必须当场红，而不是等
 * 真机测试时才发现"这个模块没有验收清单"。
 *
 * 判据取值口径（写死在这里，表里不许自造词）：
 *   层级 ∈ 静态 / Node / 真机 / 不适用
 *   结果 ∈ 待验 / 通过 / 失败 / 不适用
 */
import assert from "node:assert/strict";
import fs from "node:fs";

// moduleManager.list() 会经 featureRuntime→configKey/readConfig 读全局扩展名与 lib.config
// （真机由 extension.js 注入名字、本体注入 config），Node 侧要先把这两个补上
globalThis.decadeUIName = "十周年UI-Stars";
const { lib } = await import("noname");
lib.config ??= {};

const { getModuleSystem } = await import("../src/core/moduleSystem.js");

const LEVELS = new Set(["静态", "Node", "真机", "不适用"]);
const RESULTS = new Set(["待验", "通过", "失败", "不适用"]);
/** §51 的"模块"六态：每份表都要覆盖到这六个动词（不适用也要显式写，不许省略行） */
const VERBS = ["安装", "启用", "禁用", "更新", "卸载", "重装"];

const rowsOf = file => fs.readFileSync(file, "utf8")
	.split("\n")
	.filter(line => /^\|/.test(line) && !/^\|\s*-{2,}/.test(line))
	.map(line => line.replace(/\\\|/g, " ").split("|").slice(1, -1).map(cell => cell.trim()));

const list = getModuleSystem().moduleManager.list();
const ids = list.map(item => item.id);

assert.ok(ids.length >= 9, `注册模块数异常（${ids.length}）：${ids.join(",")}`);

for (const item of list) {
	const file = `tests/modules/${item.id}.md`;
	assert.ok(fs.existsSync(file), `§52 要求每模块一份测试表，缺 ${file}`);

	const rows = rowsOf(file);
	const [head, ...body] = rows;
	assert.deepEqual(head, ["项目", "判据", "层级", "结果", "证据"], `${file} 表头必须是五列固定口径`);
	assert.ok(body.length >= VERBS.length, `${file} 测试项少于§51 的六个模块动词`);

	for (const row of body) {
		assert.equal(row.length, 5, `${file} 有行列数不是 5：${row.join(" / ")}`);
		assert.ok(LEVELS.has(row[2]), `${file}「${row[0]}」层级取值非法：${row[2]}`);
		assert.ok(RESULTS.has(row[3]), `${file}「${row[0]}」结果取值非法：${row[3]}`);
		assert.ok(row[1].length > 0, `${file}「${row[0]}」缺判据`);
		// 有结果就必须有证据；待验允许证据留空（用全角破折号占位）
		assert.ok(row[3] === "待验" || row[4].length > 0, `${file}「${row[0]}」填了结果却没有证据`);
		if (row[2] === "不适用" || row[3] === "不适用") {
			assert.ok(row[1].includes("不适用") || row[4].includes("不适用"), `${file}「${row[0]}」标了不适用却没写原因`);
		}
	}

	const covered = new Set(body.map(row => row[0]));
	for (const verb of VERBS) {
		assert.ok(covered.has(verb), `${file} 缺§51「模块」动词「${verb}」这一行（不适用也要显式写）`);
	}
}

// core 是"扩展本体"，它的表必须额外盯住 P10/P11/P13 那几条只有 Core 才有的判据
{
	const core = rowsOf("tests/modules/core.md").slice(1).map(row => row.join(" ")).join("\n");
	for (const keyword of ["整包", "module-index", "回退", "旧版"]) {
		assert.ok(core.includes(keyword), `tests/modules/core.md 缺关键判据「${keyword}」`);
	}
}

// 门控型 Feature（pack:false）没有"安装/卸载"，必须显式写成不适用而不是漏行
{
	const kill = rowsOf("tests/modules/kill-effect.md");
	const byName = Object.fromEntries(kill.slice(1).map(row => [row[0], row]));
	for (const verb of ["安装", "卸载", "更新", "回退"]) {
		assert.equal(byName[verb]?.[2], "不适用", `kill-effect 是门控型（pack:false），「${verb}」应标层级=不适用`);
	}
	assert.equal(byName["启用"]?.[2], "真机", "kill-effect 的门控生效必须真机验");
}

console.log(`p14-module-tables: OK（${ids.length} 份表：${ids.join(", ")}）`);
