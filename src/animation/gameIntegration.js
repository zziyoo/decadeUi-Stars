"use strict";

/**
 * @fileoverview 动画系统与游戏集成模块，实现懒加载和资源预加载
 */

import { AnimationPlayer } from "./AnimationPlayer.js";
import { AnimationPlayerPool } from "./AnimationPlayerPool.js";
import { assetList } from "./configs/assetList.js";
import { initSkillAnimations } from "./initAnimations.js";
import { getModuleSystem } from "../core/moduleSystem.js";

/**
 * 样式专属动画的归属表（资源热插拔审计 2026-10-02）：
 * 这些动画只在该样式的生产代码里被播放，资源已迁入对应样式包；
 * 其余 assets/animation 下的动画是多套样式/Feature 共用的共享资源（留扩展根）。
 * @type {Record<string, string>}
 */
const STYLE_OWNED_ANIMATIONS = {
	effect_youxikaishi_shousha: "mobile",
};

/**
 * 资源加载优先级枚举
 * @type {Object.<string, number>}
 */
const Priority = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

/**
 * 资源优先级映射表
 * @type {Object.<string, number>}
 */
const priorityMap = {
	effect_youxikaishi: Priority.CRITICAL,
	effect_youxikaishi_shousha: Priority.CRITICAL,
	effect_loseHp: Priority.CRITICAL,
	aar_chupaizhishiX: Priority.HIGH,
	aar_chupaizhishi: Priority.HIGH,
	SF_xuanzhong_eff_jiangjun: Priority.HIGH,
	SF_xuanzhong_eff_weijiangjun: Priority.HIGH,
	SF_xuanzhong_eff_cheqijiangjun: Priority.HIGH,
	SF_xuanzhong_eff_biaoqijiangjun: Priority.HIGH,
	SF_xuanzhong_eff_dajiangjun: Priority.HIGH,
	SF_xuanzhong_eff_dasima: Priority.HIGH,
	"globaltexiao/huifushuzi/shuzi2": Priority.HIGH,
	"globaltexiao/shanghaishuzi/shuzi": Priority.HIGH,
	"globaltexiao/shanghaishuzi/SZN_shuzi": Priority.HIGH,
};

/** @type {Map<string, string|Function[]>} 资源加载状态映射 */
const loadingState = new Map();

/**
 * 设置游戏动画系统
 * @param {Object} lib - 游戏库对象
 * @param {Object} game - 游戏对象
 * @param {Object} ui - UI对象
 * @param {Object} get - 工具函数对象
 * @param {Object} ai - AI对象
 * @param {Object} _status - 状态对象
 */
export function setupGameAnimation(lib, game, ui, get, ai, _status) {
	decadeUI.animation = (() => {
		// 动画资源基址 = 扩展根，具体路径由 assetResolver 按"资源归属"解析：
		// 共享动画 → assets/animation/<name>（与旧版 decadeUIPath + "assets/animation/" 拼接等价）；
		// 样式专属动画（STYLE_OWNED_ANIMATIONS）→ 样式包内 modules/<id>/<version>/assets/animation/<name>，
		// 未安装时回落扩展根（404 → 该动画不播放，走"包不在样式不可用而 Core 正常"的既有回退语义）。
		const { resourceLoader } = getModuleSystem();
		const resolveAnimationPath = name => {
			const owner = STYLE_OWNED_ANIMATIONS[name];
			const moduleRel = owner ? resourceLoader.getModuleRel(owner) : "";
			return `${moduleRel}assets/animation/${name}`;
		};

		const animation = new AnimationPlayer(decadeUIPath, document.body, "decadeUI-canvas");
		animation.assetResolver = resolveAnimationPath;
		decadeUI.bodySensor.addListener(() => (animation.resized = false), true);
		animation.cap = new AnimationPlayerPool(4, decadeUIPath, "decadeUI.animation");
		for (const player of animation.cap.animations) player.assetResolver = resolveAnimationPath;

		// WebGL不可用时跳过懒加载包装
		if (!animation.gl) {
			initSkillAnimations(animation);
			return animation;
		}

		const originalPlaySpine = animation.playSpine;
		const originalCapPlaySpineTo = animation.cap.playSpineTo;

		const getFileType = name => assetList.find(a => a.name === name)?.fileType || "skel";
		const capHasSpine = name => animation.cap.animations?.[0]?.hasSpine?.(name);

		// 确保资源已加载
		const ensureLoaded = (name, player, isCap, callback) => {
			const hasIt = isCap ? capHasSpine(name) : player?.hasSpine?.(name);
			if (hasIt) {
				callback();
				return;
			}

			const key = (isCap ? "cap:" : "") + name;
			if (loadingState.get(key) === "loading") {
				const cbKey = key + "_cb";
				loadingState.set(cbKey, [...(loadingState.get(cbKey) || []), callback]);
				return;
			}

			loadingState.set(key, "loading");
			const onLoad = () => {
				loadingState.set(key, "loaded");
				callback();
				const cbKey = key + "_cb";
				(loadingState.get(cbKey) || []).forEach(cb => cb());
				loadingState.delete(cbKey);
			};
			const onError = () => loadingState.set(key, "error");

			if (isCap) {
				animation.cap.loadSpine(name, getFileType(name), onLoad, onError);
			} else {
				player.loadSpine(
					name,
					getFileType(name),
					() => {
						player.prepSpine(name);
						onLoad();
					},
					onError
				);
			}
		};

		// 包装播放方法
		animation.playSpine = function (sprite, position) {
			if (!sprite) return;
			const name = typeof sprite === "string" ? sprite : sprite.name;
			if (!name) return originalPlaySpine.call(this, sprite, position);
			if (this.hasSpine(name)) return originalPlaySpine.call(this, sprite, position);
			ensureLoaded(name, this, false, () => originalPlaySpine.call(this, sprite, position));
		};

		animation.loopSpine = function (sprite, position) {
			if (typeof sprite === "string") sprite = { name: sprite, loop: true };
			else if (sprite) sprite.loop = true;
			return this.playSpine(sprite, position);
		};

		animation.cap.playSpineTo = function (element, anim, position) {
			if (!anim) return;
			const name = typeof anim === "string" ? anim : anim.name;
			if (!name) return originalCapPlaySpineTo.call(this, element, anim, position);
			if (capHasSpine(name)) return originalCapPlaySpineTo.call(this, element, anim, position);
			ensureLoaded(name, null, true, () => originalCapPlaySpineTo.call(this, element, anim, position));
		};

		// 按优先级分组预加载；样式专属动画只在其样式包已安装时预加载
		//（未安装时的加载必然 404，与其制造启动期错误噪音，不如直接跳过——真要播时 ensureLoaded 会兜底）
		const preloadable = assetList.filter(f => {
			const owner = STYLE_OWNED_ANIMATIONS[f.name];
			return !owner || resourceLoader.getModuleRel(owner) !== "";
		});
		const groups = [[], [], [], []];
		preloadable.forEach(f => groups[priorityMap[f.name] ?? Priority.NORMAL].push(f));

		const preload = (files, concurrency, onDone) => {
			if (!files.length) return onDone?.();
			const queue = [...files];
			let active = 0,
				done = 0;
			const next = () => {
				while (active < concurrency && queue.length) {
					const f = queue.shift();
					const isCap = f.follow;
					if (isCap ? capHasSpine(f.name) : animation.hasSpine(f.name)) {
						if (++done === files.length) onDone?.();
						continue;
					}
					active++;
					ensureLoaded(f.name, animation, isCap, () => {
						active--;
						if (++done === files.length) onDone?.();
						else next();
					});
				}
			};
			next();
		};

		// 关键资源立即加载
		preload(groups[Priority.CRITICAL], 2);

		// 高优先级延迟加载，其余空闲加载
		lib.arenaReady.push(() => {
			setTimeout(() => preload(groups[Priority.HIGH], 2), 500);
			const loadRest = () => preload([...groups[Priority.NORMAL], ...groups[Priority.LOW]], 2);
			window.requestIdleCallback ? requestIdleCallback(loadRest, { timeout: 8000 }) : setTimeout(loadRest, 3000);
		});

		initSkillAnimations(animation);
		return animation;
	})();

	window.dcdAnim = decadeUI.animation;
	window.dcdBackAnim = decadeUI.backgroundAnimation;
	window.game = game;
	window.get = get;
	window.ui = ui;
	window._status = _status;
}

if (typeof window !== "undefined" && window.decadeModule) {
	window.decadeModule.import((lib, game, ui, get, ai, _status) => {
		setupGameAnimation(lib, game, ui, get, ai, _status);
	});
}
