# 分类页面 UI 设计缺陷发现报告

**发现方**: dsh（协调者）
**日期**: 2026-10-15
**范围**: 分类页（TV 端 + Web 端）
**性质**: 只读发现，未修改任何代码

---

## 一、发现汇总

| ID | 端 | 严重度 | 标题 | 验证状态 |
| --- | --- | --- | --- | --- |
| **C1** | Web | **medium** | `no-scrollbar` 类未定义，5 处横向滚动条隐藏失效 | **已核实** |
| **C2** | TV | **high** | 题材标签达 24 个时，筛选区挤占全部高度导致网格不可见 | **静态推演**（见 §3） |
| **C3** | Web | low | `overflow-x-auto` 与 `flex-wrap` 互斥冗余 | **已核实** |
| **C4** | TV | medium | 空态下焦点落在筛选区，用户看不到「暂无内容」引导 | **已核实**（代码） |
| **C5** | TV | low | `series_card_width` 键名与实际用途（高度）不符 | **已核实** |

---

## 二、C1（medium，已核实）`no-scrollbar` 类未定义

### 事实

`no-scrollbar` 在 **5 个组件**中被使用：

| 文件 | 行 |
| --- | --- |
| `CategoryPanel.tsx` | 98 |
| `Header.tsx` | 30 |
| `HomePanel.tsx` | 105 |
| `RankPanel.tsx` | 72 |
| `SearchPanel.tsx` | 262 |

但该**从未定义**：

- `apps/web-pc/src/index.css` 无此规则
- `tailwind.config.js` 未配置对应插件

### 实测证据

检查构建产物 CSS（`apps/web-pc/dist/assets/index-*.css`）：

```
✗ 构建产物 CSS 中【无】no-scrollbar 规则 → 该类完全无效
✓ .overflow-x-auto 已生成
✓ .flex-wrap 已生成
✓ .gap-2 已生成
```

**对比证明**：其他 Tailwind 类正常生成，唯独 `no-scrollbar` 缺失 —— 因为它不是 Tailwind 内置类，也未自定义。

### 影响

`index.css` 定义了全局滚动条样式（6px 高）：

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
```

因此 `overflow-x-auto` 的容器在内容溢出时会显示**可见滚动条**，与 `no-scrollbar` 的意图（隐藏）矛盾。

**具体表现**：

| 位置 | 内容 | 后果 |
| --- | --- | --- |
| 顶部导航 | 7 个菜单项 | 窄屏时出现横向滚动条 |
| 首页分类栏 | 多个分类 | 同上 |
| 榜单页标签 | 4 个榜单 | 同上 |
| 搜索页标签 | 多个筛选 | 同上 |

### 建议

在 `index.css` 补充：

```css
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## 三、C2（high，静态推演）TV 分类页高度挤占

### 事实

TV 分类页（`CatalogScreenView`）的垂直结构：

```
LinearLayout (VERTICAL)
├── 标题「官方题材全部分类」        26f bold
├── 一级类型 CategoryTagLayout      真人剧 / 漫剧 / AI剧（3 个）
├── 二级题材 CategoryTagLayout      全部题材 + 24 个标签（25 个）
└── RecyclerView 网格               LayoutParams(-1, 0, 1f)  ← 权重 1
```

**筛选区是固定高度、不可滚动**；网格用 `weight=1f` 占据剩余空间。

### 空间推演

实测数据（`emulator-5554`，**1280×720 @ density 1.5 → 853×480 dp**）：

> density 反推依据：U6 证据 dump 中 tab bounds 高 72px，对应 `pillButton(minHeight 36dp) + rank_tab_pad_bottom 10dp = 46dp`，72/46 ≈ 1.57 → density = 1.5

**限定符命中**：853dp 最小宽度 ≥ 600dp → 使用 `values-sw600dp` 档
（`values-w1280dp` 需可用宽度 ≥ 1280dp，**不命中**）

| 项 | 高度 |
| --- | --- |
| padding top | 20dp |
| 标题（26f bold） | ≈ 38dp |
| 一级类型组（3 个 pill，group padding 4dp×2） | 44dp |
| **二级题材组（25 个标签，每行 8 个 → 4 行）** | **≈ 172dp** |
| padding bottom | 20dp |
| **筛选区合计** | **≈ 294dp** |

**剩余给网格**：480 − 294 = **186dp**

**网格单行高度**：`series_card_width`(330dp) + margin(14dp) = **344dp**

### 结论

```
186dp（剩余） < 344dp（单行高度）
```

**一行卡片都放不下。** `RecyclerView` 高度被压到不足一行，用户看到的是筛选区占满屏幕、下方几乎无内容。

### 数据依据

题材标签数量实测（`GET /api/category/tags?type=...`）：

| 类型 | 标签数 |
| --- | --- |
| `real-drama`（真人剧） | **24** |
| `comic-drama`（漫剧） | 8 |
| `ai-drama`（AI剧） | 8 |

**真人剧是默认类型**，也是标签最多的 —— 即用户进入分类页**必然遇到最坏情况**。

### 与既有设计意图的冲突

`CategoryTagLayout` 的注释明确写道：

```kotlin
/** All filters stay visible; wrap to the available TV width without horizontal scrolling. */
```

「所有筛选保持可见」的设计意图，在 24 个标签时**与内容展示直接冲突**。

### 建议方向

| 方案 | 说明 |
| --- | --- |
| **A. 折叠 + 展开** | 默认显示一行 + 「更多」，聚焦时展开 |
| **B. 横向滚动** | 改回 `HorizontalScrollView`，按行分组 |
| **C. 筛选区可滚动** | 筛选区与网格同处一个滚动容器 |
| **D. 限制高度** | 筛选区设最大高度，超出部分滚动 |

**推荐 A 或 D** —— 保持「全部可见」意图的同时不挤占内容区。

---

## 四、C3（low，已核实）`overflow-x-auto` 与 `flex-wrap` 互斥

`CategoryPanel.tsx:98`：

```jsx
className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-wrap"
```

`overflow-x-auto` 允许横向滚动，`flex-wrap` 允许换行 —— **两者互斥**：

- 有 `flex-wrap` 时，内容换行而非横向溢出
- 因此 `overflow-x-auto` **永不生效**（滚动条不会出现）

**这是冗余属性**，且掩盖了 `no-scrollbar` 未定义的问题（因为滚动条本来就不出现）。

**建议**：移除 `overflow-x-auto`，或移除 `flex-wrap`（取决于设计意图）。

---

## 五、C4（medium，已核实）空态焦点引导问题

`CatalogScreenView.kt:128-133`：

```kotlin
if (rows.isEmpty()) {
    addView(TvUi.text(context, "暂时没有内容"))
    val returnBtn = TvUi.pillButton(context, "返回推荐", active = true) { onReturnFeed() }
    addView(returnBtn, LayoutParams(-2, -2))
    val focusBtn = initialFocusView ?: returnBtn   // ← 优先筛选按钮
    post { focusBtn.requestFocus() }
}
```

`initialFocusView`（第 122-126 行）在 `source == "category"` 时指向**筛选按钮**：

```kotlin
val initialFocusView: View? = if (source == "rank") {
    rankButtons.firstOrNull { it.isSelected } ?: rankButtons.firstOrNull()
} else if (categoryButtons.isNotEmpty()) {
    categoryButtons.firstOrNull { it.contentDescription == categoryFilterFocus }
} else null
```

**问题**：分类页无内容时，焦点停留在筛选区，用户需自行向下寻找「返回推荐」按钮；而该按钮**无视觉引导**。

**影响**：用户可能认为页面卡死或无法操作。

**建议**：空态时优先聚焦「返回推荐」，或同时高亮提示。

---

## 六、C5（low，已核实）尺寸键命名误导

`series_card_width` 的实际用途是**卡片高度**：

```kotlin
// SeriesAdapter.kt:42-45
layoutParams = RecyclerView.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,      // ← 宽 = 撑满
    TvUi.dimen(context, R.dimen.series_card_width)   // ← 高 = series_card_width
)
```

**键名 `width` 实际表示 `height`**，三档值 275/330/385dp。

**影响**：维护时易误判；本次缺陷分析（C2）中就需先厘清此语义才能算准。

**建议**：重命名为 `series_card_height`（D1 技术债已记录，此次再次确认）。

---

## 七、验证方式与局限（如实说明）

### 已实测

| 项 | 方式 |
| --- | --- |
| C1 | 检查构建产物 CSS，确认 `no-scrollbar` 缺失 |
| C3 | 读源码对比两个 CSS 类的语义 |
| 题材数量 | 实际请求 `GET /api/category/tags` |
| 屏幕参数 | 从 U6 证据 dump 反推 density |
| 尺寸配置 | 读三档 `dimens.xml` |

### 未能实测（环境限制）

**TV 端未能实机截图验证 C2**：

- `adb` daemon 无法启动
- **根因**：端口 5037 被 **`xray`** 进程占用（非 adb 自身问题）
- 这是**本机环境冲突**，不是产物缺陷

**因此 C2 为静态推演结论**，依据是：

1. 实测的标签数量（24 个）
2. 实测的屏幕参数（1280×720，density 1.5）
3. 实测的尺寸配置（三档 `dimens.xml`）
4. 读源码确认的布局结构（筛选区固定 + 网格 `weight=1f`）

**推演未覆盖的变量**：

- 标签按钮的实际渲染宽度（依赖字体度量，我按 85dp 估算）
- `CategoryTagLayout` 中 `AT_MOST` 测量对换行的影响
- 网格 `RecyclerView` 在高度不足时的具体表现（压缩 or 裁剪）

**建议**：解决 adb 冲突后**实机截图确认**，再决定修复方案。

---

## 八、优先级建议

| 优先级 | 项 | 理由 |
| --- | --- | --- |
| **P0** | **C2** | 影响核心功能（分类页几乎不可用），需先实机确认 |
| **P1** | **C1** | 影响 5 处界面观感，修复成本极低 |
| **P2** | C4 | 空态体验，成本低 |
| **P3** | C3、C5 | 代码质量 |

---

## 九、后续

1. **先解决 adb 端口冲突**（5037 被 xray 占用），实机确认 C2
2. 若 C2 确认，按建议方向修复（推荐折叠 + 展开）
3. C1 可立即修复（补 CSS 定义）
