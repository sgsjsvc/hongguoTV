# B2 修复轮询的事件路径与一致性（2 个 bug）

**任务 ID**: `t-b2-polling-events`
**负责人**: **antigravity**
**依赖**: 无
**协调者**: dsh
**范围**: Web / Windows 端轮询

---

## 一、两个 Bug（协调者已定位）

### 🟡 Bug #2：`visibilitychange`/`online` 绕过 `isVideoPlaying` 检查

**位置**：`apps/web-pc/src/api.ts:112-129`

**代码**：

```javascript
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    backoffMs = 10000;
    void refreshLibrary().catch(() => {});   // ← 未检查 isVideoPlaying
    scheduleNextPoll(10000);
  } else { ... }
});

window.addEventListener("online", () => {
  backoffMs = 10000;
  void refreshLibrary().catch(warning);      // ← 同样未检查
  scheduleNextPoll(10000);
});
```

**对比**：`scheduleNextPoll` 内部**有**检查（`:95-98`）：

```javascript
if (isVideoPlaying()) {
  scheduleNextPoll(10000);
  return;                                    // ← 播放时跳过
}
```

**影响**：用户切到其他窗口再切回时，若视频正在播放，
会**立即发起一次 `refreshLibrary`**，与视频流争用。

**与 P5 的设计意图不符**（P5 目标之一是「播放时不争用」）。

---

### 🟡 Bug #3：`App.tsx` 追剧页轮询缺 `isVideoPlaying` 检查

**位置**：`apps/web-pc/src/App.tsx:165-170`

**代码**：

```javascript
useEffect(() => {
  if (tab !== "favorites" || activeSeries) return;
  void library.refreshHistory();
  const timer = setInterval(() => {
    if (document.hidden) return;             // ← 有 hidden 检查
    void library.refreshHistory();           // ← 缺 isVideoPlaying 检查
  }, 10000);
  return () => { clearInterval(timer); };
}, [tab, activeSeries]);
```

**对比**：`api.ts` 的轮询**有** `isVideoPlaying` 检查。

**影响**：用户在追剧页播放视频时，每 10 秒仍会 `refreshHistory`。

**且两处实现不一致**，维护性差。

---

## 二、任务目标

### 2.1 提取 `isVideoPlaying` 为共享工具（推荐）

**当前**：`isVideoPlaying` 是 `api.ts` 内的**局部函数**（`:76-86`）。

**要求**：提取为可复用模块，让 `App.tsx` 也能用。

**建议位置**：`apps/web-pc/src/video-state.ts`（或你判断更合适的位置）

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
    if (!v.paused && !v.ended && v.readyState > 2) return true;
  }
  return false;
}
```

**注意**：保持现有判定逻辑（`!paused && !ended && readyState > 2`）。

### 2.2 修复 Bug #2

在 `visibilitychange` 与 `online` 事件中，**加入 `isVideoPlaying` 检查**：

```javascript
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    backoffMs = 10000;
    // 播放中不立即拉取，改为安排下一次轮询
    if (!isVideoPlaying()) {
      void refreshLibrary().catch(() => {});
    }
    scheduleNextPoll(10000);
  } else { ... }
});
```

**关键**：仍要调用 `scheduleNextPoll(10000)`，否则轮询会停摆。

### 2.3 修复 Bug #3

`App.tsx` 的追剧页轮询加入 `isVideoPlaying` 检查：

```javascript
const timer = setInterval(() => {
  if (document.hidden) return;
  if (isVideoPlaying()) return;              // ← 新增
  void library.refreshHistory();
}, 10000);
```

**或更优**：让追剧页也走 `api.ts` 的统一轮询（避免重复实现）。

**由你判断**，在报告中说明理由。

---

## 三、必须验证的行为

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 视频播放中切走再切回 | **不发** `refreshLibrary` |
| 2 | 视频暂停时切走再切回 | **立即发**一次 `refreshLibrary` |
| 3 | 播放中断网再恢复 | **不发** `refreshLibrary` |
| 4 | 追剧页播放中 | 每 10 秒**不发** `refreshHistory` |
| 5 | 追剧页无播放 | 正常每 10 秒刷新 |
| 6 | 轮询在播放结束后恢复 | ✅ 正常 |
| 7 | 主动操作（点收藏） | ✅ 立即生效（不受影响） |
| 8 | 多端同步 | ✅ ≤ 10 秒 |

---

## 四、硬性约束

1. **可改文件**：
   - `apps/web-pc/src/api.ts`
   - `apps/web-pc/src/App.tsx`
   - 新增共享工具文件（如 `video-state.ts`）
2. **不要改** `server/provider.mjs`、`custom-server/`（P1/B1 的职责）
3. **不要改** `apps/tv-android/`（P3/P4 的职责）
4. **不要改** `shared/content-core/hongguo.js`
5. **不要回退** P5 的成果（10 秒间隔、hidden 检查、退避）
6. 保持 `npm run typecheck` 通过
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `isVideoPlaying` 已提取为共享函数 | 代码核实 |
| 2 | `visibilitychange` 有 `isVideoPlaying` 检查 | 代码核实 |
| 3 | `online` 有 `isVideoPlaying` 检查 | 代码核实 |
| 4 | `App.tsx` 有 `isVideoPlaying` 检查 | 代码核实 |
| 5 | 8 项行为验证通过 | 实测 |
| 6 | 轮询在播放结束后恢复 | 实测 |
| 7 | `typecheck` 通过 | |
| 8 | 报告写入 `.agents/shared/t-b2-polling-events-antigravity.md` | |

---

## 六、验证方法

**协调者提供的验证脚本**：

```powershell
node scripts/perf/verify-p5-polling.mjs    # CDP 请求计数（P5 验收用）
```

**该脚本已能验证**：
- 前台 22 秒请求数
- 后台 12 秒请求数
- 恢复前台后的请求数

**建议扩展它**：增加「播放中切回前台」的场景。

### 环境

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

**用 CDP 注入请求计数器**（参考 `verify-p5-polling.mjs` 的做法）。

---

## 七、证据要求

1. **代码改动对比**（3 处修复）
2. **播放中切回前台不发请求**的证据（CDP 请求计数）
3. **暂停时切回前台会发请求**的证据（对照）
4. **追剧页播放中不刷新**的证据
5. **8 项行为验证**结果
6. `typecheck` 输出

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **忘记 `scheduleNextPoll`** | 加检查后若不调用它，轮询会停摆 |
| **判定条件变化** | 保持 `!paused && !ended && readyState > 2` |
| **破坏 P5 成果** | 10 秒间隔、hidden 检查、退避都要保留 |
| **两处实现不一致** | 应提取共享函数，而非各写一份 |
| PowerShell 编码 | 改含中文文件时用 Node 或 edit 工具 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-b2-polling-events antigravity "结论及报告路径"
```
