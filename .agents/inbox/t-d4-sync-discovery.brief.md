# D4 资料库与同步算法 — Bug 发现 + 优化建议

**任务 ID**: `t-d4-sync-discovery`
**负责人**: workbuddy
**依赖**: 无（可并行）
**协调者**: dsh
**性质**: **只读发现，禁止修改任何业务代码**

---

## 一、任务目标

发现资料库与同步机制中的 **bug** 与 **算法优化机会**。

这是**逻辑最复杂、最易出错**的部分 —— 涉及事件溯源、事务、幂等、时钟同步、删除标记。

---

## 二、审查范围

| 文件 | 行数 | 说明 |
| --- | --- | --- |
| `shared/library-store.mjs` | ~135 | **SQLite 资料库核心**：事件溯源、事务、幂等 |
| `custom-server/library-sync.mjs` | ~50 | 远程校时、上传、增量下载、重试 |
| `custom-server/library-routes.mjs` | 22 | HTTP 路由 |
| `custom-server/history-store.mjs` | ~110 | 旧版历史存储（兼容层） |
| `apps/sync-server/index.mjs` | ~168 | 远程同步服务 |
| `shared/legacy-migration.mjs` | ~50 | 旧数据迁移 |

---

## 三、核心机制（先理解再审查）

### 事件溯源模型

```
library_events     所有事件（含 fingerprint、is_local）
library_records    物化后的当前状态（kind + item_key 唯一）
library_ack        已确认事件（按 target 隔离）
library_meta       设备 ID、序列号、时钟偏移
```

### 关键不变量（需验证是否成立）

1. **事件幂等**：同一 `id` 重复写入不产生副作用
2. **序列唯一**：`UNIQUE(device_id, seq)` 保证顺序
3. **物化正确**：`library_records` 始终是最新事件的投影
4. **删除标记**：`clear` 之后旧事件不能复活数据
5. **时钟处理**：`clampFuture`、`clockOffset` 是否正确
6. **游标隔离**：不同远程实例的游标互不影响

---

## 四、强制方法要求

> 本项目已验证教训：**只看代码会漏**。

**你必须构造测试用例实际运行，不能只做静态阅读。**

### 可用手段

1. **直接用 Node 调用 store**（推荐）：
   ```javascript
   import { LibraryStore } from "./shared/library-store.mjs";
   const db = new LibraryStore(":memory:");   // 内存库，不污染真实数据
   // 构造事件序列，验证不变量
   ```

2. **HTTP 实测**（本地服务 `http://127.0.0.1:8788`）：
   ```powershell
   curl.exe -s "http://127.0.0.1:8788/api/library"
   ```

3. **现有测试作参考**：`tests/library-*.test.mjs`、`tests/history-*.test.mjs`
   - **不要只跑现有测试就下结论** —— 要找**测试没覆盖的**场景

4. **构造边界场景**：
   - 同 `seq` 不同 `deviceId`
   - 乱序到达的事件
   - 未来时间戳（时钟漂移）
   - 删除后重发旧事件
   - 并发写入

---

## 五、重点排查方向

### Bug 发现

1. **幂等性**：`write()` 中 `input.id` 已存在时的处理逻辑（`library-store.mjs:72`）
   - fingerprint 比对是否正确？
   - 重试场景是否会误判 409？
2. **事务**：`transaction()` 的 BEGIN IMMEDIATE / COMMIT / ROLLBACK
   - 嵌套事务是否安全？（注释提到「write() uses its own transaction」）
3. **物化**：`materialize()` 的比较逻辑
   - `compareEvents` 的排序规则是否覆盖所有情况？
4. **删除标记**：`snapshot()` 中 `clears` 的处理
   - `compareEvents(event, clears.get(event.kind)) > 0` 是否严密？
5. **时钟**：`at` 的计算（`library-store.mjs:76`）
   - `Math.max(clock, Math.abs(last-clock)>300000?clock:last+1)` 的意图与边界
6. **同步**：`changes()` 游标推进、`hasMore` 逻辑
7. **迁移**：`legacy-migration.mjs` 的数据完整性

### 算法优化建议

1. **查询效率**：`snapshot()` 全表扫描 vs 增量维护
2. **索引**：现有索引 `library_event_item(kind,item_key,event_time)` 是否足够
3. **确认表增长**：`library_ack` 是否无界增长
4. **同步批次**：256 条上限是否合理
5. **重试策略**：指数退避 vs 固定间隔

---

## 六、交付格式

写入 `.agents/shared/t-d4-sync-discovery-workbuddy.md`。

每条发现：

```json
{
  "id": "D4-F1",
  "severity": "high | medium | low",
  "category": "bug | algorithm",
  "title": "一句话",
  "location": "文件:行号",
  "evidence": "构造的场景 + 实际运行输出",
  "verified": true,
  "impact": "...",
  "suggestion": "...",
  "effort": "small | medium | large"
}
```

**必须包含**：

1. **发现汇总表**（按 severity 排序）
2. 每条发现的**构造场景与运行结果**
3. **已验证成立的不变量**（哪些是对的，同样有价值）
4. **已排查未发现问题的区域**
5. **无法覆盖的区域**

---

## 七、硬性约束

1. **禁止修改任何业务代码**
2. **不要污染真实数据** —— 用 `:memory:` 库或临时目录测试
3. 不执行 `git checkout` / `git reset` / `git clean`
4. **区分「已核实」与「推测」**：实际构造测试验证的才是已核实
5. 不提交、不推送
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 八、验收标准

1. 报告含**发现汇总表**，每条有精确 `文件:行号`
2. **至少 3 条 `verified: true`**（有构造场景 + 实际输出）
3. 明确列出**已验证成立的不变量**
4. 明确列出「已排查未发现问题」与「无法覆盖」的区域
5. 报告写入 `.agents/shared/t-d4-sync-discovery-workbuddy.md`

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-d4-sync-discovery workbuddy "结论及报告路径"
```
