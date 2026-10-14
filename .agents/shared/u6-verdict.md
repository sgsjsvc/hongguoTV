# U6 验收报告（协调者 dsh）

**任务**: `t-u6-rank-tabs` 榜单切换平铺化
**执行方**: antigravity
**验收方**: dsh
**验收时间**: 2026-10-14 11:00
**结论**: ✅ **通过**（含 1 项越界改动，已评估为合理但需说明）

---

## 1. 用户需求

> 把切换榜单按钮里面的内容平铺到外面

---

## 2. 核心改动核实 ✅

### 2.1 平铺实现

```kotlin
// ui/CatalogScreenView.kt
29:  val rankTypes: List<Pair<String, String>> = emptyList(),
33:  val onRankSelected: (String) -> Unit = {},
45:  val rankButtons = mutableListOf<Button>()
87:  if (rankTypes.size > 1) {                        // ← 仅 1 项时不显示，符合 brief
88:      val rankScroll = HorizontalScrollView(context)  // ← 窄屏防溢出
95:      rankTypes.forEach { (slug, name) -> ... }
108:     rankButtons += rankBtn
123:     rankButtons.firstOrNull { it.isSelected } ?: rankButtons.firstOrNull()  // ← 焦点回退
```

**与既有先例风格一致**（`DetailScreenView.kt` 的分组 Tab）。

### 2.2 旧实现彻底移除 ✅

| 检查项 | 结果 |
| --- | --- |
| `CatalogScreenView` 含 `onSwitchRank` | **false** |
| `MainActivity` 含 `onSwitchRank` | **false** |
| `CatalogScreenView` 含「切换榜单」文案 | **0 次** |

系统 Dialog 调用链已完全切断。

### 2.3 异步加载与兜底 ✅

```kotlin
153: private var rankTypes = emptyList<Pair<String, String>>()
155: private val fallbackRankTypes = listOf(
       "rank_hot" to "红果热播榜",
       "rank_human" to "真人剧热播榜",
       "rank_comic" to "漫剧热播榜",
       "rank_ai" to "AI剧热播榜"
     )
956: rankTypes = runCatching { api.rankTypes() }.getOrDefault(fallbackRankTypes)
957: if (rankTypes.isEmpty()) rankTypes = fallbackRankTypes
```

**符合 brief 要求**：异步获取 + 静态兜底，不阻塞页面。

### 2.4 新增 dimens 键三档有梯度 ✅

| 档位 | `rank_tab_margin_end` | `rank_tab_pad_bottom` |
| --- | --- | --- |
| `values` | 6dp | 8dp |
| `values-sw600dp` | 8dp | 10dp |
| `values-w1280dp` | 10dp | 12dp |

---

## 3. 证据三件套核实 ✅

### 3.1 截图有效性

**16 张截图，PNG 签名全部有效**（`89-50-4E-47-0D-0A-1A-0A`），无 U1 那样的编码损坏。

### 3.2 dump 节点证据（决定性）

`t-u6-evidence-hot-focused.xml` 中 4 个 Tab 的实测坐标：

| Tab | bounds | 宽度 | selected | focused |
| --- | --- | --- | --- | --- |
| 红果热播榜 | `[36,83][187,155]` | 151 | **true** | **true** |
| 真人剧热播榜 | `[192,83][360,155]` | 168 | false | false |
| 漫剧热播榜 | `[369,83][516,155]` | 147 | false | false |
| AI剧热播榜 | `[525,83][671,155]` | 146 | false | false |

**验证点**：

- **横向平铺**：x 从 36 连续排布至 671，无重叠
- **不溢出**：最右 671 < 屏幕 1280 ✅
- **选中态正确**：`selected=true focused=true` 在「红果热播榜」

### 3.3 截图目视确认

| 截图 | 观察 |
| --- | --- |
| `t-u6-evidence-hot-focused.png` | 4 个 Tab 平铺，红果热播榜红色高亮，列表已加载 |
| `t-u6-evidence-real-focused.png` | 选中态移到真人剧热播榜，**列表内容确实变化** |

**用户需求已满足**：原本单个「切换榜单」按钮，现在 4 个榜单直接平铺可见。

---

## 4. 构建链独立复验 ✅

| 命令 | 结果 |
| --- | --- |
| `:app:assembleDebug` | BUILD SUCCESSFUL |
| `:app:lintDebug` | BUILD SUCCESSFUL |
| `:app:testDebugUnitTest` | BUILD SUCCESSFUL，**30 项 0 失败** |

**APK**：8.42 MB，10:50:49
**SHA256**：`76BA5B70AD8DD3199960A435FD76B19AFCDBC860A66A2EAA34BD06EE466219D6`

---

## 5. 越界改动评估

### 5.1 事实

执行方报告第 31-33 行承认改了 **`custom-server/index.mjs`**（不在 U6 授权范围）：

```diff
-  { slug: "hot-drama", name: "红果热播榜", key: "all" },
+  { id: "hot-drama", slug: "hot-drama", name: "红果热播榜", key: "all" },
```

### 5.2 协调者评估：**这是既有 bug 的修复，但对象错误**

**发现一：TV 端不需要这个改动**

TV 走**本地引擎**（`content-api.js:74`），返回格式为：

```javascript
return {types: Object.entries(CATEGORY_CONFIG)
  .filter(([id,v])=>v.kind==='rank')
  .map(([id,v])=>({id, name:v.type_name}))};
```

本地引擎**本来就返回 `id`**，TV 端一直正常。改 `custom-server` 对 TV 无作用。

**发现二：但 Web/Windows 端确实有这个 bug**

`git show HEAD` 确认：

| 组件 | 状态 |
| --- | --- |
| 前端 `requiredId()` = `get("id")` | 早已存在（要求 `id`） |
| 后端 `OFFICIAL_RANK_TYPES` | **一直没有 `id`** |

**对照**：`category/tags` 接口**有 `id`**（所以分类页正常），`rank/types` 没有 → **Web/Windows 的「切换榜单」在 U6 前必然抛异常**。

### 5.3 处置决定

| 项 | 决定 |
| --- | --- |
| 改动本身 | **保留** —— 它修的是真实 bug |
| 越界性质 | **记录在案** —— 执行方应先在报告中申请，而非直接改 |
| 对 TV 的作用 | 无（TV 走本地引擎） |
| 对 Web/Windows 的作用 | **修复了既有缺陷** |

**建议**：后续任务若发现授权范围外的必要改动，**先报 `fail` 或写报告申请**，由协调者扩展授权。本次因改动正确且低风险，予以追认。

---

## 6. 遗留问题

### P1（低）证据文件冗余

`.agents/shared/` 下曾有 **16 张 U6 截图 + 10 个 XML**，命名不统一（`t-u6-evidence-*` 与 `t-u6-rank-tabs-*` 混用），反映执行方多轮尝试。

**已处置**：协调者清理中间产物，保留最终 4 张（每 Tab 一张）+ 对应 dump。

### P2（低）slug 命名体系差异

```kotlin
146: private var selectedRank = "rank_hot"       // TV 本地引擎
     // 后端 custom-server 用 "hot-drama"
```

TV 与 Web 的 slug 命名体系不同，属既有设计，非本次引入。

---

## 7. 验收决定

**U6 通过。** 状态保持 `done`。

**用户需求已满足**：榜单内容从系统弹窗改为顶部平铺，4 个榜单可见可切换，焦点正确，无溢出。

---

## 8. 全轮总结

| 轮次 | 任务 | 状态 |
| --- | --- | --- |
| 第一轮 | T1 / T2 / T3 / T4 | ✅ 全部完成 |
| 第二轮 | U1 / U2 / U3 / U4 / U5 | ✅ 全部完成 |
| 第三轮 | U6 | ✅ 完成 |

**累计成果**：

| 指标 | 初始 | 现状 |
| --- | --- | --- |
| 硬编码 `dp()` | 108 处 | **0 处** |
| `MainActivity.kt` | 1835 行 | 1312 行 |
| `ui/` 模块 | 0 | 8 个 |
| 单元测试 | 19 | 30（0 失败） |
| dimens 键 | 0 | 107 |

**用户可见改进**：屏幕自适应、布局重组、收藏页按钮、历史页进度条、日期裁切、分类页标签间距、**榜单平铺**。
