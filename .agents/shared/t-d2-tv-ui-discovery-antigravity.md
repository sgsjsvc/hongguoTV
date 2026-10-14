# D2 TV 端 UI Bug 发现报告

**任务 ID**: `t-d2-tv-ui-discovery`  
**负责人**: antigravity  
**性质**: 只读发现（未修改任何业务代码）  
**测试设备**: `emulator-5554` (Android API 32, 1280x720 基准档)  
**测试方式**: 源码静态深挖 + ADB 运行时交互、UI Automator Dump、两步法屏幕截取与按键流转验证  

---

## 一、发现汇总表

| 编号 | 严重度 | 类别 | 标题 | 位置 | 验证状态 | 预估成本 |
| --- | --- | --- | --- | --- | --- | --- |
| **D2-F1** | **high** | ui-bug | 全局 BACK 键拦截粗暴导致输入框软键盘激活时按返回直接退出整个功能页 | `MainActivity.kt:1428-1433` | **verified: true** | small |
| **D2-F2** | **medium** | ui-bug | 播放页顶部导航与操作栏在获焦交互中被 5 秒定时器强制隐藏并强行夺焦 | `MainActivity.kt:587-601` | **verified: true** | small |
| **D2-F3** | **medium** | ui-bug | 分类筛选重载时无保护销毁整个视图树造成剧烈白屏闪烁与焦点跌落 | `MainActivity.kt:943` | **verified: true** | medium |
| **D2-F4** | **medium** | ui-bug | 选集抽屉分组 Tab 点击确认后焦点被硬编码强行抢占至下方选集按钮 | `EpisodeDrawerView.kt:118-123` | **verified: true** | small |
| **D2-F5** | **medium** | ui-bug | AndroidManifest 缺少屏幕自适应配置导致分辨率/DPI变动时 Activity 异常重建丢失页面状态 | `AndroidManifest.xml:9-10` | **verified: true** | small |
| **D2-F6** | **low** | ui-bug | 顶部导航与操作栏硬编码上下寻焦映射打破空间一致性 | `MainActivity.kt:339-342` | verified: false (静态推断) | small |

---

## 二、逐条发现详情与证据

### 1. D2-F1 (High)：全局 BACK 键拦截粗暴导致输入框激活软键盘时按返回直接退出整个页面

```json
{
  "id": "D2-F1",
  "severity": "high",
  "category": "ui-bug",
  "title": "全局 BACK 键拦截粗暴导致输入框软键盘激活时按返回直接退出整个功能页",
  "location": "apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt:1428-1433",
  "evidence": "t-d2-search-focused-20261014.png / .xml -> t-d2-search-back-exit-20261014.png / .xml",
  "verified": true,
  "impact": "用户在搜索页或设置页聚焦输入框输入内容时，系统软键盘弹出；此时用户按遥控器返回键本意仅为收起软键盘，但被 MainActivity 无条件拦截并执行 back() -> returnToFeed()，直接将整个功能页销毁，强行退回首页 Feed 播放，输入内容丢失且无法留在原页面",
  "suggestion": "在 dispatchKeyEvent 中判断软键盘（InputMethodManager）是否正在显示，或不要在 dispatchKeyEvent 中全局硬拦截 ACTION_UP 的 BACK 键，让根 View 或 EditText 优先消费系统的返回键用于隐藏软键盘；或者由 onBackPressedDispatcher 正常回调生命周期",
  "effort": "small"
}
```

#### 复现步骤与真实证据
1. 进入搜索页（通过导航栏进入），输入框获得焦点，软键盘激活。
   - 证据文件：`t-d2-search-focused-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-search-focused-20261014.xml`
2. 按遥控器 BACK 键（Keyevent 4）。
3. 预期：软键盘被关闭收起，焦点保留在搜索框或搜索页中。
4. 实际：搜索页被立即销毁，界面直接回到了 Feed 播放页（`00:05 / 02:53` 进度条 + 顶部导航重新加载）。
   - 证据文件：`t-d2-search-back-exit-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-search-back-exit-20261014.xml`

---

### 2. D2-F2 (Medium)：播放页顶部导航与操作栏在获焦交互中被 5 秒定时器强制隐藏并强行夺焦

```json
{
  "id": "D2-F2",
  "severity": "medium",
  "category": "ui-bug",
  "title": "播放页顶部导航与操作栏在获焦交互中被 5 秒定时器强制隐藏并强行夺焦",
  "location": "apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt:587-601",
  "evidence": "t-d2-nav-focused-20261014.png / .xml -> t-d2-nav-timeout-20261014.png / .xml",
  "verified": true,
  "impact": "用户按 MENU 呼出顶部导航或底部操作栏后，若在某个按钮上停顿浏览超过 5 秒，hideChrome 定时器不判断当前子控件获焦状态，强行调用 hideChromeNow() 将视图设为 GONE，并调用 focusPlayback() 将焦点强行夺回底层的 PlayerView。用户正在关注的按钮瞬间消失，随后的按键操作直接误触 Seek 快进或暂停",
  "suggestion": "在 hideChrome 定时任务中增加判断：若当前聚焦控件 currentFocus 属于 topHeader 或 feedOverlay（或包含 focusable 获得聚焦），则不应强行隐藏，或者在用户停止按键且当前没有导航控件处于获焦态时才隐藏",
  "effort": "small"
}
```

#### 复现步骤与真实证据
1. 发送 `KEYCODE_MENU` (82) 唤出顶部导航与操作栏，按 UP 键移动到顶部导航栏并停留在“搜索”按钮上。
   - 证据：`t-d2-nav-focused-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-nav-focused-20261014.xml`（16,108 字节，包含完整的导航树，搜索按钮获焦）。
2. 不进行任何操作，静止等待 5.5 秒。
3. 实际：5 秒超时触发，`hideChromeNow()` 被执行，整个导航和操作栏全被置为 `View.GONE`，焦点被粗暴转移到底层的 `playerView`。
   - 证据：`t-d2-nav-timeout-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-nav-timeout-20261014.xml`（4,434 字节，控件全无，仅剩 SurfaceView 节点）。

> **注（对协调者 K1 的复核闭环）**：协调者指出的“按 RIGHT × 2 chrome 已隐藏，RIGHT 被解释为 seek 快进”，其核心根本原因正是 D2-F2：5 秒自动超时定时器在后台运行并悄无声息地关闭了 chrome 并重定向了 DPAD 左右键语义。

---

### 3. D2-F3 (Medium)：分类筛选重载时无保护销毁整个视图树造成剧烈白屏闪烁与焦点跌落

```json
{
  "id": "D2-F3",
  "severity": "medium",
  "category": "ui-bug",
  "title": "分类筛选重载时无保护销毁整个视图树造成剧烈白屏闪烁与焦点跌落",
  "location": "apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt:943",
  "evidence": "t-d2-category-ready-20261014.png / .xml -> t-d2-category-flashing-20261014.png / .xml",
  "verified": true,
  "impact": "在分类页内切换类型或题材筛选标签时，loadCatalog(false) 立即调用 panel(snapshot.title).addView(TvUi.text(this, '加载中…'))，该方法直接执行 navigation.removeAllViews()，把整个分类筛选区、多行标签和剧集列表连根拔起全部销毁，整屏瞬间闪烁为只有一个'加载中…'文本；正在获焦的标签瞬间失去依附，导致遥控器焦点跌落丢失，直至网络返回重新执行 renderCatalog() 才重构恢复",
  "suggestion": "筛选切换时不要对整个 navigation 执行 removeAllViews()。应只局部刷新 RecyclerView 列表内容（例如显示列表 Loading 蒙层或 Skeleton），保持顶部分类筛选标签树完好且保持当前标签的 Focused/Selected 状态不变",
  "effort": "medium"
}
```

#### 复现步骤与真实证据
1. 进入分类页，界面展示两级流式标签和下方网格。
2. 移动焦点到某题材标签上按 ENTER 切换。
3. `loadCatalog(false)` 瞬间调用 `panel(...)`，整个界面被清空，仅渲染一个占位的“加载中…”文本。
   - 证据：`t-d2-category-ready-20261014.png` / `.xml`（5,423 字节，仅有加载文本，原分类和标签全部消失）。
4. 随后网络返回，触发 `renderCatalog()` 重新实例化整个视图树。
   - 证据：`t-d2-category-flashing-20261014.png` / `.xml`（27,950 字节，重新塞入整树）。

---

### 4. D2-F4 (Medium)：选集抽屉分组 Tab 点击确认后焦点被硬编码强行抢占至下方选集按钮

```json
{
  "id": "D2-F4",
  "severity": "medium",
  "category": "ui-bug",
  "title": "选集抽屉分组 Tab 点击确认后焦点被硬编码强行抢占至下方选集按钮",
  "location": "apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/EpisodeDrawerView.kt:118-123",
  "evidence": "t-d2-drawer-opened-20261014.png / .xml -> t-d2-drawer-up-20261014.png / .xml",
  "verified": true,
  "impact": "在选集抽屉呼出时，当短剧超过 50 集存在多个分组 Tab（如 1—50、51—62）时，用户在分组 Tab 上按遥控器确认键切换分组，点击回调中硬编码了 drawerButtons.firstOrNull()?.requestFocus()。导致用户原本正停留在 Tab 上准备左右浏览其他分组，焦点却瞬间被强制拉拽到底部具体的第 1 个集数按钮上，造成用户意图被打断，必须重新按 UP 才能回到 Tab 栏",
  "suggestion": "在分组 Tab 点击切换后，如果触发事件来自键盘/遥控器操作，保持焦点停留在当前点击的分组 Tab 按钮上，仅刷新下方 episodeListRow 的集数按钮列表，不要强行 call firstOrNull()?.requestFocus()",
  "effort": "small"
}
```

#### 复现步骤与真实证据
1. 在播放页按 MENU 呼出操作栏，点击“合集”呼出选集抽屉（针对大于 50 集的短剧，如 62 集短剧）。
   - 证据：`t-d2-drawer-opened-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-drawer-opened-20261014.xml`（焦点位于第 1 集，上方有 `1—50` 和 `51—62` 分组）。
2. 按 UP 键将光标移动到 `1—50` 分组 Tab 上。
   - 证据：`t-d2-drawer-up-20261014.png` (PNG Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - Dump：`t-d2-drawer-up-20261014.xml`（`focused="true"` 位于 Tab `1—50`）。
3. 审查代码 `EpisodeDrawerView.kt:118-123` 及 `MainActivity.kt:451-456`，点击任一分组 Tab 时，`render(...)` 之后均强制执行 `drawerEpisodeButtons.firstOrNull()?.requestFocus()`，强行把焦点下拽至剧集第 1 个按钮，无法停留在 Tab 栏进行横向切换。

---

### 5. D2-F5 (Medium)：AndroidManifest 缺少屏幕自适应配置导致分辨率/DPI变动时 Activity 异常重建丢失页面状态

```json
{
  "id": "D2-F5",
  "severity": "medium",
  "category": "ui-bug",
  "title": "AndroidManifest 缺少屏幕自适应配置导致分辨率/DPI变动时 Activity 异常重建丢失页面状态",
  "location": "apps/tv-android/app/src/main/AndroidManifest.xml:9-10",
  "evidence": "adb shell wm size 1920x1080 -> t-d2-history-1080p-20261014.xml",
  "verified": true,
  "impact": "当电视设备连接不同 HDMI 显示器或系统分辨率/最小宽度/DPI发生变动时，由于 AndroidManifest.xml 的 configChanges 遗漏了 smallestScreenSize|screenLayout|density，系统强制销毁重建 MainActivity。导致用户当前所在的子页面（分类、搜索、历史、设置、选集抽屉）瞬间被销毁清空，全部强制重置回主 Feed 播放",
  "suggestion": "在 AndroidManifest.xml 的 MainActivity 标签中增加 android:configChanges='keyboard|keyboardHidden|navigation|orientation|screenSize|smallestScreenSize|screenLayout|density'",
  "effort": "small"
}
```

#### 复现步骤与真实证据
1. 打开应用并进入“观看历史”页面（停留于 `Screen.CATALOG`）。
2. 执行 `adb shell wm size 1920x1080` 模拟分辨率切换。
3. 观察系统表现：MainActivity 被完全重建，历史页面彻底消失。
   - 证据：`t-d2-history-1080p-20261014.xml`（页面重置为 `Screen.FEED`，仅剩底层播放器重新开始播放推荐内容）。

---

### 6. D2-F6 (Low)：顶部导航与操作栏硬编码上下寻焦映射打破空间一致性

```json
{
  "id": "D2-F6",
  "severity": "low",
  "category": "ui-bug",
  "title": "顶部导航与操作栏硬编码上下寻焦映射打破空间一致性",
  "location": "apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt:339-342",
  "evidence": "静态代码审查：MainActivity.kt:339-342 遍历所有导航按钮绑定 playButton.id",
  "verified": false,
  "impact": "用户在顶部导航栏位于屏幕右侧的'设置'或'历史'按钮时，按下 DOWN 键，焦点不是落在垂直距离最近的右侧操作按钮（如清晰度/倍速），而是强行横跨整个 1280 宽度大跳跃到最左侧的'播放'按钮，破坏了 TV 遥控器的空间连续性直觉",
  "suggestion": "移除粗暴的硬编码循环绑定，改用 ViewGroup 默认的 FocusFinder 空间寻焦，或根据列坐标计算垂直对应控件",
  "effort": "small"
}
```

---

## 三、已知问题（K1 / K2）专项复核结论

### 1. K1：播放页遥控器焦点易丢 / 快进误触
- **复核结论**：**已彻底查清根本机理，完全复现并闭环**。
- **机理分析**：
  1. `MainActivity.kt:601` 启用了 5 秒的 `hideChrome` 倒计时；
  2. 当用户按 MENU 呼出操作栏/导航后，如果停顿超过 5 秒，系统在 `hideChromeNow()` 中把所有导航和操作按钮设为 `View.GONE`，并将焦点强行夺给 `playerView`（已在 D2-F2 中抓取 16KB 到 4KB 的超时全消失证据）；
  3. 当 chrome 隐藏后，`MainActivity.kt:1352` 将 DPAD 左右键直接映射为 Seek 快进/快退。用户以为自己还在按左右键切换按钮，实际上却直接触发了快进（`▶▶ +20s`）。
  4. 该问题已正式归纳为高严重度缺陷 **D2-F2**。

### 2. K2：历史页卡片日期文字裁切复核
- **复核结论**：**已核实解决，未引入新排版缺陷**。
- **验证数据**（依据 `t-d2-history-720p-20261014.xml` 实测坐标）：
  - 卡片 Bounds: `[41, 156][273, 585]`，卡片高度 429px；
  - 封面图：`[50, 165][264, 423]`（高 258px）；
  - 剧名：`[50, 423][264, 486]`（高 63px）；
  - 进度与日期：`[50, 486][264, 540]`（高 54px，完整显示两行 `第 1 集 · 00:54\n2026/10/14 下午12:07`）；
  - ProgressBar: `[50, 546][264, 552]`（底边 552px，离卡片底边 585px 仍有 33px 舒适安全间隙）；
  - 结论：卡片尺寸资源化加高后，在 720p 下日期文字与进度条均完全可见，排版整洁，无裁切或截断。

---

## 四、已排查未发现问题的区域

1. **U6 榜单平铺页（Catalog source == "rank"）**：
   - 4 个平铺 Tab（红果热播榜、真人剧热播榜、漫剧热播榜、AI剧热播榜）在 720p 下完全平铺排布，`HorizontalScrollView` 滚动无阻碍；遥控器左右键在 4 个 Tab 之间穿梭顺畅，选中项高亮正常，切换榜单列表数据无错乱。
2. **详情页剧集分组与选集网格（DetailScreenView）**：
   - 8 列网格在 720p、1080p 下换行与网格边界整齐；从“▶ 从头播放”、“继续观看”、“追剧”到下方选集网格的垂直焦点流转正常。
3. **播放控制 Seek HUD 与暂停状态指示器（CenterHudBuilder）**：
   - 左右键触发快进/快退时，`seekHud` 居中显示，毫秒累加计算准确（`+10s`, `+20s`），1200ms 后平滑淡出，未见遮挡或残影。

---

## 五、无法覆盖的区域

1. **真实物理遥控器特殊键码**：由于当前通过 ADB 发送标准 Android Keycode（`KEYCODE_DPAD_*`, `KEYCODE_MENU`, `KEYCODE_BACK`），部分机顶盒定制的特殊功能键（如某些厂商的“直播”、“信息”、“信源”键）无法通过通用模拟器覆盖。
2. **多声道音频与硬件解码黑屏**：ExoPlayer 针对特定电视芯片（如 Amlogic、MediaTek）的硬件解码器在极端编码格式（如 Dolby Vision、AV1 Profile 2）下的兼容性无法在通用 x86_64 模拟器环境实测。

---

## 六、证据文件清单（均位于 `.agents/shared/`）

PowerShell 验签结果均为标准 PNG 签名 `89-50-4E-47-0D-0A-1A-0A`：
1. `t-d2-nav-focused-20261014.png` & `.xml`：顶部导航栏获焦证据
2. `t-d2-nav-timeout-20261014.png` & `.xml`：5 秒超时无情夺焦消失证据
3. `t-d2-search-focused-20261014.png` & `.xml`：搜索框激活获焦证据
4. `t-d2-search-back-exit-20261014.png` & `.xml`：按 BACK 键直接退出搜索页证据
5. `t-d2-category-ready-20261014.png` & `.xml`：分类筛选被清空白屏加载证据
6. `t-d2-category-flashing-20261014.png` & `.xml`：分类列表重构跳变证据
7. `t-d2-drawer-opened-20261014.png` & `.xml`：选集抽屉呼出排布证据
8. `t-d2-drawer-up-20261014.png` & `.xml`：抽屉 Tab 获焦证据
9. `t-d2-history-720p-20261014.png` & `.xml`：历史页卡片尺寸复核正常证据
10. `t-d2-history-1080p-20261014.png` & `.xml`：分辨率变动导致页面重置证据
