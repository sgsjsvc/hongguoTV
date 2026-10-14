# R9 导入路径性能与事务修复

**任务 ID**: `t-r9-import-perf`
**负责人**: workbuddy
**依赖**: `t-r1-playback-p0`（R1）、`t-r8-history-time`（R8）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

**两个前置原因**：

1. **R1**（codex）会改 `custom-server/index.mjs`（D1-F2 中途失败终止）—— 与本任务同文件
2. **R8** 改 `history-store.mjs`，本任务的 D4-F2 涉及 `historyStore.list()` 的调用方式

---

## 一、修复目标

| 发现 | 严重度 | 标题 | 位置 |
| --- | --- | --- | --- |
| **D4-F2** | medium | 导入桥接循环内逐条 `snapshot()`，大库下阻塞事件循环 | `custom-server/index.mjs:80` |
| **D4-F3** | low | 导入循环注释声称外层事务，实际不存在 | `custom-server/library-routes.mjs:14-16` |

**详见**：`.agents/shared/t-d4-sync-discovery-workbuddy.md`

---

## 二、D4-F2 修复

### 问题

**位置**：`custom-server/index.mjs:80`

```javascript
for(const item of historyStore.list()) 
  if(!libraryStore.snapshot().history.some(row=>row.seriesId===item.seriesId)) ...
```

**循环内逐条调用 `snapshot()`**。

### 量化证据（D4 实测）

| 指标 | 数值 |
| --- | --- |
| `snapshot()` 单价 | **~7.9ms @ 3000 条** |
| 最大条目 | 10000 |
| 估算 | 万次级全表扫描 → **分钟级阻塞** |

**影响**：`POST /api/history/import` 处理期间**整个服务无响应**（含播放与同步）。

### 建议（D4）

把 `snapshot()` **提到循环外**一次，构建 `Set<seriesId>` 后逐条比对；或直接写 SQL 查询 `library_records` 的 history 键集合。

---

## 三、D4-F3 修复

### 问题

**位置**：`custom-server/library-routes.mjs:14-16`

注释声称「Outer transaction also includes the migration marker」，**实际无外层事务**。

**证据**（D4 场景 H1 实跑）：3 条迁移操作第 3 条非法 → 前 2 条已提交，migration 标记未设置。

**影响**：进程在第 2 条之后崩溃会留下未标记的部分导入（重试可自愈）；**注释误导维护者**。

### 建议（D4）

用 `store.transaction()` 包裹「循环 + 标记」（实现注释本意）；**或**修正注释并文档化「部分提交 + 幂等重试」语义。

> **协调者备注**：两种方案都可接受。若选「修正注释」，需在报告中说明为何不实现原子性（如事务嵌套限制）。

---

## 四、硬性约束

1. **只改这两个文件**：
   - `custom-server/index.mjs`
   - `custom-server/library-routes.mjs`
2. **不要改 `shared/library-store.mjs`**（R10 负责）
3. **不要回退 R1 的修复**（D1-F2 中途失败终止必须保持）
4. **不要回退 R8 的修复**
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. **D4-F2**：`snapshot()` 调用次数从 O(n) 降至 **O(1)**（用计数或日志证明）
2. **D4-F2**：构造大量条目的导入场景，验证**不阻塞**（或量化改善）
3. **D4-F3**：明确二选一并实施（事务包裹 或 修正注释）
4. `npm test` 全绿
5. 报告写入 `.agents/shared/t-r9-import-perf-workbuddy.md`

---

## 六、证据要求

- **D4-F2**：修复前后 `snapshot()` 调用次数对比（如用包装函数计数）
- **D4-F3**：修复后的代码片段 + 场景 H1 复测
- 证据三件套

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r9-import-perf workbuddy "结论及报告路径"
```
