# 十周年UI热插拔模块化工程

## 总任务表与长期实施规范

> 工程目标：将当前“单体十周年UI扩展”逐步升级为“Core + Style Pack + Feature Pack + Shared Resource”的模块化UI平台，实现按需下载、安装、启用、禁用、更新、卸载，并为未来第三方UI模块扩展留下标准接口。
>
> 当前仓库：`zziyoo/decadeUI`
>
> 本任务书是本工程的长期基准。后续所有代码修改、Agent任务、PR拆分、测试方案和架构决策，都必须优先遵守本文档；如后续发现与实际源码冲突，应先更新任务书，再继续实施，不允许无记录地改变总体架构。

---

# 一、最终目标

## 1. 用户侧目标

最终用户安装十周年UI后，不再默认下载全部美术资源。

默认只拥有：

```text
十周年UI Core
+
默认样式模块
+
最基本的共享资源
```

其他样式、功能和大型资源按需安装。

目标形态：

```text
十周年UI
├─ 核心 Core
│
├─ 样式模块
│   ├─ 十周年
│   ├─ 移动版
│   ├─ Online
│   ├─ 一将成名
│   ├─ 欢乐三国杀
│   └─ 名将杀
│
├─ 功能模块
│   ├─ 动态皮肤
│   ├─ 击杀特效
│   ├─ 进度条
│   ├─ 卡牌美化
│   └─ 其他可选功能
│
└─ 共享资源
    ├─ 字体
    ├─ Spine运行环境
    ├─ 公共UI资源
    └─ 其他多个模块共用资源
```

---

# 二、核心原则

## 原则 1：Core 与具体样式彻底解耦

Core 负责：

```text
启动
配置
模块发现
模块管理
依赖管理
资源加载
版本管理
安装
卸载
更新
失败恢复
兼容性检查
```

Core 不应该直接依赖：

```text
十周年具体美术资源
Online具体美术资源
移动版具体美术资源
一将成名具体美术资源
```

---

## 原则 2：Style 必须成为真正的模块

不能继续只使用：

```js
lib.config.extension_十周年UI_newDecadeStyle
```

作为所有系统的实际控制中心。

最终应该由统一 Runtime 管理：

```js
decadeUI.style.id
decadeUI.style.manifest
decadeUI.style.capabilities
decadeUI.style.getAsset()
decadeUI.style.load()
decadeUI.style.unload()
```

配置只是状态来源，不应该继续承担所有业务逻辑。

---

## 原则 3：模块必须有生命周期

每个模块必须明确：

```text
discover
validate
install
enable
load
disable
unload
update
remove
```

不能只设计“下载并执行”。

---

## 原则 4：默认不进行危险的运行时强制卸载

第一阶段允许：

```text
下载
安装
启用
禁用
切换
更新
删除
```

但“对局中实时切换并完全卸载所有已经执行的JS逻辑”暂不作为第一阶段要求。

推荐：

```text
修改样式
→ 保存配置
→ game.reload()
→ 新模块初始化
```

---

## 原则 5：任何拆分都必须经过依赖分析

禁止直接：

```text
把目录移动
重新打ZIP
然后测试
```

必须先确认：

```text
JS依赖
CSS依赖
图片依赖
音频依赖
Spine依赖
字体依赖
运行时依赖
跨模块依赖
```

---

## 原则 6：优先保留现有行为

模块化工程不是重写十周年UI。

所有重构优先要求：

```text
旧功能行为 = 新架构行为
```

如果只是架构迁移，不允许顺手修改无关功能。

---

# 三、当前源码架构基线

当前仓库已经具备部分模块化基础：

```text
extension.js
src/
ui/
assets/
audio/
image/
docs/
```

目前重要模块包括：

```text
src/content.js
src/precontent.js

src/core/
src/features/
src/overrides/
src/skills/
src/styles/
src/audio/
src/animation/
src/skins/
src/ui/

ui/character/
ui/skill/
ui/lbtn/
```

当前已经存在：

```text
动态CSS加载
动态JS import
Style → Skin映射
Character / Skill / Lbtn插件系统
app.plugins
app.pluginsMap
ZIP导入
game.writeFile
game.ensureDirectory
Vite preserveModules
自动构建
自动打包
```

这些能力必须尽可能复用。

---

# 四、最终架构

目标：

```text
                    ┌──────────────────────┐
                    │ 十周年UI Core        │
                    │                      │
                    │ bootstrap            │
                    │ runtime              │
                    │ moduleManager        │
                    │ styleRuntime         │
                    │ resourceLoader       │
                    │ packageInstaller     │
                    │ compatibility        │
                    └──────────┬───────────┘
                               │
                       Module Registry
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
    Style Packs          Feature Packs        Shared Packs
          │                    │                     │
   ┌──────┼──────┐             │                     │
   ▼      ▼      ▼             ▼                     ▼
 十周年  移动版  Online      动态皮肤              Fonts
                         击杀特效                  Spine
                         进度条                    Common UI
```

---

# 五、模块分类标准

## A. Core Module

所有用户必须安装。

示例：

```text
core
```

职责：

```text
扩展入口
运行时
模块管理器
配置
资源加载
安装器
依赖解析
错误处理
版本管理
兼容性
```

---

## B. Style Pack

完整的一套界面视觉风格。

例如：

```text
decade
mobile
online
yjcm
baby
codename
```

Style Pack 可以提供：

```text
player样式
character样式
skill样式
lbtn样式
相关CSS
相关图片
相关音效
特有JS
```

但不能擅自复制 Core。

---

## C. Feature Pack

功能型模块。

例如：

```text
dynamic-skin
kill-effect
progress-bar
card-skin
welcome-enhancement
```

Feature 不应该绑定某一个 Style，除非确实存在必要依赖。

---

## D. Shared Pack

多个模块共用的资源。

例如：

```text
shared-fonts
shared-spine
shared-ui
shared-ol
```

目标：

```text
一个公共资源只存一份
```

避免：

```text
decade.zip一份
online.zip一份
mobile.zip一份
```

造成重复。

---

# 六、模块Manifest标准

所有模块必须具备：

```text
manifest.json
```

标准字段：

```json
{
    "schema": 1,
    "id": "mobile",
    "name": "移动版样式",
    "version": "1.0.0",
    "type": "style",
    "core": ">=1.0.0",
    "dependencies": [],
    "entry": {
        "js": "index.js",
        "css": []
    },
    "capabilities": [],
    "platform": [
        "desktop",
        "mobile"
    ],
    "size": 0,
    "sha256": "",
    "author": "子右"
}
```

字段含义必须统一。

---

# 七、模块ID规范

禁止随意使用中文目录作为模块ID。

推荐：

```text
core
decade
mobile
online
yjcm
baby
codename

dynamic-skin
kill-effect
progress-bar
card-skin

shared-fonts
shared-spine
shared-ui
shared-ol
```

模块ID必须：

```text
稳定
唯一
长期不随显示名称变化
```

例如以后：

```text
“移动版”
```

改名为：

```text
“手杀新版”
```

内部ID仍然是：

```text
mobile
```

---

# 八、模块安装目录标准

推荐：

```text
extension/十周年UI/
├─ extension.js
├─ info.json
├─ core/
│
├─ modules/
│   ├─ decade/
│   │   └─ 1.5.0/
│   ├─ mobile/
│   │   └─ 1.5.0/
│   ├─ online/
│   │   └─ 1.5.0/
│   └─ yjcm/
│       └─ 1.5.0/
│
├─ shared/
│   ├─ fonts/
│   ├─ spine/
│   └─ ui/
│
└─ data/
    ├─ modules.json
    └─ installed.json
```

具体最终目录可以根据无名杀文件访问能力调整，但必须支持：

```text
多版本共存
当前版本指针
模块独立删除
失败回滚
```

---

# 九、版本系统

不能只维护一个：

```text
十周年UI = 1.5.0
```

应该至少存在：

```text
Core version
Module version
Manifest schema version
```

示例：

```text
Core 1.5.0

decade 1.5.0
mobile 1.3.0
online 1.2.0
```

Core升级不应该强迫所有模块一起下载。

---

# 十、模块索引

服务器/Release提供：

```text
module-index.json
```

例如：

```json
{
    "schema": 1,
    "core": {
        "latest": "1.5.0"
    },
    "modules": {
        "decade": {
            "latest": "1.5.0",
            "url": "..."
        },
        "mobile": {
            "latest": "1.5.0",
            "url": "..."
        },
        "online": {
            "latest": "1.5.0",
            "url": "..."
        }
    }
}
```

客户端可以：

```text
获取索引
→ 对比本地
→ 显示更新
```

---

# 十一、依赖系统

模块可以声明：

```json
"dependencies": [
    "shared-fonts",
    "shared-ui"
]
```

依赖解析过程：

```text
用户安装 online
        ↓
解析 online
        ↓
发现 shared-fonts
        ↓
检查本地
        ↓
未安装
        ↓
先安装 shared-fonts
        ↓
再安装 online
```

必须支持：

```text
缺失依赖
版本不满足
依赖循环
依赖模块被删除
```

---

# 十二、资源加载器

新增统一：

```text
resourceLoader
```

职责：

```text
loadJS
loadCSS
loadImage
loadAudio
loadAsset
```

必须统一处理：

```text
模块根路径
版本
缓存
重复加载
加载失败
模块不存在
```

禁止新模块继续大量手写：

```js
lib.assetURL + "extension/十周年UI/..."
```

最终应改成：

```js
decadeUI.modules.getAsset("online", "assets/xxx.png")
```

或者：

```js
module.getAsset("assets/xxx.png")
```

---

# 十三、Style Runtime

新增：

```text
src/core/styleRuntime.js
```

推荐接口：

```js
styleRuntime.getCurrent()

styleRuntime.activate(id)

styleRuntime.isInstalled(id)

styleRuntime.ensureInstalled(id)

styleRuntime.load(id)

styleRuntime.getAsset(id, path)

styleRuntime.getCapability(id, name)

styleRuntime.getManifest(id)
```

目标：

```text
所有样式判断逐步收口到Style Runtime
```

---

# 十四、逐步消除以下模式

旧：

```js
lib.config.extension_十周年UI_newDecadeStyle === "off"
```

改造后：

```js
decadeUI.style.id === "mobile"
```

更理想：

```js
decadeUI.style.hasCapability("xxx")
```

注意：

不能一次性强制修改所有代码。

必须分阶段迁移。

---

# 十五、能力系统Capabilities

不能让其他代码只知道：

```text
style = online
```

建议支持：

```json
"capabilities": [
    "character-dialog",
    "skill-dialog",
    "lbtn",
    "online-gift",
    "online-chat"
]
```

这样功能代码可以判断：

```js
style.hasCapability("online-gift")
```

而不是：

```js
style === "online"
```

---

# 十六、热插拔定义

## 第一阶段支持：

```text
发现模块
安装模块
启用模块
禁用模块
加载模块
更新模块
删除模块
切换样式
```

## 第一阶段不要求：

```text
对局中真正无副作用地卸载已经执行的JS
```

## 推荐切换：

```text
保存设置
↓
结束当前运行环境
↓
game.reload()
↓
加载目标模块
```

---

# 十七、安装流程

标准流程：

```text
用户点击安装
↓
读取Manifest
↓
检查Core版本
↓
解析依赖
↓
下载文件
↓
临时目录写入
↓
检查文件结构
↓
SHA256校验
↓
Manifest校验
↓
安装到正式目录
↓
更新installed.json
↓
注册模块
↓
提示安装成功
```

任何步骤失败：

```text
不得破坏当前已安装模块
```

---

# 十八、更新流程

禁止：

```text
删除旧版本
↓
开始下载新版本
```

必须：

```text
下载新版本
↓
验证
↓
安装到新版本目录
↓
更新current
↓
旧版本保留
```

新版本启动失败时：

```text
回退旧版本
```

---

# 十九、卸载流程

用户请求删除：

```text
检查当前是否正在使用
↓
如果正在使用：
    提示需要切换其他样式
↓
检查是否被其他模块依赖
↓
若存在依赖：
    禁止直接删除
↓
删除模块
↓
清理引用
↓
更新installed.json
```

---

# 二十、失败保护

任何模块加载失败不得导致整个十周年UI崩溃。

例如：

```text
Online模块损坏
```

应该：

```text
Core正常
默认样式正常
Online不可用
显示错误信息
```

而不能：

```text
整个扩展白屏
```

---

# 二十一、旧版本兼容

必须考虑目前用户已经安装旧版十周年UI。

第一版模块化上线以后：

```text
检测旧目录
↓
识别旧资源
↓
决定兼容模式
```

推荐至少存在：

```text
Legacy Mode
```

在转换期间：

```text
旧版单体资源可以继续运行
```

而不是升级后直接要求用户重新下载几十MB。

---

# 二十二、构建系统目标

当前：

```text
pnpm build
↓
dist
↓
一个完整ZIP
```

最终：

```text
pnpm build
↓
dist/core
dist/modules/decade
dist/modules/mobile
dist/modules/online
...
↓
分别生成ZIP
↓
生成module-index.json
```

同时保留：

```text
完整包
```

这样方便：

```text
新用户一键安装
```

---

# 二十三、必须同时保留两类发行包

## Full Package

```text
十周年UI-full-x.x.x.zip
```

包含：

```text
Core
全部官方模块
全部官方资源
```

用于：

```text
离线
网络受限
首次完整安装
```

---

## Modular Package

```text
十周年UI-core-x.x.x.zip
十周年UI-decade-x.x.x.zip
十周年UI-mobile-x.x.x.zip
十周年UI-online-x.x.x.zip
...
```

用于：

```text
按需下载
更新
热插拔
```

---

# 二十四、构建验证

每次构建必须检查：

```text
Core存在
Manifest存在
所有模块Manifest可解析
模块ID唯一
版本合法
文件路径正确
依赖不存在循环
所有entry存在
CSS引用资源存在
JS引用模块存在
```

---

# 二十五、资源依赖分析

这是P0最重要的任务之一。

必须建立：

```text
文件 → 模块
```

以及：

```text
资源 → 使用者
```

例如：

```text
ui/assets/lbtn/OL_line/xxx.png
    ↓
online
yjcm
baby
...
```

如果一个文件被多个模块使用：

```text
Shared
```

而不能简单复制。

---

# 二十六、CSS依赖分析

必须检查：

```text
@import
url(...)
background-image
font-face
```

特别关注：

```text
../../assets
../../../assets
```

这种相对路径。

模块拆分后最容易出现：

```text
CSS文件正确
但图片路径失效
```

因此构建阶段必须加入资源引用检查。

---

# 二十七、JS依赖分析

重点扫描：

```text
import
dynamic import
window.xxx
decadeUI.xxx
app.xxx
```

以及：

```text
lib.xxx
game.xxx
ui.xxx
get.xxx
ai.xxx
_status.xxx
```

确认模块是否偷偷依赖另一个Style。

---

# 二十八、资源大户专项处理

当前仓库最大的价值不在JS，而在：

```text
ui
image
assets
audio
```

后续必须优先处理：

```text
大型图片
Spine
音频
卡牌皮肤
字体
```

尤其：

```text
image/card-skins
```

建议独立考虑。

例如：

```text
card-skin-online
card-skin-decade
card-skin-caise
card-skin-gold
```

不要强制跟UI样式绑定。

---

# 二十九、第一批模块

第一阶段只实现：

```text
core
decade
mobile
```

不要一开始同时拆：

```text
online
yjcm
baby
codename
```

先完成：

```text
Core
+
默认十周年
+
移动版
```

验证完整生命周期。

---

# 三十、第二批模块

第一阶段稳定后再：

```text
online
yjcm
```

---

# 三十一、第三批模块

最后：

```text
baby
codename
其他样式
第三方样式
```

---

# 三十二、Feature模块拆分策略

Feature 不应该一开始全部拆。

优先选择：

```text
动态皮肤
卡牌皮肤
击杀特效
```

这些资源相对独立，适合测试。

---

# 三十三、P0：架构审计

## 目标

只分析，不大规模改代码。

## Agent必须完成：

### 1. 完整源码清单

统计：

```text
src
ui
image
audio
assets
```

### 2. JS依赖图

### 3. CSS依赖图

### 4. 资源依赖图

### 5. Style引用图

### 6. Shared资源候选

### 7. Feature候选

### 8. Core候选

### 9. 高风险文件

特别标记：

```text
decadeUI.js
content.js
precontent.js
decadeModule.js
app.js
overrides/*
```

### 10. 生成报告

建议：

```text
docs/modularization-audit.md
```

---

# 三十四、P0验收标准

P0不得要求：

```text
功能改变
```

必须：

```text
代码行为不发生改变
```

最终必须回答：

```text
哪些文件属于Core
哪些属于Style
哪些属于Feature
哪些属于Shared
哪些不能拆
为什么
```

---

# 三十五、P1：建立模块基础设施

新增：

```text
ModuleManager
StyleRuntime
ResourceLoader
ManifestParser
PackageInstaller
ModuleRegistry
```

暂时不真正移动大型资源。

---

# 三十六、P1验收

必须支持：

```js
moduleManager.list()

moduleManager.get(id)

moduleManager.isInstalled(id)

moduleManager.getManifest(id)
```

暂不要求真正下载。

---

# 三十七、P2：公共依赖改造

目标：

```text
公共代码
公共资源
公共API
```

全部从具体Style中抽离。

重点：

```text
STYLE_TO_SKIN
getCurrentSkin
公共插件接口
资源路径
```

---

# 三十八、P2验收

旧版十周年：

```text
所有功能正常
```

并且：

```text
所有Style-specific逻辑不再强行写死到Core
```

---

# 三十九、P3：制作第一个Style Pack

目标：

```text
decade
```

最终：

```text
Core
+
decade
```

即可启动完整十周年UI。

---

# 四十、P3验收

删除本地：

```text
decade
```

必须：

```text
十周年样式不可用
Core仍正常
```

重新安装：

```text
decade
```

必须恢复。

---

# 四十一、P4：制作第二个Style Pack

目标：

```text
mobile
```

测试：

```text
安装
启用
切换
更新
卸载
```

---

# 四十二、P5：真正实现下载器

必须支持：

```text
HTTP下载
进度
失败重试
取消
SHA256
临时文件
安装
```

注意：

下载器不得假设一定联网成功。

---

# 四十三、P6：模块市场/管理界面

增加：

```text
模块管理
```

推荐UI：

```text
模块名称
版本
已安装/未安装
启用/禁用
大小
更新
卸载
依赖
兼容性
```

示例：

```text
十周年
已安装 1.5.0
[当前使用]

移动版
未安装
[安装]

Online
1.2.0
有更新
[更新]
```

---

# 四十四、P7：接入所有官方样式

依次：

```text
Online
一将成名
欢乐三国杀
名将杀
```

每完成一个：

```text
单独PR
单独测试
单独回滚
```

不要一次性提交全部。

---

# 四十五、P8：Feature Pack

拆分：

```text
dynamic-skin
kill-effect
card-skin
progress-bar
```

建立正式Feature API。

---

# 四十六、P9：构建系统全面模块化

最终：

```text
pnpm build
```

必须自动生成：

```text
core.zip
decade.zip
mobile.zip
online.zip
yjcm.zip
...
module-index.json
```

并进行完整校验。

---

# 四十七、P10：GitHub Release

建立：

```text
Release
```

结构：

```text
Core
Official Style Packs
Feature Packs
Full Package
module-index.json
```

所有下载链接必须可被客户端解析。

---

# 四十八、P11：自动更新

客户端：

```text
启动
↓
读取本地模块版本
↓
读取远程模块索引
↓
比较版本
↓
提示更新
```

用户可以：

```text
只更新Core
只更新Online
只更新移动版
```

而不是每次下载完整UI。

---

# 四十九、P12：回滚

必须支持：

```text
当前模块损坏
↓
自动恢复上一版本
```

最少保留：

```text
当前版本
上一版本
```

---

# 五十、P13：旧版本迁移

开发：

```text
LegacyDetector
```

自动判断：

```text
旧单体UI
新版模块化UI
```

并制定迁移策略。

---

# 五十一、P14：最终测试

至少测试：

## 安装

```text
首次安装
重复安装
中途失败
下载失败
校验失败
```

## 模块

```text
安装
启用
禁用
更新
卸载
重新安装
```

## 样式

```text
十周年
移动版
Online
一将成名
...
```

## 平台

```text
PC
手机
横屏
移动端
```

## 游戏模式

根据现有代码实际支持情况测试：

```text
常规身份
国战
斗地主
其他兼容模式
联网
```

---

# 五十二、每一个模块都必须有独立测试表

例如：

```text
tests/modules/mobile.md
```

内容：

```text
[ ] manifest
[ ] dependency
[ ] installation
[ ] loading
[ ] CSS
[ ] JS
[ ] image
[ ] audio
[ ] desktop
[ ] mobile
[ ] reload
[ ] uninstall
[ ] reinstall
```

---

# 五十三、PR拆分规则

以后不允许做：

```text
一个PR：
Core + 所有资源迁移 + 全部Style + 下载器
```

建议：

```text
PR1 ModuleManager
PR2 StyleRuntime
PR3 ResourceLoader
PR4 Core解耦
PR5 decade Pack
PR6 mobile Pack
PR7 installer
PR8 UI管理器
PR9 online Pack
...
```

每个PR必须：

```text
可单独构建
可单独测试
失败可以回滚
```

---

# 五十四、Agent执行规范

以后给Agent的任务必须包含：

```text
1. 当前阶段
2. 总任务书对应章节
3. 本次修改范围
4. 明确禁止事项
5. 验收标准
6. 测试要求
7. 完成后输出报告
```

Agent不得擅自：

```text
改变架构目标
删除旧兼容逻辑
修改无关功能
移动大量资源而不分析依赖
新增第二套重复系统
```

---

# 五十五、Agent输出规范

每次完成后必须返回：

```text
一、修改文件

二、修改内容

三、架构影响

四、依赖变化

五、测试结果

六、发现的问题

七、尚未完成事项

八、下一阶段建议
```

尤其必须明确：

```text
是否改变旧行为
```

---

# 五十六、长期禁止事项

## 禁止1

为了快速实现热插拔，重新写一套完全独立于现有：

```text
app
plugin
loader
```

的系统。

优先重构已有能力。

---

## 禁止2

把所有资源简单复制进不同Pack。

---

## 禁止3

模块之间直接访问其他模块私有路径。

例如禁止：

```text
online模块直接写死：
extension/十周年UI/modules/mobile/...
```

---

## 禁止4

第三方模块直接修改Core内部变量。

必须通过公开API。

---

## 禁止5

为了支持模块化而顺手修复大量无关Bug。

如果发现Bug：

```text
记录
另开任务
```

---

# 五十七、兼容API策略

为了避免未来大量返工，Core必须逐渐形成稳定API。

例如：

```js
decadeUI.modules
decadeUI.moduleManager
decadeUI.resource
decadeUI.style
decadeUI.events
decadeUI.version
```

模块只依赖这些公开接口。

---

# 五十八、第三方模块最终目标

最终希望第三方作者只需要：

```text
manifest.json
index.js
styles/
assets/
```

就可以制作：

```text
我的UI主题
```

然后：

```text
放到模块仓库
↓
生成manifest
↓
十周年UI发现
↓
用户安装
↓
自动加载
```

Core 不需要为每个新主题修改一次。

---

# 五十九、成功标准

整个工程最终完成的标志，不是：

```text
“可以下载ZIP”
```

而是：

```text
用户只安装Core
+
按需安装样式
+
样式能够独立更新
+
样式能够独立卸载
+
公共资源不会重复
+
模块损坏不会拖垮Core
+
旧用户能够迁移
+
完整包仍然存在
+
构建系统能够自动生成所有模块
+
第三方能够按照Manifest规范开发模块
```

---

# 六十、推荐最终文件结构

最终仅作为目标，不要求一次完成：

```text
十周年UI/
│
├─ extension.js
├─ info.json
│
├─ src/
│   ├─ core/
│   │   ├─ bootstrap.js
│   │   ├─ app.js
│   │   ├─ moduleManager.js
│   │   ├─ styleRuntime.js
│   │   ├─ resourceLoader.js
│   │   ├─ packageInstaller.js
│   │   ├─ manifest.js
│   │   ├─ registry.js
│   │   ├─ compatibility.js
│   │   └─ rollback.js
│   │
│   ├─ features/
│   ├─ overrides/
│   ├─ animation/
│   └─ ...
│
├─ modules/
│   ├─ decade/
│   ├─ mobile/
│   ├─ online/
│   ├─ yjcm/
│   ├─ baby/
│   └─ codename/
│
├─ features/
│   ├─ dynamic-skin/
│   ├─ kill-effect/
│   └─ card-skin/
│
├─ shared/
│   ├─ fonts/
│   ├─ spine/
│   └─ common/
│
├─ data/
│   ├─ module-index.json
│   └─ installed.json
│
└─ docs/
    ├─ modularization-audit.md
    ├─ module-spec.md
    ├─ api.md
    └─ testing.md
```

---

# 六十一、当前真正开始的位置

## 当前阶段：P0

### 当前唯一任务：

**对现有仓库进行完整模块化审计。**

暂时不要求：

```text
拆目录
删除文件
重写样式
制作下载器
```

必须优先得到：

```text
Core依赖地图
Style依赖地图
Feature依赖地图
Shared资源地图
```

并找出：

```text
高耦合点
危险全局修改
隐式依赖
跨Style依赖
共享资源
无法直接拆分的模块
```

---

# 六十二、P0最终产物

必须至少产生：

```text
docs/modularization-audit.md
```

内容至少包括：

```text
1. 当前架构总览

2. Core候选文件

3. Style Pack候选文件

4. Feature Pack候选文件

5. Shared Resource候选文件

6. JS依赖关系

7. CSS资源引用关系

8. 图片/音频/assets依赖关系

9. 当前newDecadeStyle耦合点

10. 全局override风险点

11. 模块化拆分风险

12. 推荐迁移顺序

13. 第一阶段建议拆分清单

14. 暂不应拆分的内容

15. 回滚方案建议
```

---

# 六十三、当前工程状态记录

截至本任务书建立时：

```text
Core模块化基础：已有
插件系统：已有
Skin动态加载：已有
CSS动态加载：已有
ZIP导入：已有
自动构建：已有
自动打包：已有

真正的ModuleManager：尚未完成
真正的StyleRuntime：尚未完成
Manifest体系：尚未完成
模块依赖系统：尚未完成
独立安装器：尚未完成
在线模块索引：尚未完成
版本回滚：尚未完成
旧版本迁移：尚未完成
```

因此工程方向不是推倒重来，而是：

```text
已有模块化基础
        ↓
统一接口
        ↓
解耦
        ↓
资源分层
        ↓
正式Module化
```

---

# 六十四、后续任务判断规则

以后任何新的需求，都必须先判断它属于：

```text
Core
Style
Feature
Shared
Build
Installer
Runtime
Compatibility
Test
```

如果一个需求同时涉及多个层级：

```text
先拆责任边界
再实施
```

不得因为功能很小就绕过模块体系。

---

# 六十五、最终愿景

最终十周年UI应该从：

```text
“一个包含所有资源的大型扩展”
```

演化成：

```text
“一个负责运行与管理UI模块的平台”
```

用户最终体验应该类似：

```text
十周年UI
────────────────────
核心版本：1.5.0

当前样式：
● 十周年

已安装：
✓ 十周年
✓ 动态皮肤
✓ 公共字体

可安装：
○ 移动版      12 MB
○ Online      18 MB
○ 一将成名     9 MB
○ 欢乐三国杀   11 MB
○ 名将杀       8 MB

可更新：
Online 1.1 → 1.2

[模块管理]
[检查更新]
```

最终目标是：

```text
小核心
+
按需下载
+
模块独立升级
+
资源复用
+
安全回滚
+
第三方扩展
```

而不是：

```text
每次更新都下载100MB+
```

---

# 六十六、最高优先级规则

本项目所有后续任务必须遵守以下优先级：

```text
正确性
>
兼容性
>
模块边界
>
可维护性
>
性能
>
下载体积
>
开发便利性
```

不得为了：

```text
减少几MB
```

而牺牲：

```text
架构稳定性
兼容性
可回滚性
```

---

# 六十七、当前任务指针

```text
当前阶段：P0
当前任务：模块化架构审计
状态：未开始

下一阶段：P1
目标：ModuleManager + StyleRuntime + ResourceLoader基础设施
```

以后每次继续本项目时，优先查看：

```text
当前阶段
当前阶段目标
前一阶段验收结果
当前阻塞问题
```

只有上一阶段达到验收标准，才进入下一阶段。

---

# 六十八、变更记录

## v1.0

建立本任务书。

当前总体路线：

```text
P0 审计
→ P1 模块基础设施
→ P2 公共依赖解耦
→ P3 十周年Pack
→ P4 移动版Pack
→ P5 下载器
→ P6 模块管理界面
→ P7 全部Style
→ P8 Feature Pack
→ P9 模块化构建
→ P10 Release
→ P11 自动更新
→ P12 回滚
→ P13 旧版本迁移
→ P14 全量测试
```

任何未来修改必须优先遵循本路线；如果源码现实情况证明路线需要调整，应先记录调整原因和影响，再修改阶段计划。

## v1.1（2026-09-27）

- **P0 审计完成并验收通过**（报告：`docs/modularization-audit.md`）。
- **仓库决策**：zziyoo/decadeUi-Stars 作为独立开发仓库，已迁入原版 v1.4.2 全部源码作为开发基线；原版仓库（zziyoo/decadeUi）与本地原版目录保持不动，玩家继续使用原版扩展。
- **开发版命名**：定为「十周年UI-Stars」（info.json name）。运行时路径为 `extension/十周年UI-Stars/`，配置键前缀为 `extension_十周年UI-Stars_`（含连字符，代码中一律方括号访问 `lib.config["extension_十周年UI-Stars_xxx"]`）。开发版与原版不可在同一游戏环境同时启用。
- **P1 模块基础设施完成**（任务书§35-§36）：
  - 新增 `src/core/`：manifest.js、registry.js、builtInModules.js、moduleManager.js、styleRuntime.js、resourceLoader.js、packageInstaller.js、moduleSystem.js（8文件，纯逻辑部分不依赖 noname，可在 Node 独立测试）。
  - STYLE_TO_SKIN 收口为 styleRuntime.js 单一数据源（原 decadeModule.js 与 ui/constants.js 两份定义删除，后者 re-export 保持兼容）；顺带移除死代码 STYLE_TO_INDEX（其值与实际 playerN.css 序号逻辑相反）。
  - decadeUI 公开API挂载：modules / moduleManager / resource / style / packageInstaller / version。
  - PackageInstaller 为骨架（install/update/uninstall 返回 P1_UNSUPPORTED，真正实现在 P5）。
  - 验证：node 冒烟测试通过（tests/p1-smoke.test.mjs）、154 个 JS 全量语法校验通过、vite 构建成功。
- 阶段推进：**P1 完成，待验收后进入 P2（公共依赖解耦）**。
