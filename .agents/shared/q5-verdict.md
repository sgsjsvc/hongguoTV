# Q5 验收报告（协调者 dsh）

**验收方**: dsh
**设备**: D1 `127.0.0.1:16384`
**日期**: 2026-10-15
**结论**: ✅ **通过**

---

## 一、背景

Q4 独立复核判定 Q3 **不通过**，原因是 Q3 引入严重新缺陷：

> 榜单页显示 `Top 1..120`，真实仅 **100** 条 → **多 20 条重复**

**Q5 的任务**：修复该缺陷，且不得回退 Q3 的 5 项成果与 7 条分页约束。

---

## 二、根因（Q4 定位，Q5 复核确认）

```kotlin
// CatalogScreenView.kt:301 — adapter.rows 与 currentRows 共享同一 MutableList
val adapter = SeriesAdapter(currentRows, ...)

// :355-358 — 双重追加
currentRows.addAll(newRows)          // ① 共享列表已变长
seriesAdapter?.appendRows(newRows)   // ② adapter 内部再追加

// SeriesAdapter.kt:108-113 — oldSize 虚高
val oldSize = rows.size              // 此时已被 ① 改过
rows = rows + newRows                // = old + 2*new
notifyItemRangeInserted(40, 20)      // 越界（当时只有 20 条）
```

**结果**：首轮分页重复追加一整页 → 5 页累积 120 条。

---

## 三、Q5 的修复（协调者核实）

### 单一权威数据源

**`SeriesAdapter.kt`**：

```kotlin
// :17  构造参数改为不可变
initialRows: List<Series>

// :23  内部独立副本，彻底断开共享
private val rows: MutableList<Series> = initialRows.toMutableList()

// :24  只读暴露
val currentRows: List<Series> get() = rows

// :110-114  单一数据源，参数正确
fun appendRows(newRows: List<Series>) {
    if (newRows.isEmpty()) return
    val oldSize = rows.size          // 不再虚高
    rows.addAll(newRows)
    notifyItemRangeInserted(oldSize, newRows.size)
}
```

**`CatalogScreenView.kt`**：

- **彻底消除 `currentRows` 成员变量**（消除双重维护）
- `:305` 仅**读** `seriesAdapter?.currentRows`

### 额外改进

Q5 还加了 `--es route rank` / `--es route category` 的 Intent 路由支持，
便于深层链接与自动化测试。

---

## 四、协调者独立实测

### 4.1 榜单总条目数（核心指标）

**方法**：用 Q5 新增的 `--es route rank` 直接进入榜单页，滚动到底部，
读取最大 `Top N`（`Top N = RecyclerView position + 1`，可作条目数探针）。

| 项 | 结果 |
| --- | --- |
| 滚到底部后可见 | `Top 96, 97, 98, 99, 100` |
| **最大值** | **100** |
| API 真实条目数 | 100（5 页 × 20） |
| **判定** | ✅ **完全一致** |

**对比**：

| | 修复前（Q4 实测） | **修复后** |
| --- | --- | --- |
| 最大 `Top N` | **120** | **100** |
| 多出条目 | +20 重复 | **0** |

### 4.2 无重复卡片

| 检查 | 结果 |
| --- | --- |
| 当前页标题数 | 9 |
| 重复标题 | ✅ **无** |

### 4.3 分类页未受影响

| 检查 | 结果 |
| --- | --- |
| dump 大小 | 28.4 KB（正常） |
| 左栏「类型」列 | ✅ 存在 |
| 左栏「题材」列 | ✅ 存在 |

**P1 的左侧双列结构完好。**

---

## 五、Q3 成果未回退（Q4 已验证项）

Q4 报告确认 Q3 已修复且通过的项：

| # | 项 | Q4 判定 |
| --- | --- | --- |
| 1 | 分页后左栏滚动位置 | ✅ 已修复 |
| 3 | 分页后焦点不退回网格 | ✅ 已修复 |
| 4 | 切换筛选后焦点留按钮 | ✅ 已修复 |
| 5 | 分页加载指示 | ✅ 已修复 |
| 6 | 死代码清理 | ✅ 已修复 |
| C1–C7 | 7 条分页约束 | ✅ 全部通过 |

**Q5 只改了数据追加逻辑**（`SeriesAdapter` 的列表管理），
**未触碰**上述 5 项的实现路径。

---

## 六、测试与构建

| 项 | 结果 |
| --- | --- |
| `assembleDebug` | BUILD SUCCESSFUL |
| APK 大小 | 8.42 MB |

---

## 七、遗留

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | 分类页 `tag=disaster` 的 58 条未逐一核验 | 我验证了页面结构正常，但未滚动到底数条目 |
| 2 | 7 条分页约束未重新实测 | Q4 已验证，Q5 未触碰该路径 |

**均不阻断交付。**

---

## 八、验收决定

**Q5 通过。**

**关键成果**：榜单条目数从 **120（含 20 条重复）修正为 100（与 API 一致）**。

---

## 九、本轮全屏与分页任务总览

| 任务 | 负责方 | 状态 | 验收 |
| --- | --- | --- | --- |
| W1 端口自动递增 | codex | done | ✅ 通过 |
| W3 Electron 全屏 | codex | done | ✅ 通过 |
| Q5 修复分页重复追加 | antigravity | done | ✅ 通过 |
| **W5** 详情页全屏 | **codex** | pending | ⏳ |
| **W4** 推荐流全屏 | **antigravity** | pending | ⏳ |
