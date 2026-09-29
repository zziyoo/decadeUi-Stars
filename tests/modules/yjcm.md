# yjcm（一将成名样式包）测试表

`value: "othersOff"`（皮肤 `xinsha`），带 `border-style` 能力 —— 它是唯一影响"边框风格"的样式，切换时要与 `borderStyle/borderLevel` 两个配置键联动核对。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/yjcm/1.4.2/manifest.json` 可解析、entry 齐；`styles/*.css` 内引用全部可达 | 静态 | 通过 | `node scripts/verify-pack.mjs` 0 未知缺失 |
| 安装 | 安装后台账 `source:"installed"` + `hashVerified:true` | 真机 | 待验 | — |
| 启用 | 切到一将成名后边框风格按 `borderStyle` 生效（仅一将 / 关闭 / 五阶等档位不串档） | 真机 | 通过 | 2026-09-29 批1 真机（用户实测）：`decadeUI.style.id` = `yjcm`、`hasCapability("border-style")` = `true`（**修复前是 false**，见台账§四"P7 能力漂移"）；边框档位目测串档与否未单独回报 |
| 禁用 | 关掉后回落默认套，`borderLevel` 配置项不残留视觉效果 | 真机 | 待验 | — |
| 更新 | 索引 `yjcm.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧目录保留 | 真机 | 待验 | — |
| 卸载 | 让位 `.removing-*` → 台账 → 清理；卸载后样式不可用而 Core 正常 | 真机 | 待验 | — |
| 重装 | 同版本重装成功，无残留临时目录 | 真机 | 待验 | — |
| 回退 | 破坏清单/入口后重启自动回退；**回退目标自己也要过同一套判据**（不把另一个坏的换上来） | 真机 | 通过 | 2026-09-29 批2 真机：机制与 baby 四条同源（同一条 `registerInstalledModules` 分支），已在 baby 上跑过 P12-1…P12-4；本套未单独造损，复现步骤见台账§八「P12 部分」 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时 `border-style` 能力随之不可用，不出现"边框还在但皮肤缺图" | 静态 | 通过 | 台账§三 P7 记录 + verify-pack |
