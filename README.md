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
当前阶段：P9（构建系统模块化）✅ 代码完成
当前任务：pnpm build 现在自动产出 dist/release/{7 个分包}.zip + module-index.json
          并在同一次运行里做完整校验（--verify 复跑）。zip 根直接是 manifest.json、
          条目 POSIX 路径、不写目录条目（否则同样内容两次构建摘要不同）；
          索引 url 写裸文件名，绝对化只由安装器 resolveModuleUrl(url, indexUrl)
          一处负责且对绝对地址幂等；fetchIndex 回带 indexUrl，窗口把 indexUrl 与
          index 一起交给 install/update（顺带接通了 §11 依赖自动安装在界面上
          一直走不到的分支）。Core 本轮不列为可安装包（无包形态）
前置：P8 两刀 ✅（featureRuntime + kill-effect 门控；card-skin 拆包 + 双根 + §57 兼容修复）
状态：纯代码 / Node 验证通过；游戏内实测与 Android 真机项并入收尾清单
      （docs/PROGRESS.md §八「P8 部分」P~Z6 与「P9 部分」R1~R6），不阻塞推进

下一步：P10 GitHub Release（§四十七）。发布结构 Core / Official Style Packs /
        Feature Packs / Full Package / module-index.json；本轮产物已可直接上传。
        建 Release、传资产、推 tag 由维护者本人执行。
        真机首验重点：本体 JSZip 2.7 能否解开 jszip 3.10 写的包（§五 13）。

注：本指针自 v1.1 起长期失更，历次阶段结论以
「六十八、变更记录」与 docs/PROGRESS.md 为准。
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

## v1.2（2026-09-27）

- **P2 公共依赖改造完成**（任务书§37-§38），旧行为完全保持：
  - **样式配置键收口**：styleRuntime 新增模块级 `getStyleConfigKey()` / `readRawStyleValue()` / `getExternalPluginFileName()`；全代码库 `newDecadeStyle` 配置键字面量归零（只允许在 styleRuntime.js 拼接）；38 处历史读取点（25 文件）迁移为 `readRawStyleValue()`，原始语义零变化（不归一化、undefined 透传）。
  - **main1/2/3.js 映射迁出 Core**：app.js 的 styleFileMap 移至 `styleRuntime.getExternalPluginFileName()`，第三方插件约定本身不变（兼容API）。
  - **资源路径动态化**：`${lib.assetURL}extension/十周年UI-Stars/`（36处）、concat 形式、反引号相对路径、`../` 相对音频、playAudio 分段参数、extensionMenu 键、skins 字符串路径常量——全部改为 `${decadeUIPath}` / `${decadeUIName}` 动态形式，硬编码路径字面量归零。**扩展名从此只由 info.json 的 name 决定，再次改名不再需要全库替换。**
  - 明确不做（记录）：其余 45 个非样式配置键字面量、样式比较逻辑转能力判断（`hasCapability`）——按任务书§14 分阶段原则留待 P3/P4。
- 验证：154 个 JS `node --check` 全过；p1/p2 冒烟测试全过；vite build 成功。
- 阶段推进：**P2 完成，待验收后进入 P3（制作 decade Style Pack）**。

## v1.3（2026-09-27）

- **P2 验收阻塞问题修复**（不改既有功能行为，除修复本身）：
  - **extension.js 首次初始化顺序修复**：恢复"扩展目录名锚点 → 读取 info.json → 取得 name → 注入 decadeUIName/decadeUIPath"的正确顺序；此前 info.json 读取行被错误改写为引用尚未注入的 `window.decadeUIPath`，导致首次启动必然失败。
  - **ResourceLoader 正式成为模块资源路径抽象**：`getAsset(moduleId, path)` 的 moduleId 成为正式寻址参数（缺失报错）；新增 `getModuleBase(moduleId)` 作为 **P3 唯一切换层**（P2 全模块映射到扩展根，P3 切 `modules/<id>/<version>/` 只改此函数）；loadJS/loadCSS/loadImage/loadAudio 继续复用 src/core/loader.js，无第二套去重机制。
  - **业务层首批迁移**：decadeModule 的 CSS/JS 加载改为模块寻址（核心资源走 "core"，样式资源走样式模块 ID）；DynamicPlayer 的 Worker 脚本 URL 迁入 ResourceLoader。
  - **修复 3 处模块求值期回归**（component.js / ui/constants.js / didYouKnow.js）：静态 import 链上的模块求值早于 window 全局注入，模块顶层禁止引用 `decadeUIName/decadeUIPath`，必须使用目录锚点字面量或 `lib.assetURL`。
  - **测试基建**：新增 noname 解析钩子与浏览器全局桩（tests/helpers、tests/fixtures）；p2 冒烟测试覆盖 extension.js 首次初始化全流程回归、ResourceLoader 各 moduleId 寻址等值与 P3 切换点、loader.js 复用校验、StyleRuntime.getAsset 委托。
  - **统计勘误**：全量语法校验实际覆盖 **201 个 JS**（src 161 + ui 39 + extension.js 1），此前"154"漏计 ui/ 的 39 个。
- 是否移动资源：**没有**。是否进入 P3：**没有**。

## v1.4（2026-09-27）

- **P3-2 / P3-3 / P4 完成并推送**（decade 皮肤 JS、shizhounian 资产去重、mobile 样式包）；**yjcm/online/baby/codename 四包批量拆分已在磁盘完成但仍未提交**（工作区在制品，见交接文档§四末）。
- **P5 真正实现下载器（任务书 §42）完成**，四项流程按 §17/§18/§19/§11 落地：
  - `src/core/downloader.js`（新增）：HTTP 下载、字节进度、失败重试（线性退避，默认 3 次上限）、取消（AbortSignal）、超时、SHA256；错误分类 `CANCELLED/TIMEOUT/NETWORK/HTTP/SHA_MISMATCH/SHA_UNAVAILABLE/INVALID_URL`。**不假设联网成功**：断网/404/超时全部以结构化结果返回，不抛异常、不触碰已安装内容。传输层可注入。
  - `src/core/packageInstaller.js`（P1 骨架 → 正式实现）：`install/update/uninstall/fetchIndex/listInstalled/localVersions/isAvailable`。安装＝依赖解析 → 下载 → 临时目录落地 → **以落盘内容算 SHA256** → 解压 → 结构与 Manifest 校验（含 §24 entry 存在性与 Core 版本检查）→ 改名发布到 `modules/<id>/<version>/` → 原子更新 `modules/installed.json` → 以 `source:"installed"` 注册（**直接对接 P3 的 getModuleBase，不建第二套寻址**）。更新先建新版本再切指针、**旧版本目录保留**（§18）；卸载按 §19 顺序做"使用中/被依赖/是否独立安装"三重前置检查，**绝不删单体资源**。任何一步失败清理临时产物并回滚让位目录（§17末/§20）。
  - `src/core/moduleIo.js`（新增）：安装器端口的运行时实现，复用本体 `game.promises.*` / `game.checkFile` / `lib.node.fs.rename` 与自带 JSZip（加载方式同 `app.importPlugin`），**未新建第二套文件/解压系统**（§56 禁止1）；含 zip-slip 路径越界防护。
  - 配套：`registry.unregister()`（版本切换）、`manifest.js` 新增 `compareVersions/checkCoreRequirement`、`moduleSystem.js` 注入端口、`decadeUI.packageInstaller` 公开 API 不变（§57）。
  - **顺带修复 P3-1 遗留回归**：包分支以 `includes("/window/")` 过滤手机布局，而包内已把 `window/` 目录扁平化为 `<name>-window.css` → 条件恒不成立，六个包在手机布局下各多加载 2 个 window CSS。改为按包内命名匹配，恢复与单体等价的行为。
- 验证（**全部为静态 / Node 环境验证，未进游戏实测**）：210 个 JS `node --check` 全过；`tests/p5-installer.test.mjs` 新增并通过（覆盖下载六类失败、安装五类校验失败零落地、依赖缺失/循环、更新保旧版、发布失败回滚、状态写失败撤销、台账损坏拒改、卸载四分支、zip-slip 六类）；P1/P2/P3 回归全过；verify-pack 881 可达/0 未知缺失；vite build 成功。
- 是否改变旧行为：**仅上述 window CSS 回归修复一处**（属恢复原行为）；其余为新增能力，P1/P2/P3/P4 的既有加载路径未改。
- 阶段推进：**P5 完成，待游戏内实测验收（清单见交接文档§八）后进入 P6（模块管理界面）**。

## v1.5（2026-09-27）P5 审查修复：可靠性与安全边界

不改架构、不动 P3/P4 既有抽象（`getModuleBase`/ResourceLoader/StyleRuntime/四包产物均未触碰），只收紧 P5 安装器本身：

- **IO 不再可能永久 pending**：`src/core/moduleIo.js` 重写为"只落定一次"的适配层（未改 noname 本体）。桌面端全部使用 `lib.node.fs` 的真实 error callback，目录创建用自建递归 `fs.mkdir({recursive})` **取代** `game.ensureDirectory`（后者失败路径只 `console.log`、不回调，会让 `game.promises.writeFile` 永挂）；无 Node fs 的平台先 `game.createDir`（实现里有真 errorCallback）再写文件；两者都不回调时才由 watchdog 以 `IoError(ioCode:"IO_STALL")` **reject**——真实错误优先，兜底也判失败而非成功。安装器侧新增 `toIoFailure()`，把目录创建/读写失败归入 `IO_FAILED` / `IO_STALL` 结构化返回。
- **SHA256 信任来源唯一化**：只有外部安装目标（`expectedId` / `expectedVersion` / `expectedSha256`，兼容 `id`/`version`/`sha256` 别名）能作判据；顺序为「外部摘要 → 落盘内容实际摘要 → 不符即 `SHA_MISMATCH` 且零落地 → 解压 → 包内 `manifest.id/version` 必须等于外部目标 → 结构校验」。包内 `manifest.sha256` 属自述，最多产生 warning，不参与裁决；缺外部摘要允许本地/开发安装，但结果 `hashVerified:false`、`installed.json` 记 `sha256:""`。
- **事务一致性**：安装/更新的旧内容让位目录（`.replacing-*`）**保留到 `installed.json` 写成功之后**才清理；`undoPublish()` 统一回滚，回滚自身失败返回 `ROLLBACK_FAILED` + `rolledBack:false` + `residual` 路径（不再"假装成功"）。卸载改为「`modules/<id>/<ver>` → 改名 `.removing-*` → 写台账 → 成功后才真删」，让位失败返回 `UNINSTALL_FAILED`、台账写失败原样改回，杜绝"目录已删但台账称已安装"。原子性如实描述：`io.capabilities.atomicRename` 与 `isAvailable().atomicRename` 上报，无 Node fs 平台走非原子 copy+remove。
- **force 边界**：`uninstall` 的 `force` 不再绕过任务书§19 的三条硬检查——使用中（`IN_USE`）、被依赖（`DEPENDED`）、core 一律拒绝；`force` 只对安装侧"同版本覆盖"有意义。
- 新增/更新测试：SHA 信任 6 类、事务 6 类（含"更新失败旧版本仍可用""首装失败不留正式目录""回滚失败"）、IO 失败与卡死 5 类（含 3 秒 `Promise.race` 断言不 pending）、force 边界双跑；`.gitignore` 增 `modules/*/*.removing-*/`。
- 验证（**全部静态 / Node 环境，未进游戏**）：215 个 JS/mjs `node --check` 全过；P1/P2/P3/P5 四套测试全过；verify-pack 881 可达 / 0 未知缺失；check-skin-imports 37 可达 / 0 缺失；`pnpm build` 成功。
- 是否改变旧行为：P1~P4 与四包的运行时行为**未改**；变化仅在 P5 安装器的 API 语义（`spec.sha256`→外部 `expectedSha256` 判据、卸载不再被 force 绕过、新增 `ROLLBACK_FAILED/UNINSTALL_FAILED/IO_STALL` 结果码、`installed.json` 条目新增 `hashVerified`）。
- 提交：与四包拆分（`33da307`）分开、不 squash；P5 首版与本次审查修复各一笔。

## v1.6（2026-09-27）P5 补充修复两笔 + 真机实测降级为收尾清单

- **补充修复一（`df2afea`）跨平台文件移动与 IO 吞错**：
  - `moduleIo.movePath` 按源类型分流。旧实现用 `copyTree + removeTree` 搬**文件**时，`copyTree` 只列举目录条目 → "一个字节都不复制、却把源删掉"（Android/SAF 上表现为 `installed.json` 永远没被替换、临时文件消失，安装"成功"但重启后模块无法恢复注册）。文件分支改为「读源 → 写目标 → **回读逐字节校验** → 才删源」，非 file/dir 类型显式报错。
  - `packageInstaller.kindOf` 不再把权限/磁盘/`IO_STALL` 异常吞成 `null`（entry 检查、已在位预检、发布目标检查、卸载根检查、`localVersions` 五处各自转 `IO_FAILED`/`IO_STALL`），杜绝"磁盘目录仍在却被删台账/被覆盖"的路径。
  - `writeInstalled` 在无原子 rename 平台改为「备份旧台账 → 提交 → 回读校验 JSON → 失败即还原」，还原失败抛 `StateCommitError`，安装/卸载两侧统一报 `ROLLBACK_FAILED` + `rolledBack:false` + `residual`；卸载让位恢复失败改报 `ROLLBACK_FAILED`；空 `installed.json` 判 `INSTALLED_CORRUPT`（不再当空台账覆盖）。
- **补充修复二（`29a69e3`）非原子平台 file → 已存在文件的目标事务**：`movePath` 的 file 分支改为专用事务 `moveFileNonAtomic`——写 `<dest>.moving-<txn>` 并校验（正式目标尚未被触碰）→ 读旧目标并写备份 `<dest>.moving-backup-<txn>` 且校验 → 提交正式目标并回读校验 → 删源 → 清理事务件。提交失败：恢复旧目标、源保留；**提交已校验但删源失败：明确报 `IO_FAILED` 且不回滚已提交目标**（复制已完成，仅源残留）；旧目标恢复失败：`IoError(IO_ROLLBACK_FAILED)` + `residual`，并保留备份作为人工恢复来源。目录搬运保持 `copyTree + removeTree` 未动。
- 验证（**纯代码 / Node**）：175 文件 `node --check` ✓；P1/P2/P3/P5 四套测试 ✓（两笔合计新增 30 个断言块）；verify-pack 881 可达 / 0 未知缺失；check-skin-imports 37 / 0 缺失；`pnpm build` ✓。
- **阶段决定（用户）**：Android/SAF 真机与游戏内实测成本极高，**P5 的实测不再作为阶段阻塞**，统一并入收尾验证清单（`docs/PROGRESS.md` §八），在收尾（P14 全量测试）阶段执行；§八 已补记 Android 已知残留面（本体 `game.checkFile` 把 `NOT_READABLE_ERR` 报成 `-1`＝不存在；Cordova `writeFile` 走 `getFile({create:true})` 不带 `overwrite`，覆盖行为未知）。
- 阶段推进：**进入 P6（模块市场/管理界面，任务书§43）**。范围已定：仿配置窗口的独立窗口 + `decadeUI.showModuleManager` / `hideModuleManager` + `Ctrl+Shift+M` + 模块源 URL 配置键（默认空，离线可演示已装/卸载链路）；本轮**不做**启用/禁用（新运行时能力，另立子任务）、不做真实 `module-index.json` 资产（留 P10）。

## v1.7（2026-09-27）P6 模块管理界面

- **新增 `src/core/moduleAdmin.js`（纯逻辑，可 Node 全量测）**：把"台账 + 模块源索引 + 注册表"合成界面行——`buildRows()` 产出每行的状态（`core / in_use / incompatible / dep_missing / update_available / installed / not_installed`）、版本/大小/依赖/兼容性文案与动作（`install / update / uninstall`，各带 `enabled` + 禁用理由）；`summarize()` 出顶部汇总；`codeText()` 覆盖 `INSTALL_CODES` 全码中文文案（未知码兜底带原码）；`resultText()` 拼 message + 告警；`formatSize()`。动作 `spec` 与 `packageInstaller.specFromIndex` 同形，可直接交给 `install/update`。
- **判定口径与后端同源**（避免"UI 说可点、安装器拒绝"）：§19 三条卸载边界（使用中 / 被依赖 / 非独立安装，`force` 不绕过）、依赖是否满足按注册表口径（同 `ensureDependencies`）、Core 兼容性复用 `manifest.checkCoreRequirement`。
- **新增 `src/features/moduleManagerWindow.js` + `module-manager-window.css`**：独立 overlay 窗口（与配置窗口同一视觉语言），列表行显示名称/状态徽标/版本/大小/依赖/兼容性，行内按钮执行安装·更新·卸载；动作进行中显示进度（阶段 + 百分比）与**取消**（AbortController，安装器返回 `CANCELLED`）；卸载与重载均需二次确认（4 秒自动复原）；窗口内可填写模块源地址（写 `moduleIndexUrl`）。
- **入口**：`decadeUI.showModuleManager()` / `hideModuleManager()`、`Ctrl+Shift+M`、配置窗口新增 `type:"button"` 行类型后的"模块管理界面"按钮。
- **新增配置键 `moduleIndexUrl`**（`src/config/definitions/misc.js` + `src/config/handlers/module-handlers.js`，本体扩展菜单与配置窗口都可编辑）：留空＝离线，仍可完整管理本地已装模块（查看/卸载/重载）；填写后 `fetchIndex` 合并出"可安装/可更新"。
- **明确不做**：启用/禁用（当前架构无此概念，属新运行时能力，另立子任务）；真实 `module-index.json` 资产与上传（P10）；热切换与对局中卸载。
- 验证（**纯代码 / Node**）：179 文件 `node --check` ✓；P1/P2/P3/P5/P6 五套测试 ✓（新增 `tests/p6-module-admin.test.mjs`：格式化 9 例、全码文案、行模型 9 行夹具、动作启用/禁用理由、summary、离线降级、缺省输入）；verify-pack 881 可达 / 0 未知缺失；check-skin-imports 37 / 0 缺失；`pnpm build` ✓（产物含 `moduleAdmin.js`、`moduleManagerWindow.js`、`module-manager-window.css`）。
- **未验证**：窗口 UI（DOM/热键/进度渲染）无法在 Node 验证，需游戏内实测——清单见 `docs/PROGRESS.md` §八「P6 部分」。

## v1.8（2026-09-28）P8 Feature 运行时 + kill-effect 门控 + P6 的 Feature 行

- **新增 `src/core/featureRuntime.js`（正式 Feature API，任务书§45）**：`define/get/list/switchOn/active/asset/cssOf/capabilityOwner`。门控判据为 `active(id) = 已声明 × 资源在场 × 开关为真`，三条任一不满足都不装载且调用方必须能安全降级；配置未播种（`undefined`）回落声明的 `defaultEnabled`，**绝不当成"关"**；未声明/未注册的 id 一律 `false` 且不抛错。纯逻辑（不 import noname、不碰 DOM），Node 全量可测。
- **Feature 两种形态，由声明的 `pack` 区分**：**门控型**（`pack:false`，资源随 Core 发布）与**拆包型**（`pack:true`，资源在 `modules/<id>/<version>/`，未装上即不可用——与 P3 样式包"样式不可用而 Core 正常"同一语义）。**用户决定**：`kill-effect` 定性为门控型，**不搬资源、`pack` 恒为 false**，原计划的"把特效资源迁入包"那一刀撤销；`card-skin` 作为下一个包（将成为第一个拆包型 Feature）。
- **启停不新增状态源**：`kill-effect` 的开关就是既有配置键 `extension_十周年UI-Stars_killEffect`（外观页"击杀特效"同一个开关）。`moduleSystem` 把 **P1 起悬空的 `moduleManager.isModuleEnabled` 钩子**真实接到 `switchOn`，`isEnabled("kill-effect")` 从此有意义，而 `core`/样式不被误伤（未声明的 id 恒 `true`）。
- **`kill-effect` 接入现有代码**：`builtInModules` 按声明注册 `type:"feature"` 模块（entry.css 备单体 `src/styles/effect.css` 与包内 `effect.css` 两套路径，按 `pack` 选用）；`setupEffects()` 只在 `active("kill-effect")` 时注册 `decadeUI.effect.line/kill/skill` 并加载 CSS；Core 调用点改为可选链 `decadeUI.effect?.kill?.()`、`decadeUI.effect?.skill?.()`；`src/styles/layout.css` 的 `@import "effect.css"` **删除**（禁用就真的什么都不加载）。`dialog` 与 `ghost` 通道**不受本 Feature 管辖**——"幻影出牌"有自己的开关 `cardGhostEffect`，始终可用。
- **CSS 单一来源**：`cssOf(id)` 返回**模块相对路径**（取自 `manifest.entry.css`），绝对地址仍由 `resourceLoader.loadCSS` → `getModuleBase` 计算，runtime 不重复持有路径、不建第二套寻址。
- **能力判断（任务书§15）**：`decadeUI.feature.capabilityOwner(name)` 供功能代码用能力而非 `style === "online"` 这类字面量判断能力归属。
- **P6 界面补 Feature 行与启用/禁用（`16c398d`）**：`moduleAdmin.buildRows` 新增 `featureStates` 入参——门控型出「内置功能 / 内置 <版本>」且**只给**启用↔禁用（动作带 `switchKey`；即使模块源索引里有它的地址也不给安装按钮），拆包型未装只给安装、装上后卸载与启停并存；无 `switchKey` 的声明不给任何动作（不许凭空造配置键）；**不传 `featureStates` 时行为逐字不变**。窗口侧 `collectFeatureStates()` 由 `featureRuntime.list()+switchOn()` 得出，`toggleFeature()` 写同一个配置键并提示"重载游戏后生效"（装载发生在 content 初始化，§16 第一阶段不要求运行时卸载已执行的 JS）。
- 测试：新增 `tests/p8-feature-runtime.test.mjs`（门控矩阵、两种 pack 形态与 CSS/asset 解析、`isModuleEnabled` 真实接线、`define` 校验、能力归属、**声明字段集契约**）与 `tests/p8-effects-gate.test.mjs`（装配层：启用→通道注册 + CSS 项、禁用→全部为空且 `ghost/dialog` 保留、再启用可恢复）；`tests/p6-module-admin.test.mjs` 增 6 类 Feature 行断言 + 真实接线用例；`tests/p1-smoke.test.mjs` 注册数 7→8、`list({type:"feature"})` 断言。
- 验证（**纯代码 / Node，未进游戏**）：182 个 JS/mjs `node --check` ✓；七套测试（P1/P2/P3/P5/P6/P8×2）全过 ✓；verify-pack 881 可达 / 17 已知上游死引用 / **0 未知缺失** ✓；check-skin-imports 37 可达 / 0 缺失 ✓；`pnpm build` ✓。
- **未验证 / 已知限制**：Feature 启停在重载前不产生"无副作用"的卸载（本次运行的 `effect.*` 通道与已插入的 CSS link 仍在）；窗口与 Feature 行的 DOM 表现、可选链降级路径需游戏内实测——清单见 `docs/PROGRESS.md` §八「P8 部分」（含 P/Q/R/S/T/U/V/W/X 八条探针）。
- 提交：`b4d8db5`（Feature 运行时与门控）、`8f89e43`（kill-effect 定性为门控型，不拆包）、`16c398d`（P6 Feature 行与启停）、本条文档，各起一笔、不 squash。

## v1.9（2026-09-28）P8 两处修复：门控边界收窄回原版语义 + 平台能力不再阻断启停

用户复查 v1.8 后指出两处问题，本轮只修这两处，未做架构扩展（没有动态 import、没有改 Vite 入口、没有重构 precontent/content、没有运行时卸载、没有提前拆 card-skin、没动 Shared 与样式包）。

- **① 模块管理窗口阻断门控型 Feature（`48a82bc`，必须修）**：`refresh()` 原先在 `packageInstaller.isAvailable()` 为 false 时写一句"本平台不支持模块安装"就**整窗提前 return**，于是 `pack:false` 的门控型 Feature 在没有文件/解压端口的平台上既看不见也点不动——可启用/禁用只是写一个配置键，根本不碰文件系统，被平台能力连带禁掉属于语义越界。改为：列表照出、台账与模块源照读（缺 io 时 `readInstalled()` 返回结构化 `NO_IO` 而不抛，`fetchIndex()` 走网络本就不需要 io），新增 `buildRows` 的 `installBlocker` 入参**只置灰** `install/update/uninstall` 三个动作，把平台理由**附加**在既有理由之前（§19 的"使用中/被依赖"不许被覆盖），`spec` 原样保留（置灰≠没有可装的东西），`enable/disable` 完全不受影响；不传该参数时行为逐字不变。汇总行与提示行如实写"本平台不支持安装/卸载；内置功能的启用/禁用仍可用"。
- **② `killEffect` 意外牵连技能特效（`d31ab7e`，必须明确）**：对照**原版** `../十周年UI` 的结论是——`setupEffects()` **无条件**注册 `line/kill/skill/ghost/dialog`，`killEffect` 配置全库只被 `src/skills/animate.js` 的击杀技能 `filter()` 读取，配置定义本身也只写"击杀敌方角色时会显示击杀特效"；**技能特效从来就没有开关**。v1.8 把三条通道一起门控属于改变旧行为，还会产生一个副作用：`playerSkill()` 先 `decadeUI.delay(2500)` 再调 `effect.skill`，关掉击杀特效的玩家会白等 2.5 秒而什么都不发生。处理方式选**保持原行为**那一支（不新增第二套配置，也不改配置名与 intro，因为它们本来就没错）：门控只作用于 `effect.kill`；`skill`/`line`/`dialog`/`ghost` 恢复无条件注册、`setupCardGhost()` 回到原位；技能特效调用点去掉可选链、恢复原版的 `decadeUI.effect.skill(...)` 直调（击杀那一路保留可选调用，因为它真会被门控）。
- **特效 CSS 归属回到 Core**：`src/styles/effect.css` 同时含击杀窗口 `.effect-window` 与技能特效 `.skill-name`，**没有单一 Feature 归属**，随 `kill-effect` 开关卸载会打掉技能特效的样式。故 `layout.css` 恢复 `@import "effect.css";`（位置与原版一致，不改级联优先级），`kill-effect` 的 manifest `entry.css` 置空并删除 `FEATURE_ENTRY` 映射——登记了却不加载、或加载了却随击杀开关卸载，都是双重语义。`featureRuntime.cssOf()/asset()` 作为 Feature 公开寻址 API 保留，供自带资源的拆包型 Feature 使用。声明同步改为 `name:"击杀特效"`、`capabilities:["kill-effect"]`（不再声明 `skill-effect`）。
- 测试（两处都先 RED 后 GREEN）：`tests/p6-module-admin.test.mjs` 新增 4 块平台降级断言（installer unavailable × `pack:false` × 有 `switchKey` ⇒ 仍生成 `disable` 且 `enabled:true`；已装拆包型 `uninstall` 置灰且点名缺失端口、`disable` 照旧可点；未装拆包型 `install` 置灰但 `spec.url` 保留；"使用中"原理由与平台理由并存；缺省路径行为不变）。`tests/p8-effects-gate.test.mjs` 按原版语义重写（默认 `kill/skill/line` 都在且 `setupEffects` 不再自行 `loadCSS`；禁用后**仅** `kill` 缺席，`skill/line/ghost/dialog` 必须在；再开启可恢复），并锁住边界依据：`layout.css` 仍 `@import effect.css`、`effect.css` 含 `.skill-name` 且 `skill.js` 确实创建该元素、技能特效调用点不读 `killEffect`、击杀技能 `filter` 继续读该键。`tests/p1-smoke.test.mjs` 改断言 `entry.css` 为空、`capabilities` 不含 `skill-effect`。
- 验证（**纯代码 / Node，未进游戏**）：182 个 JS/mjs `node --check` ✓；七套测试（P1/P2/P3/P5/P6/P8×2）全过 ✓；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓。
- 游戏内必须复核（`docs/PROGRESS.md` §八「P8 部分」新增/改写 R、T、V、W2、Y 五行）：禁用击杀特效并重载后 `typeof decadeUI.effect.skill` 仍为 `"function"`、`.skill-name` 计算字号仍为 `55px`、发动技能的特效应**照常出现**（不该白等 2.5 秒）；无文件端口平台的窗口仍应列出 Feature 行并可启停。
- 提交：`48a82bc`（P6 平台能力降级）与 `d31ab7e`（P8 门控边界）各一笔，与本条文档分开，均未 squash。

## v1.10（2026-09-28）P8 第二刀：card-skin 拆包（第一个 `pack:true` 的 Feature）

范围三项由用户批准：一次搬完（P3/P4 惯例）、未装包时内置五项从下拉消失、`switchKey:null` 只资源门控。

- **Feature 声明**：`BUILT_IN_FEATURES += { id:"card-skin", name:"卡牌皮肤", capabilities:["card-skin"], switchKey:null, defaultEnabled:true, pack:true }`。`active = 已声明 × 包真的装上了 × (无开关→真)`。**没有新增布尔开关**：要不要用卡面、用哪套，本来就归 `cardPrettify`（取 `off` 即关闭）——再造一个开关就是第二套状态源，还会与"卸载包"互相矛盾（v1.9 的教训直接落在这里）。
- **单一决策点 `resourceLoader.getModuleRel(id)`**：模块根**相对扩展根**的 POSIX 路径（未独立安装返回 `""`）。`getModuleBase()` 改为 `扩展根 + getModuleRel()`，于是"给 DOM 的 URL 根"与"给 `game.getFileList` 的目录扫描根"来自同一个判断——之前两处各拼一套的可能性从结构上堵掉。
- **双根的真实形状**（与"扫两个根再合并"不同）：内置五套的根 = `getModuleRel("card-skin")`（装包→`modules/card-skin/1.4.2/`；未装→扩展根，而单体副本已迁走 ⇒ 扫到空 ⇒ 不可用）；玩家自建的文件夹**永远**只扫单体根 `image/card-skins/`（"丢进去重启即可用"是原版行为，保留）。`discoverDynamicSkins()` 与第三方 `window.registerDecadeCardSkin({extensionName,…})`（皮肤根在别人扩展的目录里）**一字未动**。
- **可用性唯一来源＝扫描结果**：`statics.registerSkins()` 顺带发布 `setCardSkinAvailable(key, 牌面数>0)`；配置层不再自行判断装没装包。未扫描过时乐观视为可用，防止菜单在异步扫描完成前把皮肤整体抹掉。消费端：外观页下拉改用 `getAvailableCardSkinPresets()`（未装包时内置五项自然消失，只剩「关闭」+ 玩家自建）；`skin-loader.buildSkinUrl()` 对不可用皮肤返回**空串**（不产生必 404 的地址），并顺手删掉 `window.decadeUI?.extensionName || "十周年UI-Stars"` 这个硬编码扩展名回落；`getFallbackKey()` 要求回退目标真有牌面；`skin-applier` 把"选中但无牌面"等同 `isOff`。**不改写玩家的 `cardPrettify` 值**——升级不顺手清设置。
- **文件搬迁**：`git mv` 五套（online 85 / caise 380 / decade 241 / bingkele 44 / gold 266 = **1016 文件、21,500,762 字节 ≈ 20.5MB**）进 `modules/card-skin/1.4.2/image/card-skins/`；git 侧 **1016 条 rename@100%、零增删**，历史可追。`image/card-skins/.gitkeep` 保留（该层从此只放玩家自建皮肤）。
- **包 manifest**：`type:"feature"`、`entry:{js:[],css:[]}`（卡面是数据，牌名由运行时列目录得出，无可登记入口——延续 v1.9"登记了却不加载就是双重语义"的结论）、`size` 记字节、`cardSkins[]` 存每套文件数/字节数快照、`note` 写双根约定。`modules/installed.json` 增加 `card-skin` 条目 → `registerInstalledModules()` 以 `source:"installed"` 覆盖内置登记 → 寻址自动切包根。
- **脚本**：新增 `scripts/build-card-skin-pack.mjs`（幂等；`--verify` 供门禁复跑）。校验点：每套非空、**单体根不得残留同名目录**（否则双根互相复活）、manifest 与实盘计数一致、`installed.json` 已登记、`.gitkeep` 在场。
- 测试：新增 `tests/p8-card-skin-pack.test.mjs` —— 用与本体同签名的假 `game.getFileList(dir, success(folders, files))` 目录表驱动**真实**的 `createStaticsModule()` 扫描，断言未装/已装两态下的扫描根与 URL 落点、可用性发布、下拉列表、`buildSkinUrl` 空串降级、第三方注册根不变、P6 行的动作集（未装只`安装`、已装只`卸载`、无启停按钮）。`p1-smoke` 注册数 8→9 与 feature 计数 1→2、`p8-feature-runtime` 的 `list()` 顺序补 `card-skin`。
- 验证（**纯代码 / Node，未进游戏**）：184 个 JS/mjs `node --check` ✓；**八套**测试全过 ✓；数量守恒逐套一致 ✓；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`pnpm build` ✓（`dist/modules/card-skin` 内 1017 文件，`dist/image/card-skins` 仅剩 `.gitkeep`，无重复副本）。
- **未验证 / 待游戏内实测**（`docs/PROGRESS.md` §八 新增 X、Z1~Z6）：删包后下拉只剩「关闭」+ 自建、牌面回落本体默认且无 404；取图请求确实落在 `modules/card-skin/1.4.2/…`；`getModuleRel` 与 `getModuleBase` 同源；玩家丢文件夹仍可发现并选用；老配置值不背刺；卸载/重装回路（当前无索引，"安装"钮仍灰，只能手工 zip 走 `install()`）。
- 提交：`28e1092`（双根寻址与可用性）与 `0e890c7`（1016 文件搬迁）各一笔，与本条文档分开，均未 squash。

## v1.11（2026-09-28）P8 card-skin 验收修复：第三方注册不再污染内置皮肤可用性

- **问题**：`statics.registerSkins()` 里无条件执行 `setCardSkinAvailable(skinKey, cardNames.length > 0)`，而 `registerSkins` 同时服务三条路径——内置 `card-skin` 包的扫描、第三方 `registerDecadeCardSkin()` 带 `cardNames` 的注册、第三方不带 `cardNames` 时由它去扫**自己扩展目录**的结果。原版 API 明确允许复用已有 `skinKey`（文档示例就是 `registerDecadeCardSkin({extensionName:'我的扩展', skinKey:'decade'})`），于是状态污染路径成立：内置 `decade` 扫到 241 张（可用）→ 某第三方注册同名 key 但它的目录为空 → 用 `[]` 再调一次 `registerSkins` → `isCardSkinAvailable("decade")` 被写成 `false` → `skin-applier` 把整套内置皮肤当 `off`。**这是对 §57 兼容 API 的行为回归**（P1 时期该 API 就允许这么做）。
- **修法（最小）**：`registerSkins(skinKey, baseUrl, cardNames, ext, { publishAvailability = false } = {})`；只有 `loadBuiltinSkins()` 的内部扫描传 `{ publishAvailability: true }`，第三方两条调用点保持四参、**不写** `cardSkinAvailability`。于是 availability 只描述内置 `card-skin` 资源本身；未新增第二套状态源；第三方的 URL 根仍是 `lib.assetURL + extension/<extensionName>/image/card-skins/...`；同名条目的去重优先级（内置条目先到先占）与 `READ_OK` 语义一字未改；保留第三方复用 `decade` 等已有 key 的兼容性。
- 测试：`tests/p8-card-skin-pack.test.mjs` 新增四态并先取 RED（实际失败信息 `B：第三方的空目录不许把内置 decade 整体标成不可用 —— false !== true`）—— A 装包后内置 `decade` 可用；B 第三方用 `skinKey:'decade'` 注册空目录后 `decade` 仍可用且下拉里仍在；C 第三方带 `cardNames` 时它补的牌面指向**它的**扩展根、内置同名条目不被覆盖、可用性不变；D 第三方新 key 完全不参与发布（空目录也不写出一条"不可用"，因为"不写"才等价于乐观可用），且 `READ_OK` 未被搭车改写。
- 验证（**纯代码 / Node**）：184 个 JS/mjs `node --check` ✓；八套测试全过 ✓；verify-pack 881 可达 / 0 未知缺失 ✓；check-skin-imports 37 / 0 ✓；`build-card-skin-pack.mjs --verify` 1016 文件 / 20.5MB 数量守恒 ✓；`pnpm build` ✓（确认 `dist/src/core/statics.js` 为当次重新产出）。
- 范围守护：未改双根设计、未改 card-skin 安装模型、未提前进入 P9/P10。
- 提交：`64719f3`，与 `28e1092`/`0e890c7` 分开、不 squash。

## v1.12（2026-09-28）P9：构建系统模块化——分包 zip + module-index.json + 完整校验

范围按批准的四项：只做§四十六（不碰发布）、新增 devDep `jszip`、只打已有包（core.zip 与 Full Package 留下轮）、索引 url 用相对地址。

- **构建链**：`pnpm build` = `vite build` → `build-decade-pack.mjs dist` → **`node scripts/build-release.mjs`**。后者产出 `dist/release/` 下七个 `-1.4.2.zip`（六样式 + `card-skin`）与 `module-index.json`，并在同一次运行里完整校验；`--verify` 供门禁复跑，`--list` 预览将打包的包。`dist/` 与 `*.zip` 均已在 `.gitignore`，**产物不入库**。
- **数据源唯一**：只认盘上 `modules/<id>/<version>/manifest.json`，同 id 取最新语义化版本（复用 `compareVersions`，与安装器§18 同口径）；`.replacing-*`/`.removing-*` 因不匹配版本号形状自然排除；脚本内不另存包清单。
- **zip 结构**：`manifest.json` 必须直接在根（安装器 `verifyPackageDir` §24 按根位认包，套一层 `<version>/` 会被 `STRUCTURE_INVALID` 拒收）、条目名一律 POSIX 相对路径、输出写在源目录里时不自我包含。
- **确定性（实测踩出来的）**：条目时间戳固定 `1980-01-01` + `createFolders:false`。JSZip 默认会给父目录补一条时间取**当前时间**的目录条目（DOS 时间 2 秒粒度），留着它，同样内容的两次构建就会算出不同 sha256，索引每次都在无意义地变；解压侧 `moduleIo.extract` 按路径自建目录，不需要目录条目。已证：跨 3 秒两次构建，7 个 zip 与 index 全部逐字节一致。
- **索引形态**：`{schema:1, core:{version,latest}, modules:{<id>:{name,type,latest,url,sha256,size,dependencies,core,capabilities}}}`。字段名沿用§10 与 `specFromIndex`/`specFromEntry` 已在读的名字，不改契约；`url` 写裸文件名，`sha256/size` 取 **zip 文件自身**（安装器校验的是下载落盘那段字节，不是包内文件之和）；**core 不列为可安装包**（Core 至今无包形态，混进去界面会出现装不上的 Core）。
- **相对地址解析**：`packageInstaller` 新增导出 `resolveModuleUrl(url, indexUrl)`，**唯一调用点在 `installInner` 的 `checkSpec` 之前**（那里只收 `http(s)` 绝对地址，相对条目本来会被当 `INVALID_SPEC`）。对绝对地址幂等 ⇒ 直接规格、索引里的依赖条目、依赖递归都安全。`fetchIndex` 成功结果回带 `indexUrl`；窗口把 `indexUrl` 与 `index` 交给 `install/update`。
- **顺带接通**：窗口此前从不把 `index` 传给安装器 ⇒ P5 的§11「缺依赖先按索引装依赖」在界面上一直走不到（只有 Node 测试跑通）。本轮起可达，因此它按**新代码**看待、进了§八 P9 部分 R4 的实测项。
- 测试：新增 `tests/p9-release-index.test.mjs`（九类解析语义、传与不传 `indexUrl` 的对照、依赖递归两种走向、`fetchIndex` 回带地址、`buildIndex` 形状、`zipDir` 结构含"无目录条目"与两次调用摘要一致）。
- 验证（**纯代码 / Node**）：186 个 JS/mjs `node --check` ✓；**九套**测试 ✓；`pnpm build` ✓（含 release，实测 7.7s）；`--verify` 通过（`card-skin` 1017 文件 / 21,627,755 字节，5 套皮肤逐套核对）；verify-pack 881/0 ✓；check-skin-imports 37/0 ✓；card-skin `--verify` 1016/20.5MB ✓。
- **实跑暴露的两个自身缺陷（已修，记录以免被当成"读代码就能发现"）**：①`--verify` 的重算行把 `.digest("hex")` 挂在文件 buffer 上（`TypeError: fs.readFileSync(...).digest is not a function`）——校验前半段全过、末尾才炸，说明"跑一遍"和"跑遍所有分支"不是一回事；②完成日志用 `notes.length` 把 7 个包写成 8 个包（`card-skin` 多一条逐套核对）。
- **未验证 / 真机首验重点**：构建期用 `jszip@3.10.2` 写、运行时解压是**本体 JSZip 2.7**（未改），本轮只做了"自己回读 + 结构不变量"，**没有**证明 2.7 解得开 3.10 写的每个包；§八「P9 部分」R1~R6 是新加的实测组，R3 一旦报 `STRUCTURE_INVALID`/`ENTRY_MISSING` 即跨版本不兼容（不是网络问题）。另：`module-index.json` 不许手工编辑，`--verify` 会与盘上产物重算逐字节比对。
- 提交：`dea6561`（相对地址解析）与 `d5b8baf`（构建脚本）各一笔，与本条文档分开，均未 squash。
- **遗留边界（如实记）**：若 `card-skin` 包未装而某第三方扩展恰好用 `registerDecadeCardSkin({skinKey:'decade'})` 提供了自己的牌面，内置套的可用性仍是 `false`（按要求 2，第三方无权改它），因此该下拉项不出现——这是"内置资源没装上"与"别人借同名 key 供货"两种语义的交叉地带。仓库自带包在位时不会出现该组合；若今后要支持"借内置 key 供货"，需要单独设计（不属于本轮范围）。
