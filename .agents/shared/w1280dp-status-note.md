# `values-w1280dp` 目录现状说明（不处理）

**记录方**: dsh（协调者）
**日期**: 2026-10-15
**结论**: **用户决定不处理**。本文件仅记录事实，供后续参考。

---

## 一、事实

### 目录现状

| 目录 | 键数 | 状态 |
| --- | --- | --- |
| `values` | 119 | 生效 |
| `values-sw600dp` | 119 | 生效 |
| **`values-w1280dp`** | 119 | **永不生效**（见下） |

三档键**完全一致**，值递进（如 `series_card_width` 275 / 330 / 385dp）。

### 为什么不生效

Android 资源匹配按限定符**优先级顺序**比较，其中：

```
smallestWidth (sw)  优先级  >  available width (w)
```

`values-w1280dp` **未声明 sw 限定符**，因此在 sw 比较阶段被判为「更泛化」而被淘汰。

**推论**：

> 只要设备最小宽度 ≥ 600dp，`values-w1280dp` 就**永远不会被选中** ——
> 它被 `values-sw600dp` 遮蔽。

### 实测证据

| 设备 | `am get-config` | 最小宽度 | 实际命中 |
| --- | --- | --- | --- |
| D1 (720p @240dpi) | `sw480dp-w853dp` | 480dp | `values` |
| D2/D3 (720p @280dpi) | `sw411dp-w731dp` | 411dp | `values` |
| D3 (720p @192dpi) | `sw600dp` | 600dp | `values-sw600dp` |
| **REAL (720p @160dpi)** | **`sw720dp-w1280dp`** | **720dp** | **`values-sw600dp`** |
| D1 (720p @90dpi) | `sw1280dp-w2275dp` | 1280dp | **`values-sw600dp`**（遮蔽实证） |

**决定性证据**：最后一行 —— 设备已满足 `sw1280dp`，但仍命中 `values-sw600dp`，
因为 `values-w1280dp` 没有 sw 限定符可比。

来源：
- `.agents/shared/device-dimens-bucket-correction.md`（workbuddy 实测）
- 协调者在真机 `am get-config` 复核

---

## 二、用户决定

**不处理。** 保持 `values-w1280dp` 目录原样。

**含义**：
- 该目录的 119 个键**实际不参与任何设备的资源解析**
- 第三档的大屏适配（385dp 卡片等）**当前不会在任何设备上生效**
- 单元测试 `TvUiLayoutTest.dimensXmlConsistencyAcrossTiers` 仍会校验它与其他两档键一致

---

## 三、若将来需要启用第三档

**可选方案**（仅供参考，当前不实施）：

| 方案 | 说明 | 代价 |
| --- | --- | --- |
| 改名 `values-sw1280dp` | 语义明确，与 sw600dp 同族 | 需 sw≥1280dp 的设备才生效 |
| 改名 `values-sw720dp` | 真机（sw720dp）能命中 | 需确认与 sw600dp 的优先级关系 |
| 改为 `values-w960dp` | 1080p 设备可能命中 | **w 优先级仍低于 sw，可能继续被遮蔽** |
| 合并进 `values-sw600dp` | 变两档 | 丢失大屏细分 |

**关键约束**：任何 `values-*dp` 目录若不含 `sw` 限定符，都可能被 `values-sw600dp` 遮蔽。

---

## 四、如何判断设备实际命中哪一档

**不要靠推算，用命令实测**：

```powershell
$adb shell am get-config
# 输出中的 sw<N>dp 即为最小宽度
#   sw480dp  → values
#   sw600dp  → values-sw600dp
#   sw720dp  → values-sw600dp（因 w1280dp 被遮蔽）
```

**若要在模拟器上验证 sw600dp 档**（TV 目标档）：

```powershell
adb shell wm size 1280x720
adb shell wm density 192    # 720/600 = 1.2，需 density ≤ 192
adb shell am get-config     # 应显示 sw600dp
```

**仅改 `wm size` 不够** —— 会落到 `values` 档。

---

## 五、相关文件

| 文件 | 内容 |
| --- | --- |
| `.agents/shared/device-dimens-bucket-correction.md` | workbuddy 的实测勘误 |
| `.agents/shared/device-allocation.md` §六 | 已更正后的档位说明 |
| `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml` | 本目录（保持原样） |
| `apps/tv-android/app/src/test/java/com/hongguotv/tv/TvUiLayoutTest.kt` | 键一致性测试 |
