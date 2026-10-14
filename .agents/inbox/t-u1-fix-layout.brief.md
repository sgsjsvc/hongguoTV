# U1 修复收藏页按钮拉伸 + SeriesAdapter 尺寸资源化

**任务 ID**: `t-u1-fix-layout`
**负责人**: antigravity
**依赖**: 无（就绪）
**协调者**: dsh

---

## 前置说明

你此前完成的 T1–T3（TV UI 自适应）已通过协调者验收，T4 独立复核也已完成。本轮是**第二轮修复**，针对复核与用户截图发现的具体缺陷。

**TV 在本轮范围内**（`QUICKSTART.md` 旧边界已废止）。

---

## 问题 1：收藏页空态按钮被拉伸（P1）

### 现象

「我的收藏」为空时显示「暂时没有内容」+「返回推荐」按钮，**该按钮横跨整个屏幕宽度**，视觉突兀。

### 根因（已核实）

`apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt`：

```kotlin
// 第 46 行
orientation = VERTICAL

// 第 89-94 行
if (rows.isEmpty()) {
    addView(TvUi.text(context, "暂时没有内容"))
    val returnBtn = TvUi.pillButton(context, "返回推荐", active = true) { onReturnFeed() }
    addView(returnBtn)          // ← 未传 LayoutParams
    ...
}
```

`LinearLayout` 垂直方向下，子 View 不指定 LayoutParams 时**宽度默认为 `MATCH_PARENT`**，故被拉伸至满宽。

对照：同文件第 108 行 `addView(grid, LayoutParams(-1, 0, 1f))` 是显式指定的。

### 要求

- 按钮宽度改为**包裹内容**（`WRAP_CONTENT`），左对齐
- 保持现有焦点行为不变（`focusBtn.requestFocus()` 逻辑）
- 不改变空态文案

---

## 问题 2：SeriesAdapter 尺寸模式混用（P2）

### 现象

`SeriesAdapter.kt` 同一文件内混用两套尺寸取值方式，其中 3 处是**硬编码字面量**，在不同分辨率下**不会缩放**。

### 根因（已核实）

```kotlin
// 第 75 行 —— 硬编码
setPadding(TvUi.dp(context, 4), TvUi.dp(context, 6), TvUi.dp(context, 4), TvUi.dp(context, 2))

// 第 80 行 —— 硬编码
setPadding(TvUi.dp(context, 4), 0, TvUi.dp(context, 4), TvUi.dp(context, 4))

// 第 109 行 —— 硬编码
cornerRadius = TvUi.dp(holder.itemView.context, 6).toFloat()

// 第 71 行 —— 已正确资源化（对照）
LinearLayout.LayoutParams(-1, TvUi.dimen(context, R.dimen.series_card_image_height))
```

> 注：此问题由 T4 独立复核发现。协调者此前的扫描模式是 `dp(数字)`，**匹配不到 `TvUi.dp(context, 4)` 形式**，故 T1 验收的「硬编码归零」结论有盲区。本轮一并修正。

### 要求

- 为这 3 处新增语义化 dimens 键（命名建议 `series_card_title_pad_*`、`series_card_badge_pad_*`、`series_rank_badge_radius`），**三档都要加**（`values` / `values-sw600dp` / `values-w1280dp`）
- 3 处改为 `TvUi.dimen(context, R.dimen.*)`
- 数值按现有硬编码值折算到三档（基准档 ≈ 原值的 2/3，`w1280dp` 恢复原值，与 T1 的梯度策略一致）

---

## 硬性约束

1. **只改这三个文件**：
   - `ui/CatalogScreenView.kt`
   - `SeriesAdapter.kt`
   - `res/values*/dimens.xml`（三档）
2. **不要修改** `MainActivity.kt`、`TvUi.kt` 或其他 `ui/` 文件（U2 会动，避免同文件冲突）
3. **绝对不要修改** `shared/content-core/hongguo.js`
4. **不要回退或清理**工作区已有的未提交改动
5. 保持 API 22 兼容
6. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`

---

## 验收标准

1. 收藏页空态「返回推荐」按钮**宽度包裹内容**，不再横跨全宽
2. `SeriesAdapter.kt` 中 `TvUi.dp(context, N)` 字面量**归零**
3. **双模式扫描**确认：
   ```powershell
   # 两种模式都必须为 0
   Select-String -Path apps\tv-android\app\src\main\java\com\hongguotv\tv\**\*.kt -Pattern 'dp\(\d+\)'
   Select-String -Path apps\tv-android\app\src\main\java\com\hongguotv\tv\**\*.kt -Pattern 'TvUi\.dp\([^)]*,\s*\d+\)'
   ```
4. 新增 dimens 键在**三档中都存在**且数值有梯度
5. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过
6. 报告写入 `.agents/shared/t-u1-fix-layout-antigravity.md`

---

## 报告要求

- 目标、实际改动（逐文件）、验证命令原文、**真实输出**、剩余风险
- **必须提供收藏页空态的截图或 UI dump**，证明按钮宽度已修复
- 截图需对应到明确的 APK 构建时间
- 无法确认的标「未验证」，不要写成「已通过」

---

## 提交方式

```powershell
node .agents/cli.mjs done t-u1-fix-layout antigravity "结论及报告路径"
```
