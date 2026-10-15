# Q1 分类/排行榜卡片空白修复 + 自动分页

**任务 ID**: `t-q1-card-autopage`
**负责人**: antigravity
**设备**: **D1** `127.0.0.1:16384`
**依赖**: 无
**协调者**: dsh
**范围**: **仅 TV 端**

---

## 一、用户需求（三项）

> 分类和排行榜的这个卡片下面有很多空白，把空白删除掉。
> 分页查询改为自动分页查询，不要加载更多按钮。
> 自动分页查询一定要约束好，只有当前数据展示我才进行避免频繁查询。

**拆解**：

| # | 需求 | 要点 |
| --- | --- | --- |
| 1 | 删除卡片底部空白 | 分类页 + 排行榜 |
| 2 | 分页改自动，去掉「加载更多」按钮 | 滚到底部自动加载下一页 |
| 3 | **约束好**，避免频繁查询 | 只在「当前数据已展示完」时才触发 |

---

## 二、需求 1：卡片底部空白

### 实测数据（协调者测量）

来源：`.agents/shared/t-p1-category.xml`（1920×1080）

```
卡片: x=282-589  y=111-683   尺寸 307 x 572 px
  ├─ 图片  y=123-467  高 344px
  ├─ 标题  y=467-551  高  84px
  └─ 集数  y=551-591  高  40px
  ─────────────────────────────
  底部空白: 92px（占卡片高度 16.1%）
```

### 根因

`SeriesAdapter.kt:42-47`：

```kotlin
layoutParams = RecyclerView.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    TvUi.dimen(context, R.dimen.series_card_width)   // ← 固定高度（键名误导）
).apply { setMargins(cardMargin, cardMargin, cardMargin, cardMargin) }
```

**卡片高度写死**，但内部内容高度不足：

| 档位 | 卡片高 | 图片高 | 内容合计 | 空白 |
| --- | --- | --- | --- | --- |
| `values` | 275dp | 165dp | ≈ 231dp | ≈ 44dp |
| `values-sw600dp` | 330dp | 198dp | ≈ 277dp | **≈ 53dp** |
| `values-w1280dp` | 385dp | 230dp | ≈ 323dp | ≈ 62dp |

**实测验证**：330dp − 277dp = 53dp ≈ 92px（density 1.73）✓

### 修复方向（任选，说明理由）

**方案 A：改为 `WRAP_CONTENT`（推荐）**

```kotlin
layoutParams = RecyclerView.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    ViewGroup.LayoutParams.WRAP_CONTENT
)
```

**优点**：内容自适应，彻底消除空白
**注意**：需确认 `GridLayoutManager` 下同行卡片高度一致（标题行数固定 2 行，应可对齐）

**方案 B：调整图片高度填满卡片**

增大 `series_card_image_height` 使其撑满，但会改变图片宽高比（可能变形）

**方案 C：删除多余的固定高度键，改为内容驱动**

**建议 A** —— 最直接且无副作用。

### 附带清理（可选）

`series_card_width` 键名实际表示**高度**（D1 技术债）。
若采用方案 A，该键可能不再需要；若保留，**建议重命名为 `series_card_height`**。

---

## 三、需求 2：分页改自动

### 现状

`MainActivity.kt:1156-1161`：

```kotlin
if (!catalog.ended && catalog.rows.isNotEmpty() && manager != null) {
    catalogView.addLoadMoreButton("加载更多 · 第 ${catalog.page} 页") {
        catalogScroll = manager.onSaveInstanceState()
        loadCatalog(true)
    }
}
```

用户需**手动点击**按钮才加载下一页。

### 目标

**滚动到底部自动加载**，去掉按钮。

### 实现建议

在 `RecyclerView` 上添加滚动监听：

```kotlin
grid.addOnScrollListener(object : RecyclerView.OnScrollListener() {
    override fun onScrolled(rv: RecyclerView, dx: Int, dy: Int) {
        // 判断是否接近底部
    }
})
```

---

## 四、需求 3：自动分页的约束（**最重要**）

用户明确要求：

> 自动分页查询一定要约束好，只有当前数据展示我才进行避免频繁查询

### 必须满足的约束

| # | 约束 | 说明 |
| --- | --- | --- |
| **C1** | **仅当已展示数据接近底部时触发** | 例如：最后可见项 ≥ 总数 − 5 |
| **C2** | **同一时刻只允许一个请求** | 用 `navigationJob?.isActive` 或独立标志 |
| **C3** | **已到末页不再请求** | 检查 `catalog.ended` |
| **C4** | **用户快速滚动不重复触发** | 请求中不重复发起（C2 覆盖） |
| **C5** | **切换筛选/榜单后重置状态** | 换榜单后应能重新触发 |
| **C6** | **加载失败不无限重试** | 失败后停止，或需用户操作 |
| **C7** | **加载中不阻塞焦点** | 用户可继续浏览已加载内容 |

### 关键：避免「频繁查询」

**反例**（必须避免）：

```
用户滚到底 → 触发请求 → 请求中又滚了一下 → 又触发 → 又触发...
```

**正确做法**：

```kotlin
private var loadingMore = false   // 或复用 navigationJob 状态

onScrolled:
    if (loadingMore || catalog.ended) return
    if (lastVisible >= itemCount - THRESHOLD) {
        loadingMore = true
        loadCatalog(true)   // 完成后置回 false
    }
```

**注意**：现有 `loadCatalog` 已有 `navigationJob?.isActive` 检查（第 1045 行），
**但需确认该检查足以防止重复触发**，或在滚动回调中额外加标志。

### 阈值建议

| 参数 | 建议值 | 理由 |
| --- | --- | --- |
| 触发阈值 | 剩余 **5 项**（1 行）时 | 提前加载，避免用户看到空白 |
| 最小加载间隔 | 无（靠 C2 保证） | 请求完成才能再次触发 |

---

## 五、硬性约束

1. **只改这些文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`（仅分页触发逻辑）
   - `apps/tv-android/app/src/main/res/values*/dimens.xml`（如需调整）
2. **不要改** `shared/content-core/hongguo.js`（三端共享，本轮不涉及）
3. **不要改** `custom-server/`（codex 刚修复榜单，勿动）
4. **排行榜保持顶部平铺**（U6 方案），只改卡片空白与分页
5. **分类页左栏保持**（P1 方案），只改卡片空白与分页
6. 不要回退任何已完成改动
7. 保持 API 22 兼容
8. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

### 需求 1

1. 分类页与排行榜的卡片**底部无多余空白**
2. 卡片内图片、标题、集数**紧凑排列**
3. 同一行卡片**高度一致**（不参差不齐）
4. 三档分辨率（720p/1080p/4K）下均正常

### 需求 2

5. **无「加载更多」按钮**
6. 滚动到底部**自动加载**下一页

### 需求 3

7. **不频繁查询**：连续快速滚动到底部，**不产生重复请求**
8. **已到末页**不再请求
9. **切换榜单/筛选后**能重新触发
10. **加载失败**不无限重试

### 通用

11. `assembleDebug`、`lintDebug`、`testDebugUnitTest` 通过
12. 报告写入 `.agents/shared/t-q1-card-autopage-antigravity.md`

---

## 七、证据要求（三件套）

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

1. **卡片空白修复前后对比截图**（分类页 + 排行榜）
2. **UI dump** 验证卡片高度变化（对比 `y2-y1` 与内部子节点底部）
3. **自动分页验证**：
   - 滚动到底部自动加载的截图/dump
   - **证明不频繁查询**：日志或计数（如 `loadCatalog` 调用次数）
4. **末页不再请求**的证据

### 验证「不频繁查询」的方法

建议在 `loadCatalog` 加**临时日志**，统计调用次数：

```kotlin
android.util.Log.d("CatalogPage", "loadCatalog page=$page nextPage=$nextPage")
```

然后：
1. 清 logcat
2. 快速连续滚动到底部多次
3. 统计 `loadCatalog` 的调用次数

**预期**：每次数据加载完成后才可能有下一次，**不应出现密集的连续调用**。

> ⚠️ **验证完成后删除临时日志**（R13 已清理过调试日志，勿重蹈覆辙）。

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| 设备 | **只用 D1**（`127.0.0.1:16384`），始终用 `-s` 指定 |
| `input tap` 无效 | 播放页吞掉触摸，用 DPAD |
| dump 大小 | 4430=播放页，15700=chrome，20800=分类页 |
| **静态截图不足以证明** | 需验证**状态推进**（如页码变化） |
| `series_card_width` | **键名误导，实际是高度** |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-q1-card-autopage antigravity "结论及报告路径"
```
