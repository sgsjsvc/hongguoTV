# W4 推荐流页面添加全屏按钮

**任务 ID**: `t-w4-stream-fullscreen`
**负责人**: antigravity
**依赖**: 无（W2/W3 已完成）
**协调者**: dsh
**范围**: **仅推荐流**（`apps/web-pc/src/components/RecommendStream.tsx`）

**相关文档**：

- 任务分工总览：`.agents/shared/fullscreen-task-split.md`
- 图二参考图：`.agents/shared/ref-fig2-other-page-fullscreen.png`
- 需求更正说明：`.agents/shared/fullscreen-requirement-correction.md`

**⚠️ 关键事实**：Web 与 Electron 是**同一套前端代码**（`apps/web-pc/src` → `dist`），
改一次**两端都生效**。桌面端自动走桥接分支，浏览器走 DOM API。

---

## 〇、背景：协调者的派发错误已更正

**我（协调者）此前把任务目标搞错了。**

| | 我原本派发的 | 用户实际要的 |
| --- | --- | --- |
| W2 改的 | `PlayerModal.tsx`（**详情页**） | **推荐流页面** |
| 问题 | 详情页**本来就有全屏按钮** | 推荐流**没有任何全屏功能** |

**用户原话**：

> 全屏按钮全部添加的位置都错了，现在添加的页面本来就有全屏按钮。
> 我让你添加的时**推荐页面**添加。

**这不是你的错误**，是我的 brief 没区分清楚页面。
完整说明见 `.agents/shared/fullscreen-requirement-correction.md`。

---

## 一、任务目标

在**推荐流页面**添加全屏按钮，并确保全屏效果符合**图一**。

**当前状态**：推荐流**没有任何全屏功能**。

---

## 二、两张效果图（用户提供，务必对照）

### 图一：**推荐页全屏**（本任务的目标效果）

```
┌──────────────────────────────────────────────────┐
│ [第 1 集]                1x  1080P  滚轮/↑↓键切剧 │
│                                                  │
│                                                  │
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
│ #短剧 #种田 #重生 #逆袭 #年代 #乡村 #种田 #重生    │
│ 描述文本...                                       │
│ [合集：我李长生重回八零，赶山狩猎养妻女｜全168集 >] │
│ [下一集]                                          │
│ 00:00 / 00:00                                    │
└──────────────────────────────────────────────────┘
```

**特征**：

- **竖版视频居中**，两侧大面积黑边
- 左上：`第 1 集` 徽标（红底）
- **右上：`1x` 倍速 / `1080P` 画质 / 提示文字**（全屏按钮加在这一区）
- 右侧：`♡ 追剧` 按钮 + 上/下切集箭头
- 左下：剧名、集数、标签、描述、合集/下一集按钮
- 底部：进度条 + 时间

### 图二：**其他页面全屏**（详情页，**已实现**，作为参考）

```
┌──────────────────────────────────────────────────┐
│ ← 京夜诱温  第1集  官方画质:1080P         ⚙  ⛶  │
│                                                  │
│                                                  │
│                    ▶                             │
│                                                  │
│                                                  │
│                                                  │
│                                                  │
│                                                  │
│                                                  │
│                                                  │
│ ⏸  ‹  ›   01:13 / 02:03   1x  1080P  连播:开  🔊  ⛶│
└──────────────────────────────────────────────────┘
```

**说明**：这是 `PlayerModal`（详情页）的全屏效果，**已有全屏按钮**，**不需要改**。
作为「其他页面全屏」的参考。

---

## 三、⚠️ 关键要求（用户特别强调）

### 3.1 **保留自动下一集**

> 全屏后保留自动下一集功能

**现状**：推荐流的自动连播已实现：

| 位置 | 内容 |
| --- | --- |
| `RecommendStream.tsx:219` | `onEnded={() => { ... }}` |
| `RecommendStream.tsx:232` | `handleStreamNextEpisode(true)` ← **自动下一集** |
| `App.tsx:423` | `if (playback.autoPlayNext) { ... }` |

**要求**：**全屏状态下，自动下一集必须继续工作**。

**验证**：全屏后让视频播完，确认自动切到下一集。

### 3.2 **整个屏幕全屏，不是窗口全屏**

> 全屏是整个屏幕全屏不是在窗口全屏

**W3 已实现的方案是正确的**：

```javascript
// apps/web-pc/electron/main.cjs
win.setFullScreen(flag)
```

`setFullScreen` 是**屏幕级全屏**（真全屏），不是 `win.maximize()`（窗口最大化）。

**要求**：

- 桌面端：走 `window.hongguotvDesktop.setFullScreen(true)` → 屏幕全屏
- 浏览器：走 `requestFullscreen()` → 屏幕全屏
- **不要**用 `win.maximize()` 或 CSS 模拟

**验证**：

- 全屏后窗口应覆盖**整个屏幕**（含任务栏区域）
- `window.innerWidth/innerHeight` 应等于 `screen.width/height`

---

## 四、目标位置

### 文件

`apps/web-pc/src/components/RecommendStream.tsx`（608 行）

### 结构（关键行）

| 行 | 内容 |
| --- | --- |
| 141 | 播放器主容器 |
| 165 | 视频容器 `absolute inset-0 z-0` |
| 179-185 | `<video>` 元素 |
| 273-274 | **顶部状态栏** `flex items-center justify-between` |
| 275-284 | 左侧：`第 N 集` 徽标 + 横屏剧标记 |
| **286** | **右侧按钮区** ← **全屏按钮加在这里** |
| 288-333 | 倍速菜单 |
| 334-... | 画质菜单 |
| 219-232 | `onEnded` → 自动下一集 |

---

## 五、实现要求

### 5.1 全屏按钮

| 项 | 要求 |
| --- | --- |
| 位置 | `RecommendStream.tsx:286` 右侧按钮区（**倍速/画质旁边**，与图一一致） |
| 图标 | `lucide-react` 的 `Maximize` / `Minimize` |
| 样式 | 与相邻倍速/画质按钮**风格一致**（圆角、`backdrop-blur`、`bg-black/60`） |
| 无障碍 | `aria-label`（`全屏` / `退出全屏`）+ `title`（含快捷键） |

### 5.2 全屏逻辑

**复用 W2 已实现的基础设施**：

```typescript
const desktop = (window as any).hongguotvDesktop;

if (desktop?.isDesktop) {
  await desktop.toggleFullScreen();   // 屏幕级全屏
} else {
  await container.requestFullscreen();
}
```

**要求**：

1. **错误不静默吞掉** —— 失败时提示
2. **React 状态与原生同步** —— 监听 `fullscreenchange` + 桥接事件
3. **Escape 退出全屏**（不关闭其他 UI）
4. **自动下一集在全屏下继续工作**（见 §3.1）

### 5.3 全屏时布局

**必须符合图一**：

- **竖版视频居中**，两侧黑边（`object-contain`）
- 控件**叠加**在视频之上，**不丢失**
- 左上 `第 N 集`、右上 倍速/画质/全屏、右侧 追剧+箭头、左下 剧名等信息、底部 进度条

### 5.4 与详情页的关系

**不要改 `PlayerModal.tsx`** —— 详情页已有全屏（图二）。

**评估**：W2 在 `PlayerModal.tsx` 新增的**右上角悬浮全屏按钮**是否多余？

- 图二显示详情页**底部控制栏已有全屏按钮**（右下角 ⛶）
- **你判断**：若确认冗余可移除（报告说明理由）；若认为有价值则保留

---

## 六、硬性约束

1. **主要改**：`apps/web-pc/src/components/RecommendStream.tsx`
2. **可评估调整**：`apps/web-pc/src/components/PlayerModal.tsx`（移除冗余，需说明）
3. **不要改** `apps/web-pc/electron/`（W3 成果，保留）
4. **不要改** `apps/tv-android/`、`custom-server/`、`shared/`
5. **不要回退** W2 的有效成果（桥接调用、状态同步、错误提示）
6. 保持 TypeScript 严格模式通过
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 七、验收标准

| # | 项 | 验证方式 |
| --- | --- | --- |
| 1 | **推荐流右上角有全屏按钮** | 截图（对照图一） |
| 2 | 点击进入**屏幕级全屏** | `window.innerWidth == screen.width` |
| 3 | **全屏布局符合图一** | 截图对比 |
| 4 | **全屏时控件不丢失** | 截图（集数/倍速/画质/追剧/箭头/进度条） |
| 5 | 🔴 **全屏下自动下一集仍工作** | 全屏后播完，确认自动切集 |
| 6 | 全屏失败时有提示 | 构造失败场景 |
| 7 | Escape 退出全屏 | 实测 |
| 8 | **详情页行为不变** | 截图（对照图二） |
| 9 | 桌面桥接优先，浏览器回退 | 两种环境各测 |
| 10 | `npm run typecheck` / `npm run build` 通过 | |
| 11 | 报告写入 `.agents/shared/t-w4-stream-fullscreen-antigravity.md` | |

---

## 八、证据要求

### 环境

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器访问 `http://127.0.0.1:3000`，**确认在推荐流页面**（首页默认页）。

### 必须提供

1. **推荐流全屏前的截图**（显示右上角全屏按钮）
2. **推荐流全屏后的截图**（**对照图一**）
3. **全屏时控件完整的证据**
4. 🔴 **自动下一集的证据**：全屏后播完自动切集（截图或日志）
5. **屏幕级全屏的证据**：`window.innerWidth/Height` vs `screen.width/height`
6. **详情页未受影响的截图**（对照图二）
7. `typecheck` / `build` 输出

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **页面区分** | 推荐流（`RecommendStream`）≠ 详情页（`PlayerModal`） |
| **窗口全屏 ≠ 屏幕全屏** | 必须用 `setFullScreen`，不用 `maximize` |
| **自动下一集** | 全屏后不能失效（用户明确要求） |
| 控制栏自动隐藏 | 全屏按钮需常驻 |
| 竖版视频 | 推荐流多为 9:16，全屏时两侧应有黑边 |
| 窗口失焦 | Electron 中渲染进程全屏会被拒，用桌面桥接 |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-w4-stream-fullscreen antigravity "结论及报告路径"
```
