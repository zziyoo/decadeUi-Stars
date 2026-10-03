# 十周年UI-Stars 工作进度与交接文档

> 本文档记录工程当前状态，供后续 Agent / 开发者**快速接手**。每次会话结束前必须更新本文档并提交。
>
> 阅读顺序：本文档 → [modularization-audit.md](modularization-audit.md)（P0审计报告）。根 `README.md` 自 2026-10-03（`371fda2`）起是玩家向扩展说明（与 `docs/extension-readme.md`、上游 README 同一 blob）；原「总任务书」正文见 git 历史 `d8150ed:README.md`。

---

## 一、工程概况

| 项目 | 内容 |
|---|---|
| 工程目标 | 将单体"十周年UI"扩展升级为 Core + Style Pack + Feature Pack + Shared Resource 模块化UI平台（按需下载/安装/启停/更新/卸载） |
| Stars 仓库 | https://github.com/zziyoo/decadeUi-Stars （本仓库，**独立开发仓库，已迁入源码**） |
| 原版扩展（玩家在用，不动） | `zziyoo/decadeUi`，本地路径 `C:\Users\32360\Desktop\无名杀-win32-x64\resources\app\extension\十周年UI` |
| 总路线 | P0审计 → P1模块基础设施 → P2公共依赖解耦 → P3十周年Pack → P4移动版Pack → P5下载器 → P6模块管理界面 → P7全部Style → P8 Feature Pack → P9模块化构建 → P10 Release → P11自动更新 → P12回滚 → P13旧版本迁移 → P14全量测试 |
| 当前阶段 | **P14 最终测试（任务书§51 + §52）—— 工具链完成 + 真机批 1、批 2 已跑完并回填**：批 2（P11-2/4/5、P12-1…4、R5 真机取消）全部通过，并**查出并修掉一个自 P3 就存在的硬缺陷**——启动期"已安装的包"注册不过"内置注册"（台账版本 ≠ 本体版本时样式资源根落回扩展根、整套 CSS 一条都不加载），修复 `40f7933` + 新用例 `tests/p14-boot-installed-override.test.mjs`，真机复核已过（`getModuleBase` 指向 `modules/baby/1.4.4/`）。上一阶段 **P13 旧版本迁移** 代码完成、真机 P13-1/P13-2/P13-3 已过，P13-4 本机不可验。**批 3 也已跑完**（卸载前置检查 → 卸载 → 在线重装整链、身份/国战/斗地主、排除模式）；**剩余**：六套逐套目测重点（2026-09-30 boot 读数缺陷修复后，§八 S-1 六条探针真机全符合 ⇒ CSS 加载层已闭环；未取的是边框档位/聊天赠礼位置/死亡特效图）、手机布局与横屏、联网分支（依赖 P10 建好 Release）、Android/SAF 三条本机不可验；产物**已重建并复验**（`pnpm build` + `verify:release` 均 exit=0，连打两次 9 项产物字节与 sha 一字未变 ⇒ `src==dist==release` 同步）。**遗留的复现性风险**：无 `.gitattributes` + `core.autocrlf=true`，一次 checkout 就能改掉分包 zip 的 sha（本次 baby 包 112079 → 112085 字节，内容未变），**P15 代码级收尾也已完成**（2026-09-30：六套切换契约、online/card-skin 卸载判据、传输层与失败分类缺口、浮层 CSS 不变量泛化，套件 18 → 23，`src/` 零改动）。行尾经用户决定**不动**（不影响日常开发）；本轮实测到它的真实代价：一次 `git checkout` 后重构建，`baby-1.4.2.zip` 从 112085 → 112150 字节（内容一字未动，纯 CRLF/LF），所以上传一律以当次 `dist/release/RELEASE-NOTES.md` 的 9 项 sha 为准。**2026-10-01：进入 P10 发布 —— 版本统一 1.5.0（tag 与上游同号、不带 `-stars` 后缀，两个独立发行物靠扩展身份区分），产物已重建且全门禁通过；Stars 自绘的 `Ctrl+Shift+M` 已删（原版已有的 Alt+1~6 / Ctrl+Shift+C / disableBrowserShortcuts 全留）。详见§四「1.5.0 发布」与§六第 14 条。** 2026-10-01 同日续：**Android 真机数据损坏的三刀已落（D2 目录搬运全等校验、D3 损坏判据、D4 应用内「修复」入口），D5 经复核撤销；套件 26 → 28 全绿、`node --check` 236 ✓、`pnpm build`+`verify:release` ✓。**未 push、未发版** —— 手机恢复包要由 CI 单次构建产出（九项资产同源），见§八 S-8 与 README v1.30。2026-10-03：上游 v1.4.2→v1.5.0 同步经独立复核零遗漏、workflow 对齐与产物重建已落，详见文末「上游同步与复核」节。** |

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
| 2026-10-02 | **六套样式专属资源全量热插拔迁移完成**（任务书§一~§十九，详见§四"资源热插拔迁移记录"）：1152 个根资源迁入 `modules/<id>/1.5.0/`（镜像路径；去重 181、冲突 0），六套 manifest 新增 `resources` 边界声明，运行时 10 个文件收口 resourceLoader；**接手会话补掉两处迁移盲点**（player-element off→mobile 身份图、yjcm 皮肤内联 unknown.png 仍指根）并把 p19 §C 加成 C-2/C-3 双扫描（先 RED 反验）；30 套测试全绿、`pnpm build` + `verify:release` + verify-pack 875/越界6/死引用17/缺失0/边界缺失0 全过 | `5544fc8` + 本笔 docs |
| 2026-10-02 | **decade 资源边界补漏**：`manifest.resources` 补 `ui/assets/skill/shizhounian/`（27 个已迁文件漏声明，资源边界未覆盖）；p19 §B 新增**反向完整性检查**（包内实际资源除 manifest.json 与 entry JS/CSS 外必须全部被 resources 覆盖——先 RED 点名 27 项、补声明后 GREEN；六套现均零未声明） | `f18e760` |
| 2026-10-02 | **module-index 两处小修**：①`loadBuiltInIndex` 结构校验加固（schema===1 / modules 拒数组 / core.version / 带尾斜杠 https 的 releaseBase，缺一项即 STRUCTURE_INVALID；旧行为"缺 releaseBase 也算读成功"已作废）；②`verifyAll` 补第三份——三份 module-index（release / dist/modules / modules）逐字节一致（新导出 `verifyIndexCopies`；篡改反验：改开发态索引→`--verify` exit 1 点名→还原 exit 0） | `d98e204` |
| 2026-10-03 | **真机反馈三连收尾**（详见§五 8）：①online 转技/限定技图标 404 修复（`7532ea5`，包路由基址引用的文件未入包；p19 §C-4 扫描）；②手杀"取消按钮"破图修复（`ab89d92`，共享文件 QX.png 被改走包路由；p19 §C-5 扫描）；③**开发态内置索引基址分叉为本机发布源**（`f3288b6`：模块源地址留空即可全本地装卸、脱离 GitHub 旧资产；回环 http 校验豁免；verifyAll 双检） | `ab89d92` + `f3288b6` |
| 2026-10-03 | **移除设置页「模块源地址」入口**（`f7b141f`，用户点名）：本地索引免配置后，本体扩展设置页与自绘配置窗口的该行一并删除（`definitions/misc.js` 定义与注册 + `handlers/module-handlers.js` 整文件 + `config-window.js` 同一行）；运行时保留键与"空值＝内置源"语义，模块管理窗口内仍可改/恢复默认 | `f7b141f` |
| 2026-10-03 | **发布前清理与最终产物**（用户决定：**覆盖 v1.5.0 资产**）：tmp/ 工具目录 57 项全清（探针/审计/放大工具/本地源夹具，本地源进程已停）；最终门禁全过（30 套 / `node --check` 240 / `pnpm build` / `verify:release` / verify-pack 875-6-17-0-0 / verify:skins 37-0）；9 项资产以 `dist/release/RELEASE-NOTES.md` 为准（整包 `5f4a12345137…`、索引 `475b1b6733a4…`、七包 sha 见说明），上传（`gh release upload v1.5.0 … --clobber`）由用户执行 | 本笔 docs |
| 2026-10-03 | **整包 ZIP 结构对齐原版手动打包**（修用户实测「导入时中文根目录乱码」）：`zipFullPackage` 条目名不再拼 `<rootName>/` 前缀、直接等于 `dist/` 相对路径（同原版 `cd dist && zip -r … .` 的结构）；`verifyFullPackage` 根位文件/分包清单/release 检查改按根级路径，并新增「顶层包装」「条目集合逐条==distFiles」两道硬校验；P20 整包段改断「无前缀 + 集合逐条相等 + 无 十周年UI-Stars/ 」并加源码级反回归锁（打包脚本里 `${rootName}` 模板串必须 0 处）、P10 期望表根级化并新增「重加根目录」「条目改名」负例 —— 两侧都先 RED 后 GREEN。GBK 与分包 `zipDir` 一字未动：索引 sha `475b1b6733a4…` 与上版逐字节一致 ⇒ 7 包字节未变；真实整包（3416 文件 / 107,577,136 字节 / 新 sha `1e7cfb6dec42…`）经独立原始字节解析：无 十周年UI-Stars/、无额外顶层包装、条目集合与 dist/ 逐条一致、全 ASCII、本地头=中央目录。**Release 上的整包需以当次说明为准重传** | 本笔 fix(P20) |
| 2026-10-03 | **上游 v1.4.2→v1.5.0 同步（`ee3271f`/`d8150ed`，提交信息为占位 "1"，中间夹过一次 Revert→Reapply 往返）+ 本轮独立复核零遗漏**：窗口法（标签 `v1.4.2..v1.5.0` 共 11 个变更文件逐一对照：5 个字节相同 / 4 个仅身份·键名改造 / 2 个模块化映射且修复在位）+ 全树内容哈希法（上游 3412 文件里 2251 个不同路径 → 2197 个字节相同搬迁 + 54 个改写对应物全部在位），「上游改而 Stars 未动」= 0；`.github/workflows/manual-package.yml` action 版本对齐上游（v5/v6/v5）随本笔补提交；门禁 241/241、31/31、verify:pack 876/6/17/0/0、verify:skins 37/0、`pnpm build` + `verify:release` exit=0；9 项资产以 `dist/release/RELEASE-NOTES.md` 为准（整包 `1924d4b6b7d8…`、索引 `c3a83a033df6…`），**Release 需按当次说明重传** | 本笔 docs + ci |
| 2026-10-03 | **CI 红修复：暗弱卡面图随扩展落根公共 image**（`fc1f712`）：用户报 p19 §F-1 红——`src/styles/card.css` 的 `.handcards.nsanruo`（本体 diy 武将「暗弱/刘璋」态）卡面 `../../../../image/character/ns_liuzhang.jpg` **4 级上溯越过扩展根直引本体游戏图**（上游原样沿用；本机仓库恰在游戏加载目录下 ⇒ 本地恒绿、CI 独立检出必红，与 P14 那次 verify-pack 的"判据把仓库在游戏目录下写进前提"同类）。**判据零改动（用户指令）**：本体图复制为仓库公共 `image/character/ns_liuzhang.jpg`（43,092B / sha256 `14e75b94e0a3…`，未被 .gitignore 命中），引用改 2 级上溯 `../../image/character/ns_liuzhang.jpg`，与同文件其余 4 条同形；viteStaticCopy `image→dist/image` 自动随包（构建实证 `dist/image/character/ns_liuzhang.jpg` sha 与源一致）。全 `src/styles` 55 条 url()/@import 逐条解析（含 image/audio/material/skin 前缀扫描）：本条为唯一越界项，其余 54 条仓库内可达。**复现→验证**：`mktemp` 无本体 worktree 修前复现原报错、修后 §A~§G 全绿 exit=0（worktree 已清）；门禁 check:syntax 241/241、`pnpm test` 31/31、verify:pack 876/6/17/0/0、verify:skins 37/0、`pnpm build` + `verify:release` exit=0（整包 3418 文件 / 107,616,678 字节 / `a0f48f95f73d…`；七包与索引 sha 与上版逐字节一致 ⇒ **Release 侧只有整包需重传**）。注：verify-pack 那 6 条"指向本体(越界)"是**包内** CSS 的既有合法类目（判据已放行），未动 | 本笔 fix |
| 2026-10-03 | **打包面卫生三件**（用户点名的"误打包工作文件"担忧，审计→清理→钉门禁，`3028711`）：①`assets/animation/desktop.ini` 已 `git rm`——基线 `b4a84b7` 随上游带入的 Windows 资源管理器配置（262B，`[LocalizedFileNames]` 点名的三个 `SF_zhuangbeipai_eff_renwangdun02.*` 早已不存在），随 dist、整包与 build-output 分支一路出货（七个分包无同款）；②`modules/installed.json` 去本机痕迹：codename/mobile/yjcm/card-skin 四条删 `installedAt/source/size/sha256/hashVerified` 只留 `version`（mobile 记的 sha/size 与现包早已对不上；运行时注册只读 version，功能零影响）；③部署形态改与整包**同判据剪枝**（新 `scripts/prune-deploy.mjs` 调 `isPackagedFile`）：内部文档（台账/审计/计划/总任务书位 README）与 `release/` 不再进 build-output 分支（此前只删 release/；**已知副作用：根 README.md 随同判据不进分支**，与整包形态一致）。新增 `tests/p22-package-hygiene.test.mjs`（先 RED 于 desktop.ini 后 GREEN）：A 八个整目录复制区+模块版本目录零垃圾文件（desktop.ini/Thumbs.db/.DS_Store/.bak/.tmp/~ 等）；B 剪枝沙盒恰集/保留/幂等 + build.yml 接线断言。门禁：check:syntax 243/243、`pnpm test` **32/32**、verify:pack 876/6/17/0/0、verify:skins 37/0、`pnpm build`+`verify:release` exit=0（整包 3417 文件 / 107,616,177 字节 / `ecc92004bd64…`；七包与索引 sha 未变）；部署剪枝对真实 dist 沙盘实证：剪 14 件（4 内部件 + release/ 10 件）、对外件全留（空目录不进 git 分支）。**Release 侧整包需按当次说明重传** | 本笔 fix |

## 四、进行中（当前任务指针）

**当前任务：样式专属资源全量热插拔迁移 —— 代码/数据/测试/构建全部完成（`5544fc8`），待游戏内目测复测**（六套样式目测确认资源正常；见下节"资源热插拔迁移记录"）。

**历史指针（已过期，保留备查）：P9 构建系统模块化 —— 代码完成，待游戏内实测**（`dea6561` 索引相对地址解析 + `d5b8baf` `scripts/build-release.mjs`，详见§四"P9 记录"）。上一阶段 P8 两刀已完成：第一刀 Feature API + `kill-effect` 门控（`b4d8db5`/`8f89e43`/`16c398d` + 修复 `48a82bc`/`d31ab7e`），第二刀 `card-skin` 拆包（`28e1092`/`0e890c7` + §57 兼容修复 `64719f3`）。
下一阶段：**P10 GitHub Release（任务书§47）**——发布结构 Core / Official Style Packs / Feature Packs / Full Package / module-index.json 与"下载链接必须可被客户端解析"。本轮产物已能直接作为上传物；建 Release、传资产、推 tag 由用户执行，我这侧只负责索引与解析正确。
上一阶段 **P6 模块管理界面 —— ✅ 已验收通过（2026-09-27 用户游戏内实测：窗口可开、布局正常、"已独立安装 6"读取正确）**。P5（任务书§42 + §17/§18/§19/§11/§24/§20）已完成：`6c76534` + `f4a69ac` + `df2afea` + `29a69e3` + P6 实测暴露的 fs 锚点修复 `40149bf`；**P5/P6/P8 的 Android/SAF 真机实测并入§八收尾清单，不阻塞推进**。

### 资源热插拔迁移记录（六套样式专属资源全量入包，2026-10-02，`5544fc8`）

任务书：用户下达的"六套 Style 资源全量热插拔"（审计→归属表→迁移→运行时收口→manifest/构建/校验→测试）。交接文档（会话外，写于上一会话中断时）：`C:\Users\32360\Desktop\交接文档-十周年UI-Stars资源热插拔迁移.md`。

| 项 | 内容 |
|---|---|
| 迁移面 | 1152 个根资源迁入 `modules/<id>/1.5.0/`（镜像路径：包内路径==原根路径）：decade 105、mobile 461、yjcm 179、online 222（含 6 个 xingxiang 改判）、baby 146、codename 46；与包内旧副本去重 181、内容冲突 0（git 侧 971 rename + 181 delete）。六套包内 CSS url() 重写：根引用 552 → 157（余下全部共享/已登记死引用）。13 个搬空后的根目录（`ui/assets/character/{baby,online,xinsha,shousha/*}`、`ui/assets/lbtn/{JSJM,SFTS,OL_line/{jilu,talk}}`、`ui/assets/skill/{baby,codename,shousha/zhuanhuanji}`）已删 |
| 归属判定（共享留根，勿破坏） | ①`image/styles/decade/` 的 identity_/name_/dead_ 三族（on+othersOff(+codename) 经 Core JS 交叉消费）；②Core 常驻 CSS 消费的 decade dialog/button/vs/equip*/shield/card_countbj；③`ui/assets/character/shizhounian/`（decade+codename 共用）、`ui/assets/skill/yijiang/` 的 falu_/starcanxi_（decade+yjcm 共用）；④lbtn 基建 CD/uibutton/OL_line/bg/tips/shoushatip 与 `shousha/{caidan,label}.mp3`、`audio/{game_start,SkillBtn,BtnSure,kill_effect_sound,card_click}.mp3`；⑤死资源（mark_yang、effect_bingsha.*、`image/styles/online/Seat_Dead_0.png`、audio/{Gamepress,gxbtn,XianxianEnter}.mp3 等） |
| 改判/特例 | online 经 `${IMAGE_PATH}../xinsha/` 逃逸消费的 xingxiang0-5 → 归 online 包；`CD/huanfu.mp3` 由共享 lbtn base 为所有皮肤播放 → 归根；decade 皮肤 sortImg（zhengli/zhenglix）→ decade 包 |
| 运行时收口（10 文件） | player-element（身份图 srcMap [模块ID, 前缀]，off→mobile）/ player-group（off→mobile、babysha→baby）/ animations（死亡图三族→包、shousha dead2_→mobile、likai→mobile、共享 decade dead_ 留根）/ skill-state（转换技→mobile）/ skillDisplay（baby 图标）/ skills-animate（手机版开场音频经 getModuleRel 拼 playAudio 相对路径）/ AnimationPlayer（assetResolver 钩子，assets/skeletons 仍按裸名键控）/ gameIntegration（基址=扩展根 + STYLE_OWNED_ANIMATIONS 归属表 + 预加载按安装态过滤）+ 六个包内皮肤 JS（IMAGE_PATH/assetPath 常量改 `window.decadeUI.resource.getAsset`，63 处/13 文件；共享引用刻意不动） |
| 接手会话补盲点 | p19 §C 的同行正则漏"变量间接拼接"，致两处陈旧根路径漏网：①`player-element.js` off 分支仍拼根 `image/styles/shousha/identity2_`（已迁 mobile，装包态下身份图 404 回退文字）→ 移入 srcMap；②`modules/yjcm/1.5.0/ui/character/skins/xinsha.js` 两处内联 `${decadeUIPath}ui/assets/character/xinsha/unknown.png`（已迁 yjcm）→ 改用包内 IMAGE_PATH。p19 §C 加固：C-2 非 decade 的 image/styles 字面量必须与模块 ID/getAsset 配对；C-3 直拼扩展根字面量（含全部包内 UI JS）必须在根上真实可达——两条均先 RED 反验（临时还原修复→点名失败→恢复） |
| Manifest/构建/校验 | 六套 manifest 新增 `resources` 声明（目录级递归覆盖 + 单件）；`manifest.validateManifest` 形状校验 + 纯函数 `findMissingResources`；`verifyPackageDir`（仅只读校验，事务零改动）、`build-release --verify`、`verify-pack` 三处共用同一对账语义 |
| 测试 | 新增 `tests/p19-style-resource-boundary.test.mjs`（A 资源根形状 / B 完整性+归属锚点+Spine 三件套整体归属 / C 绕根清零 + C-2/C-3 / D findMissingResources 语义 / E 根残留扫描+共享例外留根）；改 `p15-style-switch-contract`（删"mobile image=0"错误假设）、`p15-online-uninstall-observability`§6（死亡图边界改随包口径）、`p16-pack-skin-import-url`（补 window.decadeUI.resource 桩，不为迁就测试改回硬拼） |
| 门禁（本笔最终） | 30 套测试全绿；`node --check` 241/241；`pnpm build`（7 包 resources 全可达）→ `verify:release` exit=0；verify-pack 875 可达/越界 6/已知死引用 17/未知缺失 0/资源边界缺失 0；verify:skins 37/0 |
| Android | moduleIo/copyTree/movePath/writeBinary/PackageInstaller 事务与 Android bridge **零改动**（仅 verifyPackageDir 增加只读校验）⇒ 按任务书§十五不需要重做手机测试 |
| 遗留（合法例外，勿顺手清） | 根 `image/styles/decade/`（共享三族+Core CSS 件+5 个死文件）；`ui/utils.js` 两个死代码默认值与 `ui/character/skins/base.js:186` 默认族背景（无调用方，pin"不新增"）；`ui/constants.js` SHOUSHA_CONSTANTS.IMAGE_PATH(_PREFIX)（模块顶层求值约束不能读 decadeUI，实测无消费方，p19 §C 钉死不许被重新消费）；baby CSS 的 `assets/skill/baby/xiandingjihs.png` 与 mobile 皮肤 `${IMAGE_PATH}hidden_image.jpg` 上游笔误死引用保持原样（verify-pack 白名单） |
| 环境清理 | 上一会话遗留的字面量 `$WT` worktree 注册（detached c355394、0 改动，台账 P19 节曾提请下个会话注意）已 `git worktree remove` |

### 1.5.0 发布：版本号与上游同号、tag 去后缀，Stars 自绘快捷键删除（2026-09-30 决定，2026-10-01 执行）

| 项 | 内容 |
|---|---|
| 决定（用户下达） | Stars 与原版**当两个独立发行物发**，不做就地覆盖；版本号统一 `1.5.0`（上游十周年UI 也要发 1.5.0），**靠扩展身份区分、版本号不加后缀** —— 这样玩家反而更容易对上"哪个是哪个" |
| 为什么不能覆盖 | 三条硬事实：①`extension.js` 写死 `${lib.assetURL}extension/十周年UI-Stars/info.json`，覆盖进 `extension/十周年UI/` 后该路径不存在，扩展直接起不来；②`info.json` 的 name 决定配置前缀，name 留 `-Stars` 则玩家旧设置全部读不到，name 改回 `十周年UI` 则 Stars 侧 118 处键字面量与 P13 迁移器全要反转；③`detectLegacy` 第一判据是旧扩展仍在 `installed` 名单里，覆盖后旧目录不在 ⇒ 迁移器根本不触发 |
| 覆盖到底会不会丢东西（盘上比对，脚本已随 tmp 删除） | 原版 3412 文件 / Stars 3673。同名同路径 2313 个里只有 **182** 个内容变了（175 js + 2 css + info/package/lock/README/.gitignore）。「只在原版」的 1099 个里 1016 是卡面图，其余除 **2 个 `.github/workflows/*.yml`（真删，CI 不迁）** 外全部是**搬进 `modules/`** 的同一批资源（`player1-6.css`、`ui/styles/{character,lbtn,skill}/**`、`ui/*/skins/*.js`、`ui/assets/skill/shizhounian/*.png`）⇒ **内容没删，只是换了位置**。残留的五个旧内置卡面文件夹也不会重复出现：动态扫描按文件夹名注册，`registerDynamicSkin` 遇同名内置直接 return |
| bump 改动面 | 7 个 `modules/<id>/1.4.2/` → `1.5.0/`（`git mv`）、7 份 manifest 的 `version` 与 `core`（`>=1.5.0`）、`modules/installed.json` 七条、`info.json`、`build-release.mjs` 的 `releaseTag = v${version}`（去掉 `-stars`） |
| 顺手消掉的 churn | `tests/p14-capability-drift`、`p15-style-switch-contract`、`p15-card-skin-uninstall-roots`、`p16-pack-skin-import-url` 四份用例原本把 `1.4.2` 写死，现改为从 `info.json` 取版本（单一真相）；`p10-release` 把 tag 规则钉成断言 `releaseTag("1.4.2") === "v1.4.2"`，以后再加后缀会红 |
| 钩子清理（用户规则：只删 Stars 比原版多的） | 原版已有 `styleHotkeys.js`（Alt+1~6）、`configWindow.js` 的 `Ctrl+Shift+C`、`disableBrowserShortcuts.js` ⇒ **全部保留**。Stars 自绘的只有 `Ctrl+Shift+M`（`moduleManagerWindow.js` 的 keydown 监听）⇒ 已删；模块管理入口剩「配置窗口 → 模块管理界面 → 打开」（`config-window.js:350`，`type:"button"` 行）与 `decadeUI.showModuleManager()` |
| 产物（当次构建为准） | 整包 `十周年UI-Stars-1.5.0-full.zip` 3596 文件 / 112,113,655 字节 / sha256 `f54917a49f052034e7b9636a5b5f66c268aca20e4500fa726b99d65e3277433f`；`module-index.json` 2510 字节 / `bbefc7853d62913d494a9ad2d7fd8717603b4c4742023b8bb877674d83dbf59f`；七个分包与全部字节/sha 见 `dist/release/RELEASE-NOTES.md`（行尾问题仍在，上传一律以当次这份文件为准） |
| 门禁 | 25 套测试 ✓；`node --check` 230 文件 ✓；`pnpm build` ✓、`verify:release` exit=0 ✓；verify-pack 881/17/0 ✓、check-skin-imports 37/0 ✓；表形审计 ✓ |
| CI 自动打包（同日迁入） | 照上游两套工作流搬并改造：`.github/workflows/build.yml`（push main → 五道门禁 → `pnpm build` → `verify:release` → 把**部署形态**的 `dist/` 推到孤儿分支 `build-output`）与 `manual-package.yml`（`workflow_dispatch` 或 issue 评论 `/package` → 同样门禁 → 把 `dist/release/` 的 9 项资产 + `RELEASE-NOTES.md` 作为**工作流 artifact** 上传，sha256 清单与模块源地址写进运行摘要）。**两处刻意不同**：①原版构建前不跑任何测试，这里把 `check:syntax`/`test`/`verify:pack`/`verify:skins` 全排在构建前，且与本地跑的是同一批脚本；②`dist/release/` 不进 `build-output` 分支（那是 112MB 发布资产，只走 artifact），且 **CI 不建 Release、不动已发布版本** —— 建 Release 仍是人的动作 |
| 新增脚本 | `scripts/run-tests.mjs`（25 套一次跑完，`--import` 传 file:// URL，Windows/Linux 同形）与 `scripts/check-syntax.mjs`（232 个 .js/.mjs 过 `node --check`）；`package.json` 补 `test`/`check:syntax`/`verify:pack`/`verify:skins` 四条入口 |
| 本地已验 | 两条脚本实跑：`232/232`、`25/25` ✓；工作流里的 shell 步骤（版本读取、部署形态四件、9 项资产存在、`dist/release` 计数 10、摘要 sha 表）逐条在本机 Git Bash 跑通，sha 与 `RELEASE-NOTES.md` 一字不差 ✓；YAML 用 `tmp/yaml-shape-check.mjs`（缩进/块标量/重复键）对**原版两份能跑的工作流**做对照，四份全过 ✓ |
| 未做 | Actions 首次真实运行待看（`build-output` 分支部署那段本机执行不了）；Android/SAF 真机；§八 其余待验项 |
| CI 首跑就红的一处真缺陷 | Actions 三次运行（`build` #1/#2、`Manual Package` #1/#2）全在 **Install dependencies** 步 11~20 秒内失败：`[ERR_PNPM_BAD_PACKAGE_JSON] ... Invalid name: "@noname-extension/十周年UI-Stars"`。根因是 `package.json` 的 `name` 带中文 —— npm 的名称规则不允许非 ASCII，本机 pnpm 11.7.0 容忍，CI 按 `version: 11` 解析到 **11.28.3** 就硬拒。**扩展的显示名来自 `info.json`，`package.json` 的 name 全仓无人消费**（grep 过 `pkg.name`/`package.json` 读取点），故改成 ASCII 即可：`@noname-extension/decadeui-stars` |
| 该修复的双向验证 | 在 `tmp/` 造了个只含 `package.json` + `pnpm-lock.yaml` + workspace 的夹具，用**与 CI 同一个 pnpm 11.28.3** 跑 `install --frozen-lockfile`：中文名 → 复现出与 CI 一字不差的错误；ASCII 名 → `Done in 968ms` 通过。夹具已删。改完本机门禁复跑：`node --check` 232/232、25 套全绿、`pnpm build` + `verify:release` exit=0，**整包 sha 未变**（`f54917a49f05…`，`package.json` 不进整包）⇒ 之前给你的 9 项资产数字仍然有效 |
| CI 第二跑红在**检查器自己的布局假设** | Gates 走到 `verify:pack` 报 `可达 875，未知缺失 6`，而本机同一条命令是 `881/0`。那 6 条是包内 CSS 用 `../../image/...` 引**本体游戏目录**的资源（例：`modules/codename/1.5.0/player.css -> ../../image/character/hidden_image.jpg`，本机解析到 `resources/app/image/character/hidden_image.jpg`，248KB 真实存在）。仓库恰好就是游戏加载目录才命中，CI 上没有游戏目录 ⇒ 永远"缺失"。**不是包坏了，是判据把"仓库在 `resources/app/extension/` 下"写进了前提** —— 与我那条 p16 用例同一类错 |
| 该修复的改法与验证 | `verify-pack.mjs` 增加第三类：解析结果**跳出仓库根 ⇒ 判为「指向本体(越界，不入包)」**，按 `relative()` 判定而不是按 `existsSync`，两边结果才一致。改后本机 `可达 875 / 越界 6 / 已知死引用 17 / 未知缺失 0`，**与 CI 的 875 一字对齐**。反向验证：往 `modules/yjcm/1.5.0/player.css` 追加一条不存在的包内引用 → `未知缺失 1` 且脚本 exit 1（Gates 会红），还原后回到 0、`git status` 干净。另核过 `check-skin-imports` 的 37 条引用全部落在仓库内，无同类风险 |
| 口径变更（免得以后数字对不上） | 上面会话记录里历次写的 `verify-pack 881/17/0` 是**旧口径**（把越界引用算进了"可达"）。新口径是 `875 + 越界 6`，说的是同一批引用；历史行不回改，它们记录的是当时那次运行的真实输出 |
| CI 首跑通过（2026-10-01，`ca98d5d`） | `build` #5 与 `Manual Package` #8 均 **success**。`build-output` 分支已由 Actions 生成（顶层 11 项：`extension.js`/`info.json`/`src`/`ui`/`modules`/`image`/`audio`/`assets`/`docs`/`LICENSE`/`README.md`，**没有 `release/`** ⇒ 发布资产只走 artifact 的设计成立），分支提交信息 `Deploy dist from ca98d5d…`。artifact `decadeUi-Stars-1.5.0-release` = 138,312,965 字节，与 9 项资产之和 138,312,381 差 584 字节（zip 目录开销量级）⇒ 数量级对得上；**逐字节核对要把 artifact 下载下来，而下载需要登录，匿名 API 拿不到**，这一条记为"未核" |
| CI 产物逐字节核验（2026-10-01，匿名下载 Release 资产） | 用户先把 artifact 容器整个传成了 `decadeUi-Stars-1.5.0-release.zip`（138,312,965 字节）—— 那个**不能当更新源**（客户端要的是 `module-index.json` 与 7 个分包各自独立成资产）。我把它匿名下回来解包核：**索引里 7 个分包的 `size` 与 `sha256` 与解出来的 zip 逐项一致 ✓**，整包 112,111,168 字节 / `8e2f3420b409f610…` 与 artifact 内那份 `RELEASE-NOTES.md` 一致 ✓ ⇒ **CI 这一套自洽，客户端按索引校验会过**。 |
| 顺带量到的行尾代价（不再是推测） | CI(LF) 与本机构建(CRLF) 的同名资产字节数不同：`baby 111,949 vs 112,150`、`decade 535,263 vs 535,359`、`mobile 1,491,172 vs 1,491,339`、`online 586,995 vs 587,160`、`codename 961,848 vs 962,011`、`yjcm 880,284 vs 880,443`、整包 `112,111,168 vs 112,113,655`；`card-skin` 两边完全相同（21,627,754，纯图片无文本行尾）。⇒ 发布时 **9 项资产必须整体同源**（全用 CI 或全用本机），混用会让索引内嵌的 sha256 对不上、客户端判 `SHA_MISMATCH`。索引本身不写整包 sha，但整包与分包同一次构建才谈得上"同一套" |
| 发布状态核查（2026-10-01，GitHub 匿名 API 只读） | `refs/heads/main` = **`ca98d5d`**（本地与远端同步，工作树干净）。**两处不对**：①远端标签 `v1.5.0` 指向 **`f6b547b`** —— 该提交 `info.json` 仍是 `1.4.2`，且 `00c2485`（boot 样式读数）与 `ce7342f`（皮肤 import）都不是它的祖先 ⇒ GitHub 按标签生成的源码包是"标着 1.5.0 的 1.4.2"，**必须把标签挪到 `149e90d`**；②Release（id 400229824，2026-09-30 16:21Z 发布）**0 资产、标题与说明为空** ⇒ 要填 `dist/release/RELEASE-NOTES.md` 并传那 9 项资产。本地标签 `v1.5.0` 已在正确位置（`149e90d`），**未推送** |
| 发布闭环（2026-10-01 实测，匿名下载 + API 权威数据） | 上面两条都已解决：标签 `v1.5.0` → **`ca98d5d`** ✓；Release 标题 `v1.5.0`、说明 2006 字符、**8 项资产**（索引 + 7 个分包）。**线上自洽性是我实际核过的**：把 `module-index.json`（2510 字节）下回来解析，逐个比对 7 个模块的 `url`/`size`/`sha256` 与 GitHub 给的资产 `digest` —— **7/7 全部一致 ✓**，`core` 版本 1.5.0；另外单独下过 `baby`/`yjcm`/`card-skin` 三个包算 sha256，也与索引一致（顺带纠正我上一轮的一处误读：我曾把**本机 CRLF 构建**的 `7b5e6cb9…` 当成索引值，索引里其实是 `ebe56098…`）。⇒ **§八 S-6 联网回归的前置条件已成立** |
| 发布还差一项 | 整包 `十周年UI-Stars-1.5.0-full.zip`（112,111,168 字节 ≈ 107 MB）**不在资产里** —— 用户说"本身就在"，但 API 列出的 8 项里没有它，判断是网页上传被尺寸上限挡了（社区报告普遍指向 100 MB 量级）。补法：`gh release upload v1.5.0 <整包> --clobber` 走 API。它不影响在线更新（客户端只用索引 + 分包），只影响"整套下载"这条分发路径；临时替代是 `build-output` 分支或 Actions artifact |
| 为什么这两步我没能做完 | 本会话拿不到 GitHub 凭据：`GIT_TERMINAL_PROMPT=0` 下 `git push` 明确报 `could not read Username for 'https://github.com'`（第一次推 main 能成，是凭据助手当时给了缓存），`gh auth status` = 未登录。挪标签与建/传 Release 都要凭据，属你终端的动作（或先 `gh auth login` 再让我接手） |
### 技能按钮点不动：包内皮肤 JS 的动态 import 说明符不可解析（2026-09-30 修复）

| 项 | 内容 |
|---|---|
| 现象（真机） | 用户报「所有样式的技能按钮都不能点击确认发动技能」（截图：濒死提示只剩「取消」）。同时六套的 CSS 探针全绿（探针 2/3 恰好本套 6 份且 `link.sheet` 都 OK）——**界面画对了，行为层缺席** |
| 取证（先证伪再定位） | ①点击链路 `ui/character/skins/base.js:431-445`（`.skillbutton` → `btn.func` → `ui.click.skillbutton`）与**原版逐行一致**，本体侧 `ui.click.skillbutton`（`noname/ui/click/index.js:4445`）、`HTMLDivElement.prototype.listen`（`noname/init/polyfill.js:208`）都在 ⇒ 不是这段搬坏；②`tmp/check-relative-imports.mjs` 扫 230 个 JS 的相对引用：包内 18 份皮肤 JS 上跳 6 层指向根 `ui/*/skins/base.js`、`gskillMixin.js`、`src/ui/skillButtonTooltip.js` **全部可解析**（`check-skin-imports` 也报 37/0）⇒ 不是深度算错；③全仓只有三处动态 `import()`，正是 lbtn/skill/character 三个 UI 插件的皮肤装载点 |
| 根因 | 本体 `noname/util/index.js:2` 是 `const assetURL = "";`，于是 `window.decadeUIPath` 形如 `extension/十周年UI-Stars/`——**没有协议、也没有前导 `./`**（用户早前探针回过的基址正是这个形状）。`ui/{skill,lbtn,character}/skins/index.js` 把 `resourceLoader.getAsset()` 的返回串直接交给 `import()`：`<link href>`/`<script src>` 会按文档基址解析相对串（所以 CSS 全在），而 **ES module 的说明符解析不接受裸名**（浏览器 `Failed to resolve module specifier` / Node `ERR_MODULE_NOT_FOUND`）⇒ 抛错被那三个文件的 try/catch 吞掉并 `return null` ⇒ `src/content.js:131-139` 拿到 null 就什么都不注册 ⇒ 三个插件静默缺席。原版用的是 `./${skinName}.js`（模块自身相对路径），是合法说明符，所以同样的时机不出问题 |
| 修复 | `src/core/resourceLoader.js` 新增 `getModuleUrl(moduleId, path)`：拿 `getAsset` 的原串按 `document.baseURI`（回落 `location.href`）解析成绝对 URL，两者都拿不到时退回原串——**与 `<link href>` 同一套解析规则**，不引入新失败模式。三处皮肤装载的**包分支**改用它；未安装分支仍是 `./${skinName}.js` 不动。`getAsset` 语义一字未改（CSS/图片/脚本仍走相对解析） |
| 用例 | `tests/p16-pack-skin-import-url.test.mjs`：①拿相对基址直接 `import()` 必须抛（复现现场）；②`getModuleUrl` 给带协议的绝对 URL 且**真能 import 到磁盘上的皮肤模块**（断言拿到 `createXinshaSkillPlugin/LbtnPlugin/CharacterPlugin` 三个导出）；③基址已是绝对地址时不二次加工、无基址时退回原串；④静态不变量：三处包分支必须是 `getModuleUrl`、不得残留 `getAsset(...)` 直接喂 import、未安装分支仍是 `./`。RED→GREEN 均验；反向把 lbtn 换回 `getAsset` → 红在「ui/lbtn/skins/index.js 的包分支必须改用 getModuleUrl」 |
| 门禁缺口 | `check-skin-imports`/`verify-pack` 查的是**包内文件自己的相对 import 深度**，查不到「外层动态 import 的说明符是不是合法 ES 说明符」这一层。本用例把这条钉进门禁（套件 24 → 25） |
| 同源的另一条 | 用户同一批回报「**没看到有礼物条、聊天，所有样式都缺失**」——不是第二个缺陷：赠礼按钮由 online 的 **lbtn 皮肤**创建（`modules/online/<版本>/ui/lbtn/skins/online.js` 里 `gift` 出现 23 处），聊天条由移动版 lbtn 皮肤调 `initChatSystem`（`modules/mobile/<版本>/ui/lbtn/skins/shousha.js:382` → `ui/lbtn/chatSystem.js:275`）。lbtn 插件缺席 ⇒ 两块界面自然都不在。同一次修复应一起回来，**复验时一并看** |
| 目测层已确认的 | 用户回报：①等阶边框档位切档正常；③baby/codename 死亡后武将牌上的死亡字样按套有别（在扩展根，未受本缺陷影响）；④Android 留到项目收尾 |
| 真机复核（2026-09-30） | 用户回报「一二均正确」⇒ §八 S-7 **探针 1**（`pluginsMap` 含 `lbtn` 与 `skill`）与**探针 2**（三处皮肤模块动态 import 全 `fulfilled` 且拿到导出名）两条判据在真机成立 —— **插件缺席这一层闭环**，未附原始输出。**行为层同日闭环**：用户回报「其他的手动测试了，均无误」⇒ 点技能能确认发动、online 套聊天条与赠礼都在且位置不压玩家框；`online.md` 启用行与矩阵「视觉目测」行随之转已验 |
### boot 期样式读数缺陷：六套全渲染成十周年套（`2026-09-30` 修复）

| 项 | 内容 |
|---|---|
| 现象（真机） | 用户切到移动版/一将成名后，界面与十周年套几乎没区别（附四张对比图：原版两套明显不同，Stars 两套雷同）。探针给出决定性证据：`document.body.dataset.style` = `"on"` 而 `ui.arena.dataset.newDecadeStyle` = `"othersOff"` —— 同一份配置，两个时刻读出两个值；`link[href]` 里加载的是 `modules/decade/1.4.2/*.css`（六份、规则数 248/37/37/51/40/49，全部加载成功） |
| 排除项（先证伪再定位） | ①包内容搬错/搬重：把六套包内 6 份 CSS 与**原版十周年UI** 的对应单体文件逐行比对（`url()` 归一化后），逐套一致，差异只有被 Core 统一加载的 `@import "animation.css"` 与一行注释，且没有任何一份等于别套原版文件；②包没注册：`getInstallState` 六套全 `independent:true`；③加载器去重撞车：`loader.js:47-49` 的去重键是完整 URL，跨套不互含；④时机问题（我上一轮的错误解释）：原版在**同样的 precontent 时机**读样式并加载 `playerN.css`（原版 `decadeModule.js:95`）却正常 ⇒ 差异不在时机 |
| 根因 | Stars 的模块级读数 `styleRuntime.readRawStyleValue()` 走 `window.lib`，而本体只在开发者模式被打开时才把 `lib` 挂到 window（`noname/library/index.js:1513` 的 `lib.cheat.i()`，以及 `setLibrary` 里 `if (lib.config.dev) window.lib = lib`）。`decadeModule.module.init()` 恰在 precontent 阶段决定加载哪套 CSS ⇒ 读到 `undefined` ⇒ 回落默认 `"on"` ⇒ **自 P3 起六套永远加载十周年套的 CSS**。原版用的是 `import` 进来的 `lib` 绑定，所以不受影响 |
| 修复 | `styleRuntime` 增加 `bindStyleConfigReader(fn)`，`readRawStyleValue()` 取值顺序改为「绑定的取值器 → window.lib 兜底 → undefined」；`precontent.js` 在 `initDecadeModule()` 之前绑 `key => lib.config[key]`（用的是 import 的绑定）。配置键仍只在 `getStyleConfigKey()` 一处拼接，38 处历史读取点语义不变 |
| 用例 | `tests/p15-boot-style-reader.test.mjs`：①不绑定且无 window.lib ⇒ 读不到（复现缺陷现场）；②绑定后读到玩家设置值且能选对包 id；③绑定优先、window.lib 只兜底、可解绑；④静态不变量：`precontent` 里绑定必须早于 `initDecadeModule()`，且绑的必须是 `lib.config[key]`。RED→GREEN 均验；反向把顺序换成 window.lib 优先 → 红在「绑定过就不许再被 window.lib 覆盖」 |
| 真机复核（2026-09-30） | 用户回报「探针 5 正确」→「探针全部正确」，即 §八 S-1 六条判据在真机全部成立：注册状态六套 `independent`、boot 读数与 arena 读数一致、文档里恰好是本套 6 份 CSS 且每条 `link.sheet` 都 OK、资源根与皮肤名各自正确、对局内计算样式指纹按套不同 ⇒ **移动版/一将成名不再与十周年同脸，缺陷闭环**。原始输出未附数值（要存档按§八 S-1 再跑一遍贴回即可）。**仍未取**：逐套目测重点（等阶边框档位、聊天条/赠礼位置、死亡特效图） |
| 受影响的旧账（已标注） | `yjcm.md`/`online.md` 的「启用」行原记 真机通过，判据分别是「边框风格按 `borderStyle` 生效」「聊天条与赠礼出现且位置不压玩家框」—— 那两套 CSS 当时根本没加载，结论**存疑待重取**；`decade.md` 那行恰好是默认套（加载对了），但证据只到状态三值，一并标注。矩阵「六套逐个切换」行只验状态与能力查询，不受影响；「视觉目测」行本就 待办。**2026-09-30 修复后**：CSS 是否加载这一层已由探针 2/3/6 真机确认（本套 6 份全 `OK`、计算样式按套不同），所以那两行维持「待验」的原因只剩**目测判据本身还没单独取**，不再是"CSS 根本没加载" |

### P15 代码级收尾（六套切换契约 / 卸载可观测判据 / 传输层缺口，2026-09-30）

| 项 | 内容 |
|---|---|
| 范围（用户下达） | 只闭环"能在代码/Node 环境完成"的收尾项：①六套样式切换的真实行为与验收口径 ②online 卸载 ③card-skin 双根卸载 ④手机布局/横屏/SAF 代码层检查 ⑤联网分支与失败路径 ⑥产物可重复性确认。**不改架构、不改 reload 生命周期、不动 `.gitattributes`** |
| 新增测试（18 → 23 套） | `p15-style-switch-contract`（切换只写配置并回 `reloadRequired`、映射与内置注册不漂移、六套资源根各自解析、`MIGRATED_STYLE_IDS` 齐全、六套 CSS 与 image 目录指纹互不相同）；`p15-online-uninstall-observability`（真安装器跑 IN_USE 拦截→切走→卸载→台账/目录/注册状态/资源根四项核对 + 置灰理由 + 死亡特效图仍走扩展根）；`p15-card-skin-uninstall-roots`（内置套根随包切换、自建套地址两态一字不变、不可用返回空串、回退目标不可用不许回退、`getModuleRel("card-skin")` 只许一处）；`p15-transport-and-spec-failures`（`xhrTransport` 全事件 + 重试环"退避等待中被取消" + 安装器侧失败分类 + 两条现状钉住）；`p15-overlay-css-invariants`（把只覆盖 updateNotice 的扫描泛化到模块管理窗口，25 类/21 div） |
| 反向验证（每条都注错验过） | 丢 `reloadRequired` → 红；`MIGRATED_STYLE_IDS` 漏 codename → 红；卸载不摘注册表 → 红；`buildSkinUrl` 丢掉包根决策 → 红；`onabort` 把超时混成取消 → **只有新套件红、`p5-installer` 全绿**（证明这层此前从未被测到）；删 `.decade-module-summary` 的 `position` → 红。每次注错后 `git checkout` 还原并复跑为绿 |
| 查出的是**判据错**不是代码错 | online 表里原写「卸载后两个能力同时不可用」**不可观测**：capability 取自注册表清单，卸载当下确实变假，但每次启动 `builtInModules.js:31` 会把 `online-chat/online-gift` 重新声明回来，重启后又是真，而此时该样式一条 CSS 都不加载。已按代码把判据改成 independent/资源根/台账/目录四项，并把这种脱钩钉成断言 |
| `src/` 零改动 | 本轮没有发现需要改生产代码的功能缺陷，故未改一行 `src/`（反向注错都只发生在验证时刻）。手机滚动、横屏、Android SAF 属真机项，代码层能给的结论已写进§五与§八 |
| 门禁 | 207 个 JS/mjs `node --check` ✓；**23 套**测试 ✓；verify-pack 881/17/0、check-skin-imports 37/0 ✓；`pnpm build` + `verify:release` exit=0 ✓（9 项资产与 RELEASE-NOTES 一致） |

### 批2真机查出的硬缺陷：启动期已安装包注册不过内置（`40f7933`）

| 项 | 内容 |
|---|---|
| 现象（真机） | 把 `baby` 更新到 1.4.4 并**完全退出重开**后：`moduleManager.list()` 里 baby 仍是 **1.4.2**，`resourceLoader.getModuleBase("baby")` 返回 `extension/十周年UI-Stars/`（扩展根）；更新提示那行也因此写成 `1.4.2 → 1.4.4` |
| 根因（静态可证） | `getModuleSystem()` 在 `moduleSystem.js:30` 就按**本体版本**把六套样式登记为内置，`registerInstalledModules()` 后到（`precontent.js:32`）；而 `registry.register` 对"同 id 不同版本"是**抛错拒绝**的（注释写明版本切换交由安装器处理——安装器运行时会先 `unregister`，见 `packageInstaller.js:787`）。启动这条路上没有人 unregister ⇒ 内置那份赢，已安装的包**根本没进注册表** |
| 为什么长期没露馅 | 平时台账版本 == 本体版本，走的是"同版本覆盖"分支：注册成功、`independent:true`、资源根正确。只有**装过不同版本号**（更新到新版、或回退到旧版）才撞上——而 P5/P11 的真机验收看的是台账与目录，没看 `list()` 的版本 |
| 影响（比"用了旧版"更糟） | `decadeModule.js:99-100` 只在 `installState.independent` 为真时才读包内 `entry.css`，而六套样式都在 `MIGRATED_STYLE_IDS` 里 ⇒ 走"什么都不加载"那一支，**整套样式的 CSS 一条都不加载**（界面退回裸样式），不是回落到 1.4.2 |
| 修复 | `registerByUrl` 补上安装器那条协议：**先取到并校验清单**，再 `unregister` 内置那份、以 `source:"installed"` 注册，并把内置带来的别名 meta（`styleValue/skin/playerCssIndex`）带过去；清单 404 或校验不过时把内置记录**原样放回**，绝不留"盘上有包而注册表空" |
| 用例 | 新增 `tests/p14-boot-installed-override.test.mjs` 四条：换版本必须赢 / 同版本行为不变 / 404 不许自毁 / 非法清单不许留下空注册表。反向注入"先 unregister 再取清单"已被抓红（Node 里复现出的报错与真机控制台一字不差：`[ModuleRegistry] 模块 baby 已存在（v1.4.2），拒绝注册 v1.4.4`）。18/18 套件绿 |
| 真机复核 | ✅ 2026-09-29 完全重启后探针 `[["1.4.4"],"extension/十周年UI-Stars/modules/baby/1.4.4/","1.4.2"]` |
| 顺带更正的旧账 | §三「P11 记录·真机验收（2026-09-28）」里"重载后弹出的提示里不再有 baby"这一子判据，按本缺陷推论**当时不可能成立**（注册表里一直是 1.4.2、索引 1.4.3 ⇒ 仍会提示）。该行其余结论（台账、sha、两目录并存）有盘上证据，仍然有效 |

### P14 记录（最终测试工具链，任务书§51 + §52，`af8d827` `c8b0c59` `b82b424` `a1483fa`）

| 项 | 内容 |
|---|---|
| 范围（用户批准 2026-09-29） | 只做§51/§52 的**工具链**：整包排除改目录前缀、每模块一份测试表、五类总账矩阵、盘点既有「已做」并补真缺的用例。测试本身由用户分三批在游戏内跑（见§六 item 12）。P14 的完成标准按用户决定＝**工具链完成即算阶段完成**，真机项作为待执行清单交付 |
| 整包排除判据 | `scripts/build-release.mjs` 的 `isPackagedFile(rel)`：精确路径（`README.md` / `docs/PROGRESS.md` / `docs/modularization-audit.md`）+ 目录前缀（`docs/superpowers/`、`tests/`）。原来只有精确路径 Set，新增任何内部文档都会照样打进 112MB 整包、改一个字 churn 一次 sha。**实测**：加完九份文档整包 sha 仍是 `5f301cff5f63…` 未变 |
| §52 九份测试表 | `tests/modules/`：core、decade、mobile、yjcm、online、baby、codename、card-skin（拆包型 Feature）、kill-effect（门控型 Feature）。表头固定五列（项目/判据/层级/结果/证据）；已验过的直接回填证据与日期，没验的标 `待验` —— **不允许空白冒充通过** |
| 表结构静态不变量 | `tests/p14-module-tables.test.mjs`：①表按 `moduleManager.list()` 动态要求（加模块就催表）；②§51「模块」六个动词一行不许省，不适用也要显式写行并给原因（`kill-effect` 是 `pack:false`，安装/卸载/更新/回退本就没有链路，省掉行等于掩盖判据）；③填了结果必须有证据；④`core` 表必须含整包 / module-index / 回退 / 旧版四条判据 |
| §51 五类矩阵 | `tests/modules/P14-matrix.md` 36 行（安装 8 / 模块 12 / 样式 7 / 平台 4 / 游戏模式 5）。一行一条用例，标 `覆盖方式 / 归属 / 状态`。**两条反假绿**：真机项不许写 `已做`（只有用户跑过才写 `已验`）、自动化项不许写 `已验` —— 两种「完成」不许互相冒充。**一条防漏账**：§八 每个小节（通用/P6/P8/P9/P11/P12/P13）都必须被矩阵引用。§八 原表一行没删，矩阵只做总账、不重复抄 procedure |
| 盘点结果（这一步真正的产出） | 逐条把矩阵里 `已做` 对回源码与用例，抓出两处假账：①错误码 `HASH_MISMATCH` 根本不存在（真实是 `SHA_MISMATCH`，见 `packageInstaller` / `downloader`）；②「排除模式不装载 UI 插件」长期挂 `已做` 却**没有任何用例** —— 判断内联在 `content.js:loadUIPlugins()`，而 content.js 一 import 就拉起 DOM/本体依赖链，Node 侧够不着，于是「测不了」被默认成了「已做」。其余 `已做` 都有断言行号支撑（首次安装 p5-installer:520/541/635、重复安装 :676、下载失败 :569/922、校验失败 :556/949、`localVersions` 三种临时前缀过滤 p12-repair:300-309） |
| 补的那条 | 新增纯模块 `src/core/uiMode.js`（`UI_PLUGIN_EXCLUDED_MODES` + `shouldLoadUIPlugins(mode)`），`content.js` 改用同一函数，测试盯住「不许再留第二份内联名单」。**语义零变更**：名单内不装载；取不到模式时保持装载 —— 漏判等于整个 UI 消失，比误判更糟 |
| 反验（四条都红过） | 删 `tests/modules/yjcm.md` → 红「缺表」；结果列写 `OK` → 红「取值非法」；去掉某行的「§八」引用 → 红「漏账」；把 `shouldLoadUIPlugins` 改成恒真 → 红「chess 模式不该装载」 |
| 批 1 真机结果（2026-09-29） | **通过**：六套样式路由与能力查询三值一致（`["decade",false,false,false]` / `["yjcm",true,false,false]` / `["online",false,true,true]`）、卡面五套可用且根指向 `modules/card-skin/1.4.2/`、玩家自建套"丢进去就能用"、P13-3 旧版卡面自动复制。**这一批查出一个 P7 遗留缺陷**（见下一行）。**仍待办**：六套切换的视觉目测（玩家框/边框档位/聊天赠礼位置）、批 2 模块生命周期与 P12 四条、批 3 游戏模式与联网 |
| P7 能力漂移（批1 查出，`4c57f54` 修） | `scripts/migrate-style-packs.mjs:131` 把四个样式的 `capabilities` 一律硬编码成 `["player-frame","lbtn"]` ⇒ yjcm 丢 `border-style`、online 丢 `online-chat`/`online-gift`；清单是发布契约，`build-release.mjs` 原样写进 `module-index.json`，所以**已发布索引一直在对客户端谎报能力**。修复：脚本按样式取声明 + 两份已提交清单补回 + 新增 `tests/p14-capability-drift.test.mjs` 盯「代码声明 = 磁盘清单 = 索引」三处一致（重建前它正是红在索引那条）。**影响面**：`src/` 内无人消费 `hasCapability/getCapability`，故实际功能未坏，属"API 说谎"级 |
| 批 2 真机结果（2026-09-29） | **通过**：P11-2（忽略只压一次；索引切到 1.4.4 后又弹且**没有** Core 块）、P11-4（关掉开关后连续三次启动，演示源访问日志零请求）、P11-5（坏地址静默、无红字）、P12-1…P12-4 四条、R5 真机取消（`tmp/modules/` 无残留、重试即成功且 sha 与 zip 一字不差）。**这一批查出并修复了自 P3 存在的注册覆盖硬缺陷**（见上一小节 `40f7933`）。P12-2 的"当前版 + 上一版都坏"是**我手工铺的夹具**（台账 `previousVersion` 指到演示版 1.4.3、两个 manifest 都删）——被测的是启动期健康检测与修复计划那一段、不经安装器，判据文案直接由 `planRepair` 跑出来核对 |
| 未做 / 待真机 | 真机批 1、批 2、批 3 均已过并回填；`.gitattributes` 经用户决定**不动**（不影响日常开发功能），上传以当次 `RELEASE-NOTES.md` 的 sha 为准；`本机不可验` 三条（Android/SAF 降级、无原子 rename 平台、从未装过旧版的环境）留在§八，不阻塞阶段；§51「中途失败」的真机取消链路已在批 2 过（R5）；六套切换的**视觉目测**仍待办（复测口径已更正：每切一套必须重载，`styleRuntime` 只写配置）、**手机布局与横屏**、**联网分支**（要等 P10 建好 Release）同留收尾 |

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
| 双根形状 | 内置五套的根 = `getModuleRel("card-skin")`（装包→`modules/card-skin/1.5.0/`；未装→扩展根，而单体副本已迁走 ⇒ 扫到空 ⇒ 不可用）；玩家自建文件夹**永远**扫单体根 `image/card-skins/`（"丢进去重启即可用"是原版行为，实测点见§八）。`discoverDynamicSkins()` 与第三方 `window.registerDecadeCardSkin({extensionName,…})`（皮肤根在别人扩展目录）**一字未动** |
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

0. **【已修，待真机复测】D7：卸载把"让位残骸"当成版本再让位一次（2026-10-01 用户手机截图报出）**。截图那行红字是：`名将杀样式：让位 modules/codename/.removing-1.5.0-ssv5jl 失败：[ModuleIo] copy 落盘校验失败: …/fx_ui_fusu03.png → modules/codename/.removing-.removing-1.5.0-ssv5jl-ahfjet/…（先前让位的目录已全部改回原位）`。
   - **读出来的事实**：①**D2 在真机上第一次生效** —— 它抓住了一次不完整的目录复制并拒绝删源，安装器把已让位的目录全部改回，这正是当初销毁四个包的那一步；②让位的**源**是一个 `.removing-*` 目录 ⇒ 卸载把上一次失败留下的残骸当成"在位的版本"又 park 了一次，造出 `.removing-.removing-1.5.0-*`；③汇总行 `本平台发布非原子` 与 `atomicRename:false` 一致，模块源已连上（索引 schema 1）。
   - **根因（口径不对称）**：`desktopListDir` 会跳过 `.`/`_` 开头的条目（`moduleIo.js:161` 的注释甚至写着"与本体 getFileList 一致"），而 **legacy 分支直接把 `game.getFileList` 的结果原样交出，不过滤**。`uninstall` 拿 `io.listDir(modules/<id>)` 的返回当"版本列表"逐个让位（`packageInstaller.js:1027` 旧行号），桌面上看不见这个差异，手机上就暴露了。`localVersions` 早就自己过滤过一遍（说明这个坑已被认识一次），但卸载这条**破坏性**路径没有。
   - **修法（在调用方，不在端口）**：端口里加一个 `isParkedDir`/`versionDirs` 的共用筛子，`uninstall` 与 `localVersions` 都过它；**不改 `listDir` 本身** —— 因为 `copyTree`/`removeTree` 也用它，端口层过滤会让"删掉一个含点开头条目的目录"变成静默漏删（桌面分支其实早就有这个问题，记进§五）。另外卸载成功后把该模块的让位残骸一并清掉：手机上文件管理器进不去 app 私有目录，留下就是永久占位。
   - **测试**：`p5-installer` 新增一节（先 RED：`removedVersions` 实际是 `["1.0.0", ".removing-0.9.0-old"]`，正是真机那条行为的复现），断言四件事——不把残骸当版本、不许出现 `.removing-.removing-`、在位版本被删、残骸被带走。28 套全绿。
   - **还没定案的一半**：那次 `copy 落盘校验失败` 究竟是"真写坏"还是"双层点号路径让 Cordova 写歪了"。倾向后者，因为**同一批 PNG 在前一层 park 时复制成功过**（否则不会有 `.removing-1.5.0-ssv5jl` 留下）。判据是现成的：装上含 D7 的构建后**再卸一次 codename** —— 成功 ⇒ D7 就是那个复制失败的成因；仍在单层 park 上报落盘校验失败 ⇒ 是设备的写不可靠，届时按文件加重试并在超大二进制上退化成"大小+抽样校验 + 明示告警"，不猜。
   - **2026-10-01 当晚更新：上面那个"倾向后者"已被真机否掉。** 装含 D7 的构建后再卸 `mobile`，红字是
     `让位 modules/mobile/1.5.0 失败：[ModuleIo] copy 落盘校验失败: modules/mobile/1.5.0/styles/lbtn.css → modules/mobile/.removing-1.5.0-817ed8/styles/lbtn.css`
     —— **源是正常版本目录、目标只有一层点号前缀、文件是普通 CSS**，仍然失败；`decade` 的「安装」也在发布阶段以同样的方式失败（`tmp/…/border_camp2.png → modules/decade/1.5.0/…`，旧版本已回滚就位）。⇒ D7 修复本身生效（不再出现 `.removing-.removing-`），但**落盘校验失败与路径形状无关，是这台设备的写/读行为问题**，代价是 Android 上所有目录搬运（卸载、同版本覆盖、回退）现在一律被拒。
   - **两个候选根因（一条探针分辨，见§八 S-9）**：①`game.writeFile` 的回调早于真正落盘完成 ⇒ 紧接着的读回必然半截（竞态；若是这样，修法=校验失败时**有界退避重试**，而不是放松校验）；②`readBinary` 对本体 `game.readFile` 返回值类型的归一化有问题（`new Uint8Array(字符串)` 对非 ASCII 会截断长度）——但注意：**这条单独成立不会造成 mismatch**，因为源与目标走同一个读法、错法一致就会相等；所以它只在"两次读法不一致"时才咬人。
   - **①②以及后来自提出的三个假设全部被真机探针否掉（记下来免得重复探）**：①`tmp/` 下单文件写 5600 字节 → 立即读回 `ArrayBuffer` 5600、800ms 后仍 5600 ⇒ 无竞态、读回是二进制；②四用例（普通目录/点开头目录 × 浅/深嵌套 × 文本/20KB 二进制）全部 `等长`、`checkFile=1`、`createDir`/`writeFile` 无错误 ⇒ 点号前缀与嵌套深度都不是变量；③真实文件 `styles/lbtn.css` 的 `fetch`=17751 与端口两次读 17751/17751 一致，400KB 写后两次读回 409600/409600 ⇒ 大小不是变量、读是确定性的；④**完整复刻 copyTree 四步**（读源 → 建目录 → 写 → 读回比对）跑四个文件，全部 `写后源 == 源`、`目标 == 源`、`首个不同 -1` ⇒ 连"buffer 被桥 detach"这个我自己提的假设也死了。
     ⇒ 结论：**手写 `game.*` 探针复现不出来，就不再靠它猜**。改成让真代码自己报数（`4f5f392`）：`copyTree`/`moveFileNonAtomic` 的校验失败消息现在带 `期望 N 字节，实得 M 字节，首个不同 @k(x→y)，本次已复制 K 个文件`，p18 加断言钉住消息形状；下一步是装这个构建后点一次卸载，用那行数字分诊（读不到 / 截断 / 内容改写 / 类型不稳定 四种各有预定修法）。仍未解释的巧合：**两次失败都落在字母序第 3 个文件**（`lbtn.css`、`border_camp2.png`）。
   - **S-9b 的结论（规则层没问题）**：每行按钮的 `[文字, 是否置灰, 理由]` 读回来，除「一将成名样式」= 当前使用（置灰 + 理由正确，原版就有的硬边界）外，**所有安装/卸载按钮都可点** ⇒ 他说的"不能卸载"实际是**点下去失败**，即上面那个校验失败，不是哪条规则误伤。
   - **D7b 定案（2026-10-02，装了带摘要的构建后一次点击就拿到形状）**：真机两条原文——
     `期望 10493 字节，实得 10493 字节，首个不同 @0(137→0)，本次已复制 504 个文件`（卡牌皮肤卸载）、
     `期望 6502 字节，实得 6502 字节，首个不同 @0(47→0)，本次已复制 25 个文件`（yjcm 安装）。
     **长度一模一样、只有首字节变 0**（137=0x89 PNG 签名首字节，47=`/`），而且是在几百个文件都成功之后偶发 ⇒ 既不是截断也不是路径/大小问题，是**设备/桥的间歇性内容缺陷**；`K=504/25` 同时否掉了我先前"每次都死在第 3 个文件"的猜测。另一个我自己的探针盲点也记下：那条 400KB 探针的缓冲区首字节本来就是 0（`i % 251`）且只比长度，所以它天生抓不到这个症状 —— **比"内容"才是比"字节"，比长度只是比长度**。
   - **修法（已落，`copyTree` 与 `moveFileNonAtomic` 共用）**：抽出 `writeAndVerify(rel, buffer, label, tail)` —— 写 → 读回逐字节比 → **不符就重写重试**（3 次，退避 80/200ms），三次都验不过才抛错（消息保留 `期望/实得/首个不同/本次已复制` 并加上"连试 3 次"）。**校验强度一点没降**（仍是逐字节、仍不删源），只是把"偶发坏一次"救回来；重试只发生在"写成功但读回不一致"，写本身报错与源读不到都不重试。`moveFileNonAtomic` 的三处校验（临时目标、备份、提交）与回写旧目标一并换过去。测试：`p18` 新增两例（一次性首字节损坏必须被重写救回、每次都坏则三次后如实失败并保住源）；`p5` 的两处注入从"一次性"改成"连续三次/始终"（一次性损坏现在会被重写救回，那两个用例的语义随之更新，注释写明原因）。
   - **本轮另两处**：①本体扩展设置页加了 `moduleManagerWindow`（`clear:true` 按钮项，onclick 走 `decadeUI.showModuleManager`），做法与原版「打开新版菜单」一字一致，因为手机上没有键盘；②用户回报**手机布局与横屏正常、联网分支正常** ⇒ §八 那两格转已验。

0. **【已定案两条 + 主因待定】Android 卸载样式包后"删不掉也装不回"的死锁（2026-10-01 用户真机报）**。现象：模块管理里点卸载报 `codename 未以独立包形式注册，拒绝删除（避免误删单体资源）`，同时该样式界面像被删（无样式），且没有任何入口能装回来。

   - **用户五条探针得到的事实**（手机 eruda，全部单行表达式）：①注册表 `getInstallState().independent` —— 他点过卸载的四个（`decade/online/baby/codename`）全 `false`，没点过的三个（`yjcm/mobile/card-skin`）全 `true`；②`isAvailable()` = `{available:false, missingIo:false, missingExtractor:false, atomicRename:false, ready:false}`；③`fetch(decadeUIPath+"modules/codename/1.5.0/manifest.json")` = **HTTP 200**；④`verifyInstalled()` 五个模块**全部 `status:"ok"`、`reasons:[]`**（走 io 端口 `game.checkFile/readFile`，即目录与 entry 文件都在、健康）；⑤`fetch` 读的台账与 `readInstalled()` 读的台账**键集合与条目完全一致**（7 条全在，`codename` 两边都是 `{version:"1.5.0"}`）。
   - **被这些事实否定的两个假设**：✗「Android 上 `fetch` 相对路径不可用」（③④都成）；「卸载把目录删了 / 读写不同一」（④说盘上包健康、⑤说两份台账同源）。所以**"样式被删除"是假象**：文件在、台账在，只是注册表里那四个不是 `installed` 来源 ⇒ `decadeModule.js:99-100` 不加载包 CSS、`ui/*/skins/index.js` 走未安装分支去 import 已被搬走的单体皮肤 JS ⇒ 无样式 + 插件缺席。
   - **已定案缺陷一（结构，跨平台）**：行模型的"已安装"来自**台账**（`moduleAdmin.js:161 isInstalled = Boolean(ledgerEntry)`），卸载守卫来自**注册表**（`packageInstaller.js:993` 用 `getInstallState().independent`）。两者一旦分叉 → 行只给「卸载」、卸载必拒、又不给「安装」入口 ⇒ **用户无法自愈**。`verifyInstalled` 其实已经能给出 `action:{kind:"reinstall"}`，但行模型没消费它。
   - **已定案缺陷二（待复核触发条件）**：`isAvailable().available === false` 时，`uninstall` 路径**只检查 `if (!io) NO_IO`，没检查 available**（`packageInstaller.js:971-995`），而窗口侧靠 `installBlocker` 置灰。他手机上 available 已经是 false，却仍出现了"注册表被注销"的后果（`packageInstaller.js:1087` 卸载成功路径会 `registry.unregister(id)`）⇒ 要么置灰没生效，要么 `available` 是在那之后才翻假的。这条要单独定案。
   - **重启差分 = 主因定案**：彻底重启后探针 1 仍是那四个 `false`，控制台四行 `[十周年UI-Stars] 注册模块失败: decade/online/baby/codename（清单校验失败: id 非法: undefined; name 缺失; version 非法: undefined; type 非法: undefined）`。探针 6 是决定性证据：`decade` 的 `manifest.json` 文本长度 **57593**、内容以 `{"0":123,"1":34,"2":48,...}` 开头，而没被卸载过的 `yjcm` 仍是 751 字节合法 JSON。探针 7/8：`game.checkFile` 对不存在的路径返回 `-1`、对存在目录返回 `0` ⇒ 本平台 `kindOf` 的三态映射是对的，"目录不存在"这条排除。
   - **根因（D1，已修）**：`writeBinary` 的 legacy 分支把 `ArrayBuffer` 转成 **`Uint8Array`** 再交给本体 `game.writeFile`（`moduleIo.js:292` → `noname/init/cordova.js:289 fileWriter.write(data)`），而 Cordova 桥对非 `ArrayBuffer` 参数按 **JSON 序列化**传递 ⇒ 落盘的是"字节数组的 JSON"而不是字节。文本写入传字符串，不受影响 ⇒ 所以 `installed.json` 完好、包内文件全废。卸载在非原子平台是 `copyTree` + 删源，"让位 → 回滚"这一对复制把原内容彻底换成了坏内容。修：legacy 分支改传 `ArrayBuffer`（视图按 `byteOffset/byteLength` 切精确长度），桌面分支不变。
   - **测试侧的共犯**：`p5-installer` 的假端口把旧行为写死在夹具里（`bytesOf = value => value instanceof Uint8Array ? value : encode(String(value))`），typed array 被"忠实存下"，所以 Android 分支虽被大量使用却**从未暴露过这个形状**。已把该夹具改成与桥一致（字符串按文本、`ArrayBuffer` 按字节、其余 JSON 化），改完 p5 仍全绿 ⇒ 两个独立夹具互证。新增 `tests/p17-android-binary-write.test.mjs`：先 RED（复现 `{"0":` 形状与内容不符）再 GREEN，覆盖 `writeBinary` 逐字节 + 目录搬运后每个文件保真。
   - **仍未修（已定案，按优先级）**〔立案时原话，处置见下条〕：D2 `copyTree` 对读失败的文件**静默跳过**（`moduleIo.js:333 if (buffer !== null)`）且目录搬运后**不逐字节校验**就删源 ⇒ 复制不全就是永久损坏（`moveFileNonAtomic` 有校验，目录路径没有）；D3 `assessModule` 只在字段"有值但不符"时报错（`moduleHealth.js:43-44`），**字段缺失判 ok** ⇒ 本次损坏健康检查全程看不见，P12 自动回退也不会触发；D4 行模型"已安装"取自台账而卸载守卫取自注册表 ⇒ 分叉即"删不掉也装不回"，`verifyInstalled` 已能给出 `action:{kind:"reinstall"}` 却没被消费；D5 `uninstall` 只查 `!io`，不查 `isAvailable()`。
   - **本轮处置（D2/D3/D4 已修，D5 撤销）**：
     - **D3**（`moduleHealth.js`）：`assessModule` 现在要求清单是**非数组对象**且 `id`/`version`/`name`/`type` 四项齐备（口径取自 `manifest.js` 的 `validateManifest`，也就是 `moduleManager.register` 实际用的那一份——"判 ok"的含义就是"启动时注册得上"，两处各写一套就又回到"台账说装着、注册表不认"那个分叉），缺失即 `corrupt`；并已核对**七个出厂包的清单四项齐备**，收紧不会把健康包误判成损坏。真机那份 57593 字节的 `{"0":123,…}` 恰好是**合法 JSON 对象**，旧判据 `if (manifest.id && ...)` 对"字段不存在"判 ok ⇒ 损坏在 P12 全链路（启动检测→自动回退→界面提示）里全程隐形，`entry` 也因为没有声明而"零缺失"。用例加在 `p12-repair.test.mjs`（先 RED：`bytesJson.ok` 当时为 `true`）。
     - **D2**（`moduleIo.js`）：`copyTree` 改成**逐文件 读 → 写 → 读回 `sameBytes` 比对**，并用 `ensureDir` 先把子目录建出来（空目录不再会在搬运中消失）；读不到或落盘不符**立刻抛错**，于是目录分支的"删源"只可能发生在整棵树被确认之后。新增 `tests/p18-dir-move-verify.test.mjs` 三条注入（`hidden`＝列得出来却 `checkFile` 说不是文件、`truncateOnWrite`＝半截落盘、`failOnWrite`＝回调 Error）都必须在删源前失败；夹具与 p17 合并为 `tests/helpers/fake-android-game.mjs`（共用一份，避免两个夹具各说各话——上一轮 p5 的夹具就是共犯）。
     - **D4**（`moduleAdmin.js` + `moduleManagerWindow.js` + `moduleSystem.js`）：`buildRows` 新入参 `health`。判 corrupt 的行 ⇒ 徽标「已损坏（需修复）」+ 一个**「修复」**动作：`restore` 走 `rollback`（本地改名，**没配模块源也能点**），`reinstall` 走 `install(spec,{force:true})` 且 `spec.expectedVersion` 取**台账版本**而非索引 latest（修复不是顺带升级）；同一行的「卸载」置灰并写明"此刻没以独立包形式注册，卸载会被拒绝"；`installBlocker` 的置灰名单加入 `repair`（它也要落盘）。窗口 `refresh()` 用 `collectHealth()` **并发**探测台账里的每个包（单包查失败只让那一行少个按钮，不许拖垮整窗），汇总行加「待修复 N」，提示行点名 id，启动文案改成"打开「模块管理」点该模块的「修复」"。`p6-module-admin` 加 7 组用例（含"不传 health 时逐字一致"的回归基线），`p18-repair-wiring` 覆盖 `verifyInstalled → buildRows` 的真集成 + 窗口接线的静态断言（本仓没有 DOM 夹具，沿用 p15 那种源码级断言并说明原因）。
     - **D5 撤销，不改代码**：卸载路径不涉及解压能力，`uninstall` 只查 `!io` 是对的（真正保护它的是 D2 的目录校验）。它当初被立案，是因为我把探针 10 的**编排产物**当成了证据——见下条。
   - **我的探针自己错了（记录以免重犯）**：探针 10 写成 `Promise.all([installer.ready(), installer.isAvailable()])`。`isAvailable()` 是同步快照，`Promise.all` 的数组元素在**同一 tick**求值 ⇒ 它必然读在异步探测完成之前，`ready:false / available:false` 是夹具产物。据此我一度立案"D6 探测成功却仍报不可用"，并打算按 TDD 去修一个不存在的缺陷。正确写法是先 `await ready()` 再读快照。顺带下掉一条旧推论：他手机上窗口是按 `moduleManagerWindow.js:133` 的 `await installer.ready()` 判能力的，那次探测返回 `{ok:true}` ⇒ "available 已经 false 却仍执行了 unregister"不成立。
   - **发布影响**：七个分包与索引本身没问题（损坏发生在**用户设备上卸载/更新时**，不在发布物里）；受影响的是 Core 代码，而 Core 随扩展本体分发。整包 `full.zip` 还没上传 ⇒ **等 D1 合入后重新构建再传整包**，别传修复前那份。
0. **【已修复，真机闭环】技能按钮点不动（2026-09-30 用户报，六套皆然）**——根因与修复见§四「技能按钮点不动：包内皮肤 JS 的动态 import 说明符不可解析」。现象：对局内点技能按钮无法确认发动技能（截图里濒死提示只剩「取消」）。已完成的静态取证（**未改任何代码**）：
   - 点击链路 `ui/character/skins/base.js:431-445`（`.skillbutton` → `btn.func = lib.skill[name].clickable` → `btn.listen(ui.click.skillbutton)`）与**原版逐行一致**；本体侧 `ui.click.skillbutton`（`noname/ui/click/index.js:4445`）与 `HTMLDivElement.prototype.listen`（`noname/init/polyfill.js:208`）都在 ⇒ 这一条不是搬坏的；
   - 三个 UI 插件（lbtn/skill/character）由 `src/content.js:112-143` 异步装载，皮肤模块走 `ui/*/skins/index.js` 里的**动态 import**，失败会被 catch 成 `[SkillSkin] 加载失败` 并返回 null ⇒ **插件静默缺席**，表现正是"点了没反应"；
   - `tmp/check-relative-imports.mjs` 扫 212 个 JS 的相对引用：包内 18 份皮肤 JS 上跳 6 层指向根 `ui/*/skins/base.js`、`gskillMixin.js`、`src/ui/skillButtonTooltip.js`，**全部可解析**（唯一 MISSING 是 `moduleIo.js` 注释里提到的本体虚拟模块名，不是真引用）；
   - 定案的正是①：本体 `assetURL` 为空串 ⇒ `decadeUIPath` 是相对串 ⇒ 动态 `import()` 按裸名解析失败 ⇒ 三个 UI 插件静默缺席。已修（`getModuleUrl` 按文档基址解析成绝对 URL）并进门禁用例；剩下的分叉只在真机——探针 1 若仍缺 `skill`/`lbtn`，再查②（点击处理器抛异常）。

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
5. ~~原版仓库的 .github CI 未迁入~~ **已迁入（2026-10-01，1.5.0）**：照上游 `build.yml` + `manual-package.yml` 两套改造，构建前加五道门禁、`dist/release/` 不进部署分支、**CI 不建 Release**（详见§四「CI 自动打包」行）。首次 Actions 真实运行仍待验。
6. **上游漂移风险**：原版仓库（zziyoo/decadeUi）仍在活跃更新，Stars 的迁移快照可能落后。今后同步上游改动时：先 `git -C <原版> log/diff` 确认变更文件，再拷贝并重做键改名转换；禁止直接整目录覆盖（会冲掉 Stars 的模块化改造）。2026-10-03 已按此法完成一次同步（v1.4.2→v1.5.0）并做两层独立复核（零遗漏），见文末「上游同步与复核」节。
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

12. **【P8 card-skin 已知边界，需游戏内实测】内置卡面已不在单体根**：五套卡面搬进 `modules/card-skin/<版本>/` 之后，运行时的可用与否完全由"`installed.json` 有没有登记 + 目录扫得到吗"决定，因此有几个必须实测的点：
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


**P15 代码层检查新增的已知风险（2026-09-30，均未改代码，理由逐条给）**

1. **清单里的 `platform` 字段没有任何消费点**。`manifest.js:65-67` 只校验它是不是数组、`:142` 只给默认值，registry/loader/安装器都不按它过滤 ⇒ 声明 `platform:["desktop","mobile"]` 与实际能否安装无关。属"清单多说了一句话"级，不是功能故障；**要真按平台拦安装会改变现有行为，需用户决定**，故本轮只记录不动。
2. **`welcomeDialog.css` 的四个 div 类没有 `position`**，靠 `welcomeDialog.js` 写内联 style 兜住。它不用 `el()` 建 DOM，所以不在 `p15-overlay-css-invariants` 的扫描适用范围内（该测试头部已明写"不假装扫到了"）。风险：改类名或去掉内联 style 就会被本体 `div{position:absolute}` 拖走。
3. **15 个浮层 div 类裸 `transition`**（更新提示窗 4 个、模块管理窗口 11 个，清单由 `p15-overlay-css-invariants` 每次打印）。本体 `transition:all .5s` 对它们都生效，但"会不会真动起来"取决于插入后有无尺寸/位置变化 —— 已实测到的一例（`.decade-update-repair` 第一帧 height 0 再半秒滑开）当时补了 `transition:none`，其余**没有实测证据就不批量改**，留给真机目测决定。
4. **三处 `overflow-y:auto` 滚动区未接本体的触摸滚动**（`module-manager-window.css:129/304`、`updateNotice.css:72`；正面例是 `welcomeDialog.js:258` 与本体 `create.js:128-133`）。桌面滚轮无碍，**手机上能否滚到底必须真机验**（§八 已列），不在代码层猜改。
5. **Android 无 Node fs 时安装器是"部分可用"**：`moduleIo.js:130` 缺 fs 就整体落到 `game.*` 那套（`:218-254`）、`atomicRename:false`，台账提交有备份+回读+还原（`packageInstaller.js:306-370`），读坏走 `INSTALLED_CORRAPT` 拒覆盖 —— 目录发布仍非原子，UI 也如实提示。**未写坏台账**；但 `legacyWrite` 把 `Uint8Array` 交给 cordova `FileWriter.write`（只认 ArrayBuffer/Blob）这一条**无法在本机验证**，属真机风险。
7. **`styleRuntime.activate()` 在 `src/` 内零调用者**（界面切样式走 `appearance-handlers.js:33-41` 与 `styleHotkeys.js:29-36`，两者都自己 `saveConfig` + `game.reload()`）。它带的 `reloadRequired` 只是 API 契约，`p15-style-switch-contract` 钉的就是这个契约 —— **不许再拿它解释「玩家切了没生效」**，我上一轮就是这么错的。要么以后让界面统一走它，要么保持现状，两者不能混着说。
6. **两条现状被测试钉住而非修改**：`fetchIndex` 对"顶层是数组"的索引会放行（`typeof parsed === "object"` 判不住数组），下游取不到条目才失败；`resolveModuleUrl("../x.zip", …)` 会解析到同 host 的上级路径而不被拒（索引本身是信任根、绝对地址本来就允许，故不扩大能力）。将来收紧时这两条断言会红，逼着同步判据。

8. **【已定案 + 已恢复】"卸载后重装六个样式全部失败（SHA256 不符）"——根因是"内置索引与下载源不同源"，2026-10-03 用户 PC 报出**。原文：`codename: SHA256 与外部期望值不符：期望 6e448d5754eb…，实际 169c0a032250…`。
   - **取证（读盘 + 台账三方对照）**：期望值 `6e448d…` = **本机本次构建**的 codename 包（56 文件 / 1,421,567 字节，含迁移后资源）；实际值 `169c0a…` = **线上 Release 里迁移前的旧资产**（961,848 字节；`installed.json` 的 HEAD 基线里 10-01 那次成功安装记录就是它）。本目录（= 游戏加载目录）每次 `pnpm build` 都会把"内置默认模块源"`modules/module-index.json` 的 sha 换成**本机**构建值，而其 `releaseBase` 指向 GitHub 的 v1.5.0 ⇒ 下载到线上旧包必然对不上；`card-skin` 纯图片、迁移前后字节一致，所以唯独它能装回来（用户观察完全吻合）。
   - **处置**：①盘上恢复——六个包目录 `git -c core.autocrlf=false checkout` 逐字节还原（decade 142 / mobile 471 / yjcm 182 / online 232 / baby 156 / codename 56 文件），`installed.json` **定点补回**六条 `{version:"1.5.0"}`（保留 card-skin 的真实安装记录，未整文件 checkout）；②`pnpm build` 重建（codename 不变 `6e448d…`；decade/mobile/online/yjcm 因恢复时行尾归一换了新 sha：`aa749625…`/`b849572a…`/`b18ea8f1…`/`e42b68c3…`，以当次构建为准）；③（2026-10-03 起免配置）装包测试**不用再填地址**：开发态内置索引 `modules/module-index.json` 的 `releaseBase` 已分叉为本机发布源 `http://127.0.0.1:8099/`（`DEV_RELEASE_BASE`，构建期自动写入，环境变量可换端口），模块源地址**留空**即全本地装卸；只需跑 `tmp/start-dev-source.bat`（或 `node tmp/dev-release-server.mjs 8099`）——索引与 zip 同一次本机构建，sha 天然一致，`pnpm build` 后无需重启服务（发布源两份仍为 GitHub 基址，两者由 verifyAll 分别校验）；要恢复"线上源可装"必须把 v1.5.0 资产整体重传为与当前构建**同源**的一套（连同整包 full.zip）——发布纪律：9 项资产必须整体同源（§四 1.5.0 发布"行尾代价"一条的坑在真实客户端发作）。
   - **另记一：online 的"阴阳转换技样式出错"已定案并修复**（2026-10-03 用户更正口径；`fix(online)` 一笔）：`modules/online/1.5.0/ui/skill/skins/online.js` 的 `ASSETS_PATH` 被迁移改写到**包内**，但它动态拼接的 `skillitem_yinyang_1/2.png` 与 `skillitem_xianding_active.png` 三个文件按旧表留在了扩展根 ⇒ 技能按钮上的阴阳小图标/限定技图标全部 404（迁移期 DYNAMIC_REFS 对 `_${imgType === "yang" ? "1" : "2"}` 这类动态拼名失明；`ui/assets/skill/online/` 的目录注释写着"被 yjcm CSS + online JS 消费 → 留根"，但只落实了文件不动、没落实引用基址分叉）。修法：`_1/_2`（仅 online.js 消费）`git mv` 进包 + manifest.resources 声明；`xianding_active`（yjcm 的 styles/skill.css 也引用，属"共享留根"）保持根目录、online.js 三处引用改走根基址 `SHARED_ASSETS_PATH`。**p19 §C 新增 C-4 扫描**（包内 UI JS 经包路由基址拼的资源必须在包内可达；动态段按三元字面量枚举候选），先 RED（点名 `online.js:247`）后 GREEN；全六套复扫零缺失。
   - **另记二：手杀"取消按钮"破图已定案并修复**（8x 放大图 + 读码命中）：`modules/mobile/1.5.0/ui/lbtn/skins/shousha.js` 把取消按钮的 `<img>` 改成了**包路由** `getAsset('mobile','ui/assets/lbtn/uibutton/QX.png')`，而 QX.png 是共享文件（uibutton 基建，刻意留扩展根、不在包内）→ 必然 404（截图里那个 broken-image 图标）。修法：改回该皮肤已有的根基址 `assetPath`。**p19 §C 新增 C-5 扫描**（字面量 `getAsset(id, 静态路径)` 必须在对应包内可达；共享文件不得走 getAsset），先 RED 点名后 GREEN；全仓 16 处内联 getAsset 复扫仅此一处破。

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
14. **P10 发布（2026-10-01，1.5.0）**：产物已按 1.5.0 重建并全门禁通过，tag 规则改为**与上游同号**（`v1.5.0`，不带 `-stars`）。上传清单与 sha 以 `dist/release/RELEASE-NOTES.md` 为准；模块源地址发布后填 `https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.5.0/module-index.json`。**上面第 7 条里的 `v1.4.2-stars` 与 1.4.2 资产名已作废，以本条为准**（保留原文是为留住决定过程）。另：本机 `modules/installed.json` 已随 bump 指到 1.5.0，磁盘目录同步改名，无需重装。
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
   - **2026-10-01 新增（决定设计的一条事实）**：他手机上系统文件管理器看到的 `extension/` 目录**是空的、也不可写/可删**（无名杀的扩展装在 app 私有目录，SAF 不暴露）。 ⇒ 一切"手工改 `installed.json` / 手工删坏目录"的恢复方案在 Android 上都不成立，**应用内的「修复」入口是唯一的自愈通道**（D4 由"应该做"升级为"必须做"，见§四本轮处置）。装新 Core 走他自己的路子：QQ 收到 zip →「用其他应用打开」→ 由 QQ 解压到 `extension/`。
   - **`io.listDir` 两条分支口径不同（D7 的成因，本轮只在调用方防住，端口未改）**：桌面 `desktopListDir` 主动跳过 `.`/`_` 开头的条目，legacy 分支把 `game.getFileList` 的结果原样返回。凡是"按版本枚举目录"的调用方都必须自己过滤（`versionDirs`）；反过来 `copyTree`/`removeTree` 依赖 `listDir` 拿全量 ⇒ **桌面分支现在删不掉含点开头条目的目录**（会静默漏删，`removeTree` 之后 `kind` 仍报 dir）。这条本轮没动（没有真机证据说它咬到过谁），留作 Android 收尾项。

### P6 部分（模块管理界面，UI 层必须在游戏内验）

> 已并入矩阵：「§八 P6」

| # | 目的 | 操作 | 预期 |
|---|---|---|---|
| I | 入口可达 | 配置窗口（`Ctrl+Shift+C`，原版就有）→「模块管理界面 → 打开」；或控制台 `decadeUI.showModuleManager()`。**Stars 自绘的 `Ctrl+Shift+M` 已于 1.5.0 删除** | 三种入口都能打开窗口；标题"模块管理"，汇总行形如"共 9 个模块 · 已独立安装 7 · 可更新 0 · 可安装 0"（注册表 = core + 六样式 + `kill-effect` + `card-skin`；`card-skin` 已进 `installed.json`，所以"已独立安装"从 6 变 7）；窗口不遮挡操作、可滚动 |
| J | 离线语义 | 不填模块源地址直接看列表 | 六个样式包显示"已安装"；`core` 显示"核心组件（随扩展发布）"且无按钮；模块源提示"未配置模块源"；"可更新/可安装"计数为 0（不误报） |
| K | 卸载边界（§19） | 当前样式为十周年时，看十周年行的"卸载" | 按钮置灰，悬停提示"正在使用中，请先切换到其他样式再卸载"；被别的模块依赖的行提示"被以下模块依赖…" |
| L | 卸载 → 重载 → 重装回路 | 切到移动版并重载 → 在窗口里对十周年执行"卸载"（需点两次：第一次变"确认卸载"）→ 点"重载游戏"→ 回到窗口 | 卸载后该行变"未安装"，`modules/decade/1.4.2/` 消失且 `modules/installed.json` 不含 decade；十周年样式不可用而其他样式正常；有索引时该行出现"安装" |
| M | 进度与取消 | 填一个**允许跨域**的索引地址后点安装 → 中途点"取消" | 进度按阶段推进（下载中/解压中/写台账）；取消后结果条显示"已取消"，`tmp/` 无残留，台账不变 |
| N | 二次确认与重载按钮 | 直接点"重载游戏" | 第一次只变"确认重载"，再点才真的刷新页面；4 秒不动自动复原 |
| O | 窗口与对局共存 | 对局中从配置窗口按钮打开/关闭（1.5.0 起无快捷键） | 不报错、不卡死；关闭窗口（× 或点遮罩）后游戏可继续操作 |

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
> → `node tmp/update-demo-server.mjs --port 8100 [--kbps 12]` 起服务（`--kbps` 只对 `.zip` 分段限速：12 KB/s 下 112KB 约 8 秒，够点「取消」；一律 `Cache-Control: no-store`，否则索引被缓存会把"版本一变又该弹"判成假失败；访问写 `tmp/update-demo/access.log`，"关掉开关就不查"这条由日志的**零请求窗口**裁定）。测完把模块源地址改回正式产物或留空即可。

| # | 目的 | 指令 / 操作 | 预期 |
|---|---|---|---|
| P11-1 | 启动能发现更新并弹窗 | 配置里把「模块源地址」填 `http://127.0.0.1:8100/module-index.json` → **重载游戏** | 进游戏约 1.5 秒后弹出「发现可更新的模块」小窗：一条 `欢乐三国杀样式 1.4.2 → 1.4.3`，一块 `扩展本体 1.4.2 → 1.4.3` + "打开发布页"链接；**其余五个样式包与 card-skin 不该出现**（它们在索引里仍是 1.4.2） |
| P11-2 | 忽略此版本只压这一次 | 点「忽略此版本」→ 再重载一次 | 第二次启动**不再弹**（配置里 `extension_十周年UI-Stars_ignoredUpdates` 变成 `{"baby":"1.4.3","core":"1.4.3"}`）；把索引里 baby 改成 1.4.4 后重载，**又该弹**（忽略的是版本号，不是模块） |
| P11-3 | 提示 → 窗口 → 更新整条链 | 重新弹窗后点「打开模块管理」→ 对 `baby` 点"更新" | 窗口里 `baby` 显示可更新到 1.4.3；点更新走 `downloading→extracting→done`，成功后台账里 `baby.version=1.4.3`；重载后 `modules/baby/1.4.3/` 在、弹出的提示里不再有 baby（`1.4.2` 旧目录应保留、台账记 `previousVersion`——这正是 P12 回滚的地基） |
| P11-4 | 关掉开关就不查 | 配置里关掉「启动时检查模块更新」→ 重载 | 不再弹窗；Network 面板里**没有**对 module-index.json 的请求（离线环境更该如此） |
| P11-5 | 离线/坏索引必须静默 | 模块源地址填 `http://127.0.0.1:9999/nope.json`（没人监听）→ 重载 | 进游戏一切正常、**不弹窗、控制台无红字报错**（5 秒超时后安静收场）；游戏加载不受影响 |

**结果（2026-09-29 批2 真机）**：P11-1 / P11-3 ✅ 2026-09-28（P11-3 的一个子判据后被 `40f7933` 推翻，见§四更正）；P11-2 ✅（点忽略后不弹，索引切 1.4.4 后**又弹**且只有一行、无「扩展本体」块 ⇒ 忽略记的是版本号）；P11-4 ✅（关开关后连续三次启动，演示源日志里那个窗口**零请求**；开着开关时同样本、同地址有请求，构成差分）；P11-5 ✅（`127.0.0.1:9999/nope.json` 不弹、控制台无红字）。

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

**结果（2026-09-29 批2 真机，跑在 baby 上）**：P12-1 ✅（弹 `baby：1.4.3 → 1.4.2`、盘上留 `.corrupt-1.4.3-2o3jnp`、原 1.4.3 目录让位、台账 `previousVersion` 被清）；P12-2 ✅（`需要重装`，原因含「上一版 1.4.3 也不可用：manifest.json 缺失」，**无目录改名**、台账一字未动——夹具由我手工铺，不经安装器）；P12-3 ✅（原因文案分岔为「没有记录上一版本」，与 P12-2 不同）；P12-4 ✅（什么都不造 ⇒ 不弹修复、`modules/` 无新增 `.corrupt-*`、台账不变）。其余五套样式与 card-skin 的「回退」行走的是同一条 `registerInstalledModules` 分支，未逐套造损，表里按代理验证如实标注。

**注意事项（P12）**
1. 造损坏要在游戏**没在跑**时改文件（或改完重载再看）：运行中的页面缓存着旧清单，读得到不代表没坏。
2. `.corrupt-*` 目录留着供诊断，确认不需要了手工删即可；它已被 `localVersions` 排除，不会被当成可用版本参与更新/回退判定。
3. 判据含"清单声明的 entry 文件是否存在"，所以删 `ui/baby.js` 这类入口文件同样会触发回退——想验这一支可以直接删入口文件。

### 批3 结果（模块生命周期 / 游戏模式 / 样式目测，2026-09-30）

| # | 目的 | 判据（按代码更正过） | 结果 |
|---|---|---|---|
| B3-1 | 使用中的样式不许卸 | **UI 侧置灰**：当前样式那行「卸载」按钮 `disabled`，`title` 给「正在使用中，请先切换到其他样式再卸载」（`moduleAdmin.js:214` → `moduleManagerWindow.js:210`）。安装器的 `IN_USE` 报错是第二道防线，只有走 API/force 才碰得到 —— 我原先写的"点一下会弹红字"判据是**错层**了 | ✅ 通过（截图：Online 标「当前使用」，其卸载键为灰） |
| B3-2 | 卸载整链 | 切走 → 卸载 → `modules/baby/1.4.2/` 清空、台账 `baby` 行消失、Core 其余功能不受影响；无 `.removing-*` 残留 | ✅ 通过（盘上我核对后已 `git checkout` 还原，27 文件、`verify:release` exit=0） |
| B3-3 | 重装（在线索引） | 台账 `baby={version:"1.4.4",sha256:"e9d784…",hashVerified:true}` 且**无** `previousVersion`；`tmp/modules/` 无残留；`getModuleBase("baby")` 以 `modules/baby/1.4.4/` 结尾 | ✅ 通过 |
| B3-4 | 游戏模式 | 身份 / 国战 / 斗地主 各进一次：无红字、按钮不双份、切模式不残留上一模式的 hook | ✅ 通过 |
| B3-5 | 排除模式 | 自走棋 / 塔防 / 炉石类：十周年 UI 不装载、不报错 | ✅ 通过 |
| B3-6 | 六套切换的视觉目测 | 那一眼不作数（没量到「文档里加载了哪几份 CSS」）。**当时写的「根因是没重载」已作废**：界面切样式走 `appearance-handlers.js:33-41` 与 `styleHotkeys.js:29-36`，两条都 `saveConfig` + `game.reload()`；`styleRuntime.activate()` 的 `reloadRequired` 只是 API 契约，`src/` 内零调用者。已排除的一种猜测：包内容没有重复（六套 CSS 与 image 目录指纹两两不同，mobile 0 图纯 CSS） | ⏸ 移入项目收尾（用户同意）；复测按§八 S-1 的三条探针 |
| B3-7 | 手机布局与横屏 | 无溢出、不串版 | ⏸ 移入项目收尾（用户选做） |
| B3-8 | 联网分支（§八 P9） | 真实 GitHub Release 地址解析索引 | ⛔ 依赖 P10 建好 Release 与上传资产，届后才能验 |


### P15 复测步骤（六套目测 / online 与 card-skin 卸载 / 手机与联网，2026-09-30）

> 这几条是**代码层已确认、必须真机收尾**的项。判据都按源码核过，不再写不可观测的话。

| # | 目的 | 操作 | 判据 |
|---|---|---|---|
| S-1 | 六套逐套视觉目测 | 配置 → 外观 → 整体外观 → 切换样式 → 选一套（**菜单自己会重启**：`onNewDecadeStyleClick` 里 `game.reload()`；电脑端也可 Alt+1~6）→ 重启后跑下面六条探针；六套各来一遍。别在对局中切（reload 会丢本局） | 见下方「S-1 探针」与「逐套该看到什么」两张表；核心判据是**文档里恰好只有该套的 6 份 CSS、且每份 `link.sheet` 都不为 null**，再目测玩家框/手牌按钮/技能栏/等阶边框/聊天赠礼位置。**2026-09-30：六条探针真机全符合（用户回报，未附数值）⇒ CSS 加载层闭环；目测重点仍未取** |
| S-2 | online 卸载（更正后的判据） | 先切到别的样式 → 模块管理里卸载 online → 重载 | 台账无 `online` 行、`modules/online/` 目录清空、无 `.removing-*` 残留；`getModuleRel("online")` 为空串 ⇒ **该样式一条 CSS 都不加载**（不是"退回旧版"）；Core 其余功能正常。**不要拿 capability 当判据**（重启后内置声明会把它变回真） |
| S-3 | card-skin 卸载（双根） | 模块管理里卸载 card-skin → 重载 | 内置五套在下拉里消失/置灰且卡面走本体默认；**玩家自己丢进 `image/card-skins/` 的文件夹必须仍然可用**；再装回来两套都能出图 |
| S-4 | 手机布局与横屏 | 手机（或 `phonelayout` 开 + 横竖屏各一次）打开模块管理与更新提示窗 | 三处 `overflow-y:auto` 列表能滚到底（触摸滚动）、按钮不被裁切、短屏不溢出、横屏不串版 |
| S-5 | Android / SAF | Android 上装/卸/回退各一次，并中途杀进程再启 | 不写坏台账（读坏会拒覆盖）、非原子发布的中断能被下一次启动纠正、UI 如实提示"本平台发布非原子" |
| S-6 | 联网分支（依赖 P10） | 等正式 Release 建好、9 项资产传上去后，把模块源地址填成真实 `…/releases/download/<tag>/module-index.json` → 重载 | 模块管理列出可安装/可更新项、下载与 SHA 校验通过、客户端能装上。**当前不能验，也不许写成已验** |
| S-7 | 技能按钮点不动：修复后复核（2026-09-30 根因已修，见§四同名小节） | 进一局，让技能按钮出现（自己回合内），F12 控制台依次跑下面三条；然后**点一次技能按钮**，把控制台新出现的红字整段抄回 | 见本节末「S-7 三条探针」。**修复生效的硬判据是探针 1 的 `pluginsMap` 里含 `lbtn` 与 `skill`**（修复前必缺），随后点技能按钮应能确认发动 |
| S-8 | Android 已损坏包的恢复 + D1/D2/D3/D4 的真机验收（2026-10-01 **改写**：原方案"用文件管理器删 `installed.json` 里那四条"在他手机上不成立——扩展装在 app 私有目录，文件管理器看到的 `extension/` 是空的，既看不见也改不了） | ① 把含 D1（`2d8bb14`）+ 本轮 D2/D3/D4 的整包 zip 用 QQ 发到手机 →「用其他应用打开」解压覆盖到无名杀 `extension/` → 彻底退出再进；② 配置窗口 →「模块管理界面 → 打开」，看汇总行与各行状态；③ 若 `decade/online/baby/codename` 显示「已损坏（需修复）」⇒ 点该行**「修复」**⇒ 跑探针 A；④ 点窗口上方「重载游戏」 | 三条硬判据：**(a)** 探针 A 的 `manifest.json` 文本长度回到 **751 量级**且以 `{"schema": 1` 开头（不再是 57593 字节的 `{"0":123,...}`）——**D1** 在真机上的验收，Node 夹具绿不等于手机上的桥行为变了；**(b)** 探针 1 七个包 `independent` 全 `true`（`moduleManager.list().length` 回到 9）；**(c)** 汇总行「已独立安装 7」且**没有**「待修复 N」，切到这四个样式能看到各自 CSS 与皮肤插件回来——**(c) 一次同时验 D3（检测得到）、D4（点得动）、D2（搬运不再毁数据）**。任一步与预期不符，把那一步的原文（报错行 / 汇总行 / 探针输出）整段抄回 |
| S-8b | 修复入口的两条分支（S-8 走完再测；这轮之前界面根本没有这条路） | 手机上打开模块管理：①找一个**健康**的包（`yjcm`）看它行上**没有**「修复」、卸载仍可点；②跑探针 B 看当前样式 id，把正在使用的那个样式若显示损坏则确认「修复」能点亮 | 判据：①`yjcm` 行徽标不是「已损坏」、`actions` 里无 `repair`——**没有 health 输入或判 ok 时行必须与从前逐字一致**（p6 里有这条回归）；②使用中的样式一旦损坏也要能给「修复」，因为 `restore` 分支不查 `IN_USE`（修复优先、重载后生效，与 `rollback` 的既有约定一致） |
| S-8b-1 | ✅ **PC 真机已验（2026-10-01 用户截图三张）**：夹具 = 台账加一条指向不存在目录的 `demo-corrupt:{version:"0.0.1"}` + 把 `modules/baby/1.5.0` **改名**成 `.corrupt-1.5.0-drill`（不删） | 看三处：启动提示窗、汇总行/提示行、两行的按钮状态 | 全部与预测一致：①提示窗标题 **「发现需要修复的模块」**（不是"已自动修复"——`kind:"reinstall"` 什么都没修，这条文案是我本轮改的 `7db8065`，真机现形）+ 两行 `baby/demo-corrupt：需要重装`，原因写着"包目录不存在：modules/…；没有记录上一版本"；②汇总行 `共 10 个模块 · 已独立安装 8 · … · **待修复 2**`，提示行 `模块源已连接（索引 schema 1）；已损坏 2 个（baby、demo-corrupt）：点该行的「修复」`；③**两条分支各自点亮/置灰**：`baby`（索引里有、带 url）⇒「修复」点亮为主按钮、「卸载」置灰；`demo-corrupt`（索引里没这个 id）⇒「修复」**置灰**、meta 显示"未知 · 未声明 Core 要求"。⇒ D3（损坏看得见）+ D4（修复入口按 verifyInstalled 的计划分流）在真机上成立。**尚未验**：点下 baby 的「修复」之后是否真能装回来（下一格） |
| S-8b-2 | ✅ **PC 真机已验（2026-10-01 用户回报"baby 下载回来了"）**：「修复」按下去真能把包装回来（D4 的后半 + 安装链在真机上的一次闭环） | 在 S-8b-1 的状态下点 `baby` 行的「修复」⇒ 看进度条走完 ⇒ 点右上角「重载游戏」⇒ 再开窗口 | 判据：下载阶段有百分比、结束提示"已安装…（需重载游戏生效）"；重载后 `baby` 行回到「已安装 1.5.0」、汇总行「待修复」只剩 1（`demo-corrupt`）；切到 baby 样式能看到 CSS 与皮肤回来。跑完把 `modules/baby/.corrupt-1.5.0-drill` 删掉（演练目录，不是玩家数据） |
| S-9a | 分辨 Android 上"copy 落盘校验失败"到底是**写没落盘**还是**读法不一致**（D7b 定案；不修好它，手机上卸载/更新/回退全部不可用） | 手机上 eruda 跑下面这条（它只往 `tmp/` 写一个探针文件并自己删掉；探针里不含竖线，免得粘进表格断列）：`(async()=>{const dir='extension/十周年UI-Stars/tmp',name='probe-d2.txt',text='ABCDEFGHIJ0123456789-中文-'.repeat(200);const bytes=new TextEncoder().encode(text);await new Promise((ok,err)=>game.writeFile(bytes.buffer,dir,name,r=>r instanceof Error?err(r):ok()));const sizeOf=d=>d instanceof ArrayBuffer?d.byteLength:ArrayBuffer.isView(d)?d.byteLength:typeof d==='string'?d.length:-1;const rd=async()=>{const d=await new Promise((ok,err)=>game.readFile(dir+'/'+name,ok,err));return[d&&d.constructor?d.constructor.name:typeof d,sizeOf(d)];};const one=await rd();await new Promise(r=>setTimeout(r,800));const two=await rd();console.log(JSON.stringify(['应写',bytes.length,'立即',one[0],one[1],'800ms',two[0],two[1]]));await new Promise(ok=>game.removeFile(dir+'/'+name,ok));})().catch(e=>console.log('探针失败',e.message))` | 三种读法各自对应一种修法：①**立即读到的长度 < 应写、800ms 后 == 应写** ⇒ `game.writeFile` 的回调早于落盘完成（竞态）⇒ 校验要带**有界退避重试**，绝不放松校验本身；②两次长度都 == 应写但 constructor 是 `String` ⇒ 读法把二进制当文本，`readBinary` 的归一化要按类型分支处理（源与目标同错会互相掩盖，所以这条要连内容首字节一起看）；③两次都 < 应写 ⇒ 设备写真的会截断 ⇒ 按文件重试 + 失败明确拒绝。报 `探针失败` 的话把消息整段抄回（`tmp/` 不存在也算一种结果） |
| S-9b | "仅剩两个样式时不允许卸载"是哪条规则挡的（不猜） | 模块管理窗口开着的状态下跑：`JSON.stringify([...document.querySelectorAll('.decade-module-row')].map(r=>[r.querySelector('.decade-module-name')?.textContent,r.querySelector('.decade-module-badge')?.textContent,[...r.querySelectorAll('.decade-module-btn')].map(x=>[x.textContent,x.disabled,x.title===undefined?'':x.title])]))` | 判据：每行第三项是 `[按钮文字, 是否置灰, 置灰理由]`。置灰理由只可能来自四种：使用中 / 被依赖 / 包已损坏 / 平台不支持。抄回来对号，不改代码先定性质 |

**S-1 探针**（每套切换、游戏自动重启后各跑一次；六条都是单行单表达式，不依赖 `ui`/`lib` 全局是否可见。写法约束：粘进控制台前不折行，串与串之间只允许 ASCII 空格，不用裸 `||` 与换行——真机踩过被截断成 `SyntaxError`）：

1. **状态三值（探针 1）**
   `JSON.stringify([document.body.dataset.style, document.querySelector('#arena')?.dataset.newDecadeStyle, document.querySelector('#arena')?.dataset.decadeLayout])`
   判据：前两项都等于该套配置值（`on`/`off`/`othersOff`/`onlineUI`/`babysha`/`codename`）；第三项**只有移动版是 `"off"`**、其余五套是 `"on"`（名单在 `appearance-handlers.js:51-52`，与 `styleRuntime.js:38` 的 `DECADE_LAYOUT_STYLE_VALUES` 同口径）。
2. **文档里到底加载了哪几份包 CSS（探针 2，这条是关键）**
   `JSON.stringify([...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.getAttribute('href') ?? '').filter(h=>h.indexOf('/modules/')>=0))`
   判据：必须**恰好**是该套 6 份 —— `player.css`、`styles/character.css`、`styles/lbtn.css`、`styles/skill.css`、`styles/lbtn-window.css`、`styles/skill-window.css`，前缀 `modules/<该套id>/1.5.0/`（1.5.0 起；bump 版本后这里要跟着改）。**出现别套 id ⇒ 上一套残留；一条都没有 ⇒ 该套 CSS 根本没加载**（"看着像默认样式"的确切原因）。已知例外：开着 `phonelayout` 时 `decadeModule.js:131` 会刻意跳过两份 `-window.css`，条数应为 4。
3. **这 6 份是否真加载成功（探针 3）**
   `JSON.stringify([...document.querySelectorAll('link[rel=stylesheet]')].filter(l=>(l.getAttribute('href') ?? '').indexOf('/modules/')>=0).map(l=>[l.getAttribute('href').split('/').slice(-2).join('/'), l.sheet?'OK':'未加载']))`
   判据：每项都是 `"OK"`。出现 `"未加载"` 表示 `link.sheet === null`（CSS 请求失败），不必再靠眼睛判断像不像。
4. **资源根与皮肤名（探针 4，可选佐证）**
   `JSON.stringify([window.decadeUI.style.id, window.decadeUI.style.skin, window.decadeUI.resource.getModuleRel(window.decadeUI.style.id)])`
   判据：依次是该套 id、皮肤名（`shizhounian`/`shousha`/`xinsha`/`online`/`baby`/`codename`）、`modules/<id>/1.5.0/`。

**内容层取证（2026-09-30，Node 里做的，不需要真机）**：把每套包内 6 份 CSS 与**原版十周年UI** 的对应单体文件逐行比对（只把 `url(...)` 的路径归一化为文件名），结论是——

- 六套的 `player.css` 与各自 `playerN.css`（原版 42758/33001/50122/37822/38799/36576 字节）逐行一致，唯一差异是原版那句 `@import "animation.css"` 被搬到 Core 统一加载（`decadeModule.js` 里 `this.css(CORE, "src/styles/animation.css")`）；
- `styles/{character,lbtn,skill,lbtn-window,skill-window}.css` 同样与各自原版一致，差异只有新增的说明注释；**没有任何一份等于别套的原版文件**（跨套串内容这条已排除）；
- 六套包内 CSS 与 `image/` 目录指纹两两不同（`p15-style-switch-contract` 第 5 节，已进套件）。

所以「所有样式几乎一样」不是搬运错了内容。当时列了两种可能（包没注册 / 比较场景看不到差异），**两条都被探针否定了**：`getInstallState` 六套全 `independent:true`，而探针 1 暴露出第三种、也是真正的原因 —— boot 期样式读数回落默认套（见§四「boot 期样式读数缺陷」小节，已修）。

**5. 注册状态探针（探针 5，先跑这条，它能一分为二）**：
`JSON.stringify(["decade","mobile","yjcm","online","baby","codename"].map(id=>[id, window.decadeUI?.moduleManager?.getInstallState?.(id) ?? "无API"]))`
判据：六项都应 `independent:true` 且 `version:"1.4.2"`。若全 `false` ⇒ 走①，去查 `registerInstalledModules` 为什么没成功（控制台会有一行 `[十周年UI-Stars] 注册模块失败：…`）。

**6. 对局内计算样式指纹（探针 6，进一局再跑，用来客观回答"两套真的一样吗"）**：
`JSON.stringify([...document.querySelectorAll("#arena .player")].slice(0,2).map(p=>{var s=getComputedStyle(p);return [p.className, s.width, s.height, s.borderImageSource.slice(0,60), s.backgroundImage.slice(0,60)]}))`
判据：不同套的 width/边框/背景图应不同。若探针 2 有 6 条 CSS 而探针 6 六套完全相同 ⇒ 才是真的选择器没命中（搬运/改写问题），届时按这条开新一轮排查。

**逐套该看到什么**：

| 套 | 配置值 / 快捷键 | 目测重点 |
|---|---|---|
| 十周年 | `on` / Alt+1 | 基准套：金框玩家框、手牌按钮、技能栏；`decadeLayout=on` |
| 移动版 | `off` / Alt+2 | **唯一 `decadeLayout=off`** 的那套，布局明显不同、无叠印 |
| 一将成名 | `othersOff` / Alt+3 | 红龙风格武将框；配置「等阶边框」一~五阶/随机改的是 `#arena[data-border-level]`（`appearance-handlers.js:113-126`），切档后边框档位要跟着变 |
| online | `onlineUI` / Alt+4 | 聊天气泡 `.chat-bubble` 与赠礼按钮 `.gift/.giftbg/.giftcost…`（`modules/online/1.5.0/styles/lbtn.css`）位置正确、不溢出 |
| 欢乐三国杀 | `babysha` / Alt+5 | 玩家框与技能按钮；死亡特效取 `image/styles/baby/dead3_*.png`（**扩展根**，卸掉样式包也不该坏） |
| 名将杀 | `codename` / Alt+6 | 玩家框；死亡特效 `image/styles/codename/dead_*.png` |

> 六套 CSS 与图片内容互不相同这点已在 Node 里按文件指纹核过（`p15-style-switch-contract` 第 5 节）。所以目测仍"两套一模一样"时，请按探针 2／3 取证据 —— 那是**没加载或加载错**，不是包重复。

**S-7 三条探针**（技能按钮点不动的定位；都是单行单表达式，第二条走 `console.log`，跑完等一下看打印）：

1. `JSON.stringify(Object.keys(window.app?.pluginsMap ?? {}))`
   判据：必须含 `lbtn` 与 `skill`（`character` 可被配置 `characterPlugin` 关掉，缺它不算异常）。**缺 `skill`/`lbtn` ⇒ 皮肤模块的动态 import 失败、插件静默缺席**（catch 见 `ui/skill/skins/index.js:41`），这就是"点了没反应"的直接成因，再看第 2 条报什么。
2. `Promise.allSettled(["skill","lbtn","character"].map(k=>import(window.decadeUIPath+"modules/"+window.decadeUI.style.id+"/1.5.0/ui/"+k+"/skins/"+window.decadeUI.style.skin+".js"))).then(r=>console.log(JSON.stringify(r.map(x=>[x.status, x.reason?.message ?? Object.keys(x.value)]))))`
   判据：三项都 `fulfilled` 且第二项是导出名数组。任何 `rejected` 的 message 就是根因（404 / `Failed to resolve module specifier` / MIME 不符）。
3. `JSON.stringify([window.decadeUI.style.id, window.decadeUI.style.skin, window.decadeUIPath, window.lib?.config?.touchscreen ?? "lib不可见"])`
   判据：前两项是第 2 条拼路径用的当前套与皮肤名；`decadeUIPath` 必须是**带协议的绝对地址**（若是 `extension/...` 这种相对串，动态 `import()` 会按裸模块名直接失败，而 `<link>`/`<script>` 不会 —— 这正好解释"CSS 全在、插件却缺席"）；末项若为 `true`，按钮绑的是 `touchend` 而非 `click`（`ui/skill/skins/base.js:75`），是另一条独立成因。

**S-8 探针六条 A–F**（Android 恢复与修复入口；都是单行、只读、带 `.catch` 或 `.then` 收口，不留未捕获 rejection）：
A. `fetch(decadeUIPath+"modules/decade/1.5.0/manifest.json").then(r=>r.text()).then(t=>console.log(JSON.stringify(["decade清单",t.length,t.slice(0,18)]))).catch(e=>console.log("A失败",e.message))`
   判据：第二项回到 **751 量级**、第三项以 `{"schema": 1` 开头。修复成功前它是 `57593` + `{"0":123,"1":34,"2":`——那串数字就是被 Cordova 桥 JSON 化的小端字节数组（D1）。**这条是 D1 的真机验收**，Node 夹具替代不了。
B. `JSON.stringify([window.decadeUI?.style?.id??null,window.decadeUI?.moduleManager?.list?.().map(m=>[m.id,(window.decadeUI.moduleManager.getInstallState(m.id)||{}).independent??null])??-1])`
   判据：第二项是 **9** 条（core + 六样式 + kill-effect + card-skin），七个包位全 `true`；`core`/`kill-effect` 这类内置项为 `false` 属正常（它们不是独立安装）。`-1` 或条数不足 ⇒ 列表源本身没起来，先别测修复按钮。第一项给的是"当前使用中的样式 id"，用来对照 S-8b 的第②步。

C. `decadeUI.packageInstaller.verifyInstalled("decade").then(r=>console.log(JSON.stringify([r.ok,r.status??r.code,r.action??null,r.previousVersion??null,r.reasons??r.message]))).catch(e=>console.log("C失败",e.message))`
   判据：`action.kind` 决定「修复」走哪条分支 —— `reinstall` 需要模块源（见 E），`restore` 不联网也能点。`r.ok===false` 时第二项是错误码（`NO_IO`/`NOT_INSTALLED`/`IO_FAILED`…），原文抄回。

D. `(async()=>{const r=await decadeUI.packageInstaller.ready();return JSON.stringify(["ready",r,"再问available",decadeUI.packageInstaller.isAvailable()])})().then(s=>console.log(s)).catch(e=>console.log("D失败",e.message))`
   判据：`ready.ok===true` 且快照 `ready:true / available:true`。**这条是上一轮那条探针的修正版** —— 原先写成 `Promise.all([ready(), isAvailable()])`，同步快照必然读在异步探测之前，`ready:false` 是夹具产物（见§四"我的探针自己错了"）。`atomicRename:false` 顺带证明数据来自 legacy `game.*` 端口（Android），不是桌面。

E. `JSON.stringify((window.lib?.config?.["extension_十周年UI-Stars_moduleIndexUrl"]||"").slice(0,80))`
   判据：非空。键名从 `moduleManagerWindow.js:51 indexKey()` 读出来的，不是猜的。空 ⇒ `reinstall` 分支没有下载地址，先在窗口工具栏填 `https://github.com/zziyoo/decadeUi-Stars/releases/download/v1.5.0/module-index.json`。

F. **手机上装的 Core 是哪一笔**（恢复动作是 QQ 的解压做的，装修复前的整包也会得到同样的健康状态 ⇒ 光看 A/B/C 证明不了代码已修）
   ~~`Promise.all([...])` 用 `ArrayBuffer.isView(data)` 当 D1 标记~~ —— **这条探针我自己写错了，已被真机否掉**：`ArrayBuffer.isView(data)` 在 `readBinary` 里早就有（`moduleIo.js:287`），任何版本都会命中，所以它**根本没有区分力**；而真机输出里 D1 位却是空的、D2 位有值，这两件事在任何一份仓库版本里都不同时成立 ⇒ 那次读取不可信，改用下面这条按**字节长度 + 尾部原文**判的探针（长度能同时区分版本与"响应被截断"，尾部原文用来证明确实读到了文件末尾）。
   `Promise.all(["src/core/moduleIo.js","src/core/moduleHealth.js","src/core/moduleAdmin.js"].map(p=>fetch(decadeUIPath+p+"?ts="+Date.now(),{cache:"no-store"}).then(r=>r.text()).then(t=>[p.split("/").pop(),t.length,t.includes("Cordova 桥对非 ArrayBuffer 的")?"D1":"-",t.includes("copy 落盘校验失败")?"D2":"-",t.includes("name 字段")?"D3b":"-",t.includes("repairAction")?"D4":"-",t.slice(-16)]))).then(a=>console.log(JSON.stringify(a))).catch(e=>console.log("F2失败",e.message))`
   判据（长度取自 `git show <sha>:<path> | wc -c`，而工作树上这三个文件的磁盘大小与 blob **完全相等**（都是 LF），所以本地打包与 CI 构建出的长度同一张表）：
   | 文件 | 长度 | 对应提交 |
   |---|---|---|
   | `moduleIo.js` | 32776 | ≤ `ddf0170`（无 D2） |
   | `moduleIo.js` | 34301 | ≥ `1d90488`（含 D2） |
   | `moduleHealth.js` | 4147 | < `ddf0170`（无 D3） |
   | `moduleHealth.js` | 5124 | `ddf0170`…`19709fe`（D3 初版，只查 id/version） |
   | `moduleHealth.js` | 5907 | = `2c023f1`（D3 续，补齐 name/type） |
   | `moduleAdmin.js` | 13528 | < `a04b895`（**没有 D4 修复入口**） |
   | `moduleAdmin.js` | 16473 | ≥ `a04b895`（含 D4） |
   D1 用 `Cordova 桥对非 ArrayBuffer 的` 判（`git show da4d1f8` 计数 0、`2d8bb14` 起计数 1 —— 这次是先验证过区分力才写的）。尾部原文若不是文件真正的最后 16 字节 ⇒ 响应被截断，长度与标记一律作废重读。

**S-8 真机回填（2026-10-01，用户手机 eruda 原文）**：A `["decade清单",623,"{\n\t\"schema\": 1,\n\t\""]`；B `["mobile",[[core,false],[decade,true],[mobile,true],[yjcm,true],[online,true],[baby,true],[codename,true],[kill-effect,false],[card-skin,true]]]`；C `[true,"ok",null,null,[]]`；D `["ready",{ok:true,reason:""},"再问available",{available:true,missingIo:false,missingExtractor:false,atomicRename:false,ready:true}]`；E `""`。

- **读法与核对**：623 不是"接近 751"，而是**出厂包内 `decade/1.5.0/manifest.json` 的 LF 字节数**——我本地工作树那份被 autocrlf smudge 成 637（差 14 个行尾），同一条比例在 `yjcm` 上再次对上（手机 751 / 本地 763，差 12）。加上头部是真实制表符与换行、B 里七个包 `independent` 全 `true`、C 判 `ok` ⇒ 盘上就是发布物本体，**`{"0":123,…}` 那种 JSON 化字节数组已消失 ⇒ D1 真机闭环**（不是"Node 绿了就当验过"）。D 的 `atomicRename:false` 确认这一组数据来自 Android（legacy `game.*` 端口），`available:true`  ⇒ 解压能力在，安装/修复通道不会因为能力缺失被置灰。
- **仍不能由这批数据下的结论（如实记）**：①**手机上现在装的是哪一笔 Core 没被证明**——恢复动作是 QQ 的解压做的，装的是修复前的整包也会得到同样的健康状态，所以 D2/D3/D4 三刀**都没有在真机上走到**（包现在是好的，健康检查判 `ok`，界面上根本不会出现「已损坏」徽标与「修复」按钮）。要确认 Core 里有没有这三刀的代码，看源码标记探针（下一条）。②`E` 为空 ⇒ 模块源没填，`reinstall` 分支点不动；将来真坏了只剩"重新解压"这条手工路。③D2 的"半截复制不许删源"只有**同版本覆盖/更新**那一条路会经过 `copyTree`+`removeTree`，卸载→重装走不到那一支。
- **远端事实（匿名 API 核实，2026-10-01）**：`origin/main` = `2c023f1`（committer ziyoo，07:40:02Z）⇒ 本轮五笔已 push。CI 在这个 sha 上两条都 success：`build` run 36832725230（07:50Z）、`Manual Package` run 36833226844（07:55Z）——**含 D2/D3/D4 的整包 artifact 已经在这个 run 里**，取它就行，不必重跑；已发布的 1.5.0 分包与索引本轮没动，`修复`/`安装` 下载仍指向它们。
- **探针 F 第一次读数（同日）**：`[["moduleIo.js",["D2"]],["moduleHealth.js",["D3"]],["moduleAdmin.js",[]]]`。
  - ~~能定的：`moduleAdmin.js` 里没有 `repairAction` ⇒ 那台机器**没有 D4 的修复入口**~~ —— **这条已被推翻**，原因见下面"判据表也是错的"：`repairAction` 是被压缩改掉的函数名，字符串字面量才在 bundle 里存活。按 `dist` 的 `t.length` 重算后三个数字与手机一位不差 ⇒ 那台机器**有** D4。
  - **不能定的**：D1 位是空的这件事，与仓库里任何一份 `moduleIo.js` 都对不上（`ArrayBuffer.isView(data)` 在改动之前就存在于 `readBinary`，任何版本都会命中）⇒ 不是"手机上是旧代码"，是**我这条探针没有区分力**，同时不排除响应被截断。按长度表重读一次（F2）才能把"哪一笔构建"钉下来。
  - **这条 F2 的判据表也是错的，已用真机读数反掉**（同日）：手机报回的三段长度是 `moduleIo.js:10311 / moduleHealth.js:1510 / moduleAdmin.js:5662`，与我的源码 blob 表（34301/5124-5907/13528-16473）一位都不对。读回原文尾部 `…alizeZipEntry};`、`…as planRepair};`、`…as summarize};` ⇒ **设备上跑的是 `dist/` 里逐文件打包压缩后的那份**（路径同名、内容被 minify），而 `t.length` 数的是 UTF-16 码元不是字节。两条都错在"拿源码的尺子去量产物"。
  - **按产物的尺子重算后三个数字一位不差**：在 HEAD 上 `pnpm build` 后测 `dist/src/core/*` 的 `t.length` —— `moduleIo.js` **10311**、`moduleHealth.js` **1510**、`moduleAdmin.js` **5662**，与手机读数完全相同（我上一次构建的 dist 是 D3 续之前，`moduleHealth.js` 只有 1311，差的 199 正好是 name/type 那段）。⇒ **他手机上装的就是含 D1–D4 的 HEAD 构建，上一节"这台机器没有 D4 修复入口"的结论作废。**
  - 为什么 `repairAction` 报"没有"：压缩把局部函数名改了，**标识符在这个产物里没有区分力**；能在 bundle 里存活的是**字符串字面量** —— `已损坏（需修复）`、`包已损坏：请先点「修复」`（D4）、`缺少 id 字段`/`缺少 name 字段`（D3/D3 续）、`copy 落盘校验失败`（D2）。以后写这种"版本指纹"探针：①先确认被测对象是源码还是 bundle，量纲用 `t.length` 对齐；②标记只允许字符串字面量，并且要**在改动前的那个提交上 grep 到 0 命中**才准用。

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

---

## P19 内置默认模块源 + 手动打包独立 Artifact（2026-10-02）

> ⚠️ **并行会话警示**：本节撰写期间有另一个会话在同一工作树上做"样式资产去重迁移"，其未提交改动（image/styles、assets/animation 等资产增删、modules/*/1.5.0 的 CSS/manifest 变更）**不属于 P19**；P19 的提交只含本节列出的文件，两摊工作以提交清单为界。

### 交付内容

1. **手动打包**（`.github/workflows/manual-package.yml`）：改用 `actions/upload-artifact@v7` 的 `archive: false`（2026-02 起 GitHub 官方支持非 ZIP Artifact）——dist/release/ 的 10 项发布资产（整包 + 七个分包 + module-index.json + RELEASE-NOTES.md）**每项一个独立 Artifact**：单文件上传时 artifact 名即文件名，下载直接得到原始文件，不再有"总 Artifact 再套一层 ZIP"的二次包装。仍只构建一次（checkout→install→gates→build→verify:release→10 个上传步骤）；Summary 改为 10 项逐条清单（字节 + sha256 + 可点击下载链接），并明确"每个 ZIP Artifact 都是 build-release.mjs 生成的最终发布 ZIP"。
2. **内置默认模块索引**（`scripts/build-release.mjs`）：同一份 index 对象/同一字符串输出三处——`dist/release/module-index.json`（Release 资产）、`dist/modules/module-index.json`（整包内运行时索引，verify:release 校验两者逐字节一致）、仓库根 `modules/module-index.json`（开发态默认源，已 gitignore）。索引新增 `releaseBase` 字段＝构建期写入的本版 Release 资产目录（`https://github.com/zziyoo/decadeUi-Stars/releases/download/v<版本>/`，**带尾斜杠**），内置索引里的裸文件名按它解析成真正的下载地址；远程索引仍按索引自身地址解析——`resolveModuleUrl` 唯一解析点未动，PackageInstaller 未引入第二份来源状态。
3. **模块源语义**（新建 `src/core/moduleIndexSource.js`）：`moduleIndexUrl` 为空 ⇒ 使用本体内置 `modules/module-index.json`（随扩展更新，升级自动生效）；非空 ⇒ 用户自定义远程索引。模块管理窗口与启动更新检查共用 `loadModuleIndex()` 一条路（updateNoticeWindow 不再有"没填地址就不检查"）；来源判定不落盘、无 defaultModuleIndexUrl 之类的第二配置键。
4. **模块管理窗口**：工具栏新增「恢复默认模块源」按钮（保存并刷新与刷新之间），语义＝`game.saveConfig(indexKey(), "")`——只清空、绝不写回带版本号的固定地址；输入框 placeholder 改为"自定义模块源地址（留空＝使用扩展内置模块源）"，提示行区分"正在使用扩展内置模块源 / 自定义远程模块源"；删除"未配置模块源：可安装/可更新不可用"旧文案。
5. `misc.js` 的 moduleIndexUrl 配置文案同步改写（留空＝内置模块源）。

### 测试

- 新增 `tests/p19-module-source.test.mjs`：来源判定纯逻辑（空/空白/非空）、内置索引只读固定路径 + JSON 结构校验（HTTP 404/坏 JSON/缺 modules 全部结构化失败）、loadModuleIndex 路由（内置不碰 installer、远程透传 fetchOpts、自定义源不被内置顶掉）、**默认源随版本更新**（1.5.0→1.6.0 空配置自动读到新索引）、checkForUpdates 内置路径（空配置也能查更新）、**恢复默认按钮源码级约束**（saveConfig(indexKey,…) 只许输入框现值或 `""`）。
- p9 扩展 releaseBase 断言（缺省空串 / 按 releaseBase 解析闭环）；p10 增补"整包必须含 modules/module-index.json"（正例 7 文件 + 负例"缺少内置索引"）。
- **隔离验证**（本地 clone 固定在基准提交 c355394 + 本节改动，等价 CI）：check:syntax 238/238、pnpm test **29/29**、verify:pack 875 可达/0 缺失、verify:skins 37 可达/0 缺失、pnpm build、verify:release 全过；`dist/modules/module-index.json` 与 `dist/release/module-index.json` cmp 逐字节一致；整包（3598 条目）含 `十周年UI-Stars/modules/module-index.json`；索引 `modules` 七包齐、core 不在其中、releaseBase 正确。

### 关键决定

- 默认源**不落盘**：唯一持久化状态就是 `moduleIndexUrl` 是否为空；`releaseBase` 是构建产物数据而非配置，随版本自动再生。
- 内置索引**不放宽**任何安全边界：只读固定路径（p19 有"不得变成任意路径读取器"的负例）、JSON 结构校验、下载仍经 PackageInstaller 现有 http(s) 校验与外部 sha256。
- Android 文件事务（moduleIo / packageInstaller 事务 / ZIP 解压）零改动 → 按任务边界无需重做真机安装测试；模块管理/更新检查的真机验证步骤：重启 → 开模块管理（应显示"正在使用扩展内置模块源"且七包可装）→ 填自定义地址保存并刷新 → 点「恢复默认模块源」回内置。

### 环境事故记录（重要）

- 会话中途一个**并行会话**把本任务未提交的 4 个文件改动 `git stash`（message："P19内置索引WIP(上一会话遗留,资源迁移任务期间暂存)"），已发现并 `stash pop` 恢复。
- 该 stash→pop 往返在 `core.autocrlf=true` 下把这 4 个文件在工作树写成 CRLF，令 p18 的源码扫描正则（按 LF 编写）失败——已 sed 规范化回 LF（仓库 blob 本就是 LF，提交内容不受影响）。**教训：本仓库并行会话共用一棵工作树时，任何 git stash/checkout 往返都会 CRLF 化文件，测试前应抽查行尾。**
- 该并行会话还在仓库根留下一个路径为字面量 `$WT` 的 worktree 注册（`十周年UI-Stars/$WT/`），本会话未处理，提请下一个会话注意。

---

## 上游十周年UI v1.4.2→v1.5.0 同步与独立复核（2026-10-03）

> 交代：搬运这笔上游变更的是**上一会话**——`ee3271f`（提交信息占位 "1"），中途被 revert 出 `369e0d3 Revert "1"`、再由 `d8150ed Reapply "1"` 复原；该会话没更新本台账，也把它自述里的 workflow 对齐只留在工作区未提交。本轮（本次会话）不采信该自述，独立复核并收尾。

### 复核方法（两层，证据自持）

1. **窗口法（权威口径）**：上游 `v1.4.2(0a86ae21)..v1.5.0(f22689f0)` 的 `git diff --name-status` = **11 个文件、全为 M**（无增删；已 fetch 复核 origin/main 仍是 `f22689f0`，远端无更新提交）。逐文件把上游 v1.5.0 版与 Stars HEAD 版做归一化 diff：
   - **5 个字节相同**：`docs/update.md`、`src/features/didYouKnow.txt`、`src/features/welcomeHistory.js`、`src/features/welcomeUpdateHistory.js`、`src/ui/card-utils.js`（出牌信息 `0/infinity` 修复＝事件名前置判断 + try/finally 还原当前事件）。
   - **4 个仅剩 Stars 身份/键名前缀改造**：`info.json`（version/minNonameVersion 与上游同值）、`src/core/environment.js`（cardsetion 容错表终版 `["indexOf","sourceSkill"]`）、`src/features/equipCopy.js`（仅 `extension_十周年UI-Stars_*` 键差异）、`src/features/welcomeDialog.js`（仅 `decadeUIPath`/存储键差异，国庆文案在位）。
   - **2 个走模块化映射、修复在位**：`src/overrides/player/animations.js`（`$damagepop` 的 HTML 分支在位，其余为 resourceLoader 改造）；`src/styles/player4.css` → `modules/online/1.5.0/player.css`（`bottom: calc(-1% - 8px)` 在位、无 BOM）。
2. **全树内容哈希法（兜底）**：上游 f22689f0 全 3412 文件 vs Stars HEAD 3507 文件；上游有而 Stars 同路径无的 2251 个 → **2197 个在 Stars 树内存在字节相同的文件**（原样搬进 `modules/`），**54 个为改写搬运**（6 套样式的 `playerN.css→player.css`、`ui/{character,lbtn,skill}/skins/*.js`×18、`ui/styles/**`×30→各模块 `styles/` 五件），逐一确认对应物在位。**结论：「上游改而 Stars 未动」= 0。**

### 本轮落地

- `.github/workflows/manual-package.yml`：action 版本对齐上游（checkout@v5 / pnpm-action-setup@v6 / setup-node@v5），随本笔补提交；`build.yml` 保持 @v4 与上游 build.yml 一致（判定不搬）。
- 产物重建：`pnpm build` + `pnpm run verify:release` exit=0，9 项资产 sha 见 `dist/release/RELEASE-NOTES.md`（整包 3417 文件 / 107,579,078 字节 / `1924d4b6b7d8…`；索引 `c3a83a033df6…`；online 包 `95e74b749ad7…`）。自上次上传后经历 P20（整包结构）、P21（baby 包）与本次搬运（online 包等）⇒ **9 项资产全部需重传（用户动作）**。
- 文档：根 README.md 已在 `371fda2` 换成玩家向扩展说明（与 `docs/extension-readme.md`、上游 README 同一 blob）；原「总任务书」正文只存 git 历史（`d8150ed:README.md`），本台账顶部阅读顺序已同步改写。

### 游戏内目测（一条，可选）

点作者头像看历史更新记录：应含「v1.5.0」与「十月一日 · 万家灯火」两条；已看过 1.5.0 欢迎弹窗的环境不会自动再弹（存储键 `welcomeVersion` 判定），属正常。
