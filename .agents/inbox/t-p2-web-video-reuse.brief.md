# P2 Web 端切集不重建 video 元素

**任务 ID**: `t-p2-web-video-reuse`
**负责人**: **antigravity**
**依赖**: 无
**协调者**: dsh
**范围**: Web / Windows 端播放器渲染

---

## 一、问题（协调者定位）

**`apps/web-pc/src/components/RecommendStream.tsx:300`**：

```tsx
<video
  ref={streamVideoRef}
  key={`${currentItem.id}-${streamCurrentEpisode?.id || 0}`}   // ← 问题所在
  src={api.getVideoStreamUrl(...)}
  autoPlay
  ...
/>
```

**`key` 变化会让 React 销毁并重建整个 `<video>` 元素**：

| 方式 | 代价 |
| --- | --- |
| 改 `src` | 复用解码器，快 |
| **改 `key`（重建元素）** | **销毁解码器 + 重建 pipeline + 重新缓冲** |

**用户感知**：切集/切剧时**画面黑屏**，且要等解码器重新初始化。

### 对比：TV 端做得对

TV 端用 Media3 的 `setMediaItem()` + `prepare()` **复用同一个 ExoPlayer 实例**
（`MainActivity.kt:843`），不重建播放器。

**Web 端应达到同等效果。**

---

## 二、要求

### 2.1 移除 `key`，改用 `src` 切换

**核心改动**：去掉 `key`，让 React 复用同一个 `<video>` 元素。

```tsx
<video
  ref={streamVideoRef}
  src={api.getVideoStreamUrl(...)}
  ...
/>
```

**但要注意**：移除 `key` 后，React **不会自动重新加载**新的 `src`。

**必须显式处理**：

- 在 `src` 变化后调用 `video.load()`（或依赖浏览器自动行为，需实测确认）
- 确保 `autoPlay` 仍生效

### 2.2 必须验证的行为

移除 `key` 是**高风险改动** —— 可能引入「切集后仍播旧集」这类 bug。

**必须逐项验证**：

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 切到下一集 | 播放**新集**内容（不是旧集） |
| 2 | 切到下一部剧 | 播放**新剧**第 1 集 |
| 3 | 切换清晰度 | 保持当前播放位置（现有逻辑） |
| 4 | 自动下一集 | 正常触发且播放新集 |
| 5 | 播放位置 | 切集后从 0 开始 |
| 6 | 倍速 | 切集后保持用户设置 |
| 7 | 暂停状态 | 切集后按预期播放/暂停 |

### 2.4 ⚠️ 补充发现：`PlayerModal` 也有同样问题

协调者核实：**两个组件都有 `key`**，问题范围比原 brief 描述的更大。

| 文件 | 行 | key |
| --- | --- | --- |
| `RecommendStream.tsx` | 300 | `key={`${currentItem.id}-${streamCurrentEpisode?.id || 0}`}` |
| **`PlayerModal.tsx`** | — | **`key={currentEpisode.id}`** |

**两处都需处理**（`PlayerModal` 是详情页播放器，同样存在切集重建）。

**验证方法**：切集时检查 `<video>` 的 DOM 引用是否变化。

```javascript
const v1 = document.querySelector('video');
// 切集
v1 === document.querySelector('video')   // true = 复用成功
```

---

### 2.3 保留现有正确行为

**不要破坏**：

- `streamQualitySwitchTimeRef` 的清晰度切换位置恢复逻辑（`useStreamFeed.ts:142-168`）
- 全屏状态（`isFullscreen`）
- 进度保存（`onTimeUpdate` → `saveProgress`）

### 2.4 补充：`PlayerModal` 是否有同样问题

**检查 `apps/web-pc/src/components/PlayerModal.tsx`** 是否有类似的 `key` 导致重建。

若有，一并处理；若无，在报告中说明。

---

## 三、硬性约束

1. **可改文件**：
   - `apps/web-pc/src/components/RecommendStream.tsx`
   - `apps/web-pc/src/hooks/useStreamFeed.ts`
   - `apps/web-pc/src/components/PlayerModal.tsx`（若确有同样问题）
2. **不要改** `server/provider.mjs`、`custom-server/`（codex 的职责）
3. **不要改** `apps/tv-android/`（另一任务）
4. **不要改** `shared/content-core/hongguo.js`
5. 保持 `npm run typecheck` 通过
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `<video>` 元素在切集时**不重建** | DOM 节点引用保持不变 |
| 2 | 切集播放**新集**内容 | 实测确认（非旧集） |
| 3 | 切剧播放新剧第 1 集 | 实测确认 |
| 4 | 清晰度切换仍保持位置 | 实测确认 |
| 5 | 自动下一集正常 | 实测确认 |
| 6 | 切集后无黑屏或黑屏时间显著缩短 | 截图/时间测量 |
| 7 | `npm run typecheck` 通过 | |
| 8 | 报告写入 `.agents/shared/t-p2-web-video-reuse-antigravity.md` | |

---

## 五、验证方法

### 5.1 验证 video 元素是否复用

在浏览器中用 CDP / DevTools 检查：

```javascript
// 记录 video 元素引用
window.__v1 = document.querySelector('video');
// 执行切集
// 再次检查
window.__v1 === document.querySelector('video')   // true = 复用成功
```

### 5.2 验证播放的是新集

```javascript
// 切集前后对比 video.src
document.querySelector('video').src
// 应包含新集的 episodeId
```

### 5.3 环境

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

浏览器：`http://127.0.0.1:3000`

**用 chrome-devtools-mcp 实测**：

- 进入推荐流
- 记录 `video` 元素引用
- 切集
- 确认元素引用**未变**，且 `src` 已更新为新集
- `take_screenshot` 记录切换过程

---

## 六、证据要求

1. **切集前后 `video` 元素引用对比**（证明复用）
2. **切集前后 `video.src` 对比**（证明播放新集）
3. **切集耗时测量**（优化前后对比）
4. **7 项行为验证**的结果
5. `typecheck` 输出

---

## 七、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **移除 key 后不重新加载** | React 复用元素时不会自动 reload，可能仍播旧 src |
| **autoPlay 失效** | 复用元素时浏览器的自动播放策略可能不同 |
| **切集后位置错误** | 应归零，但复用元素可能保留旧 `currentTime` |
| **`load()` 的副作用** | 调用 `load()` 会重置状态，需确认不影响其他逻辑 |
| 全屏状态 | 切集时若正在全屏，应保持全屏 |
| 进度保存 | `onTimeUpdate` 可能在切换瞬间写入错误进度 |

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-p2-web-video-reuse antigravity "结论及报告路径"
```
