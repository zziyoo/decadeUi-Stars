/**
 * 对 src / ui / scripts / tests 下全部 .js/.mjs 跑 `node --check`。
 * 这些文件是扩展运行时直接加载的 ESM 源（本体 import extension.js → src/content.js），
 * 语法错在浏览器里只表现为"扩展没加载"，所以静态门禁第一步就把它们全过一遍。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'ui', 'scripts', 'tests'];
const files = [];

const walk = dir => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (/\.(js|mjs)$/.test(entry.name)) files.push(path.relative(root, full).split(path.sep).join('/'));
	}
};

for (const dir of DIRS) {
	const full = path.join(root, dir);
	if (fs.existsSync(full)) walk(full);
}

if (!files.length) {
	console.error('一个文件都没扫到，检查目录参数');
	process.exit(1);
}

const bad = [];
for (const file of files) {
	const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) {
		bad.push(file);
		console.log(`✗ ${file}`);
		console.log(`${result.stderr ?? ''}`.trim().split('\n').slice(0, 6).join('\n').replace(/^/gm, '    '));
	}
}

console.log(`node --check：${files.length - bad.length}/${files.length} 通过${bad.length ? '，失败：' + bad.join('、') : ''}`);
process.exit(bad.length ? 1 : 0);
