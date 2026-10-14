# U6 榜单切换平铺化 — 任务规划

**协调者**: dsh
**日期**: 2026-10-14
**用户需求**: 「把切换榜单按钮里面的内容平铺到外面」
**状态**: ✅ 已完成并验收（见 `u6-verdict.md`）

---

## 一、原始现状

### 改动前：系统弹窗

```kotlin
// CatalogScreenView.kt:81-83
if (source == "rank") {
    tools.addView(TvUi.pillButton(context, "切换榜单") { onSwitchRank() })
}

// MainActivity.kt:990-994
onSwitchRank = {
    loadChoices("榜单", { repository().rankTypes() }) {
        selectedRank = it; catalogScroll = null; navigationJob = null; loadCatalog(false)
    }
}
```

`loadChoices` 最终调用 `choice(...)`，弹出**系统 `AlertDialog` 单选列表**。

### 要平铺的内容（4 个榜单）

**TV 本地引擎**（`content-api.js:74`）返回：

```javascript
{types: Object.entries(CATEGORY_CONFIG)
  .filter(([id,v])=>v.kind==='rank')
  .map(([id,v])=>({id, name:v.type_name}))}
```

即：`rank_hot` / `rank_human` / `rank_comic` / `rank_ai`

---

## 二、为什么这样做是对的（有既有先例）

本项目**已经有过一次「Dialog 改平铺」的成功先例**，且被用户认可：

> Antigravity 原计划：「详情页的分集切组（1-50, 51-100）由系统 Dialog 改为现代水平 Tab 标签」→ 已落地

现有两处同类实现，**风格必须保持一致**：

| 位置 | 实现 |
| --- | --- |
| `DetailScreenView.kt:80-109` | `HorizontalScrollView` + `TvUi.row` + 选中态 `pillBackground` |
| `EpisodeDrawerView.kt:57,96-98` | `groupTabsRow` + 动态重建 |

---

## 三、实际实现（执行方完成）

### 1. 平铺按钮行

`ui/CatalogScreenView.kt`：

```kotlin
29:  val rankTypes: List<Pair<String, String>> = emptyList(),
33:  val onRankSelected: (String) -> Unit = {},
45:  val rankButtons = mutableListOf<Button>()
87:  if (rankTypes.size > 1) {
88:      val rankScroll = HorizontalScrollView(context)
95:      rankTypes.forEach { (slug, name) -> ... }
108:     rankButtons += rankBtn
123:     rankButtons.firstOrNull { it.isSelected } ?: rankButtons.firstOrNull()
```

### 2. 异步加载与兜底

`MainActivity.kt`：

```kotlin
153: private var rankTypes = emptyList<Pair<String, String>>()
155: private val fallbackRankTypes = listOf(
       "rank_hot" to "红果热播榜",
       "rank_human" to "真人剧热播榜",
       "rank_comic" to "漫剧热播榜",
       "rank_ai" to "AI剧热播榜"
     )
956: rankTypes = runCatching { api.rankTypes() }.getOrDefault(fallbackRankTypes)
```

### 3. 新增尺寸键（三档）

| 档位 | `rank_tab_margin_end` | `rank_tab_pad_bottom` |
| --- | --- | --- |
| `values` | 6dp | 8dp |
| `values-sw600dp` | 8dp | 10dp |
| `values-w1280dp` | 10dp | 12dp |

---

## 四、验收结果

| 验收项 | 结果 |
| --- | --- |
| 4 个榜单平铺 | ✅ dump 坐标 `[36,83]` → `[671,155]` |
| 选中项高亮 | ✅ `selected=true focused=true` |
| 不溢出 | ✅ 671 < 1280 |
| 不再弹 Dialog | ✅ `onSwitchRank` 已移除 |
| 切换后列表变化 | ✅ 截图证实 |
| 构建/lint/测试 | ✅ 30 项 0 失败 |

---

## 五、越界改动（已追认）

执行方额外修改了 `custom-server/index.mjs`（不在授权范围），为 `OFFICIAL_RANK_TYPES` 补 `id` 字段。

**评估结论**：这修的是 **Web/Windows 端的既有 bug**（前端 `requiredId()` 要求 `id`，但后端一直没提供），对 TV 无作用（TV 走本地引擎，本来就返回 `id`）。

改动正确且低风险，**予以追认**，但流程上应先行申请。

---

## 六、遗留

| # | 项 | 状态 |
| --- | --- | --- |
| P1 | 证据文件冗余（16 张截图） | ✅ 已清理，保留 4 张 |
| P2 | TV 与 Web 的 slug 命名体系不同（`rank_hot` vs `hot-drama`） | 既有设计，非本次引入 |
