# P2 分类页左栏改造 — 独立复核报告

**任务 ID**: `t-p2-verify-rail`
**复核人**: workbuddy（只读复核，未修改任何代码）
**复核对象**: P1 `t-p1-catalog-rail`（antigravity）
**规划**: `.agents/shared/catalog-side-panel-plan.md`
**日期**: 2026-10-15
**设备**: MuMu 模拟器 `127.0.0.1:16384`（Android API 32，override size 1280×720，物理密度 240）
**方法**: 代码 diff 比对 + **重新构建安装 P1 产物** + ADB 实测 + uiautomator dump 坐标量化 + 截图像素级分析

---

## 一、结论速览

| # | 核查项（brief §） | 结论 | 关键证据 |
| --- | --- | --- | --- |
| 1 | 筛选区在**左侧**且为**两列**（2.1） | ✅ **是** | dump `t-p2-category-top.xml`：leftRail `[36,24][192,696]`，类型列 x=42–111、题材列 x=117–186；截图 `t-p2-verify-rail-category-fresh.png` |
| 2 | 网格可见 **≥ 2 行卡片**（2.1） | ⚠️ **部分达成**：1 行完整 + 第 2 行部分可见 | 卡片 `[212,84][409,513]`（h=429px）；第 2 行 y=523 起、被「加载更多」`[207,624]` 截断；网格区 **222px → 541px（+144%）** |
| 3 | 左栏宽度 **≤ 125dp（sw600dp 档）**（2.2） | ✅ **118.3dp**（实测） | 密度 192 实测 leftRail **142px ÷ 1.2 = 118.3dp**（dimens 值 118dp） |
| 4 | 占屏比 **≤ 14%**（2.2） | ✅ 默认档 **12.19%**、sw600dp 档 **11.09%** | 156/1280、142/1280 |
| 5 | 「**动作冒险**」4 字完整显示（2.3，高风险项） | ✅ **完整**，无截断/换行/省略号（两档实测） | 默认档 `[117,498][186,540]`、sw600dp `[110,514][172,552]`；放大图 `t-p2-verify-rail-dongzuomaoxian-zoom.png`、`...-sw600dp-dongzuomaoxian-zoom.png` |
| 6 | **排行榜未变**（2.4，重点回归） | ✅ **未变**（顶部平铺、无左栏） | dump `t-p2-rank.xml`：通栏标题 `[36,24][1244,83]` + 4 榜按钮 y=83–155 横排 |
| 7 | 焦点流转（2.5） | ✅ **四向正确** | 4 组 dump 实测（见 §3.5） |
| 8 | 题材列滚动 + 获焦项自动可见（2.6） | ✅ **25 项全可达**，获焦项自动居中 | 底部 dump：`灾难`(焦点) `[117,449][186,493]`、`剧情` `[117,642][186,684]` |
| 9 | 其他页面未受影响（2.7） | ✅ search / history / favorites / settings 均原布局 | 4 组 dump（见 §3.7） |
| 10 | 越界改动（2.8） | ✅ **无** | `git status`：仅 4 个授权文件被改 |
| 11 | 构建 / lint / 测试 | ✅ BUILD SUCCESSFUL、lint **0 error / 79 warning**（无新类别）、`npm test` **109/109** | §五 |

**总结论**：P1 的核心需求（**左侧、两列、不可折叠、宽度尽可能小、排行榜不动、仅 TV 端**）**全部达成**，代码改动严格限定在授权范围，构建与测试全绿。存在 1 项**表述偏差**（§四-1）与 1 项**资源限定符工程问题**（§四-2），均不阻断验收。

---

## 二、实测方法与过程（含环境陷阱处置）

### 2.1 关键前提：设备上的 APK 是**改造前版本**

复核开始时设备上运行的 APK 呈现的是**旧布局**（顶部横排筛选 + 题材 3 行平铺）——dump 存证 `t-p2-baseline-oldlayout.xml`（标题 `分类 [36,24][1244,83]` 通栏、类型按钮 y=88–160、题材标签 y=170–402 三行、卡片 `[41,407][273,624]` 被裁切）。

因此我**重新构建并安装** P1 产物后才取得新布局证据：

```
gradlew :app:assembleDebug → BUILD SUCCESSFUL（app-debug.apk 8,829,483B）
adb install（先 uninstall 解决 INSTALL_FAILED_UPDATE_INCOMPATIBLE 签名不匹配）
```

> 过程记录：`t-p2-verify-rail-launch.png` 为安装后启动态。**该 dump 同时提供了「改造前」的量化基线**，见 §3.1 表格。

### 2.2 环境陷阱（brief §五 预警项均已命中）

| 陷阱 | 实际情况 | 处置 |
| --- | --- | --- |
| adb 5037 端口冲突 | ✅ 命中：`xray.exe`(PID 27208) 占用本地端口 5037，`adb start-server` 报 `failed to start daemon` | 改用 **MuMu 自带 adb**：`adb.exe -P 15037`（已有 daemon 监听 15037），设备序列号 `127.0.0.1:16384` |
| `input tap` 无效 | 遵守 | 全程仅用 DPAD/MENU/BACK/CENTER |
| 冷启动唤 chrome | 遵守 | 用 `DPAD_DOWN`（非 MENU）；导航序列：`MENU`（唤 chrome 并聚焦「合集」）→ `DPAD_UP`（映射到 nav[2]「分类」）→ `CENTER` |
| 其他 | 新增 | ① 设备路径需 `MSYS_NO_PATHCONV=1`（否则 `/sdcard/x.xml` 被 Git Bash 改写为本地路径）；② `adb install` 需 Windows 路径 `F:\...`；③ 实测中途另一设备 `192.168.1.120:5555` 上线，须用 `-s` 指定序列号 |

### 2.3 chrome 自动隐藏导致的取证难点

播放页 chrome 在最后一次按键后约 5s 自动隐藏（`revealChrome()` → `postDelayed(hideChrome, 5000)`；且只有 UP/DOWN 会重置计时，LEFT/RIGHT 不会）。**而分类/榜单等页面一旦打开即常驻**，因此取证策略为：把「导航键序列 + 页面打开 + dump/截图」压进同一条命令，避免跨命令的计时窗口失效。

---

## 三、逐项核查详情

### 3.1 布局是否真的改变（重点）✅ 是

**实测 dump（默认档，密度 240，1280×720 → 853×480dp）** —— 证据 `t-p2-category-top.xml`：

| 元素 | bounds（px） | 尺寸（px） | 换算（dp） |
| --- | --- | --- | --- |
| **leftRail（左栏容器）** | `[36,24][192,696]` | **156 × 672** | **104 × 448** |
| 类型列容器 | `[42,30][111,690]` | 69 宽 | 46 |
| 题材列容器 | `[117,30][186,690]` | 69 宽 | 46 |
| 题材 ScrollView | `[117,55][186,690]` | 69 × 635 | 46 × 423 |
| 类型/题材按钮 | 例 `真人剧 [42,55][111,97]` | 69 × 42 | 46 × 28 |
| 右区（标题+网格+加载更多） | `[207,24][1244,696]` | 1037 宽 | 691 |
| 网格卡片（第 1 行） | `[212,84][409,513]` | 197 × 429 | 131 × 286 |
| 网格卡片（第 2 行，部分） | `[216,523][405,624]` | 被截断 | — |
| 「加载更多 · 第 1 页」 | `[207,624][1244,696]` | — | — |

**改造前后对比（同一模拟器，我的两次实测 dump）**：

| 指标 | 改造前（旧 APK） | 改造后（P1） | 变化 |
| --- | --- | --- | --- |
| 筛选区位置 | 顶部，占 y=88–402 | **左侧**，占 x=36–192 | 布局性质改变 |
| 筛选区垂直占用 | 314px（类型 72 + 题材 232） | **0**（不占垂直空间） | — |
| 网格区域高度 | 222px（y 402→624） | **541px**（y 83→624） | **+144%** |
| 标题位置 | 通栏 `[36,24][1244,83]` | 右区顶部 `[207,24][1244,83]` | 按规划 §3.1 |
| 第 1 行卡片 | 被裁切 `[41,407][273,624]`（217px / 自然高 429px） | **完整** `[212,84][409,513]`（429px） | 由「半行」到「整行」 |

**两列结构**（截图 `t-p2-verify-rail-category-fresh.png` + `t-p2-verify-rail-sw600dp.png`）：左栏内并排两个竖向列表，各带小标题「类型」/「题材」；类型列 3 个按钮（真人剧/漫剧/AI剧，选中项红色高亮）固定不滚动；题材列含 ScrollView（可见 13–15 项，可滚动）。**与规划 §3.1 设计一致。**

### 3.2 左栏宽度是否「尽可能小」✅

| 档位 | 实测配置 | leftRail 实测 | 换算 dp | 占屏比 | 判定 |
| --- | --- | --- | --- | --- | --- |
| `values/`（默认） | density 240，1280×720 → 853×480dp | 156px | **104.0dp** | 156/1280 = **12.19%** | ✅ ≤14% |
| `values-sw600dp` | density 192，`am get-config` = `sw600dp-w1066dp-h600dp` | 142px | **118.3dp** | 142/1280 = **11.09%** | ✅ **≤125dp**、≤14% |
| `values-w1280dp` | density 90，`am get-config` = `sw1280dp-w2275dp-h1255dp-land-90dpi` | 66px | 117.3dp | 66/1280 = 5.16% | ⚠️ 解析到的是 **sw600dp** 值（见 §四-2） |

**brief §2.2 要求「≤125dp（sw600dp 档）」→ 实测 118.3dp，达标。**

> 方法论说明：sw600dp 档的实测方式为临时 `wm density 192`（使最小宽度达 600dp）后重启应用重测，**测毕已 `wm density reset` 复原（当前 config：`sw480dp-w853dp-h470dp-hdpi`）**。

### 3.3 「动作冒险」是否完整显示（重点）✅ 完整

| 档位 | 按钮 bounds | 按钮内宽 | 文字像素跨度 | 判定 |
| --- | --- | --- | --- | --- |
| 默认档（10sp 文字） | `[117,498][186,540]` | 69px − 6px padding = 63px | x=122→179（**57px ≈ 4 × 15px**） | ✅ 4 字完整，右侧无省略号聚集 |
| sw600dp（11sp 文字） | `[110,514][172,552]` | 62px − 6px = 56px | 放大目视 | ✅ 4 字完整 |

**余量计算**（默认档）：文字 4 × 10sp × 1.5 = 60px；可用 63px → **余量约 3px（2dp）**；sw600dp：4 × 11sp × 1.2 = 52.8px / 可用 56px → 余量约 3.2px（2.7dp）。**均未触发 `ellipsize=END`。**（P1 在代码中设置了 `isSingleLine/maxLines=1/ellipsize=END` + 水平 padding 2dp，与本实测吻合。）

> 该按钮同时受 `setOnFocusChangeListener` 的 `scaleX/Y = 1.05f` 影响；实测获焦时（`灾难`）与未获焦时（`动作冒险`）均无截断。

### 3.4 排行榜是否真的未变（重点回归项）✅ 未变

**实测 dump `t-p2-rank.xml`**：

| 元素 | bounds | 说明 |
| --- | --- | --- |
| 标题「排行榜」 | `[36,24][1244,83]` | **通栏**（非右区） |
| 红果热播榜 | `[36,83][187,155]` | 顶部横排 |
| 真人剧热播榜 | `[192,83][360,155]` | 顶部横排 |
| 漫剧热播榜 | `[369,83][516,155]` | 顶部横排 |
| AI剧热播榜 | `[525,83][671,155]` | 顶部横排 |

- **4 个榜单按钮全部水平居顶排列于 y=83–155，标题通栏，无左栏** → 与 U6 方案及 P1 自己 dump 中的 `[48,110][249,206]` 系列（1080p）结构一致（差异仅来自分辨率）。
- 代码层：`CatalogScreenView` 中左栏构建严格位于 `if (source == "category")` 分支内，`rank/history/favorites` 走 `else` 分支 `addView(TvUi.title(...)); contentTarget = this`，**保持原纵向布局**。
- 截图：`t-p2-verify-rail-rank.png`（本次榜单 API 返回空，显示「暂时没有内容」+「返回推荐」，布局结构与改造前一致）。

**判定：排行榜零回归。**

### 3.5 焦点流转 ✅ 四向正确

| # | 操作 | 起点 | 落点（dump 实测） | 判定 |
| --- | --- | --- | --- | --- |
| 1 | 网格 → **LEFT** | 卡片 `[212,84][409,513]` | 题材列 `成长` `[117,294][186,338]` | ✅ 进入题材列（几何就近） |
| 2 | 题材列 → **LEFT** | `成长` | 类型列 `AI剧` `[42,150][111,194]` | ✅ 进入类型列 |
| 3 | 类型列 → **RIGHT** | `AI剧` | 题材列 `年代` `[117,150][186,194]` | ✅ 返回题材列（y 对齐） |
| 4 | 题材列 → **RIGHT** | `年代` | 网格卡片 `[212,84][409,513]` | ✅ 进入网格（`nextFocusRightId = grid.id`） |
| 5 | 筛选点击 | `家族` → CENTER | `家族` `[117,350][186,394]` **selected=true**，焦点**保持**，网格刷新为家族题材 | ✅ 焦点留在原按钮 + 列表正常刷新（截图 `t-p2-verify-rail-filter-refreshed.png`） |

代码层佐证：类型按钮设 `nextFocusLeftId = 自身 id`（防止从类型列向左脱焦）；题材按钮设 `nextFocusRightId = grid.id`。

### 3.6 题材列滚动 ✅ 25 项可达，获焦项自动可见

- 标签总数 **25**（`全部题材` + 24 个题材），与规划一致。
- 顶部态可见 13 项（`全部题材`…`志怪`，末项底部裁切）；滚动后可见 `恐怖`(裁切)…`剧情`，**并集覆盖全部 25 项**。
- **获焦项自动可见**：焦点在 `灾难` 时该按钮位于 `[117,449][186,493]`（视口中央区）；焦点移至末项 `剧情` 时 `[117,642][186,684]` 完整可见（ScrollView 高度 `[117,55][186,690]`）。实现为获焦时 `smoothScrollTo` 居中（`post{}` 延迟执行）。
- sw600dp 档同样通过（`动作冒险 [110,514][172,552]`、焦点 `剧情 [110,645][172,685]`）。

### 3.7 其他页面未受影响 ✅

| 页面 | dump 证据 | 实测结构 | 判定 |
| --- | --- | --- | --- |
| **search** | `t-p2-search.xml` | 标题「搜索短剧」`[36,24][1244,83]` 通栏 + 输入框 `[36,83][1244,146]` + 「开始搜索」`[36,163][231,211]` | ✅ 原布局，无左栏 |
| **history** | `t-p2-history.xml` | 标题「观看历史」通栏 + 「刷新」`[36,83][168,155]` + 4 列卡片网格（y=156 起） | ✅ 原布局，无左栏 |
| **favorites** | `t-p2-favorites.xml` | 标题「我的收藏」通栏 + 空态「暂时没有内容」+「返回推荐」`[33,128][171,204]` | ✅ 原布局，无左栏 |
| **settings**（附加抽查） | — | 「远程共享与同步」等条目通栏全宽 | ✅ 原布局 |

### 3.8 是否有越界改动 ✅ 无

```
 M apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt   (+215/−37)
 M apps/tv-android/app/src/main/res/values/dimens.xml                            (+8)
 M apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml                    (+8)
 M apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml                    (+8)
（其余改动均为 .agents/ 总线文件）
```

- ✅ `MainActivity.kt` **未改动**（P1 未采用 brief 允许的「焦点逻辑」授权——焦点链改由 `nextFocusLeftId/nextFocusRightId` 在 `CatalogScreenView` 内解决，属更小改动面）
- ✅ `CategoryTagLayout.kt` **未改动**（左栏改为自建 `ScrollView + LinearLayout`，仅删除了原 import）
- ✅ `SeriesAdapter.kt` **未改动**；`apps/web-pc/` **未改动**（TV-only 约束达成）
- ✅ 新增 dimens 键仅 6 个/档，且**未修改任何既有键值**（`series_card_width` 等保持原样）

---

## 四、发现的问题与观察

### 4.1 ⚠️ P1 报告「完整露显 ≥ 2 行卡片」表述不准确（不阻断验收）

P1 报告 §二 声称「卡片首行 y=111-683，次行 y=695 开始，**完整露显 ≥ 2 行**」。实测（含 P1 自己的 dump）显示**第 2 行是被裁切的部分行**：

| 来源 | 第 1 行卡片 | 第 2 行卡片 | 「加载更多」顶边 | 第 2 行可见比例 |
| --- | --- | --- | --- | --- |
| P1 自己的 dump（1080p） | `[282,111][589,683]` h=572 | `[288,696][583,952]` h=**256** | y=952 | **45%** |
| 我的实测（720p，默认档） | `[212,84][409,513]` h=429 | `[216,523][405,624]` h=**101** | y=624 | **24%** |

**结论**：改造确实把网格区从 222px 提升到 541px（+144%），第 1 行由「半行」变为「完整行」，但**第 2 行仅部分可见**——卡片自然高 286dp（default 档）时，720p（480dp 高）与 1080p 屏幕都装不下 2 个完整行 + 加载更多条。

**建议**：① P1/协调者修正报告表述为「1 行完整 + 第 2 行部分可见（≥1.2 行）」；② 若产品确实要「2 完整行」，需下调卡片高度（`series_card_width` 实际是高度，286dp → 约 200dp）或压缩「加载更多」条高度——**属新增需求，非 P1 缺陷**。

### 4.2 ⚠️ `values-w1280dp` 被 `values-sw600dp` 遮蔽（既有工程问题，非 P1 引入）

**实测证据**（density 90，`am get-config` = `sw1280dp-w2275dp-h1255dp-land-90dpi`，dump `t-p2-w1280dp-config.xml`）：

| 元素 | 实测 px | 换算 dp | `values-w1280dp` 期望值 | 实际命中的档 |
| --- | --- | --- | --- | --- |
| leftRail | 66 | **117.3dp** | 142dp | **sw600dp（118dp）** |
| 类型按钮高 | 18 | **32.0dp** | 38dp | **sw600dp（32dp）** |

即在 **w=2275dp 且 sw=1280dp** 的配置下，应用仍解析到 `values-sw600dp`。原因是 Android 资源限定符**优先级顺序中 `smallestWidth`(sw) 先于 `available width`(w)**：`values-w1280dp` 目录不含 sw 限定符，在 sw 比较阶段被判为更泛化而被淘汰，`values-sw600dp` 胜出。

**影响**：16:9 TV 上 `values-w1280dp`（本项目的 4K 档）**实际不可达**——`catalog_rail_*`、以及 S1 的 `switch_hint_*` 等所有"三档"资源中，w1280dp 一档都不会生效。**非 P1 引入**（P1 只是沿用了既有模式），但会让"三档适配"的设计意图落空。

**建议**（不阻断）：把 `values-w1280dp` 改为 **`values-sw1280dp`**（与 sw600dp 同族，优先级可比），或改为 `values-w1280dp` + 删除 sw600dp 中的重复键由 w 档接管。此项建议涉及全项目 dimens，宜由协调者单列任务。

### 4.3 观察：复核开始时设备 APK 为改造前版本

见 §2.1。P1 报告的截图/ dump 虽为新布局，但**该模拟器上的已安装 APK 当时仍是旧版本**——说明 P1 的构建产物未部署（或被后续安装覆盖）。建议后续 UI 类任务在报告中标明「已安装的 APK 哈希/时间戳」，便于复核者直接取证。

### 4.4 观察：标签文字余量偏紧（当前无截断）

默认档「动作冒险」余量约 2dp（4×10sp=40dp 文字 + 4dp padding vs 46dp 列宽）；sw600dp 约 2.7dp。当前**均未截断**，但若未来字号上调 1sp 或换用更宽的字体，即会触发 `ellipsize`。建议保留该余量记录（与 P1 brief 的「余量仅 1.5dp」预警一致，实测比预估略宽）。

### 4.5 观察：既有技术债未处理（规划 §4.4）

`series_card_width` 键名实际表示**高度**（`SeriesAdapter.kt`），P1 未重命名（授权范围内可选）。本次实测再次确认该键驱动卡片高度（429px/1.5 = 286dp）。建议后续单独清理。

---

## 五、构建、lint 与测试复跑

| 命令 | 结果 |
| --- | --- |
| `gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest` | **BUILD SUCCESSFUL**（60 actionable tasks，16 executed / 44 up-to-date）；APK `app-debug.apk` 8,829,483B |
| lint 报告 | **0 errors / 79 warnings**；问题类别全部为既有项（`ApplySharedPref`/`UnusedAttribute`/`GradleDependency`/`DiscouragedApi`/`DataExtractionRules`/`UnusedResources`/`IconLauncherShape`/`ViewConstructor`/`UseKtx`/`ClickableViewAccessibility`）；**无 P1 新增类别**；`catalog_rail_*` 键零告警 |
| `npm test`（Node 全量） | **109/109 pass**（0 fail） |

> `ViewConstructor`（"Custom view CatalogScreenView is missing constructor used by tools"）为既有告警——该类在 P1 之前即为自定义 View，构造函数签名未被 P1 修改。

---

## 六、无法核实项（如实声明）

| 项 | 原因 | 替代证据 |
| --- | --- | --- |
| 真实 TV 真机（非模拟器）上的渲染与遥控器行为 | 无真机接入 | 模拟器（MuMu，API 32）实测；TV 类焦点行为（DPAD 几何就近）已实测 |
| `values-w1280dp` 档的**实际渲染效果** | 该档被 sw600dp 遮蔽，任何 16:9 配置下都不可达（§4.2 已实测证明遮蔽事实） | 遮蔽事实为实测；142dp 数值为代码读取 |
| 分类页**空态**（无数据）路径 | 分类接口始终有数据，未构造空返回 | 代码层：空态分支 `contentTarget.addView(...)` 已随右区路由调整（diff 可见） |
| 三档 × 三分辨率的完整矩阵截图 | brief 验收标准 12 要求，本次覆盖 默认档 + sw600dp 档 + w1280dp 配置（3 种配置） | 3 种配置均已取证；w1280dp 因遮蔽无独立渲染 |

---

## 七、复核结论

1. **筛选区是否在左侧且为两列 —— 是。** dump 坐标 + 截图双重确认（leftRail `[36,24][192,696]`，两列各 69px 宽，带「类型」「题材」小标题，常驻不可折叠）。
2. **左栏宽度 ≤ 125dp（sw600dp 档）—— 达标（118.3dp 实测）**；占屏比 11.09%（sw600dp）/ 12.19%（默认档），均 ≤14%。
3. **「动作冒险」完整显示 —— 是**，两档实测 + 像素级放大验证，无截断/换行/省略号。
4. **排行榜未变 —— 是**，顶部平铺 4 榜 + 通栏标题 + 无左栏；代码路径 `source != "category"` 完全保留原布局。
5. **越界改动 —— 无**，仅 4 个授权文件（`CatalogScreenView.kt` + 3 档 `dimens.xml`），`MainActivity.kt`/`CategoryTagLayout.kt`/`SeriesAdapter.kt`/`apps/web-pc` 均未触碰。
6. **焦点流转 / 滚动 / 其他页面** —— 全部通过（四向流转、25 项可达且获焦自动可见、4 个其他页面原布局）。
7. **构建 / lint / 测试** —— 全绿（BUILD SUCCESSFUL、0 error、109/109）。
8. **待协调者处置的 2 项**（均不阻断）：① P1 报告「≥2 行」表述需修正为「1 行完整 + 第 2 行部分」；② `values-w1280dp` 遮蔽问题建议单列任务改为 `values-sw1280dp`。

---

## 八、证据文件清单（均在 `.agents/shared/`，PNG 签名 `89-50-4E-47-0D-0A-1A-0A` 全部校验通过）

**截图**

| 文件 | 内容 |
| --- | --- |
| `t-p2-verify-rail-category-fresh.png` | 分类页新布局（左栏两列 + 网格 2 行可见）★主证据 |
| `t-p2-verify-rail-category-new.png` | 安装后首次看到的新布局 |
| `t-p2-verify-rail-category-scrolled.png` | 题材列滚动态 |
| `t-p2-verify-rail-filter-clicked.png` / `-filter-refreshed.png` | 点击「家族」筛选及刷新后 |
| `t-p2-verify-rail-tag-scrolled.png` | 题材列滚到底（`动作冒险` 可见） |
| `t-p2-verify-rail-dongzuomaoxian-zoom.png` | 「动作冒险」3× 放大（默认档） |
| `t-p2-verify-rail-sw600dp.png` / `-sw600dp-scrolled.png` | sw600dp 档分类页与滚动底部 |
| `t-p2-verify-rail-sw600dp-dongzuomaoxian-zoom.png` | 「动作冒险」3× 放大（sw600dp 档） |
| `t-p2-verify-rail-rank.png` | 排行榜（顶部平铺，未变）★重点回归证据 |
| `t-p2-verify-rail-search.png` / `-history.png` / `-favorites.png` | 其他页面原布局 |
| `t-p2-verify-rail-launch.png` | 安装后启动态 |
| `t-p2-verify-rail-w1280dp-config.png` | w1280dp 配置（密度 90）下的实际渲染 |

**UI dump（坐标证据）**

| 文件 | 内容 |
| --- | --- |
| `t-p2-baseline-oldlayout.xml` | **改造前**旧布局基线（顶部横排） |
| `t-p2-category-top.xml` | 分类页顶部态（leftRail/两列/卡片坐标） |
| `t-p2-category-scrolled-bottom.xml` | 题材列底部态（`动作冒险`/焦点 `灾难`/`剧情`） |
| `t-p2-filter-family-selected.xml` | 「家族」selected=true + 焦点保持 |
| `t-p2-rank.xml` | 排行榜 4 榜坐标 |
| `t-p2-search.xml` / `t-p2-history.xml` / `t-p2-favorites.xml` | 其他页面 |
| `t-p2-sw600dp-category.xml` / `t-p2-sw600dp-bottom.xml` | sw600dp 档（leftRail 142px） |
| `t-p2-w1280dp-config.xml` | sw1280dp/w2275dp 配置下解析到 sw600dp 值 |
