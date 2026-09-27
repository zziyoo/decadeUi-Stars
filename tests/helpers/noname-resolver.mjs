// Node 模块解析钩子：把 "noname" 导入重定向到测试桩（tests/fixtures/noname-stub.mjs），
// 使依赖 noname 的源码模块（extension.js、resourceLoader.js 等）可在 Node 中加载测试。
export async function resolve(specifier, context, next) {
	if (specifier === "noname") {
		return { shortCircuit: true, url: new URL("../fixtures/noname-stub.mjs", import.meta.url).href };
	}
	return next(specifier, context);
}
