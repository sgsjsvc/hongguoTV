# 全屏任务分工（更正版）

**发布方**: dsh（协调者）
**日期**: 2026-10-15

---

## 一、关键事实：Web 与 Electron 是**同一套前端代码**

**用户提问**：「我记得 web 和 Electron 是同一个页面，是不是？」

**答：是。** 完整链条：

```
1. Electron 主进程：mainWindow.loadURL('hongguotv://app/')
2. hongguotv:// 协议被拦截 → 转发给内置后端
3. 内置后端 serve 静态文件：DIST_DIR = apps/web-pc/dist
4. dist 由 apps/web-pc/src 构建（vite build）
```

**结论**：

| 端 | 加载的代码 | 运行时差异 |
| --- | --- | --- |
| 浏览器（`:3000` / `:8788`） | `apps/web-pc/src` → `dist` | `window.hongguotvDesktop === undefined` |
| Electron 桌面版 | **同一份** `dist` | `window.hongguotvDesktop` 由 preload 注入 |

**因此**：改一次前端代码，**两端都生效**。
桌面端会自动走桥接分支（`desktop?.isDesktop`），浏览器走 DOM API 分支。

**这也解释了为什么 W2 一处改动同时修复了 Web 与 Electron** —— 它们本就是同一页面。

---

## 二、更正后的分工（2 个任务）

| 任务 | 负责方 | 页面 | 文件 |
| --- | --- | --- | --- |
| **W5** | **一个 agent** | **详情页全屏**（其他页面） | `PlayerModal.tsx` 等 |
| **W4** | **另一个 agent** | **推荐流全屏** | `RecommendStream.tsx` |

**为什么只需 2 个任务**：Web 与 Electron 共用代码，
**不存在「Web 详情页」与「Electron 详情页」两个独立任务**。

---

## 三、页面区分（两个任务各管一个）

### 页面 A：详情页 / 播放弹窗

| 项 | 值 |
| --- | --- |
| 组件 | `PlayerModal.tsx`（935 行） |
| 入口 | 从首页/分类/榜单/搜索点剧集进入 |
| 现状 | **已有全屏按钮**（底部控制栏） |
| 目标效果 | **图二** |

**图二（其他页面全屏）**：

```
┌──────────────────────────────────────────────┐
│ ← 京夜诱温  第1集  官方画质:1080P      ⚙  ⛶  │
│                                              │
│                    ▶                         │
│                                              │
│                                              │
│                                              │
│ ⏸ ‹ ›  01:13/02:03  1x 1080P 连播:开 🔊 ⛶   │
└──────────────────────────────────────────────┘
```

**特征**：

- 左上：`← 剧名  第N集  官方画质:1080P`
- 右上：`⚙`（设置/画质）+ `⛶`（全屏）
- 中间：视频 + 播放按钮
- 底部控制栏：`⏸` `‹` `›` 进度时间 `1x` `1080P` `连播:开` `🔊` `⛶`

**用户判定**：**W2 已符合图二，不需重做。**

### 页面 B：推荐流

| 项 | 值 |
| --- | --- |
| 组件 | `RecommendStream.tsx`（608 行） |
| 入口 | 首页默认页（沉浸式推荐流） |
| 现状 | **没有任何全屏功能** |
| 目标效果 | **图一** |

**图一（推荐页全屏）**：

```
┌──────────────────────────────────────────────────┐
│ [第 1 集]                1x  1080P  滚轮/↑↓键切剧 │
│                                                  │
│              ┌──────────────┐                    │
│              │              │              ♡     │
│              │  竖版视频     │            追剧     │
│              │  (居中)       │              ⌃     │
│              │              │              ⌄     │
│              └──────────────┘                    │
│                                                  │
│ @我李长生重回八零，赶山狩猎养妻女 全168集          │
│ 第 1 集 ·《我李长生重回八零，赶山狩猎养妻女》第 1 集│
│ #短剧 #种田 #重生 #逆袭 #年代 #乡村               │
│ 描述文本...                                       │
│ [合集：我李长生重回八零，赶山狩猎养妻女｜全168集 >] │
│ [下一集]                                          │
│ 00:00 / 00:00                                    │
└──────────────────────────────────────────────────┘
```

**特征**：

- **竖版视频居中**，两侧大面积黑边
- 左上：`第 1 集` 徽标（红底）
- 右上：`1x` `1080P` `滚轮/↑↓键切剧` ← **全屏按钮加在这一区**
- 右侧：`♡ 追剧` + 上/下切集箭头
- 左下：剧名、集数、标签、描述、合集/下一集按钮
- 底部：进度条 + 时间

---

## 四、两条通用要求（两个任务都适用）

### 4.1 保留自动下一集

> 全屏后保留自动下一集功能

| 页面 | 自动下一集实现 |
| --- | --- |
| 推荐流 | `RecommendStream.tsx:219-232` → `handleStreamNextEpisode(true)` |
| 详情页 | `App.tsx:423` → `if (playback.autoPlayNext) { ... }` |

**要求**：**全屏状态下必须继续工作**，列为验收项。

### 4.2 整个屏幕全屏，不是窗口全屏

> 全屏是整个屏幕全屏

**W3 已实现的方案是正确的**：

```javascript
// apps/web-pc/electron/main.cjs
win.setFullScreen(flag)     // ← 屏幕级全屏
```

**要求**：

- 桌面端：`window.hongguotvDesktop.setFullScreen(true)` → 屏幕全屏
- 浏览器：`requestFullscreen()` → 屏幕全屏
- **不要**用 `win.maximize()` 或 CSS 模拟

**验证**：`window.innerWidth === screen.width`（且高度相等）

---

## 五、任务文件

| 任务 | brief |
| --- | --- |
| **W5** 详情页全屏 | `.agents/inbox/t-w5-detail-fullscreen.brief.md` |
| **W4** 推荐流全屏 | `.agents/inbox/t-w4-stream-fullscreen.brief.md` |

**文件边界**：

| 任务 | 主要文件 |
| --- | --- |
| W5 | `PlayerModal.tsx`、`usePlayback.ts`（如需） |
| W4 | `RecommendStream.tsx` |

**潜在冲突**：两者都可能需要 `usePlayback.ts` 或 `App.tsx`。
→ **若需改共用文件，先声明**（见各 brief 的约束）。

---

## 六、W2 已完成工作的处置

W2 改了 4 个文件，技术实现**正确**：

| 文件 | 处置 |
| --- | --- |
| `usePlayback.ts` | **保留** —— 桥接调用、错误提示、状态同步都对 |
| `PlayerModal.tsx` | **保留** —— 用户确认已符合图二 |
| `useKeyboardShortcuts.ts` | **保留** —— Escape 分层退出正确 |
| `App.tsx` | **保留** —— 状态同步正确 |

**用户判定**：**W2 已符合图二，不需重做。**

**W5 的任务**：**验证** W2 的成果是否符合图二 + 修复发现的差距（若有）。

---

## 七、环境说明

### Web 端

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器：`http://127.0.0.1:3000`

### Electron 端

```powershell
# 1. 构建前端
npm run build

# 2. 构建 Web 包（后端来源）
node scripts/build-bundles.mjs --platforms=win-x64

# 3. 打包桌面版
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never

# 4. 运行（带调试端口）
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
```

**注意**：`ELECTRON_RUN_AS_NODE` 必须**未设置**，否则 Electron 退化为纯 Node 模式。
