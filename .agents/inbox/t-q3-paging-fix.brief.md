# Q3 分页查询与选中状态修复

**任务 ID**: `t-q3-paging-fix`
**负责人**: antigravity
**设备**: **D1** `127.0.0.1:16384`
**依赖**: 无
**协调者**: dsh
**范围**: **仅 TV 端**分类页与排行榜

---

## 一、用户需求

> 优化分页查询的方案。现在的分页查询有问题，选中有问题查询后的选中状态有问题等等，去发现问题并修复

**即**：分页（Q1 刚实现的自动加载）引入了一系列**焦点/选中状态**问题。

---

## 二、协调者已定位的缺陷（实测 + 代码核实）

### 缺陷 1（严重）分页后整树重建，左栏滚动位置丢失

**现象**（D2 实测）：

| 时刻 | 题材列可见项 |
| --- | --- |
| 切换前 | 全部题材 / 爱情 / 年代 / 逆袭（**顶部**） |
| 滚动分页后 | 玄幻 / 奇幻 / 都市 / 青春（**中间**） |

**根因**：`loadCatalog` 分页成功后调 `renderCatalog()`（`MainActivity.kt:1091`），而它执行：

```kotlin
navigation.removeAllViews()   // 销毁整个视图树
```

**左栏题材列的 `ScrollView` 滚动位置无保存/恢复机制** → 重建后位置错乱。

**影响**：用户滚到底部加载后，左栏题材列跳到中间，需重新滚动找回位置。

### 缺陷 2（严重）`Top N` 徽标序号在分页后失效

**位置**：`SeriesAdapter.kt:116-118`

```kotlin
if (position < 10 && series.badge.contains("榜")) {
    holder.rankBadge.text = "Top ${position + 1}"
```

**问题**：`position` 是 RecyclerView 的**全局索引**。

- 第 1 页：`position` 0-19 → 前 10 项显示 Top 1-10 ✓
- **第 2 页**：`position` 20-39 → `position < 10` **恒为 false** → **全部不显示徽标**

**但榜单第 11-20 名应该显示 Top 11 - Top 20。**

**影响**：分页后榜单序号完全消失，用户看不到排名。

### 缺陷 3（中）`catalogScroll` 与 `index` 互斥导致焦点漂移

**位置**：`MainActivity.kt:1182-1192`

```kotlin
val index = PlaybackPolicy.restoredIndex(catalog.rows, catalog.focusedId)
if (catalogScroll != null) manager.onRestoreInstanceState(catalogScroll)
else grid.scrollToPosition(index)          // ← index 被短路
...
grid.post {
    ...
    filter?.requestFocus() ?: rankBtn?.requestFocus() ?: tool?.requestFocus()
        ?: (manager.findViewByPosition(index)?.requestFocus() ?: grid.requestFocus())
}
```

**问题**：

1. `triggerAutoPage` 在分页前设置 `catalogScroll`（`:1208`）→ 分页后**走 restore 分支**，`index` 被忽略
2. 焦点恢复用 `manager.findViewByPosition(index)`，若该位置**尚未被 restore 渲染**，返回 `null`
3. 最终回退到 `grid.requestFocus()` → **焦点丢失到整个网格**，用户看不到任何高亮

### 缺陷 4（中）`categoryFilterFocus` 用完即清空

**位置**：`MainActivity.kt:1185-1186`

```kotlin
val filter = catalogView.categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
categoryFilterFocus = null      // ← 立即清空
```

**问题**：分页触发的 `renderCatalog()` 也会走这段逻辑。此时 `categoryFilterFocus` 已被上一次清空 → `filter` 为 `null` → **焦点不回到筛选按钮**，而是跳到卡片或网格。

**期望**：切换筛选后焦点应**留在该筛选按钮**（便于连续切换）。

### 缺陷 5（低）分页时无「加载中」指示

`triggerAutoPage` 设置 `loadingCatalogMore = true` 后**无任何 UI 反馈**，用户不知正在加载。

### 缺陷 6（低）死代码残留（Q2 发现，未处理）

| 项 | 位置 |
| --- | --- |
| `addLoadMoreButton()` | `CatalogScreenView.kt:329`（无调用方） |
| `series_card_width` | 三档 dimens（无引用） |

---

## 三、修复要求

### 必须解决

| # | 要求 |
| --- | --- |
| 1 | **分页后左栏滚动位置保持**（或合理重置到顶部） |
| 2 | **`Top N` 徽标按真实排名显示**，不因分页失效 |
| 3 | **分页后焦点保持在原卡片上**，不跳走 |
| 4 | **切换筛选后焦点留在该筛选按钮** |
| 5 | 分页时**有加载指示**（可选，但推荐） |

### 关键约束（沿用 Q1）

**自动分页的 7 条约束必须继续满足**：

| # | 约束 |
| --- | --- |
| C1 | 仅当接近底部时触发 |
| C2 | 同一时刻只允许一个请求 |
| C3 | 已到末页不再请求 |
| C4 | 快速滚动不重复触发 |
| C5 | 切换筛选/榜单后重置状态 |
| C6 | 加载失败不无限重试 |
| C7 | 加载中不阻塞焦点 |

**修复焦点问题时，不要破坏上述约束。**

---

## 四、修复方向建议（供参考，可自行判断）

### 针对缺陷 1（左栏滚动位置）

**方案 A**：保存/恢复题材列 `ScrollView` 的 `scrollY`

```kotlin
// 在 renderCatalog 前保存
tagScrollY = tagScroll.scrollY
// 重建后恢复
tagScroll.post { tagScroll.scrollTo(0, tagScrollY) }
```

**方案 B**：分页时**不重建整树**，只通知 adapter 数据变化

```kotlin
grid.adapter?.notifyItemRangeInserted(oldSize, newSize - oldSize)
```

**方案 B 更优** —— 从根本上避免重建，同时解决缺陷 1 和 3。

> ⚠️ 若采用 B，需注意 `CatalogScreenView` 是**每次重建的**，adapter 也是新建的。
> 可能需重构为「复用视图 + 更新数据」。

### 针对缺陷 2（Top N）

**方案**：改用**数据中的真实排名**，而非 `position`

```kotlin
// 若 Series 有 rank 字段，用 series.rank
// 否则用 position（当页面只有第 1 页时正确）
```

**注意**：需确认 `Series` 是否携带排名信息（`Models.kt` 当前**没有 rank 字段**）。

**可选**：`if (position < 10)` 改为 `if (position < 10 && isFirstPage)`，
或对榜单页**始终显示** Top N（不限 10）。

### 针对缺陷 3/4（焦点）

**关键**：区分「分页触发的重建」与「筛选切换触发的重建」

```kotlin
private fun renderCatalog(preserveFocus: String? = null, fromPaging: Boolean = false)
```

- **分页**：焦点恢复到**原卡片**（用 `focusedId`）
- **筛选切换**：焦点恢复到**筛选按钮**

---

## 五、硬性约束

1. **只改这些文件**：
   - `ui/CatalogScreenView.kt`
   - `SeriesAdapter.kt`
   - `MainActivity.kt`（分页与焦点逻辑）
   - `res/values*/dimens.xml`（如需）
2. **不要改** `shared/content-core/hongguo.js`、`custom-server/`
3. **排行榜保持顶部平铺**（U6），**分类页保持左侧双列**（P1）
4. **不要回退 Q1 的成果**（卡片 `WRAP_CONTENT`、自动分页、7 条约束）
5. 保持 API 22 兼容
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

| # | 项 | 判定方式 |
| --- | --- | --- |
| 1 | 分页后左栏题材列位置合理 | dump 对比可见项 |
| 2 | 榜单 `Top N` 序号正确 | dump 检查 `Top \d+` 文本 |
| 3 | 分页后焦点在原卡片 | dump 的 `focused="true"` 节点 |
| 4 | 切换筛选后焦点在筛选按钮 | 同上 |
| 5 | 分页有加载指示 | 截图/dump |
| 6 | **7 条约束仍满足** | 请求计数（复用 Q2 的 TCP 探针方法） |
| 7 | 无死代码残留 | grep `addLoadMoreButton`、`series_card_width` |
| 8 | 构建通过 | `assembleDebug`、`lintDebug`、`testDebugUnitTest` |

**报告写入** `.agents/shared/t-q3-paging-fix-antigravity.md`

---

## 七、证据要求

### 环境

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384
$d = "127.0.0.1:16384"
```

**你的设备是 D1**（`127.0.0.1:16384`），**不要操作其他设备**。

### 必须提供

1. **每个缺陷的修复前后对比**（dump 或截图）
2. **焦点流转验证**：分页后 / 切换筛选后的 `focused="true"` 节点
3. **Top N 验证**：分页后仍显示正确序号
4. **7 条约束复测**：建议复用 Q2 的 TCP 探针方法（见 `.agents/shared/t-q2-verify-card-workbuddy.md` §2.2）

### 调试日志

若加临时日志验证，**验证后必须删除**（R13 已清理过调试日志，Q1 也清理过）。

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| 设备 | **只用 D1**，始终 `-s` 指定 |
| `input tap` 无效 | 用 DPAD |
| dump 中文乱码 | PowerShell 按 GBK 解码 UTF-8；用 Node 读文件可正确解析 |
| **静态截图不足** | 必须验证**状态推进** |
| 播放页 dump 受限 | 需先暂停或导航后 dump |
| `series_card_width` | **键名误导，实际是高度**（Q1 已改为 WRAP_CONTENT） |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-q3-paging-fix antigravity "结论及报告路径"
```
