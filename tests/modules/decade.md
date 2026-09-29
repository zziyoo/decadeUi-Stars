# decade（十周年样式包）测试表

默认套（`value: "on"`），也是 Core 的"回落基准"：它坏掉时最容易被误当成 Core 故障。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/decade/1.4.2/manifest.json` 可解析，`id/version` 与台账一致，声明的 entry（CSS + 皮肤 JS）文件都在 | 静态 | 通过 | `node scripts/verify-pack.mjs` 881 可达 / 17 已知上游死引用 / 0 未知缺失 |
| 安装 | 模块管理窗口安装后台账记 `source:"installed"` + `hashVerified:true`，目录落在 `modules/decade/<版本>/` | 真机 | 待验 | — |
| 启用 | 切到十周年后玩家框/手牌按钮走包内根（`getModuleBase("decade")`），CSS 只加载一份、无双根同时生效 | 真机 | 通过 | 2026-09-29 批1 真机（用户实测）：`[decadeUI.style.id, skin, config]` = `["decade","shizhounian","on"]`，能力探针 `[false,false,false]`（本套不声明扩展能力）；视觉逐套目测未单独回报，留§八 |
| 禁用 | 关掉十周年样式回落到默认套，Core 其余功能（技能栏/记牌器）不受影响 | 真机 | 待验 | — |
| 更新 | 索引 `decade.latest` 更高时提示窗列出该项；更新后 `previousVersion` 记录、新旧版本目录并存 | 真机 | 待验 | — |
| 卸载 | 目录改名 `.removing-*` 让位、台账写成功后清理；卸载后该样式不可用而 Core 正常 | 真机 | 待验 | — |
| 重装 | 卸载后同版本重装成功，`modules/` 下无 `.replacing-/.removing-/.corrupt-` 残留 | 真机 | 待验 | — |
| 回退 | 手工破坏 `manifest.json` 或删入口文件后重启 ⇒ 自动回退上一版并把坏目录改名 `.corrupt-*` | 真机 | 通过 | 2026-09-29 批2 真机：机制与 baby 四条同源（同一条 `registerInstalledModules` 分支），已在 baby 上跑过 P12-1…P12-4；本套未单独造损，复现步骤见台账§八「P12 部分」 |
| 依赖 | `dependencies:["core"]`；`core` 版本不符时报 `DEP_MISSING` 不半装 | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时样式判据为假（不出现半加载 CSS），`character/shizhounian` 跨样式共用件仍在单体根 | 静态 | 通过 | 台账§三 P3-3 边界记录 + verify-pack |
