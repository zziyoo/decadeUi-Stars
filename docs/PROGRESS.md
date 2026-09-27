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
| 当前阶段 | **P4（mobile 样式包拆分：CSS+皮肤JS，复用P3模式）完成，待验收；P3-3/P4 遗留的共享资产与Core JS样式路由归P8/P9** |

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
| 2026-09-27 | **P3-1：decade 样式CSS组迁入独立包**（详见§四末"记录"）。六个样式CSS（player1+shizhounian系5个）+ 51个自有图片迁入 modules/decade/1.4.2/，url重写208处全可达；运行时按安装状态条件加载 | P3/P1/P2 测试 ✓；构建（含dist包部署）✓ |

## 四、进行中（当前任务指针）

**当前任务：P3 第一子任务 —— ✅ 已完成（2026-09-27），待用户验收**（任务书 P3 第一阶段）

### P3 第一子任务记录：getModuleBase 模块根解析正式实现

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

## 六、下一步

1. ~~P0~~ ✅ ~~P1~~ ✅ ~~P2（含阻塞修复）~~ ✅（2026-09-27，待用户验收）。
2. **建议先在游戏内实测**：dist 导入无名杀，验证扩展首次启动、6 样式切换、核心对局功能（本机纯代码验证已覆盖但运行时未实测）。
3. **P3 制作第一个 Style Pack：decade**（任务书 §39-§40）：届时只需修改 `resourceLoader.getModuleBase` 按 manifest 切换 `modules/decade/<version>/`，decadeModule 等业务代码无需再改；同时把静态链模块级路径常量的目录锚点随资源一并迁移。

## 七、会话记录

| 日期 | 会话内容摘要 |
|---|---|
| 2026-09-27 | 建仓推送至 zziyoo/decadeUi-Stars；创建本文档；完成 P0 审计并产出 `docs/modularization-audit.md` |
| 2026-09-27 | P0 验收通过（附三处表述修正）；决策 Stars 为独立开发仓库并迁入原版 v1.4.2 源码；原版不动，玩家继续用原版 |
| 2026-09-27 | **P1 完成**：开发版改名十周年UI-Stars；模块基础设施 8 文件落地；STYLE_TO_SKIN 收口单一数据源；decadeUI 公开 API 挂载；node 冒烟测试 + 全量语法校验 + vite 构建通过 |
| 2026-09-27 | **P2 完成**：样式配置键与 38 处读取点收口 styleRuntime；main1/2/3.js 映射迁出 Core；资源路径扩展名全部动态化（字面量归零）；P2 冒烟测试 + 构建通过 |
| 2026-09-27 | **P2 阻塞修复完成**：extension.js 首启顺序、ResourceLoader getModuleBase 正式抽象、3 处模块求值期回归修复；测试基建（noname 解析钩子）；统计勘误 201 个 JS |
| 2026-09-27 | **热修复：同步上游 equipCopy.js**（上游会话中更新导致快照捕获中间损坏态），修复 content() 中断与角色框布局问题 |
