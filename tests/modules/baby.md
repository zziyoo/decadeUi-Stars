# baby（欢乐三国杀样式包）测试表

`value: "babysha"`（皮肤 `baby`）。它是**唯一有完整真机更新链路记录**的包（2026-09-28 用演示源跑过 1.4.2→1.4.3），所以这张表的"安装/更新"两行不是待验。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/baby/1.5.0/manifest.json` 可解析、27 文件 entry 齐 | 静态 | 通过 | `pnpm verify:release`（baby：27 文件 / 112,079 字节 / sha256 `b3e38d5f1448…`） |
| 安装 | 安装后台账记 `source`、`sha256`、`hashVerified:true`、`installedAt`；目录落在 `modules/baby/<版本>/` | 真机 | 通过 | 2026-09-28 真机（台账§三 P11 行：sha 与演示 zip 一字不差） |
| 启用 | 切到欢乐三国杀后玩家框/手牌按钮走包内根，皮肤 JS 注册生效 | 真机 | 待验 | — |
| 禁用 | 关掉后回落默认套，Core 其余功能不受影响 | 真机 | 待验 | — |
| 更新 | 索引 `baby.latest` 更高时提示窗列出该项；更新后 `previousVersion` 记录、新旧版本目录并存 | 真机 | 通过 | 2026-09-28 真机 1.4.2→1.4.3，`previousVersion:"1.4.2"` 且两版目录并存 |
| 卸载 | 让位 `.removing-*` → 台账写成功 → 清理；卸载后样式不可用而 Core 正常。**使用中不许卸**：当前样式那行的「卸载」按钮置灰并给 `title` 理由（安装器的 `IN_USE` 是第二道防线，force 也不绕过） | 真机 | 通过 | 2026-09-30 批3 真机：Online 为当前样式时其「卸载」置灰（`moduleAdmin.js:214` + `moduleManagerWindow.js:210`）；切走再卸 → `modules/baby/1.4.2/` 清空、台账 `baby` 行消失，Core 其余功能不受影响（盘上由我核对后还原） |
| 重装 | 卸载后重装成功，无残留临时目录；台账按索引重建（卸载清掉的 `previousVersion` 不该凭空出现） | 真机 | 通过 | 2026-09-30 批3 真机（在线索引 1.4.4）：台账 `baby = {version:"1.4.4", sha256:"e9d78419a3bc…", hashVerified:true}` 且**无** `previousVersion`；`tmp/modules/` 无残留；我另核 `verify:release` exit=0 后还原出厂态 |
| 回退 | 破坏 `manifest.json` 或删 `ui/baby.js` 入口后重启 ⇒ 自动回退上一版并把坏目录改名 `.corrupt-*` | 真机 | 通过 | 2026-09-29 批2 真机四条直接跑在本套上（§八 P12-1…P12-4）：回退 `1.4.3 → 1.4.2` 留 `.corrupt-1.4.3-2o3jnp`、上一版也坏时不改名、无上一版文案分岔、误报为零 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` 不半装 | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时样式判据为假；`.corrupt-*`/`.replacing-*` 目录不被 `localVersions` 当成可用版本 | 静态 | 通过 | `tests/p12-repair.test.mjs`（localVersions 过滤三条前缀） |
