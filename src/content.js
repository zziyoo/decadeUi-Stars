/**
 * @fileoverview 扩展主入口 - 游戏初始化时执行
 */
import { readRawStyleValue } from "./core/styleRuntime.js";
import { lib, game, ui, get, ai, _status } from "noname";

// 核心模块
import { bootstrapExtension } from "./core/bootstrap.js";
import { createDecadeUIObject } from "./core/decadeUI.js";
import { registerDecadeUIUtilityModule, enhanceDecadeUIRuntime } from "./core/utility.js";
import { getModuleSystem } from "./core/moduleSystem.js";
import { config as extensionConfig } from "./config.js";

// 动画模块
import { setupGameAnimation } from "./animation/gameIntegration.js";

// 特效模块
import { setupEffects } from "./effects/index.js";

// 功能模块
import { setupAutoSelect } from "./features/autoSelect.js";
import { setupCardDragSort } from "./features/cardDragSort.js";
import { setupEquipHand } from "./features/equipHand.js";
import { setupLuckyCard } from "./features/luckyCard.js";
import { setupExtensionToggle } from "./features/extensionToggle.js";
import { setupStyleHotkeys } from "./features/styleHotkeys.js";
import { setupDisableBrowserShortcuts } from "./features/disableBrowserShortcuts.js";
import { setupWelcomeDialog } from "./features/welcomeDialog.js";
import { setupConfigWindow } from "./features/configWindow.js";
import { setupModuleManagerWindow } from "./features/moduleManagerWindow.js";
import { setupUpdateNotice } from "./features/updateNoticeWindow.js";

// 音频模块
import { setupSkillDieAudio, setupAudioHooks, setupEnhancedAudio, setupCharacterAudio } from "./audio/index.js";

// 皮肤模块
import { setupDynamicSkin } from "./skins/dynamicSkin.js";

// UI模块
import { registerLegacyModules } from "./ui/progress-bar.js";
import { initCardPrompt } from "./ui/cardPrompt.js";
import { initComponent } from "./ui/component.js";
import { setupCharacterBackground } from "./ui/characterBackground.js";
import { setupCardStyles, updateCardStyles } from "./ui/cardStyles.js";
import { setupCharacterNamePrefix } from "./ui/characterNamePrefix.js";
import { setupSkillDisplay } from "./ui/skillDisplay.js";
import { setupOutcropAvatar } from "./ui/outcropAvatar.js";

// 技能模块
import { initSkills } from "./skills/index.js";

// UI插件模块
import { createLbtnPlugin } from "../ui/lbtn/plugin.js";
import { createSkillPlugin } from "../ui/skill/plugin.js";
import { createCharacterPlugin } from "../ui/character/plugin.js";

/**
 * 完成核心初始化
 * @param {Object} decadeUI - 核心对象
 * @param {Object} config - 配置对象
 * @returns {Object}
 */
export const finalizeDecadeUICore = (decadeUI, config) => {
	registerDecadeUIUtilityModule(decadeUI);
	decadeUI.config = config;
	decadeUI.config.campIdentityImageMode ??= true;

	decadeUI.config.update = () => {
		const menu = lib.extensionMenu[`extension_${decadeUIName}`];
		for (const key in menu) {
			if (menu[key]?.update) menu[key].update();
		}
	};

	decadeUI.init();

	setupGameAnimation(lib, game, ui, get, ai, _status);
	setupEffects();
	initComponent(decadeUI);
	initSkills();
	initCardPrompt({ lib, game, ui, get });
	setupAutoSelect();
	setupCardDragSort();
	setupEquipHand();
	setupLuckyCard();
	setupExtensionToggle();
	setupStyleHotkeys();
	setupDisableBrowserShortcuts();
	setupConfigWindow();
	setupModuleManagerWindow();
	setupEnhancedAudio();
	setupCharacterBackground();
	setupCardStyles();
	decadeUI.updateCardStyles = updateCardStyles;
	setupCharacterNamePrefix();
	setupSkillDisplay();
	setupOutcropAvatar();
	setupSkillDieAudio();
	setupAudioHooks();
	setupCharacterAudio();
	setupDynamicSkin();
	setupWelcomeDialog(lib.extensionPack[decadeUIName]);
	// P11：启动后异步查一次模块更新（未配置模块源/离线/超时一律静默，不阻塞进游戏）
	setupUpdateNotice();

	console.timeEnd(decadeUIName);
	return decadeUI;
};

/**
 * 加载UI插件模块（异步按需加载）
 */
async function loadUIPlugins() {
	const excludedModes = ["chess", "tafang", "hs_hearthstone"];
	if (excludedModes.includes(get.mode())) return;

	const plugins = [
		{ name: "lbtn", creator: createLbtnPlugin },
		{ name: "skill", creator: createSkillPlugin },
		{
			name: "character",
			creator: createCharacterPlugin,
			enabled: () => lib.config["extension_十周年UI-Stars_characterPlugin"] !== false,
		},
	];

	for (const { name, creator, enabled } of plugins) {
		if (enabled && !enabled()) {
			console.log(`[十周年UI] ${name}模块已被配置关闭`);
			continue;
		}

		try {
			const plugin = await creator(lib, game, ui, get, ai, _status, window.app);
			if (plugin) {
				if (plugin.name) window.app.pluginsMap[plugin.name] = plugin;
				if (plugin.precontent && (!plugin.filter || plugin.filter())) {
					plugin.precontent();
				}
				window.app.plugins.push(plugin);
			}
		} catch (e) {
			console.error(`[十周年UI] ${name}模块加载失败:`, e);
		}
	}
}

/**
 * 扩展content函数 - 无名杀扩展主入口
 * @param {Object} config - 扩展配置
 */
export async function content(config) {
	// 热更新/重复导入时不要再次覆写无名杀的原始方法。
	if (window.decadeUI) return;

	if (!bootstrapExtension()) return;

	const decadeUI = createDecadeUIObject();
	window.decadeUI = decadeUI;

	// P1：挂载模块系统公开API（任务书§57兼容API策略）
	const { registry, moduleManager, styleRuntime, resourceLoader, packageInstaller, featureRuntime } = getModuleSystem();
	decadeUI.modules = registry;
	decadeUI.moduleManager = moduleManager;
	decadeUI.resource = resourceLoader;
	decadeUI.style = styleRuntime;
	decadeUI.packageInstaller = packageInstaller;
	// P8：Feature 运行时（声明/门控/资源寻址），特效等功能的装载由它决定
	decadeUI.feature = featureRuntime;
	decadeUI.version = lib.extensionPack?.[decadeUIName]?.version || null;

	decadeUI.config = {
		...config,
		dynamicSkin: lib.config["extension_十周年UI-Stars_dynamicSkin"] ?? false,
		newDecadeStyle: readRawStyleValue() ?? "on",
		dynamicSkinOutcrop: lib.config["extension_十周年UI-Stars_dynamicSkinOutcrop"] ?? false,
		rightLayout: lib.config["extension_十周年UI-Stars_rightLayout"] === "on",
	};

	// P2修复：补齐扩展菜单注册与配置默认值。本体 loadExtension 阶段跨层接收的
	// object.config 可能为空（见诊断：菜单仅4项、packConfigKeys=0），导致
	// "切换样式"等全部配置项与 update/onclick 回调缺失。content 运行时模块图
	// 完整（实测 config:52 键），故在此从模块源重新注册，并补写未初始化的
	// 配置默认值（等价于本体 loadExtension 的 init 播种逻辑）。
	const extensionMenu = lib.extensionMenu?.[`extension_${decadeUIName}`];
	if (extensionMenu) {
		for (const key of Object.keys(extensionConfig)) {
			if (!(key in extensionMenu)) extensionMenu[key] = extensionConfig[key];
			const def = extensionConfig[key];
			if (def && typeof def === "object" && "init" in def && !("clear" in def)) {
				const cfgKey = `extension_${decadeUIName}_${key}`;
				if (!(cfgKey in lib.config)) game.saveConfig(cfgKey, def.init);
			}
		}
	}

	enhanceDecadeUIRuntime(decadeUI);
	finalizeDecadeUICore(decadeUI, decadeUI.config);
	registerLegacyModules(decadeUI.config);
	await loadUIPlugins();
}
