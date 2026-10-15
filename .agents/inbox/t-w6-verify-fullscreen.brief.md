# W6 W4/W5 全屏成果 — 独立复核

**任务 ID**: `t-w6-verify-fullscreen`
**负责人**: **workbuddy**
**依赖**: 无（W4/W5 均已完成）
**协调者**: dsh

---

## 前置条件

先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 一、为什么需要本次复核

**W4/W5 是本轮唯一未经独立复核的任务。**

**复核理由**：

1. **W2 曾因协调者的错误 brief 做错方向** —— 说明该区域易出错
2. **W5 发现了真实缺陷**（全屏样式被 Tailwind 覆盖）—— 说明该区域确实有问题
3. 全屏是本轮**用户最关心的功能**，且涉及 **Web + Electron 双环境**

---

## 二、复核对象

| 任务 | 负责方 | 内容 |
| --- | --- | --- |
| **W4** | antigravity | 推荐流页面添加全屏按钮 |
| **W5** | codex | 详情页全屏（验证 + 补齐） |

**涉及文件**：

| 文件 | 行数 |
| --- | --- |
| `apps/web-pc/src/components/RecommendStream.tsx` | 739 |
| `apps/web-pc/src/components/PlayerModal.tsx` | 924 |
| `apps/web-pc/src/hooks/usePlayback.ts` | 421 |
| `apps/web-pc/src/hooks/useKeyboardShortcuts.ts` | — |
| `apps/web-pc/src/App.tsx` | — |

---

## 三、⚠️ 关键事实（避免重复踩坑）

### Web 与 Electron 是**同一套前端代码**

```
Electron loadURL('hongguotv://app/')
  → 协议转发给内置后端
  → 后端 serve apps/web-pc/dist
  → dist 由 apps/web-pc/src 构建
```

**所以**：不存在「Web 版」与「Electron 版」两份代码，
**唯一区别是 `window.hongguotvDesktop` 是否存在**。

### 两个不同的页面（易混淆）

| 页面 | 组件 | 全屏按钮 |
| --- | --- | --- |
| **推荐流** | `RecommendStream.tsx` | **W4 新增**（右上角，倍速/画质旁） |
| **详情页/播放弹窗** | `PlayerModal.tsx` | **本来就有**（底部控制栏） |

**协调者此前就是混淆了这两个页面，导致 W2 做错方向。**
**复核时务必先确认页面。**

---

## 四、要核查的事项

### 4.1 推荐流全屏按钮（W4）

| # | 核查项 | 方法 |
| --- | --- | --- |
| 1 | **推荐流右上角有全屏按钮** | 进入首页（推荐流），截图 |
| 2 | 点击可进入全屏 | 实测 |
| 3 | **全屏时控件不丢失** | 截图确认：第N集徽标、倍速、画质、追剧、上下箭头、剧名、进度条 |
| 4 | 竖版视频居中（两侧黑边） | 截图 |
| 5 | 双击视频可切换全屏 | 实测 |
| 6 | F 键可切换全屏 | 实测 |

### 4.2 详情页全屏（W5）

| # | 核查项 | 方法 |
| --- | --- | --- |
| 7 | **全屏布局符合「图二」** | 对照 `.agents/shared/ref-fig2-other-page-fullscreen.png` |
| 8 | 播放器**填满屏幕** | 检查 `player.width === screen.width` |
| 9 | **W5 声称修复的缺陷**（player 1104×621 → 2304×1536） | 独立测量 |
| 10 | **详情页无冗余悬浮按钮** | 确认 W2 误加的按钮已被移除 |

### 4.3 🔴 自动下一集（用户核心要求）

| # | 核查项 |
| --- | --- |
| 11 | **全屏状态下，视频播完是否自动切下一集** |
| 12 | 切换后**是否仍保持全屏** |

**W5 声称的验证方法**：

> 视频为 ffmpeg 生成的本地 12 秒 H.264 测试片，
> 第一集 seek 至距结尾 0.4 秒后继续真实播放，
> 由浏览器产生 ended 事件，**并非手动 dispatch ended**。

**请独立验证**，不要直接采信。

### 4.4 🔴 屏幕级全屏（用户核心要求）

| # | 核查项 |
| --- | --- |
| 13 | `window.innerWidth === screen.width` 且高度相等 |
| 14 | **不是窗口最大化**（`outerWidth < screen.width` 说明是窗口而非屏幕） |

**注意区分**：

| 方式 | 表现 |
| --- | --- |
| **屏幕全屏**（要求） | `innerWidth === screen.width` |
| 窗口最大化（不符） | `innerWidth < screen.width`（含边框/任务栏） |

### 4.5 两端一致性

| # | 核查项 |
| --- | --- |
| 15 | 浏览器与 Electron 的全屏效果是否一致 |
| 16 | 桌面端是否走桥接（`window.hongguotvDesktop`） |
| 17 | 浏览器是否回退 DOM API |

### 4.6 边界与回归

| # | 核查项 |
| --- | --- |
| 18 | Escape 退出全屏，**不关闭播放器** |
| 19 | 全屏失败时有提示（非静默） |
| 20 | **反复切换全屏 10 次**是否稳定 |
| 21 | 详情页与推荐流**互不影响** |
| 22 | 是否有越界改动（对照 W4/W5 授权文件） |
| 23 | 是否有调试日志残留 |

---

## 五、独立验证手段

### 5.1 浏览器端

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器：`http://127.0.0.1:3000`

**用 chrome-devtools-mcp**：

- `navigate_page` → `http://127.0.0.1:3000`
- **先确认在推荐流还是详情页**
- 点击全屏，`evaluate_script` 读几何数据
- `take_screenshot` 记录

### 5.2 Electron 端

```powershell
npm run build
node scripts/build-bundles.mjs --platforms=win-x64
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never

Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
```

CDP 端点：`http://127.0.0.1:9222/json/list`

### 5.3 ⚠️ Playwright 焦点模拟陷阱（W5 报告提到）

W5 报告称：

> 初次浏览器尺寸异常由 Playwright 的焦点模拟抑制原生窗口全屏造成：
> `document.fullscreenElement=true` 但仍保持普通窗口高度。
> 依据 [Playwright issue #19720](https://github.com/microsoft/playwright/issues/19720)，
> 在辅助脚本进程内禁用原始 CDP session 的 focus emulation 后，验证通过。

**若你遇到同样现象，先排除该干扰，不要误判为产品缺陷。**

### 5.4 独立测量脚本建议

```javascript
// 在页面中执行，返回几何数据
JSON.stringify({
  screen: [screen.width, screen.height],
  inner: [window.innerWidth, window.innerHeight],
  outer: [window.outerWidth, window.outerHeight],
  fsElement: document.fullscreenElement?.tagName || null,
  isDesktop: typeof window.hongguotvDesktop === 'object',
})
```

**判定**：

- 屏幕全屏：`inner[0] === screen[0] && inner[1] === screen[1]`
- 窗口最大化（不符）：`inner[0] < screen[0]`

---

## 六、硬性约束

1. **只读复核，不修改任何代码**
2. 不执行 `git checkout` / `git reset` / `git clean`
3. **区分「已核实」与「推测」**
4. 当前 shell 是 **Windows PowerShell 5.1**
5. 测试后**清理启动的进程**（Electron、Vite、后端）

---

## 七、验收标准

1. 报告明确列出：**已核实事实 / 无法核实项 / 发现的问题 / 改进建议**
2. **推荐流全屏按钮**：明确结论
3. **详情页全屏符合图二**：明确结论
4. 🔴 **自动下一集在全屏下工作**：明确结论 + 证据
5. 🔴 **屏幕级全屏（非窗口）**：给出几何数据
6. **两端一致性**：明确结论
7. **边界**（Escape、失败提示、反复切换）：明确结论
8. **越界改动**与**调试日志残留**：明确说明
9. 每条结论附**证据**（截图文件名 / 几何数据 / 代码行号）
10. 报告写入 `.agents/shared/t-w6-verify-fullscreen-workbuddy.md`

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **页面混淆** | 推荐流（`RecommendStream`）≠ 详情页（`PlayerModal`）——**协调者曾因此做错** |
| **代码共用** | Web 与 Electron 是同一份 `dist` |
| Playwright 焦点模拟 | 会抑制原生全屏，需排除 |
| `ELECTRON_RUN_AS_NODE` | 若设置，Electron 退化为纯 Node 模式 |
| 窗口全屏 ≠ 屏幕全屏 | 用 `innerWidth` vs `screen.width` 区分 |
| 进程残留 | 测试后必须清理 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-w6-verify-fullscreen workbuddy "结论及报告路径"
```
