# kill-effect（击杀特效 Feature，门控型）测试表

`pack: false` —— 资源随 Core 发布（`effect.css` + 特效 JS 在单体根），**没有独立包形态**，
所以§51 的"安装/卸载/更新/回退"四项对它不适用：不是漏写，是语义上就没有这条链路。
它的真正风险在门控边界：只管击杀特效，不得牵连技能特效与"幻影出牌"。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | 无独立分包（门控型：资源随 Core 发布，不适用分包校验） | 不适用 | 不适用 | 不适用：`featureRuntime` 声明 `pack:false`，索引里不出现该项 |
| 安装 | 不适用：门控型没有安装链路（不下载、不建 `modules/kill-effect/`） | 不适用 | 不适用 | 不适用：台账§四「P8 记录」定性为门控型 Feature |
| 启用 | 开关 `killEffect` 为真时特效装载并可播放；`switchOn` 单一来源读 `extension_十周年UI-Stars_killEffect` | 真机 | 待验 | — |
| 禁用 | 开关为假时特效不装载，调用点以可选链降级（`decadeUI.effect?.kill?.()`）不报错 | 真机 | 通过 | 2026-09-28 真机（`d31ab7e` 定性修正后用户确认技能特效不受牵连） |
| 更新 | 不适用：随 Core 整包发布，没有独立版本可更新 | 不适用 | 不适用 | 不适用：`pack:false` 无 latest 概念 |
| 卸载 | 不适用：没有独立目录可卸（删它等于改 Core） | 不适用 | 不适用 | 不适用：`pack:false` |
| 重装 | 不适用：同上 | 不适用 | 不适用 | 不适用：`pack:false` |
| 回退 | 不适用：无版本目录 ⇒ 无"上一版"可退；损坏等于 Core 损坏 | 不适用 | 不适用 | 不适用：`pack:false` |
| 依赖 | `core: ">=<版本>"` 由 Feature 声明承担；Core 版本不符时不装载该能力 | Node | 通过 | `tests/p8-effects-gate.test.mjs` |
| 资源在场 | `effect.css` 不再由 `layout.css` 的 `@import` 无条件加载，改由门控装载；技能特效 `.skill-name` 仍随 Core 可用 | 静态 | 通过 | `tests/p8-effects-gate.test.mjs` + 台账§四「P8 修复记录」 |
| 边界 | 关掉击杀特效**不影响**技能特效与「幻影出牌」（后者自有开关 `cardGhostEffect`） | 真机 | 通过 | 2026-09-28 真机（台账§三 P8 修复行 `d31ab7e`） |
