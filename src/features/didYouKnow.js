/**
 * @fileoverview 你知道吗功能模块
 */

import { lib, game, ui, get, ai, _status } from "noname";

// 提示列表
let didYouKnowList = ["加载中..."];
let shuffledList = [];
let currentIndex = 0;
let loaded = false;

// 打乱数组
const shuffle = arr => {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

// 从txt文件加载提示
const loadTips = async () => {
	if (loaded) return;
	try {
		const path = `${decadeUIPath}src/features/didYouKnow.txt`;
		const response = await fetch(path);
		const text = await response.text();
		const lines = text
			.split("\n")
			.map(line => line.trim())
			.filter(line => line);
		if (lines.length > 0) {
			didYouKnowList = lines;
			shuffledList = shuffle(didYouKnowList);
			loaded = true;
		}
	} catch (e) {
		console.error("加载你知道吗提示失败:", e);
	}
};

loadTips();

/**
 * 获取下一条提示（每条显示一次后重新打乱）
 * @returns {string}
 */
export const getRandomTip = () => {
	if (shuffledList.length === 0) {
		shuffledList = shuffle(didYouKnowList);
		currentIndex = 0;
	}
	const tip = shuffledList[currentIndex];
	currentIndex++;
	if (currentIndex >= shuffledList.length) {
		shuffledList = shuffle(didYouKnowList);
		currentIndex = 0;
	}
	return tip;
};

/**
 * 生成你知道吗HTML
 * @returns {string}
 */
export const getDidYouKnowHTML = () => {
	const tip = getRandomTip();
	const refreshHandler = `this.parentElement.querySelector('span:last-child').textContent=window.decadeUIDidYouKnow.getRandom()`;
	return `<div style="margin-top:10px;padding:8px;background:rgba(255,255,255,0.1);border-radius:5px;"><span style="color:#FFD700;cursor:pointer;" onclick="${refreshHandler}">💡你知道吗：</span><br><span>${tip}</span></div>`;
};

// 挂载到全局
window.decadeUIDidYouKnow = {
	getRandom: getRandomTip,
	getHTML: getDidYouKnowHTML,
};
