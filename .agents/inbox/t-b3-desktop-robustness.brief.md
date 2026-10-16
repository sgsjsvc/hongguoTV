# B3 修复 Electron 桌面端缺陷（后端崩溃 + 单实例）

**任务 ID**: `t-b3-desktop-robustness`
**负责人**: **workbuddy**
**依赖**: 无
**协调者**: dsh
**范围**: `apps/web-pc/electron/`

---

## ⚠️ 必读：启动 Electron 前必须清除 `ELECTRON_RUN_AS_NODE`

**协调者实测发现**：当前 shell 环境中存在 **`ELECTRON_RUN_AS_NODE=1`**
（由外部环境注入，非机器/用户级变量）。

**设了该变量后，`electron.exe` 会以「纯 Node」模式运行**：

| | 正常模式 | `ELECTRON_RUN_AS_NODE=1` |
| --- | --- | --- |
| `require('electron')` | 返回 Electron API | 返回**二进制路径字符串** |
| `app` | 对象 | **`undefined`** |
| 结果 | 窗口打开 | **崩溃退出** |

**症状**（协调者实际遇到）：

```
TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')
    at Object.<anonymous> (main.cjs:7:30)
```

**注意**：这**恰好会命中你新加的 `app.requestSingleInstanceLock()` 那一行**，
但**不是你的代码缺陷** —— 是环境变量导致的。

### 正确的启动方式

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
cd apps/web-pc
$env:NODE_ENV = "development"
& ".\node_modules\electron\dist\electron.exe" .
```

**协调者已验证**：清除后 Electron 正常启动
（4 个进程：main/gpu/utility/renderer，窗口标题「红果短剧 - 多端客户端」）。

### 另外：`cross-env` 未安装

`npm run desktop:dev` 依赖 `cross-env`，但**它未安装**。
**直接用上面的命令启动**（手动设 `NODE_ENV`），不要用 `desktop:dev`。

### 验证成功的标志

```powershell
# 1. 进程存在（应有 4 个）
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Measure-Object

# 2. 窗口标题正确
Get-Process -Name electron | Where-Object { $_.MainWindowTitle } | Select-Object MainWindowTitle

# 3. 启动阶段日志完整
Get-Content "$env:APPDATA\hongguotv-web-pc\startup-stage.log"
# 应包含：starting-backend → backend-ready → ... → creating-main-window

# 4. 无启动错误
Get-Content "$env:APPDATA\hongguotv-web-pc\startup-errors.log"
```

---

## 一、两个 Bug（协调者已定位）

### 🔴 Bug #5：后端崩溃后无任何处理（用户只见白屏）

**位置**：`apps/web-pc/electron/main.cjs`

**证据**：

`backend.once('exit', ...)` 共 3 处，**全部是 `once` 且用途有限**：

| # | 行号 | 用途 |
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

**严重性**：中（触发概率低-中，但影响高）

---

### 🟡 Bug #6：无单实例锁

**证据**：全仓库无 `requestSingleInstanceLock`。

**影响**：

| 项 | 评估 |
| --- | --- |
| 端口冲突 | ✅ 无（`PORT=0` 动态分配） |
| **userData 共享** | ⚠️ 多实例写同一 SQLite |
| 数据损坏 | ✅ 不太可能（SQLite 有锁保护） |
| 资源浪费 | ⚠️ 每实例一个后端进程 |

---

## 二、任务目标

### 2.1 修复 Bug #5（必须）

**要求**：后端**运行期**崩溃时，用户能得到明确反馈。

**方案选择**（由你判断）：

| 方案 | 说明 | 推荐度 |
| --- | --- | --- |
| A | 提示用户 + 提供「重启服务」按钮 | ⭐⭐⭐ |
| B | 提示用户（`dialog.showErrorBox`） | ⭐⭐ |
| C | 自动重启后端（带次数上限） | ⭐⭐⭐ |

**关键要求**：

1. **监听器必须持久**（`on` 而非 `once`，或在 `createWindow` 后注册新的）
2. **区分正常退出**（`quitting` 标志）—— 退出时不要弹错
3. **有次数上限**（若做自动重启，防止无限重启循环）
4. **崩溃信息写入日志**（便于排查）

**参考实现**：

```javascript
let backendRestarts = 0;
function watchBackendCrash() {
  backend.on('exit', (code, signal) => {
    if (quitting) return;                       // 正常退出不处理
    bootlog(`backend-crashed code=${code} signal=${signal}`);
    if (backendRestarts < 3) {
      backendRestarts += 1;
      // 尝试重启（重建 backendOrigin 并重载窗口）
    } else {
      dialog.showErrorBox('服务异常', '内置服务已多次停止，请重启应用。');
    }
  });
}
```

**注意**：若做自动重启，需处理 `backendOrigin` 变化（新端口）→
可能需要 `mainWindow.webContents.reload()`。

### 2.2 修复 Bug #6（必须）

**要求**：加单实例锁。

```javascript
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
```

**注意**：要与现有 `whenReady` / `activate` 逻辑协调，不要破坏现有行为。

### 2.3 日志轮转（可选）

`main.cjs:52,60` 的日志为追加模式无限制。**非紧急**，
若时间充裕可加简单轮转（如超过 1MB 则截断）。

---

## 三、必须验证的行为

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | **杀掉后端进程** | 用户得到明确提示或自动恢复 |
| 2 | 正常退出应用 | **不弹错**（`quitting` 标志生效） |
| 3 | 重复启动应用 | 第二次聚焦已有窗口（不创建新实例） |
| 4 | 后端启动失败 | 现有错误提示仍正常 |
| 5 | 全屏功能 | 不受影响 |
| 6 | 旧数据迁移 | 不受影响 |
| 7 | 崩溃信息 | 写入日志文件 |

---

## 四、硬性约束

1. **可改文件**：
   - `apps/web-pc/electron/main.cjs`
   - `apps/web-pc/electron/preload.cjs`（如需）
2. **不要改** `apps/web-pc/src/`（B2 的职责）
3. **不要改** `server/`、`custom-server/`（B1 的职责）
4. **不要改** `apps/tv-android/`
5. **不要破坏**现有功能：全屏、旧数据迁移、退出清理
6. 保持 `npm test` 全绿（当前 161 项）
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 后端崩溃有用户反馈或自动恢复 | 实测（杀进程） |
| 2 | 正常退出不弹错 | 实测 |
| 3 | 有单实例锁 | 代码核实 + 实测 |
| 4 | 崩溃信息写入日志 | 检查日志文件 |
| 5 | 全屏/迁移/退出清理不受影响 | 回归验证 |
| 6 | `npm test` 全绿 | |
| 7 | 报告写入 `.agents/shared/t-b3-desktop-robustness-workbuddy.md` | |

---

## 六、验证方法

### 环境

```powershell
# 构建并运行桌面端
npm run build
npm --prefix apps/web-pc run electron   # 或查看 package.json 的实际脚本
```

**注意**：桌面端需要 Electron，若本机不可用，**明确说明并至少提供代码级证据**。

### 杀后端进程测试

```powershell
# 1. 启动桌面端
# 2. 找到后端子进程
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*custom-server*" } | Select-Object ProcessId, CommandLine
# 3. 杀掉它
Stop-Process -Id <PID> -Force
# 4. 观察 UI 反应
```

### 单实例测试

```powershell
# 启动两次，第二次应聚焦已有窗口而非新建
```

---

## 七、证据要求

1. **代码改动对比**
2. **杀后端后的 UI 反应**（截图或日志）
3. **正常退出不弹错**的证据
4. **单实例**的验证结果
5. **崩溃日志**内容
6. 全屏/迁移回归验证
7. `npm test` 输出

**若 Electron 不可用**：说明情况，提供代码级证据并标注「未实测」。

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **用 `once` 导致只触发一次** | 崩溃监听应持久（`on`） |
| **退出时误报** | 必须检查 `quitting` 标志 |
| **无限重启循环** | 若做自动重启，必须限制次数 |
| **backendOrigin 变化** | 重启后端口可能变，需更新并重载窗口 |
| **单实例锁与 whenReady 冲突** | 需协调顺序 |
| **破坏现有全屏逻辑** | 有队列/超时机制，不要动 |
| PowerShell 编码 | 改含中文文件用 Node 或 edit 工具 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-b3-desktop-robustness workbuddy "结论及报告路径"
```
