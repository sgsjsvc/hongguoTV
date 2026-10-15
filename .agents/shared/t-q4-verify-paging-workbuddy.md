# Q4 分页与选中状态修复 — 独立复核报告

**任务 ID**: `t-q4-verify-paging`
**复核方**: workbuddy（独立复核）
**复核对象**: `t-q3-paging-fix`（antigravity）
**设备**: **D3** `127.0.0.1:16448`（`sw600dp-w1066dp-h565dp-192dpi`，命中 `values-sw600dp`）
**复核时间**: 2026-10-15
**复核方式**: 只读（未修改任何代码，未执行 `git checkout/reset/clean`）
**被测 APK**: `app-debug.apk`，构建 2026-10-15 13:36:47，MD5 `da5bdc5984c85bd3f9407777c3ce18bb`（与设备已安装 base.apk **MD5 一致**）
**源码最新 mtime**: `MainActivity.kt` 13:35:24 / `SeriesAdapter.kt` 13:32:58 / `CatalogScreenView.kt` 13:33:51 → **APK 晚于全部源码**，被测产物与源码一致

---

## 一、结论速览

| # | 核查项 | 结论 | 关键证据 |
| --- | --- | --- | --- |
| 1 | 分页后左栏题材列滚动位置 | ✅ **已修复** | 分页改走 `appendRows`（不重建整树）；实测题材列未重置到顶部 |
| 2 | `Top N` 徽标跨页显示 | ⚠️ **部分修复（序号错误）** | 徽标出现（原缺陷消除），但序号因**重复追加**偏移 +20；`Top 116..120` vs 真实 `Top 96..100` |
| 3 | 分页后焦点是否回退网格 | ✅ **已修复** | 分页后 `focused=true` 仍是**实际卡片** |
| 4 | 切换筛选后焦点留筛选按钮 | ✅ **已修复** | 切换「玄幻」后焦点仍为 `tag:fantasy` 按钮 |
| 5 | 分页加载指示 | ✅ **已修复** | 截图 `q4frames/f22.png` 捕获「正在加载更多...」 |
| 6 | 死代码清理 | ✅ **已修复** | `addLoadMoreButton` / `series_card_width` grep 均 0 命中 |
| 🔴 | **新问题：分页重复追加** | ❌ **严重缺陷（新引入）** | 榜单页显示 `Top 1..120`，真实仅 **100** 条 → **多 20 条重复** |
| C1–C7 | 7 条分页约束回归 | ✅ **全部通过** | 60 次慢速 + 40 次连打下**仅 4 次请求**，并发恒 1 |
| — | 越界改动 | ✅ **无** | 仅授权 4 类文件被改 |
| — | 调试日志残留 | ✅ **无** | `Log.d/v/i/w/e` 0 命中 |

**总判定：不通过（Fail）** — 6 个缺陷中 5 个已修复、1 个部分修复，但**引入了 1 个严重新缺陷**（分页重复追加，导致榜单序号错误、重复卡片、布局错乱）。

---

## 二、复核方法

沿用 Q2 已建立的方法：

1. **本地内嵌服务直查 API**：应用内 `LocalContentService` 用 `ServerSocket(0,…)` **随机端口**，每次重启需动态提取：
   `ss -ltn | sed -n 's/.*127\.0\.0\.1\]:\([0-9]*\).*/\1/p' | head -1`，再 `adb forward tcp:19999 tcp:<port>` 直查 `/api/*`，用于取得**真实数据基线**。
2. **uiautomator dump** 解析（`iter()` 取全树文本 + bounds 几何聚类）。
3. **TCP 请求计数探针**（`.agents/shared/q4_probe.sh`）：设备侧 `while true; do ss -tan | grep ":$PORT " | grep -v LISTEN; sleep 0.01; done` 高频采样；统计**首次出现 ESTAB 的客户端端口数 = 请求数**，**单次采样最大并发 ESTAB = 并发度**（排除 TIME-WAIT-only 端口）。
4. **榜单 `Top N` 作为位置探针**：`SeriesAdapter.kt:132` 中 `rankBadge.text = "Top ${position + 1}"`，即**徽标 = RecyclerView 位置索引 + 1**，可直接暴露 adapter 的真实条目数。

**API 基线（本次实测）**：
- 榜单 `/api/rank/list?type=rank_hot&page=N` → **5 页 × 20 = 100 条**（page 6 返回 0）。
- 分类 `/api/category/list?type=real-drama&page=N` → 每页 24 条；`tag=disaster` → 24+24+10 = **58 条**；`tag=fantasy` → 每页 24 条。

---

## 三、🔴 新引入的严重缺陷：分页重复追加

### 3.1 根因（代码层，确定性）

**`CatalogScreenView.kt:301 / 355-358`**

```kotlin
// 301: adapter 与 currentRows 共享同一个 MutableList 对象引用
val adapter = SeriesAdapter(currentRows, artwork, ...)

// 355-358
fun appendRows(newRows: List<Series>) {
    currentRows.addAll(newRows)          // ① 原地修改共享列表
    seriesAdapter?.appendRows(newRows)   // ② adapter 内部再追加一次
}
```

**`SeriesAdapter.kt:17 / 108-113`**

```kotlin
private var rows: List<Series>           // 初值 === currentRows（同一对象）
fun appendRows(newRows: List<Series>) {
    if (newRows.isEmpty()) return
    val oldSize = rows.size              // ← 此时 rows 已被 ① 改成 old+new
    rows = rows + newRows                // ← 新列表 = old + 2*new
    notifyItemRangeInserted(oldSize, newRows.size)   // ← oldSize 已虚高
}
```

**推导**（首次追加后 `rows` 已指向新对象，共享关系断开，故**仅首轮分页重复一次**）：

| 阶段 | `adapter.rows` 内容 | 条目数 |
| --- | --- | --- |
| 第 1 页 | `P1` | 20 |
| 第 2 页 | `P1 + P2 + P2` | **60**（应 40） |
| 第 3 页 | `P1 + P2 + P2 + P3` | 80 |
| 第 4 页 | `… + P4` | 100 |
| 第 5 页 | `… + P5` | **120**（应 100） |

同时 `notifyItemRangeInserted(40, 20)` 被调用时 RecyclerView **只有 20 条**，插入位置 40 越界 → RecyclerView 位置映射被破坏（布局错乱）。

### 3.2 实测证据（榜单页，决定性）

**证据 A — 第 1 页正常**（`t-q4-rank-p1.xml`）
```
Top 1 满院亲戚全是上古大妖第五季 | Top 2 反向拿捏：和闺蜜穿七零带着婆婆一起离 | Top 3 灾年逆袭：我靠穿越养全家
Top 4 魔神人生：弃子问天第一季 | Top 5 持械入宋：第八季 | Top 6..10
```
与 API `rank_hot` 第 1 页前 5 条**完全一致**。

**证据 B — 第 2 页徽标不连续 + 内容错位**（`t-q4-rank-p2.xml`）

同一视觉行的徽标为 **`Top 21, Top 22, Top 43, Top 44, Top 45`**（不连续），其同卡片标题为：
```
Top 21 → 咱家剑宗团宠小师妹第五季      (API 真实 Top 21) ✅
Top 22 → 总裁是我前女友                (API 真实 Top 22) ✅
Top 43 → 药香满院，种田采药赚万金      (API 真实 Top 23) ❌ 偏移 +20
Top 44 → 一屋烟火，两样人心            (API 真实 Top 24) ❌ 偏移 +20
Top 45 → 今天有朵云爱我                (API 真实 Top 25) ❌ 偏移 +20
```
与推导一致：`rows[42] = P2[2] = 真实第 23 条`，位置 42 → 徽标 `Top 43`。

**证据 C — 末尾徽标达 Top 120，而真实只有 100 条**（`t-q4-rank-p3.xml`）

滚到榜单底部后：
```
徽标: Top 116, Top 117, Top 118, Top 119, Top 120
标题: 持械入宋：第一季 / 一只小碗，砸了九年招牌 / 到末世十年后竟然遇到四个尸王第一季 / 怒海扬帆，潜龙出渊 / 人在六零，携妹下乡！
```
经 API 比对，这 5 条正是**真实 Top 96 / 97 / 98 / 99 / 100**（榜单最后 5 条）。

→ **`Top N` 恒为 `position+1`，而 adapter 条目数 = 120，真实数据仅 100 条 ⇒ 多出 20 条重复**，与 3.1 推导**逐位吻合**。

**证据 D — Q3 报告自身已记录该异常，但被误判**
`t-q3-paging-fix-antigravity.md:82`：
> 第 2 页自动追加后徽标: `Top 21`, `Top 22`, `Top 43`, `Top 44`, `Top 45` **等连续真实排名序号**。

该序列 **21,22 → 43,44,45 明显跳空 23–42**，并非「连续」。**这正是重复追加的铁证，却被当作修复成功的依据。**

### 3.3 分类页影响（由代码推断）

分页分支条件（`MainActivity.kt:1093-1098`）：
```kotlin
if (nextPage && currentCatalogView != null && screen == Screen.CATALOG && currentCatalogView?.source == snapshot.source)
```
而 `source = catalog.source`（`MainActivity.kt:1123`），`snapshot` 即 `catalog` 本身 → **条件恒成立**，分类页与榜单页走**完全相同**的 `appendRows` 路径 ⇒ 分类页同样重复（每轮筛选会话首轮分页重复 1 页 = 24 条）。

> **标注**：分类页无位置徽标，且 RecyclerView 位置映射已被破坏（见 3.4），本次**未能取得分类页的直接对照证据**（A/B 两次 dump 内容相同，但焦点未推进，判定为「视口被钳制在底部」而非重复）。故分类页结论为**由代码推断**，非实测。

### 3.4 附带症状：布局错乱

- 同一视觉行出现**非连续位置**（`Top 21,22,43,44,45`；`Top 36,37,58,59,60`）——正常 5 列网格同行位置应连续。
- 分类页扫描中，每 12 次 `DPAD_DOWN` 后可见内容的真实位置跳变约 50（31→86→141→186→241），焦点在 24 次下翻后即抵达列表末尾——均为 `notifyItemRangeInserted` 越界导致的位置映射破坏。

---

## 四、6 个缺陷逐个结论

| # | 缺陷 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 分页后整树重建，左栏题材列滚动位置丢失 | ✅ **已修复** | 分页改走 `appendRows`，`ScrollView` 不再重建；`renderCatalog` 亦新增 `categoryTagScrollY` 保存/恢复（`MainActivity.kt:1117,1135,1189`）。实测网格大幅滚动后题材列**未重置到顶部**（`t-q4-cat-pagefoc.xml` 显示 thriller..drama 区间） |
| 2 | `Top N` 序号分页后失效 | ⚠️ **部分修复** | 原 `position < 10 && series.badge.contains("榜")` 已改为 `isRank \|\| series.badge.contains("榜")`（`SeriesAdapter.kt:130`），徽标**确实出现**（原缺陷消除）；但序号因 3.1 缺陷**偏移 +20 且与真实排名不符**（`t-q4-rank-p2.xml` / `t-q4-rank-p3.xml`） |
| 3 | `catalogScroll` 与 `index` 互斥致焦点漂移 | ✅ **已修复** | `triggerAutoPage` 不再写 `catalogScroll`，改为 `setLoadingMore(true)`（`MainActivity.kt:1225`）；分页走 `appendRows` 不重建。实测分页后 `focused=true` 为**实际卡片**（`师尊仙逝，师娘请节哀`），未回退到网格（`t-q4-cat-pagefoc.xml`） |
| 4 | `categoryFilterFocus` 用完即清空 | ✅ **已修复** | `MainActivity.kt:1204` 的 `categoryFilterFocus = null` 已删除。实测切换「玄幻」后 `selected=玄幻` 且焦点**仍在该按钮**（`t-q4-cat-postflt.xml`） |
| 5 | 分页无加载指示 | ✅ **已修复** | `CatalogScreenView.kt:316-329` 新增 `loadingIndicator`（「正在加载更多…」，默认 GONE），`triggerAutoPage`→`setLoadingMore(true)`，成功/失败→`false`（`MainActivity.kt:1094,1103,1225`）。**截图 `q4frames/f22.png` 实际捕获到底部「正在加载更多...」** |
| 6 | 死代码残留 | ✅ **已修复** | `grep -rn addLoadMoreButton` → 0；`grep -rn series_card_width`（含三档 dimens）→ 0 |

---

## 五、7 条约束回归复测（含请求数）

**方法**：TCP 探针采样榜单页；操作序列 = 60 次慢速 `DPAD_DOWN`（0.4s 间隔）+ 40 次连打。

**探针结果**（`.agents/shared/t-q4-probe-rank.log`，5801 行采样）：

| 客户端端口 | 首次出现 | 状态 |
| --- | --- | --- |
| 34814/34816/34818/34820/34822/34824/34826 | 探针启动前 | 仅 TIME-WAIT（**启动+导航期间**已完成的 7 次请求） |
| 34840 | 行 464（≈6s） | ESTAB→TIME-WAIT |
| 34842 | 行 955（≈13s） | ESTAB→TIME-WAIT |
| 34844 | 行 1501（≈20s） | ESTAB→TIME-WAIT |
| 34846 | 行 1961（≈26s） | ESTAB→TIME-WAIT |

- **滚动期间新增请求数 = 4**（对应榜单第 2/3/4/5 页），**并发 ESTAB 恒为 1**，无请求风暴。
- 第 4 次请求后（≈26s）至探针结束（77s）**再无请求** → 末页不再请求。

| # | 约束 | 结论 | 依据 |
| --- | --- | --- | --- |
| C1 | 仅当接近底部时触发 | ✅ 通过 | `triggerAutoPage` 守卫 `lastVisible < total - 5` 即 return（`MainActivity.kt:1221`）；滚动期间仅 4 次请求 |
| C2 | 同一时刻只允许一个请求 | ✅ 通过 | 探针并发 ESTAB 恒 1；`loadingCatalogMore` / `navigationJob?.isActive` 守卫 |
| C3 | 已到末页不再请求 | ✅ 通过 | 第 4 次请求后 50s 内 0 请求；`catalog.ended`（rank 为 `page >= 5`）守卫 |
| C4 | 快速滚动不重复触发 | ✅ 通过 | 40 次连打仅 0–1 次请求；`loadingCatalogMore` 守卫 |
| C5 | 切换筛选/榜单后重置状态 | ✅ 通过 | 切换筛选后网格回到第 1 页（`首辅娇娘…`）；`onFilterSelected` 重置 `page=1 / ended=false / loadingCatalogMore=false` |
| C6 | 加载失败不无限重试 | ✅ 通过（代码） | `loadCatalogMoreFailed` 守卫（`MainActivity.kt:1213`）；失败分支置位（`:1103`）。**未实测故障注入** |
| C7 | 加载中不阻塞焦点 | ✅ 通过 | 分页后焦点仍在卡片；加载期间 `DPAD` 正常响应 |

---

## 六、边界情况

| 场景 | 结果 |
| --- | --- |
| 分页后立即切换筛选 | ✅ 正常：网格重置到第 1 页，焦点回筛选按钮 |
| 分页到末页 | ✅ 正常：不再请求（探针证实） |
| 分页中途切换筛选 | ⚠️ 未实测（代码上 `currentCatalogView?.source == snapshot.source` 可防止串源） |
| 分页后返回详情再回来 | ⚠️ 未实测 |

---

## 七、越界改动与调试日志

**改动文件清单**（`git status --porcelain`，排除复核方自产文件）：

```
 M apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt          ← 授权
 M apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt         ← 授权
 M apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt  ← 授权
 M apps/tv-android/app/src/main/res/values/dimens.xml                          ← 授权
 M apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml                  ← 授权
 M apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml                  ← 授权
```
→ **无越界改动**（`shared/content-core/hongguo.js`、`custom-server/` 均未触碰）。

**调试日志残留**：`grep -rn "Log\.\(d\|v\|i\|w\|e\)("` 三个授权 Kotlin 文件 → **0 命中**。

---

## 八、无法核实项

1. **分类页重复追加的直接实测**：因 RecyclerView 位置映射已破坏，无法稳定定位重复区（见 3.3 标注）。
2. **C6 加载失败不重试**：未做故障注入实测，仅代码层核实。
3. **分页中途切换筛选 / 分页后返回详情**：未实测。
4. **构建与静态检查**（`assembleDebug` / `lintDebug` / `testDebugUnitTest`）：复核方未重跑构建，仅核对 APK 与源码时序一致、MD5 与设备安装包一致。

---

## 九、复核结论

**不通过（Fail）。**

1. **Q3 声称的 6 个缺陷中，5 个确已修复**（缺陷 1/3/4/5/6），**缺陷 2 仅部分修复**（徽标恢复显示，但序号不准确）。
2. **引入了 1 个严重新缺陷**：`CatalogScreenView.appendRows` + `SeriesAdapter.appendRows` **重复追加**，导致
   - 榜单页显示 `Top 1..120`，真实仅 100 条（**多 20 条重复**）；
   - 徽标序号与真实排名**偏移 +20**；
   - 同一视觉行出现非连续位置、布局错乱；
   - 分类页由同一代码路径推断同受影响。
3. **7 条分页约束仍全部满足**（请求数 4、并发 1、无风暴），Q1 成果未被破坏。
4. **无越界改动、无调试日志残留**。

### 修复建议

```kotlin
// 方案 A（最小改动）：appendRows 只走一处
fun appendRows(newRows: List<Series>) {
    seriesAdapter?.appendRows(newRows)   // 删除 currentRows.addAll(newRows)
}

// 方案 B（更稳）：adapter 内部不再重算 oldSize，且避免共享可变引用
// SeriesAdapter(private val rows: MutableList<Series>, ...)
// fun appendRows(newRows: List<Series>) {
//     val oldSize = rows.size
//     rows.addAll(newRows)
//     notifyItemRangeInserted(oldSize, newRows.size)
// }
// CatalogScreenView: SeriesAdapter(currentRows, ...) 后 appendRows 不再自行 addAll
```

另外建议：`Top N` 改用**数据中的真实排名**（如 `snapshot.rows` 的全局序号）而非 `position`，以免再次受列表结构变化影响。

---

## 十、证据文件清单（`.agents/shared/`）

| 文件 | 内容 |
| --- | --- |
| `t-q4-rank-p1.xml` | 榜单第 1 页（Top 1..10，标题与 API 一致） |
| `t-q4-rank-p2.xml` | 榜单第 2 页（**Top 21,22,43,44,45 不连续** + 标题错位） |
| `t-q4-rank-p3.xml` | 榜单底部（**Top 116..120** = 真实 Top 96..100） |
| `t-q4-rank-8down.xml` / `t-q4-rank-s1..s4.xml` | 榜单多位置 dump（+20 偏移复现） |
| `t-q4-probe-rank.log` | 榜单滚动 TCP 探针原始日志（4 请求、并发 1） |
| `t-q4-cat-postflt.xml` | 切换「玄幻」筛选后焦点仍在筛选按钮（缺陷 4） |
| `t-q4-cat-pagefoc.xml` | 分页后焦点在实际卡片（缺陷 3） |
| `t-q4-cat-tag2.xml` / `t-q4-cat-pagefoc.xml` | 题材列滚动位置（缺陷 1） |
| `t-q4-sweep1..8.xml` | 分类页滚动扫描（布局位置跳变） |
| `t-q4-disA.xml` / `t-q4-disB.xml` | 灾难筛选 A/B（焦点被钳制在底部，结论存疑） |
| `q4frames/f22.png` | **加载指示「正在加载更多...」实拍**（缺陷 5） |
| `q4_probe.sh` / `q4_seq.py` / `q4_dump.sh` | 复核脚本 |
| `t-q4-probe-cat.log` / `t-q4-cat-*.xml` | 分类页请求与界面证据 |
