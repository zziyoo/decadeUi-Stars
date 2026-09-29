# P14 最终测试 执行计划（任务书§51 + §52）

> **给执行中的 agent：** REQUIRED SUB-SKILL: 用 `superpowers:executing-plans`（本会话内逐任务执行）或 `superpowers:subagent-driven-development`（每任务派新 agent + 任务间复审）来实现本计划。步骤用 `- [ ]` 复选框跟踪。

**目标：** 把任务书§51 要求的五类测试（安装 / 模块 / 样式 / 平台 / 游戏模式）变成**可追责的测试矩阵**，并按§52 为**每个模块建一份独立测试表**；能自动化的先自动化，只能真机的分派给用户并附单行探针与判据。

**架构：** 三层不混。(1) `tests/modules/<id>.md` —— §52 要求的每模块一张表，行=测试项、列=判据/层级/结果/证据；(2) `tests/modules/P14-matrix.md` —— §51 五类 × 覆盖现状 × 谁能验（我 / 用户 / CI）的总账，§八 已挂账项全部并进来；(3) `tests/p14-*.test.mjs` —— 盯住"每个注册模块都有表、表结构合规、矩阵不留空类"的静态不变量，防止文档随代码漂移。真机部分不假装验过：结论只写进表格的"结果/证据"列。

**技术栈：** Node 24 裸测试（`node --import ./tests/helpers/register.mjs tests/x.test.mjs`，`"noname"` 映射到 `tests/fixtures/noname-stub.mjs`）；构建脚本 `scripts/build-release.mjs`（ESM，导出纯函数便于单测）；文档 Markdown；无名杀本体只读。

**规格：** `README.md` §51（最终测试要覆盖的清单）、§52（每个模块都必须有独立测试表，例 `tests/modules/mobile.md`）；台账 `docs/PROGRESS.md` §八「项目收尾验证清单」是待验项的既有账本。

## Global Constraints（每条对每个任务都隐含生效）

- **绝不修改无名杀本体**（`resources/app/noname/`、`resources/app/game/` 只读）。
- **绝不删玩家文件**；不调 `game.removeExtension()`（它会连删配置/localStorage/导入图）。
- 每个阶段/修复**各起一笔提交，禁 squash**；**推送由用户本人执行**，报告远端状态前用 `git ls-remote origin main` 核实。
- 交付前必跑门禁：全量 `node --check`、`tests/*.test.mjs` 全套、`node scripts/verify-pack.mjs`、`node scripts/check-skin-imports.mjs`、`pnpm build`、`pnpm verify:release`。
- 台账回写只锚**单行子串**且**含行尾 `|`**；结构性改动走 `.mjs` 脚本并断言锚点唯一 + 竖线数量一致；**禁用 `node -e` 改台账**。
- 真机探针必须**单行单表达式**、**自带 `try/catch`**（未捕获 rejection 会在他的游戏里弹错误框），地址用 `document.baseURI`（`lib.assetURL` 在本构建里是空串）。
- 判据一律**先读码核实可达性**，不许把正确行为写成永远验不通（§八 已因此返工过三次）。
- 改完源码要**整程序退出 `noname.exe` 重启**才生效（本体 SW 在内存里缓存模块）。
- 真机做不到的项**移进收尾清单，不阻塞阶段推进**；不假装"已验证"。

---

### Task 1: 整包不再夹带内部文档（含本计划与后续测试表）

**为什么排第一：** 用户已定"整包排除内部三件"（`README.md`/`docs/PROGRESS.md`/`docs/modularization-audit.md`）。P14 要新增 `tests/modules/*.md` 与 `docs/superpowers/plans/*.md`，都是内部件；现在的排除是**精确路径 Set**，新文件会照样打进 112MB 整包，每改一次测试表就churn 一次整包 sha。

**Files:**
- Modify: `scripts/build-release.mjs:49`（`FULL_PACKAGE_EXCLUDES`）、`:173-179`（`distFiles`）
- Test: `tests/p10-release.test.mjs`（追加一组用例）

**Interfaces:**
- Consumes: `distFiles(distDir, excludeAbs)` 现返回相对路径数组。
- Produces: `FULL_PACKAGE_EXCLUDES` 语义扩展为"精确路径 + 目录前缀"；导出新纯函数 `isPackagedFile(rel)` 供测试直接断言。

- [ ] **Step 1: 写失败的测试**（追加到 `tests/p10-release.test.mjs` 末尾）

```js
// 整包不得夹带内部文档：精确路径 + 目录前缀两种都要挡
const { isPackagedFile } = await import("../scripts/build-release.mjs");
for (const rel of ["README.md", "docs/PROGRESS.md", "docs/modularization-audit.md",
	"docs/superpowers/plans/2026-09-29-p14-final-testing.md", "tests/modules/mobile.md"]) {
	assert.equal(isPackagedFile(rel), false, `内部文档不该进整包：${rel}`);
}
for (const rel of ["src/content.js", "extension.js", "modules/installed.json", "image/card-skins/.gitkeep"]) {
	assert.equal(isPackagedFile(rel), true, `玩家要的东西被误排了：${rel}`);
}
```

- [ ] **Step 2: 跑测试确认它红**

Run: `node --import ./tests/helpers/register.mjs tests/p10-release.test.mjs`
Expected: FAIL —`isPackagedFile is not a function`

- [ ] **Step 3: 最小实现**（替换 `scripts/build-release.mjs:49` 与 `distFiles` 里那行过滤）

```js
/** 整包排除项：精确路径 + 目录前缀（内部文档不进玩家包；新增内部目录只往这里加一行） */
const PACK_EXCLUDE_FILES = new Set(["README.md", "docs/PROGRESS.md", "docs/modularization-audit.md"]);
const PACK_EXCLUDE_DIRS = ["docs/superpowers/", "tests/"];
export const isPackagedFile = rel => !PACK_EXCLUDE_FILES.has(rel) && !PACK_EXCLUDE_DIRS.some(dir => rel.startsWith(dir));
```

```js
	.filter(rel => isPackagedFile(rel))   // 取代原来的 .filter(rel => !FULL_PACKAGE_EXCLUDES.has(rel))
```

注意：`FULL_PACKAGE_EXCLUDES` 若还有别处引用（`verifyFullPackage` 的反向断言），一并换成 `isPackagedFile`，**不许留两份判据**。

- [ ] **Step 4: 跑测试确认绿**（含 `verifyFullPackage` 那组仍绿）

Run: `node --import ./tests/helpers/register.mjs tests/p10-release.test.mjs && node --import ./tests/helpers/register.mjs tests/p9-release-index.test.mjs`
Expected: 两套都 `OK`

- [ ] **Step 5: 重建并核对整包真的少了文件**

Run: `pnpm build`
Expected: `[P10产物] 生成并校验通过`；整包文件数比改前**减少**（`tests/` 与 `docs/superpowers/` 被剔出）；记下新的文件数/字节/sha 供台账用。

- [ ] **Step 6: 提交**

```bash
git add scripts/build-release.mjs tests/p10-release.test.mjs
git commit -m "fix(P10): 整包排除内部文档改为按目录前缀（P14 新增文档不再churn整包哈希）"
```

---

### Task 2: §52 每模块独立测试表（9 份）+ 静态不变量

**Files:**
- Create: `tests/modules/core.md`、`decade.md`、`mobile.md`、`yjcm.md`、`online.md`、`baby.md`、`codename.md`、`card-skin.md`、`kill-effect.md`
- Test: `tests/p14-module-tables.test.mjs`

**Interfaces:**
- Consumes: `getModuleSystem().moduleManager.list()` → `{id,name,version,type,installed,enabled,capabilities}`（`src/core/moduleSystem.js`）。
- Produces: 约定表头 `| 项目 | 判据 | 层级 | 结果 | 证据 |`；`层级` 取值只允许 `静态 / Node / 真机 / 不适用`；`结果` 取值只允许 `待验 / 通过 / 失败 / 不适用`。

- [ ] **Step 1: 写失败的测试**（新建 `tests/p14-module-tables.test.mjs`）

```js
/**
 * P14 · §52 静态不变量：每个注册模块都必须有一份测试表，且表结构合规。
 * 文档会漂移，所以用测试盯：模块增删、表头改动、结果列留空都要红。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { getModuleSystem } from "../src/core/moduleSystem.js";

const LEVELS = new Set(["静态", "Node", "真机", "不适用"]);
const RESULTS = new Set(["待验", "通过", "失败", "不适用"]);
const { moduleManager } = getModuleSystem();
const ids = moduleManager.list().map(item => item.id);

assert.ok(ids.length >= 9, `注册模块数异常：${ids.length}`);
for (const id of ids) {
	const file = `tests/modules/${id}.md`;
	assert.ok(fs.existsSync(file), `§52 要求每模块一份测试表，缺 ${file}`);
	const rows = fs.readFileSync(file, "utf8").split("\n")
		.filter(line => /^\|\s*[^-|]/.test(line) && !line.includes(" 项目 "))
		.map(line => line.replace(/\\\|/g, " ").split("|").slice(1, -1).map(cell => cell.trim()));
	assert.ok(rows.length > 1, `${file} 除了表头没有任何测试项`);
	for (const row of rows.slice(1)) {
		assert.equal(row.length, 5, `${file} 行列数应为 5：${row.join(" / ")}`);
		assert.ok(LEVELS.has(row[2]), `${file} 层级取值非法：${row[2]}`);
		assert.ok(RESULTS.has(row[3]), `${file} 结果取值非法：${row[3]}`);
		assert.ok(row[4] !== "" || row[3] === "待验", `${file}「${row[0]}」有结果却没证据`);
	}
}
```

- [ ] **Step 2: 跑测试确认它红**

Run: `node --import ./tests/helpers/register.mjs tests/p14-module-tables.test.mjs`
Expected: FAIL — `缺 tests/modules/core.md`

- [ ] **Step 3: 写九份表**（同一模板，内容按模块实态填；下面是 `mobile.md` 的完整示例，其余八份**逐份按各自判据写满**，不留占位）

```markdown
# mobile（移动版样式包）测试表

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/mobile/1.4.2/manifest.json` 可解析，`id/version` 与台账一致，声明的 entry 文件都在 | Node | 待验 | — |
| 安装 | 模块管理窗口安装后台账记 `source:"installed"` + `hashVerified:true`，目录在 `modules/mobile/1.4.2/` | 真机 | 待验 | — |
| 启用 | 切到移动版后玩家框/手牌按钮用包内 CSS（`getModuleBase("mobile")` 为包根），无双根同时加载 | 真机 | 待验 | — |
| 禁用 | 关掉移动版样式回落到默认套，Core 其余功能不受影响 | 真机 | 待验 | — |
| 更新 | 索引里 `mobile.latest` 更高时提示窗列出该项；更新后 `previousVersion` 记录、旧版本目录仍在 | 真机 | 待验 | — |
| 卸载 | 目录改名 `.removing-*` 让位、台账成功后清理；卸载后样式不可用而 Core 正常 | 真机 | 待验 | — |
| 重装 | 卸载后同版本重装成功，无残留临时目录 | 真机 | 待验 | — |
| 回退 | 手工破坏 `manifest.json` 后重启 → 自动回退上一版并把坏目录改名 `.corrupt-*` | 真机 | 待验 | — |
| 依赖 | `dependencies:["core"]` 满足；`core` 版本不符时报 `DEP_MISSING`/不装 | Node | 待验 | — |
| 资源在场 | 未装包时 `isCardSkinAvailable` 同类判据为假，不出现半加载 CSS | 静态 | 待验 | — |
```

`core.md` 的表要额外覆盖：整包/分包产物一致（`pnpm verify:release`）、Core 落后只提示不替换（P11）、旧版迁移与自动禁用（P13）、更新检查静默失败三态（P11）。`kill-effect.md` 是**门控型**（`pack:false`），"安装/卸载/更新/回退"四行按约定写 `不适用` 并在判据里写明原因（资源随 Core 发布）。

- [ ] **Step 4: 跑测试确认绿**

Run: `node --import ./tests/helpers/register.mjs tests/p14-module-tables.test.mjs`
Expected: `p14-module-tables: OK`

- [ ] **Step 5: 反验（判据必须真的咬得住）**

临时把 `tests/modules/mobile.md` 表头改成 4 列、把某行结果写成 `OK` → 跑测试应红两处 → 改回。

- [ ] **Step 6: 提交**

```bash
git add tests/modules/ tests/p14-module-tables.test.mjs
git commit -m "test(P14): §52 每模块独立测试表 + 表结构静态不变量（任务书§52）"
```

---

### Task 3: §51 五类测试总账矩阵（把§八 挂账项并进来）

**Files:**
- Create: `tests/modules/P14-matrix.md`
- Test: `tests/p14-module-tables.test.mjs`（追加矩阵校验段）

**Interfaces:**
- Consumes: `docs/PROGRESS.md` §八 现有小节 `P5/P6/P8/P9/P11/P12/P13` 与 `R1..R6` 条目（当前计数：R 8 条、P11 5 条、P12 4 条、P13 4 条、P6 1 条）。
- Produces: 矩阵表头 `| 类别 | 用例 | 覆盖方式 | 归属 | 状态 |`；`覆盖方式 ∈ {Node, 静态, 真机, 文档}`；`归属 ∈ {我, 用户, 双方}`；`状态 ∈ {待办, 已做, 本机不可验}`。

- [ ] **Step 1: 写矩阵的校验段（先红）**

```js
// §51 五类必须都有行；每行必须有归属；"已做"必须给证据列（这里以非空判）
const matrix = fs.readFileSync("tests/modules/P14-matrix.md", "utf8").split("\n")
	.filter(line => /^\|\s*(安装|模块|样式|平台|游戏模式)\s*\|/.test(line))
	.map(line => line.replace(/\\\|/g, " ").split("|").slice(1, -1).map(cell => cell.trim()));
for (const kind of ["安装", "模块", "样式", "平台", "游戏模式"]) {
	assert.ok(matrix.some(row => row[0] === kind), `§51 类别「${kind}」在矩阵里一条都没有`);
}
for (const row of matrix) {
	assert.equal(row.length, 5, `矩阵行列数应为 5：${row.join(" / ")}`);
	assert.ok(["我", "用户", "双方"].includes(row[3]), `矩阵行缺归属：${row[1]}`);
	assert.ok(["待办", "已做", "本机不可验"].includes(row[4]), `矩阵行状态非法：${row[1]}`);
}
```

- [ ] **Step 2: 跑测试确认红**（文件还不存在）

- [ ] **Step 3: 写矩阵**：五类逐条列，**每条要么指向已有 Node 用例（写文件名），要么标真机+归属=用户，要么标本机不可验**。§八 已挂账的 R1/R4/R5/R6、P6-1、P11-2/4/5、P12-1..4、P13-3/4 全部搬进矩阵对应类别，并在 `docs/PROGRESS.md` §八 各小节标题后加一行「→ 已并入 `tests/modules/P14-matrix.md`」，**不删原表**（历史账本）。

- [ ] **Step 4: 跑测试确认绿** + 全套件仍 14+1=15 套绿

- [ ] **Step 5: 提交**

```bash
git add tests/modules/P14-matrix.md tests/p14-module-tables.test.mjs docs/PROGRESS.md
git commit -m "test(P14): §51 五类测试总账矩阵，§八挂账项并入（任务书§51）"
```

---

### Task 4: 能自动化的先自动化（补§51 里 Node 可跑的缺口）

**Files:**
- Modify: `tests/p5-installer.test.mjs`、`tests/p12-repair.test.mjs`（按盘点结果补用例）
- Create: `tests/p14-install-states.test.mjs`（若盘点后确认缺口独立成组更清晰）

- [ ] **Step 1: 先盘点再动手**：把§51「安装」五态与「模块」六态逐条对到现有用例文件名，产出一张缺口清单写进矩阵的"覆盖方式"列。**已有覆盖的不重复工**（安装五态：首次/重复/下载失败/校验失败/中途失败在 `p5-installer` 与 `p5-jszip-source` 里都有对应块；模块六态里"启用/禁用"当前语义是"随包状态自动"，需确认是否有断言）。
- [ ] **Step 2: 对每个缺口先写 RED 用例**（单文件单断言组，跑一次确认红在预期位置）。
- [ ] **Step 3: 只在判据本身有缺陷时才改实现**；改实现前先按"原行为是验收基线"去原版/现有行为取证。
- [ ] **Step 4: 全套件 + 门禁绿**，逐缺口各起一笔提交（`test(P14): …`）。

---

### Task 5: 真机批次（用户执行，我出探针与判据）

**Files:**
- Modify: `tests/modules/*.md` 的"结果/证据"列（回填真机结论）
- Modify: `tests/modules/P14-matrix.md` 状态列

- [ ] **Step 1: 按矩阵分批**（每批 ≤5 条，同一次重启能验完）：批1 样式六套切换 + 卡面五套可用；批2 模块安装/卸载/重装/更新/回退（含 P12 四条）；批3 平台（PC/手机/横屏）与游戏模式（身份/国战/斗地主/联网）。
- [ ] **Step 2: 每条给单行单表达式探针 + 读码得出的判据 + `try/catch`**，并明确"改完源码要整程序重启"。
- [ ] **Step 3: 他跑完，我自己查盘核对**（工作目录就是游戏加载目录）：目录/台账/临时件残留一律我用脚本核，不让他再开终端。
- [ ] **Step 4: 回填表格与矩阵**，失败项开修复任务（另起 fix 提交），本机不可验项标 `本机不可验` 并保留在§八。

---

### Task 6: 收尾与台账

- [ ] **Step 1:** §四 新增「P14 记录」表（范围/产物/判据/未做/待真机）；§三 各加一行门禁证据；§一 当前阶段改指 P14 状态；§六 追加下一步。
- [ ] **Step 2:** README 变更日志 v1.22（一句话结论 + 门禁数字 + 提交哈希）。
- [ ] **Step 3:** `node tmp/audit-tables.mjs`（表形审计）必须绿；台账改动走 `.mjs` 脚本 + 锚点唯一断言。
- [ ] **Step 4:** 单独一笔 `docs(P14): …` 提交；报告前 `git ls-remote origin main` 核实，推送留给他。

---

## Self-Review（写完后自查，已在本计划内修正）

1. **规格覆盖**：§51 五类 → Task 3 矩阵逐类强制有行（测试断言）；§52 每模块一表 → Task 2 静态不变量按 `moduleManager.list()` 动态取 id，新增模块自动要求补表。安装/模块六态 → Task 4 盘点补缺口。平台/模式只能真机 → Task 5 + 矩阵标归属。
2. **占位符扫描**：无 TBD/"适当处理"；`kill-effect.md` 的 `不适用` 是**语义正确**而非占位（门控型无安装/卸载），已在判据列写明原因。
3. **类型一致性**：表头五列在 Task 2/3 一致；`isPackagedFile(rel)` 在 Task 1 定义、Step 1 测试引用同名；`moduleManager.list()` 字段名与 `src/core/moduleSystem.js` 实际返回一致（`id/name/version/type/installed/enabled/capabilities`）。
