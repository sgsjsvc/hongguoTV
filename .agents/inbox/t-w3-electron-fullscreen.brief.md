# W3 Electron 端窗口级全屏

**任务 ID**: `t-w3-electron-fullscreen`
**负责人**: codex
**依赖**: 无（与 W2 并行）
**协调者**: dsh
**范围**: **仅 Electron 端**（`apps/web-pc/electron/`）

---

## 一、用户需求

> 解决一下 web 端和电脑端视频不能全屏的问题

**本任务**：Electron 桌面端（Windows 打包版）。
**W2**（antigravity）负责 Web 端 React 部分。

---

## 二、根因（协调者已实测确认）

### 缺陷：窗口失焦后，渲染进程的全屏请求被 Chromium 拒绝

**实测证据**（对打包后的 `红果短剧.exe`，用 CDP 驱动）：

```
第 1 次 requestFullscreen: 成功
第 2-10 次: 全部失败 "TypeError: Permissions check failed"
```

**决定性验证**：

| 操作 | 结果 |
| --- | --- |
| 直接 `requestFullscreen` | ❌ `Permissions check failed` |
| 先 `Page.bringToFront`（窗口重获焦点） | ✅ **恢复正常** |
| 对 `<html>` 全屏 | ✅ 成功 |
| 对 `<body>` / `<video>` / 容器 div | ❌ 失败 |

**结论**：

1. **窗口失去系统焦点时**，Chromium 拒绝渲染进程的 fullscreen 权限
2. 这是**渲染进程 API 的固有限制**
3. **用户切到别的窗口再回来，全屏就失效** —— 这正是用户报告的问题

### 为什么用主进程 API 能解决

`win.setFullScreen(true)` 是**主进程 API**，**不经过渲染进程的权限检查**，
因此不受窗口焦点状态影响。

---

## 三、接口约定（必读）

**完整契约见** `.agents/shared/fullscreen-interface.md`

### 3.1 新建 `preload.cjs`

通过 `contextBridge` 暴露 `window.hongguotvDesktop`：

```javascript
{
  isDesktop: true,
  setFullScreen(flag): Promise<boolean>,      // 返回实际生效状态
  toggleFullScreen(): Promise<boolean>,
  isFullScreen(): Promise<boolean>,
  onFullScreenChanged(cb): () => void         // 返回取消订阅函数
}
```

### 3.2 IPC 通道（冻结，不可改名）

| 通道 | 方向 | 载荷 |
| --- | --- | --- |
| `fullscreen:set` | renderer → main | `boolean` |
| `fullscreen:toggle` | renderer → main | 无 |
| `fullscreen:is` | renderer → main | 无 |
| `fullscreen:changed` | main → renderer | `boolean` |

---

## 四、实现要求

### 4.1 `preload.cjs`（新建）

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hongguotvDesktop', {
  isDesktop: true,
  setFullScreen: (flag) => ipcRenderer.invoke('fullscreen:set', !!flag),
  toggleFullScreen: () => ipcRenderer.invoke('fullscreen:toggle'),
  isFullScreen: () => ipcRenderer.invoke('fullscreen:is'),
  onFullScreenChanged: (cb) => {
    const handler = (_e, flag) => cb(!!flag);
    ipcRenderer.on('fullscreen:changed', handler);
    return () => ipcRenderer.removeListener('fullscreen:changed', handler);
  },
});
```

**要求**：

- `contextIsolation` **必须保持 true**（安全）
- **不暴露** `ipcRenderer` 本身
- 只暴露上述 4 个方法

### 4.2 `main.cjs` 改动

| # | 改动 |
| --- | --- |
| 1 | `BrowserWindow` 配置 `webPreferences.preload` 指向 `preload.cjs` |
| 2 | 注册 4 个 IPC handler |
| 3 | 用 `win.setFullScreen(flag)` 实现全屏 |
| 4 | 监听窗口 `enter-full-screen` / `leave-full-screen`，**广播** `fullscreen:changed` |
| 5 | handler 中**校验 `win` 未被销毁**（防崩溃） |

**关键**：

- `setFullScreen` 是**异步生效**的 → 需等 `enter-full-screen` 事件后再返回真实状态
- 广播时检查 `win.webContents.isDestroyed()`

### 4.3 现有代码结构（供参考）

`main.cjs` 47 行，关键部分：

```javascript
function createWindow(){
  bootlog('creating-main-window');
  mainWindow = new BrowserWindow({
    width:1380, height:860, minWidth:1024, minHeight:640,
    title:'红果短剧', backgroundColor:'#030712', autoHideMenuBar:true,
    webPreferences:{ nodeIntegration:false, contextIsolation:true, webSecurity:true }
  });
  mainWindow.loadURL('hongguotv://app/');
  ...
}
```

**注意**：加载的是自定义协议 `hongguotv://app/`，不是 `file://`。

---

## 五、硬性约束

1. **只改这些文件**：
   - `apps/web-pc/electron/main.cjs`
   - `apps/web-pc/electron/preload.cjs`（**新建**）
2. **不要改** `apps/web-pc/src/` 下任何文件（**W2 的职责**）
3. **不要改** `apps/tv-android/`、`custom-server/`、`shared/`
4. **保持 `contextIsolation: true`** —— 不可为方便而关闭
5. **不要回退**任何已完成改动
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

| # | 项 | 验证方式 |
| --- | --- | --- |
| 1 | **窗口失焦后仍能全屏**（核心） | 切走窗口再回来，调用全屏 |
| 2 | 窗口**真正全屏**（非元素占满） | 窗口尺寸 == 屏幕尺寸 |
| 3 | 反复全屏/退出 10 次均成功 | 循环测试 |
| 4 | IPC 通道按 §3.2 实现 | 检查通道名 |
| 5 | `contextIsolation` 保持 true | 检查配置 |
| 6 | `onFullScreenChanged` 返回取消订阅函数 | 代码核实 |
| 7 | 窗口销毁后 handler 不崩溃 | 代码核实 |
| 8 | 打包后可用 | 重新构建并实测 |
| 9 | 报告写入 `.agents/shared/t-w3-electron-fullscreen-codex.md` | |

---

## 七、证据要求

### 构建

```powershell
# 1. 构建 Web 包（作为后端来源）
node scripts/build-bundles.mjs --platforms=win-x64

# 2. 打包桌面版
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never
```

产物：`outputs/windows/win-unpacked/红果短剧.exe`

### 实测

```powershell
# 带远程调试端口启动
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
```

然后用 CDP（`http://127.0.0.1:9222/json/list`）检查：

```javascript
// 检查桥接是否暴露
typeof window.hongguotvDesktop          // 应为 'object'

// 测试全屏
await window.hongguotvDesktop.toggleFullScreen()   // 应返回 true

// 反复测试（关键：验证不受焦点影响）
for (let i=0;i<10;i++){ await toggleFullScreen(); await toggleFullScreen(); }
```

**必须提供**：

1. **桥接暴露的证据**（`typeof window.hongguotvDesktop`）
2. **反复全屏 10 次的结果**
3. **窗口失焦后仍能全屏的证据**（核心）
4. **窗口尺寸 == 屏幕尺寸**的证据（`window.innerWidth/Height` vs `screen.width/height`）
5. 构建输出

### 清理

测试后**关闭 Electron 进程**，避免残留。

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `ELECTRON_RUN_AS_NODE` | 若设置，Electron 退化为纯 Node 模式（无窗口） |
| `setFullScreen` 异步 | 立即返回不代表已生效，需等事件 |
| 窗口销毁 | handler 中需检查 `win.isDestroyed()` |
| `preload` 路径 | 打包后路径与开发时不同，需用 `__dirname` 相对路径 |
| 自定义协议 | 页面是 `hongguotv://app/`，非 `file://` |
| 打包耗时 | electron-builder 较慢，首次可能下载 Electron |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-w3-electron-fullscreen codex "结论及报告路径"
```
