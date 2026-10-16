# 自动下一集流畅度分析（三端对比）

**分析方**: dsh
**日期**: 2026-10-16
**方法**: 代码路径审查 + API 测量

---

## 一、三端自动下一集实现对比

### Web 端

**触发**：`RecommendStream.tsx:338` 的 `onEnded`

```tsx
onEnded={() => {
  saveProgress(...);          // 同步，写本地 cache
  void refreshHistory();      // ✅ 异步不阻塞（void）
  handleStreamNextEpisode(true);
}}
```

**切集**：`useStreamFeed.ts:124`

```typescript
const handleStreamNextEpisode = (automatic = false) => {
  streamWatchRef.current.pause();
  const nextIdx = streamEpisodeIndex + 1;
  if (nextIdx < streamDetail.episodes.length) {
    setStreamEpisodeIndex(nextIdx);      // 只改 state
    setStreamCurrentEpisode(nextEp);
    setStreamCurrentTime(0);
    setStreamIsPlaying(true);
  } else { ... }
};
```

**评价**：✅ `refreshHistory` 用 `void` 不阻塞，设计正确。

### TV 端

**触发**：`MainActivity.kt:782` 的 `onPlaybackStateChanged(STATE_ENDED)`

```kotlin
if (playbackState == Player.STATE_ENDED) {
    val episode = activeDetail?.episodes?.getOrNull(activeIndex) ?: return
    if (!PlaybackPolicy.canSaveProgress(episode.id, current.currentMediaItem?.mediaId)) return
    pauseIndicator.visibility = View.GONE
    episodeEnded()
}
```

**切集**：`MainActivity.kt:867`

```kotlin
private fun episodeEnded() {
    val detail = activeDetail ?: return
    if (activeIndex == detail.episodes.lastIndex) { ... }
    saveProgress(true)
    if (activeIndex + 1 < detail.episodes.size) loadEpisode(activeIndex + 1, showSwitchHint = true)
    else if (feedMode) switchFeed(1) else showRelated(detail.series)
}
```

**`loadEpisode` 的关键操作**（`MainActivity.kt:800-805`）：

```kotlin
private fun loadEpisode(index: Int, ...) {
    ...
    playbackJob?.cancel(); val generation = playbackGeneration.next()
    player?.pause(); player?.clearMediaItems(); activeIndex = index; savedPosition = position
    ...
    navigation.removeAllViews()   // ← 819 行，重建 UI 树（P3 已覆盖）
    ...
    current.setMediaItem(...); current.prepare()   // 843-845 行
}
```

**评价**：

- ✅ 播放器复用（`setMediaItem` + `prepare`，不重建 ExoPlayer）
- ⚠️ **`clearMediaItems()` 后立即 `setMediaItem()`** —— 多一次列表操作
- ⚠️ **`navigation.removeAllViews()`** 重建 UI 树（P3 已覆盖）
- ⚠️ **`loadEpisode` 内先 `qualities()` 请求**（836 行）才播放 —— 但清晰度已缓存（0–1 ms）

---

## 二、自动下一集的关键路径耗时

### Web 端（同剧内）

| 步骤 | 耗时 | 来源 |
| --- | --- | --- |
| `saveProgress` | ~0 ms | 本地 cache |
| `refreshHistory` | 不阻塞 | `void` |
| 改 state | ~0 ms | React setState |
| **video 元素重建** | **⚠️ 黑屏 + 解码重启** | `key` 变化（P2 覆盖） |
| 清晰度（已缓存） | 0–1 ms | pageCache |
| 取流（已缓存） | 32–37 ms | streamCache |
| **合计（API 部分）** | **~38 ms** | |

**真正的延迟来自 `key` 导致的重建** —— 这是 P2 的任务。

### TV 端（同剧内）

| 步骤 | 耗时 | 来源 |
| --- | --- | --- |
| `saveProgress` | ~0 ms | 本地 SQLite |
| `player.clearMediaItems()` | ~0 ms | 内存操作 |
| **`navigation.removeAllViews()`** | **⚠️ UI 重建** | P3 覆盖 |
| `qualities()` | 0–1 ms | 已缓存 |
| `setMediaItem` + `prepare` | 解码器初始化 | Media3 内部 |
| **合计（API 部分）** | **~38 ms** | |

**真正的延迟来自 UI 重建** —— 这是 P3 的任务。

---

## 三、结论：自动下一集的瓶颈已全部覆盖

| 瓶颈 | 端 | 任务 |
| --- | --- | --- |
| `key` 导致 video 重建 | Web | **P2** |
| `removeAllViews` 重建 UI | TV | **P3** |
| 详情未预取（切剧时） | 三端 | **P1** |
| API 延迟（已缓存） | — | ✅ 无需优化 |

**API 层面自动下一集仅 38 ms，不是瓶颈。** 用户体验到的卡顿来自**渲染层重建**。

---

## 四、补充发现：`clearMediaItems()` 的必要性

**TV 端** `loadEpisode:805`：

```kotlin
player?.pause(); player?.clearMediaItems(); activeIndex = index; savedPosition = position
```

**问题**：`clearMediaItems()` 后紧接着 `setMediaItem()`（843 行）——
**多了一次列表清空操作**。

**但注意**：这是**有意的** —— 注释说明（782 行附近）：

> Clearing/replacing a playlist also emits ENDED. Only the active media may complete.

**即：清空列表会触发 `STATE_ENDED`**，所以 `canSaveProgress` 检查是必要的防护。

**判定**：⚠️ **不建议改动** —— 改动风险高于收益（38 ms 的 API 延迟不是瓶颈）。

**若 P3 执行方想优化**：可考虑用 `setMediaItem` 的 `resetPosition` 参数替代
`clearMediaItems` + `setMediaItem` 组合，但**需谨慎验证不会误触发 ENDED**。

---

## 五、给 P3 执行方的补充说明

**P3 的收益比原 brief 描述的更大**：

| 项 | 说明 |
| --- | --- |
| UI 重建 | 每次切集都发生 |
| **自动下一集** | **也走同一路径**（`episodeEnded` → `loadEpisode`） |
| 影响频率 | 用户看剧时**每集结束都触发一次** |

**所以 P3 优化的是「每次自动连播」的体验**，不只是手动切集。

**验证建议**：让视频播到结束，观察自动切集时是否还有 UI 闪烁。

---

## 六、测量脚本

```powershell
node custom-server/index.mjs
node scripts/perf/measure-playback.mjs     # 含「切集链路」测量
node scripts/perf/measure-real-switch.mjs  # 真实切剧流程
```

**注意**：脚本测的是 **API 层**，渲染层重建需在设备/浏览器实测。
