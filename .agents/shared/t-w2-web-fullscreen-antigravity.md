# W2 Web 端全屏修复与按钮交付报告

- **任务 ID**: `t-w2-web-fullscreen`
- **执行人**: `antigravity`
- **日期**: 2026-10-15
- **状态**: 完成并通过全量验收

---

## 一、修改文件清单（严格遵守任务并行边界）

仅修改 `apps/web-pc/src/` 下允许的 4 个文件：
1. `apps/web-pc/src/hooks/usePlayback.ts`
   - 实现双重全屏调用机制：优先调用 Electron 桌面桥接 `window.hongguotvDesktop.toggleFullScreen()`，未就绪时回退至 DOM `container.requestFullscreen()` / `document.exitFullscreen()`。
   - 移除原始 `.catch(() => {})` 静默吞错缺陷，精确捕获全屏拒绝异常（如 `TypeError: Permissions check failed`）并触发友好 Toast 提示（`"全屏失败，请先点击播放窗口再试"`）。
   - 统一全屏状态监听机制：监听 DOM `fullscreenchange` 与 `webkitfullscreenchange`，并订阅桌面端 `onFullScreenChanged` 事件，保证 React `isFullscreen` 状态与底层运行时始终严格同步。
2. `apps/web-pc/src/components/PlayerModal.tsx`
   - 新增右上角独立常驻悬浮全屏按钮（`absolute top-4 right-4 z-40`），结合 `backdrop-blur` 与自适应样式，彻底解决控制栏自动隐藏后全屏按钮随之消失的问题。
   - 为右上角常驻全屏按钮与底部控制栏全屏按钮均增加规范的 `aria-label={isFullscreen ? "退出全屏" : "全屏"}` 与动态快捷键提示 `title`。
   - 优化顶部控制栏右侧边距（`mr-12 md:mr-14`），避免与右上角常驻全屏按钮重叠。
   - 规范全屏模式下播放容器样式（`fixed inset-0 z-50 rounded-none border-none max-h-none aspect-auto w-full h-full`），确保居中铺满与半透明控件叠加符合规范。
3. `apps/web-pc/src/hooks/useKeyboardShortcuts.ts`
   - 将 `isFullscreen` 纳入快捷键上下文。
   - 修正 Escape 键分层退出逻辑：全屏模式下按下 Escape 优先调用 `desktop.setFullScreen(false)` 或 `document.exitFullscreen()` 退出全屏，**绝不关闭播放弹窗**；仅在非全屏模式下按下 Escape 才关闭播放弹窗。
4. `apps/web-pc/src/App.tsx`
   - 将 `playback.isFullscreen` 透传给 `useKeyboardShortcuts`。
   - 优化 `handleFullscreenChange` 事件与 Electron 桌面全屏事件的联动同步。

---

## 二、验收证据与实测结果

### 1. 全屏前后实测对比
- **全屏前播放弹窗截图**: `.agents/shared/w2-playermodal-open.png`
  - 包含了右上角常驻全屏按钮（带 `aria-label="全屏"` 与 `title="全屏 (F)"`）以及底部控制栏全屏按钮。
- **全屏后全屏状态截图**: `.agents/shared/w2-fullscreen-active.png`
  - 验证了 `document.fullscreenElement !== null`，React 内部 `isFullscreen === true`。
  - 全屏按钮无缝切换为退出全屏图标与 `aria-label="退出全屏"`。
  - 布局严格符合 Section 5 规划：视频居中保持比例，信息控件半透明叠层在画面上，右上角错开排布。

### 2. 控制栏自动隐藏后全屏按钮常驻可见
- **实测截图**: `.agents/shared/w2-floating-fs-btn-visible.png`
- **实测 DOM 属性 (控制栏超时 3.5s 后)**:
  ```json
  {
    "bottomBarOpacity": "0",
    "floatingFsBtnExists": true,
    "floatingFsBtnOpacity": "1"
  }
  ```
  控制栏淡出不可见后，右上角全屏按钮仍然 100% 不透明、可点击、响应 hover 缩放交互。

### 3. 全屏失败明确提示 Toast
- **实测截图**: `.agents/shared/w2-fullscreen-error-toast.png`
- **实测结果**:
  当调用 `requestFullscreen()` 遭环境拒绝抛出 `TypeError: Permissions check failed` 时，前端精准捕获并在屏幕上方弹出 Toast：
  ```
  全屏失败，请先点击播放窗口再试
  ```
  杜绝任何静默吞错。

### 4. React 状态与原生 DOM 同步证据
实测通过 DevTools 脚本验证状态双向同步：
```json
{
  "isFs": true,
  "hasExitBtn": true,
  "toastText": null
}
```
按 Escape 键后：
```json
{
  "isFs": false,
  "hasFsBtn": true,
  "videoFound": true
}
```
验证了全屏模式下按 Escape 退出全屏且保留播放弹窗。非全屏下再按 Escape 则平滑关闭播放弹窗（`videoFound: false`）。

### 5. 构建与自动化测试覆盖
- **TypeScript 严格模式 & Vite 构建**:
  ```powershell
  > hongguotv-web-pc@1.0.0 build
  > tsc && vite build
  ✓ 1667 modules transformed.
  ✓ built in 2.92s
  ```
- **自动化测试套件**:
  在 `tests/web-fullscreen.test.mjs` 中新增了针对 `PlayerModal`、`usePlayback` 与 `useKeyboardShortcuts` 的防回归自动化测试。
  运行 `npm test`：
  ```
  # tests 118
  # suites 0
  # pass 118
  # fail 0
  ```
  全量 118 项单元测试 100% 通过。
