# TV UI 第二轮优化 — 问题清单与任务规划

**协调者**: dsh
**日期**: 2026-10-13
**依据**: 用户提供的 5 张页面截图 + 代码核实 + T4 独立复核报告

---

## 一、已核实的真实问题

### P1（中）收藏页空态按钮被拉伸 ⚠️ 确认

**现象**：截图 4「我的收藏 → 暂时没有内容」中，「返回推荐」按钮横跨整个屏幕宽度。

**根因**：`CatalogScreenView.kt` 是 `LinearLayout(orientation = VERTICAL)`，第 92 行 `addView(returnBtn)` **未传 LayoutParams**，默认宽度为 `MATCH_PARENT`，在垂直容器中被拉伸至满宽。

**证据**：
```
行 46: orientation = VERTICAL
行 92: addView(returnBtn)          ← 缺 LayoutParams
行 108: addView(grid, LayoutParams(-1, 0, 1f))   ← 对照：显式指定
```

**修复**：改为 `addView(returnBtn, LayoutParams(-2, -2))`（包裹内容），并加左对齐。

---

### P2（中）SeriesAdapter 混用两套尺寸模式 ⚠️ 确认（T4 发现，我漏检）

**现象**：`SeriesAdapter.kt` 同一文件内混用 `TvUi.dp(context, N)` 与 `TvUi.dimen(context, R.dimen.*)`。

**证据**：
```
行 75:  setPadding(TvUi.dp(context, 4), TvUi.dp(context, 6), ...)   ← 硬编码
行 80:  setPadding(TvUi.dp(context, 4), 0, ...)                    ← 硬编码
行 109: cornerRadius = TvUi.dp(holder.itemView.context, 6)         ← 硬编码
行 71:  LinearLayout.LayoutParams(-1, TvUi.dimen(context, R.dimen.series_card_image_height))  ← 已资源化
```

**影响**：这 3 处在不同分辨率下**不会缩放**，是自适应的实际缺口。

**我作为验收方的疏漏**：我的扫描模式是 `dp(数字)`，匹配不到 `TvUi.dp(context, 4)` 形式，导致 T1 验收的「归零」结论失真。T4 的独立复核补上了这个盲区。**已记入教训。**

**修复**：新增对应 dimens 键，3 处改为 `TvUi.dimen(...)`。

---

### P3（低）历史页卡片进度条不可见

**现象**：截图 5 中卡片底部有进度区域但未显示进度条。

**核实**：`MainActivity.kt:1015` 有 `onProgressProvider`，逻辑存在。截图中部分卡片显示 `第 3 集 · 00:50`（有进度信息），但**进度条本身未见明显着色**。

**待确认**：可能是进度条高度过小（`series_card_progress_height`）或颜色与背景对比不足。

**修复**：核实进度条高度与配色，确保可见。

---

### P4（低）分类页题材标签行末留白

**现象**：截图 3 中「剧情」标签单独占一行，右侧大片空白。

**核实**：`CategoryTagLayout` 是流式布局，标签按宽度自动换行。24 个题材标签换行后末行只剩 1 个，属正常流式行为。

**判断**：**非缺陷**。若追求美观可调整标签间距使其更均匀，但非必要。

---

### P5（提示）搜索页空态无引导

**现象**：截图 2 中搜索页只有输入框和按钮，下方大片空白。

**核实**：`SearchScreenView.kt:69-77` **已实现** `recentQueries` 展示，但仅在有历史时显示。截图时历史为空，故空白。

**判断**：**非缺陷**。可选优化：历史为空时显示热门推荐词，提升可发现性。

---

## 二、任务划分

| 任务 | 内容 | 负责人 | 允许改动文件 |
| --- | --- | --- | --- |
| **U1** | 修 P1 收藏页按钮拉伸 + P2 SeriesAdapter 尺寸资源化 | antigravity | `ui/CatalogScreenView.kt`、`SeriesAdapter.kt`、`res/values*/dimens.xml` |
| **U2** | 修 P3 历史页进度条可见性 | antigravity | `SeriesAdapter.kt`、`MainActivity.kt`、`res/values*/dimens.xml` |
| **U3** | 独立复核 U1/U2 | workbuddy | 只读 |

### 串行要求

U1 与 U2 **都改 `SeriesAdapter.kt`**，必须串行（U2 依赖 U1）。

### 为什么不分给 Codex

本轮全部是 TV UI 层改动，Codex 定位是后端/算法，无可复用改动。分给多人会造成同文件冲突。

---

## 三、验收标准

### U1

1. 收藏页空态「返回推荐」按钮**不再横跨全宽**，宽度包裹内容
2. `SeriesAdapter.kt` 中 `TvUi.dp(context, N)` 字面量**归零**
3. **双模式扫描**确认：`dp(数字)` 与 `TvUi.dp(context, 数字)` **均为 0**
4. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过
5. 报告写入 `.agents/shared/<任务ID>-antigravity.md`

### U2

1. 历史页卡片进度条在播放中的剧集上**可见**
2. 构建/lint/测试通过
3. 报告同上

### U3

1. 独立核查 U1 是否真的修好（截图或 UI dump 证据）
2. 核查双模式扫描是否归零
3. 区分「已核实事实」与「推测」

---

## 四、验证纪律

- **不接受「构建通过」作为布局正确的证据**
- 必须提供**截图或 UI dump**，且能对应到明确的 APK 版本
- 模拟器 `emulator-5554` 可改分辨率，验证需覆盖 ≥2 档

---

## 五、状态

**尚未派发。** 等待用户确认。
