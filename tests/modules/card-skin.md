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
| 卸载 | 让位 `.removing-*` → 台账 → 清理；卸载后**内置五套不可用而玩家自建套仍可用**（两根行为不同） | 真机 | 待验 | 通用卸载链已在 baby 上真机过（批3）；**双根那条是本包特有判据**，卸的又是卡面本体，留作收尾单独跑 |
| 重装 | 同版本重装成功；重装期间玩家自建套不受影响（不写单体根） | 真机 | 待验 | — |
| 回退 | 破坏包内清单后重启自动回退上一版，坏目录改名 `.corrupt-*` | 真机 | 通过 | 2026-09-29 批2 真机：机制与 baby 四条同源（同一条 `registerInstalledModules` 分支），已在 baby 上跑过 P12-1…P12-4；本套未单独造损，复现步骤见台账§八「P12 部分」 |
| 依赖 | `dependencies:["core"]` 不满足时报 `DEP_MISSING` | Node | 通过 | `tests/p5-installer.test.mjs` |
| 资源在场 | 未装包时内置五套可用性为假（不出现半加载），`isCardSkinAvailable` 单一来源不被别处复制判断 | 静态 | 通过 | `tests/p8-card-skin-pack.test.mjs` |
| 玩家自建套 | `image/card-skins/<新套>/` 丢进去重启即被 `discoverDynamicSkins` 注册；`meta.json` 缺 `extension` 时按图片自动探测格式 | 真机 | 通过 | 2026-09-29 批1 真机（用户实测）：建 `我的套/` 重启后出现在「卡牌美化」可选项里、可选中生效；用户验后手工删除（残件在回收站），故 `image/card-skins/` 现只剩 `.gitkeep` —— 这是清理，不是没验 |
| 旧版迁移 | 旧版目录里的玩家自建套自动复制到本扩展 `image/card-skins/`，内置五套排除、同名不覆盖（幂等）、**只读旧目录不写不删** | 真机 | 通过 | 2026-09-29 批1 真机（用户实测）（P13-3）：在旧版目录放非内置套 → 重启后提示窗出现「已复制玩家自建卡面 1 个」且 Stars 侧出现同名套；用户验后手工删除两侧文件夹。注：旧版目录若被恢复，下次启动会按设计重新复制（同名不覆盖） |
