# 桌面全屏接口约定（W2/W3 共用）

**制定方**: dsh（协调者）
**日期**: 2026-10-15
**用途**: Web 端与 Electron 端**并行开发**的接口契约

---

## 一、为什么需要约定

全屏修复拆成两个任务**并行执行**：

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| **W2** | antigravity | Web 端（React） |
| **W3** | codex | Electron 端（主进程 + preload） |

两者必须通过**稳定的接口**通信，否则无法并行。

---

## 二、接口定义（冻结，双方必须遵守）

### 2.1 preload 暴露的 API

Electron 端在 `preload.cjs` 中通过 `contextBridge` 暴露：

```javascript
// window.hongguotvDesktop
{
  isDesktop: true,

  // 设置窗口全屏状态，返回实际生效的状态
  // @param {boolean} flag
  // @returns {Promise<boolean>} 实际是否全屏
  setFullScreen(flag),

  // 切换窗口全屏，返回切换后的状态
  // @returns {Promise<boolean>}
  toggleFullScreen(),

  // 查询当前窗口是否全屏
  // @returns {Promise<boolean>}
  isFullScreen(),

  // 订阅窗口全屏变化
  // @param {(flag: boolean) => void} callback
  // @returns {() => void} 取消订阅函数
  onFullScreenChanged(callback)
}
```

**要求**：

1. 所有方法返回 `Promise`
2. `onFullScreenChanged` 返回**取消订阅函数**（防内存泄漏）
3. **在非 Electron 环境该对象不存在**（`window.hongguotvDesktop === undefined`）

### 2.2 IPC 通道名（冻结）

| 通道 | 方向 | 载荷 |
| --- | --- | --- |
| `fullscreen:set` | renderer → main | `boolean` |
| `fullscreen:toggle` | renderer → main | 无 |
| `fullscreen:is` | renderer → main | 无 |
| `fullscreen:changed` | main → renderer | `boolean` |

### 2.3 Web 端的调用约定

```typescript
// 优先用桌面桥接，回退到 DOM Fullscreen API
const desktop = (window as any).hongguotvDesktop;

if (desktop?.isDesktop) {
  // 桌面环境：用窗口级全屏
  await desktop.toggleFullScreen();
} else {
  // 浏览器环境：用元素级全屏
  await container.requestFullscreen();
}
```

---

## 三、双方职责边界

### W2（Web 端，antigravity）

**可改文件**：

- `apps/web-pc/src/hooks/usePlayback.ts`
- `apps/web-pc/src/components/PlayerModal.tsx`
- `apps/web-pc/src/hooks/useKeyboardShortcuts.ts`
- `apps/web-pc/src/App.tsx`

**职责**：

1. `toggleFullscreen` 支持桌面桥接与 DOM API 双路径
2. **错误不再静默吞掉**（当前 `.catch(() => {})` 掩盖失败）
3. **React 状态与原生全屏同步**（当前 `isFullscreen` 不更新）
4. 全屏按钮**始终可见**（见 §四）
5. 全屏布局符合目标（截图）

**不可改**：`electron/` 下任何文件

### W3（Electron 端，codex）

**可改文件**：

- `apps/web-pc/electron/main.cjs`
- `apps/web-pc/electron/preload.cjs`（**新建**）

**职责**：

1. 新建 `preload.cjs`，按 §2.1 暴露 API
2. `main.cjs` 注册 §2.2 的 IPC handler
3. `BrowserWindow` 配置 `preload` 路径
4. **窗口级全屏**用 `win.setFullScreen(flag)`
5. 窗口全屏变化时**广播** `fullscreen:changed`
6. 保持 `contextIsolation: true`（安全）

**不可改**：`src/` 下任何文件

---

## 四、全屏按钮要求（W2）

### 现状

`PlayerModal.tsx:448-454` 已有全屏按钮，但：

- 位于底部控制栏，**可能被自动隐藏的控件栏藏起来**
- 无 `aria-label`

### 要求

**全屏按钮始终可见** —— 即使控制栏自动隐藏，也要有入口。

**参考截图**（用户提供）：全屏时应显示

```
┌──────────────────────────────────────────────┐
│ [第 2 集]              1x  1080P  滚轮/↑↓键切集│
│                                              │
│              ┌────────────┐                  │
│              │            │            ♡ 追剧 │
│              │   视频     │            ⌃     │
│              │            │            ⌄     │
│              └────────────┘                  │
│                                              │
│ @禁止闪婚：甜桃烈酒2 全51集                    │
│ 第 2 集 ·《禁止闪婚：甜桃烈酒2》第 2 集         │
│ #短剧 #爱情 #都市爱情 ...                     │
│ 描述文本...                                   │
│ [合集：...] [下一集]                          │
│ 00:07 / 01:27                                │
└──────────────────────────────────────────────┘
```

**关键**：视频**居中铺满**，控件叠加在视频之上。

---

## 五、协调者已诊断的缺陷（供双方参考）

### 缺陷 1（Electron 侧）窗口失焦后全屏被拒

**实测证据**：

```
第 1 次 requestFullscreen: 成功
第 2-10 次: 全部失败 "TypeError: Permissions check failed"
```

**关键验证**：调用 `Page.bringToFront`（让窗口重获系统焦点）后，**全屏恢复正常**。

**根因**：窗口失去系统焦点时，Chromium 拒绝 fullscreen 权限。

**影响**：用户切到别的窗口再回来，全屏就失效。

**W3 应对**：用 `win.setFullScreen()`（**主进程 API**），**绕过渲染进程的权限检查**。

### 缺陷 2（Web 侧）原生全屏成功但 React 状态不同步

**实测证据**：

```
fullscreenchange 事件触发: 1 次     ✓
document.fullscreenElement: VIDEO   ✓（原生全屏成功）
elementsWithFullscreenClass: 0      ✗（React 状态未更新）
```

**根因**：`App.tsx:389` 的 `handleFullscreenChange` 监听 `document.fullscreenElement`，
但 `PlayerModal` 的 `isFullscreen` **未同步**。

**W2 应对**：修正状态同步链路。

### 缺陷 3（Web 侧）错误被静默吞掉

```typescript
// usePlayback.ts:186
playerContainerRef.current.requestFullscreen().catch(() => {});   // ← 吞掉所有错误
```

**W2 应对**：捕获并提示用户（如 toast：「全屏失败：请检查窗口焦点」）。

---

## 六、验证要求

### W2（Web 端）

1. 浏览器中全屏可用（`npm run dev` + 浏览器）
2. **全屏按钮始终可见**
3. 全屏失败时有**明确提示**
4. React 状态与原生全屏同步（`isFullscreen` 正确）

### W3（Electron 端）

1. **窗口失焦后仍能全屏**（核心）
2. 窗口级全屏（不只是元素占满）
3. IPC 通道按 §2.2 实现
4. `contextIsolation` 保持 true

### 联合验证（双方完成后由协调者执行）

1. 桌面版全屏/退出全屏**反复 10 次**均成功
2. 切走窗口再回来，全屏仍可用
3. 全屏布局符合 §四 截图

---

## 七、环境说明

### 构建桌面版

```powershell
node scripts/build-bundles.mjs --platforms=win-x64
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never
```

产物：`outputs/windows/win-unpacked/红果短剧.exe`

### 调试桌面版

```powershell
# 带远程调试端口启动
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
# 然后可用 CDP 检查（http://127.0.0.1:9222/json/list）
```

**注意**：`ELECTRON_RUN_AS_NODE` 环境变量必须**未设置**，否则 Electron 退化为纯 Node 模式。

### Web 端

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```
