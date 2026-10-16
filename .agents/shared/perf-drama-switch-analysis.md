# 短剧切换（切剧）路径分析

**分析方**: dsh
**日期**: 2026-10-16
**方法**: 代码路径审查 + API 测量

---

## 一、切剧的完整路径

**入口**：`useStreamFeed.ts:178` 的 `handleSwitchStream`

```typescript
const handleSwitchStream = async (direction, reason = "manual") => {
  try {
    if (streamFeedRef.current.needsRestart(getPlaybackPreferences())) {
      await loadStreamData(1, false);   // ← 分支 A：需重启会话
      return;
    }
    const moved = await streamFeedRef.current.advance(direction, ...);   // ← 分支 B：正常推进
    ...
  }
};
```

### 分支 A：`needsRestart` 为真

**触发条件**：推荐偏好变化（如用户改了推荐模式、重置了推荐）。

**行为**：**重新加载整个推荐会话**（`loadStreamData(1, false)`）→ **慢**。

### 分支 B：正常推进（多数情况）

**`advance` 实现**（`recommendation-session.mjs`）：

```javascript
async advance(direction, reason = direction) {
  const index = this.index + (direction === 'next' ? 1 : -1);
  if (index < 0) return false;
  const generation = this.generation, selection = this.selection;
  if (index >= this.items.length) await this.load();      // ← 仅在越界时加载
  if (generation !== this.generation || selection !== this.selection || !this.items[index]) return false;
  this.select(index, reason); return true;
}
```

**关键**：`if (index >= this.items.length) await this.load();`

**即：只有在「当前页已用尽」时才发起网络请求。**

| 情况 | 是否请求 |
| --- | --- |
| 切到同页内的下一部 | ❌ **不请求**（纯内存操作） |
| **切到下一页的第一部** | ✅ **请求**（`load()`） |

---

## 二、`load()` 的实现

```javascript
async load(page = this.page + 1) {
  if (this.pending.has(page)) return this.pending.get(page).promise;   // ✅ 并发去重
  if (page <= this.page || this.exhausted) return;                     // ✅ 已加载/已用尽则跳过
  ...
  const data = await this.fetchPage(page, id, controller.signal);      // 网络请求
  ...
}
```

**优点**：

- ✅ **并发去重**（`pending` Map）
- ✅ **边界检查**（`page <= this.page || exhausted`）
- ✅ **可取消**（`AbortController`）

**缺点**：

- ⚠️ **阻塞式**：`await this.load()` 会等网络返回才切剧

---

## 三、切剧耗时分解

### 情况 1：同页内切剧（多数情况）

| 步骤 | 耗时 |
| --- | --- |
| `advance` → `select(index)` | ~0 ms |
| 详情加载 | **1453 ms**（未缓存）或 **0 ms**（已缓存） |
| 清晰度 | 0–1 ms（已缓存） |
| 取流 | 32–37 ms |
| **合计** | **~40 ms（已缓存）** 或 **~1500 ms（未缓存）** |

**瓶颈是详情未预取** → P1 覆盖。

### 情况 2：切到下一页

| 步骤 | 耗时 |
| --- | --- |
| `load()` 网络请求 | **~100–3000 ms**（推荐接口冷启动可达 2514 ms） |
| 详情加载 | 同上 |
| **合计** | **更慢** |

**瓶颈是推荐接口未预取** → P1 应覆盖（brief 已说明支持 `rank`/`category`，可扩展至推荐页）。

### 情况 3：`needsRestart` 为真

| 步骤 | 耗时 |
| --- | --- |
| `loadStreamData(1, false)` | **~2514 ms**（推荐首屏冷启动） |
| 详情加载 | 1453 ms |
| **合计** | **~4000 ms** |

**最慢的路径**，但**触发频率低**（仅偏好变化时）。

---

## 四、结论

| 场景 | 瓶颈 | 覆盖任务 |
| --- | --- | --- |
| 同页内切剧 | 详情未预取（1453 ms） | **P1** |
| 切到下一页 | 推荐接口未预取 | **P1**（可扩展） |
| `needsRestart` | 推荐会话重建（2514 ms） | **P1**（可扩展） |
| 渲染层 | video 重建 / UI 树重建 | **P2 / P3** |

**切剧的瓶颈已被 P1/P2/P3 覆盖。**

---

## 五、给 P1 的补充建议

**P1 的预取接口应支持推荐分页**：

```javascript
{ "kind": "recommend", "session": "...", "page": 2 }
```

**预取时机建议**：

| 时机 | 预取内容 |
| --- | --- |
| 当前页剩余 < 3 部时 | 预取下一页推荐 |
| 播放到当前剧 90% 时 | 预取下一部剧详情 + 首集清晰度 |
| 用户浏览推荐列表时 | 视野内剧集详情 |

**注意**：推荐分页预取需要 `session` ID，且**必须按顺序**（`page !== state.pages.size + 1` 会报 409）。

**所以预取必须与用户的实际浏览顺序一致**，不能随意预取未来页。

---

## 六、一个设计亮点

**`advance` 的「越界才加载」是好的设计**：

```javascript
if (index >= this.items.length) await this.load();
```

**避免了每次切剧都请求网络** —— 只有当当前页用完时才加载。

**对比**：如果每切一部都请求，切剧延迟会显著增加。

**这个设计应保留。**

---

## 七、测量脚本

```powershell
node custom-server/index.mjs
node scripts/perf/measure-real-switch.mjs   # 真实切剧流程（含详情+清晰度+取流）
```

**注意**：脚本测的是 API 层，`advance` 的客户端逻辑需在浏览器中验证。

**建议验证方法**：在浏览器控制台监控网络请求，观察切剧时是否发起 `/api/recommend`。
