# W2 Web 端全屏修复与按钮

**任务 ID**: `t-w2-web-fullscreen`
**负责人**: antigravity
**依赖**: 无（与 W3 并行）
**协调者**: dsh
**范围**: **仅 Web 端**（`apps/web-pc/src/`）

---

## 一、用户需求

> 解决一下 web 端和电脑端视频不能全屏的问题
> 添加一个全屏按钮

**本任务**：Web 端（浏览器）部分。
**W3**（codex）负责 Electron 桌面端。

---

## 二、接口约定（必读）

**完整契约见** `.agents/shared/fullscreen-interface.md`

**你要调用 Electron 暴露的桥接**（W3 会实现）：

```typescript
const desktop = (window as any).hongguotvDesktop;

if (desktop?.isDesktop) {
  await desktop.toggleFullScreen();          // 桌面：窗口级全屏
} else {
  await container.requestFullscreen();       // 浏览器：元素级全屏
}
```

**注意**：W3 可能尚未完成。**你要写兼容代码** —— 桌面桥接不存在时回退到 DOM API。

---

## 三、要修复的缺陷（协调者已实测）

### 缺陷 1：错误被静默吞掉（严重）

**位置**：`apps/web-pc/src/hooks/usePlayback.ts:184-188`

```typescript
const toggleFullscreen = useCallback(() => {
  if (!playerContainerRef.current) return;
  if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}, []);
```

**问题**：`.catch(() => {})` **吞掉所有错误** —— 用户点了全屏没反应，且**没有任何提示**。

**实测**：全屏确实会失败（如窗口失焦时抛 `TypeError: Permissions check failed`），
但用户完全不知道发生了什么。

**要求**：

- 捕获错误并**提示用户**（用现有的 `showToast`）
- 提示内容要**可操作**，例如：「全屏失败，请先点击窗口再试」

### 缺陷 2：React 状态与原生全屏不同步（严重）

**实测证据**（Electron 中）：

```
fullscreenchange 事件触发: 1 次     ✓
document.fullscreenElement: VIDEO   ✓（原生全屏成功）
elementsWithFullscreenClass: 0      ✗（React 状态未更新）
```

**现象**：原生全屏成功了，但 `isFullscreen` 为 `false` → **全屏样式类没应用** → 布局不对。

**相关代码**：

| 位置 | 内容 |
| --- | --- |
| `usePlayback.ts:22` | `const [isFullscreen, setIsFullscreen] = useState(false);` |
| `App.tsx:389-393` | `handleFullscreenChange` 监听 `fullscreenchange` 更新状态 |
| `App.tsx:514-515` | 把 `isFullscreen` 传给 `PlayerModal` |
| `PlayerModal.tsx:182` | 用 `isFullscreen` 决定样式类 |

**要求**：修正状态同步链路，确保原生全屏后 `isFullscreen` 为 `true`。

**注意**：状态可能有多处来源（DOM API / 桌面桥接），需统一。

### 缺陷 3：`Escape` 键行为

`useKeyboardShortcuts.ts:45-59` 已处理 Escape，但需确认：

- 全屏时按 Escape 应**退出全屏**
- 不应同时触发「关闭播放器」

---

## 四、新增全屏按钮（用户明确要求）

### 现状

`PlayerModal.tsx:447-454` **已有**全屏按钮，但：

- 位于底部控制栏
- 控制栏**会自动隐藏**（`resetControlsTimer`）→ 按钮随之消失
- 无 `aria-label`

### 要求

**全屏按钮必须始终可见** —— 即使控制栏隐藏，也要能进入全屏。

**建议方案**（择一，说明理由）：

| 方案 | 说明 |
| --- | --- |
| A | 把全屏按钮**独立**放在右上角（不随控制栏隐藏） |
| B | 控制栏隐藏时，保留全屏按钮作为**悬浮按钮** |
| C | 双击视频进入全屏（**已有** `onDoubleClick`）+ 右上角常驻按钮 |

**推荐 A 或 C** —— 与截图布局一致（右上角有控件）。

### 图标

已引入 `lucide-react` 的 `Maximize` / `Minimize`，**继续使用**。

---

## 五、全屏时的目标布局（用户提供截图）

```
┌──────────────────────────────────────────────┐
│ [第 2 集]              1x  1080P  滚轮/↑↓键切集│
│                                              │
│              ┌────────────┐                  │
│              │            │            ♡ 追剧 │
│              │   视频     │            ⌃     │
│              │  (居中铺满) │            ⌄     │
│              └────────────┘                  │
│                                              │
│ @禁止闪婚：甜桃烈酒2 全51集                    │
│ 第 2 集 ·《禁止闪婚：甜桃烈酒2》第 2 集         │
│ #短剧 #爱情 #都市爱情 #先婚后爱 #闪婚 #医生      │
│ 描述文本...                                   │
│ [合集：禁止闪婚：甜桃烈酒2｜全51集 >] [下一集]   │
│ 00:07 / 01:27                                │
└──────────────────────────────────────────────┘
```

**关键特征**：

1. **视频居中铺满**（`object-contain`，保持比例）
2. 控件**叠加在视频之上**（半透明）
3. 左上角：集数徽标
4. 右上角：倍速 / 画质 / 提示文字
5. **右侧**：追剧按钮 + 上下切集箭头
6. 底部：剧名、集数、标签、描述、操作按钮、进度条

**注意**：当前 `PlayerModal.tsx:182` 全屏时用 `fixed inset-0 z-50`，
可能与原生全屏**冲突**（元素已是 fixed，再被浏览器全屏）。

**要求**：验证两者共存时布局正确。

---

## 六、硬性约束

1. **只改这些文件**：
   - `apps/web-pc/src/hooks/usePlayback.ts`
   - `apps/web-pc/src/components/PlayerModal.tsx`
   - `apps/web-pc/src/hooks/useKeyboardShortcuts.ts`
   - `apps/web-pc/src/App.tsx`
2. **不要改** `apps/web-pc/electron/` 下任何文件（**W3 的职责**）
3. **不要改** `apps/tv-android/`、`custom-server/`、`shared/`
4. **不要回退**任何已完成改动
5. 保持 TypeScript 严格模式通过
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 七、验收标准

| # | 项 | 验证方式 |
| --- | --- | --- |
| 1 | 浏览器中全屏可用 | 实测点击/双击/F 键 |
| 2 | **全屏按钮始终可见** | 等待控制栏自动隐藏后仍可见 |
| 3 | 全屏失败时有明确提示 | 构造失败场景（如失焦） |
| 4 | React 状态与原生同步 | `isFullscreen` 与实际一致 |
| 5 | Escape 退出全屏 | 实测 |
| 6 | 全屏布局符合 §五 | 截图对比 |
| 7 | 桌面桥接不存在时回退正常 | 浏览器中验证（无 `hongguotvDesktop`） |
| 8 | `npm run typecheck` 通过 | |
| 9 | `npm run build` 通过 | |
| 10 | 报告写入 `.agents/shared/t-w2-web-fullscreen-antigravity.md` | |

---

## 八、证据要求

### 环境

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器访问 `http://127.0.0.1:3000`

**用 chrome-devtools-mcp 实测**：

- `navigate_page` → `http://127.0.0.1:3000`
- 进入播放页
- 测试全屏按钮 / 双击 / F 键
- `evaluate_script` 检查 `document.fullscreenElement` 与 React 状态
- `take_screenshot` 记录全屏布局

**必须提供**：

1. **全屏前后截图**（含按钮位置）
2. **控制栏隐藏后按钮仍可见**的截图
3. **失败提示**的截图或 console 输出
4. **状态同步**的证据（`document.fullscreenElement` vs DOM 类名）
5. `typecheck` / `build` 输出

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `requestFullscreen` 需用户手势 | 非手势调用可能被拒 |
| 窗口失焦时全屏失败 | Electron 中实测会抛 `Permissions check failed` |
| `fixed inset-0` 与原生全屏冲突 | 元素已是 fixed，再全屏可能布局错乱 |
| 控制栏自动隐藏 | `resetControlsTimer` 会隐藏按钮 |
| 状态多来源 | DOM API 与桌面桥接需统一 |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-w2-web-fullscreen antigravity "结论及报告路径"
```
