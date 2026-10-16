# P5 Web 端轮询优化（消除每秒 1.2 GB 流量）

**任务 ID**: `t-p5-polling`
**负责人**: **antigravity**
**依赖**: 无
**协调者**: dsh
**范围**: Web / Windows 端库同步轮询

---

## 一、问题（协调者实测）

**位置**：`apps/web-pc/src/api.ts:72`

```javascript
if (!migrationOnly) {
  setInterval(() => void refreshLibrary().catch(() => {}), 1000);   // ← 每秒一次
  window.addEventListener("online", () => void refreshLibrary().catch(warning));
}
```

**行为**：**无条件每秒请求 `/api/library`**。

### 实测数据

| 指标 | 值 |
| --- | --- |
| 频率 | **10 次 / 10 秒**（确认每秒 1 次） |
| 单次响应 | **14.2 KB** |
| **每小时** | **50.0 MB** |
| **每天** | **1201 MB** |

**响应体是完整 library**（收藏 + 历史 + 偏好 + 同步状态），随用户数据增长而变大。

### 影响

| 场景 | 影响 |
| --- | --- |
| **播放视频时** | 每秒额外请求，与视频流争用连接 |
| **电视常开** | 每天 1.2 GB |
| 移动端/流量受限 | 持续消耗 |
| 服务器 | 每客户端每秒 1 次 |

---

## 二、✅ 现成的正确范例：TV 端

**TV 端做对了**（`apps/tv-android/.../HistorySync.kt:33`）：

```kotlin
init {
  if (autoFlush) scope.launch {
    var backoff = 1000L
    while (isActive) {
      if (foreground && remoteUrl.isNotBlank()) {    // ✅ 仅前台 + 已配置时才请求
        try { flush(); backoff = 1000 }
        catch (error: Exception) {
          backoff = (backoff * 2).coerceAtMost(30000)   // ✅ 指数退避 1s → 30s
        }
      }
      delay(backoff)
    }
  }
}
```

| 特性 | TV | **Web（当前）** |
| --- | --- | --- |
| 仅前台时请求 | ✅ | ❌ |
| 指数退避 | ✅ 1s→30s | ❌ 固定 1s |
| 未配置时跳过 | ✅ | ❌ |

**Web 端应达到同等水平。**

---

## 三、要求

### 3.1 最低成本改动（必须）

| # | 改动 | 收益 |
| --- | --- | --- |
| 1 | **页面不可见时暂停**（`document.hidden` / `visibilitychange`） | 后台零请求 |
| 2 | **拉长间隔**（1s → 10s） | 流量降 90% |
| 3 | **播放视频时暂停或降频** | 不与视频争用 |

**实现建议**：

```javascript
let timer = null;
function startPolling() {
  if (timer) return;
  timer = setInterval(() => {
    if (document.hidden) return;        // 后台跳过
    if (isPlayingVideo()) return;       // 播放中跳过
    void refreshLibrary().catch(() => {});
  }, 10000);                             // 10 秒
}
function stopPolling() { clearInterval(timer); timer = null; }
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPolling(); else startPolling();
});
```

### 3.2 进阶改动（推荐）

| # | 改动 | 收益 |
| --- | --- | --- |
| 4 | **条件请求**（ETag / `If-Modified-Since`） | 无变化返回 304，响应体几乎为零 |
| 5 | **增量接口**（只返回变更） | 14 KB → 几百字节 |

**方案 4 需要服务端配合**（`custom-server/index.mjs` 加 ETag）。
**方案 5 需要新接口**，工作量较大。

**建议**：先做 1+2+3（纯前端，低风险），若有余力再做 4。

### 3.3 ⚠️ 不要破坏的功能

**关键**：用户改收藏后，**另一台设备应在合理时间内看到**。

| 场景 | 期望 |
| --- | --- |
| 用户**主动操作**（点收藏/取消） | **立即生效**（不依赖轮询） |
| 另一台设备改了 | **≤ 10 秒**内可见（可接受） |
| 页面切回前台 | **立即拉取一次** |

**注意**：`refreshLibrary` 被多处调用（`getHistoryList`、`commitRecommendationPreferences` 等），
**改动只应影响那个 `setInterval`，不要影响主动刷新路径**。

---

## 四、硬性约束

1. **可改文件**：
   - `apps/web-pc/src/api.ts`
   - `apps/web-pc/src/hooks/` 下相关文件（如需）
   - `custom-server/index.mjs`（仅当实现 ETag）
2. **不要改** `apps/web-pc/src/components/RecommendStream.tsx`（P2 的职责）
3. **不要改** `server/provider.mjs`（P1 的职责）
4. **不要改** `apps/tv-android/`（P3/P4 的职责）
5. 保持 `npm run typecheck` 通过
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 页面隐藏时**无请求** | 实测（切到其他标签页） |
| 2 | 播放视频时**无请求或显著降频** | 实测 |
| 3 | 空闲时（可见）间隔 ≥ 10 秒 | 实测 |
| 4 | 页面切回前台立即拉取 | 实测 |
| 5 | **主动操作仍立即生效** | 点收藏后立即同步 |
| 6 | **多端同步仍工作** | 两台设备验证（≤ 10 秒） |
| 7 | 流量显著下降 | 用 `measure-polling-live.mjs` 对比 |
| 8 | `npm run typecheck` 通过 | |
| 9 | 报告写入 `.agents/shared/t-p5-polling-antigravity.md` | |

---

## 六、测量方法

**协调者提供的脚本**：

```powershell
node custom-server/index.mjs                    # 启动服务
node scripts/perf/measure-polling-live.mjs      # 实测轮询频率与流量
```

**验收时必须用该脚本复测**：

| 指标 | 优化前 |
| --- | --- |
| 10 秒请求数 | 10 |
| 每小时流量 | 50 MB |
| 每天流量 | 1201 MB |

**目标**：空闲时 10 秒 1 次（或更少），页面隐藏时 0 次。

---

## 七、证据要求

1. **优化前后的轮询频率对比**（`measure-polling-live.mjs` 输出）
2. **页面隐藏时无请求的证据**（服务端日志或脚本统计）
3. **主动操作仍立即生效的证据**（点收藏后立即看到变化）
4. **多端同步仍工作的证据**（若条件允许）
5. `typecheck` 输出

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **破坏主动刷新** | `refreshLibrary` 被多处调用，只改 `setInterval` 那处 |
| **同步延迟过大** | 间隔拉到 10 秒可接受，30 秒以上可能让用户觉得不同步 |
| **切回前台不刷新** | 应在 `visibilitychange` 时立即拉一次 |
| **`document.hidden` 兼容性** | 现代浏览器均支持，TV/桌面端 Electron 也支持 |
| **播放状态判断** | 需能找到「是否正在播放视频」的状态（可能在 React state 中，需桥接） |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-p5-polling antigravity "结论及报告路径"
```
