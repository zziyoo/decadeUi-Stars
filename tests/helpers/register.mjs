// 测试进程引导：注册 noname 解析钩子 + 浏览器全局最小桩
// 用法：node --import ./tests/helpers/register.mjs tests/p2-smoke.test.mjs
import { register } from "node:module";
register(new URL("./noname-resolver.mjs", import.meta.url));

// ---- 浏览器全局最小桩 ----
// 仅满足源码在"模块求值期"对浏览器环境的引用（如 self/ResizeObserver/document），
// 桩不参与断言语义；业务断言一律使用显式 mock 或返回值。
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}
if (typeof globalThis.document === "undefined") {
	const fakeElement = () => ({
		style: {},
		sheet: { insertRule() {}, cssRules: [] },
		setAttribute() {},
		appendChild() {},
		remove() {},
		addEventListener() {},
		removeEventListener() {},
		classList: { add() {}, remove() {}, contains: () => false },
	});
	globalThis.document = {
		createElement: fakeElement,
		createTextNode: fakeElement,
		querySelector: () => null,
		querySelectorAll: () => [],
		getElementById: () => null,
		head: { appendChild() {} },
		body: { setAttribute() {}, appendChild() {}, removeChild() {} },
		addEventListener() {},
		removeEventListener() {},
		documentElement: fakeElement(),
	};
}
if (typeof globalThis.Image === "undefined") {
	globalThis.Image = class {
		set src(_) {}
	};
}
if (typeof globalThis.Audio === "undefined") {
	globalThis.Audio = class {};
}
if (typeof globalThis.navigator === "undefined") {
	globalThis.navigator = { userAgent: "node-test" };
}
if (typeof globalThis.location === "undefined") {
	globalThis.location = { href: "http://localhost/", protocol: "http:" };
}
