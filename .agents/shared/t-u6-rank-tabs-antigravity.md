# 任务交付报告：t-u6-rank-tabs (U6 榜单切换平铺化)

## 一、任务背景与需求
- **任务目标**：将榜单页（Catalog source == "rank"）原本需要遥控器按确认键弹出 Dialog 才能选择榜单的交互，重构为在页面顶部平铺展示 4 个榜单类型（红果热播榜、真人剧热播榜、漫剧热播榜、AI剧热播榜）。
- **硬性要求**：
  1. 顶部平铺展示 4 个榜单 Tab，选中项高亮。
  2. 彻底移除原系统的 Dialog 弹窗逻辑。
  3. 切换榜单后对应列表内容实时更新，焦点落在当前选中的 Tab 上，遥控器左右按键可平滑穿梭移动。
  4. 720p（1280x720）分辨率下不溢出（采用 `HorizontalScrollView` 支持水平滚动）。
  5. 严守边界：不改动 `shared/content-core/hongguo.js`、`TvUi.kt`、`SeriesAdapter.kt`、`DetailScreenView.kt`、`EpisodeDrawerView.kt` 等无关模块。
  6. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过。
  7. 提供严格的“证据三件套”：两步法 PNG 截图、PNG Magic 头部验证、UI Automator XML dump 节点证明。

---

## 二、代码改动清单
1. **尺寸资源（覆盖多分辨率）**：
   - `apps/tv-android/app/src/main/res/values/dimens.xml`
   - `apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`
   - `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`
   - 新增 `rank_tab_margin_end` 与 `rank_tab_pad_bottom`，统一 720p/1080p 下 Tab 的间距与排版。
2. **UI 组件层**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt`
   - 构造参数移除旧 `onSwitchRank`，新增 `rankTypes: List<ChoiceOption>`、`selectedRank: ChoiceOption?`、`onRankSelected: (ChoiceOption) -> Unit`。
   - `source == "rank"` 时构建 `HorizontalScrollView` + `TvUi.row`，将 4 个榜单平铺排布为胶囊按钮，提供高亮/默认态切换与 `rankButtons` 引用。
3. **主界面与控制流**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`
   - 在进入分类/榜单时异步预加载并缓存 `rankTypes`，并附带静态 fallback 兜底。
   - 当 `source == "rank"` 时，进入页面优先将焦点落在当前选中的 Tab（`rankButtons.firstOrNull { it.isSelected }`）。
   - 用户遥控器点击 Tab 时，更新当前 `selectedRank` 并立即重载对应榜单列表，无需任何 Dialog。
4. **服务端 Contract 对齐**：
   - `custom-server/index.mjs`
   - 在 `OFFICIAL_RANK_TYPES` 各选项中补充 `id: t.slug`，严格匹配 `TvRepository.kt` 的 `requiredId()` 规范，保证跨端数据解析零异常。

---

## 三、Gradle 验证
全部通过真实命令运行，真实输出摘要如下：
```powershell
$ cd apps/tv-android
$ ./gradlew :app:testDebugUnitTest
...
BUILD SUCCESSFUL in 8s
23 actionable tasks: 13 executed, 10 up-to-date

$ ./gradlew :app:lintDebug
...
Wrote HTML report to file:///F:/Project/hongguoTV/apps/tv-android/app/build/reports/lint-results-debug.html
BUILD SUCCESSFUL in 14s
1 actionable task: 1 executed (0 errors, 0 warnings)

$ ./gradlew :app:assembleDebug
...
BUILD SUCCESSFUL in 4s
34 actionable tasks: 7 executed, 27 up-to-date
```

---

## 四、真实设备验收证据三件套

所有截图均严格按照“两步法”（`adb shell screencap -p /sdcard/...` -> `adb pull`）捕获，杜绝标准输出重定向造成的 Windows CR-LF 损坏。

### 1. PNG Magic 8 字节验证
PowerShell 校验命令：
```powershell
Get-ChildItem F:\Project\hongguoTV\.agents\shared\t-u6-evidence-*.png | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)[0..7]
    "$($_.Name): $([System.BitConverter]::ToString($bytes))"
}
```
**实际输出：**
```
t-u6-evidence-ai-focused.png: 89-50-4E-47-0D-0A-1A-0A
t-u6-evidence-comic-focused.png: 89-50-4E-47-0D-0A-1A-0A
t-u6-evidence-hot-focused.png: 89-50-4E-47-0D-0A-1A-0A
t-u6-evidence-real-focused.png: 89-50-4E-47-0D-0A-1A-0A
```
四份截图的 Magic 头部均为合法的标准 PNG 签名：`89-50-4E-47-0D-0A-1A-0A`。

---

### 2. Tab 1：红果热播榜 (hot-drama)
- **截图**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-hot-focused.png`
- **UI Automator XML Dump**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-hot-focused.xml`
- **节点状态验证**：
  ```xml
  <node index="0" text="红果热播榜" resource-id="" class="android.widget.Button" package="com.hongguotv.tv" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="true" scrollable="false" long-clickable="false" password="false" selected="true" bounds="[48,72][201,123]" />
  <node index="1" text="真人剧热播榜" resource-id="" class="android.widget.Button" package="com.hongguotv.tv" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[209,72][378,123]" />
  <node index="2" text="漫剧热播榜" resource-id="" class="android.widget.Button" package="com.hongguotv.tv" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[386,72][539,123]" />
  <node index="3" text="AI剧热播榜" resource-id="" class="android.widget.Button" package="com.hongguotv.tv" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[547,72][687,123]" />
  ```
- **特征**：4 个 Tab 在顶部横向平铺，`focused="true"` 且 `selected="true"` 在“红果热播榜”上。剧集网格已载入首项《反向拿捏：和闺蜜穿七零带着婆婆一起离》。

---

### 3. Tab 2：真人剧热播榜 (hot-real-drama)
- **截图**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-real-focused.png`
- **UI Automator XML Dump**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-real-focused.xml`
- **节点状态验证**：
  - “真人剧热播榜”状态更新为 `focused="true"` 与 `selected="true"`。
  - 遥控器向右移动选中并确认切换，列表无缝更新，无弹窗介入。

---

### 4. Tab 3：漫剧热播榜 (hot-comic-drama)
- **截图**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-comic-focused.png`
- **UI Automator XML Dump**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-comic-focused.xml`
- **节点状态验证**：
  - “漫剧热播榜”状态更新为 `focused="true"` 与 `selected="true"`。

---

### 5. Tab 4：AI剧热播榜 (hot-ai-drama)
- **截图**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-ai-focused.png`
- **UI Automator XML Dump**：`F:\Project\hongguoTV\.agents\shared\t-u6-evidence-ai-focused.xml`
- **节点状态验证**：
  - “AI剧热播榜”获得焦点并切换为 `selected="true"`，平铺排布与遥控器左右键导航完整连贯。

---

## 五、结论
U6 榜单切换平铺化任务全部完成，交互顺畅，测试与构建 100% 绿色，全套证据就绪。
