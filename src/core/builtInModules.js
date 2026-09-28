/**
 * @fileoverview 内置模块Manifest清单（P1基础设施，任务书§29/§35）
 * P1阶段所有内置模块随单体扩展分发，版本与扩展版本一致（P3/P4起模块独立版本）。
 * entry清单为P0审计对 decadeModule.init() 与皮肤动态import行为的归纳，仅作登记，
 * 不驱动实际加载（实际加载仍由 decadeModule 与 skins/index.js 负责，P2起收口）。
 * capabilities 为从现有配置与代码分支归纳的初版，P2再细化（任务书§15）。
 */
import { normalizeManifest } from "./manifest.js";
import { BUILT_IN_FEATURES } from "./featureRuntime.js";

/** 核心CSS：所有样式共用，由 decadeModule 固定加载 */
const CORE_CSS = [
	"src/styles/extension.css",
	"src/styles/decadeLayout.css",
	"src/styles/card.css",
	"src/styles/meihua.css",
	"src/styles/equip.css",
	"src/styles/layout.css",
];

/**
 * 六个官方样式（任务书§29-§31）
 * value = 配置键 newDecadeStyle 的取值；player = 对应 src/styles/playerN.css 序号；
 * skin = 皮肤模块名（ui/{character,skill,lbtn}/skins/{skin}.js）。映射依据见 P0 审计报告§9。
 * pack = true 表示该样式已拆分为独立包（modules/<id>/<version>/，entry.css 为包内路径）。
 */
const STYLES = [
	{ id: "decade", name: "十周年", value: "on", skin: "shizhounian", player: 1, pack: true, capabilities: ["player-frame", "lbtn"] },
	{ id: "mobile", name: "移动版", value: "off", skin: "shousha", player: 2, pack: true, capabilities: ["player-frame", "lbtn"] },
	{ id: "yjcm", name: "一将成名", value: "othersOff", skin: "xinsha", player: 3, pack: true, capabilities: ["player-frame", "lbtn", "border-style"] },
	{ id: "online", name: "Online", value: "onlineUI", skin: "online", player: 4, pack: true, capabilities: ["player-frame", "lbtn", "online-chat", "online-gift"] },
	{ id: "baby", name: "欢乐三国杀", value: "babysha", skin: "baby", player: 5, pack: true, capabilities: ["player-frame", "lbtn"] },
	{ id: "codename", name: "名将杀", value: "codename", skin: "codename", player: 6, pack: true, capabilities: ["player-frame", "lbtn"] },
];

/**
 * 向注册表注册全部内置模块
 * @param {Object} registry - 模块注册表
 * @param {Object} [options]
 * @param {string} [options.version] - 扩展当前版本（P1阶段内置模块与扩展同版本）
 */
export function registerBuiltInModules(registry, { version = "0.0.0" } = {}) {
	registry.register(
		normalizeManifest({
			id: "core",
			name: "十周年UI-Stars 核心",
			version,
			type: "core",
			entry: { js: ["extension.js"], css: CORE_CSS },
			capabilities: ["progress-bar", "card-skin", "dynamic-skin"],
			author: "子右",
		})
	);

	for (const style of STYLES) {
		// 已拆分包的样式：entry.css 为包内路径（P3）；未拆分样式：单体路径
		const styleCss = style.pack
			? ["player.css", "styles/character.css", "styles/lbtn.css", "styles/skill.css", "styles/lbtn-window.css", "styles/skill-window.css"]
			: [
					`src/styles/player${style.player}.css`,
					`ui/styles/character/${style.skin}.css`,
					`ui/styles/lbtn/${style.skin}.css`,
					`ui/styles/skill/${style.skin}.css`,
					`ui/styles/lbtn/window/${style.skin}.css`,
					`ui/styles/skill/window/${style.skin}.css`,
				];
		registry.register(
			normalizeManifest({
				id: style.id,
				name: `${style.name}样式`,
				version,
				type: "style",
				core: `>=${version}`,
				dependencies: ["core"],
				entry: {
					js: [`ui/character/skins/${style.skin}.js`, `ui/skill/skins/${style.skin}.js`, `ui/lbtn/skins/${style.skin}.js`],
					css: styleCss,
				},
				capabilities: [...style.capabilities],
				author: "子右",
			}),
			// 样式别名，供 StyleRuntime/安装器反查（P2使用）
			{ styleValue: style.value, skin: style.skin, playerCssIndex: style.player }
		);
	}

	// Feature 模块（P8）：开关与 pack 状态取自 featureRuntime 的声明，避免两处各存一份
	for (const feature of BUILT_IN_FEATURES) {
		registry.register(
			normalizeManifest({
				id: feature.id,
				name: feature.name,
				version,
				type: "feature",
				core: `>=${version}`,
				dependencies: ["core"],
				// entry.css 留空：门控型 Feature 的样式随 Core 的 layout.css @import 无条件加载
				// （effect.css 同时含技能特效的 .skill-name，不属 kill-effect 单独管辖）。
				// 自带样式的拆包型 Feature 在这里按 pack 状态登记单体/包内两套路径。
				entry: { css: [] },
				capabilities: [...feature.capabilities],
				author: "子右",
			}),
			{ featureSwitch: feature.switchKey }
		);
	}
}
