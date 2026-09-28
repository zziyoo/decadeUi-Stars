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
 * P8 门控（任务书§45/§16）：击杀/技能特效是一个 Feature——资源不在场或被禁用时整体不装载，
 * Core 侧调用点（skills/animate.js、overrides/player/animations.js）用可选调用安全降级为
 * 本体默认表现。特效 CSS 原先由 Core 的 layout.css @import，现改由本 Feature 自己按需加载。
 *
 * 注意："幻影出牌"有独立开关 cardGhostEffect，不随本 Feature 关停，所以 ghost 与 dialog
 * 通道始终可用（card-handlers 会调 decadeUI.effect.ghost.setEnabled）。
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
		ghost: {
			add: addGhostTrail,
			setEnabled: setGhostEffectEnabled,
		},
	};
	setupCardGhost();

	const { featureRuntime, resourceLoader } = getModuleSystem();
	if (!featureRuntime.active("kill-effect")) return;

	decadeUI.effect.line = drawLine;
	decadeUI.effect.kill = playKillEffect;
	decadeUI.effect.skill = playSkillEffect;
	for (const path of featureRuntime.cssOf("kill-effect")) {
		resourceLoader.loadCSS("kill-effect", path);
	}
}
