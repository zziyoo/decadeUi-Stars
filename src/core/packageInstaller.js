/**
 * @fileoverview 包安装器（P1骨架，任务书§17/§35；HTTP下载与落地安装于P5实现，任务书§42）
 * P1阶段仅提供：manifest 校验、标准安装流程占位接口。
 * 占位接口返回结构化结果而非抛错，调用方无需 try/catch 即可判断能力可用性。
 * 不依赖 noname 运行时，可在 Node 中独立测试。
 */
import { validateManifest } from "./manifest.js";

/**
 * 创建包安装器
 * @returns {Object} packageInstaller
 */
export function createPackageInstaller() {
	const unsupported = action =>
		Promise.resolve({
			ok: false,
			code: "P1_UNSUPPORTED",
			message: `PackageInstaller.${action} 将在 P5 实现（任务书§42）`,
		});

	return {
		/**
		 * 校验包manifest（P1即可用）
		 * @param {Object} manifest - 包内manifest.json内容
		 * @returns {{ok: boolean, errors: string[]}}
		 */
		verifyManifest(manifest) {
			return validateManifest(manifest);
		},

		/** 安装包（P5：下载→临时目录→SHA256→manifest校验→落盘→更新installed.json，任务书§17） */
		install() {
			return unsupported("install");
		},

		/** 更新包（P5+P12：新版本目录→更新current指针→旧版本保留，任务书§18/§49） */
		update() {
			return unsupported("update");
		},

		/** 卸载包（P5：使用中检查→依赖检查→删除→清理引用，任务书§19） */
		uninstall() {
			return unsupported("uninstall");
		},
	};
}
