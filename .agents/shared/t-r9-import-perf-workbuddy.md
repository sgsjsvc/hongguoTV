# R9 导入路径性能与事务修复 — workbuddy 实施报告

**任务 ID**: `t-r9-import-perf`
**负责人**: workbuddy
**日期**: 2026-10-14
**状态**: 已完成
**依赖确认**: `t-r1-playback-p0`（R1）、`t-r8-history-time`（R8）在认领前均已 done，本任务进入 ready 队列后认领
**修改文件**: `custom-server/index.mjs`、`custom-server/library-routes.mjs`（仅此两个业务文件）、`tests/library-routes.test.mjs`（新增回归测试）

---

## 一、D4-F2（medium）导入桥接循环内逐条 snapshot()

**位置**: `custom-server/index.mjs` `legacyHistory.importLegacy`

**修复前**（每轮循环都调一次全量快照 + 线性 some 扫描）：

```js
for(const item of historyStore.list()) if(!libraryStore.snapshot().history.some(row=>row.seriesId===item.seriesId)) libraryStore.write(...)
```

**修复后**（快照提到循环外一次，构建 Set 后逐条比对；桥接后即时回填 Set）：

```js
const bridged=new Set(libraryStore.snapshot().history.map(row=>row.seriesId));
for(const item of historyStore.list()) if(!bridged.has(item.seriesId)) { libraryStore.write({...}); bridged.add(item.seriesId); }
```

### 量化证据（真实 HTTP 服务，500–1000 条导入，前后对照实跑）

harness 用 `git` 工作区当前文件还原修复前行 80 表达式生成「修复前变体」（临时文件，运行后已删除），两个变体各起真实 `custom-server`（独立数据目录与端口），对 `POST /api/history/import` 发相同请求，通过给 `LibraryStore.prototype.snapshot` 包计数器统计调用次数：

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| `snapshot()` 调用次数（500 条导入） | **500** | **1** |
| 导入耗时（500 条，当前存储层带缓存） | 2027.5 ms | 1176 ms |
| `snapshot()` 调用次数（1000 条） | **1000** | — |
| 导入耗时（1000 条，模拟 R10 修复前的无缓存存储层） | **4800.7 ms** | — |

- 调用次数从 O(n) 降至 **O(1)**，达到验收标准。
- 即便存储层已有 R10 快照缓存，O(n) 次调用仍有每次约 1.7ms 的深拷贝开销（500 次 ≈ 850ms）；叠加无缓存存储层时单次约 4.8ms——按导入上限 10000 条估算，修复前纯快照开销约 **48 秒**事件循环阻塞（整个服务无响应），修复后只剩 1 次。
- 剩余耗时主体是每条 `write()` 自身的事务提交（synchronous=FULL），非本任务范围。

**R1 修复未回退**：`git diff custom-server/index.mjs` 确认 R1 的 D1-F2 改动（AbortController 中止、首块媒体校验、headersSent 处理）完整保留，本任务只改导入桥接一行。

---

## 二、D4-F3（low）导入循环注释声称外层事务，实际不存在

**位置**: `custom-server/library-routes.mjs` `/api/library/import`

**方案选择：修正注释 + 文档化「部分提交 + 幂等重试」语义**（协调者备注允许的二选一）。

**为何不实现原子性（事务包裹）**：`store.write()` 内部自开 `BEGIN IMMEDIATE`，SQLite 拒绝嵌套事务——实测 `store.transaction(() => store.write(...))` 抛 `cannot start a transaction within a transaction`。要在保留写路径的同时加外层事务，必须改 `shared/library-store.mjs` 的写接口（R10 属地，超出 R9 授权范围），并触及所有调用方。

**为何部分提交是安全的**：迁移操作 ID 确定（`migration:${id}:${i}`），重试时 `write()` 的 ID 重放路径直接返回已存事件（幂等），标记由第一个完整跑完循环的 attempt 设置。实测自愈：

| 步骤 | 结果 |
| --- | --- |
| H1：3 条操作第 3 条非法 → POST /api/library/import | 400 `invalid event kind or operation` |
| 同场景库状态 | `migration:m1:0/1` 已提交，`migration:m1` 标记未设置（与 D4 H1 实跑一致） |
| 用同 migrationId 重试（3 条均合法） | 200；事件恰为 3 条（无重复），标记置位 |

**修复后注释**（如实描述语义）：

```js
// Each write commits in its own transaction: write() opens one internally and SQLite rejects
// nested transactions, so no outer transaction is possible here. A crash mid-loop leaves a
// partial import that is safe to retry — operation IDs are deterministic, replay is idempotent,
// and the marker is set by the first attempt that completes the whole loop.
```

---

## 三、回归验证

- **测试套件**：`node --test tests/*.test.mjs` → **83/83 通过**（基线 75 + R8 新增 2 + R10 新增 4 + R9 新增 2）。
- **新增回归测试**（`tests/library-routes.test.mjs`，挂 `createLibraryHandler` 到真实 http 服务）：
  1. `a failed migration import keeps committed operations and an idempotent retry completes it`——锁定 H1 部分提交 + 重试自愈 + 无重复事件；
  2. `a completed migration import is not replayed`——标记生效后重复导入不再重放。
- harness 未入库，位于 `%TEMP%\r9-harness.mjs`（含 F2 前后变体对照与 F3 H1/重试场景，输出见正文表格）。

---

## 四、范围与未触碰项

- 未改 `shared/library-store.mjs`（R10，已完成）、`custom-server/history-store.mjs`（R8，已完成）；未回退 R1/R8/R10 任何改动。
- 未提交 git：工作区保留各 agent 进行中的改动，提交时机由协调者统一安排。
- `%TEMP%\r9-boot-*` 临时数据目录因服务持锁未删除（无害，位于系统临时目录）。

---

## 五、验收对照

| Brief 要求 | 结果 |
| --- | --- |
| F2：snapshot() 调用 O(n)→O(1)（计数证明） | ✅ 500→1（1000 条场景 1000→1 结构同构） |
| F2：大量条目导入不阻塞（量化） | ✅ 无缓存模拟下省去约 4.8ms/条；万条上限从约 48s 降至 1 次调用 |
| F3：明确二选一并实施 | ✅ 选「修正注释」，嵌套事务不可行已实证，理由如上 |
| `npm test` 全绿 | ✅ 83/83 |
| 报告落盘 `.agents/shared/t-r9-import-perf-workbuddy.md` | ✅ 本文件 |
