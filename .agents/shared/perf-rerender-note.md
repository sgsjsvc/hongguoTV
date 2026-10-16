# 性能发现：`onTimeUpdate` 高频重渲染

**发现方**: dsh
**日期**: 2026-10-16
**方法**: 代码审查

---

## 一、问题

**位置**：`apps/web-pc/src/components/RecommendStream.tsx:317-337`

```tsx
onTimeUpdate={() => {
  const v = streamVideoRef.current;
  if (v && !streamIsDraggingProgress && streamQualitySwitchTimeRef.current === null) {
    const cur = v.currentTime;
    setStreamCurrentTime(cur);        // ← 每次触发都 setState
    setStreamDuration(v.duration || 0);   // ← 每次触发都 setState

    const sec = Math.floor(cur);
    if (sec >= 0 && streamCurrentEpisode) {
      saveProgress(currentItem.id, streamCurrentEpisode.id, sec, { ... });   // ← 每秒写一次
    }
  }
}}
```

### 触发频率

`<video>` 的 `timeupdate` 事件**默认约每 250 ms 触发一次**（即 **4 次/秒**）。

**每次触发**：

1. `setStreamCurrentTime(cur)` → React 重渲染
2. `setStreamDuration(...)` → 又一次 setState（可能合并）
3. `saveProgress(...)` → 写本地 cache + 排队同步

### 影响

| 项 | 说明 |
| --- | --- |
| **重渲染频率** | **4 次/秒** |
| 重渲染范围 | `RecommendStream` 组件整体（含 773 行的 JSX） |
| `saveProgress` | 每秒一次写 cache + `operation()` 排队 |

**`streamCurrentTime` 只用于显示进度条与时间文本**（683、719、721 行），
但 setState 会触发**整个组件**重渲染 —— 包括剧集列表、封面、标签等静态内容。

---

## 二、为什么这可能是问题

| 场景 | 影响 |
| --- | --- |
| 低端设备 | 4 次/秒全组件重渲染可能掉帧 |
| 播放 1080P HEVC 时 | 解码已占 CPU，重渲染叠加 |
| 长列表页面 | 若组件内含大量 DOM 节点 |

**注意**：React 的 diff 效率较高，且 `RecommendStream` 的 DOM 规模有限
（一个播放器 + 若干控件），**实际影响需实测**。

---

## 三、改进方向（若实测确认有影响）

| # | 方案 | 收益 | 风险 |
| --- | --- | --- | --- |
| 1 | **节流 setState**（如每 500ms 一次） | 重渲染减半 | 进度条稍不流畅 |
| 2 | **用 `useRef` + 直接操作 DOM** 更新进度条 | 零重渲染 | 需改命令式代码 |
| 3 | **拆分组件**（进度条独立为子组件） | 重渲染范围缩小 | 需重构 |
| 4 | **`saveProgress` 节流**（现在是每秒一次，已合理） | — | — |

**方案 1 最简单**：`timeupdate` 里判断距上次 setState 是否超过 500ms。

---

## 四、判定：**需先实测再决定**

**理由**：

- React 重渲染 ≠ 必然掉帧（diff 有优化）
- 4 次/秒不是极端频率（60fps 是 60 次/秒）
- 组件 DOM 规模有限

**所以不应盲目优化。**

**建议**：由 P2（`RecommendStream.tsx` 的负责方）在改动时**顺便测量**：

```javascript
// 在浏览器控制台统计重渲染次数
let renders = 0;
const orig = console.log;
// 或用 React DevTools Profiler
```

**若实测显示重渲染耗时 < 5ms/次，则无需优化。**

---

## 五、与其他任务的关系

| 任务 | 关系 |
| --- | --- |
| **P2**（`RecommendStream.tsx`） | ⚠️ **同一文件**，应合并处理或明确边界 |
| P5（`api.ts`） | 无关 |

**处理方式**：在 P2 的 brief 中补充「顺便测量重渲染影响」，
**不单独派发任务**（避免文件冲突与过度优化）。

---

## 六、我的判断

**这是一个「可能的」问题，不是「已确认的」问题。**

**与已确认的问题对比**：

| 问题 | 状态 | 证据 |
| --- | --- | --- |
| 详情未预取 | ✅ 已确认 | 实测 1453 ms |
| video key 重建 | ✅ 已确认 | 代码 + DOM 机制 |
| UI 树重建 | ✅ 已确认 | 代码 + 证据链 |
| 每秒轮询 1.2GB | ✅ 已确认 | 实测 10 次/10 秒 |
| **onTimeUpdate 重渲染** | ⚠️ **未确认** | 仅代码审查 |

**所以：记录，但不派发独立任务。**

**若 P2 执行方实测发现重渲染耗时显著（> 10ms/次），再升级为独立任务。**
