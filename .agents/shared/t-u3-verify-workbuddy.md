# U3 独立复核报告：第二轮修复（U1 / U2 / U4）

- **复核方**：workbuddy（独立复核，只读，未修改任何代码）
- **时间**：2026-10-14 00:15（Asia/Shanghai）
- **对象**：`t-u1-fix-layout`（收藏页按钮拉伸 + SeriesAdapter 尺寸资源化）、`t-u2-progress-bar`（历史页进度条可见性）、`t-u4-tag-layout`（CategoryTagLayout 补齐）
- **依据**：任务 brief + 各执行方报告 + dsh 验收意见 + 本机亲自验证

---

## 一、已核实事实

### 1. 收藏页按钮拉伸：代码级已修好 ✅

- `ui/CatalogScreenView.kt:92`：`addView(returnBtn, LayoutParams(-2, -2))`（原为无参 addView，垂直 LinearLayout 中默认 MATCH_PARENT 被拉满宽）。焦点回退逻辑未动（93 行 `focusBtn` 仍可回退到 returnBtn）。
- 该修复是确定性修复：WRAP_CONTENT + 垂直容器 → 按钮宽度不可能再等于屏幕宽。

### 2. 双模式扫描：真实归零 ✅（三种口径全部执行）

| 口径 | 命令 | 结果 |
| --- | --- | --- |
| 模式 1 | `grep -rnE "dp\([0-9]+\)"`（全 kt） | **0** |
| 模式 2 | `grep -rnE "TvUi\.dp\([^)]*,[[:space:]]*[0-9]+\)"`（全 kt） | **0** |
| 放宽口径 | `grep -rnE "\.dp\([^)]*[0-9]"`（全 kt） | **0** |
| 全量 `.dp(` | `grep -rn "\.dp\("` | 仅 `MainActivity.kt:156` helper 定义（T1 明确保留，合理） |

U1 的 3 处（SeriesAdapter 75/80/109）与 U4 的 1 处（CategoryTagLayout:9）均已资源化。**T1 时期 `SeriesAdapter` 的漏网形式这次真正清零。**

### 3. 新增/变更 dimens 键：三档齐全、有梯度 ✅

脚本逐键解析三档（含小数）：

| 键 | base | sw600dp | w1280dp | 三档 | 梯度 |
| --- | --- | --- | --- | --- | --- |
| series_card_title_pad_h | 3 | 3.5 | 4 | ✅ | 有 |
| series_card_title_pad_top | 4 | 5 | 6 | ✅ | 有 |
| series_card_title_pad_bottom | 1 | 1.5 | 2 | ✅ | 有 |
| series_card_badge_pad_h | 3 | 3.5 | 4 | ✅ | 有 |
| series_card_badge_pad_bottom | 3 | 3.5 | 4 | ✅ | 有 |
| series_rank_badge_radius | 4 | 5 | 6 | ✅ | 有 |
| series_card_progress_height | 4 | 5 | 6 | ✅ | 有 |
| series_card_progress_margin_top | 4 | 5 | 6 | ✅ | 有 |
| category_tag_gap | 5 | 7 | 8 | ✅ | 有 |
| series_card_width | 275 | 330 | 385 | ✅ | 有 |

- 全量 **105 键**（97 + 8 个第二轮新增/调整口径）在 base 档定义，三档键集合一致，**105/105 满足 base ≤ sw600dp ≤ w1280dp 单调**，0 违例。U1/U2/U4 报告中的数值表与实测逐项一致。
- `category_tag_gap` 5dp 在 720p（240dpi）实测算 8px，与 U4 报告 dumpsys 的 8px 间距自洽。

### 4. U2 进度条修复：根因真实、对症、无回归 ✅

- **根因诊断属实**（不是凭猜调数值）：① 原代码未设 `progressTintList/progressBackgroundTintList`，暗色卡片（0xff1e293b）上低对比；② 基准 3dp 过小；③ 无顶部间距。当前 `SeriesAdapter.kt` 持有证据：`progressTintList = ColorStateList.valueOf(TvUi.RED)` + `progressBackgroundTintList = 0x44ffffff`，高度走 `series_card_progress_height`（4/5/6dp），`topMargin` 走 `series_card_progress_margin_top`（4/5/6dp）。
- **回归检查**：`onBindViewHolder` 中 `holder.progress.visibility = if (value == null) GONE else VISIBLE`（第 109 行附近）——无进度的卡片仍隐藏进度条，逻辑未被破坏。
- **渲染证据（我亲自查看）**：`u2-current-history.png`（修复前）：卡片底部无红条、日期文字贴边；`u2-fixed-history.png`（修复后）：红色进度条清晰可见、日期完整。两文件均为有效 PNG（签名 89-50-4E-47）。对比属实。

### 5. `series_card_width` 键名误导：确认 ✅

`SeriesAdapter.kt:42-46`：`RecyclerView.LayoutParams(MATCH_PARENT, TvUi.dimen(context, R.dimen.series_card_width))` —— 第二参是高度位。该键全项目仅此一处使用。dsh U2 验收 P1 的判断准确。U2 将三档值由 245/295/345 提到 275/330/385，键名与语义的偏差继续存在。

### 6. 时间线与 APK 覆盖 ✅

| 文件 | mtime | 归属 |
| --- | --- | --- |
| `MainActivity.kt` | 21:17 | T2/T3，U1/U2/U4 未触碰 |
| `ui/CatalogScreenView.kt` | 21:59 | U1 ✅ 授权范围 |
| `SeriesAdapter.kt` | 22:28 | U1→U2 串行 ✅ 授权范围 |
| 三个 `dimens.xml` | 22:55 | U4（与 U2 串行，无冲突） |
| `CategoryTagLayout.kt` | 22:55 | U4 ✅ 授权范围 |
| `app-debug.apk` | **22:57:05，8,828,207 B** | 晚于最后源码改动 → **覆盖当前全部源码** |

U1/U2/U4 均未触碰授权外文件；`shared/content-core/hongguo.js` 本轮未再改动（工作区 M 状态为 Codex 既有播放修复，T4 已记录）。

### 7. 构建链本机复跑 ✅

`./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug` → BUILD SUCCESSFUL（assemble UP-TO-DATE，APK 未被重写，印证覆盖性）。测试 XML 复解析：**30 项 0 失败 0 错误**。

### 8. U1 截图损坏独立确认 ✅

`.agents/shared/u1-empty-favorites.png` 签名 `ff fe fd ff 50 00 4e 00…`（UTF-16LE），解码后 **37.7% 字符为 U+FFFD**（原始字节已丢失）→ 图像不可恢复。dsh U1 验收 P2 的判定属实。

---

## 二、无法核实项

1. **U1「返回推荐」按钮的实际渲染宽度无法独立复核**：唯一截图已损坏；`outputs/debug/` 下 `u1-fav.xml` / `u1-favorites-empty.png` 虽为有效文件，但内容实为**播放页**（含「播放已暂停」HUD），文件名误导，不能用作收藏页证据；本机无 adb（`adb: command not found`），无法连 `emulator-5554` 复测。现存的宽度证据只有：代码 + 执行方报告内嵌的 dump 文本（`[36,130][168,202]`）+ dsh 转述。
2. **U2/U4 的模拟器设备元数据不一致**：U2/U4 报告称 API 33，T4 期间 dsh 记录 API 32。无环境可核对，存疑（不影响本次结论）。
3. **真实 320dpi 电视的档位命中**：T4 遗留项，本轮未触及（见 T4 报告）。

---

## 三、发现的问题

| # | 级别 | 问题 |
| --- | --- | --- |
| P1 | 中 | **U1 渲染证据链断裂**：截图损坏、间接 dump 文件名误导、无原始 UI dump 文件。按 brief「不能只看代码」的标准，按钮宽度一项**未闭环**（代码修复本身成立、风险低，建议补证而非返工） |
| P2 | 提示 | `series_card_width` 键名误导（实为高度），dsh 已记技术债；U2 又大幅上调其值，建议尽快更名 `series_card_height` |
| P3 | 提示 | U2 报告小瑕疵：进度条高度「由 5px 增至 6px/8px」的口径与基准 3dp→4dp 对不齐（4dp@240dpi=6px 成立，「5px」起点存疑）；设备 API 33 与既有记录 32 不一致 |
| P4 | 提示 | 证据文件命名规范缺失：`outputs/debug/u1-fav.xml`、`u1-favorites-empty.png` 名不副实（实为播放页），易误导后续审查者 |

## 四、改进建议

1. **补 U1 闭环证据**：antigravity 或 dsh 用两步截图法重截收藏页空态 + `uiautomator dump` 落盘到 `.agents/shared/`，命名带页面与时间戳（如 `u1-favorites-empty-001437.xml`）。
2. `series_card_width` → `series_card_height` 更名（三档 + 单处引用同步）。
3. 建立「运行时证据三件套」约定：截图（两步法）+ dump 文件（落盘）+ 命令原文进报告，三者缺一即视为未验证。
4. U2 报告修正设备元数据（API 等级以 `adb shell getprop ro.build.version.sdk` 实测为准）。

## 五、总体结论

**U1 / U2 / U4 可以接受。**

- **收藏页按钮是否修好**：代码级已修好（WRAP_CONTENT 后无拉伸可能），但按「看渲染不看代码」的标准，渲染证据链不完整（P1）——建议补一个 dump 闭环，不返工。
- **双模式是否归零**：**是，真实归零**（三种口径 0，仅剩受许可的 helper 定义）。第二轮把 T1 遗留的最后两种硬编码形式清零。
- **进度条修复根因是否真实**：**是**——先诊断（低对比 + 过小 + 无间距）后修复（tint + 高度 + 边距 + 卡片加高），代码、回归逻辑、前后截图三重印证。
- 构建链（30 测试 / lint / APK）由本机独立复跑通过，APK 覆盖当前源码，改动全部在授权范围内。

## 附：本机审查命令留档

```powershell
# 双模式扫描（三种口径）
grep -rnE "dp\([0-9]+\)" apps/tv-android/app/src/main/java/            # 0
grep -rnE "TvUi\.dp\([^)]*,[[:space:]]*[0-9]+\)" apps/tv-android/app/src/main/java/  # 0
grep -rn "\.dp\(" apps/tv-android/app/src/main/java/                   # 仅 MainActivity.kt:156
# 三档解析（node 脚本）：105 键、三档键集合一致、monotonic 105/105
# 修复点：CatalogScreenView.kt:92；SeriesAdapter.kt:42-46/88-100/109；CategoryTagLayout.kt:9
# 回归逻辑：SeriesAdapter onBindViewHolder value==null -> GONE
# 构建链
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug     # SUCCESSFUL；XML 30/0/0
# 证据核验：xxd 签名（u1 PNG=fefd 损坏；u2×2/u4=8950 有效）；node 解码 FFFD 占比 37.7%
# 时间线：stat mtime（源码最大 22:55:51 < APK 22:57:05）
```
