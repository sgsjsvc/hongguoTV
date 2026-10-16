# W6 W4/W5 全屏成果 — 独立复核报告（workbuddy）

- **任务 ID**: `t-w6-verify-fullscreen`
- **复核方**: workbuddy（独立复核，**未修改任何产品代码**）
- **日期**: 2026-10-16
- **复核对象**: W4（推荐流全屏，antigravity）+ W5（详情页全屏，codex）
- **方法**: 自建 Playwright 复现工程（`.agents/shared/t-w6-verify.cjs`）+ 自建竖版测试片 + 真实 GUI 断言
- **结论**: **通过（Pass）**，40/40 项检查全部通过；无阻断问题

---

## 一、结论速览

| # | 核查项 | 结论 | 关键证据 |
| --- | --- | --- | --- |
| 1 | 推荐流右上角有全屏按钮 | ✅ 已核实 | `W4-1` count=1，截图 `t-w6-recommend-web-before.png` |
| 2 | 点击可进入全屏 | ✅ 已核实 | `W4-2`（Web/Electron 均通过） |
| 3 | 全屏时控件不丢失 | ✅ 已核实 | `W4-3`：badge/speed/quality/collection/progress/exitBtn/arrows 全 true |
| 4 | 竖版视频居中（两侧黑边） | ✅ 已核实 | `W4-4`：内容 864×1536，左右黑边各 720px，`object-fit: contain` |
| 5 | 双击视频切换全屏 | ✅ 已核实 | `W4-6` |
| 6 | F 键切换全屏 | ✅ 已核实 | `W4-7` |
| 7 | 详情页全屏符合「图二」 | ✅ 已核实（结构对照） | 截图 `t-w6-detail-desktop-fullscreen.png` vs `ref-fig2-other-page-fullscreen.png` |
| 8 | 播放器填满屏幕 | ✅ 已核实 | `W5-5`：player = 2304×1536 @ (0,0)，`position: fixed` |
| 9 | W5 声称修复的缺陷（1104×621 → 2304×1536） | ✅ **独立复现** | `W5-3` 修前 1104×621/relative；`W5-5` 修后 2304×1536/fixed |
| 10 | 详情页无冗余悬浮按钮 | ✅ 已核实 | `W5-2`：全页仅 1 个全屏按钮（底栏） |
| 11 | 🔴 全屏下自动下一集 | ✅ 已核实（真实 ended） | `W4-9`/`W5-7`：ended=1，1001→1002，仍保持全屏 |
| 12 | 切换后仍保持全屏 | ✅ 已核实 | 同上 |
| 13 | 屏幕级全屏（innerWidth === screen.width） | ✅ 已核实 | `W5-6`：inner=screen=2304×1536 |
| 14 | 不是窗口最大化 | ✅ 已核实（见 §五 判据说明） | Web：`document.fullscreenElement` 非空；桌面：`outer === screen` |
| 15 | 两端效果一致 | ✅ 已核实 | 两端 player 均 = 屏幕尺寸，仅实现路径不同 |
| 16 | 桌面走桥接 | ✅ 已核实 | Electron 下 `document.fullscreenElement === null` 但窗口已满屏 |
| 17 | 浏览器回退 DOM API | ✅ 已核实 | Web 下 `fullscreenElement` = DIV |
| 18 | Escape 退出全屏不关闭播放器 | ✅ 已核实 | `W4-5`/`W5-8`：videoCount 仍为 1 |
| 19 | 全屏失败有提示 | ✅ 已核实 | `W4-10`/`W5-10`：出现失败 Toast |
| 20 | 反复切换 10 次稳定 | ✅ 已核实 | `W4-8`/`W5-9` |
| 21 | 详情页与推荐流互不影响 | ⚠️ **未单独验证**（见 §六） | 两者为独立组件、各自本地 state |
| 22 | 越界改动 | ✅ 无越界 | 见 §七 |
| 23 | 调试日志残留 | ✅ 无残留 | 改动文件 `console.log`/`debugger` 0 命中 |

---

## 二、复核方法（可复现）

### 2.1 为什么要自建工程而不是重跑 W5 脚本

W6 的硬性要求是**独立验证**。W5 交付的 `.agents/shared/w5-detail-check.cjs` 属被复核方产物，
直接重跑等于采信其断言设计。因此我自建了 `.agents/shared/t-w6-verify.cjs`：

| 差异点 | W5 脚本 | 本次 W6 脚本 |
| --- | --- | --- |
| 测试片 | 横版 640×360 | **自建竖版 360×640**（`outputs/w6-tests/fixture-vertical.mp4`，ffmpeg 生成） |
| 推荐流覆盖 | 仅测 header 显隐 | 10 项全屏行为（按钮/控件/黑边/双击/F/Escape/自动下一集/失败提示） |
| 全屏判据 | 只看 `parentElement.classList.contains('fixed')` | 三路判据：`document.fullscreenElement` / 最外层容器 `fixed` / 桌面 `inner+outer === screen` |
| 证据落盘 | `t-w5-*` | `t-w6-*-results.json` + `t-w6-*.png`（四套：web/desktop × recommend/detail） |

> 说明：为验证「竖版居中留黑边」这条 W4 声明，我**必须**用竖版测试片；
> W5 用的横版片在该项上是无效样本（`object-fit: contain` 下横版不会产生左右黑边）。

### 2.2 测试环境

- **Web**：Playwright + 本机 Chrome（`channel: chrome`, `--start-maximized`），
  按 W5 报告所述**关闭 Playwright 焦点模拟**（`Emulation.setFocusEmulationEnabled=false`），
  否则原生全屏会被抑制（[Playwright #19720](https://github.com/microsoft/playwright/issues/19720)）。
- **Electron**：`outputs/windows/win-unpacked/红果短剧.exe`（2026-10-16 11:24 打包，**已包含** W4/W5 修复提交 `a66a6c3`），
  CDP 连接 + 独立 userData。
- **数据隔离**：自建 fixture HTTP 服务（随机高位端口），提供 1 部剧 / 3 集 / 单档 1080P，
  视频流由 `fixture-vertical.mp4` 提供（支持 Range）。
- **屏幕**：2304×1536。

### 2.3 环境适配（非产品缺陷，仅测试侧）

| 现象 | 处置 |
| --- | --- |
| Electron 启动即崩：`GPU process isn't usable. Goodbye.` | 加 `--disable-gpu --disable-software-rasterizer --no-sandbox` 后正常（沙箱环境限制） |
| 用 `protocol.handle` 重定向 `hongguotv://` 后 assets 请求 `net::ERR_UNEXPECTED`，页面空白 | 改为 `page.goto(fixture origin)` 直接加载（preload 的 `window.hongguotvDesktop` 依然可用） |

---

## 三、W4 推荐流全屏（antigravity）

四套运行结果：**Web 10/10、Electron 10/10**。

### 3.1 全屏前后对照

- 全屏前：`t-w6-recommend-web-before.png`
- 全屏后：`t-w6-recommend-web-fullscreen.png`（Web）/ `t-w6-recommend-desktop-fullscreen.png`（Electron）

截图可见（已人工查看）：竖版画面居中、两侧大面积黑边；控件全部叠加在画面之上且无丢失 ——
左上「第 1 集」徽标、右上 `1x / 1080P / 滚轮↑↓键切剧 / 退出全屏`、右侧追剧与上下箭头、
左下剧名+标签+描述+合集+下一集、底部进度条。

### 3.2 控件完整性（脚本断言）

```json
{"badge":true,"speed":true,"quality":true,"collection":true,"progress":true,"exitBtn":true,"arrows":true}
```

### 3.3 竖版居中留黑边（竖版测试片）

```json
{"objectFit":"contain","contentW":864,"contentH":1536,"boxW":2304,"boxH":1536,"barLeft":720,"barRight":720}
```

即 360×640 竖版片在 2304×1536 屏上按比例缩放为 864×1536，左右各留 **720px** 黑边，且左右对称。

### 3.4 快捷键与手势

- 双击画面：`dblIn=true, dblOut=true`（进入/退出均生效）
- `F` 键：`fIn=true, fOut=true`
- 反复切换 10 次：稳定（无卡死、无状态错乱）

### 3.5 失败提示

将 `Element.prototype.requestFullscreen` 置为 reject 后点击全屏按钮 → 出现失败 Toast（`W4-10` 通过）。

---

## 四、W5 详情页全屏（codex）

四套运行结果：**Web 10/10、Electron 10/10**。

### 4.1 全屏前后几何（独立测量）

| 指标 | Web 全屏前 | Web 全屏后 | Electron 全屏前 | Electron 全屏后 |
| --- | --- | --- | --- | --- |
| player 尺寸 | **1104×621** | **2304×1536** | 721×405 | **2304×1536** |
| player 原点 | — | **(0,0)** | — | **(0,0)** |
| `position` | `relative` | **`fixed`** | `relative` | **`fixed`** |
| `innerWidth×innerHeight` | 2304×1536 | 2304×1536 | 1366×823 | 2304×1536 |
| `outerWidth×outerHeight` | 2304×1536 | 2290×1522 | 1366×823 | **2304×1536** |
| `document.fullscreenElement` | null | **DIV** | null | **null** |
| `window.hongguotvDesktop` | — | false | — | **true** |

**这张表同时独立复现了 W5 报告的核心声明**：修前 `1104×621 / relative`，修后 `2304×1536 / fixed`。
（W5 报告只给了 Electron 侧数值，本次在 **Web 侧也复现出同一组 1104×621**，互为独立佐证。）

### 4.2 与「图二」的对照

- 参考图：`.agents/shared/ref-fig2-other-page-fullscreen.png`
- 本次截图：`.agents/shared/t-w6-detail-desktop-fullscreen.png`

人工对照一致：左上「返回 / 标题 / 第 N 集 / 画质」、画面中心播放按钮、
底部「进度条 + 上一集 / 播放 / 下一集 / 倍速 / 画质 / 连播 / 音量 / 全屏」。
**判定方式为结构对照（人工查看），非像素级 diff** —— 见 §六 限制说明。

### 4.3 无冗余悬浮按钮

`W5-2` 结果：详情页全页仅 1 个全屏按钮，`aria-label="全屏"`、`title="全屏 (F)"`，位于底栏。
W4 报告声称已移除此前误加的右上角悬浮按钮 —— **已核实**。

---

## 五、屏幕级全屏（非窗口）判据说明

任务书给的判据是 `innerWidth === screen.width`，并提示「`outerWidth < screen.width` 说明是窗口而非屏幕」。
实测发现后半句**在 DOM 全屏下不成立**，需要修正：

| 环境 | `inner` | `outer` | `screen` | 判定 |
| --- | --- | --- | --- | --- |
| Web 全屏 | 2304×1536 | **2290×1522** | 2304×1536 | ✅ 屏幕级：`fullscreenElement` 非空 + `inner === screen` |
| Web 全屏前 | 2304×1536 | 2304×1536 | 2304×1536 | —（窗口本就最大化，但未进入全屏） |
| Electron 全屏 | 2304×1536 | **2304×1536** | 2304×1536 | ✅ 屏幕级：`outer === screen`（原生窗口全屏） |

**结论**：`outerWidth < screen.width` 是浏览器进入 DOM 全屏后隐藏窗口边框的正常表现，
**不能**据此判定为「窗口最大化」。可靠的判据是：
- Web：`document.fullscreenElement !== null` 且 `inner === screen`；
- Electron：`outer === screen`（`win.setFullScreen` 生效）且 `inner === screen`。

两者在本次实测中**都成立**，故「屏幕级全屏（非窗口）」结论为 **通过**。

---

## 六、🔴 全屏下自动下一集（用户核心要求）

### 验证方式（真实 ended，非手动 dispatch）

```js
v.currentTime = Math.max(0, v.duration - 0.4);   // seek 到距结尾 0.4s
await v.play();                                   // 继续真实播放
v.addEventListener('ended', () => window.__w6ended++);
// 等待 src 变化到第 2 集
```

### 结果（四套全部通过）

| 环境 | 页面 | ended 计数 | 新 src | 是否保持全屏 |
| --- | --- | --- | --- | --- |
| Web | 推荐流 | 1 | `/api/episodes/1002/stream` | ✅ `document.fullscreenElement` 仍为 DIV |
| Electron | 推荐流 | 1 | `/api/episodes/1002/stream` | ✅ 最外层容器仍 `fixed` |
| Web | 详情页 | 1 | `/api/episodes/1002/stream` | ✅ player 仍 `fixed` |
| Electron | 详情页 | 1 | `/api/episodes/1002/stream` | ✅ player 仍 `fixed` |

集数从第 1 集无缝切到第 2 集，且**全屏状态未丢失**。W5 报告中「由浏览器产生真实 ended 事件」的说法
在本轮**独立复现成立**。

---

## 七、越界改动与调试日志

### 7.1 授权文件对照

W4/W5 的改动位于提交 `a66a6c3`（2026-10-15 17:34，`feat: 修复全屏、分页与端口问题，补齐推荐流全屏`）中，涉及：

| 文件 | 归属 | 是否在授权范围 |
| --- | --- | --- |
| `apps/web-pc/src/components/RecommendStream.tsx` | W4 | ✅ |
| `apps/web-pc/src/components/PlayerModal.tsx` | W5 | ✅ |
| `apps/web-pc/src/App.tsx` | W4（`showToast` 透传） | ✅ |
| `apps/web-pc/src/hooks/usePlayback.ts`、`useKeyboardShortcuts.ts` | W4/W5 共用 | ✅（全屏快捷键与播放状态） |
| `apps/web-pc/electron/main.cjs`、`preload.cjs` | W3/W5（原生全屏桥接） | ✅（全屏需求必需） |

**未发现越界**：W4/W5 未改动 `server/`、`custom-server/`、`shared/content-core/`、TV 端源码。

### 7.2 工作区另有他人未提交改动（**不属于 W4/W5**）

复核时工作区存在未提交改动，经逐文件比对确认为其他任务产物，**不应算入 W4/W5**：

| 文件 | 实际归属 | 内容 |
| --- | --- | --- |
| `components/PlayerModal.tsx`（video 部分） | **P2**（video 元素复用） | 移除 `key={currentEpisode.id}`，改 `useEffect` + `video.load()` |
| `components/RecommendStream.tsx`（video 部分） | **P2** | 同上，另加 `onTimeUpdate` 250ms 节流 |
| `hooks/usePlayback.ts` | **P2** | `loadedEpisodeIdRef` 防止切集期间误存进度 |
| `api.ts`、`App.tsx`（轮询） | **P5**（轮询降频） | 1s 轮询 → 10s + 可见性/播放感知 |

> ⚠️ 提示协调者：本次 Electron 端验证用的是 **11:24 的打包产物**，它包含已提交的 W4/W5，
> 但**不一定包含**上述 P2/P5 未提交改动。若需验证 P2/P5 在 Electron 下的表现，需重新打包。

### 7.3 调试日志

对 W4/W5 及工作区改动文件检索 `console.log` / `console.debug` / `debugger`：**0 命中**。

### 7.4 回归测试独立复跑

`npm test`（根目录，`node --test tests/*.test.mjs`）：**156 tests / 156 pass / 0 fail**。

> 注：W4 报告记录的是 119 项通过；本轮为 156 项 —— 差额来自其后 P2/P5 等任务新增的测试，
> 说明**测试只增未减**，W4/W5 未删除既有用例。其中包含
> `useKeyboardShortcuts isolates Escape key handling between fullscreen and modal dismissal` 一项，
> 与本次复核的 Escape 边界（§一 #18）直接相关。

---

## 八、无法核实项与限制（如实标注）

| 项 | 说明 |
| --- | --- |
| **详情页「符合图二」** | 为**结构对照**（人工查看两张截图），非像素级/几何级 diff。图二本身是真实剧集画面，测试片是彩条测试图，无法做像素比对。 |
| **§一 #21 详情页与推荐流互不影响** | **未单独构造交叉场景**（如在推荐流全屏中跳转详情页）。两者是独立组件、各自持有本地 `isFullscreen` state，且本轮两套用例均在同一构建上独立通过 —— 属**推测为不互相影响**，非实测结论。 |
| **「1080P」徽标** | 来自 fixture 的画质列表（用于核对徽标布局），**不代表测试片实际分辨率**（测试片 360×640）。 |
| **音画同步 / 官方内容获取** | 不在本次范围；测试片为本地生成 H.264，非官方 1080P 解码验收。 |
| **Playwright 焦点模拟** | 已按 W5 报告所述关闭。若**未**关闭，Web 端会出现「`fullscreenElement` 有值但窗口未变大」的假象 —— 本轮确认该现象**源于测试工具**，非产品缺陷。 |
| **Electron 打包时间差** | 打包产物（11:24）晚于 W4/W5 提交（10-15 17:34），早于当前工作区未提交改动。 |

---

## 九、发现的问题与建议

### 9.1 无阻断问题

W4/W5 的全屏实现**行为正确、两端一致、边界完整**，40 项检查全部通过，建议**验收通过**。

### 9.2 非阻断建议

1. **判据文档修正**：建议把「`outerWidth < screen.width` 即窗口最大化」这一判据从任务书/规范中移除或加注，
   它在 DOM 全屏下会产生**假阳性**（本次实测 Web 全屏 `outer=2290 < screen=2304`，但确为屏幕级全屏）。
   推荐统一改用 `document.fullscreenElement`（Web）/ `outer === screen`（Electron）。
2. **W4 自证样本无效**：W4 报告用横版测试片验证「竖版居中留黑边」，该项在其证据下**不可判定**。
   本次以竖版片复测通过，建议 W4 补充竖版样本证据以免后续复现困难。
3. **Electron 沙箱适配**：本机 Electron 需 `--disable-gpu --disable-software-rasterizer --no-sandbox` 才能启动，
   建议在测试脚本/文档中固化，避免后续复核者重复踩坑（W5 未记录该坑）。

---

## 十、证据文件清单

### 脚本与测试片
- `.agents/shared/t-w6-verify.cjs` — 本次独立复核脚本（Web/Electron × 推荐流/详情页）
- `.agents/shared/t-w6-diag.cjs` — Electron 环境诊断脚本
- `outputs/w6-tests/fixture-vertical.mp4` — 自建竖版测试片（360×640, 8s, H.264）

### 结果 JSON（含逐项 pass/fail 与几何数据）
- `.agents/shared/t-w6-recommend-web-results.json`
- `.agents/shared/t-w6-recommend-desktop-results.json`
- `.agents/shared/t-w6-detail-web-results.json`
- `.agents/shared/t-w6-detail-desktop-results.json`

### 截图
- 推荐流：`t-w6-recommend-web-before.png`、`t-w6-recommend-web-fullscreen.png`、
  `t-w6-recommend-web-autonext.png`、`t-w6-recommend-web-failtoast.png`、
  `t-w6-recommend-desktop-fullscreen.png`
- 详情页：`t-w6-detail-web-fullscreen.png`、`t-w6-detail-desktop-fullscreen.png`、
  `t-w6-detail-web-autonext.png`、`t-w6-detail-desktop-autonext.png`

### 参考
- `.agents/shared/ref-fig2-other-page-fullscreen.png`（图二）

---

## 十一、复核声明

1. 本次复核**未修改任何产品代码**；仅新增测试脚本、测试片与证据文件。
2. 未执行 `git checkout` / `git reset` / `git clean`。
3. 所有结论区分「已核实」与「推测/未验证」，未验证项已在 §八 显式列出。
4. 测试进程（Chrome / Electron / fixture 服务）均在脚本 `finally` 中清理；`红果短剧.exe` 已确认无残留。
