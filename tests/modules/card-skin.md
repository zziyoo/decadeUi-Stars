# card-skin（卡牌皮肤 Feature，拆包型）测试表

`pack: true` —— 资源装在 `modules/card-skin/<版本>/image/card-skins/`，未装上即不可用；
而玩家自己丢进 `image/card-skins/` 的文件夹**永远走单体根**（"丢进去就能用"是既有行为）。
可用性判据只有一个来源：`statics.js` 内部扫描完成后发布，别处不得重复判断。

| 项目 | 判据 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| 包结构 | 分包 1017 文件、五套皮肤数量逐套核对（`bingkele/caise/decade/gold/online`） | 静态 | 通过 | `pnpm verify:release`（card-skin：1017 文件 / 21,627,755 字节 / sha256 `54560999fb3c…`） |
| 安装 | 安装后 `getModuleRel("card-skin")` 切到包内根，五套从包内加载；台账 `hashVerified:true` | 真机 | 通过 | 2026-09-27 起整包内置该包，P8 第二刀搬迁后 verify-pack 881/0 与 skin-imports 37/0 均绿 |
| 启用 | 「卡牌美化」开关为真时按所选套渲染，`extension` 格式（png/webp/jpg）与实际文件一致 | 真机 | 待验 | — |
| 禁用 | 关掉后回落默认卡面；已装包不被动删除 | 真机 | 待验 | — |
| 更新 | 索引 `card-skin.latest` 更高时列出该项；更新后 `previousVersion` 记录、旧版本目录并存 | 真机 | 待验 | — |
| 卸载 | 让位 `.removing-*` → 台账 → 清理；卸载后**内置五套不可用而玩家自建套仍可用**（两根行为不同） | 真机 | 待验 | — |
| 重装 | 同版本重装成功；重装期间玩家自建套不受影响（不写单体根） | 真机 | 待验 | — |
| 回退 | 破坏包内清单后重启自动回退上一版，坏目录改名 `.corrupt-*` | 真机 | 待验 | 判据由 `tests/p12-repair.test.mjs` 覆盖 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时内置五套可用性为假（不出现半加载），`isCardSkinAvailable` 单一来源不被别处复制判断 | 静态 | 通过 | `tests/p8-card-skin-pack.test.mjs` |
| 玩家自建套 | `image/card-skins/<新套>/` 丢进去重启即被 `discoverDynamicSkins` 注册；`meta.json` 缺 `extension` 时按图片自动探测格式 | 真机 | 待验 | — |
| 旧版迁移 | 旧版目录里的玩家自建套自动复制到本扩展 `image/card-skins/`，内置五套排除、同名不覆盖（幂等）、**只读旧目录不写不删** | 真机 | 待验 | 判据与幂等由 `tests/p13-legacy-detector.test.mjs` 覆盖（`planSkins` 四组） |
