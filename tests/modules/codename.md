# codename（名将杀样式包）测试表

`value: "codename"`（皮肤 `codename`）。它是**唯一有真机"卸载→重装"完整记录**的包，也是跨样式共用件的高发区（`character/shizhounian`、`image/styles/decade` 因共用而留单体，见台账§三 P3-3 边界）。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/codename/1.4.2/manifest.json` 可解析、32 文件 entry 齐；包内 CSS 引用不指回单体 | 静态 | 通过 | `pnpm verify:release`（codename：32 文件 / 962,011 字节 / sha256 `6c07f5d9f051…`） |
| 安装 | 安装后台账 `source` + `hashVerified:true`，目录在 `modules/codename/<版本>/` | 真机 | 通过 | 2026-09-28 真机（重装后模块管理窗口显示正常，台账§五 P6 验收行） |
| 启用 | 切到名将杀后玩家框/手牌按钮走包内根；跨样式共用的 `character/shizhounian` 皮肤仍从单体根命中 | 真机 | 待验 | — |
| 禁用 | 关掉后回落默认套，共用件不被动缺失（不影响其他样式的武将皮肤） | 真机 | 待验 | — |
| 更新 | 索引 `codename.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧目录保留 | 真机 | 待验 | — |
| 卸载 | 目录改名 `.removing-*` 让位、台账写成功后清理；卸载后样式不可用而 Core 正常 | 真机 | 通过 | 2026-09-28 真机卸载→重装链路跑通（用户截图确认显示与状态） |
| 重装 | 卸载后同版本重装成功，`modules/` 下无 `.removing-*` 残留 | 真机 | 通过 | 同上（卸载后重装为同一版本，台账指回 1.4.2） |
| 回退 | 破坏清单/入口后重启自动回退上一版；无可用上一版时提示重装、**启动阶段绝不自动下载** | 真机 | 待验 | 判据由 `tests/p12-repair.test.mjs` 覆盖 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时样式判据为假；共用件（`image/styles/decade`）在 Core 侧仍可达 | 静态 | 通过 | 台账§三 P3-3 边界记录 + verify-pack |
