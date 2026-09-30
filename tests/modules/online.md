# online（Online 样式包）测试表

`value: "onlineUI"`（皮肤 `online`），带两个**别处没有**的能力：`online-chat`、`online-gift`。这两个是它区别于其他样式包的专属判据。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/online/1.5.0/manifest.json` 可解析、entry 齐；`ol/` 皮肤 JS 与 CSS 引用可达 | 静态 | 通过 | `node scripts/verify-pack.mjs`（含 70 文件那包）、`check-skin-imports` 37/0 |
| 安装 | 安装后台账 `source:"installed"` + `hashVerified:true` | 真机 | 待验 | — |
| 启用 | 切到 Online 后 `online-chat`（聊天条）与 `online-gift`（赠礼）两块界面出现且位置不压玩家框 | 真机 | 通过 | **2026-09-30 降级为待验**：boot 期样式读数缺陷（见§四同名小节）导致 online 包 CSS 当时未加载，批1 证据只到状态三值与能力查询 ⇒ 判据需按 §八 S-1 重取。**2026-09-30 修复后探针 1~6 真机全符合**（online 包 6 份 CSS 已加载且 `link.sheet` 全 OK），所以本行卡着的只剩「聊天气泡与赠礼按钮的实际位置」这一项目测。**2026-09-30 用户回报：两块界面在六套下都没出现** —— 已定位为 lbtn 插件缺席（§四「技能按钮点不动」小节，同一根因：赠礼在 online 的 lbtn 皮肤里、聊天条由移动版 lbtn 皮肤 `initChatSystem` 起），修复后须整程序重开再验本行。旧证据保留：2026-09-29 批1 真机 `decadeUI.style.id` = `online`、`[hasCapability("online-chat"), hasCapability("online-gift")]` = `[true, true]`（**修复前是 [false,false]**）；两块界面的实际位置目测未单独回报。**2026-09-30 lbtn 插件缺席修好、整程序重开后，用户回报「其他的手动测试了，均无误」⇒ 两块界面都在且位置不压玩家框，本行转通过** |
| 禁用 | 关掉 Online 后聊天/赠礼入口一并消失，不留空槽 | 真机 | 待验 | — |
| 更新 | 索引 `online.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧目录保留 | 真机 | 待验 | — |
| 卸载 | 让位 `.removing-*` → 台账 → 清理；卸载后可观测的是 `independent:false`、资源根回落扩展根（于是本样式一条 CSS 都不加载）、台账条目与目录清空。**原写「两个能力同时不可用」已按代码作废**：capability 取自注册表清单，卸载当下确实变假，但每次启动 `builtInModules.js:31` 会把 `online-chat/online-gift` 重新声明回来，重启后又是真 —— 它不能当卸载判据 | Node | 通过 | `tests/p15-online-uninstall-observability.test.mjs`：真安装器跑卸载（IN_USE 拦截 → 切走 → 卸成功 → 台账/目录/注册状态/资源根四项核对）+ 把 capability 与可用性脱钩钉成断言 + 置灰理由；卸载事务本身另有 `p5-installer:773-846` |
| 重装 | 同版本重装成功，无残留临时目录 | 真机 | 待验 | — |
| 回退 | 破坏清单/入口后重启自动回退上一版，坏目录改名 `.corrupt-*` | 真机 | 通过 | 2026-09-29 批2 真机：机制与 baby 四条同源（同一条 `registerInstalledModules` 分支），已在 baby 上跑过 P12-1…P12-4；本套未单独造损，复现步骤见台账§八「P12 部分」 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时 `getModuleBase("online")` 不指向空目录，能力判据为假 | 静态 | 通过 | `tests/p3-resource-loader.test.mjs` + verify-pack |
