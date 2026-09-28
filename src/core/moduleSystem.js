/**
 * @fileoverview P1模块系统装配入口（任务书§35）
 * 进程内单例：precontent 阶段首次创建；content 阶段挂载到 decadeUI 公开API（任务书§57）：
 *   decadeUI.modules / decadeUI.moduleManager / decadeUI.resource / decadeUI.style
 */
import { lib, game } from "noname";
import { createModuleRegistry } from "./registry.js";
import { registerBuiltInModules } from "./builtInModules.js";
import { createModuleManager } from "./moduleManager.js";
import { createStyleRuntime } from "./styleRuntime.js";
import { createResourceLoader } from "./resourceLoader.js";
import { createPackageInstaller } from "./packageInstaller.js";
import { createNonameIo, createZipExtractor } from "./moduleIo.js";
import { createFeatureRuntime, BUILT_IN_FEATURES } from "./featureRuntime.js";
import { normalizeManifest } from "./manifest.js";

/** @type {Object|null} 模块系统单例 */
let instance = null;
/** @type {Object|null} Feature 运行时；晚绑定给 moduleManager 的启停钩子用 */
let featureRuntime = null;

/**
 * 获取模块系统单例（首次调用时装配）
 * @returns {{registry: Object, moduleManager: Object, styleRuntime: Object, resourceLoader: Object, packageInstaller: Object, featureRuntime: Object}}
 */
export function getModuleSystem() {
	if (instance) return instance;

	const registry = createModuleRegistry();
	registerBuiltInModules(registry, {
		version: lib.extensionPack?.[decadeUIName]?.version || "0.0.0",
	});

	const moduleManager = createModuleManager({
		registry,
		// P8：接上 P1 起悬空的启停钩子。Feature 的开关就是它声明的配置键（不另立状态源）；
		// 未声明为 Feature 的 id 恒真，不会误伤 core/style。runtime 晚绑定以免构造期互相引用。
		isModuleEnabled: id => (featureRuntime ? featureRuntime.switchOn(id) : true),
	});
	// P3：resourceLoader 经 moduleManager.getInstallState 查询模块安装状态，
	// 内置模块回落扩展根（单体兼容），独立安装模块解析 modules/<id>/<version>/
	const resourceLoader = createResourceLoader({ moduleManager });
	featureRuntime = createFeatureRuntime({
		moduleManager,
		resourceLoader,
		configKey: key => `extension_${decadeUIName}_${key}`,
		readConfig: key => lib.config[key],
	});
	for (const definition of BUILT_IN_FEATURES) {
		const declared = featureRuntime.define(definition);
		if (!declared.ok) console.warn(`[十周年UI-Stars] Feature 声明被拒绝: ${definition.id}`, declared.errors);
	}
	const styleRuntime = createStyleRuntime({
		moduleManager,
		resourceLoader,
		getConfig: key => lib.config[key],
		setConfig: (key, value) => game.saveConfig(key, value),
	});
	const packageInstaller = createPackageInstaller({
		registry,
		moduleManager,
		// P5 端口落地：文件系统与 ZIP 解压全部复用本体既有能力（见 moduleIo.js）
		io: createNonameIo(),
		extractZip: createZipExtractor(),
		getCoreVersion: () => lib.extensionPack?.[decadeUIName]?.version || null,
		// 任务书§19：卸载前置检查——当前使用中的样式与 Core 不允许被卸走
		isInUse: id => id === "core" || styleRuntime.id === id,
	});

	instance = { registry, moduleManager, styleRuntime, resourceLoader, packageInstaller, featureRuntime };
	return instance;
}

/**
 * 探测并注册已安装的独立样式包（P3）
 *
 * 读取 modules/installed.json 清单，对每个条目探测其 manifest.json 并以
 * meta.source="installed" 注册（同版本覆盖注册）→ getModuleBase 解析至
 * modules/<id>/<version>/。清单或清单文件缺失（404）时不再只是跳过：
 *
 * P12（任务书§49）：注册**之前**先做一次健康检查（`installer.verifyInstalled`，结构级四项），
 * 发现损坏且台账记着健康的上一版时**自动回退**（`installer.rollback`），回退后再注册一次。
 * 没有可用上一版就只警告（需要重装）——绝不在启动阶段自动下载。
 * 结果通过 `takeRepairNotes()` 交给提示窗告知玩家；本函数不碰任何 UI。
 *
 * @returns {Promise<void>}
 */
export async function registerInstalledModules() {
	const { moduleManager, packageInstaller } = getModuleSystem();
	const base = (typeof window !== "undefined" && window.decadeUIPath) || "";
	let installed;
	try {
		const res = await fetch(`${base}modules/installed.json`);
		if (!res.ok) return;
		installed = await res.json();
	} catch {
		return;
	}

	/** 按 URL 取清单并注册（运行时加载走的是 URL，所以注册这一侧仍以 fetch 为准） */
	const registerByUrl = async (id, version) => {
		try {
			const res = await fetch(`${base}modules/${id}/${version}/manifest.json`);
			if (!res.ok) return { ok: false, reason: `清单取不到（HTTP ${res.status}）：modules/${id}/${version}/manifest.json` };
			const result = moduleManager.register(normalizeManifest(await res.json()), { source: "installed" });
			return result.ok ? { ok: true } : { ok: false, reason: `清单校验失败：${(result.errors || []).join("；")}` };
		} catch (error) {
			return { ok: false, reason: `读取清单异常：${error?.message ?? error}` };
		}
	};

	const entries = installed?.modules || {};
	for (const [id, info] of Object.entries(entries)) {
		const version = info.version;

		// 1) 健康检查：判据是纯逻辑（moduleHealth），IO 错误不算损坏
		let health = null;
		try {
			const verified = await packageInstaller?.verifyInstalled?.(id);
			if (verified?.ok) health = verified;
			else if (verified) console.warn(`[十周年UI-Stars] 健康检查未完成（${verified.code}）：${id}`, verified.message || "");
		} catch (error) {
			console.warn(`[十周年UI-Stars] 健康检查异常（按未损坏处理）：${id}`, error);
		}

		// 2) 损坏且有健康的上一版 ⇒ 自动回退，然后用回退后的版本重注册
		if (health && health.status === "corrupt") {
			if (health.action?.kind === "restore") {
				let rolled = null;
				try {
					rolled = await packageInstaller.rollback(id);
				} catch (error) {
					rolled = { ok: false, code: "THREW", message: String(error?.message ?? error) };
				}
				if (rolled?.ok) {
					const again = await registerByUrl(id, rolled.version);
					repairNotes.push({
						id,
						kind: "restored",
						from: rolled.from ?? version,
						to: rolled.version,
						reasons: health.reasons,
						registered: again.ok,
						message: `已从 ${rolled.from ?? version} 回退到 ${rolled.version}（原因：${health.reasons.join("；")}）`,
					});
					console.warn(`[十周年UI-Stars] ${id} 损坏，已自动回退到 ${rolled.version}：${health.reasons.join("；")}`);
					continue;
				}
				console.warn(`[十周年UI-Stars] ${id} 损坏且回退失败（${rolled?.code}）：${rolled?.message ?? ""}`);
			}
			repairNotes.push({
				id,
				kind: "reinstall",
				from: version,
				to: null,
				reasons: health.reasons,
				registered: false,
				message: `${id} 损坏且没有可用的上一版，需要重装（原因：${health.reasons.join("；")}）`,
			});
			console.warn(`[十周年UI-Stars] ${id} 损坏且无法回退，请重装：${health.reasons.join("；")}`);
			continue;
		}

		// 3) 正常注册（沿用原逻辑：URL 取清单 → 注册）
		const registered = await registerByUrl(id, version);
		if (!registered.ok) console.warn(`[十周年UI-Stars] 注册模块失败：${id}（${registered.reason}）`);
	}
}

/** 启动期自动修复的记录（提示窗用；取走即清，避免每次刷新重复弹） */
const repairNotes = [];
export function takeRepairNotes() {
	return repairNotes.splice(0, repairNotes.length);
}
