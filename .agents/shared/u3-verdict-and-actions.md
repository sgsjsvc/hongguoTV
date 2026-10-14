# U3 复核结论与协调者处置

**协调者**: dsh
**时间**: 2026-10-14 00:35
**U3 报告**: `.agents/shared/t-u3-verify-workbuddy.md`

---

## 一、U3 复核结论：U1 / U2 / U4 **可以接受**

### 已核实事实（U3 独立验证）

| 核查项 | U3 结论 | 我的复核 |
| --- | --- | --- |
| 双模式扫描归零 | ✅ 三种口径全为 0 | ✅ 确认 |
| 三档 dimens 齐全有梯度 | ✅ 105 键，单调 105/105 | ✅ 确认 |
| U2 进度条根因真实 | ✅ 先诊断后修复，对症 | ✅ 确认 |
| `series_card_width` 键名误导 | ✅ 确认（实为高度参数） | ✅ 确认 |
| APK 覆盖当前源码 | ✅ 源码 22:55:51 < APK 22:57:05 | ✅ 确认 |
| 构建链 | ✅ 30 测试 0 失败 | ✅ 确认 |
| U1 截图损坏 | ✅ 独立确认（UTF-16LE，37.7% U+FFFD） | ✅ 确认 |

### U3 的三条关键判断

1. **双模式是否归零 → 是，真实归零**（三种口径 0，仅剩受许可的 helper 定义）
2. **进度条修复根因是否真实 → 是**（代码、回归逻辑、前后截图三重印证）
3. **收藏页按钮是否修好 → 代码级已修好，但渲染证据链不完整**

---

## 二、U3 发现的问题（含对我的批评）

### P1（中）U1 渲染证据链断裂 —— **协调者的责任**

U3 指出：`.agents/shared/u1-empty-favorites.png` 损坏；`outputs/debug/u1-fav.xml` 与 `u1-favorites-empty.png` **文件名误导，内容实为播放页**。

**核实结果：属实，且是我造成的。**

我用 `uiautomator dump` 抓到的 `u1-fav.xml` 内容含：

```
com.hongguotv.tv:id/exo_content_frame
com.hongguotv.tv:id/exo_subtitles
text="播放已暂停"
```

**确为播放页**，因我遥控器导航失败而误存为「收藏页」证据。

**已处置**：删除全部误导性文件。

```
已删除 outputs/debug/u1-fav.xml
已删除 outputs/debug/u1-favorites-empty.png
已删除 outputs/debug/u1-nav-check.png
已删除 outputs/debug/u1-focus-top.png
已删除 outputs/debug/u1-before-enter.png
已删除 outputs/debug/u1-verify.png
```

### P2（提示）`series_card_width` 键名误导

U3 确认该键全项目仅一处使用（`SeriesAdapter.kt:44` 的高度位）。U2 又将其值从 245/295/345 上调至 275/330/385，偏差继续存在。

**建议**：更名 `series_card_height`。

### P3（提示）U2 报告设备元数据错误

U2/U4 报告称模拟器为 **API 33**，实际为 **API 32**。

**我已实测确认**：

```
adb -s emulator-5554 shell getprop ro.build.version.sdk  → 32
adb -s emulator-5554 shell getprop ro.build.version.release → 12
```

**属实**。报告中的「API 33」是错误信息。

### P4（提示）证据文件命名规范缺失

同 P1，文件名与内容不符。

---

## 三、协调者的独立复现（新增证据）

### 3.1 有效的导航方法（供后续任务复用）

经多轮试错，找到**唯一可靠**的 chrome 唤出方式：

```powershell
# 冷启动后，按一次 DOWN（不要用 MENU）
adb -s emulator-5554 shell am force-stop com.hongguotv.tv
adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
Start-Sleep -Seconds 20
adb -s emulator-5554 shell input keyevent 20     # ← 关键：DOWN 唤出 chrome
```

**实测结果**：dump 成功返回 22 个节点，含完整坐标：

```
顶部导航（y≈9-54）：
  推荐 [207,9][339,54]    搜索 [345,9][477,54]
  分类 [483,9][615,54]    榜单 [621,9][753,54]
  追剧 [759,9][891,54]    历史 [897,9][1029,54]
  设置 [1121,9][1253,54]

操作栏（y≈630-675）：
  暂停播放 [27,630][159,675]      下一集 [170,630][302,675]
  合集 [313,630][777,675]         ♥ 追剧 [788,630][920,675]
  1.0x [931,630][1063,675]        1080P [1074,630][1206,675]
```

**注意**：`input tap` **无效** —— 触摸事件被播放器吞掉（仅切换播放/暂停），TV 应用需用 DPAD 导航。

### 3.2 遥控器焦点管理不稳定（新问题）

| 操作 | 结果 |
| --- | --- |
| MENU 唤出 chrome | ✅ 操作栏「合集」获焦 |
| 按 RIGHT ×2 | ❌ chrome 已自动隐藏，RIGHT 被解释为 **seek 快进**（显示 `▶▶ +20s`） |
| 连续 `DOWN`+`RIGHT`×4 | ❌ 焦点丢失，无高亮框 |
| `input tap` 点导航 | ❌ 被播放器吞掉 |
| 播放页 `uiautomator dump` | ❌ 仅返回根节点（元素在 SurfaceView 上） |

**判定**：这是**独立于 U1 的新问题**（记为技术债 D3）。chrome 自动隐藏后 DPAD 语义切换（焦点导航 → seek）会让用户困惑。

### 3.3 U1 证据为何难以闭环

上述两个因素叠加：chrome 会隐藏 + 触摸无效 + 播放页 dump 不可读。

**结论**：U3 判定「代码修复成立、风险低，建议补证而非返工」是合理的。补证需在**能稳定保持 chrome 的场景**下做（如先暂停播放）。

---

## 四、处置决定

### 已接受

- **U1 / U2 / U4 全部通过**（U3 结论 + 我的独立核实一致）

### 待补（不返工）

| 项 | 处置 |
| --- | --- |
| P1 U1 渲染证据闭环 | 派发 **U5**：用可靠方法补收藏页空态证据 |
| P2 键名误导 | 记技术债，可选更名 |
| P3 设备元数据 | 已在报告修正，后续 brief 要求以 `getprop` 实测为准 |
| P4 命名规范 | 纳入 U5 的交付要求 |
| 遥控器焦点不稳定 | 记技术债，待用户决定是否单独处理 |

---

## 五、技术债清单（累积）

| # | 项 | 来源 | 优先级 |
| --- | --- | --- | --- |
| D1 | `series_card_width` 键名误导（实为高度） | T4/U2/U3 | 低 |
| D2 | `values-w1280dp` 限定符导致 1080p 命中中间档 | T1 | 低（待用户决定） |
| D3 | 播放页遥控器焦点易丢失（chrome 隐藏后 RIGHT 变 seek） | dsh 本轮复现 | **中** |
| D4 | 3 个 dimens 键定义未引用 | T4 | 低 |
| D5 | U2 报告设备元数据错误（API 33 → 实为 32） | U3 | 低（已记录） |

---

## 六、验证纪律改进（采纳 U3 建议）

U3 建议建立「运行时证据三件套」约定。**采纳**，自 U5 起要求：

1. **截图**（两步法：`screencap` + `pull`，禁止 shell 重定向）
2. **dump 文件**（落盘到 `.agents/shared/`，非 `outputs/debug/`）
3. **命令原文**进报告

三者缺一即视为**未验证**。

**命名规范**：`<任务ID>-<页面>-<状态>-<时间戳>.<ext>`
例：`u5-favorites-empty-001437.xml`
