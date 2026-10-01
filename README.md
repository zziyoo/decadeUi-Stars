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

下一步：先由维护者手动打开无名杀跑 §八「P9 部分」R0/R3（真机 install 首次可行——
        P5 的 JSZip 获取与解压端口形状两个必败点已在 `5c7b557` 修掉）；
        通过后进入 P10 GitHub Release（§四十七）。建 Release、传资产、推 tag 由维护者执行。
        跨版本解压已在 Node 侧用本体那份 JSZip 证过（1285 条目逐字节一致）。

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

## v1.13（2026-09-28）P5 真机前取证修复：JSZip 取不到 + 解压端口形状不一致（A+C）

用户给出真机验证链（构建 → 7 个 zip → 真机 `packageInstaller.install()` → 本体 JSZip 2.x 解压 → 装 `card-skin`/`decade` → 重载 → 看资源可用）。我先把**不需要客户端**的部分做完，结果一好一坏，坏的按批准的 A+C 当场修掉（`5c7b557`）。

- **✓ 已证（v1.12 的 §五 13 未知量消掉）**：用本体**真正 import 的那份** JSZip 跑探针——`noname/get/index.js`、`optionsMenu.js` 都 `import JSZip from "../../_virtual/index2.js"`（内部 `jszip@2.7.0`）。它读遍 `dist/release/`：条目数 `27/1017/32/50/44/70/45` 与源目录一致、根位 `manifest.json` 全在、**1285 个条目 `asNodeBuffer()` 逐字节一致**、非 ASCII 条目名 0。探针刻意喂 `ArrayBuffer`（与下载器给运行时的类型一致）并用 `new JSZip()` + `zip.load()`（与本体 optionsMenu 同读法）。
- **✗ 真因不是格式，是取不到库（A 修）**【本条描述的"从实例取 constructor"已被实机证伪，现实现见 v1.14】：`noname.js` 里 `window.JSZip`/`globalThis.JSZip` 出现 **0 次**，`resources/app/game/` 下**没有 `jszip.js`** —— 旧 `defaultLoadJsZip` 的两条路（全局 / `lib.init.js(game/jszip)`）在真机上全断，`install()` 必败于解压。新增 `createJsZipSource()`：`window.JSZip` → **`get.zip(cb)`**（本体公开 API，实现就是 `callback(new JSZip())`，从实例取 `constructor`）→ `lib.init.js(game/jszip)`；每级过"必须有 2.x `load()`"的形状校验；结果连失败一起缓存（探测带加载副作用，界面每次刷新不该再白等一次 watchdog）；解压改 `new Ctor()` + `zip.load(buffer)`。**不 vendor、不改本体、不 import 打包器内部路径**（§56禁止1）。
- **顺手堵掉一个侥幸**：`拖拽读取` 扩展 vendor 的 JSZip 是 **3.6.0**，静态看只有 `loadAsync`、没有 `load`。若把它当"可用"接受，`new Ctor(buffer)` 不载入数据、`.files` 为空，症状会退化成"包结构非法/`ENTRY_MISSING`"这种更难查的假象——形状校验正是为此。（这条是静态判断 + 我们代码路径的推演，未执行第三方代码。）
- **✗ 第二个必败点（端口形状）**：`moduleSystem` 注入的是 `createZipExtractor()` 的 `{extract, probe}` **对象**，而安装器一路 `await extractZip(...)` 当**函数**调 ⇒ 真机 `TypeError: extractZip is not a function`，且它不带 ioCode，于是被解压步的 catch 误报成 `STRUCTURE_INVALID「解压失败」`，看起来像下载的包坏了。现在工厂里归一两种形状（函数仍受支持，P5 既有测试用的就是函数替身），归一不了即 `NO_EXTRACTOR`。
- **C：能力诚实化**：端口暴露 `probe()`、安装器新增 `ready()`、窗口 `refresh()` 额外 `await ready()`；探不过就把 `安装/更新/卸载` 置灰并显示"本机取不到解压能力（ZIP）：…"，不再让按钮亮着等玩家把包下完才失败。`isAvailable()` 的同步语义不变（它只说端口在不在）；门控型 Feature 的启停仍不受平台能力影响（沿用 `48a82bc` 口径）。`toIoFailure` 增加 `ioCode=NO_EXTRACTOR → NO_EXTRACTOR` 映射。
- 测试：新增 `tests/p5-jszip-source.test.mjs`（**先 RED**：`createJsZipSource` 当时是 `undefined`）——三级获取顺序、`get.zip` 实例取构造器、结果缓存（三次 `load()` 只探一次）、3.x 形状被拒、全断时 `ioCode=NO_EXTRACTOR` 且 `probe()` 给原因、本体不回调时 watchdog 落定（`settle` 的计时器是 `unref` 的，用例自己保持事件循环存活）、解压零写入、安装结果 `NO_EXTRACTOR@extracting` 且正式目录零落地 + 临时 zip 被清、`ready()` 三态。
- 验证（**纯代码 / Node**）：187 个 JS/mjs `node --check` ✓；**十套**测试 ✓；verify-pack 881/0 ✓；check-skin-imports 37/0 ✓；`build-release.mjs --verify` 7 包 ✓；card-skin `--verify` 1016/20.5MB ✓；`pnpm build` ✓。
- **台账更正**：P5 记录原写「ZIP 用本体自带 JSZip，加载方式与 `app.importPlugin` 完全一致」**是错的**——`importPlugin` 在 `noname/game/index.js` 里 grep 不到，我当初照抄的加载路径在本体里不存在。这条错误让我把"静态验证"当成"运行时可用"写了两个月，代价记在§五 16。
- 待真机（§八 新增 R0，并改写 R1/R3 与注意事项）：**现在需要用户手动打开无名杀**。R0 先 `await decadeUI.packageInstaller.ready()`，再按 D 行用 `dist/release/baby-1.4.2.zip` 走一次真 `install()`。
- 提交：`5c7b557` 一笔（A+C 一并，两件事同属"解压能力可用"这一条契约），与本条文档分开、不 squash。

## v1.14（2026-09-28）实机第一轮反馈：JSZip 获取改为"按实例交付"（v1.13 的 A 假设被证伪）

用户在真机跑 `await decadeUI.packageInstaller.ready()`，得到 `ok:false`，reason 为
「get.zip 交出的实例不带 2.x 的 load()（JSZip 版本或形状不符）；加载 game/jszip 无响应：本体回调未触发」。

- **根因不是本体，是我在 v1.13 里的一个未验证假设**：A 方案当时写成"从 `get.zip` 交出的实例上取 `constructor`，缓存构造器"。实际 `jszip@2.7.0` 用 `JSZip.prototype = {…}` **整体替换原型**，prototype 上没有 `constructor` 属性 ⇒ `instance.constructor === Object`（Node 里 import 本体那份 `_virtual/index2.js` 复核：`Object.getOwnPropertyNames(JSZip.prototype).includes("constructor") === false`），`new Object()` 当然没有 `load()`，于是三级选型全部判定失败。**教训**：从别人库的对象反推构造器之前，先确认它的 prototype 是不是对象字面量替换的。
- **修法（`d296f9e`）**：端口的交付单位从"构造器"换成"**实例**"。`createJsZipSource().createInstance()` —— 全局路径自己 `new`；`get.zip` 路径**每次向本体要一份新实例**（其实现本就是 `callback(new JSZip())`）；脚本路径只负责装上、装完回查全局。**选型**（哪一级可用）连失败一起缓存，实例每次解压现取 —— 因为 2.x 的 `load()` 是**原地写入**，复用实例会把上一个包的条目带进下一个。解压体改 `const zip = await jsZip.createInstance(); zip.load(buffer);`，与本体 `optionsMenu` 的读法一字不差。
- **顺带修掉一个控制流错误**：`viaScript` 原先在脚本回调里无条件 `err()`，会把"脚本其实成功装上了 JSZip"的构建也判死。改为只负责装载，可用性由 `attempt()` 回查全局决定。
- 测试（`tests/p5-jszip-source.test.mjs` 重写，**先 RED**：`createInstance` 当时是 `undefined`）：新增**实机形状回归锁**——夹具复刻 2.7（实例有 `load`、`constructor` 却是 `Object`）必须可用；两次 `createInstance()` 拿到互不污染的不同实例；选型只验一次（`issued` = 1 次选型 + 每次解压一份）；失败缓存后第二次几乎零耗时；只有 `loadAsync` 的 3.x 仍被拒；`get.zip` 不回调时 watchdog 落定且归为 `NO_EXTRACTOR`；函数形状的旧端口仍可用。
- 验证：**十套**测试 ✓；187 个 JS/mjs `node --check` ✓；verify-pack 881/0 ✓；check-skin-imports 37/0 ✓；`build-release --verify` 7 包 ✓；`pnpm build` ✓。
- 待实机第二轮：请再跑一次 `await decadeUI.packageInstaller.ready()`。若仍 `ok:false`，`reason` 现在会点名是哪一级（`window.JSZip 不存在或不是 2.x 形状` / `本体未提供 get.zip` / `get.zip 交出的实例不带 2.x 的 load()` / `本体未提供 lib.init.js`），把这几种分开的意义写进了 §八 R0——三种原因的修法完全不同。
- 提交：`d296f9e` 一笔，与本条文档分开、不 squash。v1.13 的正文按"改了哪些文件"照旧保留，但其 A 方案描述已被本条更正，不要再照它实施。
- **遗留边界（如实记）**：若 `card-skin` 包未装而某第三方扩展恰好用 `registerDecadeCardSkin({skinKey:'decade'})` 提供了自己的牌面，内置套的可用性仍是 `false`（按要求 2，第三方无权改它），因此该下拉项不出现——这是"内置资源没装上"与"别人借同名 key 供货"两种语义的交叉地带。仓库自带包在位时不会出现该组合；若今后要支持"借内置 key 供货"，需要单独设计（不属于本轮范围）。

## v1.15（2026-09-28）R6 自验关闭 + §八 三条探针判据本身写错了

真机首条 `install()` 通过后，剩余收尾项是 R1/R4/R5/R6。准备探针时读码发现：**其中三条的判据写得永远验不通**，照原样交给玩家逐条对照，会把正确行为读成失败。本轮零代码改动，只更正判据、自验 R6、修台账结构。

- **R1「汇总行可安装 N 不为 0」是错的**：`summarize().installable` 数的是"存在**可用** install 动作的行"（`moduleAdmin.js:117`），而七包在仓库里全部已装且版本与索引一致 ⇒ 恒为 0。正确判据是"已独立安装 7（六样式 + `card-skin`）、可更新 0"，行上应带上索引给出的信息；想看非零"可安装"必须先卸掉一个包（正好是 R4 的前置）。
- **R4「进度依次出现安装依赖」是错的**：全量 grep `emit(opts, { stage:` 只有 `downloading`/`extracting`/`done`/卸载 `done` 四处，`stage:"dependencies"` **只**出现在 `DEP_CYCLE`/`DEP_MISSING` 的失败返回里。`ensureDependencies` 对已在注册表的依赖直接 `continue`，而七包的依赖只有 `core`、`core` 恒在注册表 ⇒ 既不会下载 core，也不会出现 warning「已先安装依赖 core」（`packageInstaller.js:483` 那行只在依赖真被补装时才写）。**如实记下可达性边界**：现有产物走不到"依赖补装真发生"那一支（`core` 无包形态），要看它必须临时造一个依赖另一个合成包的合成包；递归两支已由 `tests/p9-release-index.test.mjs` 覆盖。
- **R5「装 20MB 过程中点取消」在回环上做不成**：`127.0.0.1` 上下完 21,627,755 字节远快于人反应，取消按钮没有可点窗口，这条探针实际长期不可执行。给 `tmp/dev-release-server.mjs` 加 `--chunk/--throttle`（64KB×40ms，实测 card-skin **15.4 秒**；index 33ms、baby 54ms 不受影响，目录穿越仍 404），并把探针换成**不删文件**的同版本 force 重装：`update("card-skin", {index, indexUrl, force:true, signal})` + `setTimeout(()=>c.abort(), 6000)`，预期 `{ok:false, code:"CANCELLED"}` 且 `modules/card-skin/1.4.2/` 对 git 零 diff（发布在校验之后，取消不该碰正式目录）。写的服务第一版有 bug：`res.write()` 返回 false 后先 `sleep(40)` 再等 `drain`，而 drain 在那 40ms 里早已发过 ⇒ 永久挂起（实测 baby 112KB 挂满 120 秒）。改成"一次只压一块、用 write 回调落定"后正常。
- **R6 已由我方在命令行关闭（不需要游戏）**：`tmp/r6-tamper.mjs` 造五类篡改——zip 追加字节、zip 删条目、index 改 `sha256`、index 删条目、index 改 `size`。`build-release --verify` **五类全部 `exit=1`** 且理由点名（如「baby：索引 size=1 与 zip 实际字节 112079 不符」「索引缺少 codename」），未篡改时 `exit=0`；随后重新生成，zip 与 index 摘要**逐字节回到基线**（再次证明产物确定）。
- **台账结构缺陷修复（`129ea2b`）**：§四 历史块顺序被早期一次跨行锚点编辑打乱——`## 四、进行中（当前任务指针）` 出现两处、`### 历史：P3 第一子任务记录` 的 5 条正文落在自己标题前 23 行、标题又在 P2 记录前重复出现且无正文。按整块搬移修回 `四包拆分 → P3-1 → 历史：P3 → P2`，正文一字未改：写前后都用**行多重集**断言（结果只少 4 行结构行：2 空行 + 1 重复 h2 + 1 孤立标题，新增 0 行），并把该脚本的断言写成"任何一条不成立就不落盘"。这轮自己又踩了一次同类坑：追加 §三 行时 `old_string` 只锚到行尾**不含**结尾的 ` |`，替换后残留成 4 列行，由列数审计当场抓出并修掉——**追加行必须把行尾 ` |` 一起锚进 `old_string`**。
- **记一次可疑工具返回**：读 §五 时两次拿到当前文件里根本不存在的内容（一段声称「构建产物防篡改校验已闭环，见 `851298d`」的条目）。实测 `git cat-file -e 851298d^{commit}` → no such object，全仓库 59 笔提交无 `851298` 前缀，HEAD 与工作区里"防篡改"只出现 1 次（我自己写的那行）。处置：不采信、不据此把 R6 当已验，仍按未验项自验后再标已过。
- 验证：227 个 JS/mjs `node --check` ✓；**十套**测试 ✓；verify-pack 881/0 ✓；check-skin-imports 37/0 ✓；`build-release --verify` 7 包 ✓；card-skin `--verify` 1016/20.5MB ✓；`pnpm build` ✓；`modules/installed.json` 的真机安装痕迹已 `git checkout` 回滚（七条目、无 `sha256/hashVerified/installedAt/source:"local"`），工作区 clean。
- 提交：本轮两笔文档分开——`f47d680`（R3 真机证据写回）、`129ea2b`（台账结构修复），本条 v1.15 另起一笔；均不与代码 squash。推送由用户执行。

## v1.16（2026-09-28）真机 R1/R4：一个瞬时冲突、一个剪内容的提示条

用户按更正后的判据跑 R1/R4，回了一张窗口截图。R1 一次过（「模块源已连接（索引 schema 1）」+「共 9 · 已独立安装 6 · 可更新 0 · 可安装 1」，行上带 939.4 KB / 需要 Core >=1.4.2）。R4 第一次点安装失败，第二次成功——两件事都是真 bug。

- **发布步 `EPERM`（`470b35b`）**：报错原文「发布到 modules/codename/1.4.2 失败：[ModuleIo] rename `tmp/modules/codename-1.4.2-8zs8br` 失败：EPERM」。定性依据不是猜的：先查盘，第二次确实装好了（台账写入 `sha256:be5e8af3094f…` 与索引一致、`hashVerified:true`、`size:961947`，`modules/codename/1.4.2/` 32 文件对 git **零 diff**）⇒ 同一操作重跑即通，是 Windows 目录改名的瞬时冲突（Defender 实时扫描、索引器、刚写完未释放的句柄），不是发布逻辑错。原代码只把 `EXDEV` 当可回落信号，EPERM 直接抛给安装器变成 `PUBLISH_FAILED`。
- **修法克制**：只在 `movePath` 桌面分支对 `EPERM/EACCES/EBUSY/ENOTEMPTY` 退避 `80/160/320/640ms` 有界重试，仍失败就原样抛出（真码在 `cause.code`，`settle` 的 `IoError` 语义不动）。**`IO_STALL` 明确不重试**——那是"回调根本没来"，重试只会把等待时间乘倍数；`ENOENT/EROFS` 这类确定性失败也一次即抛。发布事务、SHA 判据、临时目录、台账事务一字未改。
- **测试（先 RED：注入两次 EPERM 时 `movePath` 直接抛）**：四块——瞬时失败重试后成功且 `renameCalls===3`、永久失败有界（2~8 次）且**源没被搬空**、`EROFS` 只试 1 次、永不回调落定 `IO_STALL` 且只试 1 次。
- **提示条被剪（`5cbe69f`）**：长错误含两遍 Windows 绝对路径，提示条按内容长高后撑破对话框，被 `.decade-module-dialog` 的 `overflow:hidden` 剪掉，玩家看到"半句话且滑不到底"。改 `max-height:26%` + `overflow-y:auto` + `flex:0 0 auto` + `overscroll-behavior:contain` + `word-break:break-all`；`position:relative` 本来就有，不碰本体 `div{position:absolute}` 那个坑。
- **顺手核清一处"看着像 bug"**：所有包 `dependencies` 都是 `["core"]`，行上却显示「依赖: 无」——`moduleAdmin` 的 `shownDeps` 刻意滤掉 core（core 恒随扩展在，不作为缺失依赖提示），已写进 §八 R1 免得下次有人去追。
- 验证：十套测试 ✓；改动文件 `node --check` ✓；verify-pack 881/0、skin-imports 37/0、build-release `--verify` 7 包 ✓；`pnpm build` ✓ 且新 CSS 已进 `dist/src/features/`。
- **待重测**：重载游戏后再卸再装一次 `codename`，预期一次成功、不再出现 EPERM。CSS 那处我方**无法**在浏览器里验（本项目此前已确认浏览器打开不可取），只做了静态核对与产物落盘确认，视觉效果以他游戏里看到的为准。

## v1.17（2026-09-28）P9 收口：能力要么说出来、要么在下载前拒绝

按用户的任务书收尾两件事（HEAD `c61882d`）。**P9 至此最终完成，可以进 P10。**

- **问题一：`isAvailable()` 与 `ready()` 语义不一致（`cc6ee72`）**。旧实现 `available: !!io && !!extractArchive` 只说"端口对象挂没挂"，而真正能不能解压要看 `createZipExtractor().probe()` 能不能取到本体 JSZip ⇒ 存在"`isAvailable().available === true` 但 `await ready()` 返回 `ok:false`"的理论可能；更糟的是 `installInner` 要到解压阶段才发现，等于**白下 20MB 才失败**。
- **修法：把 probe 的结论变成安装器里的唯一真值。** 新增 `extractorReadiness` / `extractorProbe` 缓存——成功失败都缓存、并发复用同一次探测（`Promise.all([ready(),ready(),ready()])` 只 probe 一次）、重载游戏重建实例即自然清空、**不提供 reset**（任务书§四）。`ready()` 只读这份缓存；界面与安装路径共用同一次探测，没有第三套检测。
- **`isAvailable()` 现在是同步能力快照**：端口缺失 → `available:false` + `missing*`；端口在但未探测 → `ready:false` 且 `available:false`（**未知 ≠ 可用**）；探测过 → `available` 就是 probe 的结论，失败时多带 `reason`。只新增 `ready` 一个字段。
- **安装前早拒**：`installInner` 在端口检查之后、解析规格之前插能力门，探不过即 `NO_EXTRACTOR @ stage="resolving"`，**零下载 / 零落盘 / 台账不写**；`update` 走同一道门。SHA 判据、临时目录、发布回滚、台账事务、依赖解析一字未改。
- **一处必须记住的坑（照任务书示例会踩）**：任务书 §六 给的"探测前 `available:false` + `missingExtractor:true`"若原样实现，`moduleManagerWindow` 会因为 `if (!installBlocker)` 直接跳过 `ready()`，于是**首次打开窗口就永久误报"本平台不支持安装/卸载"**、再也不会去探测。所以窗口改成按**端口是否缺失**判定 blocker，能力问题由 `ready()` 的失败原因承担（仍是原来的"本机取不到解压能力（ZIP）：<原因>"）。`missing*` 保持端口语义，这条已写进台账§四，免得后人"照示例改回去"。
- **问题二：台账基线（`3d316d2`）**。`modules/installed.json` 逐字恢复为 `1322767` 的版本（schema 1 + 七条目只留 `version`），清掉真机测试写入的 `installedAt` / `source:"local"` / `size` / `sha256` / `hashVerified`；不删文件、不改 schema、不删模块记录、不给内置记录补 sha256。恢复后 7 个包目录与台账条目一一对应。
- **JSZip 接线零改动**：`moduleIo.js` 本轮没动——三级获取、**按实例交付**（不重新引入 `instance.constructor`）、每次解压现取实例、失败缓存、3.x 被拒，全部保持 `d296f9e` 的形状。
- 测试（**全部先 RED**）：`p5-jszip-source` 五块（未注入 extractor 时 `isAvailable()` 与 `ready()` 两侧一致、probe 通过时探测前 unknown → 探测后 available+ready、probe 失败被缓存且不翻供、三次并发只探一次、无 probe 方法的替身端口按既有事实可用），并把"下完才在 extracting 失败"的旧用例改写为"resolving 早拒 + `download` 次数为 0"；`p5-installer` 两块（能力缺失时 `install`/`update` 都是 `NO_EXTRACTOR` 且 `download===0`、`files` 为空、台账未创建；尚未探测时 `install` 先探一次再照常下载且只探一次）。
- **如实记的边界**：①probe **抛错**过去会让 `ready()` reject（窗口自己 try/catch），现在收敛成 `{ok:false, reason:"探测解压能力时抛错：…"}`；配合"失败也缓存"，**一次瞬时失败要重载游戏才会重试**（任务书要的就是这个行为）。②未探测前 `available:false` 是刻意的，调用方要么先 `await ready()`，要么按 `missing*` 判端口。
- 门禁：227 JS/mjs `node --check` ✓；十套测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓。提交 `cc6ee72` + `3d316d2`，本条台账另起一笔；推送由用户执行。
- 范围确认：未动 P9 构建架构、ZIP 格式、`module-index.json` 结构、Feature/Style Runtime、card-skin 架构、P10 自动发布、noname 本体。

## v1.18（2026-09-28）P10：把 Release 结构做进构建里

任务书§47 要求"建立 Release，结构 Core / Official Style Packs / Feature Packs / Full Package / module-index.json，所有下载链接必须可被客户端解析"。用户批了四个决定：**Core 不进 Release**（本仓库源码即本体）、**要 Full Package**、**tag 用 `v1.4.2-stars`**、**由他在网页建 Release 传资产**。施工后对表：Official Style Packs＝六个样式分包、Feature Packs＝`card-skin`、Full Package＝新增整包、索引＝原有；Core 以"随扩展本体发布"落地。

- **新增整包（`c91a9f8`）**：`十周年UI-Stars-1.4.2-full.zip`，3589 文件 / 112,100,082 字节，包内根目录唯一 `十周年UI-Stars/`，解压到 `resources/app/extension/` 即用。**源就是 `dist/`**——vite 已按部署形态备好 `info.json`/`extension.js`/`ui`/`image`/`audio`/`assets`/`modules`，天然排除 `node_modules`、`scripts`、`tests` 等开发件，所以不另立第二份排除表（两份清单迟早会漂移）。`release/` 不进整包（那是给装包流程用的分包产物）。
- **整包排除内部三件**：`README.md`（总任务书）、`docs/PROGRESS.md`（交接台账）、`docs/modularization-audit.md`（P0 审计）；原版的对外文档（`extension-readme`、`card-skin-api`、`dynamic-skin-api`、`update` 等）照旧随包发布。**为什么必须排**：台账每次会话都在改，打进去会让 112MB 资产的摘要随文档变动，Release 上记录的 sha256 与后续重建就对不上号。实测排除后 `pnpm build` 重跑整包摘要不变——顺带解释了一个吓人的现象：整包摘要曾在 `pnpm build` 前后差 4.5KB，查下来是 vite 把**刚改的 README/台账**重新拷进 dist 所致，`build-release` 自身连跑两次摘要完全一致，不是构建不确定。
- **新增 `RELEASE-NOTES.md`**：由构建生成在 `dist/release/`（不入库）——Release 说明草稿 + 上传清单（9 项资产的字节数与 sha256）+ 安装两步 + 模块源地址 + 校验命令。资产顺序：整包 → 索引 → 各分包。
- **`--verify` 扩成四段同一套规则**：分包（原有全套）→ 索引（与盘上重算逐字节一致）→ 整包（根位 `info.json`/`extension.js` 在、每个分包的 `manifest.json` 在、不得含 `release/`、条目数与 dist 排除后一致）→ 说明文件（按盘上产物重算文本逐字节比对，手改会被抓住）。`--list` 也列整包一行；日志前缀统一 `[P10产物]`。
- **相对地址（§47 的那句硬要求）**：索引 url 仍是裸文件名，客户端用索引地址解析成同 Release 下的资产地址（`resolveModuleUrl` 单点，对绝对地址幂等）。GitHub Release 形状已进测试：`…/releases/download/v1.4.2-stars/module-index.json` + `baby-1.4.2.zip` → 同目录绝对地址。测试里被实测纠正过一次期望值：非 ASCII 资产名（整包文件名）解析出来是**百分号编码**，那是 `new URL()` 的正确行为，不是缺陷。**所以索引与全部 zip 必须挂在同一个 tag 下**。
- 测试（新增 `tests/p10-release.test.mjs`，临时沙盒、不碰仓库产物）：打包前缀/排除项（内部三件与对外文档对照）/无目录条目/两次打包同摘要；四类整包篡改必须失败（缺根位文件、缺分包清单、混入 `release/`、多余条目）；说明清单含全部资产的字节数与 sha256 且表格列数完整；GitHub Release 形状的裸文件名解析。负例走脚本的 `die()`，测试里断言后复位 `process.exitCode`（否则测试进程会以非零码退出——那正是它在 CLI 里该有的行为）。
- 门禁：228 JS/mjs `node --check` ✓；**十一套**测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓。
- **未做（用户侧）**：建 Release、传 9 个资产、推 tag。上传清单与说明在 `dist/release/RELEASE-NOTES.md`，也摘要进了 §六 7。

## v1.19（2026-09-28）P11 自动更新：启动查一次，只提示不代劳

任务书§48 要求"启动 → 读本地版本 → 读远程索引 → 比较 → 提示更新，且能只更新某一项而不是每次下完整 UI"。四个决定（用户批）：**Core 只提示不自动替换**、**可关闭的提示窗**、**启动后异步查一次**、**每版一次可忽略**。

- **纯逻辑先写（`src/core/updateChecker.js`）**：`checkUpdates({installed, index, coreVersion, ignored})` 产出 `{updates, ignoredUpdates, core:{behind,current,latest}}`；版本比较复用 `manifest.compareVersions`（与安装器§18 同口径，不写第二套）。核心原则是**读不出来就沉默**：本地版本未知（null/空/非版本号）、`latest` 非法、索引比本机旧——一律不提示。宁可漏一次，也不要把垃圾数据变成一次白下载（那是玩家的一次流量和一次困惑）。忽略清单的读写也是纯函数（坏 JSON 当空，不抛）。
- **界面（`updateNoticeWindow.js` + `updateNotice.css`）**：可关闭的小窗，逐条列 `名字 1.4.2 → 1.4.3`；Core 落后单独一块并给"打开发布页"链接（**只提示**，本体就是正在运行的扩展目录，自我覆盖风险高）；按钮＝打开模块管理（复用现成的更新/进度/取消）、忽略此版本、稍后。列表自带滚动上限——P6 的提示条就是因为没上限被 `overflow:hidden` 剪掉过；DOM 逐类声明 `position`，不受本体 `div{position:absolute}` 侵扰。
- **接线**：`content.js` 末尾 `setupUpdateNotice()` 延迟 1.5 秒异步查一次，`fetchIndex` 走安装器现成的重试/超时（5 秒）。**未配置模块源 / 离线 / 索引坏 / 超时 / 抛错一律静默返回 null**：不弹空窗、不写状态、不阻塞进游戏。新增可见配置键 `autoCheckUpdate`（`init:true`，关掉即不查）；忽略记录存 `extension_<扩展名>_ignoredUpdates`，跟随既有键前缀约定，不新增存储层。
- **"每版一次"的实现**：忽略记的是**那个 `latest` 版本号**而不是"这个模块"——版本一变（1.4.3 → 1.4.4）还会再提。否则玩家一次忽略就等于永久放弃该模块的更新。
- 测试（`tests/p11-update-check.test.mjs`，19 组）：13 组纯逻辑（更新/不降级/同版本/未安装不算更新/本地版本未知/null 边界/Core 落后与索引缺 core/忽略只对同一版本生效/输出排序/空输入不抛/忽略读写/批量忽略）+ 6 组接线（默认查与明确关掉、未配置不发请求、离线与抛错都吞、有更新返回可展示数据、全被忽略则不弹、无更新不弹空窗）。Core 忽略与批量忽略两块**先 RED 后 GREEN**。
- **真机演示源**：现有产物索引里都是 1.4.2 ⇒ "发现更新"这条测不出来，故加 `tmp/make-update-demo.mjs`（不入库）：把 `baby` 复制成 1.4.3、索引里 baby 与 core 都标 1.4.3、其余保持 1.4.2，产出 `tmp/update-demo/release/`，用 `node tmp/dev-release-server.mjs 8100 --root tmp/update-demo/release` 服务；它只动 `tmp/`，不碰正式产物。§八"P11 部分"列了 5 条探针（发现更新/忽略只压一次/提示→窗口→更新整条链/关开关不查/离线静默）。
- 顺带记一笔盘上证据：用户此前在游戏里装了 `mobile`/`online`/`yjcm`，台账里三条都是 `source:"local"` + `hashVerified:true`、无 `previousVersion`、7 个包目录文件数全对、无事务残留 ⇒ **P5 的 EPERM 有界重试 + 能力门之后的安装链路真机通过**（§八 R4 只剩界面观感待他确认）。
- 门禁：231 JS/mjs `node --check` ✓；**十二套**测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓（整包随源码增至 3592 文件 / 112,104,844 字节 / `fe14797f5834…`；分包与索引自 P9 起未变——**发布时以 `RELEASE-NOTES.md` 里的数字为准**）。
- 范围：未动 P9 构建架构、ZIP 格式、`module-index.json` 结构、Feature/Style Runtime、card-skin 架构、安装事务；未做 CI 自动发布与自动下载更新（用户决定只提示）。P12 回滚的地基已在（`update()` 保留旧版本目录 + 台账 `previousVersion`）。

## v1.20（2026-09-28）P12 回滚：坏了就自己退回去，退不了就说清楚

任务书§49："当前模块损坏 → 自动恢复上一版本；最少保留当前版本与上一版本。" 四个决定（用户批）：**结构级四项判据**、**启动自动回退**、**坏目录改名 `.corrupt-*` 留证**、**无可用上一版则提示重装**（不自动下载）。

- **判据是纯逻辑（`src/core/moduleHealth.js`）**：`assessModule` 判四项——包目录缺失 / `manifest.json` 缺失或解析失败 / `manifest.id`、`version` 与台账不符 / 清单声明的 `entry.js`、`entry.css` 不存在；`planRepair` 决定怎么修：当前坏 + 上一版健康 ⇒ `restore`；上一版也坏或没记 ⇒ `reinstall`（**绝不把坏的换上来**）。
- **两条硬边界**：①**IO 错误不算损坏**——判据只吃"探测结果"，调用方负责把"读盘失败"与"文件不存在"分开（沿用 P5 的"IO 异常 ≠ 不存在"）。这是自动回退最危险的失败模式：一次读盘抖动把好包判死、玩家莫名其妙被降级。②回退目标自己也要过同一套判据。
- **安装器（`a091286`）**：`probeModuleVersion`（IO 错误抛出转 `IO_FAILED`）、`verifyInstalled(id)`（只探测、不写状态）、`rollback(id)`（验上一版健康 → 当前坏目录改名 `modules/<id>/.corrupt-<版本>-<随机>` → 台账 `version` 指回上一版并清 `previousVersion`；台账写失败 ⇒ 把坏目录改回原位 + `ROLLBACK_FAILED` + residual）。`localVersions` 排除 `.corrupt-*`；`INSTALL_CODES` 新增 `NO_ROLLBACK`（只增不改既有码的含义）。
- **接线**：`registerInstalledModules()` 在注册每个模块前先做健康检查——损坏且有健康上一版就**自动回退并重注册**；没有可用上一版只警告"需要重装"，**启动阶段绝不自动下载**。修复结果经 `takeRepairNotes()` 交给 P11 的提示窗（琥珀色块：`baby：1.4.3 → 1.4.2` 或 `需要重装`），**有修复但没更新时也弹**，关掉"启动时检查更新"也弹——回退已经发生了，玩家有权知道。无更新时不显示"忽略此版本"。
- **测试（`tests/p12-repair.test.mjs`，全部先 RED）**：判据四类逐个；修复计划五种组合（正常 / 回退 / 目标也坏 / 无上一版 / 版本号相同）；安装器八块（健康时不许动文件、损坏给出计划、回退成功验目录与台账、目标不健康拒回退且零移动、无上一版与未安装各自的码、台账写失败 ⇒ `ROLLBACK_FAILED` 且坏目录改回、`localVersions` 排除事务目录）。
- **写测试时踩到的坑**："注入写台账失败"一开始打不中——原子写台账是 temp → rename，在 `writeText` 上注入根本不会被触发，测试假绿了一阵；改成注入"改名失败"（假 io 加 `failMoves`）才对。这类"注入点打偏"值得单记。
- **如实标注未验**：接线层（fetch + DOM）没有 Node 测试，只有纯逻辑与 CSS 静态不变量覆盖；`registerInstalledModules` 现在每个模块启动都做一次健康探测（桌面 7 个包约 40 次小 IO），开销与"误判导致误回退"的风险留待真机观察。§八"P12 部分"给了四条探针，**P12-4"什么都不造 ⇒ 不许有任何动作"是最重要的一条**。
- 门禁：233 JS/mjs `node --check` ✓；**十三套**测试 ✓；verify-pack 881/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓。提交 `a091286`（代码）+ 本笔（台账），推送由用户执行。

## v1.21（2026-09-29）P13 旧版本迁移：先保证不再打架，再问要不要搬

任务书§50 只有一句：开发 `LegacyDetector` 自动判断"旧单体UI / 新版模块化UI"并制定迁移策略。四条批量决定（用户批，措辞以转录为准）：**配置只填未设置的键**、**导入由提示窗「导入」按钮触发**、**旧版启用即自动禁用**、**玩家自建卡面自动复制**；随后追加一句"保证打开十周年UI-Stars后原十周年UI自动禁用足够了，导入半自动行为也可以"——所以**自动的只有"禁用旧版"这一件**，其余都要么过按钮、要么只做不影响玩家决定的读盘。

- **为什么必须先禁用**：两套 UI hook 同一批本体函数会界面错乱，这不是偏好问题而是共存故障。写的是本体自己的停用写法 `extension_十周年UI_enable = false`（与 `init/index.js` 停用一个扩展的写法一致），**绝不调 `game.removeExtension()`** —— 它连删玩家的 `extension_<名>*` 配置、localStorage 与导入的武将图，那是卸载不是禁用。旧版代码在本次启动里已经加载过了，所以窗口如实写"重载游戏后生效（这一局里旧版还在跑）"，不让玩家以为已经切干净
- **两边配置键的鸿沟**：`extension_十周年UI_*` 与 `extension_十周年UI-Stars_*`。盘过家底：原版 48 个配置键，Stars 50 个，**48 个同名可迁**（Stars 只多 `moduleIndexUrl`、`autoCheckUpdate`），所以迁移面是个准数而不是猜的。本体自管的开关（`enable` / `*_enable`）不参与迁移——它们是开关不是玩家配置
- **"没动过"的判据（最容易被后人改坏的一条）**：按「当前值 === `init` 默认值，或尚未播种」判，**不按「键是否存在」判** —— 本体 `loadExtension` 与 content 阶段都会把默认值播种进 `lib.config`，首次启动后新键几乎必然存在，照后者判得到的是**零迁移**（功能等于没做）。反验过：判据改成 `cur === undefined` 后测试立刻红
- **导入要玩家点头**：启动只把可迁清单准备好（`importable` 条目），玩家点底部「导入旧版设置」才逐项 `game.saveConfig` 并写 `legacyMigratedFrom` 标记；**零点击时一个配置键都不写**。反验过：在启动路径上补一句"顺手写进去"，那条"启动只能写旧版的 enable=false"立刻红。按钮**挂在底部常驻按钮区而不是行内**——列表超过 46vh 会自己滚，按钮滚进折叠区就等于没有（P11 真机报过同一类问题："没看到忽略此版本按钮"）
- **玩家自建卡面自动复制**：`createSkinIo()` 走裸 `lib.node.fs` + `window.__dirname`（与 `core/moduleIo.js` 的 `fsRoot()` 同口径，但那边把路径锁在本扩展根内，读不了同级的旧扩展目录）。三条硬约束：**只读旧目录、只写我们自己的目录、不删任何东西**；内置五套按 `config/utils` 的预设排除（不在迁移层另立名单，名单与预设同源）；同名文件夹跳过 ⇒ 重复启动自然幂等。Android/SAF 拿不到 Node fs 或读盘抛错都整段静默跳过，配置导入照常可用
- **接手时纠正的两处偏离（不靠记忆，靠原文）**：工作区里的在途实现把配置导入做成了**启动静默写入**，而卡面自动复制**整个没做**（代码注释还把它写成"用户决定只检测不复用"）。判据不回忆、不改写：从会话转录里把那次批量提问的原始答复取出来逐条核对，按批准设计重做，并把台账里的误记改回来
- **排版仍然靠真渲染量**：重建 `tmp/notice-preview.html` + `tmp/preview-server.mjs`（加载本体 `layout/default/layout.css` 与真实提示窗模块）。第一帧琥珀行是 `position:absolute` 且 height 0 —— `.decade-update-repair` 漏在文件末尾那条 `transition:none` 覆盖组之外，样式表加载完成算一次样式变化，被本体 `div{transition:all .5s}` 带着滑半秒；补掉后首帧即归位。这类问题静态测试看不出来，只有真渲染看得见
- **真机结论（2026-09-29）**：P13-1 自动禁用已过（`enable` 写 `false` 且跨重启留住，再重启由 Stars 接管）；P13-2 按钮导入的写入路径已过（`[false, true, undefined]` → `[false, false, …]`，次局不再提这一条），但**窗口内的即时反馈（行文案变化、按钮消失）只在浏览器实测过**；P13-3 卡面复制的正面一支待验（旧版目录里只有内置五套，要手工放一个非内置文件夹）；P13-4 本机验不了。已知小缺陷：在旧版未装载的那一局里点导入，标记版本号取不到会写成 `"unknown"`（只影响说明文字）
- **真机首轮查出的是共存的根因**：`十周年UI/src/content.js:146` 与本仓库 `src/content.js:160` 是**同一道守卫** `if (window.decadeUI) return;`，两个扩展都往同一个全局名上挂自己 —— 谁先 `content()` 谁占住，后加载的整段不执行。所以"同时启用旧版与 Stars"时本扩展的 P13/P11/P12 根本没跑，表现成"没有任何反应"。修复是把自动禁用挪到守卫**之前**（`2bfd65c`）：抢不到全局也先把旧版关掉并告知玩家；另加一条**静态顺序不变量测试**盯住这个先后（真机踩出来的顺序，光看代码很容易被后排回去），反验过换回顺序测试立刻红
- **排查过程中我自己写错的两条探针（记录以免重犯）**：①用 `lib.assetURL` 拼地址，而这个构建里它是空串（`noname/util/index.js:2`），控制台里的裸相对 `import()` 解析失败、未捕获 rejection 变成游戏内错误弹窗 —— 探针必须自带 `catch`，地址用 `document.baseURI` 或页面已加载资源的真实 URL；②把 `updateCardStyles` 当"新代码标记"，可两个代码库都有它，判据里的标记必须先确认唯一性。另：本体 `service-worker.js` 在内存里缓存已编译模块（全文件无 `caches.*` 调用），**改完源码要整程序退出 `noname.exe` 再开**，界面内/整窗重载都可能拿到旧 JS
- **共存从暗处搬到明处（`a6b42e6`）**：明确**不给 Stars 换全局名** —— 两个扩展都会 hook 同一批本体函数，换了名就等于允许两套 UI 同时运行，那正是 P13 要避免的界面错乱。改为在 `content()` 开头先记下 `window.decadeUI` 是谁、给自己打 `isStars` 标记：占不到全局且占者不是自己时，提示窗第一行直接写「这一局界面仍归旧版」，并说明"重载游戏后由 Stars 接管"。顺带撤掉上一轮为"按钮可见"加的行排序 —— 按钮已在底部常驻区，行序该按哪句最要紧来排
- **标记版本号补读（`d6406d0`）**：真机上标记写成了 `"unknown"` —— 版本号取自 `lib.extensionPack[旧版].version`，而旧版被停用后那一局不会装载它。改为点「导入」时若拿不到版本号就现读一次 `extension/十周年UI/info.json`（有版本号不多读盘、读失败只让标记退回 `unknown` 不影响导入）；`apply` 因此变异步，按钮期间禁用防连点，失败文案也改口为「可能已写入部分项」——逐项写入中途抛错确实会留下已写的部分，原来那句「没有写入任何配置」是不实的
- 门禁：236 JS/mjs `node --check` ✓（排除 gitignore 的 tmp/）；**十四套**测试 ✓（新增 `tests/p13-legacy-detector.test.mjs` 33 块，两条关键判据各做过"故意改坏→测试红"的反验）；verify-pack 881 可达/17 已知死引用/0 未知缺失、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓（整包 3595 文件 / 112,112,998 字节 / sha256 `5f301cff5f63…`）。提交 `3ca76a3` + `957c96e` + `2bfd65c` + `a6b42e6` + `d6406d0`（代码）+ 本笔（台账），推送由用户执行。下一步 **P14 最终测试（任务书§51 + §52）**

## v1.22（2026-09-29）P14 最终测试：先把「已做」两个字变成可查的

任务书§51 要求至少测试安装 / 模块 / 样式 / 平台 / 游戏模式五类，§52 要求每个模块都有独立测试表。这一阶段的产出不是新功能，而是**让「测过了」这件事可追责**。

- **§52 九份模块测试表**（`tests/modules/<id>.md`）：core、六个样式包、card-skin（拆包型 Feature）、kill-effect（门控型 Feature）。表头固定五列（项目/判据/层级/结果/证据），已验过的直接回填日期与证据，没验的老实标 `待验`
- **表结构用测试盯住**（`tests/p14-module-tables.test.mjs`）：表按 `moduleManager.list()` 动态要求 —— 以后加模块忘了配表会当场红；§51「模块」六个动词一行不许省，**不适用也要显式写行并给原因**（省略行等于掩盖判据：`kill-effect` 是 `pack:false`，本就没有安装/卸载/更新/回退链路）
- **§51 五类总账矩阵**（`tests/modules/P14-matrix.md`，33 行）：一行一条用例，标 `覆盖方式 / 归属 / 状态`。两条反假绿规则 —— 真机项不许写 `已做`（只有用户跑过才写 `已验`），自动化项不许写 `已验`；再加一条「总账不许漏账」：台账§八 每个小节都必须被矩阵引用到。§八 原表一行没删，矩阵不重复抄 procedure
- **整包排除判据化**（`isPackagedFile`）：原来只排三个精确路径，新增任何内部文档都会照样打进 112MB 玩家包、改一个字 churn 一次 sha；现在按「精确路径 + 目录前缀」排（`tests/`、`docs/superpowers/`）。加完九份文档后整包 sha 一字未变，当场验证生效
- **盘点自己写的「已做」，抓出两处假账**：①错误码 `HASH_MISMATCH` 是凭空写的，真实是 `SHA_MISMATCH`（`packageInstaller` / `downloader` 都是它）；②「排除模式不装载 UI 插件」长期挂 `已做` 却**一条用例都没有** —— 判断内联在 `content.js:loadUIPlugins()`，而那文件一 import 就拉起 DOM/本体依赖链，Node 侧够不着，于是「测不了」被默认成了「已做」。修法是挪成纯模块 `src/core/uiMode.js`（**语义零变更**：取不到模式时保持装载，漏判等于整个 UI 消失）并补 12 条断言，测试还盯住「不许再留第二份内联名单」。其余 `已做` 都找到了断言行号支撑（首次安装 `p5-installer:520/541/635`、重复安装 `:676`、下载失败 `:569/922`、校验失败 `:556/949`、`localVersions` 三种临时前缀过滤 `p12-repair:300-309`）
- 门禁：199 JS/mjs `node --check` ✓；**十六套**测试 ✓（新增 `p14-module-tables`、`p14-ui-mode`）；verify-pack 881/17/0、check-skin-imports 37/0 ✓；`pnpm build` ✓；`build-release --verify` exit=0 ✓（整包 3596 文件 / 112,113,361 字节 / sha256 `14f63107a68b…`，+1 文件即 `uiMode.js`）。四条反验各自红过：删表 / 结果写 `OK` / 去掉 §八 引用 / 谓词改恒真。提交 `af8d827` + `c8b0c59` + `b82b424` + `a1483fa`（代码与测试）+ 本笔（台账），推送由用户执行。下一步：真机三批（批1 样式与卡面与平台、批2 模块生命周期与回退、批3 游戏模式与联网）


## v1.23（2026-09-29）P14 批2 真机：模块生命周期与回退全过，顺带挖出自 P3 的硬缺陷

批 2 跑的是台账§八「P11 部分」与「P12 部分」剩下的那些条：忽略清单、检查开关、坏索引、四条回退判据、真机取消链路。结果**全过**，但真正值钱的是过程中查出一个平时根本看不见的缺陷。

- **启动期「已安装的包」注册不过「内置注册」**（`40f7933`）：`getModuleSystem()` 先按**本体版本**把六套样式登记成内置，`registerInstalledModules()` 后到，而 `registry.register` 对「同 id 不同版本」是**抛错拒绝**的 —— 约定是「版本切换由安装器处理」，安装器运行时会先 `unregister`，但启动这条路上没人做。后果不是「用了旧版」而是**整套样式的 CSS 一条都不加载**：`decadeModule` 只在 `installState.independent` 为真时才读包内 `entry.css`，而这六套全在「已迁移成包」的名单里。平时台账版本 == 本体版本走的是「同版本覆盖」分支，所以只有**装过不同版本号**（更新到新版、回退到旧版）才撞得上；P5/P11 的真机验收看的是台账与目录，没去核 `list()` 里的版本，于是它一路活到 P14 才被真机探针逮住
- 修法是把安装器那条协议补到启动路径上：**先取到并校验清单**才让位，以 `source:"installed"` 覆盖，并把内置带来的别名 meta 一起带过去；清单 404 或校验不过时把内置那份**原样放回**，绝不留「盘上有包而注册表里什么都没有」。新用例 `tests/p14-boot-installed-override.test.mjs` 四条（换版本必须赢 / 同版本行为不变 / 404 不许自毁 / 非法清单不许留空注册表），反向注入「先 unregister 再取清单」当场抓红；真机复核 `getModuleBase("baby")` → `modules/baby/1.4.4/`
- **批 2 真机结论**：P11-2 忽略只压一次、索引切到 1.4.4 后**又弹**且不再有 Core 块（忽略记的是版本号）；P11-4 关掉开关后连续三次启动，演示源访问日志**零请求**（开着开关时同地址有请求，构成差分 —— 「没发生」这类判据得有界定的窗口才裁得动）；P11-5 坏地址静默、无红字；P12-1 回退留下 `.corrupt-1.4.3-2o3jnp`、台账 `previousVersion` 被清；P12-2 上一版也坏时**一个目录都不改名**，只提示重装；P12-3 无上一版走同一分支但原因文案分岔；P12-4 误报为零；R5 真机取消无残留、重试即成功且 sha 与 zip 一字不差
- 演示源工具重建（`tmp/`，不入库）：`make-update-demo.mjs` 一次产出 1.4.3 与 1.4.4 两个包 + 可切 `latest` 的索引（1.4.3 的 sha256 与 9-28 那轮台账记的**一字不差**，等于顺手复验了构建的确定性）；`update-demo-server.mjs` 一律 `Cache-Control: no-store`（否则索引被缓存会把「版本一变又该弹」判成假失败），`--kbps 12` 让 112KB 约 8 秒才下完 —— 不然「取消」按钮根本来不及点
- **改了自己两处旧账**：①§三 P11「真机验收（2026-09-28）」里「重载后弹出的提示里不再有 baby」这一子判据，按上面的缺陷推论**当时不可能成立**，标为推翻（该行其余结论有盘上证据，仍然有效）；②各样式表的「回退」行按**代理验证**如实标注 —— 四条是在 `baby` 上跑的，其余五套与 card-skin 走同一条 `registerInstalledModules` 分支但未逐套造损。矩阵行数也从 33 变 35（模块 +2），顺带发现上一批我把「样式」从 6 拆成 7 时没同步那个计数
- 门禁：**十八套**测试 ✓（新增 `p14-boot-installed-override`）；矩阵三条真机项转 `已验`、新增两行（自动化 `已做` + 真机 `已验` 各一条，两种「完成」不许互相冒充）；`modules/` 与台账已还原出厂态，工作区只剩未跟踪的 `.workbuddy/`。**产物已重建并复验**：`pnpm build` + `pnpm verify:release` 均 exit=0，且连打两次 **9 项产物的字节与 sha 一字未变** ⇒ `src == dist == release` 已同步（整包 `ecb2ea4165e5…` / 112,113,452 字节 / 3596 文件）。真正的遗留风险不是「忘了重跑」，而是**复现性**：仓库没有 `.gitattributes` 而本机 `core.autocrlf=true`，一次 `git checkout` 就能把包内清单换成 CRLF 从而改掉分包 sha（本次 `baby-1.4.2.zip` 从 112079 → 112085 字节就是这么来的，内容一字未动）——要不要钉死行尾，等用户拍板；在那之前上传一律以 `dist/release/RELEASE-NOTES.md` 里的 9 项 sha 为准。下一步：批 3（游戏模式 / 联网 / Android 本机不可验项）与六套切换的视觉目测；推送由用户执行

## v1.24（2026-09-30）P14 批3 真机：模块生命周期与游戏模式收尾，顺手更正我自己写错的判据

批 3 是收尾清单里剩下的那批真机项：模块生命周期（使用中不许卸 → 卸载 → 走在线索引重装）、游戏模式、排除模式、六套切换的视觉目测、手机布局。结果**能跑的都过了**，而且又一次是我的判据写错被真机纠正。

- **「使用中的样式不许卸」我写成了"点一下会弹红字"，错层了**：真实行为是 UI 侧直接把那行的「卸载」按钮置灰并给 `title` 理由（`moduleAdmin.js:214` → `moduleManagerWindow.js:210`），安装器那条 `IN_USE` 报错只是第二道防线、只有走 API/force 才碰得到。截图里 Online 标着「当前使用」、卸载键是灰的 —— 判据按代码更正回表格
- **卸载 → 重装整链通过**：切走样式后卸载，`modules/baby/1.4.2/` 清空、台账 `baby` 行消失、Core 其余功能不受影响；再从在线索引重装，台账 `baby = {version:"1.4.4", sha256:"e9d784…", hashVerified:true}` 且**没有** `previousVersion`（卸载清掉的不该凭空回来），`tmp/modules/` 无残留。跑完我把盘还原到出厂态并复验 `verify:release` exit=0（27 文件一字不差）
- **游戏模式**：身份 / 国战 / 斗地主 各进一次，无红字、按钮不双份、切模式不残留上一模式的 hook；**排除模式**（自走棋 / 塔防 / 炉石类）UI 不装载、不报错 —— 这两块把§51「游戏模式」类目的真机项清掉了三条
- **六套切换的视觉目测：那一眼的结论不作数，而我当时给的解释也是错的**。`styleRuntime.js:147-156` 的「切换只写配置并回 `reloadRequired:true`」只描述 **API 路径** —— 界面走的 `onNewDecadeStyleClick`（`appearance-handlers.js:33-41`）与 Alt+1~6（`styleHotkeys.js:29-36`）**都会 `saveConfig` 之后 `game.reload()`**，从菜单切样式本来就会自动重启；而 `styleRuntime.activate()` 在 `src/` 里**没有任何调用者**。所以「前几套看着像共用一个样式」当时并没有被解释，得靠量「文档里到底加载了哪几份 CSS」来判（探针与逐套清单见§八 S-1）。已排除的一种猜测：**包内容没有重复** —— 六套的 `player.css` 与 `styles/{character,lbtn,skill,lbtn-window,skill-window}.css` 摘要两两不同，`image/` 目录指纹也各不相同（decade 13 张 / yjcm 24 / codename 17 / online 5 / mobile 0 张纯 CSS）
- 按用户决定：`.gitattributes` **不加**（不影响日常开发功能），所以分包 zip 的 sha 仍会随行尾模式浮动，上传一律以当次 `RELEASE-NOTES.md` 的 9 项为准；**手机布局与横屏**、**联网分支**（要等 P10 的 Release 建好才有真实索引地址可验）、Android/SAF 三条本机不可验项，全部留在§八收尾清单
- 门禁：**十八套**测试 ✓；矩阵 35 → 36 行（新增「卸载前置检查 → 卸载 → 重装」真机一条），三条游戏模式转 `已验`；`online` 与 `card-skin` 的卸载行**没有**跟着转通过 —— 它们的判据各带一条自己的特殊条款（两个能力同时不可用 / 双根行为不同），代理验证不算数，如实留在待验。下一步：P10 建 Release 与传资产（用户动作），之后回来补联网那条

## v1.25（2026-09-30）P15 代码级收尾：把能在 Node 里闭环的都闭环，`src/` 一行没改

用户下达的收尾清单里有六项。本轮的原则是：**有证据才动代码，没证据就只补测试与文档**；结果是没有发现需要改的生产代码 —— `src/` 零改动，套件从 18 涨到 23。

- **六套样式切换：测试钉的是 API 契约，不是界面行为**。新增 `tests/p15-style-switch-contract.test.mjs` 把这件事钉住（切换只发生一次配置写入、不许碰注册表、未知 id 与只读环境都如实被拒），并顺手核对六套映射与内置注册不漂移、六套资源根各自解析到已装版本、`MIGRATED_STYLE_IDS` 齐全 —— 这个名单漏一套，那一套就会去加载不存在的单体 CSS。**同一轮里我写的「批 3 那句『看着像共用一个样式』的根因是没重载」已作废**：`activate()` 在 `src/` 内零调用者，界面两条路径都会自动 reload，它说明不了玩家看到什么。六套 CSS 与 image 目录指纹两两不同（mobile 是 0 图纯 CSS 变体），「包内容重复」这一种猜测已排除
- **online 的卸载判据是错的，不是没验**。原写「卸载后两个能力同时不可用」—— 读码发现这条**不可观测**：capability 取自注册表清单，卸载当下确实变假，但每次启动 `builtInModules.js:31` 会把 `online-chat/online-gift` 重新声明回来，重启后又是真，而此时该样式一条 CSS 都不加载。判据已按代码改成 independent / 资源根 / 台账 / 目录四项，并把这种「capability 报告 ≠ 包装着没」的脱钩直接钉成断言（防止以后有人拿它当卸载依据）
- **card-skin 的双根补齐了自动化验证**：内置五套的根随包切换、玩家自建套的地址在装与卸两种状态下必须一字不变、不可用时 `buildSkinUrl` 返回空串（等价 off 走本体默认卡面）、回退目标不可用时不许回退、`getModuleRel("card-skin")` 在扫描里只许出现一处（防两处各算一份根）
- **生产传输层此前零测试**。`xhrTransport` 是真正跑在下载链路里的那一层，而以前所有失败用例都注入在替身 transport 上。新增 `tests/p15-transport-and-spec-failures.test.mjs` 覆盖：状态码分档、200 空响应体、onerror、**超时与用户取消都走 abort 但必须分得开**、无 XHR 环境、send 直接抛、退避等待中途被取消、以及安装器侧的失败分类（`INVALID_SPEC` 四种形状、404 不重试、解压失败与 IO 抛错分档、摘要算不出来时宁可判失败）。最有说服力的一条反向验证：把 `onabort` 里的 `timedOut` 判别去掉，**只有新套件红、`p5-installer` 全绿**
- **浮层 CSS 的静态不变量泛化到第二个窗口**。此前只扫 `updateNotice`，模块管理窗口（同一套 `el()` 写法、25 个类 / 21 个 div）从来没被扫过。扫描现在按语义来：`position` 对每个 div 都必须显式声明（本体那条规则对绝对定位的 flex 子项同样生效），而 `display` 只在"会并排"时才要求（flex 子项会被块化、绝对/固定定位脱流），两个例外各自写了理由。裸 `transition` 的 15 个类如实打印不判红 —— 没有实测证据就不批量改 CSS
- **两条现状被钉住而不是"顺手修"**：`fetchIndex` 放行了顶层是数组的索引（下游才失败）；`resolveModuleUrl` 允许 `../` 解析到同 host 的上级路径（索引本身是信任根、绝对地址本来就允许，不扩大能力）。写进§五，将来收紧时这两条断言会红，逼着同步判据
- **门禁**：207 个 JS/mjs `node --check` ✓；**23 套**测试 ✓（每条新测试都反向注错验过红，再 `git checkout` 还原复跑为绿）；verify-pack 881/17/0、check-skin-imports 37/0 ✓；`pnpm build` + `verify:release` exit=0 ✓
- **行尾那条被现实咬到了一次**：本轮重构建后 `baby-1.4.2.zip` 从 112085 → 112150 字节、`module-index.json` 与整包 sha 随之变化，而**内容一字未动** —— 起因是昨天为还原测试态跑过一次 `git checkout`，autocrlf 把包内 27 个文件 smudge 成 CRLF。连续两次构建仍然完全一致（确定性没问题），漂的是 checkout 之间。按用户决定仍不加 `.gitattributes`，所以上传以当次 `RELEASE-NOTES.md` 的 9 项 sha 为准（已重新生成并自验一致）
- **仍待真机**（§八「P15 复测步骤」给了准确操作与判据）：六套逐套目测（每套必须重载）、online 与 card-skin 卸载、手机布局与横屏、Android/SAF、联网分支（要等 P10 的 Release 建好）。这些一律标"代码检查通过 / 真机待验"，不许算成已验

## v1.29（2026-10-01）Android 上"卸载一次就把包内容写坏"：Cordova 桥把 typed array JSON 化了

用户手机上卸载样式包后：报 `codename 未以独立包形式注册，拒绝删除`、样式像被删、又没有任何入口能装回来。五条探针把它钉成了**数据损坏**，不是状态错乱。

- **决定性证据**：`decade` 的 `manifest.json` 现在是 57593 字节、以 `{"0":123,"1":34,"2":48,...}` 开头，而没被卸载过的 `yjcm` 仍是 751 字节合法 JSON —— `JSON.stringify(new Uint8Array([123,34,...]))` 正是这个形状
- **根因**：`writeBinary` 的 legacy 分支把 `ArrayBuffer` 转成 `Uint8Array` 再交给本体 `game.writeFile`，而 Cordova 桥对非 `ArrayBuffer` 参数按 JSON 序列化传递 ⇒ 落盘的是"字节数组的 JSON"。文本写入传字符串所以没事 ⇒ `installed.json` 完好、包内文件全废。卸载在非原子平台是 `copyTree` + 删源，"让位 → 回滚"这一对复制把原内容彻底换成了坏内容。修：legacy 分支改传 `ArrayBuffer`（视图按 `byteOffset/byteLength` 切精确长度）
- **我上一轮的判断错在哪**：我拿 `verifyInstalled` 的 `status:"ok"` 当"文件没问题"的证据。`assessModule` 只在字段**有值但不符**时报错（`if (manifest.id && ...)`），字段整个缺失时判 ok —— 这条探针**对这类损坏是瞎的**。同类错误本轮第二次犯（上一次是"CSS 层判据"），已把"采信探针前先读它到底测什么"记进方法论
- **夹具是共犯**：`p5-installer` 的假 `game.writeFile` 把 typed array 忠实存下（`bytesOf` 只认 `Uint8Array`），所以 Android 分支被大量使用却从没暴露过这个形状。已把夹具改成与桥一致（字符串按文本、`ArrayBuffer` 按字节、其余 JSON 化），改完 p5 仍全绿 ⇒ 两个独立夹具互证；新增 `tests/p17-android-binary-write.test.mjs` 先 RED（复现 `{"0":` 形状）再 GREEN，覆盖 `writeBinary` 逐字节与目录搬运后每个文件保真。套件 25 → **26 套**全绿，`node --check` 233 文件 ✓
- **仍未修（已定案，按优先级）**：D2 `copyTree` 对读失败文件静默跳过、且目录搬运后不校验就删源（文件路径有校验，目录没有）；D3 健康检查对"字段缺失"失明 ⇒ P12 自动回退也不会触发；D4 行模型"已安装"来自台账而卸载守卫来自注册表 ⇒ 分叉即"删不掉也装不回"（`verifyInstalled` 已能给出 `reinstall` 动作却没被消费）；D5 `uninstall` 不查 `isAvailable()`
- **发布影响**：七个分包与索引本身没问题（损坏发生在用户设备上卸载/更新时，不在发布物里），受影响的是 Core 代码，而 Core 随扩展本体分发。整包 `full.zip` 还没上传 ⇒ 等这笔修复合入后**重新构建再传整包**，别传修复前那份
- **必须做一次的真机验收**：手机上删掉台账里那四条 → 重启 → 逐个重装 → `manifest.json` 应回到 751 字节量级且含 `"schema": 1`、七个 `independent` 全 true。这一步同时才是 D1 的真机验收 —— Node 夹具绿不等于手机上的桥行为变了
## v1.28（2026-10-01）1.5.0：与上游同号发两个独立发行物，删掉 Stars 自绘的快捷键

决定是「当两个不同的版本发行」，不做就地覆盖。顺带把版本发布形态与入口收干净。

- **为什么不能覆盖原版目录**（三条硬事实，都查过码）：`extension.js` 写死 `extension/十周年UI-Stars/info.json`，覆盖后该路径不存在直接起不来；`info.json` 的 name 决定配置前缀，留 `-Stars` 玩家旧设置读不到、改回 `十周年UI` 则 Stars 侧 118 处键字面量与 P13 迁移器全要反转；`detectLegacy` 第一判据是旧扩展还在 `installed` 名单里，覆盖后旧目录不在 ⇒ 迁移器根本不触发
- **覆盖到底丢不丢东西**（两套目录逐文件比对）：原版 3412 / Stars 3673 文件，同名同路径 2313 个里只有 **182** 个内容变了（175 js + 2 css + 六份元数据）；「只在原版」的 1099 个里 1016 是卡面图，其余除 2 个 `.github/workflows/*.yml`（CI 按决定不迁）外全部是**搬进 `modules/`** 的同一批资源 ⇒ 内容没删，只是换了位置。旧目录残留的五个内置卡面文件夹也不会重复列出（`registerDynamicSkin` 遇同名内置直接 return）
- **bump 到 1.5.0**：7 个 `modules/<id>/1.4.2/` → `1.5.0/`（`git mv`）、7 份 manifest 的 `version` 与 `core`（`>=1.5.0`）、`modules/installed.json` 七条、`info.json`；`releaseTag` 去掉 `-stars` 后缀（用户决定：靠扩展身份区分，版本号与上游同号），并把这条规则钉成断言 `releaseTag("1.4.2") === "v1.4.2"`
- **消掉一处会反复咬人的写法**：`p14-capability-drift`/`p15-style-switch-contract`/`p15-card-skin-uninstall-roots`/`p16-pack-skin-import-url` 四份用例原本把 `1.4.2` 写死，现改为从 `info.json` 取版本 —— 下次 bump 不用再改测试
- **钩子按你的规则删**：原版已有的 Alt+1~6（`styleHotkeys.js`）、`Ctrl+Shift+C`、`disableBrowserShortcuts` **全部保留**；Stars 自绘的只有 `Ctrl+Shift+M`，已删。模块管理入口剩配置窗口里那行「模块管理界面 → 打开」（`config-window.js:350`）与 `decadeUI.showModuleManager()`，§八 P6 的 I/O 两行判据同步改过
- **tmp/ 一次性脚本已清空**（比对、演示源、台账回填、探针校验等）。代价记在账上：P11 演示源（限速 + 版本差索引）以后要用得重建
- **产物**：整包 `十周年UI-Stars-1.5.0-full.zip` 3596 文件 / 112,113,655 字节 / sha256 `f54917a49f05…`，索引 2510 字节 / `bbefc7853d62…`，九项资产全在 `dist/release/RELEASE-NOTES.md`。门禁：25 套测试 ✓、`node --check` 230 文件 ✓、`pnpm build` + `verify:release` exit=0 ✓、verify-pack 881/17/0 ✓、check-skin-imports 37/0 ✓
- **CI 自动打包迁入**（照上游两套工作流改造）：`build.yml` 在 push main 时跑完五道门禁再构建，并把部署形态的 `dist/` 推到孤儿分支 `build-output`；`manual-package.yml` 支持手动触发与 issue 评论 `/package`，把 `dist/release/` 的 9 项资产 + 说明文件作为**工作流 artifact** 上传，sha256 清单与模块源地址写进运行摘要。与原版两处刻意不同：原版构建前不跑测试，这里 `check:syntax`/`test`/`verify:pack`/`verify:skins` 全排在构建前且与本地同一批脚本；`dist/release/` 不进分支，**CI 也不建 Release、不碰已发布版本**
- 配套新增 `scripts/run-tests.mjs`（25 套一次跑完）与 `scripts/check-syntax.mjs`（232 文件 `node --check`），`package.json` 补 `test`/`check:syntax`/`verify:pack`/`verify:skins` 四条入口；工作流里的 shell 步骤已在本机 Git Bash 逐条跑通（sha 与 `RELEASE-NOTES.md` 一字不差），但 **Actions 首次真实运行仍待验** —— 分支部署那段本机没法执行
- **Actions 首跑就抓出一处真缺陷（同日修）**：三次运行全在 `Install dependencies` 步 11~20 秒失败，`ERR_PNPM_BAD_PACKAGE_JSON ... Invalid name: "@noname-extension/十周年UI-Stars"` —— `package.json` 的 `name` 带中文，npm 名称规则不允许，本机 pnpm 11.7.0 容忍、CI 解析到的 **11.28.3** 硬拒。扩展显示名来自 `info.json`，这个 `name` 全仓无人消费，故改为 ASCII `@noname-extension/decadeui-stars`。验证是双向的：用与 CI 同一个 pnpm 11.28.3 在临时夹具里跑 `install --frozen-lockfile`，中文名复现出与 CI 一字不差的错误、ASCII 名 `Done in 968ms` 通过。改完本机门禁复跑全绿，**整包 sha 未变**（`package.json` 不进整包），之前那份 9 项资产清单仍然有效
- **CI 第二跑又抓出一处"判据写死本机布局"**：`verify:pack` 在 CI 报 `可达 875 / 未知缺失 6`、本机却是 `881 / 0`。那 6 条是包内 CSS 用 `../../image/...` 引**本体游戏目录**的资源（如 `image/character/hidden_image.jpg`）—— 本机仓库恰好就是游戏加载目录才命中，CI 上永远不可能命中。已给 `verify-pack.mjs` 加第三类判定：**解析结果跳出仓库根就算「指向本体(越界，不入包)」**，按 `relative()` 判而非按 `existsSync` 判，于是两边结果一致（本机 `875 + 越界 6 + 死引用 17 + 缺失 0`，与 CI 的 875 对齐）。反向验证过：临时塞一条包内真缺失的引用 → `未知缺失 1` 且脚本 exit 1，还原后归零、`git status` 干净。历史行里的 `881/17/0` 是旧口径（越界被算进可达），不回改
- **未做**：推送与建 Release（`gh` 未登录；推送按惯例归用户）、Actions 首跑、Android/SAF 真机、§八 其余待验项

## v1.27（2026-09-30）技能按钮点不动：动态 import 吃不下相对形态的 decadeUIPath

用户回报「所有样式的技能按钮都不能点击确认发动技能」，而同一时刻六套 CSS 探针全绿——**界面画对了，行为层缺席**。这次先把两条最容易误判的路证伪，再定位。

- **先证伪**：点击链路 `ui/character/skins/base.js:431-445` 与原版逐行一致，本体的 `ui.click.skillbutton`、`HTMLDivElement.prototype.listen` 都在；`tmp/check-relative-imports.mjs` 扫 230 个 JS 的相对引用，包内 18 份皮肤 JS 上跳 6 层全部可解析（`check-skin-imports` 也报 37/0）⇒ 既不是这段搬坏，也不是路径深度算错
- **根因**：本体 `noname/util/index.js:2` 是 `const assetURL = "";` ⇒ `window.decadeUIPath` 形如 `extension/十周年UI-Stars/`，**没有协议也没有前导 `./`**。`ui/{skill,lbtn,character}/skins/index.js` 把 `resourceLoader.getAsset()` 的返回串直接交给 `import()`：`<link href>`/`<script src>` 会按文档基址解析相对串（所以 CSS 一直是对的），但 ES module 的说明符解析不接受裸名 ⇒ 抛错被那三个文件的 try/catch 吞掉并 `return null` ⇒ 三个 UI 插件**静默缺席**。原版 import 的是 `./${skinName}.js`（模块自身相对路径），所以同样的时机不出问题
- **最小修复**：`resourceLoader` 新增 `getModuleUrl(moduleId, path)`，按 `document.baseURI`（回落 `location.href`）把原串解析成绝对 URL，拿不到基址时退回原串；三处皮肤装载的**包分支**改用它，未安装分支仍是 `./${skinName}.js`，`getAsset` 语义一字未改（CSS/图片仍走相对解析，那条路本来就对）
- **用例先行**：`tests/p16-pack-skin-import-url.test.mjs` 先 RED（拿相对基址直接 import 必抛），修复后断言 `getModuleUrl` 的结果**真能 import 到磁盘上的皮肤模块**并拿到 `createXinshaSkillPlugin/LbtnPlugin/CharacterPlugin` 三个导出；再加静态不变量（三处包分支必须 `getModuleUrl`、不得残留裸 `getAsset` 喂 import）。反向把 lbtn 换回 `getAsset` → 红在「包分支必须改用 getModuleUrl」。套件 24 → **25 套**全绿，`pnpm build` + `verify:release` exit=0（整包 3596 文件 / 112,113,719 字节 / sha256 `4813b78101b0…`）
- **门禁缺口入档**：`verify-pack`/`check-skin-imports` 查的是包内文件自己的相对 import 深度，查不到「外层动态 import 的说明符是不是合法 ES 说明符」这一层——这类"CSS 全绿、JS 插件缺席"的错位以后由 p16 盯
- **待真机复核（不许写成已验）**：整程序退出重开后跑 §八 S-7 探针 1，硬判据是 `window.app.pluginsMap` 的键里**必须有 `lbtn` 与 `skill`**（修复前必缺），再进一局确认技能可发动。若仍缺，说明还有第二个成因，分叉点是探针 3 的 `touchscreen` 与点击那一刻的控制台红字。**2026-09-30 真机回报「一二均正确」⇒ 探针 1（`pluginsMap` 含 `lbtn`/`skill`）与探针 2（三处皮肤模块动态 import 全 `fulfilled` 且拿到导出名）在真机成立，插件缺席这一层闭环**；技能能否真的确认发动、online 套聊天条与赠礼的实际位置，仍要一句明确回报才转「通过」。**同日行为层闭环**：用户回报「其他的手动测试了，均无误」⇒ 点技能能确认发动、online 套聊天条与赠礼都在且位置不压玩家框，`online.md` 启用行与矩阵「视觉目测」行随之转通过

## v1.26（2026-09-30）真机查出的硬缺陷：boot 期样式读数回落默认套，六套其实一直是十周年脸

用户对着一批样式截图说「所有样式几乎都是一样的，原版不是这样」。这次没有再靠眼睛猜 —— 四条探针 + 一次参照实现比对把根因钉死了，而且**我上一轮给的解释是错的**（已在台账作废）。

- **决定性证据是两条读数不一致**：`document.body.dataset.style` = `"on"`（precontent 阶段读的），`ui.arena.dataset.newDecadeStyle` = `"othersOff"`（晚阶段读的）；而 `link[href]` 里加载的是 `modules/decade/1.4.2/*.css`，六份全在、规则数 248/37/37/51/40/49。也就是说：配置是对的，**boot 时读错了**
- **四条排除**（都做了取证，不是推理）：①包内容没搬错 —— 六套各自 6 份 CSS 与**原版十周年UI** 的对应单体文件逐行比对（`url()` 归一化后）完全一致，差异只有被 Core 统一加载的 `@import "animation.css"` 和一行注释，且没有任何一份等于别套的原版文件；②包都注册上了（`getInstallState` 六套 `independent:true`）；③加载器去重键是完整 URL，跨套不撞；④**时机不是原因** —— 原版在同样的 precontent 时机读样式并加载 `playerN.css`，却工作正常
- **根因**：Stars 的模块级读数 `readRawStyleValue()` 依赖 `window.lib`，而本体只在**开发者模式**被打开时才把 `lib` 挂到 window（`noname/library/index.js:1513` 的 `lib.cheat.i()`，以及 `setLibrary` 里 `if (lib.config.dev)`）。`decadeModule.module.init()` 恰好在 precontent 里决定加载哪套 CSS ⇒ 读到 `undefined` ⇒ 回落默认 `"on"` ⇒ **自 P3 起，六套永远加载十周年套的 CSS**。原版用的是 `import` 的 `lib` 绑定，所以同样的时机不会出问题 —— 这条差异是「拿原版当验收基准」抓出来的，不是猜出来的
- **最小修复**：`styleRuntime` 加 `bindStyleConfigReader(fn)`，读数顺序改为「绑定的取值器 → `window.lib` 兜底 → undefined」；`precontent.js` 在 `initDecadeModule()` 之前绑 `key => lib.config[key]`。配置键仍只在 `getStyleConfigKey()` 一处拼接，38 处历史读取点语义不变
- **用例先行**：`tests/p15-boot-style-reader.test.mjs` 先 RED（复现「没 window.lib 就读不到」的现场）再 GREEN；含静态不变量「绑定必须早于 `initDecadeModule()`」；反向把顺序改成 window.lib 优先 → 红在「绑定过就不许再被 window.lib 覆盖」。套件 23 → **24 套**全绿，`pnpm build` + `verify:release` exit=0（整包 sha `4d163de06eab…`，7 个分包与索引未变）
- **回改旧账**：`yjcm.md` 与 `online.md` 的「启用」行原记真机通过（判据分别是边框档位、聊天条与赠礼位置），但当时那两套 CSS 根本没加载，证据只到状态三值 ⇒ **降级为待验**并注明原因；`decade.md` 恰是默认套（加载对了）保留通过，但补一句证据层级。修复后需按 §八 S-1 重跑六套目测 —— 移动版与一将成名应当立刻看得出不同（就像用户给的原版对比图那样）
- **真机复核（2026-09-30）**：用户回报「探针 5 正确」→「探针全部正确」，§八 S-1 六条判据在真机全部成立 —— 注册状态、boot/arena 两处读数一致、文档里恰好是本套 6 份 CSS 且每条 `link.sheet` 都 OK、资源根与皮肤名各自正确、对局内计算样式指纹按套不同。移动版与一将成名不再与十周年套同脸，这条自 P3 起的缺陷闭环；矩阵新增一行「boot 读数修复后的 CSS 层复核 = 已验」，yjcm/online 两行仍留「待验」，卡着的只是边框档位与聊天/赠礼位置的**目测**本身
- 教训入档：判据必须落在**可观测**的东西上。批1 我用 `styleRuntime.id/skin/config` 三值当「样式切换正确」的证据，那是状态层读数，恰好是缺陷掩盖不了的一层，于是它绿着而界面是错的。CSS 层要用 `link[href]` + `link.sheet` + 计算样式指纹，这套探针已写进 §八 S-1
