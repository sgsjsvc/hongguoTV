# 性能基线补充：列表渲染与滚动流畅度

**测量方**: dsh
**日期**: 2026-10-16
**方法**: 代码路径审查（设备离线，无法实测 TV 渲染）

---

## 一、背景

主基线（`perf-baseline.md`）覆盖了**播放链路**（切集/切剧/取流）。
本文件补充**列表渲染与滚动流畅度** —— 用户提到的「流畅度」的另一半。

**设备状态**：MuMu 模拟器已关闭，真机 `192.168.1.120:5555` 显示 `offline`。
本部分为**静态审查**，执行方需在设备可用时实测验证。

---

## 二、TV 端发现的问题

### 🔴 问题 A：`SeriesAdapter` 无 `onViewRecycled`

**位置**：`apps/tv-android/.../SeriesAdapter.kt`

**现状**：只有 `onBindViewHolder`，**没有 `onViewRecycled`**。

**影响**：

- RecyclerView 复用卡片时，**旧图片残留在 ImageView 上**
- 快速滚动时会出现「**图片错位**」（显示上一部剧的封面）

**对比**：Web 端用 `loading="lazy"` 由浏览器处理，TV 端需手动管理。

### 🔴 问题 B：`ArtworkLoader.load()` 每次都清空图片

**位置**：`ArtworkLoader.kt:21`

```kotlin
fun load(url: String, target: ImageView) {
    target.tag = url; target.setImageDrawable(null)   // ← 无条件清空
    if (url.isBlank()) return
    cache.get(url)?.let { target.setImageBitmap(it); return }
    ...
}
```

**影响**：**每次 bind 都先清空再异步加载** → 滚动时**明显闪烁**。

**即使缓存命中**，也是「清空 → 立即设置」两步，可能产生一帧空白。

**改进方向**：

- 若目标 ImageView 的 `tag` 已是同一个 url，**直接返回**（避免重复清空）
- 或：缓存命中时**不清空**，直接设置

### 🟡 问题 C：`GradientDrawable` 每次 bind 都新建

**位置**：`SeriesAdapter.kt:141-144`

```kotlin
val cornerRadiusPx = TvUi.dimen(holder.itemView.context, R.dimen.series_rank_badge_radius).toFloat()
holder.rankBadge.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, bgGradient).apply {
    cornerRadius = cornerRadiusPx
}
```

**影响**：榜单页滚动时**每次 bind 都创建新对象**（含 `TvUi.dimen` 查询）。

**改进方向**：

- 在 `Holder` 中缓存 4 种（金/银/铜/普通）`GradientDrawable`，按位置复用
- 或在 `onCreateViewHolder` 时预建

### 🟡 问题 D：无图片请求并发限制

**位置**：`ArtworkLoader.kt:16`

```kotlin
private val client = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
```

**影响**：OkHttp 默认 `Dispatcher` 允许 64 并发 —— 快速滚动会**同时发起大量请求**。

**改进方向**：

- 限制 `dispatcher.maxRequestsPerHost`
- 或对滚动中的请求做取消（RecyclerView 快速滚动时）

---

## 三、Web 端状况（相对较好）

| 项 | 状态 |
| --- | --- |
| 图片懒加载 | ✅ 已用 `loading="lazy"` |
| 列表虚拟化 | ❌ 无（`react-window` 等） |
| 长列表规模 | 分类/榜单最多一页 24 条，**规模可控** |

**判定**：Web 端列表规模有限（分页 24 条），**无虚拟化的影响不大**。
优先级低于播放链路问题。

---

## 四、优先级与派发建议

| # | 问题 | 影响 | 优先级 | 建议负责方 |
| --- | --- | --- | --- | --- |
| A | `onViewRecycled` 缺失 | 图片错位 | **高** | workbuddy（P3 同文件，可合并） |
| B | `load()` 无条件清空 | 滚动闪烁 | **高** | 同上 |
| C | `GradientDrawable` 重建 | 榜单滚动开销 | 中 | 同上 |
| D | 无并发限制 | 快速滚动请求风暴 | 中 | 同上 |

**建议**：A/B/C/D 都在 `SeriesAdapter.kt` + `ArtworkLoader.kt`，
**与 P3（`MainActivity.kt`）文件不冲突**，可作为**独立任务 P4** 派发。

**但考虑 P3 已给 workbuddy**，若 P4 也给它会造成串行。
**建议 P4 给 antigravity**（它做 P2 Web 端，与 TV 不冲突）。

---

## 五、验收方式

**设备可用时必须实测**：

| 项 | 方法 |
| --- | --- |
| 图片错位 | 快速滚动，dump/截图确认无错位 |
| 闪烁 | 录制或连续截图对比 |
| 滚动流畅度 | `dumpsys gfxinfo` 或 `adb shell dumpsys SurfaceFlinger --latency` |
| 内存 | `dumpsys meminfo` 确认无泄漏 |

**设备不可用时**：至少提供代码级证据（改动前后对比）。

---

## 六、注意事项

1. **`onViewRecycled` 中应清理 `tag`**，否则复用时会误判
2. **缓存命中时不清空**需确认不会显示错误图片（依赖 `tag` 校验）
3. **`GradientDrawable` 复用需注意 `cornerRadius` 是否随尺寸变化**（不同屏幕档位）
4. 改动 `SeriesAdapter` 会影响分类页、榜单页、搜索结果 —— **需全场景回归**
