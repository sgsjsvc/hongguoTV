# 勘误：`device-allocation.md` §六「dimens 档位差异」实测修正

**提出人**: workbuddy（独立复核方）
**日期**: 2026-10-15
**对象**: `.agents/shared/device-allocation.md` §六（dsh 制定）
**性质**: 实测勘误 + 建议（不修改原文档，供协调者决策）

---

## 一、问题摘要

§六 表格声称 `D1/D2/D3 → values-sw600dp`、`values 档命中设备：无`、`REAL → values-w1280dp`。**实测表明这些归属大多不成立**：档位判定看的是**最小宽度（smallestScreenWidthDp）**，而非可用宽度；且 `values-w1280dp` 在 sw≥600dp 的设备上会被 `values-sw600dp` **遮蔽**。

---

## 二、实测证据

### 2.1 D1（antigravity）— 实际命中 `values`（默认档），非 sw600dp

`wm size 1280x720` + 240dpi → `am get-config`：**`sw480dp-w853dp-h470dp-hdpi`**（最小宽度 480dp < 600dp）

分类页左栏实测（P2 复核，`.agents/shared/t-p2-category-top.xml`）：

| 元素 | 实测 | 换算 | 对应 dimens | 结论 |
| --- | --- | --- | --- | --- |
| leftRail | 156px | ÷1.5 = **104dp** | `values/catalog_rail_width` = **104dp** | ✅ 命中 `values` |
| 类型按钮高 | 42px | 28dp | `values/..._btn_height` = 28dp | ✅ 同上 |

> 若命中 sw600dp，leftRail 应为 118dp × 1.5 = 177px。实测 156px。

### 2.2 D3（workbuddy）— 文档建议的横屏配置实际命中 `values`

`wm size 1280x720`（保持 280dpi）→ `am get-config`：**`sw411dp-w731dp-h387dp-280dpi`**（411 < 600）→ `values`。

文档 §六 注记「D2/D3：1280/1.75 = 731dp 宽 → **仍命中 sw600dp**」的推论有误：**731dp 是可用宽度，最小宽度 = 720/1.75 = 411dp**。

### 2.3 `values-w1280dp` 被 `values-sw600dp` 遮蔽（关键）

在 D1 上构造 `wm density 90` + `wm size 1280x720` → `am get-config`：**`sw1280dp-w2275dp-h1255dp-land-90dpi`**（已满足 w1280dp 的触发条件）。此时分类页实测：

| 元素 | 实测 px | ÷0.5625 | `values-w1280dp` 期望 | 实际命中 |
| --- | --- | --- | --- | --- |
| leftRail | 66px | **117.3dp** | 142dp | **`values-sw600dp`（118dp）** |
| 类型按钮高 | 18px | **32.0dp** | 38dp | **`values-sw600dp`（32dp）** |

**根因**：Android 资源限定符优先级中 **`smallestWidth`(sw) 先于 `available width`(w)**。`values-w1280dp` 目录不含 sw 限定符，在 sw 比较阶段被判为更泛化而被淘汰；`values-sw600dp`（含 sw=600）胜出。

**推论**：只要设备的最小宽度 ≥ 600dp，`values-w1280dp` 就**永远不会生效**。因此 §六 表中「**REAL → w1280dp**」存疑——REAL 为 1280×720dp（最小宽度 720dp ≥ 600dp），预计同样命中 `sw600dp`。同理，§六 建议的「D2/D3 命中 w1280dp：`wm size 1280x720` + `wm density 160`」也预计无效（该配置为 1280×720dp → sw=720dp）。

> ⚠️ 我**无 REAL（`192.168.1.120:5555`）操作权限**，以上为基于同构配置的实测外推，**建议协调者或 dsh 在 REAL 上实测复核**（命令：`am get-config` + 安装 App 后进分类页量 leftRail）。

---

## 三、修正后的档位归属表（实测 + 外推）

| 设备与配置 | 逻辑尺寸 | 最小宽度 | 实际命中档 |
| --- | --- | --- | --- |
| D1 `1280x720` @240dpi | 853×480dp | 480dp | **`values`**（实测） |
| D2/D3 `1280x720` @280dpi | 731×411dp | 411dp | **`values`**（D3 实测） |
| D2/D3 原生 `1080x1920` @280dpi | 617×1097dp | 617dp | **`values-sw600dp`**（推导） |
| **D3 `1280x720` @192dpi（本次配置）** | 1066×600dp | **600dp** | **`values-sw600dp`**（实测 leftRail 142px=118.3dp）✅ |
| REAL `1280x720` @160dpi | 1280×720dp | 720dp | **`values-sw600dp`**（外推，**待 REAL 实测复核**） |
| D1 `1280x720` @90dpi | 2275×1280dp | 1280dp | **`values-sw600dp`**（实测，非 w1280dp） |

---

## 四、建议

1. **修订 §六 表格**：把 D1 与「横屏 720p 的 D2/D3」的档位改为 `values`；`values` 档的命中设备不是「无」，而是上述三者。
2. **明确判定口径**：文档应写明「档位由**最小宽度**决定（`am get-config` 的 `sw<N>dp`），不是可用宽度」。
3. **`values-w1280dp` 档形同虚设**：建议单列任务，将目录名改为 **`values-sw1280dp`**（与 sw600dp 同族，优先级可比，可真正生效）；该改动涉及全项目 dimens（`catalog_rail_*`、`switch_hint_*` 等），宜由协调者统筹。此项与我在 P2 报告 §四-2 的发现一致（`t-p2-verify-rail-workbuddy.md`）。
4. **REAL 复核**：请 dsh 在真机上执行 `am get-config` 确认档位（预期 `sw720dp` → 命中 sw600dp），以验证结论 3 的必要性。
5. **设备准备建议（供文档 §四 更新）**：若希望各模拟器落在 **sw600dp** 档（TV 目标档），除 `wm size 1280x720` 外还需 **`wm density 192`**（720/600=1.2 → density ≤ 192）；仅改 size 会落到 `values` 档。

---

## 五、相关证据文件

| 文件 | 内容 |
| --- | --- |
| `.agents/shared/t-p2-category-top.xml` | D1 分类页 dump（leftRail 156px = 104dp → `values` 档） |
| `.agents/shared/t-p2-w1280dp-config.xml` | D1 在 `sw1280dp-w2275dp` 配置下的 dump（仍解析 118dp → 遮蔽实证） |
| `.agents/shared/t-p2-verify-rail-sw600dp.png` | D1 临时 density 192 下的分类页（leftRail 142px = 118.3dp） |
| `.agents/shared/d3-prep-category.xml` / `.png` | D3 配置后分类页（leftRail 142px = 118.3dp → `values-sw600dp` 档） |
