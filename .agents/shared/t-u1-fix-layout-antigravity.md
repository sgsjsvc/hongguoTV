# U1 任务完成报告：修复收藏页按钮拉伸 + SeriesAdapter 尺寸资源化

**任务 ID**: `t-u1-fix-layout`  
**执行方**: `antigravity`  
**日期**: 2026-10-13  
**目标代码版本 / 构建**: APK `app-debug.apk` (修改时间 `2026-10-13 22:01:24`, 大小 `8,828,019` bytes)

---

## 1. 目标与背景

1. **问题 1 (P1)**: 收藏页（我的收藏）在空数据状态下，「返回推荐」按钮因 `CatalogScreenView` 中未指定 `LayoutParams`，在垂直方向 `LinearLayout` 容器内默认采用 `MATCH_PARENT` 宽度，横跨整个屏幕（1280dp 宽度）。
2. **问题 2 (P2)**: `SeriesAdapter.kt` 存在 3 处硬编码字面量 `TvUi.dp(context, ...)`（标题 padding、角标 padding、排名圆角半径），在多分辨率及 sw600dp/w1280dp 档位下无法按比例自适应缩放。

---

## 2. 实际代码改动 (逐文件)

### 2.1 `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt`
- **改动**: 在第 92 行将原本无参数的 `addView(returnBtn)` 修改为显式指定包裹内容宽度：
  ```kotlin
  addView(returnBtn, LayoutParams(-2, -2))
  ```
- **效果**: 按钮宽度恢复为 `WRAP_CONTENT`，左对齐，保持原有焦点导航逻辑与文案不变。

### 2.2 `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
- **改动**: 将 3 处硬编码 `TvUi.dp(...)` 全面替换为语义化资源维度 `TvUi.dimen(...)`:
  - 标题 Padding:
    ```kotlin
    val padH = TvUi.dimen(context, R.dimen.series_card_title_pad_h)
    val padTop = TvUi.dimen(context, R.dimen.series_card_title_pad_top)
    val padBottom = TvUi.dimen(context, R.dimen.series_card_title_pad_bottom)
    setPadding(padH, padTop, padH, padBottom)
    ```
  - 角标 Padding:
    ```kotlin
    val padH = TvUi.dimen(context, R.dimen.series_card_badge_pad_h)
    val padBottom = TvUi.dimen(context, R.dimen.series_card_badge_pad_bottom)
    setPadding(padH, 0, padH, padBottom)
    ```
  - 排行角标圆角:
    ```kotlin
    val cornerRadiusPx = TvUi.dimen(holder.itemView.context, R.dimen.series_rank_badge_radius).toFloat()
    holder.rankBadge.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, bgGradient).apply {
        cornerRadius = cornerRadiusPx
    }
    ```

### 2.3 `dimens.xml` 三档配置
为 6 个新增维度键在全部三档中定义梯度取值：
- `apps/tv-android/app/src/main/res/values/dimens.xml`:
  - `series_card_title_pad_h`: 3dp
  - `series_card_title_pad_top`: 4dp
  - `series_card_title_pad_bottom`: 1dp
  - `series_card_badge_pad_h`: 3dp
  - `series_card_badge_pad_bottom`: 3dp
  - `series_rank_badge_radius`: 4dp
- `apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`:
  - `series_card_title_pad_h`: 3.5dp
  - `series_card_title_pad_top`: 5dp
  - `series_card_title_pad_bottom`: 1.5dp
  - `series_card_badge_pad_h`: 3.5dp
  - `series_card_badge_pad_bottom`: 3.5dp
  - `series_rank_badge_radius`: 5dp
- `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`:
  - `series_card_title_pad_h`: 4dp
  - `series_card_title_pad_top`: 6dp
  - `series_card_title_pad_bottom`: 2dp
  - `series_card_badge_pad_h`: 4dp
  - `series_card_badge_pad_bottom`: 4dp
  - `series_rank_badge_radius`: 6dp

---

## 3. 验证与测试记录

### 3.1 双模式静态扫描（硬编码字面量归零）
```powershell
Select-String -Path apps\tv-android\app\src\main\java\com\hongguotv\tv\SeriesAdapter.kt -Pattern 'dp\(\d+\)'
Select-String -Path apps\tv-android\app\src\main\java\com\hongguotv\tv\SeriesAdapter.kt -Pattern 'TvUi\.dp\([^)]*,\s*\d+\)'
```
**输出**: 均为 0 行匹配（完全无残留硬编码）。

### 3.2 资源定义完整性校验
```powershell
$keys = @('series_card_title_pad_h', 'series_card_title_pad_top', 'series_card_title_pad_bottom', 'series_card_badge_pad_h', 'series_card_badge_pad_bottom', 'series_rank_badge_radius')
# 遍历 values/、values-sw600dp/、values-w1280dp
```
**输出**:
```
Checking apps/tv-android/app/src/main/res/values/dimens.xml
  series_card_title_pad_h -> <dimen name="series_card_title_pad_h">3dp</dimen>
  series_card_title_pad_top -> <dimen name="series_card_title_pad_top">4dp</dimen>
  series_card_title_pad_bottom -> <dimen name="series_card_title_pad_bottom">1dp</dimen>
  series_card_badge_pad_h -> <dimen name="series_card_badge_pad_h">3dp</dimen>
  series_card_badge_pad_bottom -> <dimen name="series_card_badge_pad_bottom">3dp</dimen>
  series_rank_badge_radius -> <dimen name="series_rank_badge_radius">4dp</dimen>
Checking apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml
  series_card_title_pad_h -> <dimen name="series_card_title_pad_h">3.5dp</dimen>
  series_card_title_pad_top -> <dimen name="series_card_title_pad_top">5dp</dimen>
  series_card_title_pad_bottom -> <dimen name="series_card_title_pad_bottom">1.5dp</dimen>
  series_card_badge_pad_h -> <dimen name="series_card_badge_pad_h">3.5dp</dimen>
  series_card_badge_pad_bottom -> <dimen name="series_card_badge_pad_bottom">3.5dp</dimen>
  series_rank_badge_radius -> <dimen name="series_rank_badge_radius">5dp</dimen>
Checking apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml
  series_card_title_pad_h -> <dimen name="series_card_title_pad_h">4dp</dimen>
  series_card_title_pad_top -> <dimen name="series_card_title_pad_top">6dp</dimen>
  series_card_title_pad_bottom -> <dimen name="series_card_title_pad_bottom">2dp</dimen>
  series_card_badge_pad_h -> <dimen name="series_card_badge_pad_h">4dp</dimen>
  series_card_badge_pad_bottom -> <dimen name="series_card_badge_pad_bottom">4dp</dimen>
  series_rank_badge_radius -> <dimen name="series_rank_badge_radius">6dp</dimen>
```

### 3.3 自动化测试与编译构建
- **Unit Tests**:
  ```powershell
  cmd /c "cd /d F:\Project\hongguoTV\apps\tv-android && gradlew.bat :app:testDebugUnitTest"
  ```
  **输出**: `BUILD SUCCESSFUL in 8s`, 30 tests completed, 0 failed.
- **Lint**:
  ```powershell
  cmd /c "cd /d F:\Project\hongguoTV\apps\tv-android && gradlew.bat :app:lintDebug"
  ```
  **输出**: `BUILD SUCCESSFUL in 9s`.
- **Assemble**:
  ```powershell
  cmd /c "cd /d F:\Project\hongguoTV\apps\tv-android && gradlew.bat :app:assembleDebug"
  ```
  **输出**: `BUILD SUCCESSFUL in 13s`, 生成 APK `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk`.

### 3.4 真机/模拟器运行时 UI Dump 与 截图验证
- **模拟器环境**: `emulator-5554` (720p / 1280x720)
- **实测页面**: 「我的收藏」空态页面
- **UI Dump Bounds 证明**:
  ```xml
  <node index="0" text="我的收藏" bounds="[36,24][1244,83]" />
  <node index="2" text="暂时没有内容" bounds="[36,83][1244,130]" />
  <node index="3" text="返回推荐" class="android.widget.Button" bounds="[36,130][168,202]" />
  ```
  按钮宽度为 `168 - 36 = 132px`（包裹内容宽度），不再是满宽 `[36,130][1244,202]`。
- **截图凭证**: 产物保存在 `.agents/shared/u1-empty-favorites.png`（截图时间 `2026-10-13 22:14:02`）。

---

## 4. 约束遵守情况

1. 仅修改范围限制的 3 处文件集合（`CatalogScreenView.kt`、`SeriesAdapter.kt`、`res/values*/dimens.xml`）。
2. 未改动 `MainActivity.kt`、`TvUi.kt` 等其他文件，未改动 `shared/content-core/hongguo.js`。
3. 未回退工作区中已有的未提交改动。
4. 保持 MinSdk 22 兼容。

---

## 5. 结论与后续

- **结论**: `t-u1-fix-layout` 验收标准全部达成。
- **后续任务**: 进入 `t-u2-progress-bar` (历史卡片进度条不显示问题排查与修复)。
