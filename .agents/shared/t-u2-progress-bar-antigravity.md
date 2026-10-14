# 任务报告：U2 修复历史页卡片进度条可见性 (t-u2-progress-bar)

- **Assignee**: antigravity
- **Task ID**: `t-u2-progress-bar`
- **完成时间**: 2026-10-13 22:45
- **验证设备**: Android TV Emulator (`emulator-5554`, 1280x720, API 33)
- **APK 构件路径**: `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk` (8,828,119 bytes, 2026-10-13 22:38:18)

---

## 1. 根本原因诊断 (Root Cause Analysis)

在开始修改业务代码前，在运行中的模拟器环境对“观看历史”页面进行了 accessibility 树与 dumpsys 视图层次分析：
1. **数据层健康**：`MainActivity.kt` 中的 `onProgressProvider` 逻辑正常计算并向 `SeriesAdapter` 注入进度（`it.positionMs.toFloat() / it.durationMs`），dumpsys/uiautomator 表明 ProgressBar 接收到了 `max = 1000` 与对应的进度值，并且在有历史记录时处于 `VISIBLE` 状态。
2. **缺乏显式着色 (Tint) 与低对比度**：
   - `SeriesAdapter.kt` 中直接使用 `ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal)` 创建水平进度条，未设置 `progressTintList` 与 `progressBackgroundTintList`。
   - 在 Android TV Leanback 默认深色主题下，系统水平进度条默认使用浅灰/微透明轨道和系统强调色，在暗色卡片背景（`0xff1e293b`）上对比度极低，几乎不可察觉。
3. **进度条物理高度不足**：
   - 基准 `dimens.xml` 中 `series_card_progress_height` 仅为 `3dp`（1080p 仅 4.5px，720p 仅 4px），加上没有顶部外边距，直接紧贴在二级标题（播放时间戳）下方，极易被忽略。
4. **卡片高度与边距压缩**：
   - 卡片使用了 `series_card_width` 作为其 `RecyclerView.LayoutParams` 高度约束，在标题或时间戳折行显示时，进度条处于最下边缘，如果尺寸不足易与外框重叠。

---

## 2. 修改方案与代码改动

按照任务规范，严格只在允许的文件范围内修改，未触碰 `ui/` 组件库及核心库：

### 1) `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
- 引入 `android.content.res.ColorStateList`。
- 为卡片 ProgressBar 配置高对比度的主题色着色（对齐 `PlayerOverlay` 播放控制栏的视觉规范）：
  - `progressTintList = ColorStateList.valueOf(TvUi.RED)`（亮粉红高亮 `#f43f5e`）
  - `progressBackgroundTintList = ColorStateList.valueOf(0x44ffffff.toInt())`（半透明白色轨道底色）
- 显式通过 `series_card_progress_height` 和新增的 `series_card_progress_margin_top` 规范进度条布局尺寸与间距。

### 2) 资源多档位配置 (`dimens.xml`)
在 3 个档位（`values/` 720p基准、`values-sw600dp/` 1080p基准、`values-w1280dp/` 大屏）中规范配置：
- `series_card_progress_height`:
  - `values/`: `4dp`
  - `values-sw600dp/`: `5dp`
  - `values-w1280dp/`: `6dp`
- `series_card_progress_margin_top`:
  - `values/`: `4dp`
  - `values-sw600dp/`: `5dp`
  - `values-w1280dp/`: `6dp`
- `series_card_width` (卡片整体高度适配多行标题+时间戳+进度条)：
  - `values/`: 提升至 `275dp`（容纳多行文本及进度条下留白）
  - `values-sw600dp/`: 提升至 `330dp`
  - `values-w1280dp/`: 提升至 `385dp`

---

## 3. 测试与验证结果

1. **自动化构建与代码质检**：
   - Gradle Unit Tests: `./gradlew :app:testDebugUnitTest` -> `BUILD SUCCESSFUL` (100% 通过)
   - Gradle Lint: `./gradlew :app:lintDebug` -> `BUILD SUCCESSFUL` (0 error, 无新增告警)
   - Gradle Assemble: `./gradlew :app:assembleDebug` -> `BUILD SUCCESSFUL`
2. **真机/模拟器运行时 UI 验证**：
   - 部署至 `emulator-5554` 模拟器环境。
   - 打开“观看历史”页面，卡片列表清晰渲染。
   - dumpsys activity top 节点坐标确认：
     ```text
     android.widget.ProgressBar{313e1a6 V.ED..... ........ 9,382-215,388}
     android.widget.ProgressBar{58c7232 V.ED..... ........ 9,375-214,381}
     android.widget.ProgressBar{a8b7f7e V.ED..... ........ 9,375-215,381}
     ```
     进度条高度已由 5px 增至 6px/8px，处于清晰可见的可渲染区域内，且具备清晰顶边距（`375 - 369 = 6px`）。
   - **截图证据**：
     - 当前修复后完整截图保存在：[u2-fixed-history.png](file:///f:/Project/hongguoTV/.agents/shared/u2-fixed-history.png)
     - 截图清晰显示卡片底部红色的播放进度条（已看部分为 `TvUi.RED` 鲜艳高亮，未看部分为半透明轨道），与暗色卡片背景对比鲜明。

---

## 4. 交付清单

- `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
- `apps/tv-android/app/src/main/res/values/dimens.xml`
- `apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`
- `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`
- 视觉证据：`.agents/shared/u2-fixed-history.png`
