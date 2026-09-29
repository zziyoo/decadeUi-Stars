/**
 * P15 · 浮层窗口的 CSS 静态不变量（任务书§33 本体污染面；把只覆盖一个窗口的扫描泛化）
 *
 * 背景：本体 `layout/default/layout.css` 有一条 `div { display:inline-block; position:absolute;
 * transition:all .5s }`。我们自己写的每个入流盒子都必须显式声明 position / display，
 * 新加的块还要 transition:none —— 这三样真机都踩过：
 *   · 漏 position ⇒ 元素全部叠在对话框左上角（P11 首轮）；
 *   · 漏 display ⇒ 两个块并排、对话框底部留空（P11 第二轮）；
 *   · 漏 transition ⇒ 第一帧 height 0 再半秒滑开（P13 修 `.decade-update-repair` 时实测到）。
 * 而 `tests/p11-update-check.test.mjs:272-311` 那条扫描**只盯 updateNotice 一个窗口**，
 * 模块管理窗口（同一套 el() 写法、29 处调用）从来没被扫过。这里把扫描做成可复用的两对文件，
 * 并加上 transition 这一维。
 *
 * 不做的事：`welcomeDialog.js` 走的是裸 createElement + 内联 style，不在这条 el() 扫描的
 * 适用范围内（它的 position 靠 JS 内联兜住）—— 已作为已知风险记入台账§五，不假装扫到了。
 */
import assert from "node:assert/strict";
import fs from "node:fs";

/** 扫一对文件：JS 里 el() 用到的每个前缀类，CSS 里必须有显式 position；div 还要 display
 *  （display 的必要性取决于父容器：本体那条规则的选择器是 `div`，而 flex/grid 子项会被块化，
 *   inline-block 不会让它们并排 —— 所以只有"父容器不是 flex/grid"的 div 才必须自己写 display） */
function scan({ jsFile, cssFile, prefix }) {
	const js = fs.readFileSync(new URL(jsFile, import.meta.url), "utf8");
	const css = fs.readFileSync(new URL(cssFile, import.meta.url), "utf8");

	// 变量名 → 类名（`const dialog = el("decade-module-dialog", overlay)`），用来把父子对上
	const varToClass = new Map();
	for (const match of js.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*el\(\s*"([^"]+)"/g)) {
		varToClass.set(match[1], match[2].trim().split(/\s+/).find(cls => cls.startsWith(prefix)));
	}

	const used = new Set();
	const divClasses = new Set();
	/** 类名 → 它的父容器是否 flex/grid（未知一律按"不是"处理，宁可多要一条声明） */
	const parentIsFlex = new Map();
	const collect = (classAttr, rest) => {
		const tag = /,\s*"([^"]+)"\s*$/.exec(rest.trim());
		const isDiv = !tag || tag[1] === "div";   // el() 第三参数省略即 div
		const parentExpr = /^\s*,\s*([A-Za-z_$][\w$.]*)/.exec(rest)?.[1] ?? null;
		const parentClass = parentExpr ? varToClass.get(parentExpr) : undefined;
		for (const cls of classAttr.split(/\s+/)) {
			if (!cls.startsWith(prefix)) continue;
			used.add(cls);
			if (isDiv) {
				divClasses.add(cls);
				parentIsFlex.set(cls, parentClass ? isFlexContainer(css, parentClass) : false);
			}
		}
	};
	for (const match of js.matchAll(/\bel\(\s*"([^"]+)"([^)]*)\)/g)) collect(match[1], match[2]);

	const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({ selector, body }));
	const declared = (cls, prop) =>
		blocks.some(block => {
			const hit = block.selector.split(",").some(part => part.trim().split(/\s+/).includes(`.${cls}`));
			return hit && new RegExp(`${prop}\\s*:`).test(block.body);
		});
	const outOfFlow = cls =>
		blocks.some(block =>
			block.selector.split(",").some(part => part.trim().split(/\s+/).includes(`.${cls}`)) &&
			/position\s*:\s*(absolute|fixed)/.test(block.body)
		);

	return {
		used: [...used],
		divClasses: [...divClasses],
		// 本体的 `div{position:absolute}` 对每个 div 都生效（绝对定位的 flex 子项会脱离流），
		// 所以 position 无一例外必须自己压掉
		missingPosition: [...divClasses].filter(cls => !declared(cls, "position")),
		// display 只在"会并排"时才要：flex/grid 子项被块化、绝对/固定定位脱流，两者都免疫
		missingDisplay: [...divClasses].filter(
			cls => !declared(cls, "display") && parentIsFlex.get(cls) !== true && !outOfFlow(cls)
		),
		missingTransition: [...divClasses].filter(cls => !declared(cls, "transition")),
	};
}

/** 某个容器类在 CSS 里是不是 flex/grid 容器 */
function isFlexContainer(css, cls) {
	return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(([, selector, body]) =>
		selector.split(",").some(part => part.trim().split(/\s+/).includes(`.${cls}`)) && /display\s*:\s*(inline-)?(flex|grid)/.test(body)
	);
}

const WINDOWS = [
	{ name: "更新提示窗", jsFile: "../src/features/updateNoticeWindow.js", cssFile: "../src/features/updateNotice.css", prefix: "decade-update-" },
	{ name: "模块管理窗口", jsFile: "../src/features/moduleManagerWindow.js", cssFile: "../src/features/module-manager-window.css", prefix: "decade-module-" },
];

/**
 * 不要求显式 display 的 div 类（各自给一条理由）。本体那条 `display:inline-block` 只在
 * "同一行盒里并排"时才会咬人：flex 子项会被块化、绝对/固定定位直接脱流，两者都不受影响。
 * 下面两个都是各自容器里的**唯一入流子元素**，没有并排对象，实测外观无异常；
 * 新增类不许再往这里加，除非同时补一句为什么它不会并排。
 */
const DISPLAY_EXEMPT = {
	"decade-module-empty": "列表为空时是 .decade-module-list 里唯一的入流子元素，无并排对象",
	"decade-module-progress-text": "进度条轨道里唯一的入流子元素（-bar 是 absolute），无并排对象",
};

const results = WINDOWS.map(win => ({ ...win, ...scan(win) }));
for (const result of results) {
	assert.ok(result.used.length >= 8, `${result.name}：只扫到 ${result.used.length} 个类，扫描本身失效了`);
	assert.ok(result.divClasses.length >= 6, `${result.name}：只认出 ${result.divClasses.length} 个 div 类，el() 写法变了要同步这条测试`);
	assert.deepEqual(result.missingPosition, [], `${result.name}：这些 div 类没有显式 position，会被本体 div{position:absolute} 拖出文档流：${result.missingPosition.join("、")}`);
	const realDisplayGaps = result.missingDisplay.filter(cls => !DISPLAY_EXEMPT[cls]);
	assert.deepEqual(realDisplayGaps, [], `${result.name}：这些入流 div 没有显式 display，会被本体 div{display:inline-block} 并排：${realDisplayGaps.join("、")}`);
	// 豁免名单不许囤废：名单里的类必须真的还在这个窗口的 div 类里
	for (const cls of Object.keys(DISPLAY_EXEMPT)) {
		if (!cls.startsWith(result.prefix)) continue;
		assert.ok(result.divClasses.includes(cls), `${cls} 已经不在 ${result.name} 的 div 类里了，请把豁免理由一并删掉`);
	}
}

// transition 这一维只报数不判红：本体 `transition:all .5s` 对每个 div 都生效，但"会不会真的
// 动起来"取决于插入后有没有尺寸/位置变化 —— 那要跑起来才量得准。已实测到的一例
// （.decade-update-repair 第一帧 height 0 再半秒滑开）已在 updateNotice.css 里补了 transition:none，
// 剩下的裸奔类清单如实打出来，进台账§五当已知风险，由真机目测决定是否逐个补。
const transitionGaps = results.map(item => `${item.name} ${item.missingTransition.length} 个：${item.missingTransition.join("、")}`);

console.log(`p15-overlay-css-invariants: OK（${results.map(r => `${r.name} ${r.used.length}类/${r.divClasses.length}div`).join("，")}）`);
console.log(`  裸 transition 的 div 类（已知风险，未判红）：\n    ${transitionGaps.join("\n    ")}`);
