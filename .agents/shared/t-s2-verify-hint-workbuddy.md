# S2 TV 端切剧轻量提示 — 独立复核报告

**任务 ID**: `t-s2-verify-hint`
**复核人**: workbuddy（独立复核方，只读）
**复核对象**: S1（`t-s1-switch-hint`，执行人 antigravity，状态 done）
**复核时间**: 2026-10-14 20:40 – 21:35
**依赖**: `t-s1-switch-hint` 已完成（`cli.mjs list` 确认 done）

---

## 〇、总体结论（先行）

| 复核项 | 结论 | 依据强度 |
| --- | --- | --- |
| 1. 切剧时只显示轻量提示 | **✅ 通过** | 实测截图 + 像素级量化 + 代码 |
| 2. 自动下一集只显示轻量提示 | **✅ 功能通过（视觉证据有瑕疵）** | 功能实测（集数连续自动前进）；S1 截图存在 progressBox 共存异常（见 §四-1） |
| 3. **按 MENU 仍能唤出完整 chrome（重点）** | **✅ 通过，无回归** | 实测截图（全 chrome 完整呈现）+ revealChrome 逐字节零改动 |
| 4. 加载失败回到完整 chrome | **⚠️ 仅代码级验证** | 代码路径确认；实测因模拟器 adb 桥接崩溃未能完成（见 §六） |
| 5. 动画在隐藏后停止 | **✅ 代码级通过** | hide() 与 onDetachedFromWindow() 双路径 cancel |
| 3.1 越界改动 | **✅ 无** | git status 仅授权文件 |
| 3.2 revealChrome() 被误改 | **✅ 未被修改** | 与 HEAD 逐字节一致 |
| 3.3 主动操作不显示轻量提示 | **✅ 代码级通过** | 12 个 loadEpisode 调用点逐一核对 |

**S1 实现整体正确，无阻断性问题。** 发现 1 个可复现的 UX 边缘问题（切换期间按左右键闪现进度条并对加载中的新集执行 seek）与 1 个 S1 证据链瑕疵（自动下一集截图的 progressBox 共存），均建议列入后续优化而非阻断。

---

## 一、代码范围与 revealChrome 完整性核查（§3.1 / §3.2）

### 1.1 工作区改动清单（`git status --short`）

```
 M apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt      ← 授权
 M apps/tv-android/app/src/main/res/values/dimens.xml                      ← 授权
 M apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml              ← 授权
 M apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml              ← 授权
?? apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/SwitchHintView.kt ← 授权（新建）
?? .agents/...（S1 证据与总线文件）
```

**结论：无越界改动**。`apps/web-pc/`、`shared/`、`custom-server/` 等均未被触碰（用户明确「只针对 TV 端修改」）。

### 1.2 revealChrome() 逐字节比对（重点回归防护）

用 Python brace-match 从 HEAD 与当前版本分别提取 `revealChrome` / `hideChromeNow` 函数体做全等比较：

```
revealChrome : IDENTICAL to HEAD
hideChromeNow : IDENTICAL to HEAD
```

diff 中 `revealChrome` 字样出现 9 次，逐一核对均为**调用点语境**（`loadEpisode` 分支、`playbackError`、`feedError`、`onKeyDown` MENU 分支等），函数体零改动。**9 个调用点的行为完全不受影响**，MENU 回归风险在代码层已排除。

### 1.3 dimens 三档完整性

| 键 | values | sw600dp | w1280dp | 单调 |
| --- | --- | --- | --- | --- |
| switch_hint_pad_h | 20dp | 24dp | 28dp | ✅ |
| switch_hint_pad_v | 12dp | 14dp | 16dp | ✅ |
| switch_hint_margin_bottom | 48dp | 56dp | 64dp | ✅ |
| switch_hint_min_width | 240dp | 270dp | 300dp | ✅ |
| switch_hint_badge_pad_h | 8dp | 9dp | 10dp | ✅ |
| switch_hint_badge_pad_v | 2dp | 2dp | 3dp | ✅ |

6 键三档齐全、梯度单调，与 T4 确立的资源化规范一致。

---

## 二、静态核查：SwitchHintView 与调用点（§五 / §3.3）

### 2.1 SwitchHintView.kt（新建文件，150 行）

| 检查点 | 行号 | 结果 |
| --- | --- | --- |
| 不抢焦点 | 29-30 | `isFocusable = false`、`isClickable = false` ✅ |
| 初始隐藏 | 28 | `visibility = View.GONE` ✅ |
| 旋转动画 | 94-98 | ObjectAnimator 0→360°、1000ms、INFINITE、LinearInterpolator ✅ |
| show 启动动画 | 132-134 | `if (!rotateAnimator.isStarted) rotateAnimator.start()`（防重入）✅ |
| **hide 停止动画** | 139-141 | `if (isRunning \|\| isStarted) rotateAnimator.cancel()` ✅ |
| **detach 停止动画** | 144-149 | `onDetachedFromWindow()` 同样 cancel（双保险）✅ |
| 尺寸资源化 | 33-38 等 | 全部经 `TvUi.dimen(context, R.dimen.switch_hint_*)` ✅ |

### 2.2 loadEpisode 12 个调用点逐一核对

| 行 | 所属函数 | 场景 | showSwitchHint | 期望 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 311 | buildFeedOverlay（下一集按钮 onClick） | 用户点下一集 | false | ❌ | ✅ |
| 455 | buildEpisodeDrawer（选集点击） | 抽屉选集 | false | ❌ | ✅ |
| 566 | renderEpisodeDrawer | 抽屉渲染 | false | ❌ | ✅ |
| 592 | onStart | 恢复 | false | ❌ | ✅ |
| 776 | onPlayerError | 重试 | false | ❌ | ✅ |
| 845 | playbackError | 错误恢复 | false | ❌ | ✅ |
| **854** | **episodeEnded** | **自动下一集** | **true** | ✅ | ✅ |
| 964 | chooseQuality | 选画质 | false | ❌ | ✅ |
| 994 | returnToFeed | 返回首页 | false | ❌ | ✅ |
| **902** | **selectFeed** | **切剧首次加载** | **true** | ✅ | ✅ |
| 1277 | playDetailWithRecord | 进度恢复 | false | ❌ | ✅ |
| 1372 | back | 返回键恢复 | false | ❌ | ✅ |

**仅 2 处传 true，与 round6 规划的调用点表完全一致。**

### 2.3 关键路径代码确认

- `loadEpisode:803-808`：`showSwitchHint` 分支 = `hideChromeNow()` + `showSwitchHint(...)`（先隐藏 chrome 再出提示，顺序正确）
- `loadEpisode:829-831`：就绪回调中 `if (!showSwitchHint) revealChrome()`（轻量模式下不唤 chrome）✅
- `playbackError:838-839` / `feedError:941-943`：均先 `hideSwitchHint()` 再 `revealChrome()`（失败回到完整 chrome）✅
- `onKeyDown:1435-1442`（MENU 分支）：`hideSwitchHint()` + `revealChrome()` + 焦点落到合集按钮 ✅
- `onPlaybackStateChanged:758-760`：STATE_READY → `hideSwitchHint()`（就绪即隐）✅
- `onPlayerError:773`：错误即隐 ✅
- `showSwitchHint:411-425`：显式 `pauseIndicator.visibility = GONE` + 8s 超时兜底（`hideSwitchHintRunnable`）✅
- `onIsPlayingChanged:756` / `hideSeekHud:84`：新增 `isSwitching` 守卫，防止暂停指示器在切换期间弹出 ✅

---

## 三、实测验证（模拟器 emulator-5554，API 32，MuMu 12）

### 3.1 实测方法与过程

1. 基线：应用在前台播放《重生七零东北》第 48 集，沉浸模式无 chrome（`t-s2-verify-hint-baseline.png`）
2. **MENU 回归（重点项）**：按一次 MENU → 截图（`t-s2-verify-hint-s2menu-reveal.png`）
3. **切剧测试**：再按 MENU 收起 chrome → 按 DPAD DOWN → 截图（`t-s2-verify-hint-s2switch.png`）
4. **自动下一集测试**：等待新剧《偏要偷偷尝半口甜》加载播放后，以 DPAD RIGHT（+10s/次）seek 至片尾触发自动下一集，0.2-0.3s 间隔连拍 20+25 帧（40+ 帧全部分析）
5. **进度追踪**：多次 MENU 唤出 chrome 读取时间与集数（`t-s2-verify-hint-s2pos*.png`）

### 3.2 MENU 回归实测结果（重点项结论）

**`t-s2-verify-hint-s2menu-reveal.png`：按 MENU 完整唤出全套 chrome**：
- 顶部导航 7 标签：红果短剧 logo + 推荐/搜索/分类/榜单/追剧/历史/设置
- 第 48 集徽章
- 剧集信息区：标题、集数、标签行（#短剧 #种田 #重生 #年代 #乡村）、简介
- 底部操作栏 6 按钮：暂停播放 / 下一集 / 合集（红色高亮）/ 追剧 / 1.0x / 1080P 超清
- 进度条：01:27 / 02:06，红色填充约 22%

**判定：MENU 回归项通过，无任何功能损失。** 该截图与 S1 的 `t-s1-menu.png` 形态一致（均为另一部剧《绿意萌熹》，系各自测试会话不同，属正常）。

### 3.3 切剧实测结果

**`t-s2-verify-hint-s2switch.png`：DPAD DOWN 切剧瞬间**：
- 轻量 HUD 完整呈现：`@偏要偷偷尝半口甜` + `全80集` 红色徽章 + `内容加载中...` + `◜` 旋转动画 + `精彩内容加载中...`
- 无顶部导航、无操作栏、无进度条
- 旧视频帧保留作背景（过渡态）

### 3.4 自动下一集实测结果

**功能层面确认通过**：连续实测到集数自动前进——
- 《偏要偷偷尝半口甜》：第 1 集 → 第 2 集 → 第 3 集 → 第 4 集（`s2pos2/3/5/back` 截图序列）
- 《重生七零东北》：第 49 集 → 第 51 集（`s2pos3/4` 截图序列）
- 跨剧衔接正常：《重生七零东北》播至末个加载集后按 EndAction 设计自动切至下一部剧并恢复上次观看位置（`s2pos5` 显示回到《偏要偷偷尝半口甜》第 3 集 02:27，与之前 seek 位置精确吻合）

**视觉层面**：40+ 帧连拍（0.2-0.3s 间隔）**未能捕获到 HUD 画面**——HUD 窗口（STATE_ENDED → STATE_READY，取决于网络约 1-3s）与我的采样时刻多次错开。该场景的视觉证据依赖 S1 的 `t-s1-auto-next.png`（形态正确但存在 §四-1 的瑕疵）。

### 3.5 截图像素级量化对比（关键证据）

对 5 张截图做结构化像素扫描（timeText 白字区域 y678-692 / 进度轨道 y702-706 / 顶部导航 y28 / 操作栏 y667）：

| 截图 | timeText像素 | 进度轨道 | 顶部导航 | 操作栏 | chrome 判定 |
| --- | --- | --- | --- | --- | --- |
| 我的切剧（有HUD） | **0** | 31 | 47* | 11* | **仅 HUD，无 chrome** ✅ |
| S1 切剧（有HUD） | **0** | 0 | 0 | 0 | **仅 HUD，无 chrome** ✅ |
| S1 自动下一集 | **162** | **76/76** | 47* | 0 | **progressBox 泄漏** ⚠️ |
| S1 MENU（全chrome） | 162 | 53 | 37 | 34 | 全 chrome ✅ |
| 我的 MENU（全chrome） | 148 | 23 | 24 | 35 | 全 chrome ✅ |

\* 为旧视频帧亮度噪声（切剧过渡期背景视频本身的亮部），非 UI 元素——决定性指标 timeText（白色等宽数字， unambiguous）为 0。

**关键发现**：S1 自动下一集截图的 timeText 像素数（162）与两张全 chrome 截图完全同级，进度轨道 76/76 满采样——**该截图中 progressBox（时间文字 + 全宽进度条）确实完整可见**，而两张切剧截图均为 0。此异常与代码路径矛盾，机制分析见 §四-1。

---

## 四、发现的问题与观察

### 4.1 ⚠️ S1 自动下一集截图的 progressBox 共存异常（证据链问题）

**现象**：`t-s1-auto-next.png` 中，轻量 HUD（@剧名 + 全90集 + 第 3 集 + 动画）与底部 progressBox（`01:10 / 00:00` + 全宽进度轨道）同时可见。

**代码事实**：
- `loadEpisode:803-808`（showSwitchHint 分支）先执行 `hideChromeNow()`——其中 `progressBox.visibility = View.GONE`（第 656 行）——再 `showSwitchHint()`。HUD 可见的瞬间 progressBox 必为 GONE。
- `timeText`/`progressBar` 均为 progressBox 子视图（PlayerOverlay.kt:270/277），父隐藏则不可见。
- `selectFeed:894-897` 同样先 hideChromeNow 后 showSwitchHint。
- **HUD 显示后唯一能重新点亮 progressBox 的路径是 DPAD LEFT/RIGHT 的 seek 处理器**（`onKeyDown:1489-1490`：`progressBox.visibility = View.VISIBLE` + `scrimBottomView` + `hideProgressBox` 延迟 1500ms；其 `hideSeekHud` 仅延迟 1200ms）。

**机制推断（高置信）**：该截图系测试以 DPAD 左右键 seek 至片尾触发自动下一集后，在切换提示窗口内**再次按下方向键**（或 seek 事件处理晚于 ENDED 回调）所摄——seek 使 progressBox 重新可见；拍摄时刻恰在 hideSeekHud（1200ms）之后、hideProgressBox（1500ms）之前，故画面无中央 seekHud 而底部进度条仍在。`01:10 / 00:00`（position=70s、duration=0）与「对 BUFFERING 中的新集执行 seekTo(70s)（约 7 次 +10s 累加）」精确吻合。

**影响评估**：
1. **可复现的 UX 边缘**：切换提示期间按左右键会①闪现进度条与 seekHud（破坏「轻量」沉浸感）；②对加载中的新集执行 seek（+10s/次，7 次累加即 +70s），可能使新集跳过片头。seek 处理器当前仅判断 `feedOverlay.visibility != VISIBLE`，未考虑切换态。
2. 该截图的「状态真实性」存疑——它记录的不是纯净的自动下一集瞬间，而是「自动下一集 + 期间 seek」的复合态。作为验收证据应重拍。

**建议**（不阻断 S1）：
- 代码：seek 处理器增加 `isSwitching` 守卫（与 onIsPlayingChanged 同款模式），切换期间屏蔽 seek 或至少不点亮 progressBox；
- 证据：antigravity 用两步法重拍一张纯净的自动下一集截图（seek 至片尾后**不再按键**，0.3s 间隔连拍捕捉）。

### 4.2 观察：我的切剧截图与 S1 切剧截图的背景差异

S1 的 `t-s1-switch-drama.png` 为纯黑背景（切剧前可能已停在一黑帧或截图时机在 hideChromeNow 之后、视频帧已清），我的 `t-s2-verify-hint-s2switch.png` 保留旧视频帧作背景。两者 chrome 隐藏行为一致（timeText=0、轨道=0/31 噪声级），均为正确的轻量态。差异仅源于过渡时序，非缺陷。

### 4.3 观察：跨剧自动衔接的边界

实测中《重生七零东北》播至「API 返回的最后一个加载集」后，按 `episodeEnded:855` 的 `else if (feedMode) switchFeed(1)` 设计切至下一部剧并恢复上次位置。该行为符合 round6 规划的 EndAction 语义（非 S1 引入），记录备查。

---

## 五、构建、lint 与测试复跑

| 命令 | 结果 |
| --- | --- |
| `gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest` | **BUILD SUCCESSFUL**（60 actionable tasks，16 executed / 44 up-to-date） |
| lint 报告 | 全部为既有 warning（ApplySharedPref×2、UnusedAttribute×8、GradleDependency×1、DataExtractionRules×1、UnusedResources×3 均为 `common_*` 旧 dimens、KTX×22 等）；**无 S1 新增问题**，SwitchHintView 零告警 |
| `npm test`（Node 全量） | **93/93 pass**（基线 75 + 各轮累计，全绿） |

---

## 六、无法核实项（如实声明）

| 项目 | 原因 | 已有证据 |
| --- | --- | --- |
| 4. 加载失败回到完整 chrome **实测** | 模拟器 adb 桥接在测试后期（约 21:00）崩溃，多次 `reconnect`/轮询/长等待（累计 ~15 分钟）未能稳定恢复；断网构造加载失败的方案无法执行 | **代码级**：playbackError/feedError 均 `hideSwitchHint()` + `revealChrome()`（838-839 / 941-943 行），onPlayerError 先 hideSwitchHint（773 行） |
| 2. 自动下一集 HUD **实测画面** | 同上（40+ 帧连拍均未命中 1-3s 的 HUD 窗口） | 功能实测（集数连续自动前进）+ S1 截图（形态正确但有 §4.1 瑕疵） |
| 5. 动画运行时停止 | 未做运行时验证 | **代码级**：hide() 与 onDetachedFromWindow() 双路径 cancel（139-141 / 144-149 行） |

模拟器 adb 状态说明：`adb devices` 显示 offline 时 `adb shell echo` 偶发可用（连接间歇性抖动），但无法支撑需要数十秒稳定连接的截图序列测试。此为环境问题，非产品缺陷；建议协调者知悉，如需补测可在模拟器恢复后按 §4.1 建议清单执行。

---

## 七、复核结论

1. **「切剧时是否只显示轻量提示」——是**。实测截图 + 像素量化（timeText=0、无操作栏）+ 代码三重确认。
2. **「按 MENU 是否仍能唤出完整 chrome」（重点回归项）——是，无回归**。实测完整 chrome 呈现；revealChrome() 与 HEAD 逐字节一致，9 个调用点行为不变。
3. **越界改动——无**。改动严格限定在授权文件（MainActivity.kt / SwitchHintView.kt / 三档 dimens.xml）。
4. S1 的 `revealChrome()` 未被误改、调用点参数控制精确、动画生命周期与焦点处理均正确、构建/lint/测试全绿。
5. 遗留建议（不阻断）：① seek 处理器增加切换态守卫（§4.1）；② 重拍纯净的自动下一集证据截图（§4.1）；③ 加载失败实测待模拟器恢复后补做（§六）。

**证据文件**（均在 `.agents/shared/`）：
- `t-s2-verify-hint-s2menu-reveal.png` — MENU 唤出完整 chrome（实测）
- `t-s2-verify-hint-s2switch.png` — 切剧轻量提示（实测）
- `t-s2-verify-hint-baseline.png` — 复核前基线（沉浸播放）
- `t-s2-verify-hint-s2pos*.png`、`t-s2-verify-hint-s2back.png`、`t-s2-verify-hint-s2loaded.png` — 自动下一集过程追踪
- `t-s2-verify-hint-autonext-bottom.png`、`t-s2-verify-hint-menu-bottom.png`、`t-s2-verify-hint-an3-stack.png` — 像素级量化分析图（20 帧连拍底部拼接）
