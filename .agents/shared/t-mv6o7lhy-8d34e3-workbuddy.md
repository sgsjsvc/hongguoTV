# T4 独立复核报告：TV UI 自适应改动（T1–T3）

- **复核方**：workbuddy（独立复核，只读，未修改任何代码）
- **时间**：2026-10-13 21:40（Asia/Shanghai）
- **对象**：t-mv6o7lhu-ec5f1b（T1 尺寸资源化）、t-mv6o7lhx-95ac7b（T2 布局重组）、t-mv6o7lhy-53c065（T3 测试与构建）
- **基线**：git 唯一提交 `ee6302e`（Initial source import），T1–T3 全部改动在工作区未提交，可用 `git diff HEAD` 逐项比对改前改后

---

## 一、核查项 1：三档 dimens 是否真的按屏幕尺寸生效 —— **是，真实生效**

【已核实】用脚本解析三份 dimens.xml 并逐键比对（非目测）：

| 档位 | 键数 | min | max | 均值 |
| --- | --- | --- | --- | --- |
| `values`（基准） | 97 | 1dp | 245dp | 23.9dp |
| `values-sw600dp` | 97 | 2dp | 295dp | 28.9dp |
| `values-w1280dp` | 97 | 2dp | 345dp | 33.7dp |

- **键集合三方完全一致**（97/97，无缺无余）——T3 的一致性测试声称属实。
- **取值真实分层**：94/97 键三档并非全同；97/97 满足 `base ≤ sw600dp ≤ w1280dp` 单调不减，梯度约 1.2x / 1.4x。抽样：`scrim_top_height` 64/80/96dp，`header_height` 42/50/58dp，`series_card_width` 245/295/345dp。
- 仅 3 键三档同值：`hero_desc_line_spacing`、`episode_drawer_detail_btn_pad_v`、`episode_group_btn_pad_v`（均 2dp 微间距）——合理，不算造假。
- 引用完整：代码引用 `R.dimen.*` 共 94 键，**0 个引用但未定义**；3 个定义未引用（`common_button_min_height`、`common_pill_button_min_height`、`common_circle_button_size`，无害冗余）。
- 限定符命中证据：`outputs/debug/` 中 emu-720p-chrome.png（1280×720）、emu-1080p.png（1920×1080）、emu-4k.png（3840×2160）三张截图存在且可读，元素尺寸随档位明显放大（4K 下导航 pill 与按钮的屏占比显著高于 720p）；emu-720p.xml 的根节点 bounds=[0,0][1280,720] 佐证 720p 会话。

**限定符设计的保留意见（见问题 P2）**：`w1280dp` 只有 ≥1280dp 宽度才命中。模拟器实测 1080p 报 `sw720dp`（命中 sw600dp 档），但真实 1080p 电视通常为 320dpi（宽 960dp × 高 540dp → sw540dp），会落**基准档**而非中间档；详见「无法核实项 1」。

## 二、核查项 2：硬编码 dp 字面量残留 —— **基本归零，但有 3 处漏网**

【已核实】

- 全 `app/src/main/java/` 下 `dp(数字)` 模式：**0 处**。
- `MainActivity.kt` 仅存 1 处 `dp(` = 第 156 行 helper 定义 `private fun dp(value: Int) = TvUi.dp(this, value)`（T1 明确保留，合理）。
- **两方报告均漏计的形式**：`SeriesAdapter.kt` 仍有 **3 处** `TvUi.dp(context, N)` 字面量调用——第 75、80、109 行（padding 4/6/2、cornerRadius 6）。T1/T2/dsh 的扫描模式是 `dp(数字)`，匹配不到 `TvUi.dp(context, 4)` 这种形式，因此「归零」结论略失真（见问题 P1）。
- `TvUi.kt` 新增 `dimen(context, @DimenRes id)`（第 30 行）+ DimenRes import，diff 仅 +3 行；`dp()` 保留。

## 三、核查项 3：功能回归 —— **未发现回归；一处疑点经排查为迁移**

基线对比方法：`git show HEAD:...MainActivity.kt` vs 工作区。

【已核实】

1. **函数集合零丢失**：HEAD MainActivity 的全部函数名在当前代码（MainActivity + ui/）中均存在（`comm -23` 为空）。
2. **键码集合零丢失**：`KEYCODE_*` 全集 diff 为空——DPAD_*、ENTER、SPACE、MENU、MEDIA_PLAY_PAUSE、BACK 覆盖与改前一致（与规划中「本轮不补按键」的范围声明相符）。
3. **onKeyDown 逐字节一致**：提取 HEAD 1691–1825 行与当前 1265–1399 行 diff 为空。含暂停/播放切换、MENU 显隐、1200ms seek 累加窗、HUD 刷新、DPAD_UP/DOWN 切剧等全部行为。`dispatchKeyEvent`（BACK→`back()`）亦一致。
4. **抽屉 / HUD / 分组 Tab 行为保留**：
   - `EpisodeDrawerView.kt`：分组数学 `(n+49)/50`、标签 `"start—end"`、字符串「选集列表」「查看详情 >」「选集 · 《..》（全N集）」、`pillBackground` 选中态、焦点缩放 1.06x、详情/选集回调 —— 与 HEAD 内联版逐项对应；滚动居中 `episodeDrawer.smoothScrollTo(btn.left - dimen(R.dimen.episode_drawer_scroll_offset), 0)`（MainActivity:403）。
   - `CenterHudBuilder.kt`：暂停指示（「播放已暂停」「按遥控器确认键继续播放」、❚❚ 红圆标）、Seek HUD（「▶▶ +10s」、时间等宽字体、同色值）—— 与 HEAD 一致。
   - 生命周期函数在位：`showEpisodeDrawer`(392)、`hideEpisodeDrawer`(408)、`hideChromeNow`(569)、`revealChrome`(586)、`back`(1223)。
5. **疑点排查**：MainActivity diff 中操作栏六按钮的显式左右焦点链看似被删 —— 实际已迁移至 `PlayerOverlay.kt:224-245`，映射与 HEAD 逐项一致（play↔next↔collection↔fav↔speed↔quality，quality 右向=self；`nextFocusDown/UpId` 对导航栏的关联保留在 MainActivity:332-334）。
6. **拆分方式健康**：MainActivity 1835→1409 行（-426/-23%），`ui/` 8 文件共 1176 行；模式统一为「构造委托 + 字段回填」，无逻辑重写迹象。非 dp/dimen 的 diff 行经全部过滤审查，剩余均为委托 wiring。

【无法核实】焦点流转的**实际遥控器走查**无机器可复现证据，只有代码级一致（见「无法核实项 2」）。

## 四、构建 / 测试 / 产物独立复跑

【已核实，均为本机亲自执行】

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `./gradlew :app:testDebugUnitTest` | BUILD SUCCESSFUL；解析 `TEST-*.xml`：8 套件 **30 项，failures=0 errors=0 skipped=0**（T3 报告「30 项通过」属实，原 19 项基线未减） |
| Lint | `./gradlew :app:lintDebug` | BUILD SUCCESSFUL（analyze 步骤因源码未变命中缓存，report 任务重新执行成功） |
| APK | `app/build/outputs/apk/debug/app-debug.apk` | 8,827,443 字节（与 T3 报告一致），构建于 21:17:59；`find src -newer APK` 仅测试源码较新，主源码全部早于 APK → **APK 覆盖当前主源码** |

## 五、发现的问题

| # | 级别 | 问题 | 证据 |
| --- | --- | --- | --- |
| P1 | 中 | `SeriesAdapter.kt` 3 处 `TvUi.dp(context, N)` 字面量残留，验收标准「硬编码归零」严格讲未 100% 达成；T1/T2 报告与 dsh T1 验收的扫描模式存在盲区 | SeriesAdapter.kt:75/80/109 |
| P2 | 中 | 限定符分档与真实电视密度错配：`w1280dp` 仅 4K 命中；真实 1080p@320dpi（960×540dp → sw540dp）落**基准档**而非中间档，1080p 实机可能拿到偏小 UI。dsh T1 遗留 P1 同源 | Android 密度换算分析（推测，见下）；dumpsys 证据仅覆盖模拟器 |
| P3 | 低 | T3 测试保护力弱：① `dimensXmlConsistencyAcrossTiers` 只断言键集合相等，**三档数值全同也能通过**；② 分组/网格/时间三个测试在测试内重新实现算法，未调用生产代码，生产实现回归抓不到 | TvUiLayoutTest.kt:21-56, 59-93 |
| P4 | 提示 | APK 内打包的 `shared/content-core/hongguo.js` 是 Codex 未提交的播放修复版本（`build.gradle.kts:29` 直接打工作区文件）。对 UI 复核无影响，但该 APK 不是「纯 T1–T3」快照，验收 APK 时需知悉 | git status（4 文件 M 状态早于 T1 即存在，我的 20:29 首查为证） |
| P5 | 提示 | 3 个定义未引用的冗余 dimens 键 | `common_button_min_height` 等 |

## 六、无法核实项（需设备或运行环境）

1. **真实电视密度下的档位命中**（P2 的硬件侧确认）：无 320dpi 真机/模拟器配置的 dumpsys 证据；dsh 的模拟器 1080p 报 sw720dp（tvdpi 口径），不能外推到真机。
2. **非 feed 页面的多分辨率渲染**：选集抽屉、Seek HUD、详情页、设置页、搜索页在 720p/1080p/4K 下的实际布局无截图无 dump —— 现有截图只覆盖播放 feed 界面（含播放中/加载中两种状态）。
3. **焦点流转实测**：DPAD 在按钮/抽屉间走查无机器证据，仅代码一致。
4. 4K 截图对应会话为加载态（00:00/00:00），元素缩放可见但播放态未复现。

## 七、改进建议（不阻塞 T5，供后续轮次）

1. SeriesAdapter 3 处字面量入资源（可复用 `episode_*` 或新增 `series_badge_*` 档），并统一扫描模式为 `TvUi\.dp|dp\(数字` 双模式。
2. 限定符策略改为按宽度档覆盖真实电视密度（如补 `values-sw540dp` 或将 w1280dp 改名为 w960dp），在按真实 density 配置的模拟器/真机上复验命中。
3. 测试补强：① 增加三档单调性 + 「至少 90% 键三档互异」断言；② 将分组/网格数学提取为生产侧可测函数并直接调用，去掉测试内重实现。
4. 补抽屉/HUD/详情/设置在 1080p、4K 的截图与 dump，关闭「仅 feed 有多分辨率证据」的缺口。

## 八、总体结论

**「自适应是否真实生效」——是，真实生效，且强于「三份复制粘贴」**：三档键集合一致、数值单调分层（97/97，均值 23.9/28.9/33.7dp）、引用完整无悬空、APK 覆盖当前源码、测试 30/30 与 lint 由本机独立复跑通过、三张分辨率截图显示元素随档位缩放。**T2 拆分未发现功能回归**（函数/键码集合零丢失、onKeyDown 逐字节一致、抽屉/HUD/分组 Tab/焦点链行为逐项对应）。**T3 的测试与构建声称属实**（30 项、APK 字节数可对上）。

两个诚实的限定：① 真实 1080p@320dpi 电视的档位命中未在硬件验证（P2，可能落基准档）；② 非 feed 页面无多分辨率证据。建议：**T1–T3 可以接受**，P1–P4 记录在案供后续处理，不阻塞 T5。

## 附：本机审查命令留档

```powershell
# 三档比对与引用完整（node 脚本解析 XML + 遍历 java/）
node -e "..."  # 输出：97 键/档、mono 97/97、used 94 / missing 0 / unused 3
# 基线残留
git show HEAD:...MainActivity.kt | grep -c "dp("            # 87 行含 dp(
git show HEAD:...MainActivity.kt | grep -oE "dp\([0-9]" | wc -l   # 181（HEAD 口径）
grep -roE "dp\([0-9]" apps/tv-android/app/src/main/java/ | wc -l  # 0（当前）
grep -n "dp(" MainActivity.kt SeriesAdapter.kt               # 1 处 helper / 3 处 TvUi.dp
# 回归比对
git show HEAD:...MainActivity.kt | sed -n '1691,1825p' > a; sed -n '1265,1399p' MainActivity.kt > b; diff a b   # 空
comm -23 head_funs.txt cur_funs.txt                          # 空（函数零丢失）
diff head_keys.txt cur_keys.txt                              # 空（键码零丢失）
# 复跑
./gradlew :app:testDebugUnitTest   # SUCCESSFUL，XML 统计 30/0/0/0
./gradlew :app:lintDebug           # SUCCESSFUL
sha256sum app-debug.apk            # 24f41814…，8,827,443 B，21:17:59
```
