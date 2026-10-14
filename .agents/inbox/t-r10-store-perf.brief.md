# R10 资料库性能与时序优化

**任务 ID**: `t-r10-store-perf`
**负责人**: workbuddy
**依赖**: 无（与 R8/R9 不同文件，可并行）
**协调者**: dsh

---

## 一、修复目标

| 发现 | 严重度 | 标题 | 位置 |
| --- | --- | --- | --- |
| **D4-F4** | low | library_ack 无清理路径，无界增长 | `library-store.mjs:63,126` |
| **D4-F5** | low | snapshot()/pending() 全量计算在热路径 | `library-store.mjs:115-125` |
| **D4-F6** | low | 客户端显式 at 可回退 lastTime | `library-store.mjs:76` |
| **D4-F8** | info | seedTarget 把外来事件翻成 is_local=1 | `library-store.mjs:128-134` |
| **D4-F9** | info | 跨设备同毫秒平局按 deviceId 裁决 | `library-store.mjs:51` |

**详见**：`.agents/shared/t-d4-sync-discovery-workbuddy.md`

---

## 二、逐项说明

### D4-F4（优化）library_ack 无界增长

**证据**：grep 全仓库，`library_ack` 仅 CREATE/INSERT/SELECT，**无 DELETE/TTL**。

**实测**：1500 条已确认时 `pending()` ~0.68ms/次，**随表增长线性恶化**。

**建议**：按 target 清理早于最旧未确认事件 revision 的 ack 行；或改 `LEFT JOIN ... WHERE ack.event_id IS NULL` 走索引；定期 VACUUM。

---

### D4-F5（优化）热路径全量计算

**证据**：

| 操作 | 耗时 |
| --- | --- |
| `snapshot()` @3000 条 | ~7.9ms |
| `pending()` @1500 已确认 | ~0.68ms |

`GET /api/library` 每次都触发 `snapshot()` + `sync.view()`（后者又跑一次 `pending()`）。

**建议**：`snapshot` 按 revision 缓存（写入时失效）；`pending()` 用覆盖索引；`tick()` 结尾复用已计算结果。

---

### D4-F6（优化）显式 at 可回退 lastTime

**证据**（场景 B2 实跑）：`write(at=1000)` → `write(at=500)` 后 `lastTime===500`（回退成立）。

**影响**：同设备显式时间戳之后的紧邻写入可能获得非单调 at；`compareEvents` 兜底不丢数据，但事件流时序失真。

**建议**：本地写入时把 `input.at` **钳制为 >= lastTime**。

---

### D4-F8（info）seedTarget 语义

**证据**（场景 E1/J1 实跑）：`seedTarget('new')` 后外来事件出现在 `pending('new')`，被推给新远程。

**建议**：为 seed 事件打独立标记（如 `is_seed`）并发送后清理；或文档化「seed=全量重推」语义。

> **协调者备注**：D4 建议**写入协议文档而非改代码**（行为已被现有测试锁定）。请评估后决定。

---

### D4-F9（info）平局裁决规则

**证据**（场景 D1 实跑）：同设备同 at，高 seq 的 set 胜过 clear（符合签发意图）；跨设备同 at 时由 deviceId 字典序决定。

**建议**：维持现状但在**协议文档**写明平局规则；或引入逻辑时钟消歧。

> **协调者备注**：现有测试已固定该行为，改代码需同步改测试。请评估。

---

## 三、硬性约束

1. **只改 `shared/library-store.mjs`**
2. 若需改协议文档，可改 `docs/` 下文件
3. **不要改 `custom-server/`**（R9 负责）、`history-store.mjs`（R8 负责）
4. **不要回退**工作区其他改动
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

1. **D4-F4**：有清理路径，且 `pending()` 耗时不再随已确认数线性增长（量化对比）
2. **D4-F5**：热路径耗时下降（量化对比，给出前后数值）
3. **D4-F6**：显式 at 不再回退 `lastTime`（场景 B2 复测）
4. **D4-F8/F9**：明确处置（改代码 或 写文档），并说明理由
5. `npm test` 全绿（**现有测试不得删减**，D4-F9 若改行为需同步改测试并说明）
6. 报告写入 `.agents/shared/t-r10-store-perf-workbuddy.md`

---

## 五、验证要求

**必须构造测试场景实际运行**：

```javascript
import { LibraryStore } from "./shared/library-store.mjs";
const db = new LibraryStore(":memory:");   // 不污染真实数据
```

D4 报告列出了 **31 个已验证场景**（见其第三节「已验证成立的不变量」），可作回归基准。

**特别注意**：D4 报告第四节明确「已排查未发现问题」的区域（如事务嵌套、批次上限 256 合理），**不要重复改动这些**。

---

## 六、证据要求

- **量化对比**：每项优化给出修复前后的耗时/调用次数
- **不破坏已成立的不变量**：D4 的 31 场景应仍全部通过
- 证据三件套

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r10-store-perf workbuddy "结论及报告路径"
```
