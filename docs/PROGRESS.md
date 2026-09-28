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
| 当前阶段 | **P9 构建系统模块化完成（代码 / Node 验证，2026-09-28）**：`pnpm build` 现在自动产出 `dist/release/` 下 7 个分包 zip + `module-index.json`，并在同一次运行里做完整校验（`--verify` 可复跑）。索引 url 用相对地址，解析点只在安装器一处。前置 P8 两刀已完成。待游戏内实测；下一步 P10 GitHub Release（§47，发布动作由用户执行）。P5/P6/P8/P9 的真机与游戏内实测统一并入§八收尾清单，不阻塞推进。 |

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

## 四、进行中（当前任务指针）

**当前任务：P9 构建系统模块化 —— 代码完成，待游戏内实测**（`dea6561` 索引相对地址解析 + `d5b8baf` `scripts/build-release.mjs`，详见§四"P9 记录"）。上一阶段 P8 两刀已完成：第一刀 Feature API + `kill-effect` 门控（`b4d8db5`/`8f89e43`/`16c398d` + 修复 `48a82bc`/`d31ab7e`），第二刀 `card-skin` 拆包（`28e1092`/`0e890c7` + §57 兼容修复 `64719f3`）。
下一阶段：**P10 GitHub Release（任务书§47）**——发布结构 Core / Official Style Packs / Feature Packs / Full Package / module-index.json 与"下载链接必须可被客户端解析"。本轮产物已能直接作为上传物；建 Release、传资产、推 tag 由用户执行，我这侧只负责索引与解析正确。
上一阶段 **P6 模块管理界面 —— ✅ 已验收通过（2026-09-27 用户游戏内实测：窗口可开、布局正常、"已独立安装 6"读取正确）**。P5（任务书§42 + §17/§18/§19/§11/§24/§20）已完成：`6c76534` + `f4a69ac` + `df2afea` + `29a69e3` + P6 实测暴露的 fs 锚点修复 `40149bf`；**P5/P6/P8 的 Android/SAF 真机实测并入§八收尾清单，不阻塞推进**。

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
| 门禁 | 182 个 JS/mjs `node --check` ✓；七套测试全过 ✓（含新增 RED→GREEN：平台降级 4 块、门控接线重写）；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓ |

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

### 历史：P3 第一子任务记录：getModuleBase 模块根解析正式实现

- **moduleManager.getInstallState(id)**：返回 `{independent, version, type}`，为模块根解析的**唯一数据源**；`independent` 仅当 `meta.source==="installed"`（P5 安装器写入），内置模块与未知 id 恒为 false；版本取自 Manifest（不设第二版本源）。
- **resourceLoader.getModuleBase(id)**：查询上表 → 独立安装且有版本 → `modules/<id>/<version>/`（core 特例 `core/`）；内置/未知/缺版本 → 回落扩展根；返回值统一以 `/` 结尾（basePath 与模块根职责分离）。
- **调用方**：decadeModule/DynamicPlayer 均经 `getAsset` 走新解析，无绕行；`getAsset/loadJS/loadCSS/loadImage/loadAudio` API 与 loader.js 复用不变。
- **测试**：新增 `tests/p3-resource-loader.test.mjs`（兼容模式/decade/mobile/core 独立根/未知id/version缺失兜底/尾斜杠/§19切换点/真实ModuleManager集成/StyleRuntime委托回归）；测试中还捕获并修复了 basePath 无尾斜杠的拼接缺陷。
- **边界**：零资源移动、未创建 modules/ 目录、未动样式内容与任何调用方 API。

## 四、进行中（当前任务指针）

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

13. **【P9 已消项】构建期 zip 与运行时解压器是否跨版本兼容**：已由一次性探针实测证明**不是问题**——探针用的是本体真正 import 的那份 JSZip（`resources/app/_virtual/index2.js`，内部 `jszip@2.7.0`），`new JSZip()` + `zip.load(ArrayBuffer)` 读遍 `dist/release/` 七个包：条目数 27/1017/32/50/44/70/45 与源目录一致、根位 `manifest.json` 全在、**1285 个条目 `asNodeBuffer()` 逐字节一致**、非 ASCII 条目名 0。所以运行时解压的风险点从来不是格式，而是**取不到那个库**：见下条 16（已修）。仍保留真机首验（§八 R3），因为探针跑在 Node、浏览器 `FileReader`/`ArrayBuffer` 路径未被覆盖。
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
3. **推送**：`git ls-remote origin main` = `1322767`（v1.12 台账，用户已推送；本轮先前三次连不上、第四次成功，已 `git fetch` 同步跟踪引用）。本地领先 2 笔：`5c7b557`（JSZip 获取 + 端口形状 + 能力诚实化）、`6a7f86c`（v1.13 台账），**推送由用户本人执行**。另一份克隆 `extension/decadeUi-Stars` 落后，别在它上面开发。
4. ~~P6 模块市场/管理界面（任务书§43）~~ ✅ 已完成（2026-09-27）：独立窗口 + 纯逻辑行模型 + 模块源配置键；入口 `decadeUI.showModuleManager` / `Ctrl+Shift+M` / 配置窗口按钮。详见§四"P6 记录"。
5. ~~P8 第二刀 card-skin 拆包~~ ✅ 已完成（2026-09-28）：双根寻址、可用性由扫描说话、五套卡面 1016 文件进包。详见§四"P8 card-skin 记录"。
6. ~~P9 模块化构建（任务书§46）~~ ✅ 已完成（2026-09-28，`dea6561`/`d5b8baf`）：`pnpm build` 产出 `dist/release/` 七个分包 zip + `module-index.json` 并完整校验。详见§四"P9 记录"。
7. **下一阶段：P10 GitHub Release（任务书§47）**。产物已可直接上传；发布结构 Core / Official Style Packs / Feature Packs / Full Package / module-index.json，"所有下载链接必须可被客户端解析"这一条要靠§八 P9 部分 R1~R3 在游戏内确认。建 Release、传资产、推 tag 由用户执行；`core.zip` 与 Full Package 若要在§47 里齐，需要先决定 Core 的安装模型（本轮明确没做）。
8. **P7 剩余官方样式包**已随 `33da307` 完成；任务书§44"每完成一个单独 PR"未按字面执行（四包一次提交），验收时按样式逐个切换确认。

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

## 八、项目收尾验证清单（真机 / 游戏内，收尾阶段统一执行）

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

> 前置：先 `pnpm build`（产物在 `dist/release/`，不入库），再用任意可 CORS 的 https/http 源把 `module-index.json` 与 zip 暴露出去（本地最省事：`npx http-server -p 8089` 起在仓库根，模块源地址填 `http://localhost:8089/dist/release/module-index.json`）。以下均为**单行单表达式**。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| R0 | 解压能力自检（**先跑这条**） | `await decadeUI.packageInstaller.ready()`，再看 `decadeUI.packageInstaller.isAvailable()` | `ready()` 应为 `{ok:true, reason:""}`。`isAvailable()` 只说明端口对象在，**不代表**能解压：`5c7b557` 之前真机就卡在这（本体不暴露 `window.JSZip`，旧实现两条获取路全断）。若仍 `ok:false`，请把 `reason` **整段**回贴——`d296f9e` 起它会点名是哪一级（`window.JSZip 不存在或不是 2.x 形状` / `本体未提供 get.zip` / `get.zip 交出的实例不带 2.x 的 load()` / `本体未提供 lib.init.js`），这几种原因的修法完全不同。此时窗口应已把安装/更新/卸载置灰并显示同一原因，而不是让你白下一遍包 |
| R1 | 索引可读且条目齐 | 在模块管理窗口的"模块源地址"填索引 URL → 保存并刷新 | 提示行出现"模块源已连接（索引 schema 1）"；7 个包行（六样式 + `card-skin`）全部出现 `可安装/可更新` 判定；汇总行"可安装 N"不为 0 |
| R2 | **相对 url 解析** | `await decadeUI.packageInstaller.fetchIndex("http://localhost:8089/dist/release/module-index.json")` | `{ok:true, indexUrl:"<你填的那个地址>", index:{…}}`；`index.modules.baby.url` 是 `"baby-1.4.2.zip"`（裸文件名）——界面与安装器必须能把它解析成同目录下的绝对地址 |
| R3 | 真装一个包（含跨版本解压） | 按 §八 D 行用 `dist/release/baby-1.4.2.zip` 走 `install(...)` | `{ok:true, hashVerified:true, requiresReload:true}`；**若报 `STRUCTURE_INVALID`/`ENTRY_MISSING`，说明本体 JSZip 2.7 解不开 jszip 3 写的包**（§五 13），这是本轮最大的未知量，请务必回贴返回对象 |
| R4 | 依赖自动安装（界面首次可达） | 卸载 `card-skin` 后重载 → 在窗口里对 `card-skin` 点"安装" | 进度依次出现「安装依赖 → 下载中 → 落盘 → 解压中 → 校验中 → 发布中 → 写台账」；`dependencies:[core]` 里的 core 已在注册表 ⇒ 不应去下载 core（若出现下载 core 就是依赖判定退化）；成功后行变"已安装" |
| R5 | 取消与残留 | 装一个较大的包（`card-skin`，20MB）过程中点"取消" | `{ok:false, code:"CANCELLED"}`，`tmp/` 无残留、`modules/` 不出现半成品目录、台账未变 |
| R6 | 索引与产物一致 | 命令行 `node scripts/build-release.mjs --verify` | 输出"校验通过：7 个包"且"module-index.json 与产物一致"；故意改动 `dist/release/` 里任一 zip 后再跑，必须**失败退出**（非零码），不许警告着过 |

**注意事项（P9）**
1. **跨版本解压已在 Node 侧证过**：用本体那份 JSZip（`_virtual/index2.js`，内部 `jszip@2.7.0`）读遍七个产物，条目数全等、根位 `manifest.json` 全在、1285 个条目逐字节一致（探针跑法：`new JSZip()` + `zip.load(ArrayBuffer)` + `asNodeBuffer()`，与我们解压端口的用法一字不差）。真机仍要跑 R0/R3，是因为探针在 Node 里跑，浏览器的 `ArrayBuffer`/`FileReader` 路径与本体 JSZip 的加载时机没有被覆盖。
2. 索引里的 `sha256/size` 取自 **zip 文件本身**；手工重新压 zip（哪怕内容一样）大概率摘要变，`install` 会以 `SHA_MISMATCH` 零落地拒收——这是设计，不是 bug。
3. `module-index.json` 不许手工编辑：`--verify` 会用盘上产物重算并逐字节比对。
4. Core 本轮**不在**索引的可安装列表里（无包形态）；界面上 `core` 行仍显示"核心组件（随扩展发布）"且无按钮，属预期。

