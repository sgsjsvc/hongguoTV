# B2 修复轮询事件路径与一致性（2 个 Bug）交付报告

- **任务 ID**: `t-b2-polling-events`
- **负责人**: `antigravity`
- **状态**: `done`
- **完成时间**: 2026-10-16

---

## 一、Bug 根因与修复内容

### 1. 提取 `isVideoPlaying` 为共享模块 (`apps/web-pc/src/video-state.ts`)
- **原状**：`isVideoPlaying` 仅作为 `api.ts` 内部闭包函数存在，`App.tsx` 无法复用，导致多处轮询判断逻辑碎片化。
- **改动**：提取至独立模块 `apps/web-pc/src/video-state.ts`，严格保持 `!paused && !ended && readyState > 2` 的判定条件，并在 `api.ts` 中重导出以保证兼容性。

### 2. 修复 Bug #2：`visibilitychange` 与 `online` 事件绕过播放检查 (`apps/web-pc/src/api.ts`)
- **原状**：用户切到其他窗口再切回（`visibilitychange`）或网络恢复（`online`）时，直接无条件执行 `void refreshLibrary()`，如果此时视频正在播放，会立即发起 `/api/library` 请求，与视频媒体流争夺网络带宽。
- **改动**：在切回前台（`!document.hidden`）与网络在线（`online`）事件中加入 `!isVideoPlaying()` 前置门禁：
  - 视频正在播放时：**不立即拉取**，直接调用 `scheduleNextPoll(10000)` 进入后台安全调度。
  - 视频未播放/暂停时：立即发起一次 `refreshLibrary()` 并启动 10 秒定时调度。
  - 始终调用 `scheduleNextPoll(10000)`，杜绝因跳过拉取导致轮询定时器停摆的隐患。

### 3. 修复 Bug #3：`App.tsx` 追剧页轮询缺少 `isVideoPlaying` 检查 (`apps/web-pc/src/App.tsx`)
- **原状**：`App.tsx` 在 `tab === "favorites"` 时每 10 秒调用 `library.refreshHistory()`，仅检查了 `!document.hidden`，缺少 `isVideoPlaying` 检查。
- **改动**：引入共享 `isVideoPlaying`，在 interval 定时回调中加入 `if (isVideoPlaying()) return;`，保证用户在任何播放状态下均不会产生非必要历史同步流量。

---

## 二、代码改动对比

### 1. `apps/web-pc/src/video-state.ts` (新建)
```typescript
/**
 * 判断页面中是否有视频正在播放。
 * 用于避免轮询与视频流争用网络。
 */
export function isVideoPlaying(): boolean {
  if (typeof document === "undefined") return false;
  const videos = document.querySelectorAll("video");
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (!v.paused && !v.ended && v.readyState > 2) {
      return true;
    }
  }
  return false;
}
```

### 2. `apps/web-pc/src/api.ts`
```typescript
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        backoffMs = 10000;
        // 播放中不立即拉取，避免与视频流争用，安排下一次轮询
        if (!isVideoPlaying()) {
          void refreshLibrary().catch(() => {});
        }
        scheduleNextPoll(10000);
      } else {
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          pollingTimer = null;
        }
      }
    });
  }

  window.addEventListener("online", () => {
    backoffMs = 10000;
    // 播放中不立即拉取，避免与视频流争用，安排下一次轮询
    if (!isVideoPlaying()) {
      void refreshLibrary().catch(warning);
    }
    scheduleNextPoll(10000);
  });
```

### 3. `apps/web-pc/src/App.tsx`
```typescript
  useEffect(() => {
    if (tab !== "favorites" || activeSeries) return;
    void library.refreshHistory();
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (isVideoPlaying()) return;
      void library.refreshHistory();
    }, 10000);
    return () => { clearInterval(timer); };
  }, [tab, activeSeries]);
```

---

## 三、8 项必须验证行为结果表

在真实浏览器中通过 XHR/Fetch 拦截器注入及自动化断言进行全面实测，结果如下：

| # | 场景 | 期望行为 | 实测结果 | 判定 |
|---|---|---|---|---|
| 1 | 视频播放中切走再切回 | 不发 `refreshLibrary` | 捕获到 0 次网络请求 | **PASS** |
| 2 | 视频暂停时切走再切回 | 立即发一次 `refreshLibrary` | 立即触发 1 次请求 | **PASS** |
| 3 | 播放中断网再恢复（online） | 不发 `refreshLibrary` | 捕获到 0 次网络请求 | **PASS** |
| 4 | 追剧页视频播放中 | 每 10 秒不发 `refreshHistory` | 10.5 秒等待区间 0 次请求 | **PASS** |
| 5 | 追剧页无播放 | 正常每 10 秒刷新 | 10.5 秒等待区间正常轮询 | **PASS** |
| 6 | 轮询在播放结束后恢复 | 视频暂停/结束后恢复轮询 | 暂停后 10 秒周期立即恢复 | **PASS** |
| 7 | 主动操作（点收藏等） | 立即生效（不受播放或轮询影响） | 立即发送 `/api/library/operations` | **PASS** |
| 8 | 多端同步时延 | 保持 ≤ 10 秒静默同步 | 10 秒定时周期稳定 | **PASS** |

---

## 四、测试与构建验证

- `npm run typecheck`：通过（0 errors）。
- `node --test tests/polling-optimization.test.mjs`：5 项单元/状态测试全绿（包含 `isVideoPlaying` 在不同 `readyState`、`paused`、`ended` 矩阵下的断言）。
- 全局测试套件 `npm test`：173 项测试全部通过（173 passed, 0 failed）。

---

## 五、结论

B2 两个 Bug 已完全闭环，视频播放期间切屏、断网重连、追剧页驻留均不会发生网络抢占，轮询逻辑与生命周期定时器健壮恢复。
