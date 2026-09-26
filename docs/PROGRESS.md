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
| 当前阶段 | **P1 完成（含开发版改名），待验收；下一阶段 P2：公共依赖解耦** |

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

## 四、进行中（当前任务指针）

**当前任务：P1 模块基础设施 —— ✅ 已完成（2026-09-27），待用户验收**（任务书 §35-§36）

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

1. ~~Stars 目录只有空模板~~ **已解决（2026-09-27）**：原版源码已整体迁入本仓库，后续 P1 起直接在本仓库开发。
2. ~~开发版与原版运行时同名~~ **已解决（P1）**：开发版命名定为「十周年UI-Stars」，运行时路径 `extension/十周年UI-Stars/`、配置键前缀 `extension_十周年UI-Stars_` 均与原版隔离，配置互不污染。注意：两版功能完全重叠，**不可同时启用**，否则全局覆写会互相冲突。
3. P0 完成前禁止任何目录搬移、文件删除、样式重写（任务书 §61）——P0 已验收通过，该约束解除，但 P1 仍执行"零迁移"原则（任务书 §35）。
4. ~~Stars 与原版仓库关系待确认~~ **已决策（2026-09-27，用户确认）**：Stars 作为独立仓库开发，原版十周年UI不动，玩家暂时继续使用原版扩展。
5. 原版仓库的 .github CI（build.yml 会推代码/发布）未迁入，避免对 Stars 触发自动发布；P9/P10 构建系统改造时再引入。

## 六、下一步

1. ~~P0 验收~~ ✅ ~~P1 实施~~ ✅（2026-09-27 完成，待用户验收）。
2. **P2 公共依赖解耦**（任务书 §37-§38）：newDecadeStyle 38 处引用分批替换为 `decadeUI.style` API（styleRuntime）；82 处 `lib.assetURL` 硬编码收口 `resourceLoader.getAsset`；capabilities 清单从 provisional 细化；STYLE_TO_SKIN 消费路径进一步归一。
3. P2 验收：旧版十周年所有功能正常；Style-specific 逻辑不再写死到 Core（任务书 §38）。

## 七、会话记录

| 日期 | 会话内容摘要 |
|---|---|
| 2026-09-27 | 建仓推送至 zziyoo/decadeUi-Stars；创建本文档；完成 P0 审计并产出 `docs/modularization-audit.md` |
| 2026-09-27 | P0 验收通过（附三处表述修正）；决策 Stars 为独立开发仓库并迁入原版 v1.4.2 源码；原版不动，玩家继续用原版 |
| 2026-09-27 | **P1 完成**：开发版改名十周年UI-Stars；模块基础设施 8 文件落地；STYLE_TO_SKIN 收口单一数据源；decadeUI 公开 API 挂载；node 冒烟测试 + 全量语法校验 + vite 构建通过 |
