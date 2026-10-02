#!/usr/bin/env node
/**
 * 皮肤 JS 资源引用重写（一次性，配合 scripts/migrate-style-assets.mjs）
 *
 * 只改"已迁入本样式包"的引用；跨皮肤共享（CD/*.mp3、shousha/caidan|label.mp3、
 * uibutton/QX|yinying 等）与本体资源一律不动。每个替换都是显式 old→new。
 * 帮助函数：
 *   packAsset(rel) → 包内资源 URL（src / backgroundImage 用）
 *   packAudio(rel) → 本体 playAudio 相对路径（../extension/<名>/modules/<id>/<ver>/...）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(readFileSync(join(ROOT, "info.json"), "utf8")).version;
const DRY = process.argv.includes("--dry");

/** [文件, 原文, 新文, 幂等标记?] —— old 是 new 前缀的插入型编辑必须给 marker */
const EDITS = [];
const addHelpers = (file, id, base) =>
	EDITS.push([
		file,
		`const assetPath = \`\${decadeUIPath}${base}/\`;`,
		`const assetPath = \`\${decadeUIPath}${base}/\`;\n\t// 本样式包内资源（资源热插拔迁移后）；共享资源仍走 assetPath（扩展根）\n\tconst packAsset = rel => window.decadeUI.resource.getAsset("${id}", \`${base}/\${rel}\`);\n\tconst packAudio = rel => \`../extension/\${decadeUIName}/\${window.decadeUI.resource.getModuleRel("${id}")}${base}/\${rel}\`;`,
		`const packAsset = rel => window.decadeUI.resource.getAsset("${id}"`,
	]);

// ── decade lbtn ──
const D_LBTN = `modules/decade/${VERSION}/ui/lbtn/skins/shizhounian.js`;
addHelpers(D_LBTN, "decade", "ui/assets/lbtn");
EDITS.push(
	[D_LBTN, "btn.src = `${lib.assetURL}${assetPath}CD/wenhao.png`;", "btn.src = packAsset(`CD/wenhao.png`);"],
	[D_LBTN, "menuBtn.src = `${lib.assetURL}${assetPath}CD/button3.png`;", "menuBtn.src = packAsset(`CD/button3.png`);"],
	[D_LBTN, "btn.src = `${lib.assetURL}${assetPath}uibutton/${sortImg}`;", "btn.src = packAsset(`uibutton/${sortImg}`);"]
	// yinying.png（与 yjcm 共用）、CD/*.mp3、shousha/{caidan,label}.mp3：共享留根，不动
);

// ── mobile lbtn ──
const M_LBTN = `modules/mobile/${VERSION}/ui/lbtn/skins/shousha.js`;
addHelpers(M_LBTN, "mobile", "ui/assets/lbtn");
EDITS.push(
	[M_LBTN, "btn.src = `${lib.assetURL}${assetPath}uibutton/liaotian.png`;", "btn.src = packAsset(`uibutton/liaotian.png`);"],
	[M_LBTN, "headImg.src = `${lib.assetURL}${assetPath}shousha/button.png`;", "headImg.src = packAsset(`shousha/button.png`);"],
	[M_LBTN, "tip.src = `${lib.assetURL}${assetPath}uibutton/shenfen.png`;", "tip.src = packAsset(`uibutton/shenfen.png`);"],
	[M_LBTN, "game.playAudio(`../${assetPath}shousha/xuanzhe.mp3`);", "game.playAudio(packAudio(`shousha/xuanzhe.mp3`));"],
	[M_LBTN, "confirm.node.cancel.innerHTML = `<img draggable='false' src='${decadeUIPath}ui/assets/lbtn/uibutton/QX.png'>`;", "confirm.node.cancel.innerHTML = `<img draggable='false' src='${window.decadeUI.resource.getAsset('mobile', 'ui/assets/lbtn/uibutton/QX.png')}'>`;"],
	[M_LBTN, "item.innerHTML = `<img draggable='false' src='${decadeUIPath}ui/assets/lbtn/uibutton/CZ.png'>`;", "item.innerHTML = `<img draggable='false' src='${window.decadeUI.resource.getAsset('mobile', 'ui/assets/lbtn/uibutton/CZ.png')}'>`;"],
	[M_LBTN, "item.style.backgroundImage = `url('${decadeUIPath}ui/assets/lbtn/uibutton/game_btn_bg2.png')`;", "item.style.backgroundImage = `url('${window.decadeUI.resource.getAsset('mobile', 'ui/assets/lbtn/uibutton/game_btn_bg2.png')}')`;"],
	[M_LBTN, "paixuauto.setBackgroundImage(`${assetPath}shousha/zidongpaixu.png`);", "paixuauto.setBackgroundImage(packAsset(`shousha/zidongpaixu.png`));"],
	[M_LBTN, "paixuauto.setBackgroundImage(`${assetPath}shousha/btn-paixu.png`);", "paixuauto.setBackgroundImage(packAsset(`shousha/btn-paixu.png`));"]
	// QX.png（core hooks.js 也用，已随 hooks 留根）、label/caidan.mp3 共享留根，不动
);

// ── yjcm lbtn ──
const Y_LBTN = `modules/yjcm/${VERSION}/ui/lbtn/skins/xinsha.js`;
addHelpers(Y_LBTN, "yjcm", "ui/assets/lbtn");
EDITS.push(
	[Y_LBTN, "btn.src = `${lib.assetURL}${assetPath}CD/new_wenhao.png`;", "btn.src = packAsset(`CD/new_wenhao.png`);"],
	[Y_LBTN, "btnBg.src = `${lib.assetURL}${assetPath}CD/new_button3.png`;", "btnBg.src = packAsset(`CD/new_button3.png`);"],
	[Y_LBTN, "szBtn.setBackgroundImage(`${assetPath}uibutton/button_sz.png`);", "szBtn.setBackgroundImage(packAsset(`uibutton/button_sz.png`));"],
	[Y_LBTN, "bjBtn.setBackgroundImage(`${assetPath}uibutton/button_bj.png`);", "bjBtn.setBackgroundImage(packAsset(`uibutton/button_bj.png`));"],
	[Y_LBTN, "tgBtn.setBackgroundImage(`${assetPath}uibutton/button_tg.png`);", "tgBtn.setBackgroundImage(packAsset(`uibutton/button_tg.png`));"],
	[Y_LBTN, "tcBtn.setBackgroundImage(`${assetPath}uibutton/button_tc.png`);", "tcBtn.setBackgroundImage(packAsset(`uibutton/button_tc.png`));"],
	[Y_LBTN, "btn.src = `${lib.assetURL}${assetPath}uibutton/new_zhengli.png`;", "btn.src = packAsset(`uibutton/new_zhengli.png`);"],
	[Y_LBTN, "? `${lib.assetURL}${assetPath}uibutton/fanxuan.png`", "? packAsset(`uibutton/fanxuan.png`)"],
	[Y_LBTN, ": `${lib.assetURL}${assetPath}uibutton/quanxuan.png`;", ": packAsset(`uibutton/quanxuan.png`);"]
	// yinying.png（与 decade 共用）、CD/*.mp3、huanfu.mp3（共享 base 播放，已归扩展根）、shousha/{caidan,label}.mp3：不动
);

// ── online lbtn ──
const O_LBTN = `modules/online/${VERSION}/ui/lbtn/skins/online.js`;
addHelpers(O_LBTN, "online", "ui/assets/lbtn");
EDITS.push(
	[O_LBTN, "szBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/shezhi.png`);", "szBtn.setBackgroundImage(packAsset(`OL_line/uibutton/shezhi.png`));"],
	[O_LBTN, "bjBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/beijing.png`);", "bjBtn.setBackgroundImage(packAsset(`OL_line/uibutton/beijing.png`));"],
	[O_LBTN, "tgBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/tuoguan_on.png`);", "tgBtn.setBackgroundImage(packAsset(`OL_line/uibutton/tuoguan_on.png`));"],
	[O_LBTN, "tcBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/likai.png`);", "tcBtn.setBackgroundImage(packAsset(`OL_line/uibutton/likai.png`));"],
	[O_LBTN, "giftBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/gameview_tool_btn_prop.png`);", "giftBtn.setBackgroundImage(packAsset(`OL_line/uibutton/gameview_tool_btn_prop.png`));"],
	[O_LBTN, "talkBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/gameview_tool_btn_chat.png`);", "talkBtn.setBackgroundImage(packAsset(`OL_line/uibutton/gameview_tool_btn_chat.png`));"],
	[O_LBTN, "sortBtn.setBackgroundImage(`${assetPath}OL_line/uibutton/gameview_tool_btn_sort.png`);", "sortBtn.setBackgroundImage(packAsset(`OL_line/uibutton/gameview_tool_btn_sort.png`));"],
	[O_LBTN, "gift.setBackgroundImage(`${assetPath}OL_line/gift/${config.image}`);", "gift.setBackgroundImage(packAsset(`OL_line/gift/${config.image}`));"],
	[O_LBTN, "gift2.setBackgroundImage(`${assetPath}OL_line/gift/${giftType.image}`);", "gift2.setBackgroundImage(packAsset(`OL_line/gift/${giftType.image}`));"]
	// CD/*.mp3：共享留根，不动
);

// ── baby lbtn ──
const B_LBTN = `modules/baby/${VERSION}/ui/lbtn/skins/baby.js`;
addHelpers(B_LBTN, "baby", "ui/assets/lbtn");
EDITS.push(
	[B_LBTN, "btn.src = `${lib.assetURL}${assetPath}uibutton/hs_zhengli.png`;", "btn.src = packAsset(`uibutton/hs_zhengli.png`);"],
	[B_LBTN, "? `${lib.assetURL}${assetPath}uibutton/fanxuanhs.png`", "? packAsset(`uibutton/fanxuanhs.png`)"],
	[B_LBTN, ": `${lib.assetURL}${assetPath}uibutton/quanxuanhs.png`;", ": packAsset(`uibutton/quanxuanhs.png`);"],
	[B_LBTN, "menuBtn.src = `${lib.assetURL}${assetPath}CD/hs_caidan.png`;", "menuBtn.src = packAsset(`CD/hs_caidan.png`);"]
	// CD/*.mp3、shousha/caidan.mp3：共享留根，不动
);

// ── codename lbtn ──
const C_LBTN = `modules/codename/${VERSION}/ui/lbtn/skins/codename.js`;
addHelpers(C_LBTN, "codename", "ui/assets/lbtn");
EDITS.push(
	[C_LBTN, "btn.src = `${lib.assetURL}${assetPath}uibutton/code_zhengli.png`;", "btn.src = packAsset(`uibutton/code_zhengli.png`);"],
	[C_LBTN, "menuBtn.src = `${lib.assetURL}${assetPath}CD/codecaidan.png`;", "menuBtn.src = packAsset(`CD/codecaidan.png`);"]
	// CD/*.mp3、shousha/caidan.mp3：共享留根，不动
);

// ── character skins（IMAGE_PATH 常量改经 resourceLoader；包内镜像路径不变） ──
EDITS.push(
	[`modules/yjcm/${VERSION}/ui/character/skins/xinsha.js`, "const IMAGE_PATH = `${decadeUIPath}ui/assets/character/xinsha/`;", 'const IMAGE_PATH = window.decadeUI.resource.getAsset("yjcm", "ui/assets/character/xinsha/");'],
	[`modules/online/${VERSION}/ui/character/skins/online.js`, "const IMAGE_PATH = `${decadeUIPath}ui/assets/character/online/`;", 'const IMAGE_PATH = window.decadeUI.resource.getAsset("online", "ui/assets/character/online/");'],
	[`modules/baby/${VERSION}/ui/character/skins/baby.js`, "const IMAGE_PATH = `${decadeUIPath}ui/assets/character/baby/`;", 'const IMAGE_PATH = window.decadeUI.resource.getAsset("baby", "ui/assets/character/baby/");']
	// decade/shizhounian 与 codename 的 IMAGE_PATH 指向 character/shizhounian/（两包跨用，共享留根）：不动
);

// ── mobile character skin 的 SHOUSHA_CONSTANTS（ui/constants.js 的字面量指扩展根） ──
const M_CHAR = `modules/mobile/${VERSION}/ui/character/skins/shousha.js`;
EDITS.push(
	[M_CHAR, 'import { SHOUSHA_CONSTANTS, SHOUSHA_LAYOUT } from "../../../../../../ui/constants.js";', `import { SHOUSHA_CONSTANTS, SHOUSHA_LAYOUT } from "../../../../../../ui/constants.js";\n// character/shousha 已迁入 mobile 包：形象/段位等包内资源经 resourceLoader 按安装状态寻址；\n// AUDIO_PATH（lbtn/shousha 的 mp3）是跨皮肤共享，留在扩展根。\nconst IMAGE_PATH = window.decadeUI.resource.getAsset("mobile", "ui/assets/character/shousha/");\nconst IMAGE_PATH_PREFIX = window.decadeUI.resource.getAsset("mobile", "ui/assets/character/shousha/dengjie/");`, 'const IMAGE_PATH = window.decadeUI.resource.getAsset("mobile", "ui/assets/character/shousha/")'],
	[M_CHAR, "${SHOUSHA_CONSTANTS.IMAGE_PATH_PREFIX}", "${IMAGE_PATH_PREFIX}"],
	[M_CHAR, "${SHOUSHA_CONSTANTS.IMAGE_PATH}", "${IMAGE_PATH}"]
	// SHOUSHA_CONSTANTS.AUDIO_PATH 保持原样（共享 mp3 在扩展根）
);

// ── skill skins（ASSETS_PATH 常量） ──
EDITS.push(
	[`modules/mobile/${VERSION}/ui/skill/skins/shousha.js`, "const ASSETS_PATH = `${decadeUIPath}ui/assets/skill/shousha`;", 'const ASSETS_PATH = window.decadeUI.resource.getAsset("mobile", "ui/assets/skill/shousha");'],
	[`modules/online/${VERSION}/ui/skill/skins/online.js`, "const ASSETS_PATH = `${decadeUIPath}ui/assets/skill/online`;", 'const ASSETS_PATH = window.decadeUI.resource.getAsset("online", "ui/assets/skill/online");'],
	[`modules/baby/${VERSION}/ui/skill/skins/baby.js`, "const ASSETS_PATH = `${decadeUIPath}ui/assets/skill/baby`;", 'const ASSETS_PATH = window.decadeUI.resource.getAsset("baby", "ui/assets/skill/baby");']
	// decade/shizhounian、yjcm/xinsha、codename 的 skill 皮肤引用见各自文件核对（shizhounian 已在包内/yijiang 共享留根）
);

let applied = 0;
let missing = 0;
const byFile = new Map();
for (const [file, oldStr, newStr, marker] of EDITS) {
	const abs = join(ROOT, file);
	let text;
	try {
		text = readFileSync(abs, "utf8");
	} catch {
		console.error(`[缺文件] ${file}`);
		missing++;
		continue;
	}
	if (marker && text.includes(marker)) continue; // 插入型编辑已生效
	if (!text.includes(oldStr)) {
		// 幂等：已经是新文就跳过
		if (text.includes(newStr)) continue;
		console.error(`[未命中] ${file}: ${JSON.stringify(oldStr.slice(0, 90))}`);
		missing++;
		continue;
	}
	const occurrences = text.split(oldStr).length - 1;
	if (!DRY) writeFileSync(abs, text.split(oldStr).join(newStr), "utf8");
	applied += occurrences;
	byFile.set(file, (byFile.get(file) || 0) + occurrences);
}
console.log(`${DRY ? "(dry) " : ""}替换 ${applied} 处 / 未命中 ${missing} 处，涉及 ${byFile.size} 个文件`);
for (const [f, n] of byFile) console.log(`  ${f}: ${n}`);
