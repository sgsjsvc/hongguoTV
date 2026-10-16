# P4 TV 端列表渲染与滚动流畅度

**任务 ID**: `t-p4-tv-render`
**负责人**: **codex**
**依赖**: 无（与 P3 文件不冲突）
**协调者**: dsh
**范围**: TV 端列表渲染

---

## ⚠️ 重要：任务定位已修正（2026-10-16）

**设备已恢复，协调者实测后发现原假设部分不成立。**

### 实测结论

**三台设备渲染基线全部流畅**：

| 设备 | Janky% | p50 | p99 | SlowBitmap | SlowDraw |
| --- | --- | --- | --- | --- | --- |
| D1 (720p/API32) | **0.31%** | 5 | 8 | **0** | **0** |
| D2 (1080p/API35) | **0%** | 5 | 7 | **0** | **0** |
| D3 (1080p/API32) | **0%** | 5 | 7 | **0** | **0** |

**分类页滚动 5 次采样**：Janky 平均 **5.79%**（波动 0–11.27%），
但 **`Slow bitmap uploads`、`Slow issue draw commands`、`Slow UI thread` 全部为 0**。

### 修正后的任务定位

| 原问题 | 原定位 | **修正后定位** |
| --- | --- | --- |
| **A** `onViewRecycled` 缺失 | 性能 | ✅ **正确性缺陷（必须修）** |
| **B** `load()` 无条件清空 | 性能 | ⚠️ **视觉体验（建议修，勿称性能收益）** |
| ~~C~~ `GradientDrawable` 重建 | 性能 | ❌ **无实测依据（降级为可选）** |
| **D** 无并发限制 | 性能 | ⚠️ **需先验证（网络层）** |

**核心修正**：**本任务的首要目标是修复图片错位的正确性缺陷，而非提升滚动性能**
（实测基线已流畅）。

**报告要求**：

- **不要**声称「优化了滚动性能」—— 实测基线已是流畅的
- **应**声称「修复了图片错位的正确性缺陷」
- 若做了 B/C/D，说明**为何做**（视觉体验 / 代码整洁性）而非性能

**完整修正说明见 `.agents/shared/perf-p4-correction.md`。**

---

## 一、背景

**协调者静态审查发现 4 个问题**（详见 `.agents/shared/perf-baseline-render.md`）。

**设备已恢复**（D1/D2/D3 三台模拟器 + 真机均在线），
**执行方应实测验证**，不要仅依赖代码审查。

### 与 P3 的关系

| 任务 | 文件 | 负责方 |
| --- | --- | --- |
| P3 TV 切集 UI 树复用 | `MainActivity.kt` | workbuddy |
| **P4 TV 列表渲染（本任务）** | **`SeriesAdapter.kt`、`ArtworkLoader.kt`** | **codex** |

**文件不重叠，可并行。**

### ⚠️ 并行构建注意

P3 与 P4 都编译同一个 APK，**同时执行 `assembleDebug` 可能争用 Gradle build 目录**。

**建议**：改代码可并行，但**构建前互相确认或错开时间**。

---

## 二、要修的问题

### 🔴 问题 A：`SeriesAdapter` 无 `onViewRecycled`

**位置**：`apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`

**现状**（协调者已核实）：

```kotlin
class SeriesAdapter(...) : RecyclerView.Adapter<SeriesAdapter.Holder>() {
    class Holder(...)                      // 25 行
    override fun onCreateViewHolder(...)   // 38 行
    override fun onBindViewHolder(...)     // 117 行
    // ← 没有 onViewRecycled
}
```

**影响**：RecyclerView 复用卡片时旧图片残留 → **快速滚动出现图片错位**（显示上一部剧封面）。

**要求**：

```kotlin
override fun onViewRecycled(holder: Holder) {
    super.onViewRecycled(holder)
    holder.image.tag = null          // 清理 tag，避免复用误判
    holder.image.setImageDrawable(null)
    // 重置可能残留的状态
}
```

### 🔴 问题 B：`ArtworkLoader.load()` 每次都清空图片

**位置**：`ArtworkLoader.kt:20-23`

```kotlin
fun load(url: String, target: ImageView) {
    target.tag = url; target.setImageDrawable(null)   // ← 无条件清空
    if (url.isBlank()) return
    cache.get(url)?.let { target.setImageBitmap(it); return }
    ...
}
```

**影响**：**每次 bind 都先清空** → 滚动时**明显闪烁**。
**即使缓存命中**，也是「清空 → 立即设置」两步，可能产生一帧空白。

**要求**：

- 若 `target.tag == url` **且已有图片**，直接返回（避免重复工作）
- **缓存命中时不清空**，直接 `setImageBitmap`

**建议改法**：

```kotlin
fun load(url: String, target: ImageView) {
    if (target.tag == url && target.drawable != null) return   // 已是目标图，跳过
    if (url.isBlank()) { target.tag = null; target.setImageDrawable(null); return }
    cache.get(url)?.let {
        target.tag = url
        target.setImageBitmap(it)      // 命中缓存：不清空，直接设置
        return
    }
    target.tag = url
    target.setImageDrawable(null)      // 仅未命中时才清空
    scope.launch { ... }
}
```

### 🟡 问题 C：`GradientDrawable` 每次 bind 都新建

**位置**：`SeriesAdapter.kt:141-144`

```kotlin
val cornerRadiusPx = TvUi.dimen(holder.itemView.context, R.dimen.series_rank_badge_radius).toFloat()
holder.rankBadge.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, bgGradient).apply {
    cornerRadius = cornerRadiusPx
}
```

**影响**：榜单页滚动时每次 bind 都创建新对象 + 查询 dimens。

**要求**：在 `Holder` 中**缓存 4 种**（金/银/铜/普通）`GradientDrawable`，
在 `onCreateViewHolder` 时预建一次，bind 时按位置选用。

**注意**：`cornerRadius` 依赖 `TvUi.dimen`，**在 ViewHolder 创建时计算一次即可**
（同一 holder 的尺寸不变）。

### 🟡 问题 D：无图片请求并发限制

**位置**：`ArtworkLoader.kt:16`

```kotlin
private val client = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build()
```

**影响**：OkHttp 默认允许 64 并发 → 快速滚动时**请求风暴**。

**要求**：

- 限制 `dispatcher.maxRequests` 与 `maxRequestsPerHost`（如 4~8）
- 或在快速滚动时取消进行中的请求（进阶，可选）

---

## 三、必须验证的行为

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 快速滚动分类页 | 无图片错位 |
| 2 | 快速滚动榜单页 | 无图片错位、无闪烁 |
| 3 | 滚动后回到已加载位置 | 图片已缓存，立即显示 |
| 4 | 榜单 Top 1/2/3 徽标 | 颜色正确（金/银/铜） |
| 5 | 榜单 Top 4+ 徽标 | 普通色 |
| 6 | 分类页左栏筛选 | 不受影响 |
| 7 | 搜索结果页 | 不受影响 |
| 8 | 内存 | 无泄漏（`dumpsys meminfo`） |

**注意**：`SeriesAdapter` 被**分类页、榜单页、搜索结果**共用，**需全场景回归**。

---

## 四、硬性约束

1. **可改文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ArtworkLoader.kt`
2. **不要改** `MainActivity.kt`（P3 的职责，workbuddy 在做）
3. **不要改** `server/provider.mjs`、`custom-server/`（P1 的职责）
4. **不要改** `apps/web-pc/src/`（P2/P5 的职责）
5. **不要改** `shared/content-core/hongguo.js`
6. 保持 TV 单元测试通过（32 项）
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `onViewRecycled` 已实现 | 代码核实 |
| 2 | 缓存命中时不清空图片 | 代码核实 |
| 3 | `GradientDrawable` 已复用 | 代码核实（bind 中不再 new） |
| 4 | 图片请求有并发上限 | 代码核实 |
| 5 | 8 项行为验证通过 | 设备实测 |
| 6 | TV 单元测试 32 项通过 | |
| 7 | 报告写入 `.agents/shared/t-p4-tv-render-codex.md` | |

---

## 六、验证方法

### 环境（设备可能需先启动）

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384     # D1（需先启动 MuMu）
# 或真机
& $adb connect 192.168.1.120:5555
```

**若设备不可用**：在报告中**明确说明**，并至少提供代码级证据。

### 滚动流畅度测量

```powershell
# 重置统计
& $adb -s <设备> shell dumpsys gfxinfo com.hongguotv.tv reset
# 滚动若干次
# 读取统计
& $adb -s <设备> shell dumpsys gfxinfo com.hongguotv.tv
```

关注 **Janky frames** 比例与 **90th/95th/99th percentile**。

### 内存检查

```powershell
& $adb -s <设备> shell dumpsys meminfo com.hongguotv.tv | Select-String "TOTAL"
```

---

## 七、证据要求

1. **代码改动对比**（4 个问题的修改）
2. **滚动实测**：快速滚动前后截图（无错位）
3. **gfxinfo 数据**：优化前后的 Janky frames 对比
4. **内存数据**：确认无泄漏
5. **8 项行为验证**结果
6. TV 单元测试输出

**若设备不可用**：说明情况，提供代码级证据，并标注「未实测」。

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **`onViewRecycled` 必须清 tag** | 否则复用时会误判「已是目标图」而跳过加载 |
| **缓存命中不清空的前提** | 依赖 `tag` 校验，tag 不匹配时必须清空 |
| **`GradientDrawable` 复用** | 注意 `cornerRadius` 在不同屏幕档位下的值不同，需在 ViewHolder 创建时算好 |
| **`SeriesAdapter` 三处共用** | 分类页/榜单页/搜索页，改动需全回归 |
| **设备离线** | 需先启动 MuMu 或连真机 |
| **Gradle 并发** | 与 P3 同时构建会争用 build 目录 |
| 引擎限制 | TV 的 QuickJS 无 `randomBytes`（已知，与本任务无关） |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-p4-tv-render codex "结论及报告路径"
```
