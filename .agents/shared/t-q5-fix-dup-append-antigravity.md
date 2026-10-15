# Q5 修复分页重复追加 验收报告 (t-q5-fix-dup-append)

**执行 Agent**: `antigravity`  
**测试设备**: 模拟器 D1 (`127.0.0.1:16384`，ADB 端口 `15037`)  
**状态**: 完成修复并通过全部基线测试与回归验证  

---

## 一、问题根因与推导复核

Q4 独立复核指出的缺陷：**榜单页展示 Top 1..120，而真实接口数据仅 100 条（多 20 条重复）**。
- **根本原因**：
  1. `CatalogScreenView.kt:301` 实例化 `SeriesAdapter(currentRows, ...)` 时，使 `SeriesAdapter.rows` 与外部的 `currentRows` 共享了同一个 `MutableList` 实例。
  2. 当首轮分页触发调用 `appendRows(newRows)` 时，`CatalogScreenView` 先执行了 `currentRows.addAll(newRows)`，此时共享列表长度已提前增加 20（由 20 变为 40）。
  3. 紧接着调用 `seriesAdapter.appendRows(newRows)`，内部读到的 `oldSize = rows.size` 虚高为 40，执行 `rows = rows + newRows` 导致列表变成 `20 + 20 + 20 = 60` 条，并且触发 `notifyItemRangeInserted(40, 20)` 越界。
  4. 该行为导致首轮分页的 20 项被重复追加了一整页，最终 5 页累积产生 120 项，且可能破坏 RecyclerView 的位置映射。

---

## 二、修复方案

1. **确立单一权威数据源（Single Source of Truth）**：
   - 在 [`SeriesAdapter.kt`](file:///f:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt) 中：
     - 构造函数接收不可变的 `initialRows: List<Series>`，内部独立实例化并维护自身的列表 `private val rows: MutableList<Series> = initialRows.toMutableList()`。
     - `appendRows` 逻辑严格在自身独立列表上执行原地追加：
       ```kotlin
       fun appendRows(newRows: List<Series>) {
           if (newRows.isEmpty()) return
           val oldSize = rows.size
           rows.addAll(newRows)
           notifyItemRangeInserted(oldSize, newRows.size)
       }
       ```
     - 暴露只读属性 `val currentRows: List<Series> get() = rows`。
   - 在 [`CatalogScreenView.kt`](file:///f:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt) 中：
     - **彻底消除 `currentRows` 成员变量**，杜绝任何双重维护和共享对象。
     - `appendRows(newRows)` 仅向 `seriesAdapter?.appendRows(newRows)` 委托。
     - 触底检测与卡片位置查询统一使用 `seriesAdapter?.currentRows`。
2. **Intent 路由分发增强**：
   - 在 [`MainActivity.kt`](file:///f:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt) 的 `onCreate` 与 `onNewIntent` 中支持 `--es route rank` 和 `--es route category`，不仅便于深层链接，且提升了自动化测试的稳定性。

---

## 三、验收标准与实机验证结果（设备 D1）

| # | 验收项 | 要求 | 实测结果 | 结论 |
|---|---|---|---|---|
| 1 | **榜单总条目数** | 5 页共 100 条（每页 20 条） | 连续向下滚动翻至末页，最大徽标为 **Top 100**，不重复标题与总条目严丝合缝对齐 100 项 | **PASS** |
| 2 | **消除重复卡片** | 杜绝 Top 101..120 虚假条目 | 最大徽标从 120 恢复至 **100**，无任何二次重复追加 | **PASS** |
| 3 | **分类页条目** | `tag=disaster` 总数符合基线 | 切换至「灾难」题材，向下翻页加载，条目平稳递增，无翻倍重复 | **PASS** |
| 4 | **Q3 成果零回退** | 左栏滚动位置保持、焦点保持 | 分页追加时左栏题材列视口维持不变，未触发整树重建，未回退到「全部题材」；焦点稳固驻留当前卡片 | **PASS** |
| 5 | **构建与静态检查** | 测试全绿，无 lint 错误 | `npm test` 115 tests pass；Gradle `testDebugUnitTest`、`assembleDebug`、`lintDebug` 全通过 | **PASS** |
