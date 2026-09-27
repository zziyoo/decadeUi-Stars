/**
 * @fileoverview P5 下载器（任务书§42）
 *
 * 能力：HTTP 下载、字节进度、失败重试（线性退避）、取消（AbortController）、
 * 超时、SHA256 校验。
 *
 * 边界：
 *   - 不假设联网成功：一切失败以 DownloadError(code) 抛出，调用方按 code 分类处理，
 *     不得让下载失败演变成对已安装内容的破坏（任务书§17末/§20）。
 *   - 不碰文件系统：只回传 ArrayBuffer，落盘由 PackageInstaller 负责（传输与安装分层）。
 *   - 不依赖 noname 运行时，可在 Node 中独立测试（transport 可注入）。
 */

/** 下载失败原因枚举（结构化，供安装器与 UI 分类展示） */
export const DOWNLOAD_CODES = {
	CANCELLED: "CANCELLED",
	TIMEOUT: "TIMEOUT",
	NETWORK: "NETWORK",
	HTTP: "HTTP",
	SHA_MISMATCH: "SHA_MISMATCH",
	SHA_UNAVAILABLE: "SHA_UNAVAILABLE",
	INVALID_URL: "INVALID_URL",
};

/** 下载失败：携带可判别 code 与已尝试次数 */
export class DownloadError extends Error {
	/**
	 * @param {string} code - DOWNLOAD_CODES 之一
	 * @param {string} message - 面向日志的信息
	 * @param {Object} [extra] - { url, status, attempts, cause }
	 */
	constructor(code, message, extra = {}) {
		super(message);
		this.name = "DownloadError";
		this.code = code;
		Object.assign(this, extra);
	}
}

/**
 * 默认传输层：XMLHttpRequest + arraybuffer。
 * 选用 XHR 而非 fetch：无名杀桌面端（Electron renderer）与本体既有下载代码一致，
 * 且 progress / abort / timeout 三者在同一套事件里可观测。
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {(info: {bytes: number, total: number}) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<ArrayBuffer>}
 */
export function xhrTransport(url, { onProgress, signal, timeoutMs = 0 } = {}) {
	return new Promise((resolve, reject) => {
		if (typeof XMLHttpRequest !== "function") {
			reject(new DownloadError(DOWNLOAD_CODES.NETWORK, "当前环境无 XMLHttpRequest，请使用可注入 transport", { url }));
			return;
		}
		if (signal?.aborted) {
			reject(new DownloadError(DOWNLOAD_CODES.CANCELLED, "下载已取消", { url }));
			return;
		}

		const xhr = new XMLHttpRequest();
		let timedOut = false;
		let timer = null;
		const cleanup = () => {
			if (timer) clearTimeout(timer);
			timer = null;
			if (signal) signal.removeEventListener("abort", onAbort);
			xhr.onprogress = null;
		};
		const onAbort = () => {
			try {
				xhr.abort();
			} catch {}
		};

		xhr.open("GET", url, true);
		xhr.responseType = "arraybuffer";
		if (timeoutMs > 0) {
			timer = setTimeout(() => {
				timedOut = true;
				onAbort();
			}, timeoutMs);
		}
		xhr.onprogress = event => {
			if (onProgress) onProgress({ bytes: event.loaded || 0, total: event.lengthComputable ? event.total || 0 : 0 });
		};
		xhr.onload = () => {
			cleanup();
			if (xhr.status >= 200 && xhr.status < 300) {
				if (!xhr.response) {
					reject(new DownloadError(DOWNLOAD_CODES.NETWORK, `响应体为空（HTTP ${xhr.status}）`, { url, status: xhr.status }));
				} else {
					resolve(xhr.response);
				}
			} else {
				reject(new DownloadError(DOWNLOAD_CODES.HTTP, `HTTP ${xhr.status} ${xhr.statusText || ""}`.trim(), { url, status: xhr.status }));
			}
		};
		xhr.onerror = () => {
			cleanup();
			reject(
				new DownloadError(DOWNLOAD_CODES.NETWORK, `网络不可达或被拒绝（CORS/断网/域名解析失败）：${url}`, {
					url,
					status: xhr.status || 0,
				})
			);
		};
		xhr.ontimeout = () => {
			cleanup();
			reject(new DownloadError(DOWNLOAD_CODES.TIMEOUT, `下载超时（${timeoutMs}ms）`, { url }));
		};
		xhr.onabort = () => {
			cleanup();
			reject(
				timedOut
					? new DownloadError(DOWNLOAD_CODES.TIMEOUT, `下载超时（${timeoutMs}ms）`, { url })
					: new DownloadError(DOWNLOAD_CODES.CANCELLED, "下载已取消", { url })
			);
		};
		if (signal) signal.addEventListener("abort", onAbort, { once: true });
		try {
			xhr.send();
		} catch (error) {
			cleanup();
			reject(new DownloadError(DOWNLOAD_CODES.NETWORK, `请求发起失败: ${error?.message ?? error}`, { url, cause: error }));
		}
	});
}

/** 可注入的等待（测试用） */
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 取消检查点：每个 await 边界调用，保证取消语义与传输层实现无关 */
function throwIfAborted(signal, url) {
	if (signal?.aborted) throw new DownloadError(DOWNLOAD_CODES.CANCELLED, "下载已取消", { url });
}

/**
 * SHA-256 → 十六进制小写。
 * 优先 WebCrypto（Electron 的 file:// 属安全上下文），其次 Node crypto（桌面端 require 可用），
 * 两者都拿不到时抛 SHA_UNAVAILABLE —— 绝不静默跳过校验。
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<string>}
 */
export async function sha256Hex(data) {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	if (globalThis.crypto?.subtle) {
		const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
		return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
	}
	if (typeof globalThis.require === "function") {
		try {
			return globalThis.require("crypto").createHash("sha256").update(Buffer.from(bytes)).digest("hex");
		} catch {}
	}
	throw new DownloadError(DOWNLOAD_CODES.SHA_UNAVAILABLE, "当前环境无 SHA-256 实现，拒绝在无校验下安装");
}

/**
 * 下载并（可选）校验 SHA256，失败按 retries 重试。
 *
 * 不重试的错误：CANCELLED（用户意图）、SHA_MISMATCH（内容损坏，重下无意义）、
 * HTTP 4xx（地址不对）。NETWORK/TIMEOUT/5xx 视为可重试。
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {Function} [options.transport] - (url, {signal,onProgress,timeoutMs}) => Promise<ArrayBuffer>
 * @param {(info: {bytes,total,ratio,attempt}) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.retries=2] - 首次之外的重试次数
 * @param {number} [options.retryDelayMs=400]
 * @param {number} [options.timeoutMs=30000]
 * @param {string} [options.sha256] - 期望摘要（大小写不敏感）；缺失则记 warning 语义由调用方处理
 * @param {(data: Uint8Array|ArrayBuffer) => Promise<string>} [options.hash]
 * @returns {Promise<{buffer: ArrayBuffer, bytes: number, sha256: string|null, attempts: number}>}
 */
export async function downloadBuffer(url, options = {}) {
	const {
		transport = xhrTransport,
		onProgress,
		signal,
		retries = 2,
		retryDelayMs = 400,
		timeoutMs = 30000,
		sha256: expectedHash,
		hash = sha256Hex,
		sleep = defaultSleep,
	} = options;

	if (typeof url !== "string" || !/^(https?:)?\/\//.test(url)) {
		throw new DownloadError(DOWNLOAD_CODES.INVALID_URL, `非法下载地址（需 http/https 绝对地址）: ${url}`);
	}

	const maxAttempts = Math.max(1, 1 + Number(retries));
	let lastError = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		throwIfAborted(signal, url);
		if (attempt > 1 && lastError) {
			throwIfAborted(signal, url);
			await sleep(retryDelayMs * (attempt - 1));
			throwIfAborted(signal, url);
		}

		try {
			const buffer = await transport(url, {
				signal,
				timeoutMs,
				onProgress: info => {
					if (onProgress) {
						const bytes = info.bytes || 0;
						const total = info.total || 0;
						onProgress({ bytes, total, ratio: total > 0 ? Math.min(1, bytes / total) : 0, attempt });
					}
				},
			});

			const bytes = buffer?.byteLength ?? 0;
			if (!bytes) {
				throw new DownloadError(DOWNLOAD_CODES.NETWORK, `下载内容为空: ${url}`, { url, attempts: attempt });
			}

			let digest = null;
			if (expectedHash) {
				digest = await hash(new Uint8Array(buffer));
				if (digest.toLowerCase() !== String(expectedHash).toLowerCase()) {
					throw new DownloadError(DOWNLOAD_CODES.SHA_MISMATCH, `SHA256 校验失败：期望 ${expectedHash}，实际 ${digest}`, {
						url,
						attempts: attempt,
					});
				}
			}
			return { buffer, bytes, sha256: digest, attempts: attempt };
		} catch (error) {
			lastError = error instanceof DownloadError ? error : new DownloadError(DOWNLOAD_CODES.NETWORK, String(error?.message ?? error), { url });
			const retryable =
				lastError.code === DOWNLOAD_CODES.NETWORK ||
				lastError.code === DOWNLOAD_CODES.TIMEOUT ||
				(lastError.code === DOWNLOAD_CODES.HTTP && (lastError.status === 429 || lastError.status >= 500));
			if (!retryable || attempt === maxAttempts) {
				lastError.attempts = attempt;
				throw lastError;
			}
		}
	}

	throw lastError ?? new DownloadError(DOWNLOAD_CODES.NETWORK, `下载失败: ${url}`, { url });
}

/**
 * 下载并解析 JSON（模块索引 module-index.json 用，任务书§10）。
 * @param {string} url
 * @param {Object} [options] 同 downloadBuffer
 * @returns {Promise<{data: Object, bytes: number, attempts: number}>}
 */
export async function downloadJson(url, options = {}) {
	const { buffer, bytes, attempts } = await downloadBuffer(url, options);
	let data;
	try {
		data = JSON.parse(new TextDecoder().decode(buffer));
	} catch (error) {
		throw new DownloadError(DOWNLOAD_CODES.NETWORK, `JSON 解析失败: ${error?.message ?? error}`, { url, attempts });
	}
	return { data, bytes, attempts };
}
