# Codex 接入报告

- 身份：`codex`，执行及审查方。
- 检查时间：2026-10-13 20:28（Asia/Shanghai）。
- 状态：已接入文件协作总线，待命；本次未修改业务代码。
- 已读取：`.agents/README.md`、`.agents/QUICKSTART.md`。用户最新指令优先，其次为 QUICKSTART 的本轮边界。

## 可访问目录

- 项目根目录：`F:\Project\hongguoTV`，已实际读取，协作报告可写入。
- 协作目录：项目内 `.agents/inbox`、`outbox`、`shared`、`state`、`logs`、`archive`。
- 可读取项目源码、测试、脚本、交接及计划文档；当前仅授权接入检查和报告写入。
- 附加可访问工作区：`C:\Users\AnLin\.codex\visualizations\2026\10\12\01a12ea6-758d-7c22-9032-2c96e9b8e060`，已确认存在，本次未写入。
- 本会话实际文件权限并非 README 所述的固定 workspace-write；执行范围仍严格受用户授权约束。

## 可用工具

| 工具 | 本次确认情况 |
| --- | --- |
| PowerShell | 可执行读取、检查命令 |
| Node.js | `node --version` → `v22.20.0` |
| npm | `npm --version` → `10.9.3` |
| Git | `git --version` → `2.51.0.windows.1` |
| ripgrep | `rg --version` → `15.2.0` |
| 文件协作 CLI | `status`、`ready` 已实际执行成功 |
| 文件编辑工具 | 可定向创建、修改授权范围内的文件；本次仅创建本报告 |
| 网络检查与网页检索 | 当前会话提供，接入检查未发起上游业务请求 |
| Python | 已发现 `F:\software\Anaconda3\python.exe`；本次未验证其运行及依赖 |
| 浏览器自动化 | 已确认本机 Playwright 包存在；本次未启动浏览器 |
| Android 工具 | 已确认 ADB 和 JDK 17 文件存在；本轮 TV 不在执行范围，未连接或操作设备 |

工具存在不代表其他 agent 的自动调用适配器已验证。本次未执行 `doctor`、`run`，未调用其他产品的私有会话接口，也未创建外部会话。

## 任务检查

在项目根目录实际执行：

```powershell
node .agents/cli.mjs status
node .agents/cli.mjs ready
```

结果：`total: 0`，`heartbeats: []`，ready 显示 `(空)`；检查时 inbox 无任务文件。因此没有认领、执行或标记完成任何任务。

## 执行前差异快照

`git status --short` 显示以下已存在的业务代码修改：

- `custom-server/index.mjs`
- `custom-server/vendor/hongguo.cjs`
- `server/vendor/hongguo.cjs`
- `shared/content-core/hongguo.js`

检查时 `git diff --stat` 合计为 4 个文件、112 行新增、213 行删除。另有未跟踪的 `.agents/`、播放修复计划及 `scripts/tv-verify.ps1`。

此为已有工作区状态，不是本次接入所产生的业务修改；本次只记录差异摘要，未对这些修改作完整评审，也未认定其测试通过。没有覆盖、回退或清理这些内容。

## 调试设备（2026-10-15 分配）

**你的固定设备：D2**

| 项 | 值 |
| --- | --- |
| adb 地址 | **`127.0.0.1:16416`** |
| Android | **15（API 35）** |
| 分辨率 | 1080×1920（竖屏，需自行调横屏） |
| 密度 | 280 |
| 已装 App | ❌ 需自行安装 |

**特点**：三个模拟器中**系统版本最新**，适合验证新系统兼容性。

### 准备步骤

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16416
& $adb -s 127.0.0.1:16416 shell wm size 1280x720     # 调横屏
& $adb -s 127.0.0.1:16416 install -r <apk路径>
```

### 设备使用规范

1. **只用 D2**（`127.0.0.1:16416`）—— 不要操作其他 agent 的设备
2. **始终用 `-s 127.0.0.1:16416`** 显式指定
3. 截图命名带设备标识：`<任务ID>-d2-<场景>-<时间戳>.png`
4. 逻辑宽度：1280/1.75 = **731dp** → 命中 `sw600dp` 档

**完整设备矩阵见** `.agents/shared/device-allocation.md`

---

## 阻塞项与后续约束

1. 当前无分配给 codex 的明确任务，等待 DSH 协调者派发。这不影响接入就绪。
2. 若后续修改 Web / Windows 的共享取流代码，任务必须明确如何隔离 TV 打包使用的共享引擎；不得假定不改 Android 文件就不会影响 TV。
3. 现有未提交修改需要协调者确认修改归属与基线，再安排重叠文件的实现任务。
4. 文件总线不会自动唤醒本会话；需要新的用户消息或已配置的合法调度入口触发检查，不声称持续后台监听。

后续收到明确任务时，重新检查 ready 和任务详情，仅认领 `assignee=codex` 且依赖已完成的任务。开始前检查最新差异；结果记录改动文件、验证命令、实际输出、失败与剩余问题。未分配任务时保持待命，不自行扩展范围。

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

## 待办任务（2026-10-15）

| 任务 ID | 标题 | 说明 |
| --- | --- | --- |
| `t-w7-release-package` | **W7 Web 与 Windows 端 Release 打包发布** | 用户直接指派 |

### 背景

当前产物**已过期**：

| 产物 | 时间 | 问题 |
| --- | --- | --- |
| `release/web/hongguotv-web-win-x64.zip` | 20:43 | 引擎 `hongguo.js` 是 20:49 |
| `release/windows/红果短剧-1.0.0-x64-setup.exe` | **19:02** | 落后约 2 小时 |

未包含的已完成修复：

- `3a752c0` 修复全部端无法播放（上游 `device_id` 封禁）
- `cb0e16a` 设备标识防回归 + 诊断脚本
- `023fd99` 四层防护
- `e2957b2` 修复 TV 端 `crypto.randomBytes` 兼容
- `2836803` 全屏快捷键、推荐流全屏头部

### 硬性前置

**必须先 `npm run release:check` 全绿才能打包。**

冒烟测试失败则**不要打包**，先报告问题。

### ⚠️ 两个已知陷阱

1. **不要设置 `HG_ELECTRON_DIST`** —— 设了会强制用 x64 的 Electron，
   arm64 打包会被 `afterPack` 钩子拦截报「产物架构错误」。
2. **必须用 `--platforms=win-x64,win-arm64`** 生成 bundle ——
   只写 `win-x64` 会让 arm64 bundle 目录保留旧引擎。

### 认领方式

```powershell
node .agents/cli.mjs claim t-w7-release-package codex
```

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
