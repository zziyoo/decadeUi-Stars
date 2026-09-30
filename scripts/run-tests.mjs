/**
 * 跑 tests/ 下全部 *.test.mjs（每份都用浏览器桩引导），任一失败即非零退出。
 * CI 与本地共用这一条入口，避免两边判据不同。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** --import 吃的是模块说明符：Windows 上给裸路径会被当成 URL scheme（C:），所以给 file:// URL */
const loader = new URL('../tests/helpers/register.mjs', import.meta.url).href;
const testDir = path.join(root, 'tests');

const files = fs
	.readdirSync(testDir)
	.filter(name => name.endsWith('.test.mjs'))
	.sort();

if (!files.length) {
	console.error('tests/ 下一份用例都没有');
	process.exit(1);
}

const failed = [];
for (const file of files) {
	const rel = `tests/${file}`;
	const result = spawnSync(process.execPath, ['--import', loader, rel], { cwd: root, encoding: 'utf8' });
	const ok = result.status === 0;
	console.log(`${ok ? '✓' : '✗'} ${rel}`);
	if (!ok) {
		failed.push(rel);
		const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim().split('\n').slice(-25).join('\n');
		console.log(detail.replace(/^/gm, '    '));
	}
}

console.log(`\n${files.length - failed.length}/${files.length} 通过${failed.length ? '：' + failed.join('、') : ''}`);
process.exit(failed.length ? 1 : 0);
