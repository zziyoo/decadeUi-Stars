# 十周年UI-Stars 工作进度与交接文档

> 本文档记录工程当前状态，供后续 Agent / 开发者**快速接手**。每次会话结束前必须更新本文档并提交。
>
> 阅读顺序：[README.md](../README.md)（总任务书，一切以它为准）→ 本文档 → [modularization-audit.md](modularization-audit.md)（P0审计报告）。

---

## 一、工程概况

| 项目 | 内容 |
|---|---|
| 工程目标 | 将单体"十周年UI"扩展升级为 Core + Style Pack + Feature Pack + Shared Resource 模块化UI平台（按需下载/安装/启停/更新/卸载） |
| Stars 仓库 | https://github.com/zziyoo/decadeUi-Stars （本仓库，**独立开发仓库，已迁入源码**） |
| 原版扩展（玩家在用，不动） | `zziyoo/decadeUi`，本地路径 `C:\Users\32360\Desktop\无名杀-win32-x64\resources\app\extension\十周年UI` |
| 总路线 | P0审计 → P1模块基础设施 → P2公共依赖解耦 → P3十周年Pack → P4移动版Pack → P5下载器 → P6模块管理界面 → P7全部Style → P8 Feature Pack → P9模块化构建 → P10 Release → P11自动更新 → P12回滚 → P13旧版本迁移 → P14全量测试 |
| 当前阶段 | **P14 最终测试（任务书§51 + §52）—— 工具链完成（`af8d827` `c8b0c59` `b82b424` `a1483fa`），真机三批待用户跑**：已交付 ①整包排除改按目录前缀（内部文档不再 churn 112MB 整包 sha）②§52 九份模块测试表 + 表结构静态不变量 ③§51 五类总账矩阵（33 行，含两条反假绿规则与「总账不许漏账」）④盘点矩阵全部「已做」条目并补上唯一没有用例的那条（`src/core/uiMode.js`）。**盘点查出两处假账**：矩阵里写了不存在的错误码 `HASH_MISMATCH`（真实是 `SHA_MISMATCH`）、以及「排除模式不装载插件」长期挂「已做」却无任何用例。上一阶段 **P13 旧版本迁移** 代码完成、真机 P13-1/P13-2 已过，P13-3 并入 P14 批1、P13-4 本机不可验。P12 四条与 P11 三条真机项已进矩阵，随批 2 一起跑。P10 建 Release/传资产/推 tag 是用户动作。 |

## 二、环境备忘（本机关键信息）

- **Git 2.55 装在 `D:\Git\`，不在 PATH 中**。调用方式：`D:\Git\cmd\git.exe`。
- **网络**：git 直连 github.com 会被重置，本机系统代理为 `127.0.0.1:7897`。本仓库已配置**局部**代理（`git config --local http.proxy` / `https.proxy`），未动全局配置。
- **认证**：Windows 凭据管理器已有 GitHub 凭据（`git:https://github.com`），git push 自动认证。GitHub CLI 已安装但未登录。
- **git 身份**：`ziyoo / 166354372+zziyoo@users.noreply.github.com`（全局配置）。
- **规则**：bash 不可用时用 PowerShell；cmd 下命令分隔符用 `&` 而非 `;`；bash 代码不要内联传给 `bash -c`（写成 .sh 文件执行）。
- **pnpm 陷阱**：用户主目录 `C:\Users\32360` 存在全局 pnpm-workspace.yaml，`pnpm install` 会向上命中它而跳过本项目。本项目根已放置 `pnpm-workspace.yaml`（`packages: []` + `allowBuilds` esbuild/@parcel/watcher: true）固定 workspace 根。安装源 npmmirror，无需代理。
- **构建**：`pnpm install && pnpm build`（Node 24 + pnpm 11）。语法校验可用 `node --check`（package.json 的 type: module 使其按 ESM 解析）。

## 三、已完成

| 日期 | 内容 | 提交/产物 |
|---|---|---|
| 2026-09-27 | 建立本仓库，首推 4 个文件（README.md 任务书、extension.js、info.json、.gitignore） | `dc91e82` |
| 2026-09-27 | 确认原版十周年UI位置与规模：约 113MB / 3400+ 文件（assets 12.5MB/290、audio 9.9MB/241、image 34.5MB/1596、src 2.3MB/174、ui 53.9MB/1094） | 本次审计输入 |
| 2026-09-27 | 创建本文档 | — |
| 2026-09-27 | **完成 P0 模块化架构审计**，产出 `docs/modularization-audit.md`（15节+3附录） | 见下节"进行中" |
| 2026-09-27 | **迁入原版 v1.4.2 全部源码**（src/ui/image/audio/assets/docs + 构建文件 + LICENSE；原版README→docs/extension-readme.md；合并.gitignore；未迁 .github CI 与 .git） | 文件数校验一致：src=174/ui=1094/image=1596/audio=241/assets=290 |
| 2026-09-27 | **P1 开发版改名**：十周年UI → 十周年UI-Stars（info.json/package.json/配置键前缀/路径/playAudio分段参数/extensionMenu访问） | 154 个 JS 全量 node --check 通过 |
| 2026-09-27 | **P1 模块基础设施完成**（详见§四） | node 冒烟测试 ✓；vite build ✓（4.5s） |
| 2026-09-27 | **P2 公共依赖改造完成**（详见§四）：38处样式配置读取收口 styleRuntime；资源路径扩展名全部动态化 | P2 冒烟测试 ✓；构建 ✓ |
| 2026-09-27 | **P2 阻塞问题修复**（详见§四"修复记录"）：extension.js 首启顺序、ResourceLoader 正式抽象、3处模块求值期回归 | 201 个 JS 语法 ✓；P1/P2 测试 ✓；构建 ✓ |
| 2026-09-27 | **热修复：同步上游 equipCopy.js**。原版仓库在本会话进行中被作者更新（01:33 引入 bug 的提交 → 02:08 修复提交），本仓库 02:01 的迁移快照恰好捕获中间损坏态（使用 wrapBefore 但缺 import）→ content() 在 setupEquipCopy 中断 → 角色框布局覆写未执行（用户实测发现）。已同步上游修复版（自包含、不再依赖 wrap*）并重做键改名 | 测试 ✓；构建 ✓ |
| 2026-09-27 | **P3 第一子任务：getModuleBase 正式实现**（moduleManager.getInstallState 数据源 + 解析规则 + 切换点测试） | P3 新测试 ✓；P1/P2 回归 ✓；构建 ✓ |
| 2026-09-27 | **P3-1：decade 样式CSS组迁入独立包**（详见§四末"记录"）。六个样式CSS（player1+shizhounian系5个）+ 51个自有图片迁入 modules/decade/1.4.2/，url重写208处全可达；运行时按安装状态条件加载 | P3/P1/P2 测试 ✓；构建（含dist包部署）✓ |
| 2026-09-27 | **P3-2：decade 皮肤JS迁入独立包**。git mv 三个 shizhounian.js 至包内镜像路径（ui/{character,skill,lbtn}/skins/），相对导入重写为跨包引用（base.js/gskillMixin.js/skillButtonTooltip 回溯扩展根，6处全可达）；三个 skins/index.js 加安装状态路由：已装包→包根加载，未装→单体路径（decade单体副本已删→皮肤不可用而Core正常） | 语法 ✓；P1/P2/P3 测试 ✓；构建 ✓ |
| 2026-09-27 | **P3-3：skill/shizhounian 资产迁入包**。补齐6个包内缺失文件（window变体等），包内CSS 37处引用由指向单体改为包内副本（P3-1遗留的relative()指向偏差一并修复），单体 ui/assets/skill/shizhounian/ 整目录删除。**边界发现**：character/shizhounian 被名将杀(codename)皮肤跨样式共用、image/styles/decade 被Core JS引用——两者按§25留单体（Shared候选），不强制迁移 | verify-pack 208可达/0未知缺失 ✓；P1/P2/P3 测试 ✓；构建 ✓ |
| 2026-09-27 | **P4：mobile 样式包拆分**（CSS组+皮肤JS×3，复用P3模式）。组装脚本含死引用通用化处理（改写指针+manifest.deadRefs登记）；verify-pack 泛化为多包校验（installed.json驱动，400可达/0未知缺失）；decadeModule 迁移样式集合泛化（MIGRATED_STYLE_IDS）；mobile manifest 含 entry.js；shousha资产因跨样式引用（skill-state/phase-tips/ui/utils默认值）留单体待Shared路由 | 15条皮肤导入全可达 ✓；P1/P2/P3 测试 ✓；构建 ✓ |
| 2026-09-27 | **（上一会话遗留，本轮收尾提交）yjcm/online/baby/codename 四包批量拆分**：`scripts/migrate-style-packs.mjs` 一次性拆四个样式（CSS组6×4+皮肤JS×12，自有图片随引用复制进包、共享/死引用指向扩展根并登记 deadRefs），单体 CSS/皮肤 JS 已 git rm（已 staged），`builtInModules` 全 `pack:true`、`MIGRATED_STYLE_IDS` 六样式、installed.json 六包。**状态：工作区在制品，未提交**（详见§四末） | verify-pack 881可达/17已知死引用/0未知缺失 ✓；skin-imports 37可达/0缺失 ✓ |
| 2026-09-27 | **P5 下载器与包安装器完成**（任务书§42，详见§四"P5 记录"）：downloader.js（HTTP/进度/重试/取消/超时/SHA256）、packageInstaller.js 正式实现（§17/§18/§19/§11/§24/§20）、moduleIo.js（复用本体文件与 JSZip 能力 + zip-slip 防护）、registry.unregister、manifest 版本比较与 core 检查、moduleSystem 注入端口；顺带修 P3-1 手机布局 window CSS 多加载回归 | 210 JS 语法 ✓；P1/P2/P3/**P5** 测试 ✓；构建 ✓（未进游戏实测） |
| 2026-09-27 | **P5 审查修复：可靠性与安全边界**（详见§四"P5 审查修复记录"）：IO 适配层重写为永不 pending（真实 error callback 优先、`IO_STALL` 兜底判失败、桌面端自建递归 mkdir 取代 `game.ensureDirectory`）；SHA256 判据收归外部 `expectedId/expectedVersion/expectedSha256`；安装让位目录保留到台账写成功后才清理、回滚失败 → `ROLLBACK_FAILED`；卸载改 `.removing-*` 让位事务；`force` 不再绕过 §19 三条边界；`atomicRename` 能力如实上报 | 215 JS/mjs 语法 ✓；P1/P2/P3/P5 四套测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；构建 ✓（仍未进游戏实测） |
| 2026-09-27 | **P5 补充修复一：跨平台文件移动与 IO 吞错**（`df2afea`）：`movePath` 按源类型分流，修掉"用 copyTree 搬文件 → 一个字节不复制却把源删掉"（Android/SAF 上表现为 `installed.json` 永不更新）；`kindOf` 不再把权限/磁盘/`IO_STALL` 吞成"不存在"（entry 检查/已在位预检/发布目标/卸载根/localVersions 五处各自转结构化错误）；`writeInstalled` 无原子 rename 平台改「备份 → 提交 → 回读校验 → 失败还原」，还原失败抛 `StateCommitError` → 调用方报 `ROLLBACK_FAILED`+residual；卸载让位恢复失败改报 `ROLLBACK_FAILED`；空 `installed.json` 判 `INSTALLED_CORRUPT` 不再当空台账改写 | 215 JS/mjs 语法 ✓；四套测试 ✓（新增 21 块）；verify-pack/skin-imports ✓；构建 ✓ |
| 2026-09-27 | **P5 补充修复二：非原子平台 file→已存在文件的目标事务**（`29a69e3`）：`movePath` 的 file 分支改为专用 `moveFileNonAtomic`（写临时目标并校验 → 备份旧目标 → 提交并回读校验 → 删源 → 清理事务件）；提交失败恢复旧目标、**提交成功但删源失败明确报 `IO_FAILED` 且不回滚已提交目标**、恢复失败抛 `IO_ROLLBACK_FAILED`+residual 并保留备份；目录搬运保持 `copyTree + removeTree` 未动 | 语法 ✓；四套测试 ✓（新增 A~H + 目录目标共 9 块）；verify-pack/skin-imports ✓；构建 ✓ |
| 2026-09-27 | **P6 模块管理界面完成**（任务书§43，详见§四"P6 记录"）：新增纯逻辑模型 `src/core/moduleAdmin.js`（行状态/动作判定/结果码文案/大小格式化）+ 独立窗口 `src/features/moduleManagerWindow.js`（列表/行内按钮/进度/取消/二次确认/重载）+ 样式 `module-manager-window.css`；新增模块源配置键 `moduleIndexUrl`（definitions/misc.js + handlers/module-handlers.js）与配置窗口"模块管理界面"按钮；入口 `decadeUI.showModuleManager`/`Ctrl+Shift+M`。**明确不做**启用/禁用与真实 module-index 资产 | 179 JS/mjs 语法 ✓；P1/P2/P3/P5/**P6** 五套测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；构建 ✓（UI 未进游戏实测） |
| 2026-09-28 | **P8 Feature 运行时 + kill-effect 门控完成**（任务书§45/§16，`b4d8db5` + 定性修正 `8f89e43`，详见§四"P8 记录"）：新增 `src/core/featureRuntime.js`（声明/门控矩阵/CSS 由 manifest 驱动/能力归属）；`moduleSystem` 把 P1 起悬空的 `isModuleEnabled` 钩子接到 `switchOn`；`builtInModules` 按声明注册 feature 模块（entry.css 备单体/包内两套路径）；`setupEffects()` 改为门控装载，Core 调用点全部可选链降级（`decadeUI.effect?.kill?.()`）；`layout.css` 的 `@import "effect.css"` 移除，改由 Feature 激活时 `resourceLoader.loadCSS` 加载。**用户决定**：kill-effect 不搬资源，定性为**门控型 Feature**（`pack:false` 恒久），"幻影出牌"不受它管辖（自有开关 `cardGhostEffect`）。**注：本行的"CSS 由 Feature 激活时加载"与"kill/skill 一起门控"已由 `d31ab7e` 按原版语义修正，见下一行与§四"P8 修复记录"** | 182 JS/mjs 语法 ✓；P1/P2/P3/P5/P6/**P8×2** 七套测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；构建 ✓（未进游戏实测） |
| 2026-09-28 | **P6 扩展：Feature 行与启用/禁用**（`16c398d`）：`buildRows` 新增 `featureStates` 入参——门控型出「内置功能」行并只给启用/禁用（动作带 `switchKey`，写外观页同一个配置键，不另立状态源），拆包型走安装/卸载通道、装上后才给启停；不传该参数时行为逐字不变。窗口侧 `collectFeatureStates()` 由 `featureRuntime.list()+switchOn()` 得出，启停后提示需重载；顺带把 `manifest.core` 传给行模型（离线时"兼容性"列不再一律"未声明 Core 要求"） | 182 JS/mjs 语法 ✓；七套测试 ✓（P6 新增 6 类行断言 + 真实接线用例；P8 锁定声明字段集）；verify-pack/skin-imports ✓；构建 ✓ |
| 2026-09-28 | **P8/P6 两处修复**（`48a82bc` + `d31ab7e`，详见§四"P8 修复记录"）：①`moduleManagerWindow.refresh()` 不再在 `isAvailable()===false` 时整窗提前 return——门控型 Feature 的启停不碰文件系统，任何平台都必须可用；改为 `buildRows` 新增 `installBlocker`，只置灰 `install/update/uninstall`（附加平台理由、保留 §19 原理由与 `spec`）。②按**原版语义**收窄门控：`killEffect` 只管击杀那一路，`effect.skill`/`effect.line`/`dialog`/`ghost` 恢复无条件注册，`effect.css` 回 `layout.css` 的 `@import`（内含技能特效用的 `.skill-name`），`kill-effect` 的 capabilities 去掉 `skill-effect`、manifest `entry.css` 置空，技能特效调用点去掉可选链回到原版直调 | 182 JS/mjs 语法 ✓；七套测试 ✓（P6 新增 4 块平台降级断言；P8 重写门控接线用例并锁住调用点边界）；verify-pack 881/0、skin-imports 37/0 ✓；构建 ✓ |
| 2026-09-28 | **P8 第二刀：card-skin 拆包完成**（任务书§45/§60，`28e1092` 寻址与门控 + `0e890c7` 文件搬迁，详见§四"P8 card-skin 记录"）：`card-skin` 成为第一个 `pack:true` 的 Feature，`switchKey:null`（开关语义仍归 `cardPrettify` 的 `off`，不造第二套状态源）；`resourceLoader` 新增 `getModuleRel()` 让"URL 根"与"目录扫描根"共用同一决策；`statics` 按皮肤归属定根（内置五套→包根、玩家自建→单体根、第三方 `registerDecadeCardSkin` 一字未动）；`registerSkins` 顺带发布可用性（扫到 0 张即不可用），`skin-loader.buildSkinUrl` 不可用时返回空串并去掉硬编码扩展名回落，`skin-applier` 把"选中但无牌面"等同 `off`，外观页下拉改用 `getAvailableCardSkinPresets()`。五套卡面 1016 文件 / 21,500,762 字节经 `git mv` 进 `modules/card-skin/1.4.2/`（git 侧 1016 条 rename@100%、零增删），`image/card-skins/.gitkeep` 保留玩家皮肤根 | 184 JS/mjs 语法 ✓；P1/P2/P3/P5/P6/**P8×3** 八套测试 ✓（新增 `tests/p8-card-skin-pack.test.mjs`：假 `game.getFileList` 驱动真实扫描）；数量守恒逐套一致 ✓；verify-pack 881/0、skin-imports 37/0 ✓；构建 ✓（dist 包内 1017 文件、单体侧仅剩 .gitkeep） |
| 2026-09-28 | **P8 card-skin 验收修复（`64719f3`）**：`registerSkins` 无条件发布可用性，而它同时服务内置扫描与第三方 `registerDecadeCardSkin` —— 别人一次空目录注册即把内置 `decade` 整体标为不可用（`skin-applier` 当 `off`），是对 §57 兼容 API 的行为回归（原版文档示例就是用 `skinKey:'decade'` 复用）。改为 `registerSkins(..., { publishAvailability })`，只有 `loadBuiltinSkins` 的内部扫描传 `true`；第三方两条调用点保持四参不写 availability，皮肤根/去重优先级/`READ_OK` 语义未动，未新增第二套状态源 | 184 JS/mjs 语法 ✓；八套测试 ✓（`p8-card-skin-pack` 新增 A/B/C/D 四态，RED 实测为「B：false 不等于 true」）；verify-pack 881/0、skin-imports 37/0、card-skin `--verify` 1016/20.5MB ✓；`pnpm build` ✓ |
| 2026-09-28 | **P9 构建系统模块化完成**（任务书§46，`dea6561` 相对地址解析 + `d5b8baf` 构建脚本，详见§四"P9 记录"）：`pnpm build` 追加一步 `scripts/build-release.mjs`，产出 `dist/release/` 下 7 个分包 zip（6 样式 + card-skin）与 `module-index.json`，同一次运行内做完整校验；`--verify` 供门禁复跑、`--list` 预览。zip 根必须直接是 `manifest.json`、条目名 POSIX、**不写目录条目**（父目录条目带当前时间会让同样内容算出不同摘要）；索引 url 写裸文件名，绝对化只由安装器 `resolveModuleUrl(url, indexUrl)` 一处负责（对绝对地址幂等，依赖递归同路）；`fetchIndex` 回带 `indexUrl`，窗口把 `indexUrl` 与 `index` 一起交给 install/update（顺带接通了 P5 §11「缺依赖先按索引装依赖」在界面上一直走不到的分支）。Core 本轮不列为可安装包（无包形态）。新增 devDep `jszip@3.10.2`（仅构建期） | 186 JS/mjs 语法 ✓；P1/P2/P3/P5/P6/P8×3/**P9** 九套测试 ✓；跨 3 秒两次构建 7 个 zip 与 index 逐字节一致 ✓；`--verify` 全项通过 ✓；verify-pack 881/0、skin-imports 37/0、card-skin `--verify` 1016/20.5MB ✓；`pnpm build` ✓（含 release，实测 7.7s） |
| 2026-09-28 | **P5 真机前静态取证出的两个必败点修复（`5c7b557`，A+C）**：①本体把 `jszip@2.7.0` 当**内联 ES 模块**用（`noname/get`、`optionsMenu` 都 `import "_virtual/index2.js"`），`noname.js` 里 `window.JSZip`/`globalThis.JSZip` 出现 **0 次**，`resources/app/game/jszip.js` **不存在** ⇒ 旧 `defaultLoadJsZip` 两条路全断，真机 `install()` 必败。新增 `createJsZipSource()`：`window.JSZip` → **本体公开 API `get.zip(cb)`**（实现即 `callback(new JSZip())`，从实例取 `constructor`）→ `lib.init.js(game/jszip)`，每级过"必须有 2.x `load()`"的形状校验（顺带堵掉"别的扩展 vendor 了 3.x 挂全局"的侥幸），结果连失败一起缓存，解压改为 `new Ctor()` + `zip.load(buffer)`（与本体 optionsMenu 同读法）。②端口形状不一致：安装器 `await extractZip(...)` 当函数调，而 `moduleSystem` 注入的是 `{extract, probe}` 对象 ⇒ 真机 `TypeError` 且不带 ioCode，被解压步误报成 `STRUCTURE_INVALID「解压失败」`（看着像包坏了）。工厂里归一两种形状，归一不了即 `NO_EXTRACTOR`。③能力诚实化：端口暴露 `probe()`、安装器新增 `ready()`、窗口 `refresh()` 额外 `await ready()`，探不过就置灰三个动作并写明原因；`toIoFailure` 增映射 `NO_EXTRACTOR`。**未 vendor、未改本体**（§56禁止1）；台账原先"与 app.importPlugin 完全一致"一句是错的（`importPlugin` 在本体里 grep 不到），已更正 | 187 JS/mjs 语法 ✓；**十套**测试 ✓（新增 `tests/p5-jszip-source.test.mjs`：三级获取、缓存、3.x 形状被拒、不回调落定、零落地、`ready()` 三态，RED 先于实现）；verify-pack 881/0、skin-imports 37/0、build-release `--verify` 7 包、card-skin 1016/20.5MB ✓；`pnpm build` ✓ |
| 2026-09-28 | **实机第一轮打脸，A 方案的假设被证伪后改成按实例交付（`d296f9e`）**：用户跑 `await decadeUI.packageInstaller.ready()` 返回 `ok:false`，reason 是「get.zip 交出的实例不带 2.x 的 load()」+「加载 game/jszip 无响应」。根因不在本体，在我的假设：jszip@2.7.0 用 `JSZip.prototype = {…}` **整体替换原型**，prototype 上没有 `constructor` 属性 ⇒ `instance.constructor === Object`（Node 里 import 本体那份 `_virtual/index2.js` 复核：`getOwnPropertyNames(JSZip.prototype).includes("constructor")` 为 false），"从实例反推构造器"必然失败。端口交付单位换成**实例**：全局自己 new、`get.zip` 每次要一份新实例、脚本级只负责装上再回查全局；选型缓存、实例每次现取（2.x 的 `load()` 原地写入，复用会把上一个包的条目带进下一个）；顺带修 `viaScript` 在脚本回调里无条件 err() 的控制流错误 | 187 JS/mjs 语法 ✓；十套测试 ✓（`p5-jszip-source` 新增实机形状回归锁：constructor 是 Object 也要可用、两次 createInstance 拿到互不污染的实例、选型只验一次、失败缓存零重等、3.x 仍被拒）；verify-pack 881/0、skin-imports 37/0、build-release `--verify` 7 包 ✓；`pnpm build` ✓ |
| 2026-09-28 | **实机第二轮：A+C 确认生效（用户跑，非我方推断）**：`await decadeUI.packageInstaller.ready()` → `{ok:true, reason:""}`；`decadeUI.packageInstaller.isAvailable()` → `{available:true, missingIo:false, missingExtractor:false, atomicRename:true}`。⇒ 解压能力在本机真通（`get.zip` 那条路径在实际运行时里可用），"端口在但取不到库"这一整类假阳性已消除；`atomicRename:true` 同时证实这台是 Electron + `lib.node.fs` 分支（非原子平台分支仍未实测） | 仅台账；代码状态同 `d296f9e` |
| 2026-09-28 | **首个真机 `install()` 通过（用户跑，P5/P9 闭环）**：本地静态服务只暴露 `dist/release/`（8089 被占，改 8099），`fetchIndex` 取索引 → 用**裸文件名 url + indexUrl** 调 `install("baby", {force:true})` → `{ok:true, code:"OK", hashVerified:true, sha256:"b3e38d5f1448…", path:"modules/baby/1.4.2", requiresReload:true, attempts:1}`，进度十阶段齐走、`extracting` 逐条目推进 27 次。到手三条结论：P9 相对地址解析真机通、本体 JSZip 2.7 解得开构建期 jszip 3.10 写的包、发布后 `modules/baby/` 与 git **零 diff**（逐字节复刻）。副产物：`modules/installed.json` 的 baby 条目多出 `installedAt/source:"local"/size/sha256/hashVerified`（测试痕迹，`git checkout -- modules/installed.json` 即回）；`tmp/modules` 留一个空目录（安装器只删文件不删目录，`tmp/` 不入库，与§五 8 的空目录残留边界一致） | 真机验证，本轮零代码改动；事后复跑 build-release `--verify` 7 包 ✓、verify-pack 881/0 ✓ |
| 2026-09-28 | **R6 防篡改自验关闭 + §八 三条探针判据按代码更正 + §四 历史块错位修复**：①新增 `tmp/r6-tamper.mjs`（不入库）跑五类篡改——zip 追加字节、zip 删条目、index 改 `sha256`、index 删条目、index 改 `size`，`build-release --verify` **五类全部 exit=1** 且理由点名（如「索引 size=1 与 zip 实际字节 112079 不符」「索引缺少 codename」），未篡改 exit=0，重新生成后 zip 与 index 摘要**逐字节回基线**。②读码更正三条**永远验不通**的判据：R1「可安装 N 不为 0」（七包同版本全已装 ⇒ `summarize().installable` 恒为 0，正确判据是"已独立安装 7 / 可更新 0"）；R4「进度出现安装依赖」（安装器只有 downloading/extracting/done 三个 stage，`stage:"dependencies"` 只存在于 DEP_CYCLE/DEP_MISSING 失败里，且 core 恒在注册表 ⇒ 连「已先安装依赖 core」warning 都不该出现）；R5（回环 20MB 瞬间下完、取消点不到 ⇒ 给 `tmp/dev-release-server.mjs` 加 `--throttle/--chunk`，实测 card-skin 15.4s，并改用 `update(...,{force:true,signal})` 同版本重装，取消不再删文件）。③`129ea2b` 整块搬移修 §四 历史顺序（重复 `## 四` 标题 + 孤立 `### 历史：P3` 标题，正文零改写，行多重集断言仅少 4 行结构行）。④`git checkout -- modules/installed.json` 清掉真机安装痕迹 | 227 JS/mjs 语法 ✓；十套测试 ✓；verify-pack 881/0、skin-imports 37/0、build-release `--verify` 7 包、card-skin 1016/20.5MB ✓；`pnpm build` ✓；限速服务实测 index 33ms、baby 54ms、card-skin 15442ms、目录穿越 404；工作区 clean |
| 2026-09-28 | **R5 取消与残留真机通过（用户跑 + 我方核残留）**：限速服务（64KB×40ms，card-skin 实测 15.4s）下跑 `update("card-skin", {index, indexUrl, force:true, signal})`，6 秒 `abort()` → `{ok:false, code:"CANCELLED", message:"下载已取消", stage:"downloading", warnings:[]}`；同轮 `fetchIndex` `{ok:true, bytes:2452, attempts:1}`、`listInstalled()` 仍 7 条。残留核法（本目录即游戏加载目录，所以我方能直接查盘）：`git status --short modules/` 零输出、`modules/card-skin/1.4.2/` 仍 1017 文件、无 `.replacing-*/.removing-*`、`tmp/modules` 只剩空目录、`installed.json` 无 `hashVerified/installedAt` ⇒ 取消落在下载阶段，发布与写台账均未触及。**P9 的 R 列五项（R0/R2/R3/R5/R6）已全部到手，只剩 R1 窗口在线列表与 R4 界面依赖判定两条纯 UI 项** | 真机 + 磁盘核对，本轮零代码改动；§八 R5 与§一 已标已过 |
| 2026-09-28 | **R1 通过 + R4 首轮抓出两个真 bug 并修复**：①`fix(P5)` `470b35b`——窗口里第一次装 `codename` 报「发布到 modules/codename/1.4.2 失败：rename tmp/modules/codename-1.4.2-8zs8br EPERM」，同一个包第二次成功（盘上台账 `sha256:be5e8af3094f…`/`hashVerified:true`、包内 32 文件与 git 零 diff）⇒ Windows 目录改名的瞬时冲突，原先只有 EXDEV 会被回落。`movePath` 桌面分支改为对 EPERM/EACCES/EBUSY/ENOTEMPTY 退避 80/160/320/640ms 有界重试；EXDEV 仍走非原子回落，确定性错误与 `IO_STALL` 一次即抛（重试 stall 只会成倍拉长等待）。②`fix(P6)` `5cbe69f`——提示条原文含两遍绝对路径，撑破对话框后被 `overflow:hidden` 剪掉、"滑到底也看不全"；改 `max-height:26%` + `overflow-y:auto` + `flex:0 0 auto` + `word-break:break-all`。③核清一处**不是 bug** 的显示：包全部声明 `dependencies:["core"]` 而行上写「依赖: 无」，是 `moduleAdmin` 的 `shownDeps` 刻意滤掉 core | 先 RED 后 GREEN 四块（注入两次 EPERM 必须成功且恰好 3 次、永久 EPERM 有界 2~8 次且源没被搬空、EROFS 只试 1 次、永不回调落定 `IO_STALL` 且 `renameCalls=1`）；十套测试 ✓；改动文件 `node --check` ✓；verify-pack 881/0、skin-imports 37/0、build-release `--verify` 7 包 ✓；`pnpm build` ✓ 且新 CSS 已进 dist |
| 2026-09-28 | **P9 收尾：解压能力语义统一 + 台账基线恢复（`cc6ee72` + `3d316d2`，详见§四"P9 收尾记录"）**：①`isAvailable()` 从"端口挂没挂"改成"当前已知的可执行能力"——安装器内新增 readiness 缓存（成功失败都缓存、并发复用同一次 probe、重载即清空、不提供 reset），`ready()` 只读这份缓存，界面与安装路径共用；未探测时 `available:false` + `ready:false`（未知 ≠ 可用），探测失败多带 `reason`。②`installInner` 在**下载之前**插真实能力门：探不过即 `NO_EXTRACTOR @ stage="resolving"`，零下载零落盘台账不写（消除"下完 20MB 才发现没 JSZip"），`update` 走同一道门。③窗口 `installBlocker` 改按**端口是否缺失**判定——照搬新语义会让窗口首次打开就误报"本平台不支持"且因 `if (!installBlocker)` 永不触发 `ready()`。④`modules/installed.json` 逐字恢复 `1322767` 基线，清掉真机写入的 `installedAt`/`source:"local"`/`size`/`sha256`/`hashVerified`。JSZip 接线（按实例交付、不碰 `instance.constructor`）、发布事务、构建脚本**一字未改** | `cc6ee72` + `3d316d2`；227 JS/mjs 语法 ✓；**十套**测试 ✓（新增 7 块，全部先 RED）；verify-pack 881/0、skin-imports 37/0、build-release `--verify` exit=0、`pnpm build` ✓；7 个包目录与台账条目一致 |
| 2026-09-28 | **P10 构建侧完成：Full Package + Release 说明/上传清单（`c91a9f8`，详见§四"P10 记录"）**：任务书§47 的 Release 结构落进 `pnpm build`——除 7 个分包 zip 与索引外，新增整包 `十周年UI-Stars-1.4.2-full.zip`（3589 文件 / 112,100,082 字节，包内根目录唯一、解压到 `extension/` 即用）与 `RELEASE-NOTES.md`（说明草稿 + 9 项资产的字节数/sha256 + 模块源地址 + 校验命令）。整包源取 `dist/`（vite 的部署形态，不另立排除表），排除 `release/` 与**内部三件**（总任务书、交接台账、P0 审计报告）——否则每次改台账都会让 112MB 资产摘要变（实测排除后 `pnpm build` 重跑摘要不变）。`--verify` 扩为四段（分包→索引→整包→说明文件按盘上重算逐字节比对），`--list` 列整包。核心决定：**Core 不进 Release**（本仓库源码即本体）、tag `v1.4.2-stars`、建 Release 传资产由用户执行 | `c91a9f8`；228 JS/mjs 语法 ✓；**十一套**测试 ✓（新增 `tests/p10-release.test.mjs`：打包前缀/排除项/无目录条目/两次同摘要 + 四类篡改必失败 + 说明清单完整性 + GitHub Release 形状地址解析）；verify-pack 881/0、skin-imports 37/0、`pnpm build` ✓、`build-release --verify` exit=0 |
| 2026-09-28 | **P11 自动更新完成（`3af2cd3`，详见§四"P11 记录"）**：新增纯逻辑 `src/core/updateChecker.js`（`checkUpdates` 比较本机台账×远程索引×本机 Core 版本，复用 `manifest.compareVersions`；**读不出来就沉默**——本地版本未知/latest 非法/索引比本机旧都不提示；含忽略清单读写纯函数）+ 可关闭提示窗 `updateNoticeWindow.js`/`.css`（列出逐项更新；Core 落后单独一块给发布页链接、**只提示不替换**；按钮＝打开模块管理/忽略此版本/稍后；列表自带滚动上限，避开 P6 提示条被剪的坑）。接线在 content 阶段末尾异步查一次（5 秒超时，未配置/离线/坏索引/抛错**一律静默**、不弹空窗、不写状态、不阻塞进游戏）；新增配置键 `autoCheckUpdate`（init:true），忽略记录走 `extension_<名>_ignoredUpdates`。另加 `tmp/make-update-demo.mjs` 造"真有新版"的演示源（baby/core 标 1.4.3，只动 tmp/） | `3af2cd3`；231 JS/mjs 语法 ✓；**十二套**测试 ✓（P11 新增 19 组用例，Core 忽略与批量忽略先 RED）；verify-pack 881/0、skin-imports 37/0、`pnpm build` ✓、`build-release --verify` exit=0 |
| 2026-09-28 | **P11 真机验收通过 + 两处排版修复 + 演示状态回滚**：用户跑通完整链路（启动发现 → 弹窗 → 打开模块管理 → 更新 `baby` 1.4.2→**1.4.3**，台账 sha 与演示 zip 一字不差、`hashVerified:true`、`previousVersion:"1.4.2"`、新旧目录并存），确认"除排版没有问题"。排版两处都出在本体那条全局规则上：`8ebf5c1` 补三个漏写 `position` 的类（叠印），`2722d3d` 补三个 div 的 `display:block`（并排）并把列表改成 `flex:0 1 auto`（对话框不再被撑高）；静态不变量测试相应扩成"position 全覆盖 + div 类 display 全覆盖"两条，两次都先 RED 后 GREEN。演示状态已回滚（删 `modules/baby/1.4.3/`、台账回基线、工作区 clean） | `8ebf5c1` + `2722d3d`；231 JS/mjs 语法 ✓；十二套测试 ✓；verify-pack 881/0、skin-imports 37/0、`pnpm build` ✓、`build-release --verify` exit=0（整包 3592 文件 / 112,105,305 字节） |
| 2026-09-28 | **P12 回滚完成（`a091286`，详见§四"P12 记录"）**：新增纯逻辑 `src/core/moduleHealth.js`（结构级四项判据 + 修复计划：能回退就回退、回退目标不健康就重装，**IO 错误不算损坏**）；安装器新增 `verifyInstalled`/`rollback`（坏目录改名 `.corrupt-*` 留证、台账指回上一版、失败即改回并按 `ROLLBACK_FAILED`+residual 上报）与 `NO_ROLLBACK` 码；`registerInstalledModules` 注册前做健康检查，损坏且有健康上一版就自动回退并重注册，无可用上一版只提示重装、启动阶段绝不自动下载；修复结果交给 P11 提示窗（琥珀块，有修复无更新时也弹） | `a091286`；233 JS/mjs 语法 ✓；**十三套**测试 ✓（P12 新增判据四类 + 计划五种 + 安装器八块，全部先 RED）；verify-pack 881/0、skin-imports 37/0、`pnpm build` ✓、`build-release --verify` exit=0 |
| 2026-09-29 | **P13 真机首轮：根因是"两个扩展抢同一个全局名"，自动禁用挪到守卫之前 + 共存做成看得见的状态（`957c96e` + `2bfd65c` + `a6b42e6`，详见§四"P13 记录"）**：现象是"同时启用旧版与 Stars 没有自动禁用、也什么都没弹"。取证分三层排除：①判据——旧版 `extension_十周年UI_enable` 实测是布尔 `true`，与本体装载闸门（`game/index.js:2788` 的真值判断）同形，`957c96e` 顺手把 `=== true` 改成 `Boolean(...)` 但**它不是本次原因**；②代码到没到页面——`fetch(content.js, {cache:"no-store"})` 里有 P13 代码而 `window.decadeUI.legacyMigration` 是 undefined，服务器新、页面旧；③为什么旧——`十周年UI/src/content.js:146` 与本仓库 `:160` 是同一道 `if (window.decadeUI) return;`，两边都往 `window.decadeUI` 挂自己，旧版先加载就把 Stars 整段挡在门外（P11/P12 同样没跑）。修复两步：把 `runLegacyMigration()` 提到守卫之前（抢不到全局也先关旧版并告知）+ 用 `decadeUI.isStars` 区分"谁占的"、前者加一行「这一局界面仍归旧版」；**决定不给 Stars 换全局名**（两套 UI 同时 hook 本体正是要避免的事）。新增**静态顺序不变量测试**三条，反验过：换回顺序或删掉标记，测试立刻红。P13-1 用户报告符合预期（未贴数值） | 196 JS/mjs（src/tests/scripts）语法 ✓；**十四套**测试 ✓；verify-pack 881/17/0、skin-imports 37/0 ✓；`pnpm build` ✓（整包 3595 文件 / 112,112,755 字节 / sha256 `6074b3a87e53…`）；提示窗排版在浏览器里实测（本体 layout.css + 真实模块）：五行各自成行、`position:relative`、无叠印，点「导入旧版设置」后行文案更新且按钮消失；磁盘核验 `image/card-skins/` 仍只有 `.gitkeep`，旧版目录里只有内置五套 ⇒ "没复制"是正确行为 |
| 2026-09-29 | **P14 最终测试工具链完成（任务书§51 + §52，`af8d827` `c8b0c59` `b82b424` `a1483fa`，详见§四"P14 记录"）**：①整包排除从"精确路径 Set"改成 `isPackagedFile()`（精确 + 目录前缀，排除 `tests/` 与 `docs/superpowers/`）—— 新增九份文档后整包 sha 一字未变，当场验证判据生效；②§52 九份模块测试表（`tests/modules/<id>.md`）+ 静态不变量（表按 `moduleManager.list()` 动态要求、六个模块动词一行不许省、填了结果必须有证据、门控型四项显式写"不适用 + 原因"）；③§51 五类总账矩阵 33 行，两条反假绿规则（真机项不许写「已做」、自动化项不许写「已验」）+ 一条"总账不许漏账"（§八 每个小节都要被引用）；④**盘点矩阵全部「已做」条目**，抓出两处假账：错误码 `HASH_MISMATCH` 是我编的（真实 `SHA_MISMATCH`）、"排除模式不装载 UI 插件"长期挂「已做」而无任何用例 —— 把闸门挪成纯模块 `src/core/uiMode.js`（语义零变更）并补 12 条断言 | 199 JS/mjs 语法 ✓；**十六套**测试 ✓（新增 `p14-module-tables`、`p14-ui-mode`）；verify-pack 881/17/0、skin-imports 37/0 ✓；`pnpm build` ✓（整包 3596 文件 / 112,113,361 字节 / sha256 `14f63107a68b…`，+1 文件即 `uiMode.js`）；四条反验各自红过：删表→红缺表、结果写 `OK`→红取值非法、去掉 §八 引用→红漏账、谓词改恒真→红模式误判 |
| 2026-09-29 | **批 1 真机（样式六套 / 卡面 / P13-3）通过，并查出 P7 遗留的能力声明漂移（`4c57f54`，详见§四"P14 记录"）**：探针 `hasCapability("border-style")` 在 yjcm 下 false、online 的两个能力全 false —— 不是判据写错：`migrate-style-packs.mjs:131` 把四个样式的 capabilities 一律硬编码成两套，清单是发布契约，`build-release` 原样写进 `module-index.json`，**已发布索引一直在谎报能力**。修：脚本按样式取声明 + 两份清单补回 + 新增 `tests/p14-capability-drift.test.mjs` 盯"代码声明 = 磁盘清单 = 索引"（重建前它正红在索引那条）。影响面如实记：`src/` 无人消费该 API，功能未坏，属"API 说谎"级。重启后三条探针全部符合判据 | 17 套测试 ✓（新增 `p14-capability-drift`）；verify-pack 881/17/0、skin-imports 37/0 ✓；`pnpm build` ✓（整包 3596 文件 / 112,113,381 字节 / sha256 `89295d862570…`）；`verify:release` exit=0 ✓；批1 结果已回填九份表与矩阵（视觉目测一项仍留待办） |

## 四、进行中（当前任务指针）

**当前任务：P9 构建系统模块化 —— 代码完成，待游戏内实测**（`dea6561` 索引相对地址解析 + `d5b8baf` `scripts/build-release.mjs`，详见§四"P9 记录"）。上一阶段 P8 两刀已完成：第一刀 Feature API + `kill-effect` 门控（`b4d8db5`/`8f89e43`/`16c398d` + 修复 `48a82bc`/`d31ab7e`），第二刀 `card-skin` 拆包（`28e1092`/`0e890c7` + §57 兼容修复 `64719f3`）。
下一阶段：**P10 GitHub Release（任务书§47）**——发布结构 Core / Official Style Packs / Feature Packs / Full Package / module-index.json 与"下载链接必须可被客户端解析"。本轮产物已能直接作为上传物；建 Release、传资产、推 tag 由用户执行，我这侧只负责索引与解析正确。
上一阶段 **P6 模块管理界面 —— ✅ 已验收通过（2026-09-27 用户游戏内实测：窗口可开、布局正常、"已独立安装 6"读取正确）**。P5（任务书§42 + §17/§18/§19/§11/§24/§20）已完成：`6c76534` + `f4a69ac` + `df2afea` + `29a69e3` + P6 实测暴露的 fs 锚点修复 `40149bf`；**P5/P6/P8 的 Android/SAF 真机实测并入§八收尾清单，不阻塞推进**。

### P14 记录（最终测试工具链，任务书§51 + §52，`af8d827` `c8b0c59` `b82b424` `a1483fa`）

| 项 | 内容 |
|---|---|
| 范围（用户批准 2026-09-29） | 只做§51/§52 的**工具链**：整包排除改目录前缀、每模块一份测试表、五类总账矩阵、盘点既有「已做」并补真缺的用例。测试本身由用户分三批在游戏内跑（见§六 item 12）。P14 的完成标准按用户决定＝**工具链完成即算阶段完成**，真机项作为待执行清单交付 |
| 整包排除判据 | `scripts/build-release.mjs` 的 `isPackagedFile(rel)`：精确路径（`README.md` / `docs/PROGRESS.md` / `docs/modularization-audit.md`）+ 目录前缀（`docs/superpowers/`、`tests/`）。原来只有精确路径 Set，新增任何内部文档都会照样打进 112MB 整包、改一个字 churn 一次 sha。**实测**：加完九份文档整包 sha 仍是 `5f301cff5f63…` 未变 |
| §52 九份测试表 | `tests/modules/`：core、decade、mobile、yjcm、online、baby、codename、card-skin（拆包型 Feature）、kill-effect（门控型 Feature）。表头固定五列（项目/判据/层级/结果/证据）；已验过的直接回填证据与日期，没验的标 `待验` —— **不允许空白冒充通过** |
| 表结构静态不变量 | `tests/p14-module-tables.test.mjs`：①表按 `moduleManager.list()` 动态要求（加模块就催表）；②§51「模块」六个动词一行不许省，不适用也要显式写行并给原因（`kill-effect` 是 `pack:false`，安装/卸载/更新/回退本就没有链路，省掉行等于掩盖判据）；③填了结果必须有证据；④`core` 表必须含整包 / module-index / 回退 / 旧版四条判据 |
| §51 五类矩阵 | `tests/modules/P14-matrix.md` 33 行（安装 8 / 模块 9 / 样式 6 / 平台 4 / 游戏模式 5）。一行一条用例，标 `覆盖方式 / 归属 / 状态`。**两条反假绿**：真机项不许写 `已做`（只有用户跑过才写 `已验`）、自动化项不许写 `已验` —— 两种「完成」不许互相冒充。**一条防漏账**：§八 每个小节（通用/P6/P8/P9/P11/P12/P13）都必须被矩阵引用。§八 原表一行没删，矩阵只做总账、不重复抄 procedure |
| 盘点结果（这一步真正的产出） | 逐条把矩阵里 `已做` 对回源码与用例，抓出两处假账：①错误码 `HASH_MISMATCH` 根本不存在（真实是 `SHA_MISMATCH`，见 `packageInstaller` / `downloader`）；②「排除模式不装载 UI 插件」长期挂 `已做` 却**没有任何用例** —— 判断内联在 `content.js:loadUIPlugins()`，而 content.js 一 import 就拉起 DOM/本体依赖链，Node 侧够不着，于是「测不了」被默认成了「已做」。其余 `已做` 都有断言行号支撑（首次安装 p5-installer:520/541/635、重复安装 :676、下载失败 :569/922、校验失败 :556/949、`localVersions` 三种临时前缀过滤 p12-repair:300-309） |
| 补的那条 | 新增纯模块 `src/core/uiMode.js`（`UI_PLUGIN_EXCLUDED_MODES` + `shouldLoadUIPlugins(mode)`），`content.js` 改用同一函数，测试盯住「不许再留第二份内联名单」。**语义零变更**：名单内不装载；取不到模式时保持装载 —— 漏判等于整个 UI 消失，比误判更糟 |
| 反验（四条都红过） | 删 `tests/modules/yjcm.md` → 红「缺表」；结果列写 `OK` → 红「取值非法」；去掉某行的「§八」引用 → 红「漏账」；把 `shouldLoadUIPlugins` 改成恒真 → 红「chess 模式不该装载」 |
| 批 1 真机结果（2026-09-29） | **通过**：六套样式路由与能力查询三值一致（`["decade",false,false,false]` / `["yjcm",true,false,false]` / `["online",false,true,true]`）、卡面五套可用且根指向 `modules/card-skin/1.4.2/`、玩家自建套"丢进去就能用"、P13-3 旧版卡面自动复制。**这一批查出一个 P7 遗留缺陷**（见下一行）。**仍待办**：六套切换的视觉目测（玩家框/边框档位/聊天赠礼位置）、批 2 模块生命周期与 P12 四条、批 3 游戏模式与联网 |
| P7 能力漂移（批1 查出，`4c57f54` 修） | `scripts/migrate-style-packs.mjs:131` 把四个样式的 `capabilities` 一律硬编码成 `["player-frame","lbtn"]` ⇒ yjcm 丢 `border-style`、online 丢 `online-chat`/`online-gift`；清单是发布契约，`build-release.mjs` 原样写进 `module-index.json`，所以**已发布索引一直在对客户端谎报能力**。修复：脚本按样式取声明 + 两份已提交清单补回 + 新增 `tests/p14-capability-drift.test.mjs` 盯「代码声明 = 磁盘清单 = 索引」三处一致（重建前它正是红在索引那条）。**影响面**：`src/` 内无人消费 `hasCapability/getCapability`，故实际功能未坏，属"API 说谎"级 |
| 未做 / 待真机 | 真机批 2、批 3 未跑（批1 已过并回填）；`本机不可验` 三条（Android/SAF 降级、无原子 rename 平台、从未装过旧版的环境）留在§八，不阻塞阶段；§51「中途失败」目前只有 Node 级取消断言，真机取消链路属批 2 |


### P13 记录（旧版本迁移，任务书§50 + §21，`3ca76a3`）

| 项 | 内容 |
|---|---|
| 范围（用户批准 2026-09-28，四条批量决定转录可查） | ①旧单体 UI（十周年UI）仍启用 ⇒ **启动就自动禁用**（两套 UI 同时 hook 同一批函数会界面错乱）；②配置**全量复制**但**只补玩家没动过的键**，且**由提示窗的「导入旧版设置」按钮触发**（零点击不写玩家配置）；③旧目录里的**玩家自建卡面自动复制**进我们自己的 `image/card-skins/`；④结果走 P11/P12 那个提示窗告知。**旧样式包/源码不复用**（Stars 整包自带 `modules/` 全量） |
| 纯逻辑 `src/core/legacyDetector.js` | `collectLegacyConfig`（按 `extension_十周年UI_` 前缀扫 `lib.config`，排除 `enable`/`*_enable` 等本体自管开关与空值；新旧前缀不会互相命中，因为新版中间多了 `-Stars`）；`planMigration`（四类跳过：Stars 没有这项 / 旧值等于默认值 / Stars 侧已设置 / 与现值相同）；`planSkins`（排除内置套与同名已存在的，路径不安全名一律丢）；`detectLegacy` 输出 `absent`/`active`/`idle`/`residual` 四态 + `conflict` + `alreadyMigrated` + `migration`。**不碰 IO、不写配置、不出文案**（文案在提示窗里） |
| 接线 `src/features/legacyMigration.js` | 同步部分：`conflict` 就写一次 `extension_十周年UI_enable=false`，并把可迁配置打包成 `importable` 条目（带 `apply`）交给提示窗——**启动阶段一个配置键都不写**。异步部分：`createSkinIo()` 用裸 `lib.node.fs` + `window.__dirname` 列旧/新卡面目录、把玩家自建文件夹逐个复制进来（**只读旧目录、只写我们自己的目录、不删任何东西**），拿到 Node fs 之前（Android/SAF）或读盘抛错都整段静默跳过。依赖在 `try` 内解出（默认参数在函数体外求值，抛错会卡住启动）；`collectDefaults()` 从 `config.js` 抽默认值（口径同 content 播种：有 `init` 且无 `clear`） |
| **关键判据（最易被后人改坏）** | ①「玩家没动过」＝「当前值 === `init` 默认值，或尚未播种」，**不是**「键是否存在」——本体 `loadExtension` 与 content 阶段都会把 `init` 播种进 `lib.config`，照后者判会得到**零迁移**（功能等于没做）。②启动**只关旧版**，配置写入必须等按钮。两条都做了反验：把判据改成 `cur === undefined` → 测试红；在接线里补一句 `for (item of items) save(...)` → 「启动只能写旧版的 enable=false」那条立刻红 |
| 强制关闭的生效时机 | 本次启动里旧版代码**已经被加载过了**，写 `enable=false` 只对下次生效。UI 必须如实写"重载游戏后生效（这一局里旧版还在跑）"，不许让玩家以为已经切干净。**绝不调 `game.removeExtension()`**——它会连删玩家的 `extension_<名>*` 配置、localStorage 与导入的武将图，那是卸载不是禁用 |
| UI | `createUpdateNotice(data, repairs, legacy)` 第三参缺省即行为逐字不变（同 P6 `featureStates` 的做法）；legacy 行复用 `decade-update-repair` 的样式，**没有新增 CSS 类**（避开 P11 那条"每个 div 类必须有 position/display"的静态不变量）；有 legacy 记录时即使关掉"启动检查更新"也要弹。**「导入旧版设置」按钮挂在底部常驻按钮区而不是行内**——列表超过 46vh 自己滚，按钮滚进折叠区就等于没有（P11 真机报过一次"没看到忽略此版本按钮"）；点完把该行 `scrollIntoView` 回来，按钮消失、行文案改为"已导入 N 项" |
| 测试 | `tests/p13-legacy-detector.test.mjs` 39 块：枚举（前缀隔离、排除开关与空值、排序）、`planMigration` 四类跳过 + 对象值按内容比较、`planSkins`（内置套排除、同名不覆盖、不安全名丢弃、空输入）、环境四态 + `alreadyMigrated`、冲突判据真值/假值两组、缺参数降级；接线层用注入的 `save`/`skinIo` 录调用序列——启动只写 `enable=false`、点「导入」才逐项写 + 打标记、卡面只复制该复制的、非桌面端口为 null 时整段跳过、复制抛错不拖垮配置导入、写入抛错静默；**外加一条静态顺序不变量**（`runLegacyMigration()` 必须早于 `window.decadeUI` 守卫，守卫内提前退出也要弹告知窗） |
| 未做（如实记） | 旧样式包/源码复用（用户决定不做）；卸载旧扩展（只关开关、**不删玩家的 113MB 文件**，去留由玩家决定）；旧配置迁完后不清理（留着是回退依据，Stars 也不读它们）；卡面复制**只在桌面端**（Android/SAF 拿不到 `lib.node.fs` + `window.__dirname` 就整段静默跳过，与 P5/P6 同口径）；提示窗的 DOM 呈现没有 Node 测试（用 `tmp/notice-preview.html` 静态复现量几何，真机仍待验） |
| 真机首轮暴露的根因（比 P13 本身更重要） | **`window.decadeUI` 是两个扩展共用的全局名**，且两边都有 `if (window.decadeUI) return;`：旧版先 `content()` 就占住全局，Stars 的 `content()` 直接 return ⇒ P13/P11/P12 整段不执行。表现为"同时启用没有任何反应"。第一步修复是把自动禁用挪到守卫之前（`2bfd65c`）；第二步（`a6b42e6`）**决定不给 Stars 换全局名**——两个扩展都会 hook 同一批本体函数，改名等于让它们同时运行，正是 P13 要避免的界面错乱；改为把互斥做成看得见的状态：`content()` 先取全局再跑迁移，占不到全局时靠 `decadeUI.isStars` 区分"旧版占着"与"本扩展热重载"，前者在提示窗加一行「这一局界面仍归旧版」并说明重载后由 Stars 接管 |
| 标记版本号（已修 `d6406d0`） | 原来标记取自 `lib.extensionPack[旧版].version`，而**在"旧版已停用、本局没装载它"的那一局里点导入**时它是空的 ⇒ 标记写成 `"unknown"`（真机实测到的就是这个）。现在 `applyLegacyImport` 在 `from` 缺失时读一次 `extension/十周年UI/info.json`（地址口径与 `extension.js` 自己读 info.json 一致：`lib.assetURL` 在本构建里是空串，按文档基址解析）。三条边界：有版本号就不再多读一次盘；读盘失败只让标记退回 `unknown`、导入照常完成；`apply` 变异步后按钮期间 `disabled` 防连点，失败时恢复可点并如实说"可能已写入部分项"。**注意**：已经写成 `unknown` 的标记不会被回填，也不该去手删——它的职责只是"导入过就不再提"的闸门，版本号只是说明文字 |
| 真机结论（2026-09-29） | P13-1 ✅（`enable` 写入并跨重启留住、Stars 接管）；P13-2 ✅ 写入路径（`[false,true,undefined]` → `[false,false,'unknown']`，且次局不再提），界面内反馈（行文案变化 + 按钮消失）只在 `tmp/notice-preview.html` 浏览器实测过；**P13-3 卡面复制正面一支待验**（旧版目录里只有内置五套，需手工放一个非内置文件夹）；P13-4 本机验不了（旧版就装在同级目录），留到 P14/换环境。另记一条 UX 事实：底部按钮区最左是青色的「导入旧版设置」、最右才是「知道了」，用户第一次就是这样误点的 —— 好在动作只补"没动过的键"、且当场有文字回执 |

### P12 记录（回滚，任务书§49，`a091286`）

| 项 | 内容 |
|---|---|
| 用户决定（2026-09-28 批问） | ①损坏判据＝**结构级四项**（包目录缺失 / manifest 缺失或解析失败 / id、version 与台账不符 / 清单声明的 entry 文件不存在），不读全量文件不存快照；②**启动自动回退**（不是只提示）；③坏目录**改名 `.corrupt-<版本>-<随机>` 留证**；④无可用上一版时**标不可用 + 提示重装**，不自动下载 |
| 判据（`src/core/moduleHealth.js`，纯逻辑全测） | `assessModule` 判四项；`planRepair` 决定怎么修：当前坏 + 上一版健康 ⇒ `restore`；上一版也坏或没记 ⇒ `reinstall`（**绝不把坏的换上来**）。两条硬边界：**IO 错误不算损坏**（判据只吃探测结果，调用方负责把"读盘失败"与"文件不存在"分开——沿用 P5 的"IO 异常 ≠ 不存在"）；回退目标自己也要过同一套判据 |
| 安装器 | 新增 `probeModuleVersion`（IO 错误抛出、转 IO_FAILED）、`verifyInstalled(id)`（只探测、不写状态）、`rollback(id)`（验上一版健康 → 坏目录改名 `.corrupt-*` → 台账 `version` 指向上一版并清 `previousVersion`；台账写失败 ⇒ 把坏目录改回原位 + `ROLLBACK_FAILED` + residual）。`localVersions` 排除 `.corrupt-*`；`INSTALL_CODES` 新增 `NO_ROLLBACK`（只增不改） |
| 接线 | `registerInstalledModules()` 注册前先健康检查：损坏且有健康上一版 ⇒ 自动回退 + 用回退后的版本**重注册一次**；无可用上一版 ⇒ 只警告（需要重装），**启动阶段绝不自动下载**。结果经 `takeRepairNotes()` 交给 P11 提示窗（琥珀块显示"已自动修复 X：1.4.3 → 1.4.2"或"需要重装"），**有修复但无更新时也弹**，且关掉"启动检查更新"也弹——回退已经发生，玩家有权知道 |
| 测试 | `tests/p12-repair.test.mjs`：判据四类逐个 + 修复计划五种组合 + 安装器八块（健康不动文件、损坏给出计划、回退成功验目录与台账、目标不健康拒回退且零移动、无上一版/未安装各自的码、台账写失败 ⇒ `ROLLBACK_FAILED` 且坏目录改回、`localVersions` 排除 `.corrupt-*` 与 `.removing-*`）。全部先 RED 后 GREEN |
| 写测试时踩到的坑 | "注入写台账失败"一开始打不中：原子写台账是 temp → rename，只在 `writeText` 上注入不会命中 ⇒ 改成注入"改名失败"（假 io 加 `failMoves`）。这类"注入点打偏"会让测试假绿，值得记 |
| 未验（如实记） | 接线层（fetch + DOM）没有 Node 测试，只有纯逻辑与静态不变量覆盖；`registerInstalledModules` 现在每个模块启动都做一次健康探测（桌面 7 个包约 40 次小 IO，Android/SAF 走 game.* 回调），开销与"误判导致误回退"的风险留待真机观察。探针见§八"P12 部分" |
| 门禁 | 233 JS/mjs 语法 ✓；**十三套**测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0（整包 3593 文件 / 112,107,882 字节 / `5da231bff04d…`） |

### P11 记录（自动更新，任务书§48，`3af2cd3`）

| 项 | 内容 |
|---|---|
| 用户决定（2026-09-28 批问） | ①**Core 只提示不自动替换**：本体就是正在运行的扩展目录，自我覆盖风险高（文件被占用、中途失败变砖），提示里给发布页链接让玩家自己整包替换；②**提示形式＝可关闭的小窗**；③**时机＝启动后异步查一次**；④**频率＝每版一次、可忽略**（忽略记的是那个 `latest` 版本号，版本一变还会再提） |
| 纯逻辑 | 新增 `src/core/updateChecker.js`：`checkUpdates({installed, index, coreVersion, ignored})` → `{updates, ignoredUpdates, core:{behind,current,latest}}`；版本比较复用 `manifest.compareVersions`（与安装器§18 同口径）。判断原则是**读不出来就沉默**：本地版本未知（null/空/非版本号）、`latest` 非法、索引比本机旧 ⇒ 一律不提示——宁可漏一次，也不要把垃圾数据变成一次白下载。另有忽略清单的读写纯函数（`normalizeIgnored`/`ignoreVersion`/`ignoreAll`，坏 JSON 当空处理） |
| 界面 | 新增 `src/features/updateNoticeWindow.js` + `updateNotice.css`：标题「发现可更新的模块」，逐条列 `名字 + 1.4.2 → 1.4.3`；Core 落后单独一块并给"打开发布页"链接（只提示）；按钮＝**打开模块管理**（复用现成的逐项更新/进度/取消）、**忽略此版本**、**稍后**。列表自带滚动上限（避开 P6 提示条"撑破对话框被剪掉"那个坑），DOM 逐类声明 `position`（本体 `div{position:absolute}` 不侵扰） |
| 接线 | `src/content.js` 末尾 `setupUpdateNotice()`：延迟 1.5 秒后异步查一次；`fetchIndex` 走安装器现成的重试/超时（5 秒）。**未配置模块源 / 离线 / 索引坏 / 超时 / 抛错 一律静默返回 null**——不弹空窗、不写状态、不阻塞进游戏。配置新增可见键 `autoCheckUpdate`（`init:true`，关掉则不查）；"已忽略的版本"存 `extension_<扩展名>_ignoredUpdates`（跟随既有键前缀约定，不新增存储层） |
| 测试 | 新增 `tests/p11-update-check.test.mjs`：13 组纯逻辑（更新/不降级/同版本/未安装不算更新/本地版本未知/null 边界/Core 落后与无 core/忽略只对同一版本生效/排序/空输入不抛/忽略读写/批量忽略）+ 6 组接线（默认查与明确关掉、未配置不发请求、离线与抛错都吞、有更新返回可展示数据、全被忽略则不弹、无更新不弹空窗）。Core 忽略与批量忽略两块先 RED 后 GREEN |
| 真机演示源 | 现有产物索引里都是 1.4.2 ⇒ "发现更新"这条测不出来，故加 `tmp/make-update-demo.mjs`（不入库）：把 `baby` 复制成 **1.4.3**、索引里 baby 与 core 都标 1.4.3、其余保持 1.4.2，产出 `tmp/update-demo/release/`，用 `node tmp/dev-release-server.mjs 8100 --root tmp/update-demo/release` 服务（8099 仍是正式产物）。它只动 `tmp/`，不碰 `dist/release` 与 `modules/` 里的正式产物 |
| 真机修复（`483095f` + `8ebf5c1`） | 真机首轮反馈"看到那条更新、但似乎没看到忽略按钮"，靠他截图定位到两件事：①**列表行叠印**——我只给一部分类写了 `position`，漏掉 `decade-update-row-name`/`row-version`/`core-note`，它们被本体 `div{position:absolute}` 带走、全堆在对话框左上角（截图里"扩展本体…"与"欢乐三国杀样式…"叠在一起）⇒ 补齐那三个类，并新增**静态不变量测试**：扫 JS 里 `el("…")` 用到的每个 `decade-update-*` 类，要求 CSS 至少有一处选择器命中且声明了 `position`（先 RED 命中这三个，补完转 GREEN）；②**与欢迎窗抢窗**——欢迎窗层级更高（99999 vs 99998），同时弹会把更新提示整个压住 ⇒ 新增 `waitForWelcome`：等欢迎窗关掉再弹，一直不关就这次不弹（下次启动还会查）；③标题行/按钮行加 `flex: 0 0 auto`，长列表不许把它们挤扁。静态复现复核（`tmp/notice-preview.html`：真实模块 + 本体 layout.css + importmap 替身）core 块与模块行不再重叠、四个按钮位置正常。④**第二处排版（`2722d3d`）**：Core 块与模块行**并排**、对话框底部留空——本体那条全局规则同时管两件事（`div { display:inline-block; position:absolute }`），上一轮只盯 position 没管 display，两个块被设成 inline-block 并排；列表又用 `flex:1 1 auto` 抢空间把对话框撑高 ⇒ 三个类补 `display:block`、列表改 `flex:0 1 auto` + `max-height:46vh`（不抢空间、项多自己滚）；静态不变量测试相应扩成两条（每个类要有 position，**挂在 div 上的还要有 display**，靠解析 `el()` 第三个参数区分），同样先 RED 后 GREEN |
| 真机验收（2026-09-28） | ✅ **用户跑通**：启动弹出「发现可更新的模块」→ 点「打开模块管理」→ 对 `baby` 更新 → 台账 `baby` 变 **1.4.3**、`sha256:8929db8cb228…` 与演示 zip **一字不差**、`hashVerified:true`、`previousVersion:"1.4.2"`、`modules/baby/1.4.2/`（27 文件）与 `modules/baby/1.4.3/`（27 文件）**并存**、无事务残留 ⇒ 任务书§48 的"只更新该模块而不是下完整 UI"在真机成立，P12 要的"旧版本目录保留"也一并验到。他确认"除排版外没有问题"；演示状态已按他要求回滚（删 `modules/baby/1.4.3/`、`git checkout modules/installed.json`）。**未验**：忽略/关开关/坏地址三条探针（§八 P11-2/4/5）他没跑，属可选 |
| 门禁（含排版修复） | 231 JS/mjs 语法 ✓；**十二套**测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓（整包回到 3592 文件 / 112,105,305 字节 / `5df3e4fa2ca9…`——回滚 1.4.3 目录后与源码口径一致） |
| 门禁 | 231 JS/mjs 语法 ✓；**十二套**测试 ✓；verify-pack 881/0、skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓（整包随源码增至 3592 → 3619 文件 / 112,223,548 字节 / `88e28910f74e…`） |
| 未做 | CI 自动发布（§五 5 未迁 .github）；自动下载更新（用户决定只提示）；Core 自动替换（同前）；P12 回滚（地基已在：`update()` 保留旧版本目录 + 台账记 `previousVersion`） |

### P10 记录（GitHub Release，任务书§47，`c91a9f8`）

| 项 | 内容 |
|---|---|
| 用户决定（2026-09-28 批问） | ①**Core 不进 Release**：本仓库源码即本体，玩家装扩展即得 Core，界面上 core 行仍显示"核心组件（随扩展发布）"；②**要 Full Package**：一个整包 zip 供"不想逐个装包"的玩家；③**tag 用 `v1.4.2-stars`**（内容与上游同版本发布不同，模块化改造所致）；④**由用户在 GitHub 网页建 Release 并传资产**（gh CLI 未登录，且发布动作一贯归用户） |
| 产出（9 项上传物） | `十周年UI-Stars-1.4.2-full.zip`（整包 3589 文件 / 112,100,082 字节 / sha256 `4f7940c51b31…`）+ `module-index.json`（2452 字节 / `a41a026eefe9…`）+ 7 个分包（baby 112079 `b3e38d5f…`、card-skin 21627755 `54560999…`、codename 961947 `be5e8af3…`、decade 535358 `2493ea8c…`、mobile 1491339 `1fc3d006…`、online 587147 `47bd1446…`、yjcm 880436 `9ee4fba3…`）。分包与索引的摘要与 P9 完全一致（未受影响） |
| 整包形态 | 包内根目录唯一 `十周年UI-Stars/`，解压到 `resources/app/extension/` 即用（目录名可改，`info.json` 在里面就行）。**源就是 `dist/`**（vite 已按部署形态备好 info.json/extension.js/ui/image/audio/assets/modules），不另立第二份排除表——两份清单迟早漂移。`release/` 不进整包（那是分包产物） |
| 整包排除内部三件 | `README.md`（总任务书）、`docs/PROGRESS.md`（本台账）、`docs/modularization-audit.md`（P0 审计）不进整包；原版对外文档（`extension-readme`、`card-skin-api`、`dynamic-skin-api`、`update` 等）照旧随包。**为什么必须排**：台账每次会话都在改，打进去会让 112MB 资产的摘要随文档变动，Release 上记录的 sha 与后续重建就对不上号。实测排除后 `pnpm build` 重跑整包摘要不变 |
| `RELEASE-NOTES.md` | 由构建生成（`dist/release/`，不入库）：Release 说明草稿 + 上传清单（9 项资产的字节数与 sha256）、安装两步、模块源地址（`https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2-stars/module-index.json`）、校验命令。资产顺序＝整包 → 索引 → 各分包 |
| 校验（`--verify` 同规则） | 四段：分包（原有全套）→ 索引（与盘上重算逐字节一致）→ **整包**（根位 `info.json`/`extension.js` 在、每个分包的 `manifest.json` 在、不得含 `release/`、条目数与 dist 除 `release/`+内部件后一致）→ **说明文件**（按盘上产物重算文本逐字节比对，手改会被抓住）。`--list` 也列整包一行；日志前缀统一 `[P10产物]` |
| 相对地址 | 索引 url 仍是裸文件名，客户端用索引地址解析成同 Release 下的资产地址（`resolveModuleUrl` 单点）。GitHub Release 形状已进测试：`…/releases/download/v1.4.2-stars/module-index.json` + `baby-1.4.2.zip` → 同目录绝对地址；非 ASCII 名称（整包文件名）解析出来是**百分号编码**，属 URL 规范的正确行为。所以索引与全部 zip **必须挂在同一个 tag 下** |
| 测试 | 新增 `tests/p10-release.test.mjs`（临时沙盒，不碰仓库产物）：打包前缀/排除项（含内部三件与对外文档的对照）/无目录条目/两次打包同摘要、四类整包篡改必须失败（缺根位文件、缺分包清单、混入 `release/`、多余条目）、说明清单含全部资产的字节数与 sha256 且表格列数完整、GitHub Release 形状的裸文件名解析。负例走脚本的 `die()`，测试里断言后复位 `process.exitCode` |
| 门禁 | 228 JS/mjs `node --check` ✓；**十一套**测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓；整包两次构建摘要一致 ✓；排除内部件后改台账不影响整包摘要 ✓ |
| 未做 | 建 Release、传资产、推 tag（用户侧动作）；CI 自动发布（§五 5 未迁 .github）；P11 自动更新与 P12 回滚 |

### P9 记录（构建系统模块化，任务书§46）

| 项 | 内容 |
|---|---|
| 产物 | `pnpm build` = `vite build` → `build-decade-pack.mjs dist`（样式包部署）→ `scripts/build-release.mjs`。后者产出 `dist/release/`：`baby/card-skin/codename/decade/mobile/online/yjcm` 七个 `-1.4.2.zip` + `module-index.json`。`dist/` 与 `*.zip` 均已在 `.gitignore` 内，**产物不入库** |
| 数据源唯一 | 只认盘上 `modules/<id>/<version>/manifest.json`；同一 id 取最新语义化版本（用 `manifest.compareVersions`，与安装器§18 更新判定同口径）；`.replacing-*`/`.removing-*` 事务目录因不匹配 `^\d+\.\d+\.\d+` 自然被排除。脚本里**不另存一份包清单** |
| zip 结构 | `manifest.json` 必须直接在根（安装器 `verifyPackageDir` §24 就按根位认包，套一层 `<version>/` 会被 STRUCTURE_INVALID 拒收）；条目名一律 POSIX 相对路径；输出文件若写在源目录内会被排除（不自我包含） |
| 确定性 | 条目时间戳固定 `1980-01-01` + `createFolders: false`。后者是实测出来的坑：JSZip 默认为父目录自动补目录条目，而那些条目的时间是**当前时间**（DOS 时间 2 秒粒度），留着它，同样内容的两次构建就会算出不同 sha256，索引每次都在无意义地变。解压侧 `moduleIo.extract` 本来就按路径自建目录，不需要目录条目 |
| 索引形态 | `{ schema:1, core:{version,latest}, modules:{ <id>: {name,type,latest,url,sha256,size,dependencies,core,capabilities} } }`。字段名沿用§10 与 `packageInstaller.specFromIndex`/`moduleAdmin.specFromEntry` 已经在读的名字，不改契约。`url` 写**裸文件名**；`sha256`/`size` 取 **zip 文件自身**（安装器校验的是下载落盘那段字节，不是包内文件之和）；**core 不列为可安装包**（本轮范围决定：Core 无包形态，混进去界面会出现装不上的 Core） |
| 相对地址解析 | `packageInstaller` 新增导出 `resolveModuleUrl(url, indexUrl)`，且**唯一调用点在 `installInner` 的 `checkSpec` 之前**（那里只收 `http(s)` 绝对地址，相对条目本来会被当 INVALID_SPEC）。对绝对地址幂等 ⇒ 直接规格、索引里的依赖条目、依赖递归再进来都安全。`fetchIndex` 成功结果回带 `indexUrl`；窗口把 `indexUrl` + `index` 交给 `install/update` |
| 顺带接通 | 窗口此前从不把 `index` 传给安装器 ⇒ P5 的§11「缺依赖先按索引装依赖」在界面上其实一直走不到，只有 Node 测试跑得通。本轮把 `index` 一并传入，该分支首次可达（也由此进入 P6 窗口的实测面） |
| 校验（`--verify` 同规则，任一不符即非零退出） | ①zip 回读：根位 manifest 存在、`validateManifest` 复用通过、`manifest.id/version` 与目标一致、`manifest.entry.js/css` 逐个必须在包里、条目数 == 源目录文件数且逐个存在；②索引：每包有条目、`latest/url` 与盘上一致、`sha256`/`size` 与 zip 重算一致、相对 url 必须能解析成以该文件名结尾的绝对地址、`checkCoreRequirement(entry.core, coreVersion)` 通过、索引里不得出现 core、不得有盘上不存在的多余条目；③`card-skin` 按 `manifest.cardSkins` **逐套**核对文件数；④`--verify` 还要求 `module-index.json` 等于"由盘上产物重算的索引"（改了包忘了重生成索引会被抓住） |
| 依赖 | 新增 devDependency `jszip@3.10.2`（**仅构建期**使用；运行时解压仍走本体 JSZip 2.7，未改 `moduleIo`）。写侧与读侧跨版本，故校验方式是"生成后自己回读 + 结构不变量断言"，而不是假设两版本字节级互通；真机能否被本体 2.7 解开属§八收尾项 |
| 测试 | `tests/p9-release-index.test.mjs`：`resolveModuleUrl` 九类语义（裸名/子路径/绝对/协议相对/索引带查询串/无基准/空 url/索引地址非法/幂等）；install 传与不传 `indexUrl` 的对照（不传时仍按既有契约 INVALID_SPEC 且零下载）；依赖递归（依赖装失败不继续下主包、依赖已在注册表时只下主包）；`fetchIndex` 回带 `indexUrl`；`buildIndex` 形状；`zipDir` 结构（根位 manifest、**无目录条目**、不自我包含、两次调用摘要一致） |
| 门禁 | 186 个 JS/mjs `node --check` ✓；九套测试 ✓；`pnpm build` ✓（含 release，实测 7.7s）；跨 3 秒两次构建 7 个 zip + index 逐字节一致 ✓；`--verify` 通过（card-skin 1017 文件 / 21,627,755 字节，卡面 5 套逐套核对）；verify-pack 881/0、check-skin-imports 37/0、card-skin `--verify` 1016/20.5MB ✓ |
| 实测出的自身缺陷（已修） | `--verify` 的重算行把 `.digest("hex")` 挂在了文件 buffer 上（`TypeError: fs.readFileSync(...).digest is not a function`）——`--verify` 前半段过了、末尾才炸，说明"跑一遍"和"跑遍所有分支"不是一回事；完成日志用 `notes.length` 把 7 个包写成 8 个包（card-skin 多一条逐套核对）。两处都由实跑暴露 |
| 未做 | GitHub Release 与上传（P10/§47，发布动作在用户侧）、`core.zip`、Full Package 整包、自动更新与回滚（P11/P12）、CI 里的产物校验（本仓库未迁 .github，见§五 5） |

### P9 收尾记录（能力语义统一 + 台账基线，任务书§四～§十四，`cc6ee72` + `3d316d2`）

| 项 | 内容 |
|---|---|
| 能力真值单点 | `createPackageInstaller` 内新增 readiness 缓存（`extractorReadiness` / `extractorProbe`）：probe 成功失败**都缓存**、并发复用同一次探测、重载游戏重建实例即自然清空、**不提供 reset**。`ready()` 改为只读这份缓存；界面与安装路径共用同一次探测，不另造第三套检测 |
| `isAvailable()` 新语义 | 同步能力快照 = "当前**已知**的可执行安装能力"，不再是"端口对象挂没挂"：端口缺失 → `available:false` + 对应 `missing*`；端口在但未探测 → `ready:false` 且 `available:false`（**未知 ≠ 可用**）；探测过 → `available` 即 probe 结论，失败时多带一个 `reason`。字段只**新增** `ready`，其余不变 |
| 安装前早拒 | `installInner` 在端口检查之后、解析规格之前插能力门：探不过即 `NO_EXTRACTOR @ stage="resolving"`，**零下载 / 零落盘 / 台账不写**（不再"下完 20MB 才发现没 JSZip"）；尚未探测的会先探一次再继续。`update` 走同一道门。SHA 判据、临时目录、发布与回滚、台账事务、依赖解析**一字未改** |
| 窗口兼容（必须记） | `moduleManagerWindow` 的 `installBlocker` 改按**端口是否缺失**判定。坑在于：新语义下 `available.available` 在未探测时也是 `false`，若沿用旧写法 `available.available ? null : …`，窗口**首次打开就误报"本平台不支持"并因 `if (!installBlocker)` 永不触发 `ready()`**。改后：端口缺失才报"本平台不支持安装/卸载（缺少：…）"，能力问题由 `ready()` 失败时以"本机取不到解压能力（ZIP）：原因"给出。整窗浏览、Feature 启停、模块源读取均未受影响 |
| JSZip 接线未动 | `moduleIo.js` 本轮**零改动**：三级获取（`window.JSZip` → `get.zip` → `lib.init.js`）、**按实例交付**（绝不回到 `instance.constructor`）、每次解压现取实例、失败缓存、3.x 被拒——保持 `d296f9e` 的形状 |
| 台账基线 | `3d316d2` 把 `modules/installed.json` 逐字恢复为 `1322767` 的版本（schema 1 + 七条目只留 `version`），清掉真机测试写入的 `installedAt` / `source:"local"` / `size` / `sha256` / `hashVerified`。不删文件、不改 schema、不删模块记录、不给内置记录补 sha256。恢复后 7 个包目录与台账一致（decade 50 / mobile 44 / yjcm 45 / online 70 / baby 27 / codename 32 / card-skin 1017 文件） |
| 测试（全部先 RED） | `p5-jszip-source`：未注入 extractor 两侧一致、probe 通过（探测前 unknown → 探测后 available+ready）、probe 失败缓存且不再翻供、三次并发 `ready()` 只探一次、无 probe 方法的替身端口按既有事实可用；原"下完才在 extracting 失败"的用例改写为"resolving 早拒 + 下载次数 0"。`p5-installer`：能力缺失时 `install`/`update` 都是 `NO_EXTRACTOR` 且 `download===0`、`files` 为空、台账未创建；尚未探测时 `install` 先探一次再照常下载且只探一次；裸安装器断言补 `ready:false` |
| 语义边界（如实记） | ①probe **抛错**过去会让 `ready()` reject（窗口自己 try/catch），现在收敛为 `{ok:false, reason:"探测解压能力时抛错：…"}`；配合"失败也缓存"，意味着一次瞬时失败要**重载游戏**才会重试——这正是任务书要的行为，但值得知道。②未探测前 `isAvailable().available === false` 是刻意的：调用方要么先 `await ready()`，要么按 `missing*` 字段判端口 |
| 门禁 | 227 JS/mjs `node --check` ✓；**十套**测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓ |
| 未做（按任务书范围） | 未改 `scripts/build-release.mjs`、P9 ZIP 格式、`module-index.json` 结构、Feature/Style Runtime、card-skin 架构；未做动态 import、运行时 unload、P10 自动发布；未动 noname 本体 |

### P8 card-skin 记录（第二刀：第一个 `pack:true` 的 Feature）

| 项 | 内容 |
|---|---|
| 范围决定（用户批准） | ①一次做完（真搬文件 + 删单体副本，P3/P4 惯例）；②未装包时内置五套**从外观页下拉消失**（与 P3"未装就不可选"同语义，不留"选了坏图"的路）；③`switchKey: null` 只资源门控——开关语义已在 `cardPrettify`（`off`=关闭），不再造第二套状态源 |
| Feature 声明 | `BUILT_IN_FEATURES += { id:"card-skin", name:"卡牌皮肤", capabilities:["card-skin"], switchKey:null, defaultEnabled:true, pack:true }` ⇒ `active = 已声明 × getInstallState("card-skin").independent × (无开关→真)`。P6 行自动为：未装→只有`安装`（无源时置灰并说明）、已装→只有`卸载`，**不冒出启用/禁用** |
| 单一决策点 | `resourceLoader` 新增 `getModuleRel(id)`：模块根**相对扩展根**的 POSIX 路径（未独立安装返回 `""`）。`getModuleBase(id)` 改为 `base()+getModuleRel(id)`，于是"给 DOM 的 URL 根"与"给 `game.getFileList` 的目录根"从此同一个判断，不许各处再拼一次 `modules/<id>/<version>`。`getModuleBase` 的注入覆盖仍只服务 P3 的切换实验 |
| 双根形状 | 内置五套的根 = `getModuleRel("card-skin")`（装包→`modules/card-skin/1.4.2/`；未装→扩展根，而单体副本已迁走 ⇒ 扫到空 ⇒ 不可用）；玩家自建文件夹**永远**扫单体根 `image/card-skins/`（"丢进去重启即可用"是原版行为，实测点见§八）。`discoverDynamicSkins()` 与第三方 `window.registerDecadeCardSkin({extensionName,…})`（皮肤根在别人扩展目录）**一字未动** |
| 可用性单一来源 | `statics.registerSkins()` 的**内部扫描那一次**发布 `setCardSkinAvailable(key, 牌面数>0)` —— 扫描结果是唯一真相，配置层不再自行判断装没装包（避免 kill-effect 那类"两处各存一套"的错）。未扫描过（`undefined`）时乐观视为可用，防菜单在扫描完成前把皮肤全抹掉 |
| §57 兼容修复（验收发现，`64719f3`） | `registerSkins` 被三条路径共用（内置扫描 / 第三方带 `cardNames` / 第三方走目录扫描），首版在其中**无条件**发布可用性 ⇒ 别人一次空目录注册就能把内置 `decade` 整体标成不可用，`skin-applier` 随之当成 `off`；而原版 API 明确允许复用已有 skinKey（文档示例即 `registerDecadeCardSkin({extensionName:'我的扩展', skinKey:'decade'})`）。修法：`registerSkins(..., { publishAvailability })`，只有 `loadBuiltinSkins` 传 `true`，第三方两条调用点保持四参、不写 availability。皮肤根、同名条目去重优先级、`READ_OK` 语义一字未动，也未新增第二套状态源。测试补 A/B/C/D 四态（RED 实测为「B：false 不等于 true」） |
| 消费端 | `config/utils.getAvailableCardSkinPresets()` 供下拉过滤（`cardPrettify.get item()` 改用，`off` 仍由定义侧补）；`skin-loader.buildSkinUrl()` 对不可用皮肤返回**空串**（不产生必 404 的地址）、内置套经 `getModuleBase("card-skin")` 解析、并删掉了 `window.decadeUI?.extensionName \|\| "十周年UI-Stars"` 这个硬编码回落；`getFallbackKey()` 要求回退目标真有牌面；`skin-applier.getSkinConfig()` 把"选中但无牌面"等同 `isOff` |
| 遗留配置值 | 玩家原先选 `decade` 而本次没装包：**不改写他的配置**（不许偷改玩家设置），由消费端等同 `off` 走本体默认卡面；重新装上即恢复 |
| 文件搬迁 | `git mv` 五套（online 85 / caise 380 / decade 241 / bingkele 44 / gold 266 = 1016 文件，21,500,762 字节 ≈ 20.5MB）→ `modules/card-skin/1.4.2/image/card-skins/`。git 侧 **1016 条 rename@100%、零增删**，历史可追。`image/card-skins/.gitkeep` 保留（这一层从此只放玩家自建皮肤） |
| 包 manifest | `type:"feature"`、`entry:{js:[],css:[]}`（卡面是数据，牌名由运行时列目录得出，没有入口文件可登记）、`size` 记字节、`cardSkins[]` 存**每套的文件数与字节数快照**、`note` 写双根约定。`normalizeManifest` 用 `...raw` 合并，自定义字段不会被剥掉（与 P4 `deadRefs` 同一机制） |
| 脚本 | `scripts/build-card-skin-pack.mjs`（幂等：已搬过自动转校验；`--verify` 供门禁复跑）。校验点：每套非空、**单体根不得残留同名目录**（否则双根互相复活）、manifest 与实盘计数一致、`installed.json` 已登记、`.gitkeep` 在场 |
| 接线 | `modules/installed.json += card-skin` → `registerInstalledModules()` 以 `source:"installed"` 覆盖内置登记 → `getModuleRel` 切包根。对外仍只有 §57 的既有面（`decadeUI.feature`/`resource`/`moduleManager`），无新增公开 API |
| 测试 | 新增 `tests/p8-card-skin-pack.test.mjs`：用**假 `game.getFileList` 目录表**（与本体 `success(folders, files)` 签名一致）驱动真实 `createStaticsModule()` 扫描，断言未装/已装两态下的扫描根、缓存 URL、可用性、下拉列表、`buildSkinUrl` 空串、第三方根、P6 行动作集；`p1-smoke` 注册数 8→9 与 feature 计数 1→2；`p8-feature-runtime` 的 `list()` 顺序补 `card-skin` |
| 门禁 | 184 个 JS/mjs `node --check` ✓；**八套**测试全过 ✓；数量守恒逐套一致 ✓；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓（`dist/modules/card-skin` 内 1017 文件，`dist/image/card-skins` 仅剩 `.gitkeep`，无重复副本） |
| 未做（边界） | `dynamic-skin`（动态皮肤）与 `progress-bar` 尚未成为 Feature；未产出 `module-index.json`，所以 P6 里 card-skin 的"安装"仍置灰（只能靠仓库自带包 + 手工装）；皮肤选择 UI 与 `cardPrettify` 键名未动；未做包内皮肤的去重/共享改造 |

### P8 记录

| 项 | 内容 |
|---|---|
| 分层 | `src/core/featureRuntime.js`（纯逻辑：不 import noname、不碰 DOM，Node 全量可测）+ 接线在 `moduleSystem.js`（单例装配，晚绑定）+ 门控点在调用方（`src/effects/index.js`、`src/skills/animate.js`、`src/overrides/player/animations.js`） |
| Feature 形态 | 两种，由声明里的 `pack` 区分：**门控型**（`pack:false`，资源随 Core 发布，kill-effect 即此类，用户决定**永不拆包**）；**拆包型**（`pack:true`，资源装在 `modules/<id>/<version>/`，未装上即不可用——与 P3 样式包"不可用而 Core 正常"同一语义）。card-skin 已于同第二刀成为第一个**拆包型** Feature（见上方"P8 card-skin 记录"） |
| 声明 | `BUILT_IN_FEATURES = [{ id:"kill-effect", name:"击杀特效", capabilities:["kill-effect"], switchKey:"killEffect", defaultEnabled:true, pack:false }]`；字段集由 `tests/p8-feature-runtime.test.mjs` 锁定（P6 界面 `collectFeatureStates` 直接读 `id/pack/switchKey`，改名会红）。**capabilities 不含 `skill-effect`**——技能特效原版没有开关，不许借 Feature 之名造第二个状态源（`d31ab7e`） |
| 门控矩阵 | `active(id) = 已声明 × 资源在场(hasResources) × 开关为真(switchOn)`；配置未播种（`undefined`）回落 `defaultEnabled`，绝不当成"关"；无 `switchKey` 的 Feature 只看资源；未声明/未注册的 id 一律 false 且不抛错 |
| 状态源 | **不新增**：开关就是既有 `extension_十周年UI-Stars_killEffect`（外观页"击杀特效"同一个键）。`moduleSystem` 把 P1 起悬空的 `moduleManager.isModuleEnabled` 钩子接到 `switchOn` → `moduleManager.isEnabled("kill-effect")` 从此真实，`core`/样式不被误伤 |
| 资源寻址 | 不建第二套：`asset()` 委托 `resourceLoader.getAsset` → `getModuleBase`；`cssOf(id)` 返回**模块相对路径**（取自 `manifest.entry.css`），绝对地址由 `resourceLoader.loadCSS` 负责。**kill-effect 的 `entry.css` 为空**（`d31ab7e`）：`effect.css` 同时含击杀窗口 `.effect-window` 与技能特效 `.skill-name`，没有单一 Feature 归属，登记进 Feature 入口会造成"登记了却不加载"或"加载了却随击杀开关卸载"的双重语义；自带样式的拆包型 Feature 才在 `builtInModules` 里按 `pack` 登记单体/包内两套路径 |
| Core 降级 | **门控只作用于击杀那一路**（`d31ab7e`，以原版为准绳）：`setupEffects()` 无条件注册 `line/skill/dialog/ghost`，仅 `effect.kill` 由 `active("kill-effect")` 决定；`src/skills/animate.js` 的击杀调用点保留可选链 `decadeUI.effect?.kill?.()`（它真会被门控），`src/overrides/player/animations.js` 的技能特效调用点**恢复原版的直调** `decadeUI.effect.skill(...)`；`src/styles/layout.css` 的 `@import "effect.css"` 保留（位置与原版一致，不改级联） |
| 公开 API | `decadeUI.feature`（content 阶段挂载，§57 面）：`define/get/list/switchOn/active/asset/cssOf/capabilityOwner`。能力查询按任务书§15：`featureRuntime.capabilityOwner("online-gift")` 这类判断替代 `style === "online"` |
| P6 侧 | `moduleAdmin.buildRows` 新增 `featureStates`（缺省＝行为逐字不变）：门控型出行「内置功能 / 内置 1.4.2」并只给 `禁用`↔`启用`；拆包型未装只给 `安装`，装上后 `卸载` 与 `禁用` 并存；门控型即使索引里有地址也不给安装按钮（避免"装了个不需要的包"）；异常状态（门控型却有台账记录）以台账为准，允许卸载，不留无人能清的残留；无 `switchKey` 的声明不给任何动作（不许凭空造配置键）。再新增 `installBlocker`（`48a82bc`，缺省＝行为不变）：平台缺文件/解压端口时只把 `install/update/uninstall` 置灰、把平台理由**附加**在既有理由之前，`spec` 原样保留，Feature 的启停不受影响 |
| 测试 | `tests/p8-feature-runtime.test.mjs`（门控矩阵、pack 两种形态与 CSS/asset 解析、`isModuleEnabled` 真实接线、`define` 校验、能力归属、声明字段集契约）；`tests/p8-effects-gate.test.mjs`（装配层，`d31ab7e` 按原版语义重写：默认 `kill/skill/line` 都在且 `setupEffects` 不自行 loadCSS；禁用后仅 `kill` 缺席，`skill/line/ghost/dialog` 必须在；并锁住边界依据——`layout.css` 仍 `@import effect.css`、`effect.css` 含 `.skill-name`、`skill.js` 创建该元素、技能特效调用点不读 `killEffect`、击杀技能 `filter` 继续读该键）；`tests/p6-module-admin.test.mjs`（6 类 Feature 行 + 4 块平台降级 + 真实接线用例）；`tests/p1-smoke.test.mjs`（注册数 8、`type:"feature"` 计数、`entry.css` 为空、capabilities 不含 `skill-effect`） |
| 门禁 | 182 个 JS/mjs `node --check` ✓；七套测试 ✓；verify-pack 881 可达 / 17 已知上游死引用 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓（产物含 `featureRuntime.js`、`moduleAdmin.js`、`moduleManagerWindow.js`） |
| 未做（边界） | dynamic-skin / progress-bar 尚未成为 Feature（progress-bar 受 precontent 时序限制，另议）；card-skin 拆包为下一刀；Feature 的 CSS 变更不热生效（需重载，任务书§16 第一阶段明确不要求运行时卸载已执行的 JS）；未做 Feature 详情/能力面板 |
| 待游戏内实测 | 见§八「P8/P6 Feature 行部分」 |

### P8 修复记录（同日，用户指出两处问题）

| 问题 | 根因与证据 | 修法 |
|---|---|---|
| ① **模块管理窗口阻断门控型 Feature**（`48a82bc`） | `refresh()` 里 `if (!available.available) { …空提示…; return; }` 把整窗挡下。但门控型 Feature 的启用/禁用**只写一个配置键**，根本不碰文件系统——被"没有文件端口"连带禁掉是语义越界；而 `readInstalled()` 缺端口时返回结构化 `NO_IO` 不抛、`fetchIndex()` 走网络不需要 io，所以提前 return 也不是必需的 | 删除提前 return：能力缺失改为算出一句 `installBlocker` 传给 `buildRows`，列表/台账/模块源照常读照常出。`buildRows` 新增 `installBlocker`（缺省 null＝行为逐字不变），只把 `install/update/uninstall` 三动作置灰、平台理由附加在既有理由之前、`spec` 保留；`enable/disable` 不受影响。汇总行与提示行如实写"本平台不支持安装/卸载；内置功能的启用/禁用仍可用" |
| ② **`killEffect` 意外牵连技能特效**（`d31ab7e`） | 对照**原版** `../十周年UI`：`src/effects/index.js` 的 `setupEffects()` **无条件**注册 `line/kill/skill/ghost/dialog`；`killEffect` 配置全库只在一处被读——`src/skills/animate.js` 的击杀技能 `filter()`。原版 `src/config/definitions/appearance.js` 的 `killEffect` 也只写"击杀敌方角色时会显示击杀特效"。所以"关闭击杀特效→技能特效消失"是 P8 引入的**行为改变**，且 `playerSkill()` 会先 `decadeUI.delay(2500)` 再调 `effect.skill`，玩家白等 2.5 秒什么都不发生 | 门控边界收窄到 `effect.kill` 一路：`line/skill/dialog/ghost` 恢复无条件注册、`setupCardGhost()` 位置回原版；技能特效调用点去掉可选链回到原版直调（击杀那一路保留可选调用，因为它真会被门控）；`effect.css` 回 `layout.css` 的 `@import`（它同时含 `.skill-name`，无单一 Feature 归属）；`kill-effect` 声明改名"击杀特效"、capabilities 去掉 `skill-effect`、manifest `entry.css` 置空并删掉 `FEATURE_ENTRY` 映射。**未新增第二套配置**，配置名/intro 与原版一致无需改动 |
| 边界守护 | 未做动态 import、未改 Vite 多入口、未重构 precontent/content、未做运行时卸载、未提前拆 card-skin、未动 Shared/样式包 | — |
| 门禁 | —（本行是验证记录，不对应缺陷） | 182 个 JS/mjs `node --check` ✓；七套测试全过 ✓（含新增 RED→GREEN：平台降级 4 块、门控接线重写）；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓ |

### P6 记录

| 项 | 内容 |
|---|---|
| 分层 | `src/core/moduleAdmin.js`（纯逻辑：`buildRows`/`summarize`/`codeText`/`resultText`/`formatSize`，不依赖 noname，Node 可全量测）+ `src/features/moduleManagerWindow.js`（窗口：列表/行内按钮/进度/取消/二次确认/重载）+ `src/features/module-manager-window.css` |
| 行模型 | 状态优先级 `core > 内置功能(built_in) > 当前使用 > 不兼容 > 依赖缺失 > 有更新 > 已安装 > 未安装`；每个动作带 `enabled` + `reason`（禁用理由直接作为按钮 title 显示）；`action.spec` 与 `packageInstaller.specFromIndex` 同形，可直接交给 `install/update`；Feature 动作另带 `switchKey`（`enable/disable`，P8 后补，见§四"P8 记录"） |
| 判定口径 | 与后端一致：§19 三条卸载边界（使用中/被依赖/非独立安装，force 不绕过）、依赖满足按注册表口径（同 `ensureDependencies`）、Core 兼容性复用 `manifest.checkCoreRequirement` |
| 入口 | `decadeUI.showModuleManager` / `hideModuleManager`、`Ctrl+Shift+M`、配置窗口"模块管理界面"按钮（config-window 新增 `type:"button"` 行类型） |
| 模块源 | 新配置键 `moduleIndexUrl`（definitions/misc.js + handlers/module-handlers.js，本体菜单与配置窗口都可编辑）；留空＝离线，仍可完整管理本地已装模块；非空则 `fetchIndex` 后合并出可安装/可更新 |
| 明确不做 | ~~启用/禁用~~（**已随 P8 交付**：P6 首版按"当前架构无此概念"划为范围外，`featureRuntime` 建立后由 `16c398d` 补上 Feature 行与启停）；真实 `module-index.json` 资产与上传（P10）；热切换与对局中卸载 |
| 测试 | 新增 `tests/p6-module-admin.test.mjs`（纯 node，无需 noname 钩子）：大小格式化 9 例、`INSTALL_CODES` 全码文案 + 未知码兜底、结果文案含告警、9 行夹具行模型（core/使用中/已装/有更新/不兼容/依赖缺失/被依赖/台账独有/索引独有）、动作启用与禁用理由、summary、离线降级、缺省输入；P8 后追加 Feature 行 6 类与真实接线用例 |
| 未做（UI 层） | 窗口未进游戏实测（无法在 Node 验证 DOM/热键/进度渲染）；行内未做"上一版本/回退"入口（P12 再做）；未做模块详情弹层 |

### P5 记录

| 项 | 内容 |
|---|---|
| 新增 `src/core/downloader.js` | 传输层：XHR + arraybuffer、字节进度（`{bytes,total,ratio,attempt}`）、失败重试（线性退避，默认 retries=2 → 最多 3 次）、取消（AbortSignal，含"开始前已取消"）、超时、SHA256。分类码 `CANCELLED/TIMEOUT/NETWORK/HTTP/SHA_MISMATCH/SHA_UNAVAILABLE/INVALID_URL`。**不重试**：取消、SHA 不符、4xx（重下无意义）；**重试**：NETWORK/TIMEOUT/429/5xx。不碰文件系统，只回传 ArrayBuffer。transport 可注入 → Node 可测 |
| 重写 `src/core/packageInstaller.js` | P1 骨架 → 正式实现。`install/update/uninstall/fetchIndex/listInstalled/localVersions/readInstalled/isAvailable/verifyManifest`，全部返回 `{ok, code, message, stage, warnings, ...}`，**不向外抛异常**（任务书§20 失败保护）。`INSTALL_CODES` 22 个码供 P6 出文案。`P1_UNSUPPORTED` 已由 `NO_IO`/`NO_EXTRACTOR` 取代（端口缺失时结构化拒绝） |
| 安装流程（§17） | 依赖解析 → 已在位早检（重复安装不再白下一遍包）→ 下载 → 写 `tmp/modules/<id>-<ver>-<rand>.zip` → **读回落盘内容**算 SHA256（不是只校验内存）→ 大小一致性检查 → 解压到临时目录 → 结构与 Manifest 校验（schema/id/version/core/entry 文件存在性§24）→ 发布（旧目录改名让位→临时目录转正→清理让位目录）→ 原子写 installed.json（临时文件+改名）→ `registry.unregister` + `moduleManager.register(manifest,{source:"installed"})` → 结果含 `requiresReload:true` |
| 更新流程（§18） | 先下载并校验新版本目录，再切 installed.json 指针，**旧版本目录保留**（`localVersions()` 可列出，供 P12 回滚）；同版本 `force` 重装走让位→转正→清理路径 |
| 卸载流程（§19） | 顺序：使用中检查（`isInUse`，core 恒为使用中）→ 被依赖检查（扫注册表 dependencies，返回 dependents 列表）→ 已安装检查 → 独立安装检查 → 才删 `modules/<id>/`。内置（非独立安装）模块一律拒删，**绝不碰单体资源** |
| 失败保护（§17末/§20） | 任一步失败：清理临时产物、已安装内容与 installed.json 均保持原样；发布失败把让位目录改回（`rolledBack`）；状态写入失败则撤销刚发布的目录，保证磁盘与状态文件一致；installed.json 损坏时**拒绝改写**（INSTALLED_CORRUPT）而不是重建它 |
| 新增 `src/core/moduleIo.js` | 安装器端口的运行时实现，全部复用本体既有能力（任务书§56禁止1）：`game.promises.{readFile,readFileAsText,writeFile,getFileList,removeFile,removeDir}` + `game.checkFile`（1文件/0目录/-1无）+ `lib.node.fs.rename`（缺失回落 copy+remove）；ZIP 用本体自带 JSZip~~加载方式与 app.importPlugin 完全一致~~**（此说已于 P9 更正：本体并不存在 `game/jszip.js` 全局脚本，`window.JSZip` 也从不赋值，JSZip 是内联 ES 模块；改为 `get.zip` 公开 API 三级获取，见§五 16 与 `5c7b557`）**。路径统一为**扩展根相对 POSIX**，锚点在调用期解析（遵守 P2 的模块求值期禁令） |
| 安全 | `normalizeZipEntry()` 拒绝 ZIP 条目越界（zip-slip）：绝对路径、盘符、NUL、`..` 上跳、空段；io 端口 `abs()` 二次拦截上跳。第三方包不可信是硬前提 |
| 依赖解析（§11） | 缺失依赖 → 有索引则先装（递归，深度=链）；无索引可下载地址 → `DEP_MISSING`；`a→b→a` → `DEP_CYCLE`（消息含完整链）；已注册依赖不重复下载 |
| 接线 | `moduleSystem.js` 注入 io/extractZip/registry/moduleManager + `getCoreVersion`（取 `lib.extensionPack[decadeUIName].version`）+ `isInUse`（core 或 styleRuntime.id）。对外仍是 `decadeUI.packageInstaller`（§57 无新增公开面） |
| 测试 | 新增 `tests/p5-installer.test.mjs`（虚拟 io + 可编排 transport）：下载成功/进度/摘要不符不重试/重试后成功/彻底断网/取消/404不重试5xx重试/非法URL；安装成功落地+注册+模块根切到 `modules/<id>/<ver>/`、未装模块仍回落扩展根；SHA 不符/断网/取消/结构非法五类/id不符/version不符/core不符/schema不符 均零落地零残留；依赖先装+复用+缺失+循环；更新保旧版与 upToDate 与 force 重装无残留；发布失败回滚就位；状态写失败撤销；installed.json 损坏拒改；卸载 IN_USE/DEPENDED/NOT_INSTALLED/core 拒绝/正常卸载/force；端口缺失 NO_IO/NO_EXTRACTOR；索引获取成功/断网/坏 JSON；zip-slip 六类。运行：`node --import ./tests/helpers/register.mjs tests/p5-installer.test.mjs` |
| 顺带修复 | `decadeModule.js` 包分支的手机布局过滤条件：P3-1 起用 `p.includes("/window/")` 判断，但包内已把 `window/` 扁平化为 `<name>-window.css` → 条件永不成立，手机布局下每个已拆分样式多加载 2 个 window CSS（与单体行为不等价）。改为 `isPhoneLayout && p.endsWith("-window.css")`。**影响已提交的 P3-1/P3-2/P3-3/P4 六个包**，属回归修复、非新功能 |
| 未做（边界） | ZIP 解压未复用 `app.importPlugin` 的流程（后者面向整包插件导入并 alert，语义不同），只复用其 JSZip 加载方式；`tmp/` 与 `modules/*/*.replacing-*/` 已入 .gitignore；Core 独立包目录 `core/` 的安装未开放（core 目前无包形态）；无 UI（P6） |
| 待游戏内实测 | 见§八「P5 游戏内实测清单」——**本轮全部为静态/Node 验证，未进游戏** |

### P5 审查修复记录（同日，代码审查后收紧可靠性与安全边界）

| 审查问题 | 修法 | 落点 |
|---|---|---|
| ① IO 可能永久 pending（本体 `game.ensureDirectory` 失败只 `console.log`、`game.promises.writeFile` 因此永挂；`lib.init.js` 加载 JSZip 同样可能不回调） | **不改本体**，重写 `moduleIo`：(a) `settle(run,{label,stallMs})` 只允许落定一次，同步 throw 也转 reject；(b) 桌面端（`lib.node.fs`）全部走 Node fs 的真实 error callback，目录创建用自建递归 `fs.mkdir({recursive})` 取代 ensureDirectory；(c) 无 Node fs 平台先 `game.createDir`（实现里有真 errorCallback）把风险路径变成"目录已存在"的快路径，再 `game.writeFile`，并把"回调收到 Error 对象"也转成 reject；(d) 兜底 watchdog 只在"本体既不成功也不失败地回调"时触发，以 `IoError(ioCode:"IO_STALL")` **reject**，绝不当成功；真实错误优先于兜底（不是用 race 掩盖问题）。`extractZip/writeBinary` 的失败经 `toIoFailure()` 归到 `IO_FAILED`/`IO_STALL`/`INVALID_SPEC` 结构化返回 | `moduleIo.js` 全量重写 + `packageInstaller.toIoFailure/kindOf` |
| ② SHA256 信任来源不明确（曾把包内 `manifest.sha256` 当判据；缺外部摘要时仍把包内值写进台账） | 引入 `externalTarget(rawSpec)`：判据只取**外部**`expectedId/expectedVersion/expectedSha256`（`id/version/sha256` 为等值别名）；顺序＝外部摘要 → 落盘内容实际摘要比对 → 不符即 `SHA_MISMATCH` 且零落地 → 解压 → 包内 `manifest.id/version` 必须等于外部目标（否则 `ID_MISMATCH`/`VERSION_MISMATCH`）。包内自述 sha 最多产生 warning，绝不裁决；缺外部摘要允许本地/开发安装，但结果 `hashVerified:false`、台账 `sha256:""`、`hashVerified:false` | `packageInstaller.js`（`externalTarget`、步骤 4/5/6、`nextEntry`） |
| ③ 事务一致性（同版本覆盖时旧内容在新状态写成功前就被删；卸载先删目录后改台账） | 安装/更新：让位目录 `.replacing-*` **保留到 `installed.json` 写成功之后**才清理；`undoPublish()` 统一回滚（清半成品 + 让位目录改回），回滚自身失败 → `code:"ROLLBACK_FAILED"` + `rolledBack:false` + `residual:<路径>`，不再"假装成功"。卸载：改为 `modules/<id>/<ver>` → 改名 `modules/<id>/.removing-<ver>-<rand>` → 写台账 → 成功后才真删；让位失败 → `UNINSTALL_FAILED`（已让位部分逐个改回）；台账写失败 → 全部改回 + `STATE_FAILED/rolledBack:true`，改回失败 → `ROLLBACK_FAILED`。原子性如实描述：`io.capabilities.atomicRename` 上报，`isAvailable()` 带出；非 Node 平台 copy+remove **非原子** | `packageInstaller.js`（步骤 7/8/9、`uninstall` 重写）、`.gitignore` 加 `modules/*/*.removing-*/` |
| ④ `force` 越权 | `uninstall` 的 `force` **不再**绕过 §19 三条边界：使用中 → `IN_USE`、被依赖 → `DEPENDED`、core → `IN_USE`，带 force 也一样拒绝（force 只对安装侧"同版本覆盖"有意义）。文案里明写"force 不绕过此检查" | `packageInstaller.uninstall` + 测试双跑 `{}` / `{force:true}` |
| ⑤ 范围守护 | 未动 P3 的 `getModuleBase`、未加第二套 ResourceLoader、未动 StyleRuntime 映射、未动四包拆分产物、未开 P6/索引/Release、未改 noname 本体、未顺手修无关 UI bug | — |

新增测试（`tests/p5-installer.test.mjs`）：SHA 信任六类（外部正确/外部错误零落地/包内自述被改仍按外部放行/缺外部摘要标未校验/`manifest.id` 不符/`manifest.version` 不符/`expected*` 与旧字段等价）；事务六类（更新下载失败旧版本仍可用、转正+回滚双失败 → `ROLLBACK_FAILED`+residual、首装失败不留正式目录与台账、卸载让位失败 → `UNINSTALL_FAILED` 且台账文件不变、卸载台账写失败可原样恢复、卸载成功无 `.removing-` 残骸）；IO 五类（`createDir` 报错 → `writeBinary` reject 且 installer 返回 `IO_FAILED@stage=temp`、本体永不回调 → `IO_STALL`（测试用 `Promise.race` 3s 证明不 pending）、桌面 `fs.mkdir` 真实错误进入 reject、路径上跳端口层拒绝、`atomicRename` 能力如实上报）；force 边界四类（使用中/被依赖/core 各跑 `{}` 与 `{force:true}`）。

### 四包拆分记录（上一会话遗留，本轮收尾提交为 `33da307`）

| 项 | 内容 |
|---|---|
| 脚本 | `scripts/migrate-style-packs.mjs`（一次性批量迁移，语义与 `build-mobile-pack.mjs` 一致：CSS url 自有资源复制进包/共享与死引用指向扩展根 + `deadRefs` 登记；皮肤 JS 相对导入重写为跨包回溯引用） |
| 产出 | `modules/{yjcm,online,baby,codename}/1.4.2/`：manifest.json（entry.css 6 项 + entry.js 3 项 + deadRefs）+ player.css + styles/{character,lbtn,skill,lbtn-window,skill-window}.css + ui/{character,skill,lbtn}/skins/{xinsha,online,baby,codename}.js + 随引用复制进包的图片 |
| 删除（已 staged） | `src/styles/player{3,4,5,6}.css`、`ui/styles/{character,lbtn,skill}/{xinsha,online,baby,codename}.css`、`ui/styles/{lbtn,skill}/window/{...}.css`、`ui/{character,skill,lbtn}/skins/{xinsha,online,baby,codename}.js` 共 24 CSS + 12 JS；单体 `ui/styles/` 现仅剩 base.css/fonts.css，`src/styles/` 仅剩 Core 用 |
| 代码接线 | `builtInModules.js` 四样式 `pack:true`；`decadeModule.js` `MIGRATED_STYLE_IDS` 六样式全量；`modules/installed.json` 六包 |
| 未提交清单 | 已随 `33da307` 入库：新增 `modules/{yjcm,online,baby,codename}/1.4.2/`（含 manifest+CSS+皮肤 JS+随引用复制的图片）、`scripts/migrate-style-packs.mjs`，改动 `builtInModules/decadeModule/installed.json`，删除 24 CSS + 12 皮肤 JS。P5 修复另起提交，**未与四包 squash** |
| 静态验证 | 语法 ✓；verify-pack 881 可达 / 17 已知上游死引用 / **0 未知缺失**；check-skin-imports 37 可达 / 0 缺失；P1/P2/P3/P5 测试 ✓；构建 ✓ |
| 与 P5 的关系 | 皮肤 `ui/*/skins/index.js` 的安装状态路由（P3-2 建立、按 `STYLE_TO_MODULE` + `getInstallState` 泛化）对这四个包同样生效，无需再改；P5 的 `uninstall/install` 让§40"删包→样式不可用→重装恢复"可以不动文件系统手工完成 |
| 遗留待你决定 | 四包是否要像 P3-3 那样把包内自有图片从单体里删掉做去重（当前是"复制进包 + 单体保留"，与 P4 mobile 一致，属 Shared 候选）；任务书§44 要求"每样式单独 PR"，本轮按上一会话的既成事实一次提交 |

**当前任务：P3-1 decade 样式CSS组迁入独立包 —— ✅ 已完成（2026-09-27），待用户验收**（任务书 §39-§40）

### P3-1 记录

| 项 | 内容 |
|---|---|
| 包结构 | modules/decade/1.4.2/：manifest.json + player.css（原src/styles/player1.css）+ styles/{character,lbtn,skill,lbtn-window,skill-window}.css（原ui/styles/*/shizhounian.css）+ 自有图片51个（image/styles/decade、ui/assets/skill/shizhounian 中被CSS引用者） |
| url重写 | 208处：自有资源→包内相对路径；共享资源（image/ui、assets等）→ 指向扩展根的相对路径；脚本 `scripts/build-decade-pack.mjs`（部署模式）+ `scripts/verify-pack.mjs`（引用可达校验：208可达/1缺失为上游死引用dialog3.png，与原版行为一致） |
| 运行时 | precontent 启动时 fetch modules/installed.json + 探测各包 manifest.json → 以 meta.source="installed" 注册（同版本覆盖内置注册）→ getModuleBase("decade") 自动解析到包根；decadeModule 按安装状态条件加载：已装→包内CSS（保持级联顺序：player主样式在equip/layout之前，UI样式在fonts/base之后），未装且已拆分→跳过（样式不可用而Core正常，验收路径），未拆分样式→单体路径不变 |
| 结构调整 | animation.css 归 Core 统一加载（原由各playerN.css @import）；fonts/base 归 Core id；六个单体CSS已 git rm |
| 构建 | package.json build = vite build + 部署 modules/ 至 dist；修复 cpSync 在本机触发 Node fail-fast 的问题（改手工递归复制） |
| 待验收 | ①重启后十周年样式正常（CSS来自包）②删除/移走 modules/decade/1.4.2 → 十周年样式不可用、Core与其他样式正常 ③恢复目录 → 样式还原 |

### 历史：P3 第一子任务记录：getModuleBase 模块根解析正式实现

- **moduleManager.getInstallState(id)**：返回 `{independent, version, type}`，为模块根解析的**唯一数据源**；`independent` 仅当 `meta.source==="installed"`（P5 安装器写入），内置模块与未知 id 恒为 false；版本取自 Manifest（不设第二版本源）。
- **resourceLoader.getModuleBase(id)**：查询上表 → 独立安装且有版本 → `modules/<id>/<version>/`（core 特例 `core/`）；内置/未知/缺版本 → 回落扩展根；返回值统一以 `/` 结尾（basePath 与模块根职责分离）。
- **调用方**：decadeModule/DynamicPlayer 均经 `getAsset` 走新解析，无绕行；`getAsset/loadJS/loadCSS/loadImage/loadAudio` API 与 loader.js 复用不变。
- **测试**：新增 `tests/p3-resource-loader.test.mjs`（兼容模式/decade/mobile/core 独立根/未知id/version缺失兜底/尾斜杠/§19切换点/真实ModuleManager集成/StyleRuntime委托回归）；测试中还捕获并修复了 basePath 无尾斜杠的拼接缺陷。
- **边界**：零资源移动、未创建 modules/ 目录、未动样式内容与任何调用方 API。

### P2 修复记录（验收发现的两个阻塞问题）

| 问题 | 根因 | 修复 |
|---|---|---|
| ① extension.js 首次初始化失败 | P2 路径动态化 sed 把 extension.js 中**定义** `decadeUIPath` 的 info.json 读取行也转换了，首次启动读取尚未注入的全局 → "undefinedinfo.json" | 恢复"扩展目录名作文件系统锚点 → 读 info.json → 取 name → 注入 decadeUIName/decadeUIPath"顺序（与原版设计一致） |
| ② ResourceLoader 未成为真正抽象 | `getAsset(_moduleId, path)` 忽略模块参数，业务层直连 decadeUIPath | `getAsset(moduleId, path)` 成为正式寻址API（缺参报错）；新增 `getModuleBase(moduleId)` —— **P3 唯一切换层**（P2 全模块映射扩展根，P3 切 `modules/<id>/<version>/` 只改此函数）；load* 仍复用 loader.js；业务层首批迁移：decadeModule（core资源走 "core"、样式资源走样式模块ID）+ DynamicPlayer Worker URL |

**修复过程中额外发现并处理的 3 处模块求值期回归**（P2 路径动态化的过度转换——静态 import 链上的模块求值早于 window 全局注入，浏览器同样会崩）：
1. `src/config/definitions/component.js:143`（顶层调用 generateLoadingStyleItems）→ 恢复 `lib.assetURL`+目录锚点
2. `ui/constants.js` SHOUSHA_CONSTANTS 模块级路径常量 → 恢复目录锚点字面量并加注释警示
3. `src/features/didYouKnow.js:27`（顶层 loadTips，错误被自身 try/catch 吞掉的静默失效）→ 恢复 lib.assetURL 锚点

**规则沉淀**：`decadeUIName/decadeUIPath` 只允许在**调用期**代码引用；静态链模块的模块级常量必须用目录锚点（`lib.assetURL + "extension/十周年UI-Stars/..."`）或纯字面量。

**测试基建**：新增 `tests/helpers/register.mjs`（noname 解析钩子 + 浏览器全局最小桩）与 `tests/fixtures/noname-stub.mjs`；p2 冒烟测试新增：ResourceLoader 各 moduleId 寻址等值、getModuleBase P3 切换点注入验证、loader.js 复用源码校验、StyleRuntime.getAsset 委托、**extension.js 首次初始化全流程回归**（真实 import extension.js 断言 infoUrl 无 undefined 且全局被正确注入）。

**统计勘误**：全量语法校验实际覆盖 **201 个 JS**（src 161 + ui 39 + extension.js 1）；此前报告的"154"漏计 ui/ 的 39 个 JS，已纠正。

---

### 历史：P2 公共依赖改造 —— ✅ 已完成（2026-09-27）（任务书 §37-§38）

### P2 完成记录

| 项 | 内容 |
|---|---|
| 样式配置键收口 | styleRuntime 新增模块级 `getStyleConfigKey()` / `readRawStyleValue()` / `getExternalPluginFileName()` 与实例方法 `getRawConfigValue()`；全代码库 **newDecadeStyle 配置键字面量归零**（只允许在 styleRuntime.js 拼接） |
| 38处读取点迁移 | 覆盖 animation/config/core/features/overrides/skills/ui/ui插件skins 共 25 文件，全部改为 `readRawStyleValue()`（原始语义零变化：不归一化、undefined 透传）；写入点（saveConfig）与 prefixMark CONFIG_KEY 改用 `getStyleConfigKey()` |
| main1/2/3.js 迁出Core | app.js 的 styleFileMap 样式映射移至 `styleRuntime.getExternalPluginFileName()`（第三方插件约定本身不变） |
| 资源路径动态化 | `${lib.assetURL}extension/十周年UI-Stars/`（36处）→ `${decadeUIPath}`；concat/反引号相对路径/`../`相对音频/playAudio分段参数/extensionMenu键/字符串路径常量（skins IMAGE_PATH 等）全部动态化；**硬编码 `extension/十周年UI-Stars/` 路径字面量归零**——扩展名从此只由 info.json 决定 |
| 明确不做 | 其余 45 个配置键的方括号字面量（非样式键，P3+ 随模块化再收口）；样式比较逻辑（`==="off"` 等）未改成能力判断——按任务书§14"分阶段迁移"，待 P3/P4 各样式 manifest 落地后再转 hasCapability |

**P2 验收标准**（任务书 §38）：旧行为完全保持 ✅（raw 语义等价替换 + 154 文件语法校验 + 构建 + 双冒烟测试）；样式映射与配置键、资源路径不再写死 Core ✅（STYLE_TO_SKIN 于 P1 收口，本轮完成配置键与路径）。

---

### 历史：P1 模块基础设施 —— ✅ 已完成并验收通过（任务书 §35-§36）

### P1 完成记录

| 项 | 内容 |
|---|---|
| 开发版改名 | 十周年UI → 十周年UI-Stars：info.json name/diskURL、package.json、46 个配置键前缀 `extension_十周年UI-Stars_`（属性访问全部转方括号）、路径 `extension/十周年UI-Stars/`、playAudio 分段路径参数（15处）、`lib.extensionMenu?.["extension_十周年UI-Stars"]`（6处）、扩展名比对保留新旧双兼容 |
| 新增核心模块 | src/core/：manifest.js（Manifest校验/归一化）、registry.js（注册表）、builtInModules.js（core+6样式内置清单）、moduleManager.js（§36验收接口）、styleRuntime.js（样式映射唯一数据源+§13接口）、resourceLoader.js（getAsset/loadJS/loadCSS/loadImage/loadAudio）、packageInstaller.js（P1骨架）、moduleSystem.js（单例装配） |
| STYLE_TO_SKIN 收口 | 原 decadeModule.js 与 ui/constants.js 两份定义删除，唯一数据源 styleRuntime.js；ui/constants.js re-export 保持 3 个 skins/index.js 消费方兼容；死代码 STYLE_TO_INDEX（与实际 playerN 序号相反）一并移除 |
| 公开API挂载 | decadeUI.modules / moduleManager / resource / style / packageInstaller / version（任务书§57）；precontent 阶段装配单例 |
| 内置模块清单 | core + decade(player1.css)/mobile(player2.css)/yjcm(player3)/online(player4)/baby(player5)/codename(player6)，含 entry css/js 与初版 capabilities（provisional，P2细化） |
| 验证 | node 冒烟测试通过（tests/p1-smoke.test.mjs，覆盖§36验收接口/映射/activate写配置/manifest校验/注册去重）；154 个 JS node --check 全过；vite build 成功（4.5s，40项静态复制），8个新模块全部进入 dist |

**P1 验收标准**（任务书 §36）：moduleManager.list()/get(id)/isInstalled(id)/getManifest(id) 全部可用 ✅；暂不要求真正下载 ✅；PackageInstaller 为骨架（返回 P1_UNSUPPORTED）✅；旧行为保持 ✅（映射收口为等值替换，样式加载逻辑未动；改名只影响开发版自身命名空间）。

**P1 过程中修复的自伤**：首轮改名 sed 的属性访问规则失效，产生了"合法但语义错误"的减法表达式（`lib.config.extension_十周年UI-Stars_x` 会被解析为减法）——已用第二轮修复规则 + 全量 node --check 兜底解决；p1 冒烟测试还抓出 register 先归一化导致"缺 core 声明"校验失效的缺陷，已改为先校验后归一化。

---

### 历史：P0 模块化架构审计 —— ✅ 已完成并验收通过（任务书 §33-§34、§61-§62）

审计对象：原版 `十周年UI` 目录（只分析，未改代码、未移动文件）。

子任务清单：

| # | 子任务 | 状态 |
|---|---|---|
| 1 | 完整源码清单（src/ui/image/audio/assets 分类统计，~3395文件/~113MB） | ✅ 完成（审计报告§1） |
| 2 | JS 依赖图（静态import主干、10处动态import、无循环依赖） | ✅ 完成（审计报告§6） |
| 3 | CSS 依赖图（54个CSS、@import链、url()相对路径风险区） | ✅ 完成（审计报告§7） |
| 4 | 资源依赖图（资源→使用者所有权初判） | ✅ 完成（审计报告§8） |
| 5 | Style 引用图（newDecadeStyle 38处/32文件全清单） | ✅ 完成（审计报告§9+附录A） |
| 6 | Shared 资源候选（fonts 33.9MB 为最大共享项；yijiang/OL_line/CD 跨样式共享） | ✅ 完成（审计报告§5、§8.2） |
| 7 | Feature 候选（8个Feature，card-skin/dynamic-skin 独立度最高） | ✅ 完成（审计报告§4） |
| 8 | Core 候选 | ✅ 完成（审计报告§2） |
| 9 | 高风险文件标记（decadeUI.js/app.js/decadeModule.js/content/precontent/overrides 全部精读） | ✅ 完成（审计报告§10） |
| 10 | 产出 `docs/modularization-audit.md`（任务书 §62 要求的 15 节完整报告） | ✅ 完成 |

**P0 关键结论速览**（详见审计报告）：
1. 样式系统 = 6 个官方样式（on/off/othersOff/onlineUI/babysha/codename，`off`=移动版而非关闭），样式=playerN.css+ui/styles多层叠加+皮肤JS动态import。
2. **STYLE_TO_SKIN 映射存在 2 份独立定义**（decadeModule.js、ui/constants.js），由 3 个 skins/index.js 消费，另有 STYLE_TO_INDEX、styleFileMap 两套平行映射 → P2 必须收口。
3. **跨样式共享资源命中任务书预言**：ui/assets/skill/yijiang、lbtn/OL_line、lbtn/CD 被多个样式CSS引用，禁止按目录名打包装。
4. decadeUI.js 的 base/ride 覆写体系与 overrides/ 是一体，不可拆散；ride式覆写无还原路径（现状即"第一阶段不做运行时卸载"的依据）。
5. app.loadPlugins 按样式加载 main1/2/3.js 是第三方插件兼容约定，列入不可破坏 API。
6. spine.js 为 precontent 串行 await 单点故障，P1 起建议降级处理。
7. P1–P4 分阶段清单与体积估算已给出（审计报告§12-§13）。

**P0 验收标准**（任务书 §34）：不改变任何功能行为 ✅（本阶段零代码改动）；已回答哪些文件属于 Core / Style / Feature / Shared、哪些不能拆、为什么 ✅。

## 五、已知问题与风险

0. **【进行中】布局错乱与配置菜单缺失（已修复待验收）**。根因链（用户游戏内诊断实锤）：
   - Stars 的配置对象在 loadExtension 跨层传递时为空（菜单仅4项/0个update回调/`packConfigKeys=0`），而原版启用时为56项/20回调——**Stars 特有故障**；阶梯诊断实证配置模块在游戏运行环境中完整（config:52键），丢失发生在 boot 期对象跨层传递环节（深层机理待查，非本次范围）；
   - 配置对象为空 → 菜单 update 回调缺失 → `#arena` 的 `data-new-decade-style`/`data-right-layout` 永不写入 → 定位CSS（--w、右手布局等19+条规则）全部失效 → 布局回落本体默认（用户所见"错乱"；且Stars回落默认样式on=十周年金框，与用户原版常用的othersOff=一将成名红龙风格对比强烈）。
   - **修复①（e03e382）**：uiCreateArena 直接从配置值写入 arena 样式属性，摆脱菜单回调依赖 → **用户确认布局恢复正常**。
   - **修复②（2069dad）**：content 阶段从模块源补齐菜单注册（跳过已存在键）并按本体语义播种未初始化的 init 默认值 → 恢复"切换样式"等全部配置入口。待用户验收。

0. **【进行中】用户实测布局错乱排查（P2验收阻塞）**：extension.js 修复与 equipCopy 同步后扩展可正常启动、无报错，但武将框位置错乱（缺失/堆叠）。已完成的静态排查：
   - 归一化源码 diff（74 文件残差全部为预期转换）；CSS 与原版**逐字节一致**；dist 文件齐全；
   - **定位机制解码**：武将框定位 CSS 键在 `#arena[data-layout="nova"][data-number="N"] > .player[data-position="K"]`，其中使用 `var(--w)` 的规则依赖 `#arena[data-new-decade-style="on"]`（--w 变量）；我的框（position 0）依赖 `#arena[data-right-layout="on"]`；
   - 这些 dataset 属性由 `uiCreateArena → decadeUI.config.update() → onNewDecadeStyleUpdate/onRightLayoutUpdate` 写入；本体时序（init 522 boot → 528 create.arena，await 保证 content 先行）、本体配置种子机制（loadExtension 为新键写 init 默认值）均已验证正常；
   - 截图特征与"非 default 定位规则失效（--w 缺失）→ 回落本体默认位置"吻合；
   - **下一步：需游戏内运行时数据**（console 诊断：arena dataset / --w / 配置值 / CSS link 加载数），或"打开一次扩展设置菜单再看布局"的快速试验（若打开菜单后恢复，则 boot 期 config.update 未触发）。

1. ~~Stars 目录只有空模板~~ **已解决（2026-09-27）**：原版源码已整体迁入本仓库，后续 P1 起直接在本仓库开发。
2. ~~开发版与原版运行时同名~~ **已解决（P1）**：开发版命名定为「十周年UI-Stars」，运行时路径 `extension/十周年UI-Stars/`、配置键前缀 `extension_十周年UI-Stars_` 均与原版隔离，配置互不污染。注意：两版功能完全重叠，**不可同时启用**，否则全局覆写会互相冲突。
3. P0 完成前禁止任何目录搬移、文件删除、样式重写（任务书 §61）——P0 已验收通过，该约束解除，但 P1 仍执行"零迁移"原则（任务书 §35）。
4. ~~Stars 与原版仓库关系待确认~~ **已决策（2026-09-27，用户确认）**：Stars 作为独立仓库开发，原版十周年UI不动，玩家暂时继续使用原版扩展。
5. 原版仓库的 .github CI（build.yml 会推代码/发布）未迁入，避免对 Stars 触发自动发布；P9/P10 构建系统改造时再引入。
6. **上游漂移风险**：原版仓库（zziyoo/decadeUi）仍在活跃更新，Stars 的迁移快照可能落后。今后同步上游改动时：先 `git -C <原版> log/diff` 确认变更文件，再拷贝并重做键改名转换；禁止直接整目录覆盖（会冲掉 Stars 的模块化改造）。
7. **本机存在两份同仓库克隆**：`extension/decadeUi-Stars`（纯开发克隆，已落后）与 `extension/十周年UI-Stars`（**游戏实际加载目录，当前开发基准**）。游戏只能加载后者的路径名，因此 P3 起在后者直接开发；前者请 `git pull --ff-only` 后再用，避免两边分叉提交。
8. **P5 剩余边界（审查轮之后）**：
   - 本体 `game.ensureDirectory` 的"失败只 console.log 不回调"缺陷已在**我们自己的 io 适配层绕开**：桌面端全走 `lib.node.fs` 真实 error callback（自建递归 mkdir 取代 ensureDirectory），非桌面端先 `game.createDir`（有真实 errorCallback）再写文件；`settle()` 保证只落定一次，本体彻底不回调时以 `ioCode=IO_STALL` **reject**（绝不当成功）。未改本体。
   - 浏览器/cordova 无 `game.removeDir` 递归删目录能力时，卸载会残留空目录（不影响寻址，Manifest 版本目录才是依据）。
   - 无 Node fs 的平台发布走 copy+remove，**不是原子操作**（`isAvailable().atomicRename=false` 如实上报）：中断可能留部分副本，安装器尽力回滚，UI 应提示"重做一次安装"。
   - 下载走 XHR，受 CORS 约束；桌面端可改走本体 `game.download`（transport 注入点已留）。
   - `uninstall` 后注册表里该 id 的**内置记录一并消失**（内置清单只在启动时注册），P6 若要显示"可安装"状态需从 module-index 反查，或届时再恢复内置影子记录。
   - §19 三条边界（使用中 / 被依赖 / core）**不受 force 影响**，是刻意设计：卸载正在使用的模块等于允许运行时抽掉自己脚下的地板。P6 的 UI 必须引导"先切换样式再卸载"。

9. **【P6 实测发现，已修并已复核通过】游戏内 `installed.json` 被读成空台账（窗口显示"已独立安装 0"）**：根因是 P5 的 `moduleIo` 桌面分支把**扩展根相对路径**直接交给裸 `fs`，而裸 fs 的相对路径基准是 `process.cwd()`；本体文件 API 用的却是它自己归一化过的 `window.__dirname`（`noname/init/node.js`：`electron.asar/renderer` → `resourcesPath/app`，否则 `resolve()/resources/app`）。本机 Electron/dev 环境下两者不一致 → `fs.stat` ENOENT → `kind()` 按设计把 ENOENT 当"不存在" → `readInstalled()` 返回成功但台账为空（所以既不报错也不记录，六行全成"未安装"）。**修法**：`moduleIo` 新增 `fsRoot()/fsAbs()`，桌面分支一律用 `window.__dirname` 绝对基准（拿不到时才回落相对形式，Node 测试桩行为不变），`game.*` 回调分支仍用相对路径。新增回归测试（设 `window.__dirname` 后断言裸 fs 收到的全是绝对路径）RED→GREEN。
   **影响面**：不只读——写入同样会落到 cwd 下的错误位置（比报错更隐蔽），修复前**不要用窗口执行安装/更新**。
   - 复核探针（单行）：`({ dirname: window.__dirname, cwd: process.cwd?.(), found: lib.node.fs.existsSync(window.__dirname + "/extension/十周年UI-Stars/modules/installed.json") })` → 期望 `dirname` 为应用根、`found: true`；这同时解释了修复前失败的原因（cwd ≠ dirname）。
   - 游戏内复核：打开窗口应为"已独立安装 6"，六个样式行显示"已安装"，十周年行"当前使用"且卸载置灰。

10. **【P6 已修并已复核通过】本体 `div` 默认绝对定位导致窗口布局挤压**：本体 `layout/default/layout.css` 有 `div { display: inline-block; position: absolute; }`，窗口里未显式声明 `position` 的 div 全部脱离文档流、各自收缩并重叠（用户实测：文字竖挤成一堆）。已为所有该留在流里的类显式 `position: static`（装饰件与进度条保持绝对定位）。**这类坑对后续任何自绘 UI（P6 后续界面、P8 Feature 面板）都成立：在无名杀里自绘 div 必须显式声明 position。**

11. **【P8 已知限制】Feature 启停在重载前不是"无副作用"的**：装载发生在 content 初始化（`setupEffects()` 决定 `decadeUI.effect.kill` 是否注册），所以窗口里点"禁用"后**本次运行仍会播放击杀特效**，需重载才真不装载——任务书§16 第一阶段明确不要求"对局中真正无副作用地卸载已执行的 JS"，界面文案已写"点上方「重载游戏」后生效"。三点补充：
    - **门控只管击杀那一路**（`d31ab7e` 收窄）：`effect.skill`/`effect.line`/`dialog`/`ghost` 与原版一样无条件在；技能特效**没有开关**，外观页的 `killEffect` 只写"击杀"。如果你在某个版本里看到"关击杀→技能特效也没了"，那是回归，`tests/p8-effects-gate.test.mjs` 会红。
    - `src/skills/animate.js` 的 `filter()` 每次触发都读 `lib.config[...killEffect]`，所以**禁用后击杀那一路连延迟都不会产生**；`playerSkill()` 的 `decadeUI.delay(2500)` 属技能特效路径，与击杀开关无关，不许顺手加判断。
    - 门控型 Feature 的行不显示"未安装"（它随扩展发布），只有"内置功能 / 内置 <版本>"加一个启停按钮；若看到"未安装 + 安装按钮"，说明 `featureStates` 没传到（`decadeUI.feature` 未挂载或 content 未跑完），是接线问题不是数据问题。
    - **无文件/解压端口的平台**（`48a82bc` 之后）：列表仍出、Feature 仍可启停，只有安装/更新/卸载三钮置灰。若窗口又变成"整窗空白 + 不支持安装"，也是回归。

12. **【P8 card-skin 已知边界，需游戏内实测】内置卡面已不在单体根**：五套卡面搬进 `modules/card-skin/1.4.2/` 之后，运行时的可用与否完全由"`installed.json` 有没有登记 + 目录扫得到吗"决定，因此有几个必须实测的点：
    - **仓库自带包能被注册**全靠 `registerInstalledModules()` 读到 `modules/installed.json` 并探到包内 manifest。若这条链在任何平台断了（文件读不到、Cordova 下 `getFileList` 列不出中文路径等），表现是"外观页卡牌美化下拉里内置五项整体消失、卡面回落本体默认"——那不是皮肤坏了，是注册没跑成，先按§八 Z1/Z2 两条探针定位。
    - **玩家自建皮肤根未变**：`image/card-skins/` 这一层现在只剩 `.gitkeep`。若玩家把整个包目录（含 `decade/`）又丢回单体根，会被 `discoverDynamicSkins()` 的同名过滤跳过（沿用原版行为，不产生两份真相），但**不要**这样发布皮肤。
    - 老配置值指向未装包的 key 时等同 `off`，**代码不会替玩家改写配置**（避免"升级顺手清设置"）。
    - 卸载 `card-skin` 后包目录被删，内置五项即时不可选；重启前 `getAvailableCardSkinPresets()` 仍按上次扫描结果给列表（可用性由扫描发布，运行中不再重扫），属预期。

13. **【P9 已消项】构建期 zip 与运行时解压器是否跨版本兼容**：已由一次性探针实测证明**不是问题**——探针用的是本体真正 import 的那份 JSZip（`resources/app/_virtual/index2.js`，内部 `jszip@2.7.0`），`new JSZip()` + `zip.load(ArrayBuffer)` 读遍 `dist/release/` 七个包：条目数 27/1017/32/50/44/70/45 与源目录一致、根位 `manifest.json` 全在、**1285 个条目 `asNodeBuffer()` 逐字节一致**、非 ASCII 条目名 0。所以运行时解压的风险点从来不是格式，而是**取不到那个库**：见下条 16（已修）。**真机也已确认**（§八 R3，2026-09-28：`install("baby")` 走通，`extracting` 逐条目推进、`hashVerified:true`、发布后 `modules/baby/` 与 git 零 diff），浏览器侧的 `ArrayBuffer` 路径与本体 JSZip 加载时机都算过了一遍。
14. **【P9 新增可达面】依赖自动安装首次在界面上可达**：窗口此前从不把索引交给安装器，§11「缺依赖先按索引装依赖」只有 Node 测试跑通过。现在 P6 安装一个带缺失依赖的包会真的递归装依赖（多段进度、可取消），这条路径**没有**游戏内实测记录，风险按新代码看待。
15. **【P9 产物纪律】** `dist/release/` 不入库（`.gitignore` 已含 `dist/` 与 `*.zip`）。要给别人试装只能走 Release 资产或本地 http 服务，别指望仓库里能拉到 zip；也别手改 `module-index.json`——`--verify` 会拿盘上产物重算并拒绝不一致。
16. **【P5 必败点，已修 `5c7b557` + 实机打脸后修正 `d296f9e`】运行时取不到 JSZip + 解压端口形状不一致**：
    - **取证**：`noname/get/index.js` 与 `ui/create/menu/pages/optionsMenu.js` 都写 `import JSZip from "../../_virtual/index2.js"`（内部 `jszip@2.7.0`）；`noname.js` 里 `window.JSZip`/`globalThis.JSZip` **0 次**；`resources/app/game/` 下**没有** `jszip.js`。旧实现只认「全局」与「`lib.init.js` 载 game/jszip」两条路 ⇒ 真机 `install()` 在解压步必败。
    - **修法（A，已按实机第二轮修正为 `d296f9e` 的"按实例交付"）**：`createJsZipSource().createInstance()` 按 `window.JSZip`（自己 new）→ **`get.zip(cb)`（本体公开 API，实现就是 `callback(new JSZip())`，每次直接要一份新实例）** → `lib.init.js(game/jszip)`（装完再回查全局）三级选型；每级都要求实例带 2.x 的 `load()`；**选型**连失败一起缓存（探测带加载副作用，界面每刷新一次不该再白等一次 watchdog），**实例每次解压现取**（2.x 的 `load()` 是原地写入，复用会把上一个包的条目带进下一个）；解压用 `zip.load(buffer)`，与本体 optionsMenu 一字不差。不 vendor、不 import 打包器内部路径、不改本体。
    - **被证伪的第一版修法（记下来防止再犯）**：`5c7b557` 当初写成"从 `get.zip` 给的实例上取 `constructor` 再缓存构造器"，死于一个我没验证过的假设——jszip@2.7.0 用 `JSZip.prototype = {…}` **整体替换原型**，prototype 上没有 `constructor` 属性，于是 `instance.constructor === Object`，`new Object()` 自然没有 `load()`，三级选型全部判定失败（Node 复核：`Object.getOwnPropertyNames(JSZip.prototype).includes("constructor") === false`）。**教训**：从别人库的对象上反推构造器之前，先确认它的 prototype 是不是自己写的对象字面量。
    - **顺带堵掉的侥幸**：别的扩展（如 `拖拽读取`）vendor 的 JSZip 是 **3.6.0**，静态看只有 `loadAsync`、没有 `load`。若当"可用"接受，`new Ctor(buffer)` 不载入数据、`.files` 为空，症状会变成"包结构非法/ENTRY_MISSING"这种更难查的假象——形状校验正是为此。
    - **另一处必败（端口形状）**：`moduleSystem` 注入 `createZipExtractor()` 的 `{extract, probe}` **对象**，而安装器一路 `await extractZip(...)` 当**函数**调 → `TypeError` 不带 ioCode → 被解压步误报成 `STRUCTURE_INVALID「解压失败」`，看着像包坏了。现在工厂里归一两种形状（函数仍受支持，P5 测试用的就是函数替身），归一不了就是 `NO_EXTRACTOR`。
    - **能力诚实化（C）**：端口 `probe()` + 安装器 `ready()` + 窗口 `await ready()`；探不过就置灰安装/更新/卸载并写明"本机取不到解压能力（ZIP）：…"，不再让按钮亮着等玩家把包下完才失败。门控型 Feature 的启停不受影响（`48a82bc` 口径）。
    - **记录更正**：P5 记录里原写「ZIP 用本体自带 JSZip，加载方式与 `app.importPlugin` 完全一致」**不成立**——`importPlugin` 在 `noname/game/index.js` 里 grep 不到，我当初照抄的加载路径在本体里不存在。这也是"纯静态验证未进游戏"的代价，已在 P5 记录处同步更正。

## 六、下一步

1. ~~P0~~ ✅ ~~P1~~ ✅ ~~P2（含阻塞修复）~~ ✅ ~~P3/P4~~ ✅ ~~四包批量拆分（`33da307`）~~ ✅ ~~P5 下载器/安装器 + 可靠性审查修复 + 两笔补充修复（`f4a69ac`/`df2afea`/`29a69e3`）~~ ✅ ~~P6 模块管理界面（`2bae45e` + 实测暴露的 `40149bf`）~~ ✅ ~~P8 第一刀：Feature API + kill-effect 门控（`b4d8db5`/`8f89e43`）+ P6 Feature 行（`16c398d`）+ 两处修复（`48a82bc`/`d31ab7e`）~~ ✅ ~~P8 第二刀：card-skin 拆包（`28e1092`/`0e890c7` + §57 兼容修复 `64719f3`）~~ ✅ ~~P9 模块化构建：分包 zip + module-index + 完整校验（`dea6561`/`d5b8baf`）~~ ~~P5 真机前取证修复：JSZip 获取 + 解压端口形状 + 能力诚实化（`5c7b557`，实机打脸后改按实例交付 `d296f9e`）~~ ✅（2026-09-28，**纯代码 / Node 验证 + 一轮实机反馈**）。
2. **无阶段阻塞**：P5/P6/P8/**P9** 的 Android/SAF 真机与游戏内实测按用户决定**不再阻塞推进**，统一并入§八「项目收尾验证清单」，在收尾（P14 全量测试）阶段一次性执行。
3. **推送**：`git ls-remote origin refs/heads/main` = `4a71104`（他刚推的 P11 功能 + v1.19 台账）；本地领先几笔**不在这里写死**——写死会自我指涉（每次为改这个数字提交一笔，数字又变一位），以 `git rev-list --count origin/main..HEAD` 的实测为准，落后应为 0。本轮收尾时的未推内容：与欢迎窗错开（`483095f`）、叠印修复（`8ebf5c1`）、台账（`6736489`）、并排/留空修复（`2722d3d`）。**推送由用户本人执行**；另一份克隆 `extension/decadeUi-Stars` 落后，别在它上面开发。
4. ~~P6 模块市场/管理界面（任务书§43）~~ ✅ 已完成（2026-09-27）：独立窗口 + 纯逻辑行模型 + 模块源配置键；入口 `decadeUI.showModuleManager` / `Ctrl+Shift+M` / 配置窗口按钮。详见§四"P6 记录"。
5. ~~P8 第二刀 card-skin 拆包~~ ✅ 已完成（2026-09-28）：双根寻址、可用性由扫描说话、五套卡面 1016 文件进包。详见§四"P8 card-skin 记录"。
6. ~~P9 模块化构建（任务书§46）~~ ✅ 已完成（2026-09-28，`dea6561`/`d5b8baf`）：`pnpm build` 产出 `dist/release/` 七个分包 zip + `module-index.json` 并完整校验。详见§四"P9 记录"。
7. **P10 GitHub Release（任务书§47）——构建侧已完成，剩下是用户侧发布动作**（`c91a9f8`）：
   - **建 Release**：tag 填 `v1.4.2-stars`（内容与上游同版本发布不同，故带后缀），标题与说明直接取 `dist/release/RELEASE-NOTES.md` 的内容；
   - **上传 9 个资产**（全在 `dist/release/`）：`十周年UI-Stars-1.4.2-full.zip`（整包）、`module-index.json`、以及 `baby/card-skin/codename/decade/mobile/online/yjcm` 七个 `-1.4.2.zip`。**字节数与 sha256 一律以 `dist/release/RELEASE-NOTES.md` 为准（每次构建重算）**：分包与索引自 P9 起就没变过，但**整包会随源码/文档变动**——P11 加入启动检查后整包已是 3592 文件 / 112,104,844 字节 / sha256 `fe14797f5834…`（P10 记录里那个 `4f7940c5…` 是加 P11 之前的数，发布时别用错）；
   - **关键约束**：索引与全部 zip 必须挂在**同一个 tag** 下——索引里 url 是裸文件名，客户端用索引地址解析成同目录资产地址；
   - 发布后把模块源地址填 `https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.4.2-stars/module-index.json` 做一次真机回归（顺便验§八 R4：取消/EPERM/提示条那几条待重测项）；
   - 发布结构对照§47：Core＝本仓库源码（玩家装扩展即得，**不进资产**，已由用户决定）、Official Style Packs＝六个样式分包、Feature Packs＝`card-skin`、Full Package＝整包、module-index.json＝索引。CI 自动发布未做（§五 5 未迁 .github）。
8. **P7 剩余官方样式包**已随 `33da307` 完成；任务书§44"每完成一个单独 PR"未按字面执行（四包一次提交），验收时按样式逐个切换确认。
9. ~~P11 自动更新~~ ✅ **已验收通过（2026-09-28 真机）**：跑通「启动发现 → 提示窗 → 打开模块管理 → 更新 → 台账记 `previousVersion`」，两处排版问题已修（`8ebf5c1`/`2722d3d`），演示状态与台账痕迹均已回滚。演示源（`tmp/make-update-demo.mjs` + 8100 端口）留着备用：若还要复看提示窗就把模块源地址指回 `http://127.0.0.1:8100/module-index.json`，平时用 8099 或留空（否则每次启动都会提示 Core 有新版）。**下一步 P12 回滚（任务书§49）**：要求「当前模块损坏 → 自动恢复上一版本、至少保留当前与上一版」，地基已在（`update()` 保留旧版本目录、台账记 `previousVersion`，真机已验证新旧目录并存），本轮要补的是「损坏探测 + 自动恢复」。
10. ~~P12 回滚~~ ✅ **代码完成（2026-09-28，`a091286`），待真机跑§八"P12 部分"四条**（自动回退 / 回退目标也坏 / 无上一版 / 误报为零）。演示与造损坏的前置写在该节开头。
11. ~~P13 旧版本迁移（任务书§50）~~ ✅ **代码完成 + 真机 P13-1/P13-2 已过（2026-09-29，`3ca76a3` + `957c96e` + `2bfd65c` + `a6b42e6` + `d6406d0`）**：`LegacyDetector` 拆成纯逻辑 `core/legacyDetector.js` + 接线 `features/legacyMigration.js`——旧版启用即**自动禁用**、玩家自建卡面**自动复制**、旧配置**按「导入」按钮才写**（只补玩家没动过的键）、结果走 P11/P12 提示窗。首轮真机查出根因是**两个扩展抢 `window.decadeUI` 全局名**（详见§四"P13 记录"）：已把禁用挪到守卫之前、并把共存做成看得见的状态；**明确不给 Stars 换全局名**（两套 UI 同时 hook 本体正是要避免的事）。标记版本号取不到时改为现读 `info.json`（`d6406d0`）。**P13-3 并入 P14 统一验**（用户决定）、P13-4 本机验不了。
12. **P14 最终测试（任务书§51 + §52）—— 工具链已完成，真机三批待跑**：九份模块表 + 五类矩阵已建好，`tests/p14-module-tables.test.mjs` 会持续盯住「新模块没测试表 / 表结构跑偏 / 真机项被冒充成已做」。**批 1**（样式六套逐个切换 + 卡面五套 + 玩家自建套 + 手机/横屏 + P13-3 卡面复制）、**批 2**（模块生命周期：P12 四条回退探针 + P11 三条更新提示探针 + 卸载重装）、**批 3**（游戏模式四类 + 联网分支）。§52 要求的独立测试表已建立在 `tests/modules/`，矩阵在 `tests/modules/P14-matrix.md`。
13. ~~工作区状态~~ ✅ **已回基线（2026-09-29）**：`modules/installed.json` 里 `baby` 仍指向 1.4.3 而磁盘只剩 1.4.2（P11 演示痕迹没清干净，这种"台账指向不存在的版本"下次启动就会自己触发 P12 损坏检测），已按 HEAD 恢复为基线（schema 1 + 7 个模块各只带 `version`）；`modules/codename/` 目录文件与 `baby/1.4.2/` 均在位，`find modules -name ".*-*"` 为空。以后每次真机探针收尾都要按这个顺序查：台账指回基线 → 版本目录存在 → 无 `.replacing-/.removing-/.corrupt-` 残留。

## 七、会话记录

| 日期 | 会话内容摘要 |
|---|---|
| 2026-09-27 | 建仓推送至 zziyoo/decadeUi-Stars；创建本文档；完成 P0 审计并产出 `docs/modularization-audit.md` |
| 2026-09-27 | P0 验收通过（附三处表述修正）；决策 Stars 为独立开发仓库并迁入原版 v1.4.2 源码；原版不动，玩家继续用原版 |
| 2026-09-27 | **P1 完成**：开发版改名十周年UI-Stars；模块基础设施 8 文件落地；STYLE_TO_SKIN 收口单一数据源；decadeUI 公开 API 挂载；node 冒烟测试 + 全量语法校验 + vite 构建通过 |
| 2026-09-27 | **P2 完成**：样式配置键与 38 处读取点收口 styleRuntime；main1/2/3.js 映射迁出 Core；资源路径扩展名全部动态化（字面量归零）；P2 冒烟测试 + 构建通过 |
| 2026-09-27 | **P2 阻塞修复完成**：extension.js 首启顺序、ResourceLoader getModuleBase 正式抽象、3 处模块求值期回归修复；测试基建（noname 解析钩子）；统计勘误 201 个 JS |
| 2026-09-27 | **热修复：同步上游 equipCopy.js**（上游会话中更新导致快照捕获中间损坏态），修复 content() 中断与角色框布局问题 |
| 2026-09-27 | **P5 完成（纯代码验证）**：新增 downloader.js（XHR+进度+重试+取消+超时+SHA256）、重写 packageInstaller.js（§17安装/§18更新/§19卸载/§11依赖/§20失败保护，全结构化返回不抛错）、新增 moduleIo.js（复用本体文件能力 + 本体 JSZip，zip-slip 防护）；registry.unregister、manifest 版本比较与 core 检查；顺带修复 P3-1 遗留的手机布局 window CSS 多加载回归；新增 tests/p5-installer.test.mjs；210 个 JS 语法 ✓、P1/P2/P3/P5 测试 ✓、verify-pack/skin-imports ✓、构建 ✓。四包拆分为上一会话遗留、本轮收尾提交 `33da307` |
| 2026-09-27 | **P5 补充修复两笔（`df2afea`/`29a69e3`，已推送）**：①`moduleIo.movePath` 按源类型分流（修掉"搬文件一个字节不复制却把源删掉"）、`kindOf` 不再吞 IO 异常、`writeInstalled` 非原子平台备份事务、卸载让位恢复失败报 `ROLLBACK_FAILED`、空台账判损坏；②`movePath` file 分支专用事务 `moveFileNonAtomic`（暂存校验→备份旧目标→提交并回读→删源→清理；提交失败恢复旧目标、删源失败不回滚、恢复失败 `IO_ROLLBACK_FAILED`+residual）。**真机实测按用户决定降级为收尾清单（§八）**，不再阻塞 |
| 2026-09-27 | **P6 模块管理界面完成（纯代码验证）**：新增 `src/core/moduleAdmin.js`（行状态/动作判定/结果码文案/大小格式化，纯逻辑可 Node 测）+ `src/features/moduleManagerWindow.js`（独立窗口：列表/行内安装·更新·卸载/进度/取消/二次确认/重载/模块源输入）+ `module-manager-window.css`；新增配置键 `moduleIndexUrl`（definitions + handlers）与配置窗口 `type:"button"` 行（"模块管理界面"入口）；`content.js` 挂 `setupModuleManagerWindow()`（`decadeUI.showModuleManager` + `Ctrl+Shift+M`）。新增 `tests/p6-module-admin.test.mjs`。**范围外**：启用/禁用（新运行时能力）、真实 module-index 资产（P10） |
| 2026-09-28 | **P6 游戏内实测通过 + fs 锚点修复**：用户实测窗口可开后报"文字挤压在一块"→ 根因本体 `div{position:absolute}`，显式 `position:static` 修复（`f41c524`）；再报"已独立安装 0"→ 根因 `moduleIo` 桌面分支把扩展根相对路径交给裸 `fs`（基准是 `process.cwd()`，而本体用归一化后的 `window.__dirname`），`fs.stat` ENOENT 被 `kind()` 当"不存在" → 空台账且无错误；新增 `fsRoot()/fsAbs()` 并让桌面分支一律走绝对基准（`40149bf`，TDD RED→GREEN，复核显示"已独立安装 6"） |
| 2026-09-28 | **P8 第一刀完成（纯代码验证，`b4d8db5`/`8f89e43`/`16c398d`）**：新增 `src/core/featureRuntime.js`（Feature 声明 + 门控矩阵 + `cssOf`/`asset` 委托 resourceLoader + 能力归属）；`moduleSystem` 把 P1 起悬空的 `isModuleEnabled` 钩子真实接到 `switchOn`；`builtInModules` 按声明注册 `kill-effect` 为 `type:"feature"`（entry 备单体/包内两套路径）；`setupEffects()` 改门控装载、Core 调用点全部可选链降级、`layout.css` 去掉 `@import "effect.css"`。**用户两项决定**：①kill-effect **不搬资源**，定性为**门控型 Feature**（`pack:false` 恒久），拆包那一刀撤掉；②第二个包做 **card-skin**。据此补齐 P6 的 Feature 行：`buildRows` 新增 `featureStates`（门控型出"内置功能"+启用/禁用，拆包型走安装/卸载且装上后才给启停，缺省时行为逐字不变），窗口 `collectFeatureStates()` + `toggleFeature()` 写外观页同一个 `killEffect` 配置键并提示需重载。新增 `tests/p8-feature-runtime.test.mjs`/`tests/p8-effects-gate.test.mjs`，`p6` 加 6 类 Feature 行 + 真实接线用例。门禁：182 语法 ✓、七套测试 ✓、verify-pack 881/0 ✓、skin-imports 37/0 ✓、`pnpm build` ✓ |
| 2026-09-28 | **用户指出两处问题 → 修复（`48a82bc`/`d31ab7e`）**：①`refresh()` 在 `isAvailable()===false` 时整窗提前 return，把"只写配置键"的门控型 Feature 启停一起挡掉了——改为 `buildRows` 新增 `installBlocker`，只置灰 `install/update/uninstall`（保留 §19 原理由与 `spec`），列表/台账/模块源照常。②P8 把 `kill/skill/line` 一起门控是**改变旧行为**：对照原版 `setupEffects()` 无条件注册、`killEffect` 全库只被击杀技能 `filter()` 读取，且 `playerSkill()` 会白等 2.5 秒——门控收窄到 `effect.kill` 一路，技能特效调用点恢复原版直调，`effect.css` 回 `layout.css` 的 `@import`（内含 `.skill-name`），`kill-effect` 的 capabilities 去掉 `skill-effect`、`entry.css` 置空并删掉 `FEATURE_ENTRY`。两处都先写 RED 再改绿，未新增第二套配置、未做动态 import/运行时卸载/card-skin 预拆。门禁：182 语法 ✓、七套测试 ✓、verify-pack 881/0 ✓、skin-imports 37/0 ✓、`pnpm build` ✓ |
| 2026-09-28 | **P8 第二刀：card-skin 拆包完成（`28e1092` + `0e890c7`）**：按批准的三项范围做——一次搬完、未装包时内置五项从下拉消失、`switchKey:null` 只资源门控（开关语义仍归 `cardPrettify` 的 `off`，不造第二套状态源）。`resourceLoader` 新增 `getModuleRel()` 使"URL 根"与"目录扫描根"共用同一决策；`statics` 按归属定根（内置五套→包根、玩家自建→单体根、第三方 `registerDecadeCardSkin` 一字未动）；可用性由 `registerSkins` 的扫描结果发布，`buildSkinUrl` 对不可用皮肤返回空串（不产生必 404 的地址）并顺手删掉硬编码扩展名回落，`getFallbackKey`/`skin-applier` 同步收紧。五套卡面 1016 文件 / 20.5MB 经 `git mv` 进包（git 侧 1016 条 rename@100%、零增删），`image/card-skins/.gitkeep` 保留玩家根，包 manifest 存每套数量快照 + `--verify` 门禁复跑。新增 `tests/p8-card-skin-pack.test.mjs`（假 `game.getFileList` 驱动真实扫描）。门禁：184 语法 ✓、八套测试 ✓、数量守恒 ✓、verify-pack 881/0 ✓、skin-imports 37/0 ✓、`pnpm build` ✓（dist 包内 1017 文件、单体侧只剩 .gitkeep） |
| 2026-09-28 | **P8 card-skin 验收发现一处 §57 兼容回归并修复（`64719f3`）**：可用性发布写在了 `registerSkins` 里，而它同时被第三方 `registerDecadeCardSkin` 复用 —— 第三方用**已有** `skinKey`（原版文档示例即 `skinKey:'decade'`）注册一个空/不存在的目录，就会把内置 `decade` 整体标成不可用，`skin-applier` 随之按 `off` 处理。改法是内部选项参数 `{ publishAvailability }`：只有 `loadBuiltinSkins` 那一次扫描有权发布，第三方两条调用点保持四参不写 availability。未动双根设计、未动 card-skin 安装模型、未新增第二套状态源，第三方的皮肤根与同名去重优先级一字未改。测试 A/B/C/D 四态先 RED（`B：false !== true`）后绿；八套测试、184 语法、verify-pack/skin-imports/card-skin `--verify`、`pnpm build` 全过 |
| 2026-09-28 | **P9 构建系统模块化完成（`dea6561` + `d5b8baf`）**：`pnpm build` 追加 `scripts/build-release.mjs`，产出 `dist/release/` 七个分包 zip + `module-index.json` 并在同一次运行里完整校验（`--verify` 复跑、`--list` 预览）。索引 url 用裸文件名，绝对化只由安装器 `resolveModuleUrl(url, indexUrl)` 一处负责且对绝对地址幂等（解析必须放在 `checkSpec` 之前，那里只收 http(s)）；`fetchIndex` 回带 `indexUrl`；窗口把 `indexUrl` 与 `index` 一起交给 install/update，顺带接通了 P5 §11 依赖自动安装在界面上一直走不到的分支。zip 侧实测出并修掉两个真缺陷：JSZip 默认给父目录补"当前时间"的目录条目导致同样内容摘要不稳（改 `createFolders:false` + 固定 1980 时间戳，证过跨 3 秒两次构建 7 个 zip 与 index 逐字节一致）、`--verify` 重算行 `.digest("hex")` 挂错对象（TypeError）。新增 devDep jszip@3.10.2 仅构建期使用，运行时解压仍是本体 JSZip 2.7 —— 该跨版本兼容性列为真机收尾项。门禁：186 语法 ✓、九套测试 ✓、verify-pack 881/0 ✓、skin-imports 37/0 ✓、card-skin `--verify` 1016/20.5MB ✓、`pnpm build` ✓（7.7s） |
| 2026-09-28 | **真机链路前的静态取证 + A+C 修复（`5c7b557`）**：用户给出验证链（构建→7 个 zip→真机 `install()`→本体 JSZip 2.x→装 card-skin/decade→重载→看资源可用），我先把不需要客户端的部分做完。①用本体真正 import 的那份 JSZip（`_virtual/index2.js`，内部 jszip@2.7.0）在 Node 里读遍 `dist/release/`：条目数全等、根位 manifest 全在、**1285 个条目逐字节一致** ⇒ 台账 §五 13 那个跨版本未知量消掉。②同时取证出真因：`window.JSZip` 在本体里 0 次赋值、`game/jszip.js` 不存在 ⇒ 旧 `defaultLoadJsZip` 两条路全断，真机解压必败；顺带发现 `moduleSystem` 注入 `{extract}` 对象而安装器当函数调 ⇒ `TypeError` 被误报成 `STRUCTURE_INVALID`。③按批准的 A+C 修：`createJsZipSource()` 三级获取（`window.JSZip` → 本体公开 `get.zip` → `lib.init.js`）+ 2.x `load()` 形状校验（也堵掉别的扩展 vendor 的 3.6）+ 结果缓存 + 端口形状归一 + `probe()/ready()` 让界面在装之前就置灰，不 vendor、不改本体。新增 `tests/p5-jszip-source.test.mjs`（先 RED）。十套测试、187 语法、三个校验脚本、`pnpm build` 全过；`tmp/` 下两个探针已清理（`tmp/` 本就不入库）。台账更正了 P5 记录里「与 app.importPlugin 完全一致」这条错误陈述 |
| 2026-09-28 | **实机第一轮反馈推翻我的 A 假设，改按实例交付（`d296f9e`）**：用户在真机跑 `await decadeUI.packageInstaller.ready()` 得到 `ok:false`，reason 点名「get.zip 交出的实例不带 2.x 的 load()」。Node 侧复核证实根因在我：jszip@2.7.0 用 `JSZip.prototype = {…}` 整体替换原型，prototype 没有 `constructor` 属性 ⇒ `instance.constructor === Object`，"从实例反推构造器"必然失败。端口交付单位换成**实例**（全局自己 new / `get.zip` 每次要一份新的 / 脚本装完回查全局），选型缓存、实例每次解压现取（2.x `load()` 原地写入，复用会串包）；顺带修掉 `viaScript` 在脚本回调里无条件报错的控制流错误（会把脚本其实可用的构建判死）。`p5-jszip-source.test.mjs` 重写并先 RED，新增"constructor 是 Object 也要能用"的实机形状回归锁 + 实例互不污染 + 选型只验一次 + 失败缓存零重等。十套测试、187 语法、verify-pack 881/0、skin-imports 37/0、`build-release --verify` 7 包、`pnpm build` 全过；§五 16 与 §八 R0 同步改写（reason 现在能定位到具体哪一级，三种原因修法不同） |
| 2026-09-28 | **实机第二轮确认 A+C 生效**：用户重载后跑 `await decadeUI.packageInstaller.ready()` 得 `{ok:true, reason:""}`，`isAvailable()` 得 `{available:true, missingIo:false, missingExtractor:false, atomicRename:true}`。这补齐了 P5/P9 一直缺的那一环证据——运行时确实能拿到本体 JSZip 并解开我们的包（解压动作本身仍待 R3 用真 zip 走一次 `install()`）。已把 §八 R0 标为已过，并记下 `atomicRename:true` 说明本机走 Electron + Node fs 分支、非原子平台分支仍未实测 |
| 2026-09-28 | **首个真机 `install()` 通过（P5/P9 闭环）**：我起本地静态服务（只暴露 `dist/release/`，8089 被别的进程占着所以改 8099，带 CORS、挡目录穿越），用户跑一条 `fetchIndex → install("baby", {url: 裸文件名, indexUrl, force:true})` 得 `{ok:true, code:"OK", hashVerified:true, path:"modules/baby/1.4.2", requiresReload:true}`，进度 `resolving→downloading→temp→extracting×27→verifying→publishing→state→done`。三条结论落地：P9 相对地址解析真机可用；本体 JSZip 2.7 能解构建期 jszip 3.10 写的包；发布路径逐字节复刻（`modules/baby/` 对 git 零 diff）。测试痕迹：`modules/installed.json` 的 baby 条目多了 `sha256/hashVerified/installedAt/source:"local"`（一条 `git checkout` 可回），`tmp/modules` 留一个空目录（不入库）。§八 R3 与§五 13 标为已过 |
| 2026-09-28 | 用户批准三件事：修台账结构缺陷（单独提交）、回滚 `modules/installed.json` 的真机痕迹、下一步先补剩余真机探针。自查 R6 时读码发现 §八 有三条探针的**判据本身与代码不符**（可安装数恒 0、安装器没有 `dependencies` 进度阶段、回环太快取消点不到），照原样让玩家逐条对照会把正确行为读成失败，已更正并写明"要看依赖补装真发生需要合成包"。另记一次**可疑工具返回**：读取 §五 时两次拿到当前文件里根本不存在的内容（一段「构建产物防篡改校验已闭环，见 `851298d`」的条目），实测 `git cat-file -e 851298d^{commit}` 报 no such object、全仓库 59 笔提交无此前缀、HEAD 与工作区里"防篡改"只出现 1 次（我自己写的那行）。未采信该文本、未据此改动任何结论，仍按 R6 未验自验后再标已过 |
| 2026-09-28 | 用户跑回 R5/R2 结果：取消探针返回 `CANCELLED@downloading`，`fetchIndex`/`listInstalled` 正常。我方直接在盘上核残留（这个目录就是游戏加载目录，`git status --short modules/` 空、包内 1017 文件、无事务目录、台账无新字段），R5 就此关闭；顺手发现限速服务的第一版实现有死锁（`res.write()` 返回 false 后先 sleep 再等 `drain`，而 drain 在那 40ms 里已经发过 ⇒ 永久挂起，实测 112KB 的包挂满 120 秒），改成"一次只压一块、靠 write 回调落定"后才是现在这 15.4 秒。**给自己记一条**：探针判据要读码得出，不能按"听起来应该有"写——本轮三条（可安装数恒 0、没有 dependencies 进度阶段、回环太快点不到取消）都是照原样交出去就会把正确行为读成不合格 |
| 2026-09-28 | 用户发来窗口截图：R1 通过（提示行与汇总行都对），R4 第一次点安装撞上发布步 `EPERM`、第二次成功。我方按"真机报的错误优先于自己的假设"处理：先查盘确认第二次确实装好了（台账 sha 与索引一致、包内 32 文件零 diff），据此把 EPERM 定性为 Windows 目录改名的瞬时冲突而不是逻辑错误，只加**有界**重试、不改发布事务；同时把截图里"提示条看不全"当独立 bug 修成自带滚动。过程中自己又踩一次锚点坑（追加 §三 行时锚点没带行尾那根竖线，产出 4 列残行，列数审计抓出；本轮追加 R1/R4 证据时又踩了同一类的反面——把证据接成了新单元格，5 列行）。另核清「依赖: 无」不是丢依赖，是行模型刻意滤掉 core |
| 2026-09-28 | 用户下 P9 收尾任务书（HEAD `c61882d`，其中一笔 `Update installed.json` 是他自己把真机安装痕迹提交了），本轮只做两件事：恢复台账基线、统一 `isAvailable()`／`ready()` 能力语义。实施中发现任务书 §六 的示例（探测前 `available:false` + `missingExtractor:true`）若照搬，P6 窗口会因 `if (!installBlocker)` 跳过 `ready()` 从而**永久误报"本平台不支持"**——所以 `missing*` 保持端口语义、窗口按端口缺失判定，真实能力交给 `ready()` 的原因承担；这条已在§四记录里写明，免得后人再"照示例改回去"。另把 probe 抛错从 reject 收敛为 `{ok:false, reason}`（配合失败缓存 ⇒ 瞬时失败要重载才重试，如实写进边界） |
| 2026-09-28 | 用户批 P10 四个决定（Core 不进 Release / 要 Full Package / tag `v1.4.2-stars` / 网页手工建 Release），随后又问了整包里要不要排内部文档——他选"排内部三件"。实施中有两处值得记：①整包摘要一度在 `pnpm build` 前后差 4.5KB，先怀疑构建不确定，查下来是 vite 把**我刚改的 README/台账**重新拷进 dist 所致，而 `build-release` 自身连跑两次摘要完全一致——即"看似不确定"实为产物含文档，正是排除内部件要解决的问题；②`new URL()` 会把非 ASCII 资产名百分号编码，测试期望值一开始按明文写，被实测纠正（那是 URL 规范的正确行为，不是缺陷） |
| 2026-09-28 | 用户"动手"后做 P11。两处按"不能想当然"处理：①先读 `moduleManager.list()` 与 `lib.extensionPack[decadeUIName].version` 才确定"本机版本从哪来"（不另找第二处）；②把"已忽略的版本"设计成**只记那个 latest 版本号**——版本一变还会再提，否则玩家一次忽略就等于永久放弃更新。当前未验部分如实标明：提示窗的实际观感、以及它和欢迎窗抢不抢注意力（延迟 1.5 秒，但真机上可能仍撞车），都要等他在游戏里看到才算数 |
| 2026-09-28 | P11 真机首轮："看到欢乐三国杀那条更新、但似乎没看到忽略按钮"。我先用**静态复现**（`tmp/notice-preview.html`：importmap 把 `noname` 指到替身，直接加载真实模块 + 本体 `layout/default/layout.css`）测按钮几何，结论是"结构与 CSS 没问题"——**这一步排除了我的主要猜测，也暴露了复现的盲区：我只量了按钮，没量文字行**。他随后发的截图一眼定位：列表里三行文字叠印在一起（漏给 `row-name`/`row-version`/`core-note` 写 `position`，被本体 `div{position:absolute}` 带走），按钮其实一直在。教训两条：①本体那条全局 `div` 规则的漏网只能靠"逐个类核对"而不能靠抽样；②复现要按"用户看到的每一处"量，不能只量自己怀疑的那一处。已修并加静态不变量测试（先 RED 后 GREEN），另加"与欢迎窗错开"与按钮行 `flex:0 0 auto` |
| 2026-09-28 | 他截图确认修好了（保留一句排版还可以优化）：我随即把并排与对话框留空一并修掉——根因仍是本体那条全局规则同时管 display 与 position，我上一轮只顾了后者；这次让静态不变量测试把两样都盯住（解析 `el()` 第三个参数区分 div 与非 div），两次都靠 RED 先点名再补。演示状态按他要求回滚（`baby` 回 1.4.2、删 1.4.3 目录、台账回基线），并提醒他把模块源地址从 8100 改回 8099 或留空（否则每次启动都会提示 Core 有新版） |
| 2026-09-28 | 用户批四个决定后做 P12。两处按"别想当然"处理：①判据只吃探测结果、IO 错误一律抛给调用方——**不能让一次读盘抖动把好包判死**（这是自动回退最危险的失败模式）；②回退目标自己也要过同一套判据，否则会把另一个坏的换上来。写测试时踩到"注入点打偏"：原子写台账是 temp→rename，在 writeText 上注入失败不命中，测试假绿了一阵，改成注入改名失败才对。接线层（fetch+DOM）没做 Node 测试，如实标注留待真机 |
| 2026-09-28 | 用户批 P13 四个决定后开工（旧版启用即**自动禁用** / 配置全量复制但**只补空键** / **玩家自建卡面自动复制** / 复用 P11 提示窗给「导入」按钮）。开工前先盘家底：原版 `十周年UI` 仍在本机（113MB / v1.4.2）与 Stars 并存，玩家换过来会丢配置的根因是**配置键前缀不同**（`extension_十周年UI_*` vs `extension_十周年UI-Stars_*`，Stars 侧 118 处字面量引用）；本体判定启用与版本分别用 `lib.config["extension_<名>_enable"]` 与 `lib.extensionPack[名].version`。实施中最关键的一处是"只补空键"的判据：本体 `loadExtension` 与 content 都会把 `init` 播种进 `lib.config`，按"键存在就不迁"会得到**零迁移**，改成按"当前值 === 默认值"判，并用"故意把判据改坏看测试红不红"反验过。开工前报了工作区异常（`modules/codename/` 32 文件被删 + 台账无该条目 + `baby/1.4.3` 残留），**只恢复了目录文件、没动台账** |
| 2026-09-29 | 接手 P13 在途代码时先做了"是不是等于批准设计"的核对，而不是直接信工作区：**两处偏离**——配置导入被做成了启动静默写入（批准的是提示窗「导入」按钮），玩家自建卡面自动复制整个没实现（代码注释反而把它记成"用户决定只检测不复用"）。判据不靠回忆：从会话转录里把那次批量提问的原始答复取出来核对，确认 Q1 只填未设置的键 / Q2 按钮触发 / Q3 自动禁用 / Q4 自动复制，再把误记的"用户决定"改回来。实现按四条重做：检测层只出事实、接线层只出动作与条目、文案在窗口里；两条关键判据各做一次"故意改坏→测试必须红"的反验。**排版仍然靠真渲染量**：重建 `tmp/notice-preview.html` + `tmp/preview-server.mjs`（加载本体 `layout/default/layout.css` 与真实模块），第一帧琥珀行是 `position:absolute` 且 height 0——`.decade-update-repair` 没进那条 `transition:none` 覆盖组，样式表加载完成算一次样式变化，于是被本体规则带着滑 0.5 秒；补 `transition:none` 后首帧即归位。第二个发现更要紧：「导入」按钮挂在行内时会落在 46vh 滚动区的折叠线以下（预览里列表 544/可视 256），点不到等于没做——把按钮改挂底部常驻区并让该行 `scrollIntoView`，这正是 P11"没看到忽略此版本按钮"的同一类问题。**另纠正工作区一处会让真机自触发损坏检测的状态**：`modules/installed.json` 指着 `baby/1.4.3` 而磁盘只有 `1.4.2`，已按 HEAD 回基线（7 模块各只带 version），收尾顺序以后固定为"台账回基线 → 版本目录存在 → 无 `.replacing-/.removing-/.corrupt-` 残留" |
| 2026-09-29 | P13 真机首轮排查走了三层，其中两层是我自己的探针写错：①先怀疑判据，实测旧版 `enable` 是布尔 `true`，`=== true` 的写法确实与本体闸门不同形（已改 `Boolean(...)`），但它不是本次原因；②再怀疑代码没进页面，用 `fetch(content.js, {cache:"no-store"})` 与 `window.decadeUI.legacyMigration` 对照，得出"服务器新、页面旧"；③我给他的第二条探针用了 `lib.assetURL` 拼地址，而这个构建里它是空串（`noname/util/index.js:2`），裸相对地址在控制台里解析失败，未捕获的 rejection 被本体错误处理接走、**在他游戏里弹了错误框**——探针必须自带 catch；④我又把 `updateCardStyles` 当成"新代码标记"，可两个代码库里都有它，于是给出了一张自相矛盾的判据表——正是这个矛盾把方向扭对：`十周年UI/src/content.js:146` 与我们的 `:160` 是同一道 `if (window.decadeUI) return;`，**两个扩展共用一个全局名，旧版先加载就把 Stars 整段挡在门外**。教训两条：标记必须挑"只有新代码才有"的，判据表里每个标记都要先确认唯一性；"改了没反应"要先问代码到没到执行点，再怀疑逻辑。 |
| 2026-09-29 | `a6b42e6` 顺手把"共存"这件事从暗处搬到明处：决定**不给 Stars 换全局名**（两个扩展都 hook 同一批本体函数，改名等于允许两套 UI 同时运行，正是 P13 要避免的界面错乱），改为在 `content()` 开头先记下 `window.decadeUI` 是谁、给自己打 `isStars` 标记，占不到全局且占者不是自己时，提示窗第一行就写「这一局界面仍归旧版」。同时把上一轮为"按钮可见"加的行排序撤掉——按钮已经在底部常驻区，行序该按"哪句最要紧"排。静态不变量测试从一条加到三条（调用点早于守卫 / 提前退出要弹告知 / 必须打标记），删掉标记行验证过会红。 |
| 2026-09-29 | P13-1/P13-2 真机走完，两处结论都靠"唯一写入点"倒推：`legacyMigratedFrom` 全仓库只有 `legacyMigration.js:150` 会写，而它只在按钮的 `apply()` 里被调 —— 所以看到标记从 `undefined` 变成值，就等于按钮真被点过（用户以为只点了「知道了」：底部按钮区最左是青色的「导入旧版设置」，最右才是「知道了」，位置确实容易混）。同时这暴露一个小缺陷：在"旧版已停用、本局没装载它"的会话里点导入，版本号取自 `lib.extensionPack[旧版].version` 会拿不到 ⇒ 标记写成 `"unknown"`；只影响说明文字，按"不擅自扩范围"记下来等用户定。另外这轮排查我自己写错三条探针（`lib.assetURL` 是空串、`updateCardStyles` 不是新代码独有、前缀长度算成 18 而非 16），全部已在本表§七里留痕，判据里的每个标记都要先证唯一性。 |
| 2026-09-29 | **P13 收尾（用户批：现在修版本号 / P13-3 并入 P14 / 下一步进 P14）**：`d6406d0` 让 `applyLegacyImport` 在拿不到版本号时现读一次 `extension/十周年UI/info.json`（有版本号就不多读盘、读失败只让标记退回 `unknown` 不影响导入），`apply` 因此变异步 —— 按钮期间 `disabled` 防连点，失败分支改口为"可能已写入部分项"（逐项写入中途抛错确实会留下已写部分，原来那句"没有写入任何配置"是不实的）。两条反验：改成"总是读盘"→ 用例红；不做补读 → 三条新用例红。浏览器实测异步点击：点击瞬间 `disabled=true`、完成后按钮消失、回执带「（来自旧版 1.4.2）」。 |
| 2026-09-29 | P14 工具链四步走完，最有价值的不是新增测试而是**回头盘点自己写的「已做」**：矩阵里我写了 `HASH_MISMATCH`（不存在，真实是 `SHA_MISMATCH`）和一条长期没有用例的「排除模式不装载插件」。后者之所以一直没暴露，是因为它写在 `content.js` 里 —— 那文件一 import 就拉起整条 DOM/本体链，Node 侧够不着，于是「测不了」被默认成了「已做」。挪成纯模块 `src/core/uiMode.js` 才补上 12 条断言，且语义零变更（取不到模式时保持装载，漏判等于整个 UI 消失）。教训：**凡是测不到的内联判断都该视为无覆盖**，不能因为写进了矩阵就算账；同理错误码与键名一律对回源码，不凭印象。另外整包排除改成目录前缀判据后加九份文档 sha 一字未变 —— 这类判据化的收益要当场实测给人看，别留在假设里。 |

## 八、项目收尾验证清单（真机 / 游戏内，收尾阶段统一执行）

> P14 起：本节的挂账项已并入总账 `tests/modules/P14-matrix.md`（矩阵只管覆盖方式/归属/状态，**操作步骤与判据仍以本节为准**）。字母表 A…Z6 与 R0…R6 归到矩阵的「§八 通用」。

> 本清单原为 P5 阶段阻塞项。因 Android/SAF 真机与游戏内验证成本极高（用户决定，2026-09-27），**P5 的真机与游戏内实测不再阻塞阶段推进**，改为在**项目收尾（P14 全量测试）阶段统一执行**；P6 及后续阶段的真机项也追加到本清单。
>
> 前置：F12 Console 里 `decadeUI.packageInstaller` 应存在（content 阶段挂载）。以下均为**单行单表达式**，可逐条粘贴。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| A | 端口可用性与原子性能力 | `await decadeUI.packageInstaller.isAvailable()` | `{available:true, missingIo:false, missingExtractor:false, atomicRename:true}`（桌面端 true；若为 false 说明无 Node fs，发布走非原子的 copy+remove） |
| B | 读已安装台账 | `await decadeUI.packageInstaller.listInstalled()` | items 含六个样式包，`independent:true`；老条目无 `hashVerified` 字段属正常（仓库自带包未经安装器写入） |
| C | 离线不崩（任务书§42） | `await decadeUI.packageInstaller.fetchIndex("https://example.invalid/module-index.json")` | `{ok:false, code:"DOWNLOAD_FAILED", cause:"NETWORK"\|"HTTP", attempts:3}`，**无异常抛出、游戏不卡死** |
| D | 真实安装一个包（外部摘要为唯一信任来源，**P9 起直接用构建产物**） | 先 `pnpm build`（或 `node scripts/build-release.mjs`）产出 `dist/release/`，把其中一个 zip（建议先试最小的 `baby-1.4.2.zip`）与 `dist/release/module-index.json` 放到可 CORS 访问的 https 地址（本地可用 `npx http-server -p 8089` 起在仓库根，索引地址就是 `http://localhost:8089/dist/release/module-index.json`），然后 `await decadeUI.packageInstaller.install({id:"baby", expectedVersion:"1.4.2", url:"<zip地址>", expectedSha256:"<索引里那条 sha256>"}, {onProgress: i => console.log(i)})` | 进度逐条 → `{ok:true, hashVerified:true, path:"modules/baby/1.4.2", requiresReload:true}`；`modules/installed.json` 里该条目 `sha256` 等于外部值、`hashVerified:true`。**这一条同时证明"jszip 3 写的包本体的 JSZip 2.7 解得开"**（§五 13），若报 `STRUCTURE_INVALID`/`ENTRY_MISSING` 就是跨版本问题而非网络问题 |
| D2 | 缺外部摘要的本地安装 | 同 D 去掉 `expectedSha256` | `{ok:true, hashVerified:false}`，warnings 明写"内容未经完整性校验"，台账 `sha256:""`（**不会**把包内自述值当已验证写进去） |
| E | 摘要不符零落地 | 同 D 但 `expectedSha256` 改成 `"0".repeat(64)` | `{ok:false, code:"SHA_MISMATCH", expected, actual}`，`modules/decade/1.4.2/` 内容不变、`tmp/` 无残留 |
| F | 使用中拒卸，且 force 也不许（§19） | 当前样式为十周年时依次跑 `await decadeUI.packageInstaller.uninstall("decade")` 与 `await decadeUI.packageInstaller.uninstall("decade", {force:true})` | 两次都是 `{ok:false, code:"IN_USE"}`；`uninstall("core")` 同样拒绝；文件与台账不变 |
| G | 卸载→样式不可用→重装恢复（§40 验收主路径） | 先切到移动版并重载 → `await decadeUI.packageInstaller.uninstall("decade")` → 重载 → 切回十周年样式看效果 → 再用 D 的 install 恢复 | 卸载后十周年样式缺失但 Core 与其他样式正常；重装后恢复 |
| H | 取消 | `const c=new AbortController(); decadeUI.packageInstaller.install({id:"decade",version:"1.4.2",url:"<大文件>"},{signal:c.signal, onProgress:i=>console.log(i)}); c.abort()` | `{ok:false, code:"CANCELLED"}`，零落地 |

**注意事项**
1. `install` 成功后需 `game.reload()` 才生效（任务书原则4：不做对局中热卸载）。
2. 下载源必须允许跨域（XHR 读 GitHub Release 资产需走 `objects.githubusercontent.com` 或 raw/jsDelivr 等带 CORS 的地址）；若实测卡在 CORS，把 transport 换成本体 `game.download` 的桌面原生通道是 P6 的备选方案（已预留注入点）。
3. 测试会改写 `modules/installed.json`；要回到仓库状态用 `git checkout -- modules/installed.json`。
4. **P9 起产物已存在**：`pnpm build` 会产出 `dist/release/*.zip` 与 `module-index.json`（不入库），所以 D~H 不再需要手工造包，直接用产物即可；仍不想联网时至少跑 A/B/C/F 四条。
5. **IO 故障无法在游戏内安全注入**（需要只读目录/断链回调），已在 Node 层用假 io 覆盖：`createDir` 报错 → 安装器返回 `IO_FAILED@stage=temp`；本体永不回调 → 15 秒后 `IO_STALL`（测试用 3 秒 `Promise.race` 断言不会 pending）。游戏内若安装**超过 15 秒无响应**即属异常，请把返回对象与 `tmp/modules/` 残留情况回贴。
6. 卸载的事务顺序是"改名让位 → 改台账 → 才真删"，所以中途失败时模块仍在；若你看到 `modules/<id>/.removing-*` 目录，说明删除阶段没走完（不影响使用，可手工删）。
7. **Android 已知残留面（代码层已尽力，真机仍需确认）**：
   - 本体 `noname/init/cordova.js` 的 `game.checkFile` 把 `NOT_READABLE_ERR` 与 `NOT_FOUND_ERR` **一起映射成 `-1`（=不存在）**，所以无 Node fs 平台上"目录存在但不可读"仍可能被 `io.kind()` 当作不存在 → 卸载可能返回"已卸载"却在磁盘留下目录。**权限类故障请重点验证这一条**（桌面端不受影响：`moduleIo` 桌面分支直接走 `fs.stat`，能区分 ENOENT 与 EACCES）。
   - Cordova 的 `game.writeFile` 走 `getFile(name, {create:true})`（**不带 `overwrite:true`**），覆盖已存在文件的真实行为未知：可能直接被拒。本轮已做成"写失败即保留源文件、并恢复旧目标（`29a69e3` 的目标事务）"，但**能否成功替换 `installed.json` 必须真机实测**；若稳定失败，需要评估"先删目标再写"或改用其他本体 API。
   - 事务临时/备份件命名 `<dest>.moving-<txn>` / `<dest>.moving-backup-<txn>`（不以下划线或点开头，本体 `getFileList` 会列出）。正常事务结束即删；只有 `IO_ROLLBACK_FAILED` 时故意保留备份供人工恢复（`residual` 字段会点名路径）。

### P6 部分（模块管理界面，UI 层必须在游戏内验）

> 已并入矩阵：「§八 P6」

| # | 目的 | 操作 | 预期 |
|---|---|---|---|
| I | 入口可达 | 游戏内按 `Ctrl+Shift+M`；或控制台 `decadeUI.showModuleManager()`；或"扩展设置 → 小小玩楞 → 模块管理界面 → 打开"；配置窗口（`Ctrl+Shift+C`）"模块管理"分组里也有按钮 | 三种入口都能打开窗口；标题"模块管理"，汇总行形如"共 9 个模块 · 已独立安装 7 · 可更新 0 · 可安装 0"（注册表 = core + 六样式 + `kill-effect` + `card-skin`；`card-skin` 已进 `installed.json`，所以"已独立安装"从 6 变 7）；窗口不遮挡操作、可滚动 |
| J | 离线语义 | 不填模块源地址直接看列表 | 六个样式包显示"已安装"；`core` 显示"核心组件（随扩展发布）"且无按钮；模块源提示"未配置模块源"；"可更新/可安装"计数为 0（不误报） |
| K | 卸载边界（§19） | 当前样式为十周年时，看十周年行的"卸载" | 按钮置灰，悬停提示"正在使用中，请先切换到其他样式再卸载"；被别的模块依赖的行提示"被以下模块依赖…" |
| L | 卸载 → 重载 → 重装回路 | 切到移动版并重载 → 在窗口里对十周年执行"卸载"（需点两次：第一次变"确认卸载"）→ 点"重载游戏"→ 回到窗口 | 卸载后该行变"未安装"，`modules/decade/1.4.2/` 消失且 `modules/installed.json` 不含 decade；十周年样式不可用而其他样式正常；有索引时该行出现"安装" |
| M | 进度与取消 | 填一个**允许跨域**的索引地址后点安装 → 中途点"取消" | 进度按阶段推进（下载中/解压中/写台账）；取消后结果条显示"已取消"，`tmp/` 无残留，台账不变 |
| N | 二次确认与重载按钮 | 直接点"重载游戏" | 第一次只变"确认重载"，再点才真的刷新页面；4 秒不动自动复原 |
| O | 窗口与对局共存 | 对局中点 `Ctrl+Shift+M` 打开/关闭 | 不报错、不卡死；关闭窗口（× 或点遮罩）后游戏可继续操作 |

**注意事项（P6）**
1. 窗口只调用 `decadeUI.packageInstaller` 的公开方法，不自己碰文件系统；窗口里的按钮禁用理由与安装器的判定同源（`core/moduleAdmin.js` 与后端口径一致），若出现"按钮可点但安装器拒绝"，请把该行与返回对象一起回贴——那是口径不一致的 bug。
2. 取消只对**下载阶段**有效（安装器语义）；解压/发布阶段点取消会等到该阶段结束。
3. 安装/卸载后必须点"重载游戏"（或手动 `game.reload()`）才生效；对局中重载会丢掉本局。

### P8 部分（Feature 运行时与窗口的 Feature 行，UI/装载层必须在游戏内验）

> 已并入矩阵：「§八 P8」

> 前置：F12 Console 里 `decadeUI.feature` 应存在（content 阶段挂载）。以下均为**单行单表达式**。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| P | Feature 声明可读 | `decadeUI.feature.list()` | 数组含 `{id:"kill-effect", name:"击杀特效", capabilities:["kill-effect"], switchKey:"killEffect", defaultEnabled:true, pack:false}`；`pack` 为 false 是**门控型**的判据（资源随 Core 发布，永不拆包）；capabilities **不应**含 `skill-effect`（技能特效无开关） |
| Q | 门控与开关同源 | `decadeUI.feature.active("kill-effect")`；再 `decadeUI.moduleManager.isEnabled("kill-effect")`；再 `decadeUI.moduleManager.isEnabled("core")` | 前两个同为 `true`（`isEnabled` 的钩子已真实接到 `switchOn`，P1 起悬空的实现不再恒真）；`core` 恒 `true`（Feature 开关不许误伤 core/样式） |
| R | 特效 CSS 无条件在场 | `(()=>{const d=document.createElement("div");d.className="skill-name";document.body.appendChild(d);const f=getComputedStyle(d).fontSize;d.remove();return f})()` | `"55px"`（`effect.css` 由 `layout.css` 的 `@import` 带入，**禁用击杀特效并重载后仍应是 55px**——`.skill-name` 属技能特效，不随击杀开关卸载） |
| S | Feature 行出形 | 打开窗口看 `kill-effect` 行 | 徽标"内置功能"、版本列"内置 <版本号>"、**只有"禁用"一个按钮**（没有"安装/卸载"）；行不被压扁（同 P6 的 `position:static` 坑） |
| T | 禁用只关击杀 | 点该行"禁用" → `decadeUI.feature.active("kill-effect")` → 重载 → 再依次看 `typeof decadeUI.effect.kill`、`typeof decadeUI.effect.skill`、`typeof decadeUI.effect.line` | 按钮立刻变"启用"、`active` 立刻 `false`（配置同值写回）；**本次运行内 `effect.kill` 仍在属预期**（任务书§16 不要求运行时卸载已执行的 JS）；重载后 `kill` 变为 `"undefined"`，而 **`skill` 与 `line` 必须仍是 `"function"`**——若它们变 undefined，是 P8 修复被改回去了 |
| U | 两个入口同步 | 在外观页关掉"击杀特效"，再开窗口看该行 | 按钮显示"启用"（同一配置键 `extension_十周年UI-Stars_killEffect`，不存在第二状态源）；反之亦然 |
| V | 技能特效不受击杀开关牵连 | 禁用并重载后，发动一个带特效的技能（如界定军类技能） | **技能全屏特效照常出现**，且在 `decadeUI.delay(2500)` 之后播放（原版语义：`playerSkill()` 不读 `killEffect`）。若出现"等 2.5 秒什么都不发生"，就是门控边界又被扩大了 |
| W | 幻影出牌不受管辖 | 禁用 kill-effect 并重载后出牌 | 拖尾仍在（`!!decadeUI.effect.ghost.add` 为 `true`，`cardGhostEffect` 是独立开关；`decadeUI.effect.dialog` 也仍在）——**若幻影出牌被一起关掉，那是 bug** |
| W2 | 击杀那一路安全降级 | 禁用并重载后击杀一个角色 | 无击杀窗口，Console **不得**出现 `Cannot read properties of undefined (reading 'kill')`（击杀调用点是 `decadeUI.effect?.kill?.()`；`src/skills/animate.js` 的 `filter()` 也会直接挡住，连延迟都不产生） |
| X | 拆包型 Feature 的"删包即不可用" | 手工把 `modules/card-skin/1.4.2/` 改名移走 → 重载 → 开外观页看"卡牌美化"下拉 → 再改回来重载 | 移走后：下拉里 `OL卡牌/彩色卡牌/原十周年/哈基米哦/手杀金卡` **整体消失**，只剩「关闭」+ 玩家自建文件夹；牌面回落本体默认、无 404 请求、Console 无报错。恢复后五项回来且卡面正常（`decadeUI.feature.active("card-skin")` 由 `false` 变回 `true`） |
| Z1 | 包内注册链是否跑通 | 控制台 `await decadeUI.packageInstaller.listInstalled()` 后看 `items` 里 `card-skin` | 有一条 `id:"card-skin"`、`independent:true`、`version:"1.4.2"`；若没有，说明 `modules/installed.json` 没读到或包内 `manifest.json` 没探到（内置皮肤会因此整体不可选，属注册问题不是皮肤丢失） |
| Z2 | 双根寻址落点 | 控制台 `decadeUI.resource.getModuleRel("card-skin")` 与 `decadeUI.resource.getModuleBase("card-skin")` | 前者 `"modules/card-skin/1.4.2/"`、后者以它结尾的完整 URL；两者必须同源（若 rel 空而 base 指向包内，就是两处各算了一套） |
| Z3 | 实际取图走包根 | 选「彩色卡牌」后，任取一张牌 `getComputedStyle(ui.cards?[0])`… 或直接看 Network 面板过滤 `card-skins` | 请求路径含 `modules/card-skin/1.4.2/image/card-skins/caise/*.webp`；**不得**出现 `extension/十周年UI-Stars/image/card-skins/caise/…`（单体根已无该目录） |
| Z4 | 玩家自建皮肤仍可加（既有行为） | 往 `image/card-skins/` 里丢一个自建文件夹（内含若干 `sha.png` 等）→ 重启 | 下拉出现该文件夹名（或 `meta.json` 里的 `label`），选用后生效；它与包内五套互不影响（同名者按原版被内置跳过） |
| Z5 | 老配置值不背刺 | 选「原十周年」→ 按 X 行把包移走 → 重载 | 不报错、牌面走本体默认；配置值仍是 `decade`（代码不替玩家改写设置）；把包放回并重载后立刻恢复原样 |
| Z6 | 卸载/重装回路 | 窗口里对 `card-skin` 行点"卸载"（两次确认）→ 重载 → 再按§八 D 行的方式装回来 | 卸载后行变"未安装"、`modules/card-skin/` 消失、`installed.json` 不含该条、表现同 X 行；重装后恢复。**注意**：目前无模块索引，"安装"按钮是灰的——只能用 D 行的手工 zip 走 `install()` |
| Y | 无安装能力平台的降级边界（真机） | 在 `await decadeUI.packageInstaller.isAvailable()` 返回 `available:false` 的平台打开窗口 | **列表仍出**：门控型 Feature 行可点"禁用/启用"并生效（写配置，不碰文件）；`安装/更新/卸载` 三钮置灰，悬停理由含"本平台不支持安装/卸载（缺少：…）"且保留原有"使用中/被依赖"理由；汇总行显示"· 本平台不支持安装/卸载" |

**注意事项（P8）**
1. `cssOf()`/`asset()` 是 Feature 的公开寻址 API，但 **kill-effect 目前 `entry.css` 为空**（样式与技能特效共用 `effect.css`，随 Core 的 `@import` 无条件加载）。所以 Network 面板里 `effect.css` 应由 `layout.css` 的 @import 发起、路径在扩展根——这是**正确**的，不是"门控失效"。自带样式的拆包型 Feature 才会出现 `modules/<id>/<ver>/…` 的 CSS 请求。
2. Feature 的启用/禁用不触发任何文件读写：`isAvailable()` 为 false 的平台**同样必须**能启停（`48a82bc` 起窗口不再整窗拒绝；若又变成"整窗空白 + 不支持安装"，是回归，见上表 Y 行）。
3. 未声明 `switchKey` 的 Feature 不给任何按钮（不许凭空造一个配置键）；`featureStates` 缺省时 Feature 行退回通用规则（显示"未安装 + 安装"），那意味着 `decadeUI.feature` 没挂上，属接线 bug。
4. **第三方皮肤注册（§57）与可用性是两件事**（`64719f3`）：`registerDecadeCardSkin` 的注册结果**不许**改变内置皮肤的可用性。若你同时启用了另一个会注册卡面的扩展，验证方法是：内置「原十周年」照常可选 → 那个扩展用自己的目录注册 `skinKey:'decade'`（甚至空目录）→ 重载后内置 `decade` **仍可用、卡面仍来自 `modules/card-skin/1.4.2/`**，它补的新牌名走它自己的扩展目录。若内置五项整体消失或卡面回落本体默认，就是这条被改回去了（`tests/p8-card-skin-pack.test.mjs` 的 A/B/C/D 四态会红）。

### P9 部分（构建产物与在线分支，必须在游戏内验）

> 已并入矩阵：「§八 P9」

> 前置：先 `pnpm build`（产物在 `dist/release/`，不入库），再用任意可 CORS 的 https/http 源把 `module-index.json` 与 zip 暴露出去（本地最省事：`npx http-server -p 8089` 起在仓库根，模块源地址填 `http://localhost:8089/dist/release/module-index.json`）。以下均为**单行单表达式**。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| R0 | 解压能力自检（**先跑这条**） | `await decadeUI.packageInstaller.ready()`，再看 `decadeUI.packageInstaller.isAvailable()` | ✅ **已过（2026-09-28 用户真机，`d296f9e` 之后）**：`{ok:true, reason:""}`、`{available:true, missingIo:false, missingExtractor:false, atomicRename:true}`（`atomicRename:true` 说明这台走的是 Electron + `lib.node.fs` 分支）。若日后回退成 `ok:false`，现在的 reason 会点名是哪一级（`window.JSZip 不存在或不是 2.x 形状` / `本体未提供 get.zip` / `get.zip 交出的实例不带 2.x 的 load()` / `本体未提供 lib.init.js`），三种原因的修法完全不同。此时窗口应已把安装/更新/卸载置灰并显示同一原因，而不是让你白下一遍包 |
| R1 | 索引可读且条目齐 | 在模块管理窗口的"模块源地址"填 `http://127.0.0.1:8099/module-index.json` → 保存并刷新 | 提示行出现"模块源已连接（索引 schema 1）"（若出现"模块源不可用：…"就是地址或 CORS 问题）。**判据更正**：七包在仓库里都已装且版本与索引相同 ⇒ 汇总行"可安装 0"是**正确**的，不是失败（`summarize().installable` 数的是"有可用安装动作的行"）；这一行该看到"已独立安装 7"（六样式 + `card-skin`，P6 实测时是 6）与"可更新 0"。想看非零"可安装"，得先按 R4 卸掉一个包再刷新。✅ **已过（2026-09-28 用户真机截图，经 8099）**：提示行「模块源已连接（索引 schema 1）」、汇总行「共 9 个模块 · 已独立安装 6 · 可更新 0 · 可安装 1」（当时正卸着 `codename` 做 R4，"可安装"随卸载变 1 与判据一致）、行上索引字段齐（名将杀样式 939.4 KB、需要 Core >=1.4.2；卡牌皮肤 20.6 MB 已安装）。**顺带澄清一处不是 bug 的显示**：所有包的 `dependencies` 其实都是 `["core"]`，但行上显示「依赖: 无」——`moduleAdmin.js` 的 `shownDeps` 刻意把 `core` 滤掉（core 恒随扩展在，不作为缺失依赖提示），别按"依赖丢了"去追 |
| R2 | **相对 url 解析** | `await decadeUI.packageInstaller.fetchIndex("http://localhost:8089/dist/release/module-index.json")` | `{ok:true, indexUrl:"<你填的那个地址>", index:{…}}`；`index.modules.baby.url` 是 `"baby-1.4.2.zip"`（裸文件名）——界面与安装器必须能把它解析成同目录下的绝对地址 |
| R3 | 真装一个包（含跨版本解压） | 按 §八 D 行用 `dist/release/baby-1.4.2.zip` 走 `install(...)`（`url` 传索引里的裸文件名 + `indexUrl`，`force:true` 才会真走下载-解压-发布） | ✅ **已过（2026-09-28 用户真机，经 `http://127.0.0.1:8099`）**：`{ok:true, code:"OK", id:"baby", version:"1.4.2", hashVerified:true, sha256:"b3e38d5f1448…", path:"modules/baby/1.4.2", requiresReload:true, attempts:1}`；进度 `resolving→downloading→temp→extracting(27 条 0.037→1)→verifying→publishing→state→done`。三条一并到手：**P9 相对地址解析在真机通**、**本体 JSZip 2.7 解得开构建期 jszip 3.10 写的包**（`extracting` 逐条目推进 27 次）、**发布后 `modules/baby/` 与 git 零 diff（逐字节复刻）**。注：`ratio` 在每阶段首条进度里是 `undefined`（无分母的起点），UI 侧早已按 0 处理，不是缺陷 |
| R4 | 依赖自动安装（界面首次可达） | 卸载 `codename`（96 万字节，比 `card-skin` 小得多；`isInUse` 只认 `core` 与当前样式 id，所以卸哪个都行）→ 重载 → 在窗口里对 `codename` 点"安装" | **判据更正**：安装器**没有** `dependencies` 进度阶段（全量 grep `emit(opts,{stage:` 只有 downloading/extracting/done/卸载 done 四处；`stage:"dependencies"` 只出现在 DEP_CYCLE/DEP_MISSING **失败**里）。进度应是 `downloading→extracting→done`；`dependencies:[core]` 里 core 已在注册表 ⇒ `ensureDependencies` 直接 `continue`，因此**既不该下载 core，也不该出现 warning「已先安装依赖 core」**——后者只在依赖真被补装时才有。成功后行变"已安装"、汇总"可安装"回到 0。**若要看依赖补装真发生**：现有七包的依赖只有 core，而 core 恒在注册表且无包形态，所以正常产物走不到那条分支——需要临时做一个合成包（依赖另一个合成包）才能验，Node 侧 `tests/p9-release-index.test.mjs` 已覆盖递归两分支，真机侧建议先只验"不误下载 core"。**注意**：卸载删的是 git 跟踪的包目录，恢复方式是窗口里重装（或 `git checkout -- modules/codename`）。**部分通过 + 抓出两个真 bug（2026-09-28 用户真机截图）**：①界面侧判定正确——卸掉 `codename` 后行变"未安装 + 安装"、可安装计数变 1、点安装确实走完了整条链（第二次成功后盘上 `installed.json` 写入 `sha256:"be5e8af3094f…"`（与索引一致）、`hashVerified:true`、`size:961947`，`modules/codename/1.4.2/` 32 文件与 git **零 diff**）；也没出现下载 core（索引里根本没有 core 条目，`ensureDependencies` 因 core 在注册表直接跳过）。②**bug 一：发布步 `EPERM`** —— 第一次点安装报「发布到 modules/codename/1.4.2 失败：[ModuleIo] rename tmp/modules/codename-1.4.2-8zs8br 失败：EPERM」，同一个包第二次就成功 ⇒ Windows 目录改名的瞬时冲突（Defender/索引器/未释放句柄），端口原先只把 EXDEV 当可回落信号。已修 `470b35b`：EPERM/EACCES/EBUSY/ENOTEMPTY 退避 80/160/320/640ms 有界重试，确定性错误与 `IO_STALL` 不重试；四块回归测试（先 RED）。③**bug 二：提示条被剪且滑不到底** —— 长错误含两遍绝对路径，撑破对话框后被 `overflow:hidden` 剪掉。已修 `5cbe69f`：提示条改 `max-height:26%` + 自带滚动。**待重测**：重载游戏后再卸再装一次 `codename`，预期一次成功、不再出现 EPERM。本轮又给安装路径加了**能力门**（`cc6ee72`）：`install()` 现在会先复用 `ready()` 的探测结论再决定下不下载，探通才下——所以重测时若看到 `NO_EXTRACTOR @ stage="resolving"`，那是解压能力没探过（本机已验证 `ready()={ok:true}`，正常不该出现），不是网络或包的问题。**2026-09-28 21:16 盘上证据（我方查）**：`mobile`/`online`/`yjcm` 三条以 `source:"local"` + `hashVerified:true` 记入台账（无 `previousVersion` ⇒ 没走回滚）、7 个包目录文件数全对（50/44/45/70/27/32/1017）、无 `.replacing-*`/`.removing-*` 残留 ⇒ **修完 EPERM 重试与能力门之后的安装链路真机通过**；剩下只需他确认界面侧（提示条能否滑到底、有没有再出现 EPERM 字样）。 |
| R5 | 取消与残留 | **推荐走控制台、用同版本 force 重装，不删任何文件**（循环回环默认瞬间下完，取消根本点不到；`tmp/dev-release-server.mjs 8099 --throttle 40 --chunk 65536` 已把 20MB 拉到实测 15.4 秒，来不及就把 40 改 80）。先 `idx = await decadeUI.packageInstaller.fetchIndex("http://127.0.0.1:8099/module-index.json")`，再 `c = new AbortController(); setTimeout(() => c.abort(), 6000);` 然后 `await decadeUI.packageInstaller.update("card-skin", {index: idx.index, indexUrl: idx.indexUrl, force: true, signal: c.signal, onProgress: i => console.log(i.stage, i.ratio)})` | ✅ **已过（2026-09-28 用户真机，限速服务 64KB×40ms）**：`update("card-skin", {index, indexUrl, force:true, signal})` + 6 秒后 `abort()` → `{ok:false, code:"CANCELLED", message:"下载已取消", stage:"downloading", warnings:[]}`。残留半边由我方在**同一目录**（这就是游戏实际加载目录）核掉：`git status --short modules/` **零输出**、`modules/card-skin/1.4.2/` 仍 **1017 文件**、无 `.replacing-*`/`.removing-*` 事务目录、`tmp/modules` 只剩空目录自身、`modules/installed.json` 无 `hashVerified`/`installedAt`（取消落在 downloading 阶段，发布与写台账都没跑到）。同轮 `fetchIndex` 再过一次 `{ok:true, indexUrl:"http://127.0.0.1:8099/module-index.json", bytes:2452, attempts:1}`、`listInstalled()` 仍 7 条 |
| R6 | 索引与产物一致 | 命令行 `node scripts/build-release.mjs --verify` | ✅ **已过（2026-09-28 我方 CLI 自验，无需游戏）**：未篡改时 `exit=0` 且输出"校验通过：7 个包 / module-index.json 与产物一致"；五类篡改**全部非零退出**——zip 追加字节 `exit=1`（索引摘要与实际不符 b3e38d5f… vs 44152549…）、zip 删条目 `exit=1`（同上，且条目数核对）、index 改 `sha256` 为 `"0".repeat(64)` `exit=1`、index 删条目 `exit=1`（stderr「索引缺少 codename」）、index 改 `size=1` `exit=1`（「索引 size=1 与 zip 实际字节 112079 不符」）。随后 `node scripts/build-release.mjs` 重新生成，zip 与 index 摘要**逐字节回到基线**（顺带再证一次确定性）。脚本 `tmp/r6-tamper.mjs`（不入库） |

**注意事项（P9）**
1. **跨版本解压已在 Node 侧证过**：用本体那份 JSZip（`_virtual/index2.js`，内部 `jszip@2.7.0`）读遍七个产物，条目数全等、根位 `manifest.json` 全在、1285 个条目逐字节一致（探针跑法：`new JSZip()` + `zip.load(ArrayBuffer)` + `asNodeBuffer()`，与我们解压端口的用法一字不差）。真机仍要跑 R0/R3，是因为探针在 Node 里跑，浏览器的 `ArrayBuffer`/`FileReader` 路径与本体 JSZip 的加载时机没有被覆盖。
2. 索引里的 `sha256/size` 取自 **zip 文件本身**；手工重新压 zip（哪怕内容一样）大概率摘要变，`install` 会以 `SHA_MISMATCH` 零落地拒收——这是设计，不是 bug。
3. `module-index.json` 不许手工编辑：`--verify` 会用盘上产物重算并逐字节比对。
4. Core 本轮**不在**索引的可安装列表里（无包形态）；界面上 `core` 行仍显示"核心组件（随扩展发布）"且无按钮，属预期。

### P11 部分（自动更新，必须在游戏内验）

> 已并入矩阵：「§八 P11」

> 前置：现有产物索引里全是 1.4.2 ⇒ 没有"可更新"这回事，所以另外造了一个**演示源**（只动 `tmp/`）：
> `node tmp/make-update-demo.mjs` → 生成 `tmp/update-demo/release/`（`baby-1.4.3.zip` + 索引：**baby 与 core 都标 1.4.3**，其余模块保持 1.4.2）
> → `node tmp/dev-release-server.mjs 8100 --root tmp/update-demo/release` 起服务（8099 仍是正式产物）。测完把模块源地址改回 8099 或留空即可。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| P11-1 | 启动能发现更新并弹窗 | 配置里把「模块源地址」填 `http://127.0.0.1:8100/module-index.json` → **重载游戏** | 进游戏约 1.5 秒后弹出「发现可更新的模块」小窗：一条 `欢乐三国杀样式 1.4.2 → 1.4.3`，一块 `扩展本体 1.4.2 → 1.4.3` + "打开发布页"链接；**其余五个样式包与 card-skin 不该出现**（它们在索引里仍是 1.4.2） |
| P11-2 | 忽略此版本只压这一次 | 点「忽略此版本」→ 再重载一次 | 第二次启动**不再弹**（配置里 `extension_十周年UI-Stars_ignoredUpdates` 变成 `{"baby":"1.4.3","core":"1.4.3"}`）；把索引里 baby 改成 1.4.4 后重载，**又该弹**（忽略的是版本号，不是模块） |
| P11-3 | 提示 → 窗口 → 更新整条链 | 重新弹窗后点「打开模块管理」→ 对 `baby` 点"更新" | 窗口里 `baby` 显示可更新到 1.4.3；点更新走 `downloading→extracting→done`，成功后台账里 `baby.version=1.4.3`；重载后 `modules/baby/1.4.3/` 在、弹出的提示里不再有 baby（`1.4.2` 旧目录应保留、台账记 `previousVersion`——这正是 P12 回滚的地基） |
| P11-4 | 关掉开关就不查 | 配置里关掉「启动时检查模块更新」→ 重载 | 不再弹窗；Network 面板里**没有**对 module-index.json 的请求（离线环境更该如此） |
| P11-5 | 离线/坏索引必须静默 | 模块源地址填 `http://127.0.0.1:9999/nope.json`（没人监听）→ 重载 | 进游戏一切正常、**不弹窗、控制台无红字报错**（5 秒超时后安静收场）；游戏加载不受影响 |

**注意事项（P11）**
1. 提示窗与"欢迎窗口"都在启动后弹（欢迎窗是延时 1 秒、更新提示 1.5 秒）。**若两者同时出现互相遮挡，属体验问题而不是功能错误**——如实记下来，改法是让更新提示等欢迎窗关闭后再弹。
2. 演示源里的 `baby-1.4.3` 只是把 1.4.2 的内容改了版本号，所以更新后的样式表现与 1.4.2 一致（不要期待视觉变化）。
3. Core 那条**只有提示与链接**：点"打开发布页"会开浏览器（Electron 新窗口），不会自动替换正在运行的扩展目录——这是刻意设计。

### P12 部分（自动回退，必须在游戏内验）

> 已并入矩阵：「§八 P12」

> 前置：仓库基线里 `baby` 是 1.4.2 且没有 `previousVersion` ⇒ 先用§八 P11 的演示源把它装成 1.4.3（或手工在台账里补 `previousVersion` 并保留两份目录），再**造损坏**：把 `modules/baby/1.4.3/manifest.json` 改名或删掉。

| # | 目的 | 操作 | 预期 |
|---|---|---|---|
| P12-1 | 自动回退 | 删掉当前版本的 `manifest.json` → **重载游戏** | 启动后弹「已自动修复模块」：`baby：1.4.3 → 1.4.2`；盘上出现 `modules/baby/.corrupt-1.4.3-<随机>/`（原 1.4.3 目录消失）、台账 `version=1.4.2` 且**没有** `previousVersion`；控制台有对应 warn |
| P12-2 | 回退目标也坏时不硬换 | 连上一版的 `manifest.json` 也删掉 → 重载 | 弹「baby：需要重装」；**没有任何目录被改名**、台账不变；模块不可用但游戏照常启动 |
| P12-3 | 无上一版 | 挑一个台账里没有 `previousVersion` 的模块造损坏 → 重载 | 同样提示"需要重装"（原因文案与 P12-2 不同），不动任何文件 |
| P12-4 | **误报为零（最重要）** | 什么都不造 → 重载 | **不弹修复提示**；`modules/` 下没有新增 `.corrupt-*`；台账与目录都不变 —— 健康模块绝不许被动 |

**注意事项（P12）**
1. 造损坏要在游戏**没在跑**时改文件（或改完重载再看）：运行中的页面缓存着旧清单，读得到不代表没坏。
2. `.corrupt-*` 目录留着供诊断，确认不需要了手工删即可；它已被 `localVersions` 排除，不会被当成可用版本参与更新/回退判定。
3. 判据含"清单声明的 entry 文件是否存在"，所以删 `ui/baby.js` 这类入口文件同样会触发回退——想验这一支可以直接删入口文件。

### P13 部分（旧版本迁移，必须在游戏内验）

> 已并入矩阵：「§八 P13」

> 前置：本机同时装着原版 `十周年UI`（单体，113MB）与本扩展。**改完源码要整程序退出 `noname.exe` 再开**（本体的 service worker 在内存里缓存已编译模块，界面内/整窗重载都可能拿到旧 JS——2026-09-29 就是这里白查了一轮）。验卡面那一条要先在旧版 `image/card-skins/` 里放一个**不是内置五套**的文件夹（里面随便丢几张卡图；当前旧版目录里只有 `bingkele/caise/decade/gold/online` 五套内置，不放就验不到"复制"这一支）；只想验"配置残留"那一支时可以只把旧版**停用但保留目录**（别删目录）；想验"自动禁用"就必须真的把它启用着再重载。

| # | 目的 | 操作 | 预期 |
|---|---|---|---|
| P13-1 | 自动禁用 ✅ **已证（2026-09-29 真机，数值见§四"P13 记录"末行）** | 在游戏里把旧版「十周年UI」设为启用 → **整程序退出后重开** | 启动后弹提示窗，出现「这一局界面仍归旧版」与「已关闭旧版 十周年UI」并写明"重载游戏后生效（这一局里旧版还在跑）"；控制台 `lib.config["extension_十周年UI_enable"] === false`；**再重启一次后该行消失、`typeof window.decadeUI.legacyMigration === "function"`**（= Stars 已接管，停用留住了） |
| P13-2 | 按钮式导入 ✅ **写入路径已证（2026-09-29 真机）**；版本号补读为 `d6406d0` 之后新增，界面反馈已浏览器实测 | 先在旧版里改一项（如关闭击杀特效）→ 切到 Stars 启动 → **先什么都不点查配置** → 再点底部「导入旧版设置」 | 没点时 Stars 侧仍是原值；点完 `[旧值, Stars值, 标记]` 从 `[false, true, undefined]` 变 `[false, false, "1.4.2"]`；该行变「已导入 N 项旧版设置」且按钮消失、回执带「（来自旧版 1.4.2）」；**再启动不再提这一条**（`alreadyMigrated` 生效）。已写成 `unknown` 的旧标记不回填、也不要手删——它只是闸门 |
| P13-3 | 卡面自动复制 ✅ **已证（2026-09-29 批1 真机）** | 在旧版 `image/card-skins/` 里放一个非内置的文件夹（如 `我的套/`，几张卡图）→ 整程序重启 | 提示窗出现「已复制玩家自建卡面 1 个」并写明"共 N 张图片…重载游戏后生效"；`extension/十周年UI-Stars/image/card-skins/我的套/` 出现同样的图片；**再重载一次不再提这一条**（同名不覆盖＝幂等）；旧版目录里的文件**一个都没少**。用户验后手工删除两侧文件夹（残件在回收站），故现在查盘为空属正常 |
| P13-4 | **误报为零（最重要）** | 从未装过旧版的环境 → 启动 | **不弹任何迁移提示**；`lib.config` 里没有 `legacyMigratedFrom`；旧键不存在时不写任何东西；`image/card-skins/` 不被新建/写入 |

**注意事项（P13）**
1. 配置导入是**一次性**的：`legacyMigratedFrom` 写下后不再给「导入」条目（旧版被重新启用时仍会自动禁用）。想重看效果就手工删掉 `extension_十周年UI-Stars_legacyMigratedFrom` 再重载。
2. 卡面复制**每次启动都会比对**，但靠"同名不覆盖"自然幂等：玩家若在 Stars 侧删掉某个复制过来的文件夹，下次启动会再复制回来（要永久去掉就从旧版目录里删）。Android/SAF 拿不到 Node fs 时整段静默跳过，不提示也不报错。
3. 只关开关，不删旧扩展的目录（`game.removeExtension` 没接，它连玩家配置/localStorage/导入图一起删，属卸载不是禁用）：旧版 113MB 文件由玩家自己决定去留；旧键也**不清理**——留着是回退依据，Stars 不读它们。
