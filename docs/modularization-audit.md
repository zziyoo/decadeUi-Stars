# 十周年UI 模块化架构审计报告（P0）

> 依据总任务书 §33（P0架构审计）、§62（P0最终产物）编制。
> 审计对象：原版 `十周年UI` 扩展（`extension/十周年UI/`，v1.4.2，信息源 info.json；docs/update.md 出现 1.5.0 字样，版本记录疑似未同步）。
> 审计方式：静态扫描（全量文件统计 + import/url/路径 grep）+ 关键文件精读（extension.js、precontent.js、content.js、app.js、decadeUI.js、decadeModule.js、loader.js、constants.js、appearance.js、skins/index.js、safeOverride.js 等）。
> 本阶段未修改任何源码、未移动任何文件。运行时行为未实测，个别结论标注了置信度。
>
> 后记：2026-09-27 P0 验收后，原版源码已整体迁入本仓库（Stars）作为开发基线，运行时路径（`extension/十周年UI/`，由 info.json 的 name 决定）不变，本报告中的路径结论继续有效。原版目录保持不动，玩家继续使用原版扩展。
>
> 后记2（P1实施时发现）：src/core/decadeModule.js 原含未被使用的 STYLE_TO_INDEX 常量，其值与实际加载逻辑相反——playerN.css 的实际序号 = STYLE_CONFIG_VALUES.indexOf(style)+1，即 decade(on)→player1.css、mobile(off)→player2.css（app.js styleFileMap 的 on→main1.js 可佐证）。本报告 §3/§13 中两者的 playerN 对应已据此修正；该死代码已在 P1 中随映射收口一并移除。另 §7.1 原注的 ui/styles/{lbtn,skill}/xinsha.css"特例"实为排序展示造成的误读，一将成名无特殊文件，已修正。

---

## 1. 当前架构总览

### 1.1 规模

| 目录 | 文件数 | 体积 | 内容 |
|---|---|---|---|
| src/ | 174（153 js + 20 css + 1 txt） | 2.3MB | 全部源码；其中 src/libs（eruda 790KB + spine 397KB）占 1.2MB |
| ui/ | 1094 | 53.9MB | ui/assets 53.2MB（1023 文件）+ 插件 JS 39 个 + 样式 CSS 32 个 |
| image/ | 1596 | 34.5MB | card-skins 20.5MB(1016) / ui 9.1MB(209) / styles 4.9MB(368) / character 3 |
| assets/ | 290 | 12.5MB | animation（Spine .skel/.atlas/.png，289 文件）+ dynamic 1 |
| audio/ | 241 | 9.9MB | mp3（caidan、hajimi 彩蛋音频） |
| 合计 | ~3395 | ~113MB | |

### 1.2 启动链路（两阶段）

```text
extension.js（入口，读info.json，设 window.decadeUIName / window.decadeUIPath）
├─ precontent() 阶段（游戏初始化前）
│   ├─ initEruda / initNodeFS（调试，dev）
│   ├─ window.decadeModule = await initDecadeModule()   ← CSS/JS加载器（见1.3）
│   ├─ initApp() → window.app（事件系统 + plugins + ZIP导入 + reWriteFunction）
│   ├─ applyMoveAnimFix / initPrecontentUI(进度条) / initCardAlternateNameVisible
└─ content() 阶段（游戏初始化）
    ├─ window.decadeUI 已存在则直接 return（热更新保护）
    ├─ createDecadeUIObject() → decadeUI.initOverride()  ← 全局覆写引擎（见§10）
    ├─ finalizeDecadeUICore()：装配 animation/effects/features/audio/ui/skills/skins
    ├─ registerLegacyModules()（进度条旧接口）
    └─ loadUIPlugins()：lbtn / skill / character 三插件，逐个 try/catch（已具备失败隔离）
```

### 1.3 现有"准模块化"机制（任务书 §63 确认的可复用资产）

| 机制 | 位置 | 说明 |
|---|---|---|
| 样式CSS动态加载 | `src/core/decadeModule.js` | 按样式加载 player{1-6}.css + ui/styles/{character,lbtn,skill}/{skin}.css（含 window/ 桌面变体） |
| 动态JS加载 | `src/core/loader.js` | createScriptElement/createLinkElement，带版本参数与去重，**proto-ResourceLoader** |
| 插件系统 | `src/core/app.js` | app.plugins / pluginsMap / import(fn) / import(fn)事件系统 |
| 皮肤动态import | `ui/*/skins/index.js` | `import(\`./${skinName}.js\`)` + 工厂命名约定，try/catch 兜底 |
| 第三方插件加载 | `app.loadPlugins()` | 扫描 `extension/十周年UI/<目录>/main1.js(on)|main2.js(默认)|main3.js(othersOff)` 并 eval —— **样式相关的第三方插件约定** |
| ZIP导入 | `app.importPlugin()` | JSZip + game.writeFile/ensureDirectory |
| 卡牌皮肤注册 | `src/core/statics.js` | window.registerDecadeCardSkin + 队列 + 自动扫描 image/card-skins/ 新目录 |
| 安全覆写 | `src/utils/safeOverride.js` | wrapBefore/wrapAfter/wrapAround 返回还原函数；decadeUI._overrideRestoreFns |
| 失败保护 | content.js loadUIPlugins、skins/index.js、loader.js onerror | 单插件失败不拖垮整体（但 spine.js 加载为串行 await，是单点，见§11） |
| 构建体系 | vite.config.ts | lib 模式 7 入口、preserveModules、静态资源 copy、terser；CI：build.yml + manual-package.yml |

### 1.4 样式系统现状（核心结论）

- 配置键 `extension_十周年UI_newDecadeStyle` 有 **6 个官方样式值**（appearance.js）：
  `on=十周年, off=移动版, othersOff=一将成名, onlineUI=Online, babysha=欢乐三国杀, codename=名将杀`
  ⚠️ 注意 `off` 不是"关闭"，而是"移动版"样式。
- 样式→皮肤ID映射 `STYLE_TO_SKIN`：`on→shizhounian, off→shousha, othersOff→xinsha, onlineUI→online, babysha→baby, codename→codename`
  ⚠️ **该映射存在 2 份独立定义**（`src/core/decadeModule.js`、`ui/constants.js`），并由 3 个消费方 `ui/{character,skill,lbtn}/skins/index.js` 通过 ui/constants.js 使用。另有 `STYLE_TO_INDEX`（decadeModule，决定 playerN.css）与 `styleFileMap`（app.js，决定第三方插件 main1/2/3.js）两套平行映射。
- 样式生效 = **多层叠加**：player{N}.css（src/styles）+ ui/styles/character|lbtn|skill/{skin}.css + body data-style 属性 + 皮肤JS动态import + 代码内 38 处运行时分支。

## 2. Core 候选文件

判定标准：所有样式必须依赖；不含任何具体样式资源/逻辑。

| 类别 | 文件 |
|---|---|
| 入口与装配 | extension.js、info.json、src/config.js、src/content.js、src/precontent.js、src/package.js、src/constants.js |
| 运行时核心 | src/core/ 全部 22 文件（bootstrap、app、decadeUI、decadeModule、environment、dialog、animate、resize-sensor、layout、sheet、getters、setters、create、statics、handler、hooks、loader、connectMode、debug、utility、constants、create）※decadeModule 的样式CSS清单部分未来移交StyleRuntime |
| 全局覆写 | src/overrides/ 主体（control、dialog、event、game、get、lib、content、moveAnimFix、player/*、ui/*、card.js、card/overrides.js 中与样式无关部分） |
| 通用UI组件 | src/ui/ 大部分（cardPrompt、card-element、player-element、player-group、player-init、card-utils、layout-init、layout-utils、handtip、component、character-button、skillButtonTooltip、bounds/core/element/identity utils） |
| 功能（第一阶段保留Core） | src/features/ 常规小功能（autoSelect、cardDragSort、equip*、luckyCard、extensionToggle、styleHotkeys、disableBrowserShortcuts、configWindow） |
| 技能表现 | src/skills/ 全部（recast、inherit、guhuo 等，与样式弱耦合，仅个别 newDecadeStyle 分支） |
| UI插件骨架 | ui/{character,skill,lbtn}/{entry,loader,plugin}.js、ui/utils.js（registerPlugin 等） |
| 插件基类 | ui/*/skins/base.js（各插件样式无关底座；注意 character/skins/base.js 已含 shousha 音频路径等默认值，需微调后归 Core） |
| 公共常量 | ui/constants.js（STYLE_TO_SKIN 收口后归 Core/StyleRuntime） |

## 3. Style Pack 候选文件

判定标准：仅特定样式使用；按样式ID可整目录/整文件切分。

| 样式（内部ID） | JS | CSS | 图片 | ui/assets 资源 |
|---|---|---|---|---|
| 十周年 decade(shizhounian) | ui/*/skins/shizhounian.js ×3 | src/styles/player1.css、ui/styles/{character,lbtn,skill}/shizhounian.css(+window×2) | image/styles/decade/(132) | ui/assets/skill/shizhounian/ |
| 移动版 mobile(shousha) | ui/*/skins/shousha.js ×3 | src/styles/player2.css、ui/styles/{character,lbtn,skill}/shousha.css(+window×2) | image/styles/shousha/(92) | ui/assets/character/shousha/(2.0MB)、ui/assets/skill/shousha/(1.8MB)、ui/assets/lbtn/shoushatip/ |
| 一将成名 yjcm(xinsha) | ui/*/skins/xinsha.js ×3 | src/styles/player3.css、ui/styles/{character,lbtn,skill}/xinsha.css、ui/styles/{lbtn,skill}/xinsha.css(额外顶层) | image/styles/xinsha/(24) | ui/assets/character/xinsha/(3.4MB)、ui/assets/skill/yijiang/(被跨样式CSS引用，见§8⚠️) |
| Online(online) | ui/*/skins/online.js ×3 | src/styles/player4.css、ui/styles/{character,lbtn,skill}/online.css(+window×2) | image/styles/online/(57) | ui/assets/character/online/(1.7MB)、ui/assets/lbtn/OL_line/(跨样式引用，见§8⚠️)、ui/assets/chat/(聊天系统) |
| 欢乐 baby(babysha) | ui/*/skins/baby.js ×3 | src/styles/player5.css、ui/styles/{character,lbtn,skill}/baby.css(+window×2) | image/styles/baby/(30) | ui/assets/character/baby/(1.5MB) |
| 名将 codename | ui/*/skins/codename.js ×3 | src/styles/player6.css、ui/styles/{character,lbtn,skill}/codename.css(+window×2) | image/styles/codename/(33) | — |

结构规律：**每样式 = 3个皮肤JS + 5个CSS(+2 window变体) + 1个image/styles子目录 + 若干ui/assets子目录**，切分边界清晰；风险点在 ui/assets 内部的跨样式引用（§8）。

## 4. Feature Pack 候选文件

| Feature | 文件 | 资源 | 独立度 |
|---|---|---|---|
| 卡牌皮肤 card-skin | src/core/statics.js（注册+扫描）、src/overrides/card/{skin-applier,skin-loader,overrides 部分}、src/ui/cardStyles.js（部分） | image/card-skins/ 全部 20.5MB | ★★★ 高（已有公开API+自动发现+docs/card-skin-api.md） |
| 动态皮肤 dynamic-skin | src/skins/dynamicSkin.js、src/overrides/player/dynamic-skin.js | assets/animation/ 12.5MB（Spine）、src/libs/spine.js（运行时） | ★★★ 高（info.json importConfig 已按需加载骨骼包） |
| 击杀/技能特效 kill-effect | src/effects/{kill,line,skill,cardGhost,utils,config}.js | image/ui/effects/、src/styles/effect.css | ★★ 中（skill.js 依赖 outcropAvatar） |
| 进度条 progress-bar | src/ui/progress-bar.js、gtbb.js、phase-tips.js | ui/assets/lbtn/uibutton/jindutiao*.png、time*.png、lbtn/tips/ | ★★ 中（precontent 阶段即加载，拆分需动 precontent） |
| 彩蛋音频 easter-eggs | src/audio/{audioHooks,easterEggs/*,skillDieAudio,characterAudio}.js | audio/ 9.9MB | ★★★ 高（配置开关已有） |
| 欢迎弹窗 welcome | src/features/{welcomeDialog,welcomeHistory,welcomeUpdateHistory,didYouKnow}.js+css+txt | image/ui/avatar/ | ★★★ 高（package.js 已异步 import） |
| 聊天系统 chat | ui/lbtn/chatSystem.js(29.7KB) | ui/assets/chat/ | ★ 中（Online 风格强相关，window.* 全局约20个） |
| 露头头像 outcrop | src/ui/outcropAvatar.js | image/character/ | ★★ 中（docs/outcrop-avatar-api.md 已有约定） |

## 5. Shared Resource 候选文件

| Shared 包 | 内容 | 体积 | 使用方 |
|---|---|---|---|
| shared-fonts | ui/assets/fonts/（8 文件：ATLL/BKJT/FZLBJW/FZLSFT/HYZLSJ/WDZLFT woff2+ttf） | **33.9MB（全仓库最大单项）** | ui/styles/fonts.css（所有样式加载） |
| shared-spine | src/libs/spine.js | 397KB | decadeModule 固定加载 + AnimationPlayer + 动态皮肤 |
| shared-ui | image/ui/（frame 3.5MB、judge-mark 2.1MB、dialog 1.1MB、mark 94文件 等15子目录）、ui/assets/lbtn/uibutton/（公共按钮 2.7MB）、ui/assets/common/ | ~16MB | src/styles 核心 CSS、全部样式 |
| shared-core-css | src/styles/ 核心部分：extension、decadeLayout、layout（@import dialog/component/card/icon/effect）、meihua、menu、animation（被playerN @import）、card、component、dialog、icon、equip | ~230KB | 全部样式 |
| shared-base-css | ui/styles/base.css、fonts.css | — | 全部样式 |
| shared-js-utils | src/utils/、ui/utils.js、ui/constants.js | — | 全部模块 |
| ⚠️ 跨样式资源（详见§8） | ui/assets/skill/yijiang/、ui/assets/lbtn/OL_line/、ui/assets/lbtn/CD/ | ~2MB | 多个样式的 CSS/JS 同时引用 |

## 6. JS 依赖关系

### 6.1 静态依赖主干（全部为相对导入，除 noname 外无外部包）

```text
extension.js → src/config.js / src/content.js / src/precontent.js / src/package.js

src/precontent.js → core/debug.js, core/decadeModule.js, core/connectMode.js, core/app.js,
                    overrides/moveAnimFix.js, ui/progress-bar.js, ui/cardAlternateName.js
src/content.js    → core/bootstrap.js, core/decadeUI.js, core/utility.js,
                    animation/gameIntegration.js, effects/index.js, features/*（9个）,
                    audio/index.js, skins/dynamicSkin.js, ui/*（8个）, skills/index.js,
                    ../ui/lbtn/plugin.js, ../ui/skill/plugin.js, ../ui/character/plugin.js
src/core/decadeUI.js → core/*（14个） + animation/index.js + ui/*（6个） + overrides/*（全部12个入口）
src/core/decadeModule.js → core/loader.js, ui/prefixMark.js
```

### 6.2 跨层依赖要点

- `ui/*/skins/base.js → src/ui/skillButtonTooltip.js`：ui/ 反向依赖 src/（编译期），拆分后皮肤包需要引用 Core 的API。
- `src/overrides/card/overrides.js → src/ui/cardStyles.js`、`src/overrides/player/card-movement.js → src/ui/cardStyles.js`：overrides 依赖 UI 组件。
- `src/config/handlers/card-handlers.js → ../../overrides/card.js + ../../animation/configs/skillAnimations.js`：配置层反向依赖覆写层与动画层。
- 动态 import 共 10 处：皮肤 ×3（`./${skinName}.js`）、welcomeDialog、component-handlers→gtbb、decadeModule.import（第三方模块注册）。
- src/libs/eruda.js（790KB）仅 debug 使用 → 建议按需/独立；spine.js 为共享运行时。
- 全部静态依赖可解析；**静态依赖扫描范围内未发现循环依赖**（decadeUI.js 聚合所有 overrides 属单向扇入）。注意：该结论仅覆盖静态 import 边——动态 import、window.*、lib/game/ui/decadeUI/app 等运行时全局引用不在静态环检测覆盖内，运行时行为未实测。

### 6.3 全局单例与 window 污染（约 60 处赋值点）

```text
运行时对象：window.app、window.decadeUI、window.decadeModule、window.decadeUIName/Path
动画捷径：window.dcdAnim、dcdBackAnim、window.game/get/ui/_status（animation/gameIntegration.js）
卡牌皮肤：window.registerDecadeCardSkin、_decadeUICardSkinQueue
聊天系统：window.chatButton1/2/3、chatOverlay、chatBg、chatInput、dialog_lifesay、dialog_emoji、
          chatRecord、xuwu、cailanzi、shuliang、sendInfo、ipt、input、input_value 等 ~20 个
其他：decadeUIWelcome、decadeUIDidYouKnow、getDecPrompt、jindutiaoTeshu、resetProgressBarState、
      window.timer/timer2、window._gtbbInterval/_gtbbCheckId、_cardAlternateNameVisibleTimer、
      chupaiload、paixuxx、documentZoom
```

## 7. CSS 资源引用关系

### 7.1 CSS 文件布局（52 个）

```text
src/styles/（18）: 核心CSS 12个 + player1~6.css（6个，按样式各1个，@import animation.css）
ui/styles/（32）: base.css、fonts.css
                + character/{6样式}.css
                + lbtn/{6样式}.css + lbtn/window/{6样式}.css
                + skill/{6样式}.css + skill/window/{6样式}.css
src/config/config-window.css、src/features/welcomeDialog.css（功能自带，2个）
```

### 7.2 @import 链

- `src/styles/layout.css` → dialog.css、component.css、card.css、icon.css、effect.css（核心CSS聚合点）
- `src/styles/player1~6.css` → animation.css（每样式重复引入）

### 7.3 url() 相对路径引用（拆分最大风险区）

| CSS 所在目录 | 引用目标 | 相对路径形态 |
|---|---|---|
| src/styles/*.css | image/ui、image/styles、assets | `../../image/...`、`../../assets/...` |
| ui/styles/{character,lbtn,skill}/*.css | ui/assets、根 assets | `../../assets/...`（→ui/assets）、`../../../assets/...`（→根assets）、`../assets/fonts` |
| ui/styles/character/*.css | image/character | `../../../../image/character/hidden_image.jpg` |

典型高频引用：`image/ui/player-bg/bj2.png`（10次）、`image/styles/decade/shield.png`（7次）、`assets/lbtn/OL_line/uibutton/back.png`（5次）等。
⚠️ 同一资源在不同 CSS 中以**不同相对深度**出现（`../../assets` 与 `../../../assets` 并存），目录一旦移动必须逐文件重算。另有 JS 动态注入 CSS（cardStyles.js、cardGhost.js、sheet.js insertRule、overrides/lib.js），其路径为运行时拼接，构建期扫描不到，需要运行时校验兜底。

## 8. 图片/音频/assets 依赖关系

### 8.1 所有权初判

| 资源域 | 归属 | 依据 |
|---|---|---|
| image/styles/{style}/ | 对应 Style Pack | 目录名=样式ID；JS 引用分布确认 |
| ui/assets/character/{shousha,xinsha,online,baby}/ | 对应 Style Pack | 子目录名=皮肤ID |
| ui/assets/skill/{shousha,shizhounian}/ | 对应 Style Pack | 同上 |
| image/ui/ | Shared | 通用UI图（identity-card、judge-mark、mark、frame…） |
| ui/assets/lbtn/uibutton/ | Shared（但内含进度条等Feature资源，拆分时需二级甄别） | 多样式 JS/CSS 共用 |
| ui/assets/fonts/ | Shared | fonts.css 全局加载 |
| image/card-skins/ | Feature(card-skin) | statics.js 动态发现，与样式无关 |
| assets/animation/ | Feature(dynamic-skin) | Spine 骨骼包 |
| audio/ | Feature(easter-eggs) | 彩蛋音频 |

### 8.2 ⚠️ 跨样式共享资源（任务书 §25 预言命中，拆分前必须处理）

1. **ui/assets/skill/yijiang/**（一将成名技能图）——被 `ui/styles/skill/{shousha,xinsha,shizhounian…}.css` 等**多个样式CSS**以 `../../assets/skill/yijiang/`、`../../../assets/skill/yijiang/` 引用 → 若随 yjcm Pack 打走，其他样式的技能按钮图将 404。
2. **ui/assets/lbtn/OL_line/**（Online 线条资源）——被多个 lbtn CSS 引用（back.png 5次、bgdialog 5次、gou 5次…）→ 同上，任务书 §25 的例子即此。
3. **ui/assets/lbtn/CD/**（托管按钮图）——`../../assets` 与 `../../../assets` 两种深度都被引用。
4. **ui/assets/character/shousha/**——除 mobile 样式外，`ui/utils.js` 的 numberToImages/getGroupBackgroundImage 以 shousha 路径为**默认值**，base.js/其他皮肤 JS 也引用 → 拆走后其他样式数字图/势力图失效。
5. **ui/assets/lbtn/uibutton/**——公共按钮与进度条资源混放，需逐文件甄别。

结论：**这批资源应进 Shared Pack（或按"资源→使用者"清单再细分），禁止简单按目录名复制进各 Style。**

### 8.3 音频

audio/ 241 个 mp3 全部由 src/audio/easterEggs 配置表按文件名引用（`{audio:"xxx.mp3"}`），无样式耦合，整体随 easter-eggs Feature 可拆；ui/assets/lbtn/shousha/ 下另有少量音效路径写在 ui/constants.js（AUDIO_PATH）与 character/skins/base.js。

## 9. 当前 newDecadeStyle 耦合点

**38 处引用，分布在 32 个文件**（全清单见附录A）。按性质分类：

| 类型 | 位置 | 说明 |
|---|---|---|
| 配置定义 | src/config/definitions/appearance.js | 6样式枚举、onclick/update |
| 切换处理器 | src/config/handlers/appearance-handlers.js | saveConfig + ui.arena.dataset + game.reload |
| 加载分发 | src/core/decadeModule.js（STYLE_TO_SKIN/STYLE_TO_INDEX/playerN.css）、src/core/app.js（styleFileMap→main1/2/3.js） | **两套独立映射** |
| 运行时分支 | src/overrides/player/{animations,card-movement,hooks,marks,skill-state,state,ui}.js、src/ui/{player-element,player-group,player-init,skillDisplay,progress-bar,prefixMark}.js、src/skills/{animate,base,recast}.js、src/features/{luckyCard,styleHotkeys}.js、src/animation/initAnimations.js、src/core/{layout,hooks}.js | 直接读 lib.config 判断样式 |
| 皮肤选择 | ui/{character,skill,lbtn}/skins/index.js（getCurrentSkin） | 消费 ui/constants.js 中的映射定义 |

收口建议（P2 执行）：以 `decadeUI.style.id` / `decadeUI.style.hasCapability()` 替代；2 处映射定义统一为 StyleRuntime 单一数据源（3 个 skins/index.js 消费点同步切换）；能力判据建议（从现有分支归纳）：`player-frame`（playerN.css 系）、`outcrop`、`online-gift/chat`、`guozhan-colors`、`progress-bar-style` 等。

## 10. 全局 override 风险点

`decadeUI.initOverride()`（src/core/decadeUI.js）为最高风险点：

1. **覆写面**：lib.element.player 约 40+ 方法、lib.element.card 5、content 3、control 5、dialog 1、event 2、ui.update* 8、ui.create* 12、game.logv、get.objtype。全部直接写入无名杀全局对象。
2. **base/ride 双层结构**：先快照原始函数（base），再 ride 覆写；overrides/player/*、overrides/ui/* 内部通过 `base` 引用回原函数（`createPlayerInit(base)` 等）→ **overrides 与 decadeUI.js 是一体，不可拆散**。
3. **还原机制不完整**：`_overrideRestoreFns` 仅覆盖 applyGame/Lib/Dialog/Get/MoveAnimFix 五组；ride 式覆写（override(lib, ride.lib)）**无还原路径** —— 第一阶段"不做运行时卸载"（任务书 §16）的现状依据。
4. **eval 型重写**：app.reWriteFunction/reWriteFunctionX 用 eval 替换函数源码（含字符串 replace）；第三方插件（main1/2/3.js）可能依赖该签名 → 属兼容 API，禁止改动语义。
5. safeOverride wrap* 已在 10 个文件使用并保留 `_original` 与还原函数 → 新代码应强制走 safeOverride（可写进模块规范）。
6. precontent 的 `if (window.decadeUI) return` 热更新保护依赖加载顺序；decadeModule.init 中 `await spine.js` 失败会中断整个 precontent → **单点故障**（建议 P1 起改为 try/catch + 降级）。

## 11. 模块化拆分风险

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | CSS 相对路径跨目录（§7.3），移动文件即断图 | 高 | 构建期资源引用校验（任务书 §26）+ 每样式打 ZIP 前跑检查 |
| R2 | 跨样式共享资源（§8.2）被误打包 | 高 | 先建"资源→使用者"清单（P0已给出初版），共享资源进 Shared |
| R3 | 两处 STYLE_TO_SKIN 定义漂移（新增样式改一处漏一处，3 个消费点随之失准） | 高 | P2 收口 StyleRuntime 单一数据源 |
| R4 | playerN.css 与 ui/styles/*.css 级联依赖（同页叠加，顺序敏感） | 高 | 第一阶段样式包**保持内部目录结构不变**，只整包迁移不重排 |
| R5 | 第三方插件约定（main1/2/3.js、app.import、registerDecadeCardSkin、reWriteFunction）被破坏 | 高 | 全部列入稳定兼容 API（任务书 §57），Legacy Mode 保留 loadPlugins 行为 |
| R6 | spine.js 串行 await 单点故障 | 中 | P1 起加载失败降级为"无骨骼动画"而非整体失败 |
| R7 | window.* 全局约 60 处，第三方/彩蛋代码可能读取 | 中 | 第一阶段不清理，仅登记；模块规范禁止新增 |
| R8 | vite preserveModules 输出路径即运行时路径，dist 与源码路径强绑定 | 中 | 构建改造（P9）前不做目录重排 |
| R9 | ui/ 反向依赖 src/（skins/base.js→skillButtonTooltip） | 中 | 拆包时该文件随 Core，皮肤包通过公开API引用 |
| R10 | `off`="移动版"等历史语义（config值≠功能开关） | 中 | 迁移期保留旧值映射，文档显式说明 |
| R11 | info.json importConfig 骨骼包按需加载机制与未来 PackageInstaller 并存 | 低 | 安装器兼容 importConfig 语义 |

## 12. 推荐迁移顺序

1. **P1 基础设施**：ModuleManager / StyleRuntime / ResourceLoader / Manifest 解析。**零迁移**，只并联：StyleRuntime 接管 2 处 STYLE_TO_SKIN 定义（含 3 个消费点 getCurrentSkin）；ResourceLoader 包一层 decadeUIPath（loader.js 已具雏形）。验收=旧行为不变 + moduleManager.list() 可列出 6 样式。
2. **P2 公共依赖解耦**：newDecadeStyle 38 处引用分批替换为 style API（先读后写，保留 config 兼容）；82 处 lib.assetURL 硬编码收口 resourceLoader.getAsset；Yijiang/OL_line/CD 等共享资源落位 Shared 目录（内容不动，只登记+路径代理）。
3. **P3 decade Pack**（on/shizhounian）：player2.css + ui/styles/*shizhounian* + skins/shizhounian.js ×3 + image/styles/decade + ui/assets/skill/shizhounian → 单 ZIP；删除后 Core 正常、十周年不可用、重装恢复。
4. **P4 mobile Pack**（off/shousha）：同上迁移 shousha 系（注意 §8.2-4 默认路径问题需先解）。
5. **P5+ 下载器 / 管理界面**，随后 online → yjcm → baby → codename 逐包迁移（每包独立 PR + 独立测试表）。
6. **P8 Feature**：card-skin（最独立）→ dynamic-skin（含 Spine 大资源）→ kill-effect → progress-bar。
7. **P9 构建**：vite 增加多入口/多 ZIP 输出 + module-index.json + 资源引用校验插件。

## 13. 第一阶段建议拆分清单（P1–P4）

| 阶段 | 内容 | 体积估计 |
|---|---|---|
| P1 | 6 个样式 manifest.json（由现有枚举生成）+ ModuleManager/StyleRuntime/ResourceLoader 骨架 | 0（纯代码） |
| P2 | STYLE_TO_SKIN 收口；assetURL 收口；共享资源登记 | 0（纯代码） |
| P3 | decade Pack：3 皮肤JS + 7 CSS + player1.css + image/styles/decade(132文件) + ui/assets/skill/shizhounian | ~1.5MB |
| P4 | mobile Pack：3 皮肤JS + 7 CSS + player2.css + image/styles/shousha(92) + ui/assets/character/shousha + skill/shousha + lbtn/shoushatip | ~5MB |

（P1/P2 阶段所有样式资源仍走原路径加载，manifest 先行注册，保证随时可回滚。）

## 14. 暂不应拆分的内容

| 内容 | 原因 |
|---|---|
| src/core/decadeUI.js + src/overrides/* 整体 | base/ride 一体（§10.2），拆散即断 |
| src/content.js / precontent.js 装配顺序 | 初始化时序敏感（spine await、window 守卫） |
| app.js 插件机制与 main1/2/3.js 约定 | 存量第三方插件兼容层 |
| src/core/app.js 的 reWriteFunction eval | 兼容 API |
| chatSystem.js 的 window.* 全局 | Online 聊天与第三方可能引用；待 Feature 化时一并收口 |
| playerN.css ↔ ui/styles/*.css 的内部结构 | 级联顺序依赖，整包迁移不重排 |
| ui/assets/skill/yijiang、lbtn/OL_line、lbtn/CD | 跨样式共享（§8.2），进 Shared 而非任何 Style |
| src/libs/spine.js | 共享运行时（eruda 可后续独立为调试包） |
| 露头/前缀角标/卡牌皮肤注册 API | 已是对外契约（docs/*-api.md），只增不破 |

## 15. 回滚方案建议

1. **目录级回滚**：P3/P4 采用"新目录并行 + 指针切换"：`modules/decade/1.0.0/` 落地后，StyleRuntime 按当前指针取资源；指针回指旧路径（原 src/ui 目录）即整体回滚，原文件在验证期不删除。
2. **加载级回滚**：loader.js 已带 `?v=版本` 与去重；资源加载失败（onerror）时按 manifest 回退到 Core 内置路径并 console.warn。
3. **覆写级回滚**：沿用 `_overrideRestoreFns` + safeOverride 还原函数；新增覆写一律走 safeOverride（获得免费还原句柄）。
4. **配置级回滚**：样式切换 = saveConfig + game.reload（现状已如此，任务书 §16 推荐），无运行时卸载需求。
5. **发行级回滚**：Full Package（现行单体结构）长期保留（任务书 §23），等于永久的 Legacy Mode；module-index.json 记录上一版本号供 P12 自动回退。

---

## 附录A：newDecadeStyle 全部引用点（38 处 / 32 文件）

src/animation/initAnimations.js(3)、src/config/config-window.js(1)、src/config/definitions/appearance.js(2)、src/config/handlers/appearance-handlers.js(4)、src/content.js(1)、src/core/app.js(1)、src/core/decadeModule.js(1)、src/core/hooks.js(1)、src/core/layout.js(1)、src/features/luckyCard.js(1)、src/features/styleHotkeys.js(2)、src/overrides/player/animations.js(1)、src/overrides/player/card-movement.js(1)、src/overrides/player/hooks.js(1)、src/overrides/player/marks.js(2)、src/overrides/player/skill-state.js(1)、src/overrides/player/state.js(1)、src/overrides/player/ui.js(1)、src/skills/animate.js(2)、src/skills/base.js(2)、src/skills/recast.js(2)、src/ui/player-element.js(3)、src/ui/player-group.js(4)、src/ui/player-init.js(2)、src/ui/prefixMark.js(1)、src/ui/progress-bar.js(1)、src/ui/skillDisplay.js(1)、ui/character/skins/index.js(1)、ui/lbtn/skins/base.js(1)、ui/lbtn/skins/index.js(1)、ui/skill/skins/index.js(1)

## 附录B：配置键全表（extension_十周年UI_*，46 个）

newDecadeStyle(38)、aloneEquip(28)、rightLayout(26)、bettersound(16)、playerMarkStyle(9)、outcropSkin(6)、jindutiaoYangshi(5)、handTipHeight(5)、enableEquipCopy(5)、cardkmh(5)、borderLevel(5)、audioEasterEggs(5)、cardbj(4)、JDTSYangshi(4)、jindutiaoSet(3)、handFoldMin(3)、gainSkillsVisible(3)、enableRecastInteraction(3)、discardScale(3)、cardScale(3)、cardPrettify(3)、autoSelect(3)、GTBBYangshi(3)、skillDieAudio(2)、dynamicSkinOutcrop(2)、dynamicSkin(2)、closedExtensions(2)、cardGhostEffect(2)、cardAlternateName(2)、borderStyle(2)、ZLLT(2)、wujiangbeijing(1)、welcomeVersion(1)、showDistanceDisplay(1)、shiliyouhua(1)、mx_decade_characterDialog(1)、meanPrettify(1)、loadingStyle(1)、killEffect(1)、jindutiaoST(1)、enable(1)、chupaizhishi(1)、characterPlugin(1)、cardPrompt(1)、GTBBTime(1)、GTBBFont(1)（括号内为引用次数）

## 附录C：构建入口与产物路径（vite lib 模式 7 入口）

```text
extension.js、src/ui/skillButtonTooltip.js、ui/constants.js、ui/utils.js、
ui/lbtn/plugin.js、ui/lbtn/chatSystem.js、ui/skill/plugin.js、ui/character/plugin.js
external: "noname" + src/skins/dynamicSkin.js（骨骼包按需）
静态copy: src/libs、src/styles、src/config+features 的 css/txt、assets、audio、image、
          ui/assets、ui/styles、ui/{character,skill,lbtn}/skins/*.js、docs、info.json、LICENSE、README.md
```
