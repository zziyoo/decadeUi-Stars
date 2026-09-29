# baby（欢乐三国杀样式包）测试表

`value: "babysha"`（皮肤 `baby`）。它是**唯一有完整真机更新链路记录**的包（2026-09-28 用演示源跑过 1.4.2→1.4.3），所以这张表的"安装/更新"两行不是待验。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/baby/1.4.2/manifest.json` 可解析、27 文件 entry 齐 | 静态 | 通过 | `pnpm verify:release`（baby：27 文件 / 112,079 字节 / sha256 `b3e38d5f1448…`） |
| 安装 | 安装后台账记 `source`、`sha256`、`hashVerified:true`、`installedAt`；目录落在 `modules/baby/<版本>/` | 真机 | 通过 | 2026-09-28 真机（台账§三 P11 行：sha 与演示 zip 一字不差） |
| 启用 | 切到欢乐三国杀后玩家框/手牌按钮走包内根，皮肤 JS 注册生效 | 真机 | 待验 | — |
| 禁用 | 关掉后回落默认套，Core 其余功能不受影响 | 真机 | 待验 | — |
| 更新 | 索引 `baby.latest` 更高时提示窗列出该项；更新后 `previousVersion` 记录、新旧版本目录并存 | 真机 | 通过 | 2026-09-28 真机 1.4.2→1.4.3，`previousVersion:"1.4.2"` 且两版目录并存 |
| 卸载 | 让位 `.removing-*` → 台账写成功 → 清理；卸载后样式不可用而 Core 正常 | 真机 | 待验 | — |
| 重装 | 卸载后同版本重装成功，无残留临时目录 | 真机 | 待验 | — |
| 回退 | 破坏 `manifest.json` 或删 `ui/baby.js` 入口后重启 ⇒ 自动回退上一版并把坏目录改名 `.corrupt-*` | 真机 | 待验 | 判据由 `tests/p12-repair.test.mjs` 覆盖 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` 不半装 | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时样式判据为假；`.corrupt-*`/`.replacing-*` 目录不被 `localVersions` 当成可用版本 | 静态 | 通过 | `tests/p12-repair.test.mjs`（localVersions 过滤三条前缀） |
