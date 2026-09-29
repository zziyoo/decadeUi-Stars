# core（扩展本体）测试表

Core 不是一个可下载的包（**本体即 Core**，P10 决定：不进 Release 资产），所以这张表盯的是
"整包 + 索引 + 客户端解析"这一条链，以及只有本体才有的闸门与迁移。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `info.json` 的 `name/version` 与 `modules/installed.json` 的 `core` 记录一致；`extension.js` 在包根位 | 静态 | 通过 | `pnpm build` + `pnpm verify:release` exit=0（`verifyFullPackage` 断言根位文件与条目数一致） |
| 整包 | `十周年UI-Stars-<版本>-full.zip` 含 Core + 全部包，解压到 `resources/app/extension/` 即用；**不含** `release/`、`tests/`、`docs/superpowers/` 与三份内部文档 | 静态 | 通过 | 构建后解包核对：条目 3595、`tests/` 与 `docs/superpowers` 命中 0 |
| module-index | 索引 `schema:1`，`modules.<id>.url` 是裸文件名，客户端按 `resolveModuleUrl(url, indexUrl)` 解析到同一 Release 下的资产地址；`core` 字段为版本闸门 | 静态 | 通过 | `tests/p9-release-index.test.mjs`、`tests/p10-release.test.mjs` |
| 安装 | Core 无独立包形态，**不可被安装/更新**：索引里 `core` 被排除在可安装项之外 | Node | 通过 | `tests/p9-release-index.test.mjs`（core 不作为可安装项） |
| 启用 | 扩展面板「开启」为真时 `content()` 才装载；Core 装载后 `window.decadeUI` 挂上（与旧版共用全局名，占不到时本扩展不装载） | 真机 | 通过 | 2026-09-29 真机：旧版停用后重启由 Stars 接管，`typeof window.decadeUI.legacyMigration === "function"` |
| 禁用 | 关掉本扩展后本体回落默认界面，已装包不被动删除 | 真机 | 待验 | — |
| 更新 | 索引 `core.latest` 高于本机时提示窗单列一块，**只给发布页链接、绝不自动替换**（本体就是正在运行的扩展目录） | 真机 | 通过 | 2026-09-28 真机（台账§三 P11 行：Core 落后一块 + 打开发布页） |
| 卸载 | Core 不提供自卸载入口；`game.removeExtension()` 是破坏性操作（连删配置/localStorage/导入图），**全仓库不得调用** | 静态 | 通过 | 全仓检索无调用点；台账§四「P13 记录」明写禁令 |
| 重装 | 整包覆盖同名扩展目录后 `modules/installed.json` 与磁盘版本目录一致，不出现"台账指向不存在的版本" | 真机 | 待验 | — |
| 回退 | 台账指向的版本目录缺失/损坏时启动自动回退到健康上一版，坏目录改名 `.corrupt-*` 留证；无可用上一版只提示重装、不自动下载 | 真机 | 通过 | 2026-09-29 批2 真机四条（§八 P12-1…P12-4，跑在 baby 上）：缺清单 → 弹 `baby：1.4.3 → 1.4.2`、盘上留 `.corrupt-1.4.3-2o3jnp`、台账 `previousVersion` 被清；上一版也坏 → `需要重装` 且**无目录改名**；无上一版 → 原因文案分岔为「没有记录上一版本」；什么都不造 → 不弹不写 |
| 寻址 | 台账版本 ≠ 本体版本时，启动注册必须以 `source:"installed"` 覆盖内置那份，`getModuleBase(<样式>)` 解析到 `modules/<id>/<版本>/`（否则已迁移成包的样式连 `entry.css` 都不读，整套样式直接没样式） | 真机 | 通过 | 2026-09-29 批2 真机查出（更新 baby→1.4.4 后重启，`list()` 仍报 1.4.2、根落回扩展根）⇒ 修复 `40f7933`；`tests/p14-boot-installed-override.test.mjs` 四条；重启后探针 `[["1.4.4"],"extension/十周年UI-Stars/modules/baby/1.4.4/","1.4.2"]` |
| 依赖 | 各包 `core: ">=<版本>"` 不满足时报 `DEP_MISSING` 而非静默半装 | Node | 通过 | `tests/p5-installer.test.mjs` |
| 旧版 | 十周年UI 仍启用 ⇒ 启动即写 `extension_十周年UI_enable=false`（重载后生效）；玩家自建卡面自动复制；旧配置只按「导入」按钮写入 | 真机 | 通过 | 2026-09-29 真机：`enable` 写 false 且跨重启留住；标记与配置写入见台账§四「P13 记录」 |
