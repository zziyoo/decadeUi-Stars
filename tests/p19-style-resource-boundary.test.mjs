/**
 * P19 资源热插拔边界测试（任务书§十二 A~E）
 *
 * 背景：此前"部分资源已热插拔"——image/styles、image/ui 样式专属图、ui/assets 皮肤资产、
 * audio 与 assets/animation 的样式专属件仍留在扩展根，生产代码用 decadeUIPath 硬拼根路径
 * 绕过 resourceLoader / ModuleManager。本轮把它们全部迁入 modules/<id>/<version>/（镜像路径），
 * 运行时经 resourceLoader 按安装状态寻址。本套件把新的资源边界钉死：
 *
 *   A. 六套样式的资源根：manifest.resources 形状合法、非空（运行时 getModuleRel 语义由 p3 套件锁定）
 *   B. Style 专属资源完整性：每套声明展开后逐文件可达（image/styles、image/ui、ui/assets、audio、animation）
 *   C. 不偷偷读根：src/ 与根 ui/ 的生产代码不得再硬拼指向已迁走资源的扩展根路径
 *   D. 安装包资源完整性：findMissingResources 纯函数语义（构建门禁 / verify-pack / 安装器共用）
 *   E. 根目录残留扫描：样式专属路径不得继续存在于扩展根；共享与自建卡面等合法例外留根
 *   F. Core CSS 资源边界：src/styles/*.css 不得引用已迁入样式包的专属资源
 *     （meihua.css 的 .baby_skill_box 曾在拆包后仍引用 ui/assets/skill/baby/btnnhs3.png，
 *      baby 包未装时 404——该样式已随 P21 迁入 baby 包，由本段钉死同类缺口）
 *
 * 运行：node --import ./tests/helpers/register.mjs tests/p19-style-resource-boundary.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findMissingResources, validateManifest } from "../src/core/manifest.js";

const VERSION = JSON.parse(fs.readFileSync("info.json", "utf8")).version;
const SIX = ["decade", "mobile", "yjcm", "online", "baby", "codename"];
const packFile = (id, rel) => path.join("modules", id, VERSION, rel);
const readPackManifest = id => JSON.parse(fs.readFileSync(packFile(id, "manifest.json"), "utf8"));
const exists = rel => fs.existsSync(rel);
const readText = rel => fs.readFileSync(rel, "utf8");

/** 递归列出包内文件（包根相对 POSIX 路径） */
function listPackFiles(id) {
	const root = packFile(id, "");
	const out = [];
	const walk = dir => {
		for (const name of fs.readdirSync(dir)) {
			const p = path.join(dir, name);
			if (fs.statSync(p).isDirectory()) walk(p);
			else out.push(path.relative(root, p).split(path.sep).join("/"));
		}
	};
	walk(root);
	return out.sort();
}

// ── A. 六套样式的资源根：manifest.resources 形状合法且非空 ──
{
	for (const id of SIX) {
		const manifest = readPackManifest(id);
		const check = validateManifest(manifest);
		assert.equal(check.ok, true, `${id} manifest 校验失败：${check.errors.join("；")}`);
		assert.ok(Array.isArray(manifest.resources) && manifest.resources.length > 0, `${id} 必须声明 resources 资源边界`);
		for (const entry of manifest.resources) {
			assert.ok(!entry.split("/").includes(".."), `${id} resources 声明不得上溯：${entry}`);
			assert.ok(!entry.startsWith("/"), `${id} resources 声明必须是包内相对路径：${entry}`);
		}
	}
	console.log("A ok：六套 manifest.resources 形状合法且非空");
}

// ── B. Style 专属资源完整性：声明展开逐文件可达 + 关键归属锚点 ──
{
	// 每套必须声明（边界锚点）：样式图目录/文件、皮肤资产、以及样式专属的 audio/animation（若有）
	const ANCHORS = {
		decade: ["image/ui/mark/", "ui/assets/skill/shizhounian/", "ui/assets/lbtn/uibutton/"],
		mobile: ["image/styles/shousha/", "ui/assets/character/shousha/", "ui/assets/skill/shousha/", "audio/game_start_shousha.mp3", "assets/animation/effect_youxikaishi_shousha.atlas", "assets/animation/effect_youxikaishi_shousha.png", "assets/animation/effect_youxikaishi_shousha.skel"],
		yjcm: ["image/styles/xinsha/", "ui/assets/character/xinsha/", "ui/assets/lbtn/SFTS/"],
		online: ["image/styles/online/", "ui/assets/character/online/", "ui/assets/character/xinsha/xingxiang0.png"],
		baby: ["image/styles/baby/", "ui/assets/character/baby/", "ui/assets/skill/baby/"],
		codename: ["image/styles/codename/", "ui/assets/skill/codename/"],
	};
	for (const id of SIX) {
		const manifest = readPackManifest(id);
		const files = listPackFiles(id);
		const missing = findMissingResources(manifest.resources, files);
		assert.deepEqual(missing, [], `${id} manifest.resources 声明的资源缺失：${missing.join("、")}`);
		for (const anchor of ANCHORS[id]) {
			const covered = anchor.endsWith("/") ? files.some(f => f.startsWith(anchor)) || manifest.resources.some(r => r.startsWith(anchor)) : manifest.resources.includes(anchor);
			assert.ok(covered, `${id} 缺少归属锚点 ${anchor}（资源边界没有覆盖该样式专属资产）`);
		}
	}
	// Spine 三件套必须作为一个完整资源单元归属同一套（.atlas/.png/.skel 缺一不可）
	for (const [id, base] of [["mobile", "assets/animation/effect_youxikaishi_shousha"], ["decade", "assets/animation/effect_youxikaishi"]]) {
		const owner = id === "mobile" ? packFile(id, `${base}.atlas`) : `${base}.atlas`;
		assert.ok(exists(owner), `${base}.atlas 缺失`);
		const packDir = id === "mobile" ? packFile(id, "assets/animation") : "assets/animation";
		for (const ext of [".atlas", ".png", ".skel"]) {
			assert.ok(exists(path.join(packDir, path.basename(base) + ext)), `${base}${ext} 与其三件套不同根（Spine 三件套必须整体迁移）`);
		}
	}
	// B-2：反向完整性——包内实际资源必须全部被 resources 覆盖（防"文件已迁入、忘写声明"；
	// decade 的 ui/assets/skill/shizhounian/ 27 个文件曾漏声明，正是本检查要钉死的缺口）。
	// 豁免：manifest.json 自身与 entry 声明的 JS/CSS（结构性文件，不算资源）。
	for (const id of SIX) {
		const manifest = readPackManifest(id);
		const files = listPackFiles(id);
		const exempt = new Set(["manifest.json", ...(manifest.entry?.js ?? []), ...(manifest.entry?.css ?? [])]);
		const coveredBy = rel => manifest.resources.some(entry => (entry.endsWith("/") ? rel.startsWith(entry) : rel === entry));
		const undeclared = files.filter(f => !exempt.has(f) && !coveredBy(f));
		assert.deepEqual(undeclared, [], `${id} 包内有实际资源未被 manifest.resources 覆盖（迁入后忘写声明）：${undeclared.join("、")}`);
	}
	console.log("B ok：六套资源声明逐文件可达 + 归属锚点齐全 + Spine 三件套整体归属 + 反向零未声明");
}

// ── C. 不偷偷读根：生产代码不得硬拼指向已迁走资源的扩展根路径 ──
// 四段：①同行直拼扫描（白名单=共享 decade 家族）；②样式专属 image/styles 字面量必须与模块 ID 配对；
// ③直拼扩展根的字面量必须命中留在根的真实资源（扫描面含包内 UI JS——补两处实际漏网盲点后加）；
// ④包内 UI JS 经"包路由基址"拼的资源必须在包内可达（online 的 skillitem_yinyang_1/2 曾 404 后加）；
// ⑤字面量 getAsset(id, 静态路径) 必须在包内可达（手杀取消按钮的 QX.png 曾走包路由 404 后加）。
{
	// 共享 decade 家族：on/othersOff(+codename) 经 Core JS 交叉消费，允许留根直拼
	const SHARED_DECADE_PREFIXES = ["image/styles/decade/identity_", "image/styles/decade/name_", "image/styles/decade/dead_"];

	/** 扫一个文件：返回所有 decadeUIPath 与 image/styles/… 拼接的路径字面量 */
	const decadeUIPathImageStylesLiterals = text => {
		const hits = [];
		const re = /decadeUIPath\s*\+\s*["'`]([^"'`]*image\/styles\/[^"'`]+)["'`]/g;
		let m;
		while ((m = re.exec(text))) hits.push(m[1]);
		const re2 = /\$\{decadeUIPath\}(image\/styles\/[^"'`$]+)/g;
		while ((m = re2.exec(text))) hits.push(m[1]);
		return hits;
	};

	const SCAN_FILES = ["src/ui/player-element.js", "src/ui/player-group.js", "src/overrides/player/animations.js", "src/ui/skillDisplay.js", "src/overrides/player/skill-state.js", "src/skills/animate.js"];
	for (const file of SCAN_FILES) {
		assert.ok(exists(file), `生产代码文件缺失：${file}`);
		const text = readText(file);
		for (const literal of decadeUIPathImageStylesLiterals(text)) {
			const allowed = SHARED_DECADE_PREFIXES.some(p => literal.startsWith(p));
			assert.ok(allowed, `${file} 仍在硬拼扩展根的样式专属图路径：${literal}（样式专属资源必须经 resourceLoader 按模块寻址）`);
		}
	}

	// 各路由点必须真的在用 resourceLoader（防止"白名单遮蔽回退"）
	assert.match(readText("src/ui/player-element.js"), /getModuleSystem\(\)\.resourceLoader\.getAsset\(routed\[0\]/, "player-element 身份图必须经 resourceLoader 路由");
	assert.match(readText("src/ui/player-group.js"), /resourceLoader\.getAsset\(routed\[0\]/, "player-group 势力图必须经 resourceLoader 路由");
	assert.match(readText("src/overrides/player/animations.js"), /resourceLoader\.getAsset\("mobile"/, "animations 死亡图必须把 shousha 族路由到 mobile");
	assert.match(readText("src/overrides/player/animations.js"), /resourceLoader\.getAsset\("mobile", "image\/ui\/misc\/likai\.png"/, "likai.png（mobile 门控）必须路由到 mobile");
	assert.match(readText("src/ui/skillDisplay.js"), /getAsset\("baby"/, "skillDisplay 的 baby 图标必须经 resourceLoader 路由");
	assert.match(readText("src/overrides/player/skill-state.js"), /getAsset\("mobile", `ui\/assets\/skill\/shousha\/zhuanhuanji\//, "skill-state 转换技图必须路由到 mobile");
	assert.match(readText("src/skills/animate.js"), /getModuleRel\("mobile"\)/, "开场音频的 shousha 变体必须经 getModuleRel 路由到 mobile");
	assert.match(readText("src/animation/gameIntegration.js"), /STYLE_OWNED_ANIMATIONS = \{\s*effect_youxikaishi_shousha: "mobile"/, "样式专属动画归属表必须把 youxikaishi_shousha 归 mobile");
	assert.match(readText("src/animation/gameIntegration.js"), /assetResolver = resolveAnimationPath/, "AnimationPlayer 必须接上资源解析钩子");

	// 根级共享皮肤基建里指向 shousha 包内资产的默认路径：只有 utils.js 的两个死代码默认值
	// （getGroupBackgroundImage/numberToImages 无运行时调用方），base.js 的默认族背景同样无人调用——
	// 这里钉死"不新增"，已存在的死代码默认值不算偷读。
	const baseJs = readText("ui/character/skins/base.js");
	assert.ok(!/decadeUIPath\s*\+\s*["'`]ui\/assets\/skill\//.test(baseJs), "根级 base.js 不得硬拼样式专属 skill 资产");
	// C-2：样式专属 image/styles 字面量必须与模块 ID / 寻址助手配对（抓"变量间接拼接"盲点——
	// player-element 曾用 `decadeUIPath + (style==="off" ? fallbackPrefix : …)` 同行正则扫不到）。
	const NON_DECADE_STYLE_LITERAL = /image\/styles\/(shousha|xinsha|online|baby|codename)\//;
	const ROUTED_PAIRING = /getAsset\(|getModuleRel\(|\["[a-z-]+"\s*,\s*[`'"]/;
	for (const file of SCAN_FILES) {
		readText(file).split("\n").forEach((line, i) => {
			if (NON_DECADE_STYLE_LITERAL.test(line)) {
				assert.match(line, ROUTED_PAIRING, `${file}:${i + 1} 样式专属 image/styles 路径必须与模块 ID 配对并经 resourceLoader 寻址：${line.trim()}`);
			}
		});
	}

	// C-3：直拼扩展根的字面量必须命中留在根的真实资源（抓"资源迁走了、代码还指根"的陈旧路径——
	// yjcm 皮肤曾内联 ${decadeUIPath}ui/assets/character/xinsha/unknown.png 而该文件已随包迁走）。
	// 模板占位按前缀算：目录存在且目录内有同前缀文件即命中。扫描面 = 六个运行时代码 + 全部包内 UI JS。
	const packUiFiles = [];
	for (const id of SIX) {
		const uiDir = packFile(id, "ui");
		if (!exists(uiDir)) continue;
		const walk = dir => {
			for (const name of fs.readdirSync(dir)) {
				const p = path.join(dir, name);
				if (fs.statSync(p).isDirectory()) walk(p);
				else if (name.endsWith(".js")) packUiFiles.push(p.split(path.sep).join("/"));
			}
		};
		walk(uiDir);
	}
	const resolvesAtRoot = rel => {
		if (exists(rel) || exists(`${rel}.png`)) return true;
		const dir = path.posix.dirname(rel);
		if (!exists(dir)) return false;
		const base = path.posix.basename(rel);
		try {
			return fs.readdirSync(dir).some(name => name.startsWith(base));
		} catch {
			return false;
		}
	};
	for (const file of [...SCAN_FILES, ...packUiFiles]) {
		readText(file).split("\n").forEach((line, i) => {
			const literals = [];
			for (const m of line.matchAll(/decadeUIPath\s*\+\s*["'`]([^"'`]+)["'`]/g)) literals.push(m[1]);
			for (const m of line.matchAll(/\$\{decadeUIPath\}([^"'`$]*)/g)) literals.push(m[1]);
			for (const raw of literals) {
				const lit = raw.split("${")[0].replace(/[^A-Za-z0-9_./-]+$/, "");
				if (!lit) continue;
				assert.ok(resolvesAtRoot(lit), `${file}:${i + 1} 直拼扩展根的字面量在根上不存在（资源已迁走必须改经 resourceLoader）：${lit}`);
			}
		});
	}

	// C-4：包内 UI JS 经"包路由基址"（`resource.getAsset(id, base)` 常数）拼接的资源必须在包内可达——
	// 抓反方向盲点：基址已路由到包、目标文件却留在根（online 的 skillitem_yinyang_1/2.png 曾因此 404）。
	// 动态段优先按三元字面量枚举候选（候选须逐一存在）；枚举不了再退"前缀+后缀存在任一文件"。
	for (const file of packUiFiles) {
		const text = readText(file);
		const bases = [...text.matchAll(/const\s+(\w+)\s*=\s*window\.decadeUI\.resource\.getAsset\(\s*"([a-z-]+)"\s*,\s*"([^"]*)"\s*\)/g)];
		if (!bases.length) continue;
		for (const [, name, id, base] of bases) {
			const files = listPackFiles(id);
			const prefix = base.endsWith("/") ? base : `${base}/`;
			const exists = rel => files.includes(`${prefix}${rel}`);
			const re = new RegExp("\\$\\{" + name + "\\}([^`]*)", "g");
			for (const m of text.matchAll(re)) {
				const rest = m[1];
				if (!rest.startsWith("/")) continue;
				const target = rest.slice(1);
				const head = target.split("${")[0];
				const tail = (target.match(/\$\{[^}]*\}(.*)$/) ?? [])[1] ?? "";
				const alts = [...target.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].flatMap(x => [x[1], x[2]]);
				const line = text.slice(0, m.index).split("\n").length;
				if (alts.length) {
					for (const candidate of alts.map(a => `${head}${a}${tail}`)) {
						assert.ok(exists(candidate), `${file}:${line} 包路由基址引用在包内不存在：${prefix}${candidate}`);
					}
				} else if (target.includes("${")) {
					assert.ok(files.some(r => r.startsWith(prefix + head) && r.endsWith(tail)), `${file}:${line} 包路由基址引用的动态资源在包内找不到：${prefix}${head}*${tail}`);
				} else {
					assert.ok(exists(target), `${file}:${line} 包路由基址引用在包内不存在：${prefix}${target}`);
				}
			}
		}
	}

	// C-5：字面量 getAsset("<id>", "<静态路径>") 必须在对应包内可达——包皮肤只在包存在时才运行，
	// 路由必然落在包内；共享文件不得走 getAsset 而应走扩展根路径（手杀取消按钮的 QX.png 曾因此破图）。
	for (const file of [...SCAN_FILES, ...packUiFiles]) {
		const text = readText(file);
		for (const m of text.matchAll(/resource\.getAsset\(\s*["']([a-z-]+)["']\s*,\s*["']([^"']+)["']\s*\)/g)) {
			const [, id, literal] = m;
			if (literal.includes("${")) continue;
			if (!exists(packFile(id, ""))) continue;
			const files = listPackFiles(id);
			const covered = files.includes(literal) || files.some(f => f.startsWith(literal.endsWith("/") ? literal : `${literal}/`));
			assert.ok(covered, `${file} 字面量 getAsset("${id}", "${literal}") 在包内不可达（共享文件应走扩展根路径，样式专属文件必须随包）`);
		}
	}

	// 死常量不许被重新消费：SHOUSHA_CONSTANTS.IMAGE_PATH(_PREFIX) 仍指扩展根 shousha 资产（已迁 mobile），
	// 实测无消费方；重新启用前必须先改成 resourceLoader 寻址（AUDIO_PATH 不在此列——caidan/label.mp3 是共享件留根）。
	const staleConstFiles = [...SCAN_FILES, ...packUiFiles, "ui/character/skins/base.js"]
		.filter(f => /SHOUSHA_CONSTANTS\.(IMAGE_PATH|IMAGE_PATH_PREFIX)/.test(readText(f)));
	assert.deepEqual(staleConstFiles, [], `SHOUSHA_CONSTANTS.IMAGE_PATH(_PREFIX) 是死常量（路径已迁走），不得被重新消费：${staleConstFiles.join("、")}`);

	console.log("C ok：绕根引用清零 + 样式图字面量配对 + 根直拼字面量盘上可达 + 包路由基址/字面量 getAsset 引用包内可达（共享 decade 家族白名单除外）");
}

// ── D. 安装包资源完整性：findMissingResources 语义（verify-pack / 构建门禁 / 安装器共用） ──
{
	assert.deepEqual(findMissingResources([], ["a.png"]), [], "空声明不报缺");
	assert.deepEqual(findMissingResources(["dir/"], ["dir/a.png", "dir/sub/b.png"]), [], "目录声明覆盖递归文件");
	assert.deepEqual(findMissingResources(["dir/"], ["other.png"]), ["dir/"], "目录声明罩不到任何文件 ⇒ 缺失");
	assert.deepEqual(findMissingResources(["a.png"], ["a.png"]), [], "单文件声明命中");
	assert.deepEqual(findMissingResources(["a.png"], []), ["a.png"], "单文件声明缺失");
	assert.deepEqual(findMissingResources(["assets/animation/effect_youxikaishi_shousha.png"], ["assets/animation/effect_youxikaishi_shousha.png"]), [], "Spine 单件按文件声明可达");

	const bad = manifest => validateManifest(manifest).errors.join("；");
	assert.match(bad({ schema: 1, id: "x1", name: "n", version: "1.0.0", type: "style", core: ">=1.0.0", resources: ["../escape.png"] }), /不得上溯/, "resources 不得上溯");
	assert.match(bad({ schema: 1, id: "x1", name: "n", version: "1.0.0", type: "style", core: ">=1.0.0", resources: ["a\\b.png"] }), /POSIX/, "resources 必须用 POSIX 分隔符");
	assert.match(bad({ schema: 1, id: "x1", name: "n", version: "1.0.0", type: "style", core: ">=1.0.0", resources: [42] }), /非空字符串/, "resources 项必须是字符串");
	console.log("D ok：findMissingResources 语义 + resources 形状校验");
}

// ── E. 根目录残留扫描：样式专属资源不在扩展根，共享例外留根 ──
{
	// 整目录已清空/删除的样式图目录
	for (const dir of ["image/styles/shousha", "image/styles/xinsha"]) {
		assert.ok(!exists(dir), `根目录 ${dir} 应已清空（样式专属资源已迁入样式包）`);
	}
	// 单点抽检：各归属表的代表性文件不得留在根，且必须已在某套样式包里（镜像路径）。
	// 覆盖五类：image/styles、image/ui、ui/assets、audio、assets/animation。
	const MOVED_PROBES = [
		"image/styles/online/dead4_zhu.png",
		"image/styles/baby/dead3_zhu.png",
		"image/styles/codename/dead_zhu.png",
		"image/ui/dialog/chat_bubble_ShouSha.png",
		"image/ui/mask/turn_over_maskhs.png",
		"image/ui/chain/tiesuo.png",
		"image/ui/misc/likai.png",
		"ui/assets/character/shousha/pubui_starm.png",
		"ui/assets/character/baby/kuang.png",
		"ui/assets/character/online/bigdialog.png",
		"ui/assets/character/xinsha/guanbi.png",
		"ui/assets/skill/shousha/btn0.png",
		"ui/assets/skill/baby/juexingjihs.png",
		"ui/assets/skill/codename/btnn.png",
		"ui/assets/lbtn/JSJM/dizhu.png",
		"ui/assets/lbtn/SFTS/Tipdizhu.png",
		"ui/assets/lbtn/uibutton/btn-jilu.png",
		"ui/assets/lbtn/shousha/xuanzhe.mp3",
		"audio/game_start_shousha.mp3",
		"ui/assets/skill/online/skillitem_yinyang_1.png",
		"ui/assets/skill/online/skillitem_yinyang_2.png",
		"assets/animation/effect_youxikaishi_shousha.atlas",
	];
	const packFileSet = new Set(SIX.flatMap(listPackFiles));
	for (const rel of MOVED_PROBES) {
		assert.ok(!exists(rel), `样式专属资源仍留在扩展根：${rel}`);
		assert.ok(packFileSet.has(rel), `${rel} 已离开扩展根，但任何样式包里都找不到它（镜像路径丢失）`);
	}
	console.log("E-1 ok：样式专属资源已离开扩展根且在包内可达");

	// 共享/合法例外必须留根：卸载任何一套样式都不得影响它们
	const SHARED_ROOT = [
		"image/styles/decade/identity_zhu.png",
		"image/styles/decade/name_wei.png",
		"image/styles/decade/dead_wei.png",
		"image/styles/decade/shield.png",
		"image/styles/decade/card_countbj.png",
		"image/ui/dialog/chat_bubble.png",
		"image/ui/mask/turn_over_mask.png",
		"image/ui/chain/tie_suo.png",
		"image/ui/judge-mark/feichumark.png",
		"image/ui/judge-mark/bingliang.png",
		"image/ui/mark/mark_jie.png",
		"image/ui/mark/player_mark.png",
		"image/ui/misc/item_bg.png",
		"image/ui/player-bg/bj1.png",
		"image/ui/player-bg/bj2.png",
		"image/ui/effects/sprites_glow_blue.png",
		"ui/assets/character/shizhounian/skt_wei.png",
		"ui/assets/skill/yijiang/falu_club.png",
		"ui/assets/lbtn/uibutton/new_count1.png",
		"ui/assets/lbtn/uibutton/QX.png",
		"ui/assets/lbtn/uibutton/jindutiao.png",
		"ui/assets/lbtn/CD/BJ.png",
		"ui/assets/lbtn/CD/tuoguan2.png",
		"ui/assets/lbtn/CD/button.mp3",
		"ui/assets/lbtn/CD/huanfu.mp3",
		"ui/assets/lbtn/shousha/caidan.mp3",
		"ui/assets/lbtn/shousha/label.mp3",
		"ui/assets/lbtn/OL_line/bg/bgdialog.png",
		"ui/assets/lbtn/OL_line/uibutton/back.png",
		"ui/assets/lbtn/tips/hhks.jpg",
		"ui/assets/lbtn/shoushatip/skilltip.png",
		"audio/SkillBtn.mp3",
		"audio/BtnSure.mp3",
		"audio/game_start.mp3",
		"audio/kill_effect_sound.mp3",
		"assets/animation/effect_youxikaishi.atlas",
		"image/card-skins/.gitkeep",
	];
	for (const rel of SHARED_ROOT) {
		assert.ok(exists(rel), `共享/合法例外资源必须留在扩展根：${rel}（卸载任何样式都不得牵连）`);
	}
	console.log("E-2 ok：共享与玩家自建卡面根不受牵连");
}

// ── F. Core CSS 资源边界：src/styles/*.css 不得引用已迁入样式包的专属资源 ──
// C 段只扫 JS（decadeUIPath 直拼/getAsset），CSS 的 url() 引用是另一条泄漏面——
// meihua.css 的 .baby_skill_box 曾在 btnnhs3.png 随包迁走后仍以根路径引用（拆包盲点）。
//   F-1 逐 url/@import 解析到扩展根相对路径：根上可达（共享留根）才放行；
//       根上没有但某样式包内存在 ⇒ Core CSS 偷读已迁移资源；两边都没有 ⇒ 引用本身 404。
//   F-2 文本级兜底：样式专属目录前缀不得出现在任何 Core CSS——防资源碰巧留根时 F-1 放行
//       （目录名用 skin 族：shousha/xinsha/online/baby/codename；decade 家族共享留根豁免，
//        其 skill 专属的 shizhounian 目录仍禁入）。
//   F-3 baby 技能外显 CSS（skill-display.css）随包自洽：被 entry.css 声明、url() 包内可达。
{
	const STYLE_CSS_DIR = "src/styles";
	const coreCssFiles = fs.readdirSync(STYLE_CSS_DIR).filter(name => name.endsWith(".css"));

	/** 抽取 CSS 路径引用字面量（url(...) 与 @import，跳过 data:/# 片段） */
	const cssPathRefs = text => {
		const refs = [];
		for (const m of text.matchAll(/url\(\s*([^)]*?)\s*\)/g)) {
			const raw = m[1].replace(/^["']|["']$/g, "").trim();
			if (raw && !raw.startsWith("data:") && !raw.startsWith("#")) refs.push(raw);
		}
		for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*;/g)) refs.push(m[1]);
		return refs;
	};

	// F-1：Core CSS 引用逐条解析——根上可达才放行，包内镜像存在 = 偷读已迁移资源
	const violations = [];
	for (const name of coreCssFiles) {
		const file = path.posix.join(STYLE_CSS_DIR, name);
		for (const raw of cssPathRefs(readText(file))) {
			const rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), raw));
			if (exists(rel) || exists(`${rel}.png`)) continue;
			const owner = SIX.find(id => exists(packFile(id, rel)));
			if (owner) violations.push(`${file}: "${raw}" 已迁入 ${owner} 包（样式专属样式应随包内 CSS 引用）`);
			else violations.push(`${file}: "${raw}" 解析为 "${rel}"，扩展根与六套样式包内都不存在（404）`);
		}
	}
	assert.deepEqual(violations, [], `Core CSS 不得引用已迁入样式包的专属资源：\n${violations.join("\n")}`);

	// F-2：文本级兜底——样式专属目录前缀禁入 Core CSS（decade 共享族豁免，shizhounian 除外）
	const EXCLUSIVE_DIRS = [
		...["shousha", "xinsha", "online", "baby", "codename"].flatMap(skin => [
			`image/styles/${skin}/`,
			`ui/assets/skill/${skin}/`,
			`ui/assets/character/${skin}/`,
		]),
		"ui/assets/skill/shizhounian/",
		"ui/assets/lbtn/shousha/",
	];
	for (const name of coreCssFiles) {
		const text = readText(path.posix.join(STYLE_CSS_DIR, name));
		for (const prefix of EXCLUSIVE_DIRS) {
			assert.ok(!text.includes(prefix), `${name} 引用了样式专属资源目录 ${prefix}（已随样式包迁移，Core CSS 禁止引用）`);
		}
	}

	// F-3：本次迁移的产物自洽——baby 包持有技能外显 CSS 且其 url() 在包内可达
	const DISPLAY_CSS = "styles/skill-display.css";
	const babyManifest = readPackManifest("baby");
	assert.ok(babyManifest.entry.css.includes(DISPLAY_CSS), `baby manifest.entry.css 必须声明 ${DISPLAY_CSS}（技能外显样式随包加载）`);
	assert.ok(exists(packFile("baby", DISPLAY_CSS)), `baby 包内缺少 ${DISPLAY_CSS}`);
	const displayDir = path.posix.dirname(DISPLAY_CSS);
	for (const raw of cssPathRefs(readText(packFile("baby", DISPLAY_CSS)))) {
		const rel = path.posix.normalize(path.posix.join(displayDir, raw));
		assert.ok(
			exists(packFile("baby", rel)) || exists(rel) || exists(`${rel}.png`),
			`baby ${DISPLAY_CSS} 引用 "${raw}" 在包内与扩展根都不可达（404）`
		);
	}

	console.log("F ok：Core CSS 零包内专属引用 + 专属目录前缀禁入 + baby 技能外显 CSS 随包自洽");
}

console.log("p19-style-resource-boundary: OK（资源根/完整性/绕根清零/包完整性/根残留/Core CSS 边界六类）");
