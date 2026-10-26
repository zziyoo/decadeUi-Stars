## 扩展介绍

无名杀游戏的界面美化扩展

## 安装包选择

- `十周年UI-Stars-<版本>-full.zip`：完整包，预装全部七个可选分包。
- `十周年UI-Stars-<版本>-lite.zip`：次完整包，保留扩展本体、共享资源和模块索引，不预装七个可选分包；进入游戏后可在模块管理窗口按需安装。

两种包均可解压到 `无名杀/resources/app/extension/十周年UI-Stars/`，该目录下应直接包含 `info.json` 和 `extension.js`。从完整包切换到次完整包时，请使用干净的扩展目录；覆盖旧目录不会自动删除已有分包。

## 使用帮助

详细的配置说明请参考 `docs/` 目录：

- [卡牌皮肤注册](docs/card-skin-api.md) - 外部扩展注册卡牌皮肤的方法
- [前缀角标注册](docs/prefix-mark-api.md) - 武将前缀角标的配置方法
- [动态皮肤配置](docs/dynamic-skin-api.md) - Spine骨骼动画皮肤的配置方法
- [露头头像配置](docs/outcrop-avatar-api.md) - 露头头像的目录结构和API
- [骨骼动画定位](docs/spine-positioning-api.md) - Spine骨骼动画定位系统说明
- [版本更新日志](docs/update.md) - 十周年UI版本更新日志
- [报错兜底处理](docs/secret.md) - 与无名杀版本不匹配下游玩方法

## 相关链接

- 无名杀游戏：https://github.com/libnoname/noname

## 相关人员

- 原创作者：短歌
- 手杀UI原作者：橙续缘
- 上上任维护者：[萌新（转型中）](https://github.com/mengxinzxz)
- 上任维护者：[点点](https://github.com/diandian157)
- 现任维护者：[子右](https://github.com/zziyoo)

## 许可证

GPL-3.0
