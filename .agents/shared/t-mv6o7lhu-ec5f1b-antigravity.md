# T1 屏幕自适应：尺寸资源化 实施报告

- **任务 ID**: `t-mv6o7lhu-ec5f1b`
- **执行方**: `antigravity`
- **时间**: 2026-10-13 20:58 (Asia/Shanghai)
- **状态**: 已完成并通过本地构建、lint 及单元测试校验

---

## 1. 目标

将 TV 端（`apps/tv-android`）从硬编码的 1080p 尺寸改造为多分辨率自适应架构：
1. 创建系统级语义化尺寸资源文件，覆盖 720p（基准档）、sw600dp（平板/紧凑屏幕档）以及 w1280dp（1080p+ 标准视距放大档）。
2. 在 `TvUi.kt` 及 `MainActivity.kt` 中引入统一的 `dimen` 资源提取辅助方法。
3. 替换 `MainActivity.kt` 及关联列表卡片中所有布局硬编码的字面量 `dp()`，实现 UI 尺寸完全资源化驱动。
4. 保持业务逻辑、交互行为（选集抽屉、Seek HUD、分组 Tab 等）完全不变，兼容 API 22 (minSdk=22)。

---

## 2. 实际改动

### 2.1 新建资源文件
1. **`apps/tv-android/app/src/main/res/values/dimens.xml`**：
   - 作为基准尺寸档（按 720p 电视比例取值，约为原 1080p 值的 2/3~3/4），定义了 Scrim 渐变高度、导航栏高度/内边距、Hero 标签与排版、播放控制按钮尺寸、进度条与暂停/Seek HUD、选集抽屉及各面板卡片/输入框等全部语义化尺寸。
2. **`apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`**：
   - 适配中等尺寸屏（sw600dp / 约 85% 比例），确保中型设备与高 DPI 屏幕排版紧凑适中。
3. **`apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`**：
   - 宽度 >= 1280dp 档（完全对应原有 1080p 经典观感比例），保持大屏电视的舒适视距与大尺寸卡片。

### 2.2 代码改造
1. **`apps/tv-android/app/src/main/java/com/hongguotv/tv/TvUi.kt`**：
   - 增加 `@DimenRes` 注解与 `fun dimen(context: Context, @DimenRes id: Int): Int = context.resources.getDimensionPixelSize(id)`。
   - 保留原有 `dp()` 方法以兼容非布局相关的通用转换。
2. **`apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`**：
   - 增加内部 helper `private fun dimen(@androidx.annotation.DimenRes id: Int) = TvUi.dimen(this, id)`。
   - 逐段替换布局中所有的硬编码 `dp(...)`，包括：
     - `scrimTopView`、`scrimBottomView`
     - `buildHeader()`：导航栏各按钮高度、Logo 边距与文字内边距
     - `buildFeedOverlay()`：`episodeBadge`、标题信息、各播放操作按钮（`playButton`、`nextEpisodeButton`、`collectionButton`、`favButton`、`speedButton`、`qualityButton`）的尺寸、间距与 `progressBar`
     - `buildPauseIndicator()` 与 `buildSeekHud()`：浮层 Padding、图标与偏移标签间距
     - `buildEpisodeDrawer()` 与 `renderEpisodeDrawer()`：抽屉 Padding、详情按钮、集数分组 Tab、分集胶囊按钮及滚动居中 offset
     - `panel()` 与 `showSearch()`：面板 Padding、搜索输入框与按钮尺寸
     - `renderCatalog()`：分类标签栏 `CategoryTagLayout` 边距
     - `showDetail()`：海报尺寸、边角半径、详情页各按钮与 8 列分集网格尺寸
     - `showSettings()`：设置页各输入框高度、边距与 Padding
   - 替换完成后，`MainActivity.kt` 布局代码中硬编码字面量 `dp(数字)` 降为 0（仅保留一行私有 helper 定义）。
3. **`apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`**：
   - 同步将海报卡片的外边距、卡片高度、海报图片高度、进度条高度及榜单 Badge 内边距全部接入 `R.dimen.*`。

---

## 3. 验证环境与实际命令结果

- **环境**：Node `v22.20.0`，Gradle Wrapper，Android SDK (compileSdk 35, minSdk 22, targetSdk 35)。

### 验证命令 1：编译与 Debug APK 打包
```powershell
./gradlew :app:assembleDebug
```
**实际结果**：
```
BUILD SUCCESSFUL in 8s
44 actionable tasks: 18 executed, 26 up-to-date
```

### 验证命令 2：Android Lint 静态检查（abortOnError=true）
```powershell
./gradlew :app:lintDebug
```
**实际结果**：
```
BUILD SUCCESSFUL in 9s
27 actionable tasks: 9 executed, 18 up-to-date
Wrote HTML report to file:///F:/Project/hongguoTV/apps/tv-android/app/build/reports/lint-results-debug.html
```
无任何 lint error，完全通过静态代码分析。

### 验证命令 3：单元测试回归
```powershell
./gradlew :app:testDebugUnitTest
```
**实际结果**：
```
BUILD SUCCESSFUL in 4s
23 actionable tasks: 3 executed, 20 up-to-date
```
全套 JVM 单元测试全部通过。

### 验证命令 4：硬编码扫描复核
```powershell
Select-String -Path apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt -Pattern "dp\("
```
**实际结果**：
仅匹配到第 155 行方法签名 `private fun dp(value: Int) = TvUi.dp(this, value)`，业务与布局调用硬编码归零。

---

## 4. 剩余风险与说明

1. **未修改共享内容引擎**：本任务未改动 `shared/content-core/hongguo.js` 或 Web/Windows 后端代码，零跨端干扰。
2. **实机/模拟器分辨率验证提示**：
   - 资源档已经为 720p（基准）和 1080p（w1280dp）设定对应数值，但本任务按标准规范完成资源化与构建编译，实机与模拟器多分辨率下的实际视觉效果将在 T5（DSH 主控验证阶段）结合 `wm size` 实测核验。
