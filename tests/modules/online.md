# online（Online 样式包）测试表

`value: "onlineUI"`（皮肤 `online`），带两个**别处没有**的能力：`online-chat`、`online-gift`。这两个是它区别于其他样式包的专属判据。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | `modules/online/1.4.2/manifest.json` 可解析、entry 齐；`ol/` 皮肤 JS 与 CSS 引用可达 | 静态 | 通过 | `node scripts/verify-pack.mjs`（含 70 文件那包）、`check-skin-imports` 37/0 |
| 安装 | 安装后台账 `source:"installed"` + `hashVerified:true` | 真机 | 待验 | — |
| 启用 | 切到 Online 后 `online-chat`（聊天条）与 `online-gift`（赠礼）两块界面出现且位置不压玩家框 | 真机 | 待验 | — |
| 禁用 | 关掉 Online 后聊天/赠礼入口一并消失，不留空槽 | 真机 | 待验 | — |
| 更新 | 索引 `online.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧目录保留 | 真机 | 待验 | — |
| 卸载 | 让位 `.removing-*` → 台账 → 清理；卸载后两个能力同时不可用 | 真机 | 待验 | — |
| 重装 | 同版本重装成功，无残留临时目录 | 真机 | 待验 | — |
| 回退 | 破坏清单/入口后重启自动回退上一版，坏目录改名 `.corrupt-*` | 真机 | 待验 | 判据由 `tests/p12-repair.test.mjs` 覆盖 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时 `getModuleBase("online")` 不指向空目录，能力判据为假 | 静态 | 通过 | `tests/p3-resource-loader.test.mjs` + verify-pack |
