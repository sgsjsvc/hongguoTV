# B3 修复 Electron 桌面端缺陷（后端崩溃 + 单实例）— 复核报告

**任务 ID**: `t-b3-desktop-robustness`
**执行人**: workbuddy
**日期**: 2026-10-16
**改动文件**: `apps/web-pc/electron/main.cjs`（唯一）
**结论**: ✅ **通过** — 2 个必修 Bug 全部修复并**实测验证**；1 个可选项（日志轮转）完成并验证

---

## 一、结论速览

| # | 验收项 | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | 后端崩溃有用户反馈或自动恢复 | ✅ 通过 | 自动重启 3 次 + 超限弹窗（实测，见 §五） |
| 2 | 正常退出不弹错 | ✅ 通过 | `backend-crashed` 计数 = 0（实测） |
| 3 | 有单实例锁 | ✅ 通过 | 第二实例 exit code 0 秒退，无新后端（实测 + 代码） |
| 4 | 崩溃信息写入日志 | ✅ 通过 | `backend-crashed code=1 signal=null`（实测） |
| 5 | 全屏/迁移/退出清理不受影响 | ✅ 通过 | 全屏代码 **零改动**（git diff）+ 迁移全流程实测 |
| 6 | `npm test` 全绿 | ✅ 通过 | **178/178** |
| 7 | 报告写入 `.agents/shared/t-b3-desktop-robustness-workbuddy.md` | ✅ 通过 | 本文件 |

**额外完成**：日志轮转（§四），实测生效。

---

## 二、改动摘要

`apps/web-pc/electron/main.cjs`，6 个 hunk，净增约 45 行：

| hunk | 位置 | 内容 |
| --- | --- | --- |
| 1 | 第 7 行 | 新增 `const singleInstanceLock=app.requestSingleInstanceLock();` |
| 2 | 第 8 行 | 新增 `backendRestarts=0` 字段 |
| 3 | 第 53 行 | `bootlog` 增加 >1MB 轮转 |
| 4 | 第 54–58 行 | 新增 `MAX_BACKEND_RESTARTS=3` 与 `resolveServiceRoot()` |
| 5 | 第 59–90 行 | 抽出 `launchBackend()`（fork + 等 ready + 设 origin + **持久崩溃监听**）；新增 `scheduleBackendRestart()` |
| 6 | 第 119–125 行 | 用 `if(!singleInstanceLock){app.quit();}else{...}` 包裹全部生命周期注册，并注册 `second-instance` |

**改动前后对比（关键片段）**：

```diff
-let mainWindow,backend,backendOrigin,quitting=false,initializing=true;
+const singleInstanceLock=app.requestSingleInstanceLock();
+let mainWindow,backend,backendOrigin,quitting=false,initializing=true,backendRestarts=0;
```

```diff
-function bootlog(stage){fs.appendFileSync(path.join(app.getPath('userData'),'startup-stage.log'),...);}
+function bootlog(stage){const file=...;try{if(fs.existsSync(file)&&fs.statSync(file).size>1048576)fs.renameSync(file,file+'.1');}catch{}fs.appendFileSync(file,...);}
```

```diff
+ proc.on('exit',(code,signal)=>{if(!ready||quitting||proc!==backend)return;bootlog(`backend-crashed code=${code} signal=${signal}`);scheduleBackendRestart();});
```

```diff
+if(!singleInstanceLock){app.quit();}
+else{
+ app.on('second-instance',()=>{if(!mainWindow||mainWindow.isDestroyed())return;if(mainWindow.isMinimized())mainWindow.restore();if(!mainWindow.isVisible())mainWindow.show();mainWindow.focus();});
  app.whenReady().then(...);
  app.on('activate',...);app.on('window-all-closed',...);
  app.on('before-quit',...);
+}
```

---

## 三、Bug#5：后端运行期崩溃无处理 — 修复说明

### 根因确认

原代码 `backend.once('exit', ...)` 共 3 处，**全部为 `once` 且用途受限**：
- 第 60 行：关闭日志流
- 第 61 行：启动阶段 reject ready Promise
- 第 90 行：`before-quit` 退出流程

**启动完成后无任何存活的崩溃监听器** → 后端死亡时主进程无感知。

### 修复方案（采用任务书推荐的 C + B 组合）

1. **持久监听**：`launchBackend()` 内注册 `proc.on('exit', ...)`（非 `once`）
2. **区分正常退出**：监听器首行 `if(!ready||quitting||proc!==backend)return;`
   - `ready` — 冷启动阶段失败仍走 `startBackend()` 的 rejection 路径，不触发重启
   - `quitting` — 用户主动退出时不误报
   - `proc!==backend` — 已被新进程替换的旧进程事件忽略
3. **自动重启 + 次数上限**：`scheduleBackendRestart()` 最多重启 3 次，超限改弹 `dialog.showErrorBox('服务异常','内置服务已多次停止，请重启应用。')`
4. **崩溃信息写日志**：`bootlog(\`backend-crashed code=${code} signal=${signal}\`)` + `backend-restarting attempt=N` + `backend-restarted attempt=N`
5. **backendOrigin 变化处理**：重启成功后 `mainWindow.webContents.reload()`；`protocol.handle` 闭包引用模块级 `backendOrigin`，自动读到新端口

**重构说明**：原 `startBackend()` 内联的 fork/等 ready 逻辑抽为 `launchBackend()`，使重启路径可复用。注意 `startBackend()` 中第 95 行 `legacy-migration.mjs` 导入原先依赖局部变量 `serviceRoot`，已同步改为 `resolveServiceRoot()`（**重构时发现并修复的隐患，否则会抛 ReferenceError**）。

**防御性补充**：`launchBackend()` 首行新增 `if(backend&&backend.exitCode===null){try{backend.kill();}catch{}}`，避免「启动超时（进程仍存活）」场景下重启造成进程泄漏（正常重启路径旧进程已退出，此行为 no-op）。

---

## 四、Bug#6：单实例锁 — 修复说明

```javascript
const singleInstanceLock=app.requestSingleInstanceLock();   // 第 7 行，setPath('userData') 之后
...
if(!singleInstanceLock){app.quit();}
else{
 app.on('second-instance',()=>{
  if(!mainWindow||mainWindow.isDestroyed())return;
  if(mainWindow.isMinimized())mainWindow.restore();
  if(!mainWindow.isVisible())mainWindow.show();
  mainWindow.focus();
 });
 // whenReady / activate / window-all-closed / before-quit 全部移入 else 分支
}
```

**与现有逻辑的协调**：未拿到锁的实例只会执行 `app.quit()`，**不会**启动后端、不会创建窗口、不注册生命周期钩子（全部在 `else` 分支内），避免第二个实例产生多余的 `node.exe` 与 SQLite 并发写。

**顺带完成（可选）**：`bootlog` 与 `local-service.log` 超过 1MB 时重命名为 `.1`（try/catch 包裹，失败静默）。

---

## 五、实测证据

### 环境

- Electron **40.0.0**（`apps/web-pc/node_modules/electron/dist/electron.exe`）
- 后端运行时：managed node `C:\Users\AnLin\.workbuddy-ai\binaries\node\versions\22.22.2-6\node.exe`
- 隔离 profile：`HG_DESKTOP_PROFILE` 指向临时目录，不污染真实用户数据

> **⚠️ 关键环境陷阱**：本机（WorkBuddy 客户端进程树）注入 `ELECTRON_RUN_AS_NODE=1`，会导致 Electron 退化为纯 Node 模式，报 `TypeError: Cannot read properties of undefined (reading 'setPath')`（`app` 为 undefined）。**必须用 `env -u ELECTRON_RUN_AS_NODE` 清除该变量**后才能以 GUI 模式启动。注意设为空字符串**无效** —— Electron 在 C++ 层用 `HasVar` 判断，变量存在即触发。

### 测试 1：杀后端 → 自动恢复 ✅

主进程 PID 24368，后端 node PID 4744。`Stop-Process -Force` 杀掉后端：

```
2026-10-16T09:00:31.171Z creating-main-window
2026-10-16T09:01:04.877Z backend-crashed code=1 signal=null     ← 崩溃被捕获
2026-10-16T09:01:04.879Z backend-restarting attempt=1           ← 开始重启
2026-10-16T09:01:05.501Z backend-restarted attempt=1            ← 622ms 后成功
```

新后端进程 PID 由 4744 → **26724**（`Get-CimInstance` 确认）。

### 测试 2：重启次数上限 ✅

连续再杀 3 次：

```
09:01:32.875Z backend-crashed code=1 signal=null
09:01:32.877Z backend-restarting attempt=2
09:01:33.493Z backend-restarted attempt=2      (新 PID 36124)
09:01:47.991Z backend-crashed code=1 signal=null
09:01:47.993Z backend-restarting attempt=3
09:01:48.599Z backend-restarted attempt=3      (新 PID 23776)
09:02:08.867Z backend-crashed code=1 signal=null   ← 第 4 次崩溃
```

**第 4 次崩溃后无 `attempt=4`**；`grep -c "backend-restarting"` = **3**（恰等于上限）。
进程核实：主进程子节点仅剩 3 个 `electron.exe`，**无 `node.exe`**（后端不再重生），主进程存活并等待用户响应 `showErrorBox`。

### 测试 3：单实例锁 ✅

实例1 就绪后（主进程 30996，后端 27236），以**相同 profile** 启动实例2：

```
SECOND_INSTANCE_EXITED code=0      ← 立即退出，未阻塞
```

- 实例1 `startup-stage.log` 中 `starting-backend` 计数仍为 **1**（实例2 未启动第二个后端）
- `electron.exe` 进程数**未增加**（仍为 30996 + 3 子进程）
- 实例1 后端 27236 仍存活

### 测试 4：正常退出不弹错 ✅

对实例1 执行 `taskkill /PID 30996`（**不带 `/F`**，发送 WM_CLOSE）：

```
crashed count: 0                   ← quitting 标志生效，未误报崩溃
startup-errors.log: (不存在)
```

进程干净退出，无错误弹窗。

### 测试 5：日志轮转 ✅

预置 2MB 的 `startup-stage.log` / `local-service.log` 后启动：

| 文件 | 大小（字节） |
| --- | --- |
| `startup-stage.log.1` | 2097152 |
| `local-service.log.1` | 2097152 |
| `startup-stage.log`（新） | 319 |
| `local-service.log`（新） | 991 |

### 测试 6：旧数据迁移回归 ✅

每次启动日志均完整走完：

```
starting-backend → backend-ready → migration-module-loaded → migration-page-loaded
→ legacy-storage-read → legacy-migration-finished → creating-main-window
```

迁移只在 `startBackend()`（首次启动）执行一次；**后端重启不重跑迁移**（`scheduleBackendRestart` 只调 `launchBackend`）—— 符合预期，避免重复导入。

### 测试 7：全屏回归 ✅（代码级）

`git diff` 的 6 个 hunk 均**不涉及**全屏代码；对 diff 内容 grep `fullscreen|F11|Escape|setWindowFullscreen|enqueueFullscreen|watchFullscreen|registerFullscreenHandlers` **0 命中**。
第 10–51 行（`setWindowFullscreen` / `enqueueFullscreen` / `registerFullscreenHandlers` / `watchFullscreen`）**逐字节未变**。

### 测试 8：`npm test` ✅

```
# tests 178
# pass 178
# fail 0
```

（任务书标注「当前 161 项」，实际已增长至 178 项，全绿。）

**稳定性压测**：完整套件连跑 **8 次全部 178/178**；`tests/desktop-fullscreen.test.mjs` 单独连跑 5 次全部通过。
> 说明：期间在**与 Electron 进程/文件 I/O 并发**时曾偶发 1–3 项失败，环境空闲后无法复现。该套件含基于 `setTimeout(...,5)` 的时序断言，属系统负载型 flaky，**与本次改动无关**（`desktop-fullscreen.test.mjs` 的 fixture 从 `let fullscreenQueue` 截取到 `function bootlog`，该区间未改动）。

### 测试 9：改动后回归（防御性补充后重跑）✅

追加 `launchBackend()` 首行防御后重新实测（新 profile，主进程 22340 / 后端 17020）：

```
09:08:38.656Z creating-main-window
09:08:56.513Z backend-crashed code=1 signal=null
09:08:56.515Z backend-restarting attempt=1
09:08:57.218Z backend-restarted attempt=1     ← 703ms 恢复，行为不变
```

---

## 六、未实测 / 局限

| 项 | 说明 |
| --- | --- |
| 弹窗视觉截图 | `dialog.showErrorBox` 为原生模态框，本环境无法截屏；已通过「主进程存活 + 后端不重生 + 日志无 attempt=4」间接证明其被调用 |
| 单实例「聚焦已有窗口」的视觉确认 | 已验证第二实例秒退、不产生新窗口/后端；`second-instance` 回调内 `restore/show/focus` 为**代码级**证据 |
| 全屏交互实测 | 未跑 UI 交互（改动零接触全屏代码，且 W6 已独立复核过全屏）；本项为**代码级**证明 |
| 崩溃重启后前端状态 | `webContents.reload()` 会丢失未持久化的前端内存态（如滚动位置）。任务书未要求保留，属预期行为 |
| `backendRestarts` 是否重置 | **保守策略：不重置**。累计 3 次后即弹窗（不因「稳定运行一段时间」而清零），彻底杜绝无限重启循环 |

---

## 七、问题与建议

1. **【建议】前端崩溃提示可更友好**：当前超限走原生 `dialog`，用户需点「确定」。若后续允许改 `apps/web-pc/src/`，可在页面内展示「服务已停止 + 重试按钮」，体验更好（本轮受文件边界限制未做）。
2. **【建议】`MAX_BACKEND_RESTARTS=3` 可考虑环境变量化**（如 `HG_BACKEND_MAX_RESTARTS`），便于运维调参。本轮按任务书保持硬编码。
3. **【提示】`ELECTRON_RUN_AS_NODE` 陷阱值得写入项目文档**：任何在本机手工启动 Electron 的开发者/测试都会踩到（表现为 `app` undefined），且空字符串设值无效、必须 unset。
4. **【观察】本轮未改动 `preload.cjs`**（无需），未触碰 `apps/web-pc/src/`、`server/`、`custom-server/`、`apps/tv-android/`。

---

## 八、证据清单

| 文件 | 内容 |
| --- | --- |
| `outputs/b3-tests/evidence/recovery-startup-stage.log` | 测试 1+2：崩溃恢复与次数上限完整日志 |
| `outputs/b3-tests/evidence/single-instance-startup-stage.log` | 测试 3+4：单实例与正常退出 |
| `outputs/b3-tests/evidence/rotation-startup-stage.log` | 测试 5：轮转后新日志内容 |
| `outputs/b3-tests/evidence/rotation-sizes.json` | 测试 5：轮转前后文件大小 |
| `outputs/b3-tests/evidence/regression-startup-stage.log` | 测试 9：防御性补充后的回归日志 |
| `outputs/b3-tests/single2-stdout.log` | 测试 3：第二实例 stdout（空 = 无错误） |
| `outputs/b3-tests/manual-stdout.log` | 环境陷阱记录（`ELECTRON_RUN_AS_NODE` 报错） |

---

## 九、声明

1. 本报告所有「实测」结论均有上述日志/进程证据；「代码级」结论已明确标注。
2. 改动**仅限** `apps/web-pc/electron/main.cjs`（`git status` 确认 `preload.cjs` 未改）。
3. 未使用 `git checkout/reset/clean`，未修改他人文件。
4. 测试产生的临时进程已全部清理（`tasklist` 确认无残留 `electron.exe`）；临时 profile 目录已删除，仅保留证据文件。
5. 未改动全屏、迁移、退出清理相关代码。
