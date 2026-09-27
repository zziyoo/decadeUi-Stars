import { lib, _status } from "noname";
import { config } from "./src/config.js";
import { content } from "./src/content.js";
import { precontent } from "./src/precontent.js";
import { mainpackage } from "./src/package.js";

/** @type {import("noname").ExtensionType} */
export const type = "extension";

/**
 * 十周年UI扩展入口
 * @returns {Promise<import("noname").ExtensionInfo>} 扩展配置对象
 */
export default async function () {
	// 首次启动锚点：此时 window.decadeUIPath 尚未存在（它由本次读取 info.json 后才注入），
	// 必须先用扩展目录名（与 info.json 的 name 保持一致）定位 info.json，
	// 取得 name 后再设置 decadeUIName / decadeUIPath 兼容接口。禁止提前引用 decadeUIPath。
	const infoUrl = `${lib.assetURL}extension/十周年UI-Stars/info.json`;
	const { name, ...otherInfo } = await lib.init.promises.json(infoUrl);

	const extensionName = name;
	const extensionPath = `${lib.assetURL}extension/${extensionName}/`;

	Object.assign(window, {
		decadeUIName: extensionName,
		decadeUIPath: extensionPath,
	});

	const packageData = mainpackage(otherInfo);

	return {
		name: extensionName,
		editable: false,
		content,
		precontent,
		config,
		package: packageData,
		mainpackage: packageData,
	};
}
