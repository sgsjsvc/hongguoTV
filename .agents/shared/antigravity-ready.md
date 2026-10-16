# Antigravity 接入报告

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
