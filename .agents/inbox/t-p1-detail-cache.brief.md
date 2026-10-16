# P1 播放预取机制（消除切剧 2 秒等待）

**任务 ID**: `t-p1-detail-cache`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: 预取基础设施 + 详情缓存增强

---

## ⚠️ 重要：任务目标已修正

**原 brief 说「详情接口无缓存」—— 这个判断不完整。**

**实测发现**：`detail()` 自身无缓存，但它调用的 `routerData()` **有 `pageCache`（TTL 180 秒）**。

| 情况 | 详情耗时 |
| --- | --- |
| 180 秒内访问过 | **1 ms**（缓存命中） |
| **首次访问** | **1453 ms** |
| **超过 180 秒** | **1453 ms**（缓存过期） |

**所以「加缓存」解决不了问题** —— 首次切到某部剧，无论如何都要等一次上游请求。

**真正的解法：在用户切换之前预取。**

详见 `.agents/shared/perf-baseline-correction.md`。

---

## 一、实测数据（协调者提供）

### 真实切剧流程

| 场景 | 详情 | 清晰度 | 取流 | **合计** |
| --- | --- | --- | --- | --- |
| 切到**已缓存**剧 | 0 ms | 617 ms | 188 ms | **805 ms** |
| 切到**未缓存**剧（3 部平均） | **1453 ms** | 254 ms | 274 ms | **1981 ms** |

**未缓存时详情占 73% 的时间。**

### 其他基线

| 环节 | 耗时 |
| --- | --- |
| 推荐首屏（冷） | 2514 ms |
| 推荐翻页（热） | 2 ms |
| 清晰度（缓存） | 0–1 ms |
| 取流（缓存） | 32–37 ms |
| 自动下一集（同剧） | 38 ms |

---

## 二、任务目标

### 2.1 实现预取基础设施（核心）

**要求**：提供一个可复用的预取能力，让客户端能在用户切换**之前**后台加载数据。

**关键设计**：

| 项 | 要求 |
| --- | --- |
| **并发控制** | 预取不能挤占用户主动请求的带宽（建议限 1–2 并发） |
| **可取消** | 用户已切换/离开时，废弃的预取应能取消 |
| **去重** | 已在预取的资源不重复发起 |
| **低优先级** | 预取失败**不应影响**主流程（静默失败） |
| **可关闭** | 提供开关（移动端/流量受限场景） |

**实现位置建议**：

- 服务端：`server/provider.mjs` 增加 `prefetchDetail(id)` 之类的方法
- 或暴露一个轻量接口 `POST /api/prefetch` 接受待预取的 id 列表

**由你判断哪种更合适**，在报告中说明理由。

### 2.2 详情缓存增强（次要）

现有 `pageCache` TTL 180 秒。可考虑：

| 项 | 建议 |
| --- | --- |
| TTL | 是否延长？**需权衡数据新鲜度**（剧集可能更新） |
| 容量 | 现有上限 100 条，是否足够？ |
| **`fresh` 参数** | 提供绕过缓存的手段（便于调试与强制刷新） |
| **缓存状态暴露** | 响应头加 `X-Cache: HIT/MISS`，便于验证 |

**注意**：这一项收益有限（只对重复访问有效），**不要过度投入**。

### 2.3 推荐列表预取（可选，视时间而定）

推荐首屏 2514 ms（冷）。若能在应用启动时后台预热，可改善首次体验。

**但注意**：这需要客户端配合，可能超出本任务范围。**若时间不足可跳过**。

---

## 三、硬性约束

1. **可改文件**：
   - `server/provider.mjs`
   - `custom-server/index.mjs`
   - `shared/content-core/hongguo.js`（**仅当必要**，且必须两端验证）
2. **不要改** `apps/web-pc/src/`、`apps/tv-android/`（其他任务）
3. **不要回退**任何已完成改动
4. 保持 `npm test` 全绿（144 项）
5. 当前 shell 是 **Windows PowerShell 5.1**（不支持 `&&`）

---

## 四、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 预取 API 可用 | 调用后数据进入缓存 |
| 2 | **预取后再请求详情 < 50 ms** | 实测（当前 1453 ms） |
| 3 | 预取有并发上限 | 不挤占主请求 |
| 4 | 预取失败不影响主流程 | 构造失败场景验证 |
| 5 | 预取可取消 | 代码核实 |
| 6 | `fresh` 参数可绕过缓存 | 实测 |
| 7 | 缓存状态可观测 | 响应头或字段 |
| 8 | `npm test` 全绿 | 144 项 |
| 9 | 报告写入 `.agents/shared/t-p1-prefetch-codex.md` | |

---

## 五、测量方法

**协调者提供的脚本**：

```powershell
# 清空缓存重启服务
node custom-server/index.mjs

# 基础链路
node outputs/debug/measure-playback.mjs

# 冷热对比
node outputs/debug/measure-deep.mjs

# 真实切剧流程（关键）
node outputs/debug/measure-real-switch.mjs
```

**验收时必须用 `measure-real-switch.mjs` 复测**：

| 指标 | 优化前 |
| --- | --- |
| 切到未缓存剧 | **1981 ms** |
| 其中详情 | 1453 ms |

**目标**：预取生效后，切剧合计 **< 300 ms**。

---

## 六、证据要求

1. **预取机制的设计说明**（为何选这种实现）
2. **预取前后对比**：`measure-real-switch.mjs` 的输出
3. **并发控制验证**：预取时主请求的延迟未被显著影响
4. **失败隔离验证**：预取失败时主流程正常
5. **`fresh` 参数验证**
6. `npm test` 输出

---

## 七、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **预取挤占带宽** | 必须限并发，否则用户主动请求变慢 |
| **预取浪费** | 用户可能根本不切那部剧，需可取消/有上限 |
| **缓存已存在** | `pageCache` 已工作，**不要重复造轮子** |
| **TTL 与新鲜度** | 延长 TTL 会让剧集更新延迟可见 |
| **三端共享引擎** | 若改 `shared/content-core/hongguo.js`，必须 Node 与 QuickJS 两端验证 |
| **设备离线** | TV 端实测可能不可用（MuMu 已关闭） |

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-p1-detail-cache codex "结论及报告路径"
```

---

## 九、补充：预取应设计为通用能力

**协调者后续测量发现**：榜单与分类接口**也是同一模式**（缓存有效但首次慢）。

| 接口 | 首次 | 重复 |
| --- | --- | --- |
| 详情 `/api/series/:id` | 1453 ms | 1 ms |
| 榜单 `/api/rank/list`（新页） | 1456–2079 ms | 0–1 ms |
| 分类 `/api/category/list`（新标签） | 854–938 ms | 1 ms |

**所以预取接口应支持多种资源类型**，避免只为详情定制：

```javascript
POST /api/prefetch
{ "targets": [
    { "kind": "detail",    "id": "7694..." },
    { "kind": "qualities", "id": "7694...", "seriesId": "7693..." },
    { "kind": "rank",      "type": "rank_hot", "page": 4 },
    { "kind": "category",  "type": "real-drama", "tag": "romance", "page": 1 }
] }
```

**优先级**：

1. **必须实现**：`detail` 与 `qualities`（切剧场景收益最大：省 1453 ms）
2. **建议实现**：`rank` / `category`（翻页场景：省 0.9–2 秒）
3. 若时间有限，后两者可预留接口但不实现

详见 `.agents/shared/perf-list-cache-verdict.md`。

---

## 十、补充：切剧路径分析（含推荐分页预取）

**协调者审查 `useStreamFeed.ts` 与 `recommendation-session.mjs` 后发现**：

### 切剧分三种情况

| 情况 | 是否请求网络 | 耗时 |
| --- | --- | --- |
| **同页内切剧**（多数） | ❌ 不请求 | ~40 ms（已缓存）或 ~1500 ms（详情未缓存） |
| **切到下一页** | ✅ `load()` | 更慢（推荐接口冷启动可达 2514 ms） |
| **`needsRestart` 为真** | ✅ 重建会话 | **~4000 ms**（但触发频率低） |

### `advance` 的设计亮点（应保留）

```javascript
async advance(direction, reason = direction) {
  const index = this.index + (direction === 'next' ? 1 : -1);
  ...
  if (index >= this.items.length) await this.load();   // ← 仅越界时才加载
  ...
}
```

**只有当前页用尽时才请求网络** —— 这是好设计，避免每次切剧都请求。

### `load()` 的现有保护

```javascript
async load(page = this.page + 1) {
  if (this.pending.has(page)) return this.pending.get(page).promise;   // 并发去重
  if (page <= this.page || this.exhausted) return;                     // 边界检查
  ...
}
```

✅ 并发去重、边界检查、可取消（`AbortController`）都已具备。

### 建议：预取接口扩展支持推荐分页

```javascript
{ "kind": "recommend", "session": "...", "page": 2 }
```

**⚠️ 重要限制**：推荐分页**必须按顺序加载**（`recommendation-service.mjs:28`）：

```javascript
if (page !== state.pages.size + 1) throw new RecommendationError(409, '请按顺序加载推荐分页');
```

**所以预取必须与用户的实际浏览顺序一致，不能随意预取未来页。**

**安全的预取时机**：

| 时机 | 预取内容 |
| --- | --- |
| 当前页剩余 < 3 部时 | 预取下一页推荐 |
| 播放到当前剧 90% 时 | 预取下一部剧详情 + 首集清晰度 |

**优先级**：`detail` + `qualities`（收益最大）> `recommend`（收益中等，但需注意顺序约束）。

详见 `.agents/shared/perf-drama-switch-analysis.md`。
