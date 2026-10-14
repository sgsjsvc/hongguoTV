# U1 验收报告（协调者 dsh）

**任务**: `t-u1-fix-layout` 修复收藏页按钮拉伸 + SeriesAdapter 尺寸资源化
**执行方**: antigravity
**验收方**: dsh
**验收时间**: 2026-10-13 22:30
**结论**: ✅ **通过**（含 1 项证据瑕疵、1 项范围疏漏，均不阻塞）

---

## 1. 验收方法

不采信自述，独立复验：

1. 代码级核实修复是否真实
2. **双模式扫描**（本轮新增，修正 T1 的扫描盲区）
3. 新增 dimens 键的三档齐全性与梯度
4. 构建/lint/测试亲自重跑
5. 截图证据有效性检查

---

## 2. 修复核实

### 2.1 收藏页按钮拉伸 ✅ 已修复

```kotlin
// ui/CatalogScreenView.kt:92
addView(returnBtn, LayoutParams(-2, -2))
```

由 `MATCH_PARENT`（默认）改为 `WRAP_CONTENT`，根因消除。

**执行方提供的 UI dump 证据有效**：

```
'返回推荐'  bounds=[36,130][168,202]
```

按钮宽度 = 168 − 36 = **132px**，屏幕宽 1280px → 占比 10.3%，确为包裹内容。修复前会是满宽 `[36,130][1244,202]`。

### 2.2 SeriesAdapter 尺寸资源化 ✅ 已修复

3 处硬编码全部替换为 `TvUi.dimen(...)`：

| 原位置 | 替换为 |
| --- | --- |
| `:75` 标题 padding | `series_card_title_pad_h/top/bottom` |
| `:80` 角标 padding | `series_card_badge_pad_h/bottom` |
| `:109` 排名圆角 | `series_rank_badge_radius` |

### 2.3 新增 6 键三档齐全且有梯度 ✅

| 键 | base | sw600dp | w1280dp |
| --- | --- | --- | --- |
| `series_card_title_pad_h` | 3dp | 3.5dp | 4dp |
| `series_card_title_pad_top` | 4dp | 5dp | 6dp |
| `series_card_title_pad_bottom` | 1dp | 1.5dp | 2dp |
| `series_card_badge_pad_h` | 3dp | 3.5dp | 4dp |
| `series_card_badge_pad_bottom` | 3dp | 3.5dp | 4dp |
| `series_rank_badge_radius` | 4dp | 5dp | 6dp |

**三档数值确实不同**，非复制粘贴。

---

## 3. 双模式扫描结果

| 模式 | 结果 |
| --- | --- |
| `dp(数字)` | **0** |
| `TvUi.dp(context, 数字)` | **1** ← 见 P1 |
| 任意 `.dp(` | 2（含 `MainActivity.kt:156` helper 定义，合理） |

---

## 4. 构建链独立复验 ✅

| 命令 | 结果 |
| --- | --- |
| `:app:assembleDebug` | BUILD SUCCESSFUL |
| `:app:lintDebug` | BUILD SUCCESSFUL |
| `:app:testDebugUnitTest` | BUILD SUCCESSFUL，**30 项 0 失败** |

**APK**：8.42 MB，构建时间 22:01:24
**SHA256**：`DB08E80BA851FE1D75DFEDA4ACC28B6B5154003EA39AE6FEA5DEAE6C431059FF`

---

## 5. 发现的问题

### P1（中）仍有 1 处硬编码残留，但**不在 U1 范围内**

```kotlin
// CategoryTagLayout.kt:9
private val gap = TvUi.dp(context, 8)
```

**归属判定**：U1 的 brief 只允许改 `ui/CatalogScreenView.kt`、`SeriesAdapter.kt`、`res/values*/dimens.xml`。`CategoryTagLayout.kt` 位于 `tv/` 根目录，**不在授权范围**，且该文件最后修改时间为 09:11（U1 之前）。

**因此这不是执行方失职，而是协调者的规划疏漏** —— 我最初划定 U1 范围时只覆盖了 `SeriesAdapter.kt`，漏掉了这个文件。

**处理**：追加为 U4（见第 7 节）。

### P2（低）执行方截图证据编码损坏

`.agents/shared/u1-empty-favorites.png` 被 **UTF-16 编码破坏**：

```
签名: FF-FE-FD-FF-50-00-4E-00    （正确应为 89-50-4E-47-0D-0A-1A-0A）
```

每个字节间插入了 `00`，图像不可读。这是 PowerShell `>` 重定向的典型问题。

**影响**：截图证据无效。但**报告中的 UI dump 文本证据有效**，足以证明修复（见 2.1）。

**建议**：后续任务要求用 `adb shell screencap -p /sdcard/x.png` + `adb pull` 两步法，避免 shell 重定向破坏二进制。

### P3（提示）新发现：历史页卡片底部文字重叠

本轮验证时在历史页观察到：卡片底部的进度条区域与日期文字（`2026/10/13 下午10:22`）**存在重叠**。这与 U2 正在处理的进度条问题相关，已转交 U2 关注。

---

## 6. 回归确认

| 检查项 | 结果 |
| --- | --- |
| 现有功能 | 未受影响（改动仅限按钮宽度与 padding） |
| 播放能力 | 模拟器实测可播放 |
| `MainActivity.kt` | **未被 U1 改动**（符合 brief 约束） |
| `TvUi.kt` | **未被 U1 改动** |
| `shared/content-core/hongguo.js` | **未改动** |
| 工作区既有改动 | **未回退** |

---

## 7. 验收决定与后续

**U1 通过。** 状态保持 `done`。

**遗留**：

| 项 | 处理 |
| --- | --- |
| P1 `CategoryTagLayout.kt` 残留 | 追加 **U4** 任务 |
| P2 截图编码 | 在 U2/U4 brief 中明确要求正确截图方式 |
| P3 历史页文字重叠 | 已并入 U2 关注范围 |

**U2 状态**：已被 antigravity 认领（持锁），进行中。
