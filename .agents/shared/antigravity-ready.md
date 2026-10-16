# Antigravity 接入报告

> ## ⚠️ 领取任务前必读
> 2026-10-16 起，领取任何任务前必须重读 `.agents/RESPONSIBILITIES.md`。
> 前置步骤：**读 RESPONSIBILITIES.md → 读 brief → 确认 assignee 与 ready → claim**。跳过第一步视为未按规范领取。
> 最新变更：WorkBuddy 默认转为「独立复核 + 文档」；Qoder/OpenCode 未写真实 ready 报告前不假定在线、不派任务。
> 详见 `.agents/shared/notice-20261016-reread-responsibilities.md`。
>

- 身份：`antigravity`，执行及浏览器验证方。
- 检查时间：2026-10-13 20:31（Asia/Shanghai）。
- 状态：已接入文件协作总线，待命；本次未修改任何业务代码。
- 已读取：`.agents/README.md`、`.agents/QUICKSTART.md`。执行约束以用户最新指令和 QUICKSTART 为准。

---

## 1. 可访问目录

- **项目根目录**：`F:\Project\hongguoTV`（完全读写可达）。
- **文件总线与协作目录**：
  - `.agents/inbox/`（任务领取）
  - `.agents/outbox/`（结果输出）
  - `.agents/shared/`（共享事实与就绪报告，本次已写入 `antigravity-ready.md`）
  - `.agents/state/`（状态与锁定）
  - `.agents/logs/`（执行事件流）
  - `.agents/archive/`（归档任务）
- **前端与桌面源码目录**：`apps/web-pc/`（React 前端界面、Electron 桌面配置、构建与静态资源）。
- **共享与后端目录**：`shared/`、`custom-server/`、`server/`（可读，供比对与联调排查）。
- **验证与测试目录**：`tests/`、`docs/`、`outputs/`。

---

## 2. 可用工具

| 工具类别 | 具体工具 / 运行环境 | 状态与能力说明 |
| --- | --- | --- |
| **基础执行环境** | Node.js `v22.20.0`、npm `10.9.3`、Git `2.51.0.windows.1`、PowerShell | 正常可用，支持构建、打包、类型检查及测试 |
| **浏览器验证工具** | `chrome-devtools-mcp` (Lazy MCP)<br>包含 navigate, click, fill, evaluate_script, take_screenshot, list_network_requests, get_console_message, wait_for 等 | **已就绪**。具备直接操控 Chrome/Chromium 浏览器、DOM 检测、网络流抓包、Console 日志抓取与界面截图能力 |
| **文件协作 CLI** | `node .agents/cli.mjs` (status / ready / claim / done / fail) | 已实测正常运行，通信无异常 |
| **前端验证指令** | `npm run typecheck`<br>`npm run build`<br>`npm --prefix apps/web-pc run dev`<br>`npm test` | 可运行前端构建、TypeScript 静态检查、本地 Vite 开发服务及单元测试 |

---

## 3. 任务与工作区现状

1. **任务检查**：
   - 执行 `node .agents/cli.mjs status` 结果：`total: 0`。
   - 执行 `node .agents/cli.mjs ready` 结果：`(空)`。
   - inbox 中当前无待办任务。未认领、未执行、未改动任何业务任务。

2. **工作区既有未提交差异**（已检查，未覆盖、未回退、未清理）：
   - `custom-server/index.mjs`
   - `custom-server/vendor/hongguo.cjs`
   - `server/vendor/hongguo.cjs`
   - `shared/content-core/hongguo.js`
   - 未跟踪文件：`.agents/`、`docs/plans/2026-10-13-playback-upstream-fix.md`、`scripts/tv-verify.ps1`。

---

## 4. 调试设备（2026-10-15 分配）

**你的固定设备：D1**

| 项 | 值 |
| --- | --- |
| adb 地址 | **`127.0.0.1:16384`** |
| Android | 12（API 32） |
| 分辨率 | 720×1280，**已调为 1280×720** |
| 密度 | 240 |
| 已装 App | ✅ `com.hongguotv.tv` |

### ⚠️ adb 环境（必读）

**本机 DSH 沙箱拒绝绑定 6300 以下 loopback 端口**，adb 默认 5037 会失败。**必须**：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384
```

### 设备使用规范

1. **只用 D1**（`127.0.0.1:16384`）—— 不要操作其他 agent 的设备
2. **始终用 `-s 127.0.0.1:16384`** 显式指定，不要依赖默认设备
3. 截图命名带设备标识：`<任务ID>-d1-<场景>-<时间戳>.png`
4. `wm size` 覆盖**重启后会重置**，需重新设置

**完整设备矩阵见** `.agents/shared/device-allocation.md`

---

## 5. 阻塞项与后续执行约束

1. **阻塞项**：
   - **B1. 当前无任务**：Inbox 中尚无分配给 `antigravity` 的任务，处于待命状态，等待协调者（DSH）派发。
   - **B2. 共享核心隔离约束**：`shared/content-core/hongguo.js` 为三端共用；修改必须同步三份副本（`shared/` + 两份 `vendor/`）。
2. **执行与验证准则**：
   - 收到明确任务后，**仅认领 `assignee=antigravity` 且前置依赖全部完成（ready）的任务**。
   - **验证严禁"假成功"**：验证必须对应明确的代码版本/提交；**坚决不把 HTTP 200/成功响应当作实际播放成功**，必须通过浏览器 DevTools / DOM / Media 事件深度核验播放器实际播放状态（如 `video.currentTime > 0`、无卡顿错误事件、实际渲染帧等）。
   - **TV 端已在范围内**（旧版本文档中的"TV 范围排除"已废止）。
   - **实机验证注意**：静态截图**不能**证明"卡住"或"正常"，必须验证**状态是否推进**（如播放位置时间戳变化）。

---

## 可竞争任务（2026-10-15 新增）

部分任务**不固定归属**，由多个 agent **先到先得**。

### 当前可竞争任务

| 任务 ID | 标题 | 可认领方 | 规则 |
| --- | --- | --- | --- |
| `t-q5-fix-dup-append` | Q5 修复分页重复追加 | **codex / antigravity** | 谁先完成自己当前的 W 任务，谁认领 |

### 认领方式

```powershell
node .agents/cli.mjs claim t-q5-fix-dup-append <你的身份>
```

### 机制

- 先认领者获得 **30 分钟独占锁**
- 另一方认领会收到 `task already claimed by <对方>`
- **不要强行抢占** —— 若认领失败，说明对方已开始，请勿重复工作

### 如何识别可竞争任务

```powershell
node .agents/cli.mjs ready     # 可竞争任务会显示 [可竞争] 标记
node .agents/cli.mjs show <id> # 查看 assignees 与 competitive 字段
```

---

## 全屏任务分工（2026-10-15）

### 关键事实：Web 与 Electron 是同一套前端代码

`apps/web-pc/src` → `vite build` → `dist` → 被 Electron 与浏览器**共用**。

**所以改一次前端代码，两端都生效。** 桌面端自动走 `window.hongguotvDesktop` 桥接，
浏览器走 DOM API。

### 分工

| 任务 | 负责方 | 页面 | 文件 |
| --- | --- | --- | --- |
| **W5** | **codex** | 详情页/播放弹窗 | `PlayerModal.tsx` |
| **W4** | **antigravity** | 推荐流 | `RecommendStream.tsx` |

### 两条通用要求

1. **保留自动下一集** —— 全屏后自动连播必须继续工作
2. **整个屏幕全屏** —— 用 `win.setFullScreen`（W3 已实现），不用 `maximize` 或 CSS 模拟

### 参考图

- 图二（详情页全屏）：`.agents/shared/ref-fig2-other-page-fullscreen.png`
- 图一（推荐页全屏）：见 `fullscreen-task-split.md` 的 ASCII 描述

### 文档

- 分工总览：`.agents/shared/fullscreen-task-split.md`
- 需求更正：`.agents/shared/fullscreen-requirement-correction.md`

---

## 性能优化任务（2026-10-16）

协调者已实测建立基线，见 `.agents/shared/perf-baseline.md`。

### 实测数据

| 环节 | 耗时 |
| --- | --- |
| **详情接口** | **1086–2035 ms（平均 1369，无缓存）** |
| 推荐首屏 | 2514 ms（冷）/ 2 ms（热） |
| 清晰度 | 0–1 ms（已缓存） |
| 取流 | 32–37 ms（已缓存） |
| 自动下一集（同剧） | 38 ms |
| **自动切下一部剧** | **1407 ms** |

### 任务分配（三方各一个，完全并行）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `apps/tv-android/` |

### 测量脚本（验收需用同一脚本复测）

```powershell
node outputs/debug/measure-playback.mjs    # 基础链路
node outputs/debug/measure-deep.mjs        # 冷热对比与并发
```

### 认领方式

```powershell
node .agents/cli.mjs claim <任务ID> <你的身份>
```

---

## 性能优化任务补充（2026-10-16 第二批）

### 新增 P4：TV 端列表渲染与滚动流畅度

**协调者静态审查发现 4 个问题**（见 `.agents/shared/perf-baseline-render.md`）：

| # | 问题 | 影响 |
| --- | --- | --- |
| A | `SeriesAdapter` 无 `onViewRecycled` | 快速滚动图片错位 |
| B | `ArtworkLoader.load()` 无条件清空图片 | 滚动闪烁 |
| C | `GradientDrawable` 每次 bind 都新建 | 榜单滚动对象分配 |
| D | OkHttp 无并发限制 | 快速滚动请求风暴 |

### 最终分工（负载 2/2/1）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p4-tv-render` | **codex** | `SeriesAdapter.kt`、`ArtworkLoader.kt` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `MainActivity.kt` |

**注意**：codex 领了 P1 与 P4 —— 两者**文件不重叠**（服务端 vs TV 端），可自由安排顺序。

### ⚠️ 设备当前离线

MuMu 模拟器已关闭，真机 `192.168.1.120:5555` 显示 `offline`。

**涉及 TV 的任务（P3、P4）需先启动模拟器或连真机**：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect 127.0.0.1:16384
```

若设备不可用，可先做代码改动，**在报告中标注「未实测」**。

---

## ⚠️ P1 任务目标已修正（2026-10-16）

### 我先前的诊断不完整

**原判断**：「详情接口无缓存」—— **不完整**。

**实测发现**：`detail()` 自身无缓存，但它调用的 `routerData()` **有 `pageCache`（TTL 180 秒）**。

| 情况 | 详情耗时 |
| --- | --- |
| 180 秒内访问过 | **1 ms** |
| **首次访问** | **1453 ms** |
| **超过 180 秒** | **1453 ms** |

### 真正的瓶颈

**不是「缺缓存」，而是「没有预取」。**

真实切剧实测：

| 场景 | 合计 |
| --- | --- |
| 切到已缓存剧 | 805 ms |
| **切到未缓存剧** | **1981 ms**（详情占 1453 ms） |

**首次切到某部剧，无论如何都要等一次上游请求** —— 加缓存解决不了。

### 修正后的 P1 目标

| 原 | 新 |
| --- | --- |
| ~~详情接口加缓存~~ | **实现预取机制** |

**要求**：提供可复用的预取能力，让客户端在用户切换**之前**后台加载。

**关键设计**：并发控制、可取消、去重、低优先级（失败不影响主流程）、可关闭。

**详细要求见 `.agents/inbox/t-p1-detail-cache.brief.md`。**

### 我的失误与教训

我基于代码审查断言「无缓存」，但没做「重启服务 + 首次请求」的对照测试。
先前测量时服务已运行，`pageCache` 有数据，看到 1ms 时我以为是别的机制，
而写基线时又根据代码断言「无缓存」——**两者都没错，但我没把它们联系起来**。

**教训**：判断「有无缓存」必须清空缓存后测首次请求。

完整修正说明见 `.agents/shared/perf-baseline-correction.md`。

---

## ⚠️ 并行注意事项（TV 端任务）

P3（workbuddy）与 P4（codex）**都修改 TV 端代码**：

| 任务 | 文件 |
| --- | --- |
| P3 | `MainActivity.kt` |
| P4 | `SeriesAdapter.kt`、`ArtworkLoader.kt` |

**文件不重叠，可同时改代码。**

**但构建时会争用同一个 Gradle build 目录**：

- 同时执行 `assembleDebug` 可能导致 Gradle 守护进程冲突
- 症状：构建失败、产物不完整、或 `Unable to delete directory`

**建议**：

1. **改代码可并行**，但**构建前互相确认**（或错开时间）
2. 若构建失败且原因不明，先检查是否有另一个 Gradle 进程在跑
3. 构建后可验证产物时间戳，确认是自己那次构建

```powershell
# 检查是否有其他 Gradle 进程
Get-Process -Name java -ErrorAction SilentlyContinue | Select-Object Id, StartTime
```

## 播放流畅度测量结论（新增）

**吞吐已排除**：实测代理吞吐 **108–189 Mbps**，是 1080P 码率的 **36–63 倍**。

**真正的瓶颈是 HEVC 解码** —— 上游所有清晰度均为 HEVC（`bytevc1`），
无硬件解码的设备会软解掉帧。

详见 `.agents/shared/perf-throughput-verdict.md`。

**这意味着**：

- ❌ 不需要优化网络/代理（已足够快）
- ✅ 应关注：切集重建（P2）、UI 树重建（P3）、列表渲染（P4）、播放器参数


---

## 性能优化任务（2026-10-16）

协调者已实测建立基线，见 `.agents/shared/perf-baseline.md`。

### 实测数据

| 环节 | 耗时 |
| --- | --- |
| **详情接口（首次）** | **1453 ms**（重复 1 ms，有 pageCache） |
| 推荐首屏 | 2514 ms（冷）/ 2 ms（热） |
| 榜单新页 | 1456–2079 ms |
| 分类新标签 | 854–938 ms |
| 清晰度 | 0–1 ms（已缓存） |
| 取流 | 32–37 ms（已缓存） |
| **切到未缓存剧** | **1981 ms**（详情占 73%） |
| 代理吞吐 | 108–189 Mbps（是码率的 36–63 倍，非瓶颈） |
| **每秒轮询 /api/library** | **每天 1.2 GB** |

### 任务分配（三方各 2 个，负载均衡）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| P1 播放预取机制 | **codex** | `server/provider.mjs` |
| P4 TV 列表渲染 | **codex** | `SeriesAdapter.kt`、`ArtworkLoader.kt` |
| P2 Web video 复用 | **antigravity** | `apps/web-pc/src/` |
| P5 Web 轮询优化 | **antigravity** | `apps/web-pc/src/api.ts` |
| P3 TV UI 树复用 | **workbuddy** | `MainActivity.kt` |

### 测量脚本（已入库）

```powershell
node scripts/perf/measure-playback.mjs      # 基础链路
node scripts/perf/measure-deep.mjs          # 冷热对比与并发
node scripts/perf/measure-real-switch.mjs   # 真实切剧流程
node scripts/perf/measure-throughput.mjs    # 播放吞吐量
node scripts/perf/measure-polling-live.mjs  # 轮询频率与流量
```

### ⚠️ 关键结论

1. **吞吐不是瓶颈**：108–189 Mbps，是 1080P 码率的 36–63 倍
2. **算法不是瓶颈**：推荐 `append()` 最坏 2.57 ms（池 512）
3. **瓶颈在「未预取」**：详情/榜单/分类首次都要 0.9–2 秒
4. **渲染层重建**：Web 的 video `key`、TV 的 `removeAllViews`

### 认领方式

```powershell
node .agents/cli.mjs claim <任务ID> <你的身份>
```
