#!/usr/bin/env node
/**
 * 样式专属资源全量迁移（一次性，§七/§九：根目录 Style 专属资源 → modules/<id>/<version>/）
 *
 * 审计结论（docs/PROGRESS.md「资源热插拔审计」2026-10-02）：
 *   - P4 的 rewriteCss 用相对路径实参调 path.relative（受 cwd 影响），"自有资源复制进包"
 *     生成的 url() 全部带 3~4 级 ../ 指回扩展根 —— 包内副本是死重，根目录一直在承重。
 *   - 本脚本按资源归属表把 Style 专属资源搬进对应包（镜像相对路径：包内路径 == 原根路径），
 *     重写六套包内 CSS 的 url() 为包内相对路径，并在 manifest.json 的 resources 登记资源边界。
 *   - 跨样式共用（≥2 套或 Core 无条件消费）的资源一律留在扩展根（Core/Shared），不搬。
 *
 * 归属判定（三层，按序）：
 *   1. FORCE_OWNERS  —— Core JS 按"当前样式"门控消费的资源（消费点静态可见但消费方是
 *      core，运行时却只在某套样式下走到）：强制归属该样式。
 *   2. DIR_RULES     —— 目录/前缀级归属；exceptions 命中的文件不搬（跨样式动态消费/共享）。
 *      owner="CONSUMER" 表示按消费点逐文件判定。
 *   3. 消费点扫描    —— core(src+extension.js) 与六套包内 js/css 的静态引用 + 皮肤 JS
 *      路径常量的动态引用（DYNAMIC_REFS）：消费方恰为单一样式 → 搬入该套；其余 → 留根。
 *
 * 用法：node scripts/migrate-style-assets.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync, copyFileSync, unlinkSync, rmSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const VERSION = JSON.parse(readFileSync(join(ROOT, "info.json"), "utf8")).version;
const SIX = ["decade", "mobile", "yjcm", "online", "baby", "codename"];
const toPosix = p => p.split("\\").join("/");

// ───────────────── 1. 强制归属（样式门控的 Core JS 消费点） ─────────────────
const FORCE_OWNERS = {
	"image/ui/misc/likai.png": "mobile", // animations.js 阵亡浮层，仅 style==="off" 渲染
	"audio/game_start_shousha.mp3": "mobile", // skills/animate.js isShousha 分支
	"assets/animation/effect_youxikaishi_shousha.atlas": "mobile",
	"assets/animation/effect_youxikaishi_shousha.png": "mobile",
	"assets/animation/effect_youxikaishi_shousha.skel": "mobile",
};

// ───────────────── 2. 目录级归属 ─────────────────
/**
 * dynamicPrefix：身份/阵亡等动态家族的归属（消费点在 Core JS 里按当前样式拼接，静态扫描不可见）。
 *   "stay"          —— 跨样式消费 → 留根
 *   样式id          —— 单样式专属 → 搬入该套
 */
const DIR_RULES = [
	{ dir: "image/styles/shousha/", owner: "mobile" }, // identity2_/name2_/dead2_ 仅 style==="off" 消费 → 整树随 mobile
	{
		// identity_/name_/dead_ 三族被 on+othersOff(+codename) 经 Core JS 交叉消费 → 留根；
		// dialog/button/vs/equip1~5/equipHand 被 Core 常驻 CSS 消费 → 留根；其余按消费点逐文件。
		dir: "image/styles/decade/",
		owner: "CONSUMER",
		dynamicPrefix: [
			["identity_", "stay"],
			["name_", "stay"],
			["dead_", "stay"],
		],
		exceptions: ["dialog.png", "button.png", "vs.png", "equip1.png", "equip2.png", "equip3.png", "equip4.png", "equip5.png", "equipHand.png"],
	},
	{ dir: "image/styles/xinsha/", owner: "yjcm" },
	{
		dir: "image/styles/online/",
		owner: "CONSUMER",
		dynamicPrefix: [
			["identity2_", "online"],
			["dead4_", "online"],
		],
	},
	{
		dir: "image/styles/baby/",
		owner: "CONSUMER",
		dynamicPrefix: [
			["identity3_", "baby"],
			["dead3_", "baby"],
			["hs_", "baby"],
		],
	},
	{
		dir: "image/styles/codename/",
		owner: "CONSUMER",
		dynamicPrefix: [
			["identity5_", "codename"],
			["dead_", "codename"],
		],
	},

	// ui/assets/character/<skin>/：皮肤 JS 的 IMAGE_PATH 动态消费，归皮肤所属样式。
	// shizhounian 被 decade + codename 两个皮肤跨包共用（P3-3 定案）→ 不设规则 = 留根。
	{ dir: "ui/assets/character/shousha/", owner: "mobile" },
	{ dir: "ui/assets/character/baby/", owner: "baby" },
	{ dir: "ui/assets/character/online/", owner: "online" },
	{ dir: "ui/assets/character/xinsha/", owner: "yjcm" },

	// ui/assets/skill/<skin>/：同理。yijiang 被 decade+yjcm 的 CSS 共用 → 留根。
	{ dir: "ui/assets/skill/shousha/", owner: "mobile" }, // 含 zhuanhuanji/（skill-state.js 按技能名拼图）
	{ dir: "ui/assets/skill/baby/", owner: "baby" }, // skillDisplay.js 按图标名拼
	{ dir: "ui/assets/skill/codename/", owner: "codename" },
	{ dir: "ui/assets/skill/online/", owner: "CONSUMER" }, // skillitem_xianding_active 被 yjcm CSS + online JS 消费 → 留根

	// ui/assets/lbtn：按消费点拆分
	{ dir: "ui/assets/lbtn/JSJM/", owner: "mobile" },
	{ dir: "ui/assets/lbtn/SFTS/", owner: "yjcm" },
	{
		// png 归 mobile（mobile CSS + 皮肤 JS）；caidan/label 两个 mp3 被多套皮肤 JS 播 → 留根；
		// xuanzhe.mp3 仅 mobile 皮肤 JS → mobile
		dir: "ui/assets/lbtn/shousha/",
		owner: "CONSUMER",
		exceptions: ["caidan.mp3", "label.mp3"],
	},
	{ dir: "ui/assets/lbtn/CD/", owner: "CONSUMER" }, // BJ/HOME/…/tuoguan2 多套共用留根；hs_*/button3/wenhao/… 单套归该套
	{ dir: "ui/assets/lbtn/OL_line/", owner: "CONSUMER" }, // bg/bgdialog、bg/gou、uibutton/back 多套共用留根，其余归 online
	{ dir: "ui/assets/lbtn/uibutton/", owner: "CONSUMER" }, // 逐文件按消费点

	// image/ui：只搬被单一样式消费的文件（消费点驱动）。
	// 多套共用（chat_bubble/turn_over_mask/item_bg/bj1/bj2/sprites_glow_*/feichumark/
	// mark_{jie,shen,sp,tw,player_mark,new_player_mark}/tie_suo）与 Core 动态拼名消费
	// （judge-mark 大部、misc/bg_xianding_*）及死资源自动留根。
	{ dir: "image/ui/dialog/", owner: "CONSUMER" },
	{ dir: "image/ui/mask/", owner: "CONSUMER" },
	{ dir: "image/ui/chain/", owner: "CONSUMER" },
	{ dir: "image/ui/judge-mark/", owner: "CONSUMER" },
	{ dir: "image/ui/effects/", owner: "CONSUMER" },
	{ dir: "image/ui/frame/", owner: "CONSUMER" },
	{ dir: "image/ui/misc/", owner: "CONSUMER" },
	{ dir: "image/ui/player-bg/", owner: "CONSUMER" },
	{ dir: "image/ui/mark/", owner: "CONSUMER" }, // 六套 player.css 各自引用子集；player_mark 等多套共用留根
];

// ───────────────── 3. 皮肤 JS 动态引用（路径常量拼接，静态扫描不可见） ─────────────────
const DYNAMIC_REFS = {
	decade: ["ui/assets/lbtn/CD/back.mp3", "ui/assets/lbtn/CD/button.mp3", "ui/assets/lbtn/CD/click.mp3", "ui/assets/lbtn/CD/button3.png", "ui/assets/lbtn/CD/wenhao.png", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/lbtn/shousha/label.mp3", "ui/assets/lbtn/uibutton/yinying.png"],
	mobile: ["ui/assets/lbtn/shousha/btn-paixu.png", "ui/assets/lbtn/shousha/button.png", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/lbtn/shousha/label.mp3", "ui/assets/lbtn/shousha/xuanzhe.mp3", "ui/assets/lbtn/shousha/zidongpaixu.png", "ui/assets/lbtn/uibutton/liaotian.png", "ui/assets/lbtn/uibutton/shenfen.png", "ui/assets/lbtn/uibutton/CZ.png"],
	yjcm: ["ui/assets/lbtn/CD/back.mp3", "ui/assets/lbtn/CD/button.mp3", "ui/assets/lbtn/CD/click.mp3", "ui/assets/lbtn/CD/huanfu.mp3", "ui/assets/lbtn/CD/new_button3.png", "ui/assets/lbtn/CD/new_wenhao.png", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/lbtn/shousha/label.mp3", "ui/assets/lbtn/uibutton/button_bj.png", "ui/assets/lbtn/uibutton/button_sz.png", "ui/assets/lbtn/uibutton/button_tc.png", "ui/assets/lbtn/uibutton/button_tg.png", "ui/assets/lbtn/uibutton/fanxuan.png", "ui/assets/lbtn/uibutton/new_zhengli.png", "ui/assets/lbtn/uibutton/quanxuan.png", "ui/assets/lbtn/uibutton/yinying.png"],
	online: ["ui/assets/lbtn/CD/back.mp3", "ui/assets/lbtn/CD/button.mp3", "ui/assets/lbtn/CD/click.mp3", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/skill/online/skillitem_extra_active.png", "ui/assets/skill/online/skillitem_xianding_active.png", "ui/assets/lbtn/OL_line/uibutton/beijing.png", "ui/assets/lbtn/OL_line/uibutton/gameview_tool_btn_chat.png", "ui/assets/lbtn/OL_line/uibutton/gameview_tool_btn_prop.png", "ui/assets/lbtn/OL_line/uibutton/gameview_tool_btn_sort.png", "ui/assets/lbtn/OL_line/uibutton/likai.png", "ui/assets/lbtn/OL_line/uibutton/shezhi.png", "ui/assets/lbtn/OL_line/uibutton/tuoguan_on.png"],
	baby: ["ui/assets/lbtn/CD/back.mp3", "ui/assets/lbtn/CD/button.mp3", "ui/assets/lbtn/CD/click.mp3", "ui/assets/lbtn/CD/hs_caidan.png", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/lbtn/uibutton/fanxuanhs.png", "ui/assets/lbtn/uibutton/hs_zhengli.png", "ui/assets/lbtn/uibutton/quanxuanhs.png"],
	codename: ["ui/assets/lbtn/CD/back.mp3", "ui/assets/lbtn/CD/button.mp3", "ui/assets/lbtn/CD/click.mp3", "ui/assets/lbtn/CD/codecaidan.png", "ui/assets/lbtn/shousha/caidan.mp3", "ui/assets/lbtn/uibutton/code_zhengli.png"],
};

// 修正项：消费点扫描抓不到/抓错的特例（审计记录见 docs/PROGRESS.md「资源热插拔审计」）
// 1) decade 皮肤 JS 的 sortImg 动态取值（zhengli/zhenglix）
DYNAMIC_REFS.decade.push("ui/assets/lbtn/uibutton/zhengli.png", "ui/assets/lbtn/uibutton/zhenglix.png");
// 2) huanfu.mp3 由共享的 ui/lbtn/skins/base.js 为**所有**皮肤播放 → 共享留根
//    （首版归属表把它误归 yjcm，这里强制留根）
// 3) online 皮肤经 `${IMAGE_PATH}../xinsha/` 逃逸消费 xinsha 目录的形象图 → 随 online 走
const REASSIGN = new Map([["ui/assets/lbtn/CD/huanfu.mp3", null], ...[0, 1, 2, 3, 4, 5].map(n => [`ui/assets/character/xinsha/xingxiang${n}.png`, "online"])]);
const FORCE_STAY = new Set(["ui/assets/lbtn/CD/huanfu.mp3"]);

// ───────────────── 消费点扫描 ─────────────────
const consumerTexts = [];
function collect(dir, tag) {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) collect(p, tag);
		else if (name.endsWith(".js") || name.endsWith(".css")) consumerTexts.push({ id: tag, text: readFileSync(p, "utf8") });
	}
}
collect(join(ROOT, "src"), "core");
if (existsSync(join(ROOT, "extension.js"))) consumerTexts.push({ id: "core", text: readFileSync(join(ROOT, "extension.js"), "utf8") });
for (const id of SIX) collect(join(ROOT, "modules", id, VERSION), id);

function staticConsumersOf(rootRel) {
	const ids = new Set();
	for (const { id, text } of consumerTexts) {
		if (text.includes(`"${rootRel}"`) || text.includes(`'${rootRel}'`) || text.includes("`" + rootRel) || text.includes(`/${rootRel}`)) ids.add(id);
	}
	return ids;
}
	function consumersOf(rootRel) {
		if (FORCE_STAY.has(rootRel)) return new Set(["__shared__"]);
		const ids = staticConsumersOf(rootRel);
		for (const [id, refs] of Object.entries(DYNAMIC_REFS)) {
			if (refs.includes(rootRel)) ids.add(id);
		}
		return ids;
	}

// ───────────────── 归属判定 ─────────────────
function resolveOwnership() {
	const plan = new Map(); // rootRel -> { owner, decl } | null(留根)
	const dirOf = rel => DIR_RULES.find(r => (r.file && r.file === rel) || (r.dir && rel.startsWith(r.dir)));
	const walk = dir => {
		if (!existsSync(dir)) return;
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) walk(p);
			else consider(toPosix(relative(ROOT, p)));
		}
	};
	const consider = rel => {
		if (plan.has(rel)) return;
		if (FORCE_OWNERS[rel]) {
			plan.set(rel, { owner: FORCE_OWNERS[rel], decl: rel });
			return;
		}
		const rule = dirOf(rel);
		if (!rule) {
			plan.set(rel, null); // 无规则 → 留根（Core/共享/中性死资源）
			return;
		}
		if (rule.file) {
			plan.set(rel, { owner: rule.owner, decl: rel });
			return;
		}
		const name = rel.slice(rule.dir.length);
		if (rule.exceptions?.some(x => (x.startsWith("prefix:") ? name.startsWith(x.slice(7)) : x === name))) {
			plan.set(rel, null); // 共享例外 → 留根
			return;
		}
		if (rule.dynamicPrefix) {
			for (const [prefix, owner] of rule.dynamicPrefix) {
				if (!name.startsWith(prefix)) continue;
				plan.set(rel, owner === "stay" ? null : { owner, decl: rule.dir });
				return;
			}
		}
		if (rule.owner !== "CONSUMER") {
			plan.set(rel, { owner: rule.owner, decl: rule.dir });
			return;
		}
		const ids = consumersOf(rel);
		const styleIds = [...ids].filter(x => x !== "core");
		if (ids.size === 0) plan.set(rel, null); // CONSUMER 目录里的死资源无处归属 → 留根
		else if (styleIds.length === 1 && ids.size === 1) plan.set(rel, { owner: styleIds[0], decl: rel }); // 唯一消费方是单一样式 → 随消费方
		else plan.set(rel, null); // 共享/核心 → 留根
	};
	for (const rel of Object.keys(FORCE_OWNERS)) {
		if (existsSync(join(ROOT, rel))) consider(rel);
	}
	for (const rule of DIR_RULES) {
		if (rule.dir) walk(join(ROOT, rule.dir));
		else if (rule.file && existsSync(join(ROOT, rule.file))) consider(rule.file);
	}
	return plan;
}

// ───────────────── CSS 重写 ─────────────────
function rewriteCssRefs(plan) {
	let rewritten = 0;
	const cross = [];
	for (const id of SIX) {
		const packRoot = join(ROOT, "modules", id, VERSION);
		const walk = dir => {
			for (const name of readdirSync(dir)) {
				const p = join(dir, name);
				if (statSync(p).isDirectory()) {
					walk(p);
					continue;
				}
				if (!name.endsWith(".css")) continue;
				const cssDir = toPosix(dirname(toPosix(relative(packRoot, p))));
				const text = readFileSync(p, "utf8");
				const next = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, ref) => {
					const target = ref.trim();
					if (!target || target.startsWith("#") || target.startsWith("data:")) return match;
					const rootRef = toPosix(relative(ROOT, resolve(dirname(p), target)));
					if (rootRef.startsWith("..")) return match; // 越界（本体资源）不动
					const entry = plan.get(rootRef);
					if (!entry) return match; // 留根/共享 → 不动
					if (entry.owner !== id) {
						cross.push(`${id}/${toPosix(relative(packRoot, p))} -> ${rootRef} 属于 ${entry.owner}`);
						return match;
					}
					rewritten++;
					return `url("${posix.relative(cssDir, rootRef)}")`; // 镜像布局：包内路径 == 原根路径
				});
				if (next !== text) writeFileSync(p, next, "utf8");
			}
		};
		walk(packRoot);
	}
	return { rewritten, cross };
}

// ───────────────── manifest.resources ─────────────────
function buildResources(movedEntries) {
	const decls = new Set();
	for (const { decl } of movedEntries) decls.add(decl);
	// 目录声明吞掉散文件声明（目录已覆盖的文件不再单列）
	const dirs = [...decls].filter(d => d.endsWith("/"));
	const files = [...decls].filter(d => !d.endsWith("/") && !dirs.some(d2 => d.startsWith(d2)));
	return [...dirs.sort(), ...files.sort()];
}

// ───────────────── 主流程 ─────────────────
const plan = resolveOwnership();
if (process.argv.includes("--probe")) {
	for (const rel of process.argv.slice(process.argv.indexOf("--probe") + 1)) {
		console.log(rel, "->", JSON.stringify(plan.get(rel) ?? "(无规则)"));
	}
	process.exit(0);
}
const moveList = [...plan.entries()].filter(([, e]) => e);
console.log(`归属表：候选 ${plan.size} 个文件，其中 ${moveList.length} 个搬入样式包`);

const movedByModule = Object.fromEntries(SIX.map(id => [id, []]));
let deduped = 0;
let conflicts = 0;
for (const [rel, entry] of moveList) {
	const srcAbs = join(ROOT, rel);
	if (!existsSync(srcAbs)) continue;
	const dstAbs = join(ROOT, "modules", entry.owner, VERSION, rel);
	if (!existsSync(dstAbs)) {
		if (!DRY) {
			mkdirSync(dirname(dstAbs), { recursive: true });
			copyFileSync(srcAbs, dstAbs);
			unlinkSync(srcAbs);
		}
		movedByModule[entry.owner].push({ rel, decl: entry.decl });
		continue;
	}
	// 包内已有副本（P4 复制过）：内容一致 → 直接删根（去重）；不一致 → 以包内为准，删根并报告
	const a = createHash("sha256").update(readFileSync(srcAbs)).digest("hex");
	const b = createHash("sha256").update(readFileSync(dstAbs)).digest("hex");
	if (a !== b) {
		conflicts++;
		console.warn(`[冲突] ${rel} 根与包内(${entry.owner})内容不同，以包内为准删除根副本`);
	} else {
		deduped++;
	}
	if (!DRY) unlinkSync(srcAbs);
	movedByModule[entry.owner].push({ rel, decl: entry.decl });
}
console.log(`搬入 ${Object.values(movedByModule).reduce((s, a) => s + a.length, 0)}（与包内副本去重 ${deduped}，内容冲突 ${conflicts}）`);

// REASSIGN：归属修正（包→包 或 包→根），并登记 manifest 增删
const manifestDelta = Object.fromEntries(SIX.map(id => [id, { add: new Set(), remove: new Set() }]));
for (const [rel, newOwner] of REASSIGN) {
	const srcInRoot = join(ROOT, rel);
	const oldOwner = SIX.find(id => existsSync(join(ROOT, "modules", id, VERSION, rel)));
	if (oldOwner && oldOwner !== newOwner) {
		const srcAbs = join(ROOT, "modules", oldOwner, VERSION, rel);
		const dstAbs = newOwner ? join(ROOT, "modules", newOwner, VERSION, rel) : srcInRoot;
		if (!DRY) {
			mkdirSync(dirname(dstAbs), { recursive: true });
			if (!existsSync(dstAbs)) copyFileSync(srcAbs, dstAbs);
			unlinkSync(srcAbs);
		}
		manifestDelta[oldOwner].remove.add(rel);
		if (newOwner) manifestDelta[newOwner].add.add(rel);
		console.log(`[REASSIGN] ${rel}: ${oldOwner} -> ${newOwner ?? "扩展根(共享)"}`);
	} else if (!oldOwner && newOwner && existsSync(srcInRoot)) {
		const dstAbs = join(ROOT, "modules", newOwner, VERSION, rel);
		if (!DRY) {
			mkdirSync(dirname(dstAbs), { recursive: true });
			copyFileSync(srcInRoot, dstAbs);
			unlinkSync(srcInRoot);
		}
		manifestDelta[newOwner].add.add(rel);
		movedByModule[newOwner].push({ rel, decl: rel });
		console.log(`[REASSIGN] ${rel}: 扩展根 -> ${newOwner}`);
	}
}
for (const id of SIX) console.log(`  ${id}: ${movedByModule[id].length}`);

if (!DRY) {
	const { rewritten, cross } = rewriteCssRefs(plan);
	console.log(`CSS url() 重写 ${rewritten} 处`);
	if (cross.length) {
		console.error(`[跨包引用，需人工裁定]\n${cross.join("\n")}`);
		process.exitCode = 1;
	}
	for (const id of SIX) {
		const manifestPath = join(ROOT, "modules", id, VERSION, "manifest.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		// 幂等合并：本次新搬入的声明与既有 resources 取并集，REASSIGN 做增删
		const existing = new Set(Array.isArray(manifest.resources) ? manifest.resources : []);
		for (const d of buildResources(movedByModule[id])) existing.add(d);
		for (const d of manifestDelta[id].add) existing.add(d);
		for (const d of manifestDelta[id].remove) existing.delete(d);
		manifest.resources = [...existing].sort();
		writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n", "utf8");
	}
	console.log("manifest.resources 已登记");
	for (const dir of ["image/styles/shousha", "image/styles/xinsha", "image/styles/online", "image/styles/baby", "image/styles/codename"]) {
		const abs = join(ROOT, dir);
		if (existsSync(abs) && readdirSync(abs).length === 0) rmSync(abs, { recursive: true });
	}
} else {
	for (const id of SIX) console.log(`  ${id} resources 预览:`, JSON.stringify(buildResources(movedByModule[id])));
}
console.log(DRY ? "(dry run，未写盘)" : "完成");
