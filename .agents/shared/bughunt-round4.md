# Bug 排查报告（第四轮：Electron 桌面端）

**排查方**: dsh
**日期**: 2026-10-16
**范围**: `apps/web-pc/electron/main.cjs`、`preload.cjs`

---

## 一、本轮确认的问题（3 个）

### 🔴 Bug #5：后端崩溃后无任何处理（用户只见白屏）

**严重性**: 中
**位置**: `apps/web-pc/electron/main.cjs`

**证据**：

`backend.once('exit', ...)` 共 3 处，**全部是 `once` 且用途有限**：

| # | 位置 | 用途 |
| --- | --- | --- |
| 1 | `:61` | 启动阶段拒绝 ready Promise |
| 2 | `:60` | 关闭日志流 |
| 3 | `:90` | `before-quit` 退出流程 |

**关键**：**启动完成后没有任何存活的崩溃监听器**。

**运行期崩溃的后果**：

1. 后端进程死亡
2. Electron 主进程**无感知**
3. 渲染进程继续请求 `backendOrigin`
4. 请求全部失败（`ECONNREFUSED`）
5. **用户看到：页面空白 / 操作全失败 / 无错误提示**
6. 恢复方式：**只能重启应用**

**严重性评估**：

| 维度 | 评估 |
| --- | --- |
| 触发概率 | 低-中（OOM、未捕获异常、用户强杀） |
| 影响 | **高**（应用完全不可用，无提示） |
| 综合 | **中** |

**修复建议**：

```javascript
// 在 createWindow 后注册持久监听
backend.once('exit', (code) => {
  if (quitting) return;
  dialog.showErrorBox('服务异常', '内置服务已停止，请重启应用');
  // 或尝试自动重启（带次数上限）
});
```

---

### 🟡 Bug #6：无单实例锁，重复启动会创建多个后端

**严重性**: 低
**位置**: `apps/web-pc/electron/main.cjs`

**证据**：全仓库无 `requestSingleInstanceLock`。

**影响**：

| 项 | 评估 |
| --- | --- |
| 端口冲突 | ✅ 无（`PORT=0` 动态分配） |
| **userData 共享** | ⚠️ 多实例写同一 SQLite |
| SQLite 锁竞争 | ⚠️ WAL 模式下可能锁等待 |
| 数据损坏 | ✅ 不太可能（SQLite 有锁保护） |
| 资源浪费 | ⚠️ 每实例一个后端进程 |

**修复建议**：

```javascript
if (!app.requestSingleInstanceLock()) { app.quit(); }
else app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
```

---

### 🟡 Bug #7：后端启动日志无轮转

**严重性**: 极低
**位置**: `apps/web-pc/electron/main.cjs:52,60`

**证据**：`appendFileSync` 与 `createWriteStream({flags:'a'})` 均为**追加模式，无大小限制**。

**影响**：长期使用后日志文件持续增长（但每次启动仅几行，增长极慢）。

**建议**：非紧急，可在写入前检查大小并轮转。

---

## 二、已验证正确的部分

| 检查项 | 结果 |
| --- | --- |
| 启动超时（15000ms） | ✅ 有，且会提示用户 |
| `window-all-closed` + `initializing` 守卫 | ✅ |
| `activate` 处理（macOS） | ✅ |
| `before-quit` 清理后端 | ✅ 发送 shutdown + kill 超时兜底 |
| `contextIsolation: true` | ✅ |
| `nodeIntegration: false` | ✅ |
| `contextBridge` 暴露 | ✅ 仅 3 个全屏 IPC 通道 |
| `bypassCustomProtocolHandlers` | ✅ 避免递归 |
| 全屏切换 | ✅ 有队列、超时、状态重试 |
| **全新安装迁移路径** | ✅ **`/api/library/import` 接受空数组（200）** |
| 渲染进程错误处理 | ✅ 有错误事件与重试 |

---

## 三、排除的候选（1 个）

### 全新安装时迁移失败导致无法启动

**候选**：`main.cjs:72` 发送 `operations: []`，若服务端拒绝则抛错并 `app.quit()`。

**验证**（实测）：

```
legacyOperations({}) = []
POST /api/library/import -> HTTP 200
响应: {"ok":true}
```

**结论**：服务端**接受空数组**，`response.ok = true`，**不抛错**。

**Bug 不成立** —— 全新安装路径正常。

---

## 四、累计 Bug 清单（4 轮）

| # | Bug | 严重性 | 状态 |
| --- | --- | --- | --- |
| #1 | vendor 回退副本缺 `upstreamStats` | 中 | 已派发 **B1** (codex) |
| #2 | `visibilitychange`/`online` 绕过 `isVideoPlaying` | 低-中 | 已派发 **B2** (antigravity) |
| #3 | `App.tsx` 追剧页缺 `isVideoPlaying` | 低 | 已派发 **B2** (antigravity) |
| #4 | sync-server import 即启动 | 低 | 待派发 |
| **#5** | **后端崩溃无处理（白屏）** | **中** | **本轮发现，待派发** |
| #6 | 无单实例锁 | 低 | 本轮发现 |
| #7 | 日志无轮转 | 极低 | 建议性 |

---

## 五、排查覆盖率（累计）

| 区域 | 状态 |
| --- | --- |
| 编码 / 语法 | ✅ 全覆盖 |
| 服务端 API 契约与异常 | ✅ |
| 预取接口与触发 | ✅ |
| library-store 边界 | ✅ |
| PlaybackPolicy 边界 | ✅ |
| 前端运行时（CDP） | ✅ |
| TV 运行时（设备） | ✅ |
| 打包产物 | ✅ |
| **Electron 桌面端** | ✅ **本轮** |
| 同步服务 | ⚠️ 部分（import 副作用干扰） |

**仍未覆盖**：真实电视（API 22，offline）、长时间稳定性（>1 小时）、
多设备并发同步的端到端验证。

---

## 六、本轮新增脚本

```
scripts/perf/bughunt-electron-migration.mjs  全新安装迁移路径
scripts/perf/bughunt-electron-main.mjs       主进程 8 项检查
scripts/perf/bughunt-electron-crash.mjs      后端崩溃影响分析
scripts/perf/bughunt-verify-bundle.mjs       打包覆盖核实
scripts/perf/bughunt-sync-and-bundle.mjs     同步服务与打包
```
