# W5 详情页全屏（验证 + 补齐）

**任务 ID**: `t-w5-detail-fullscreen`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: 详情页/播放弹窗的全屏

**相关文档**：

- 任务分工总览：`.agents/shared/fullscreen-task-split.md`
- 图二参考图：`.agents/shared/ref-fig2-other-page-fullscreen.png`
- 需求更正说明：`.agents/shared/fullscreen-requirement-correction.md`

**分工**：

| 任务 | 负责方 | 页面 |
| --- | --- | --- |
| **W5**（本任务） | **codex** | 详情页/播放弹窗（`PlayerModal.tsx`） |
| W4 | antigravity | 推荐流（`RecommendStream.tsx`） |

---

## 〇、背景

### 关键事实：Web 与 Electron 是**同一套前端代码**

**用户提问**：「我记得 web 和 Electron 是同一个页面，是不是？」

**答：是。** 链条：

```
Electron 主进程 loadURL('hongguotv://app/')
  → 协议转发给内置后端
  → 后端 serve apps/web-pc/dist
  → dist 由 apps/web-pc/src 构建
```

**因此**：改一次前端代码，**Web 与 Electron 两端都生效**。
桌面端自动走桥接分支（`desktop?.isDesktop`），浏览器走 DOM API。

**所以本任务不存在「Web 详情页」与「Electron 详情页」两个独立任务。**

完整说明见 `.agents/shared/fullscreen-task-split.md`。

---

## 一、任务目标

**详情页/播放弹窗的全屏**需符合**图二**。

**用户判定**：W2 已符合图二，**不需重做**。

**因此本任务 = 验证 + 补齐差距（若有）**。

---

## 二、目标效果（图二）

**参考图**：`.agents/shared/ref-fig2-other-page-fullscreen.png`

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

| 位置 | 元素 |
| --- | --- |
| 左上 | `←` 返回、剧名、`第N集`、`官方画质:1080P` |
| 右上 | `⚙`（设置/画质）、`⛶`（全屏） |
| 中间 | 视频 + 播放按钮（居中） |
| 底部控制栏 | `⏸`、`‹`、`›`、`00:54/02:48`、`1x`、`1080P`、`连播:开`、`🔊` 音量条、`⛶` |

---

## 三、要验证的项

### 3.1 布局是否符合图二

逐项对照上表，**截图比对**。

### 3.2 🔴 全屏下自动下一集是否保留

> 用户明确要求：全屏后保留自动下一集功能

**详情页的实现**：`App.tsx:423`

```typescript
if (playback.autoPlayNext) { ... }
```

**验证**：全屏状态下让视频播完，确认**自动切到下一集**。

### 3.3 🔴 是否屏幕级全屏（非窗口全屏）

> 用户明确要求：全屏是整个屏幕全屏

**W3 已实现**（`main.cjs`）：`win.setFullScreen(flag)` —— 屏幕级。

**验证方式**：

```javascript
// Electron 中
window.innerWidth === screen.width && window.innerHeight === screen.height

// 浏览器中
window.innerWidth === screen.width
```

**注意**：浏览器全屏时 `window.innerWidth` 应等于 `screen.width`。

### 3.4 两端一致性

| 环境 | 期望 |
| --- | --- |
| 浏览器（`:3000`） | DOM API 全屏，效果符合图二 |
| Electron 桌面版 | 桥接全屏，效果符合图二 |

**两端视觉应一致**。

### 3.5 已知缺陷是否仍存在

协调者此前实测发现的缺陷：

| # | 缺陷 | 状态 |
| --- | --- | --- |
| 1 | `.catch(() => {})` 静默吞错 | W2 已修（改为 toast 提示） |
| 2 | 原生全屏成功但 React 状态未同步 | W2 已修 |
| 3 | 全屏按钮随控制栏隐藏 | W2 已加常驻按钮 |
| 4 | Electron 窗口失焦后全屏被拒 | W3 已用 `setFullScreen` 绕过 |

**要求**：逐项复测确认已修复。

---

## 四、可能的补充工作

**若验证发现差距**，按需修复：

| 差距 | 修复方向 |
| --- | --- |
| 布局与图二不符 | 调整 `PlayerModal.tsx` 全屏样式 |
| 自动下一集在全屏下失效 | 检查 `autoPlayNext` 在全屏状态的处理 |
| 非屏幕级全屏 | 确认走 `setFullScreen` 而非 CSS 模拟 |
| 两端效果不一致 | 统一分支逻辑 |

**若验证全部通过**：如实报告「无需改动」，并给出证据。

---

## 五、硬性约束

1. **主要改这些文件**（如需）：
   - `apps/web-pc/src/components/PlayerModal.tsx`
   - `apps/web-pc/src/hooks/usePlayback.ts`
2. **不要改** `apps/web-pc/src/components/RecommendStream.tsx`（**W4 的职责**）
3. **不要改** `apps/web-pc/electron/`（W3 成果，保留）
4. **不要改** `apps/tv-android/`、`custom-server/`、`shared/`
5. **不要回退** W2/W3 的有效成果
6. 保持 TypeScript 严格模式通过
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

| # | 项 | 验证方式 |
| --- | --- | --- |
| 1 | 全屏布局符合图二 | 截图对比 `ref-fig2-other-page-fullscreen.png` |
| 2 | 🔴 **全屏下自动下一集仍工作** | 全屏后播完，确认自动切集 |
| 3 | 🔴 **屏幕级全屏** | `window.innerWidth === screen.width` |
| 4 | 浏览器与 Electron 效果一致 | 两端各截图对比 |
| 5 | 4 个已知缺陷已修复 | 逐项复测 |
| 6 | Escape 退出全屏（不关闭弹窗） | 实测 |
| 7 | 全屏失败时有提示 | 构造失败场景 |
| 8 | `npm run typecheck` / `npm run build` 通过 | |
| 9 | 报告写入 `.agents/shared/t-w5-detail-fullscreen-<身份>.md` | |

---

## 七、证据要求

### 环境

**Web 端**：

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器：`http://127.0.0.1:3000` → 点任意剧集进入详情页 → 点全屏

**Electron 端**：

```powershell
npm run build
node scripts/build-bundles.mjs --platforms=win-x64
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never

Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
```

### 必须提供

1. **Web 端全屏截图**（对照图二）
2. **Electron 端全屏截图**（对照图二）
3. 🔴 **自动下一集的证据**（全屏后播完自动切集）
4. 🔴 **屏幕级全屏的证据**（`window.innerWidth/Height` vs `screen.width/height`）
5. **4 个已知缺陷的复测结果**
6. `typecheck` / `build` 输出

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **代码共用** | Web 与 Electron 是同一份 `dist`，改一次两端生效 |
| **窗口全屏 ≠ 屏幕全屏** | 必须 `setFullScreen`，不用 `maximize` |
| **自动下一集** | 全屏后不能失效 |
| `ELECTRON_RUN_AS_NODE` | 若设置，Electron 退化为纯 Node 模式 |
| 窗口失焦 | 渲染进程全屏会被拒，用桌面桥接 |
| 控制栏自动隐藏 | 全屏按钮需常驻 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-w5-detail-fullscreen <你的身份> "结论及报告路径"
```
