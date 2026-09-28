"use strict";

/**
 * @fileoverview 特效模块入口，导出所有特效相关功能
 */

import { lib, game, ui, get, ai, _status } from "noname";
import { getModuleSystem } from "../core/moduleSystem.js";

export { CONFIG, GENERAL_NAME_STYLE } from "./config.js";
export * from "./utils.js";
export { drawLine } from "./line.js";
export { playKillEffect } from "./kill.js";
export { playSkillEffect } from "./skill.js";
export { setupCardGhost, addGhostTrail, setGhostEffectEnabled, GHOST_CONFIG } from "./cardGhost.js";

// ==================== 游戏集成 ====================

import { drawLine } from "./line.js";
import { playKillEffect } from "./kill.js";
import { playSkillEffect } from "./skill.js";
import { setupCardGhost, addGhostTrail, setGhostEffectEnabled } from "./cardGhost.js";

/**
 * 初始化特效模块到 decadeUI
 *
 * P8 门控边界（任务书§45/§16，以原版行为为准绳）：`kill-effect` 这个 Feature **只管击杀那一路**。
 * 原版 `setupEffects()` 无条件注册 line/kill/skill/ghost/dialog，而 `killEffect` 配置只在
 * `src/skills/animate.js` 的击杀技能 `filter()` 里被读取——技能特效从来没有开关。
 * 所以这里只把 `effect.kill` 交给门控；`skill`/`line` 与 dialog/ghost 一样始终注册。
 * 顺带避免一个副作用：`playerSkill()` 先 `decadeUI.delay(2500)` 再调 `effect.skill`，
 * 若技能特效被击杀开关一起关掉，玩家会白等 2.5 秒而什么都不发生。
 *
 * 特效 CSS 不在这里加载：`src/styles/effect.css` 同时含击杀窗口（.effect-window）
 * 与技能特效（.skill-name）的样式，没有单一 Feature 归属，留在 Core 的 layout.css
 * `@import` 链里（位置与原版一致，不改变级联优先级）。
 *
 * "幻影出牌"有独立开关 cardGhostEffect，不随本 Feature 关停（ghost 与 dialog 通道始终可用，
 * card-handlers 会调 decadeUI.effect.ghost.setEnabled）。
 * @returns {void}
 */
export function setupEffects() {
	if (typeof decadeUI === "undefined") {
		console.error("decadeUI 未定义，无法初始化特效模块");
		return;
	}

	decadeUI.effect = {
		dialog: {
			create: () => decadeUI.dialog.create("effect-dialog dui-dialog"),
		},
		line: drawLine,
		skill: playSkillEffect,
		ghost: {
			add: addGhostTrail,
			setEnabled: setGhostEffectEnabled,
		},
	};

	setupCardGhost();

	// 击杀特效是 Feature：禁用/资源不在场就不注册这一路，调用点（skills/animate.js）用可选调用降级
	if (getModuleSystem().featureRuntime.active("kill-effect")) {
		decadeUI.effect.kill = playKillEffect;
	}
}
