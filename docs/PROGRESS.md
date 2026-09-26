# 十周年UI-Stars 工作进度与交接文档

> 本文档记录工程当前状态，供后续 Agent / 开发者**快速接手**。每次会话结束前必须更新本文档并提交。
>
> 阅读顺序：[README.md](../README.md)（总任务书，一切以它为准）→ 本文档 → [modularization-audit.md](modularization-audit.md)（P0审计报告）。

---

## 一、工程概况

| 项目 | 内容 |
|---|---|
| 工程目标 | 将单体"十周年UI"扩展升级为 Core + Style Pack + Feature Pack + Shared Resource 模块化UI平台（按需下载/安装/启停/更新/卸载） |
| Stars 仓库 | https://github.com/zziyoo/decadeUi-Stars （本目录，2026-09-27 新建） |
| 原版参考仓库 | `zziyoo/decadeUi`，本地路径 `C:\Users\32360\Desktop\无名杀-win32-x64\resources\app\extension\十周年UI` |
| 总路线 | P0审计 → P1模块基础设施 → P2公共依赖解耦 → P3十周年Pack → P4移动版Pack → P5下载器 → P6模块管理界面 → P7全部Style → P8 Feature Pack → P9模块化构建 → P10 Release → P11自动更新 → P12回滚 → P13旧版本迁移 → P14全量测试 |
| 当前阶段 | **P0：模块化架构审计（进行中）** |

## 二、环境备忘（本机关键信息）

- **Git 2.55 装在 `D:\Git\`，不在 PATH 中**。调用方式：`D:\Git\cmd\git.exe`。
- **网络**：git 直连 github.com 会被重置，本机系统代理为 `127.0.0.1:7897`。本仓库已配置**局部**代理（`git config --local http.proxy` / `https.proxy`），未动全局配置。
- **认证**：Windows 凭据管理器已有 GitHub 凭据（`git:https://github.com`），git push 自动认证。GitHub CLI 已安装但未登录。
- **git 身份**：`ziyoo / 166354372+zziyoo@users.noreply.github.com`（全局配置）。
- **规则**：bash 不可用时用 PowerShell；cmd 下命令分隔符用 `&` 而非 `;`。

## 三、已完成

| 日期 | 内容 | 提交/产物 |
|---|---|---|
| 2026-09-27 | 建立本仓库，首推 4 个文件（README.md 任务书、extension.js、info.json、.gitignore） | `dc91e82` |
| 2026-09-27 | 确认原版十周年UI位置与规模：约 113MB / 3400+ 文件（assets 12.5MB/290、audio 9.9MB/241、image 34.5MB/1596、src 2.3MB/174、ui 53.9MB/1094） | 本次审计输入 |
| 2026-09-27 | 创建本文档 | — |

## 四、进行中（当前任务指针）

**当前任务：P0 模块化架构审计**（任务书 §33-§34、§61-§62）

审计对象：原版 `十周年UI` 目录（只分析，不改代码，不移动文件）。

子任务清单：

| # | 子任务 | 状态 |
|---|---|---|
| 1 | 完整源码清单（src/ui/image/audio/assets 分类统计） | 进行中 |
| 2 | JS 依赖图（import / dynamic import / 全局变量引用） | 未开始 |
| 3 | CSS 依赖图（@import / url() / background-image / @font-face） | 未开始 |
| 4 | 资源依赖图（JS/CSS → 图片/音频/assets 引用关系） | 未开始 |
| 5 | Style 引用图（newDecadeStyle 耦合点清单） | 未开始 |
| 6 | Shared 资源候选判定 | 未开始 |
| 7 | Feature 候选判定 | 未开始 |
| 8 | Core 候选判定 | 未开始 |
| 9 | 高风险文件标记（decadeUI.js/content.js/precontent.js/decadeModule.js/app.js/overrides/*） | 未开始 |
| 10 | 产出 `docs/modularization-audit.md`（任务书 §62 要求的 15 节完整报告） | 未开始 |

**P0 验收标准**（任务书 §34）：不改变任何功能行为；必须回答哪些文件属于 Core / Style / Feature / Shared、哪些不能拆、为什么。

## 五、已知问题与风险

1. **Stars 目录当前只有空模板**（extension.js/info.json 为空白骨架）。任务书 §3 描述的 `src/`、`ui/` 等源码基线在**原版目录** `extension\十周年UI` 中，P1 阶段需决定：迁移源码进本仓库 vs 在原仓库继续。
2. P0 完成前禁止任何目录搬移、文件删除、样式重写（任务书 §61）。
3. 原版仓库有自己的 git 仓库（含 .github、LICENSE），Stars 与其关系（fork / 重开始 / 并行）待用户确认，当前按独立仓库处理。

## 六、下一步

1. 完成 P0 审计并提交 `docs/modularization-audit.md`。
2. 与用户确认 P0 验收后，进入 P1：ModuleManager + StyleRuntime + ResourceLoader 基础设施（任务书 §35-§36，只建接口骨架，暂不移动大型资源）。
3. 决定源码迁移策略（见"已知问题"第 1 条）。

## 七、会话记录

| 日期 | 会话内容摘要 |
|---|---|
| 2026-09-27 | 建仓推送至 zziyoo/decadeUi-Stars；创建本文档；启动 P0 审计 |
