# mobile（移动版样式包）测试表

`value: "off"`（皮肤 `shousha`）。P4 拆分时因跨样式引用，`shousha` 资产留单体 —— 这张表要盯住"包内 + 单体"两处引用都不悬空。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/mobile/1.5.0/manifest.json` 可解析且 entry 文件齐；包内 CSS 的相对引用不指回单体 | 静态 | 通过 | `node scripts/verify-pack.mjs`（0 未知缺失）、`node scripts/check-skin-imports.mjs` 37/0 |
| 安装 | 安装后台账 `source:"installed"`、`hashVerified:true`，目录在 `modules/mobile/<版本>/` | 真机 | 待验 | — |
| 启用 | 切到移动版后玩家框/手牌按钮走包内根，`shousha` 共用资产仍从单体根命中（不缺图） | 真机 | 待验 | — |
| 禁用 | 关掉移动版回落到默认套，横屏/手机布局不受牵连 | 真机 | 待验 | — |
| 更新 | 索引 `mobile.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧目录保留 | 真机 | 待验 | — |
| 卸载 | 让位目录 `.removing-*` → 台账成功 → 清理；卸载后样式不可用而 Core 正常 | 真机 | 通过 | 2026-09-30 批3 真机：同一条 `packageInstaller.uninstall/install` 路径已在 baby 上跑通（卸载→台账清行→重装 1.4.4→`hashVerified:true`）；本套未单独跑，特殊条款见判据 |
| 重装 | 同版本重装成功，无残留临时目录 | 真机 | 通过 | 2026-09-30 批3 真机：同一条 `packageInstaller.uninstall/install` 路径已在 baby 上跑通（卸载→台账清行→重装 1.4.4→`hashVerified:true`）；本套未单独跑，特殊条款见判据 |
| 回退 | 破坏清单或入口后重启自动回退上一版，坏目录改名 `.corrupt-*` | 真机 | 通过 | 2026-09-29 批2 真机：机制与 baby 四条同源（同一条 `registerInstalledModules` 分支），已在 baby 上跑过 P12-1…P12-4；本套未单独造损，复现步骤见台账§八「P12 部分」 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` 不半装 | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时样式判据为假；P4 的死引用改写（指针 + `manifest.deadRefs` 登记）不产生新悬空引用 | 静态 | 通过 | 台账§三 P4 记录 + verify-pack |
