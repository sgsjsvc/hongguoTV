# R10 资料库性能与时序优化 — workbuddy 复核与实施报告

**任务 ID**: `t-r10-store-perf`
**负责人**: workbuddy
**日期**: 2026-10-14
**状态**: 已完成
**修改文件**: `shared/library-store.mjs`（业务）、`docs/LOCAL_REMOTE_SERVICES.md`（协议文档）、`tests/library.test.mjs`（新增 4 条回归测试）

---

## 一、逐项处置

### D4-F4（low）library_ack 无界增长 → 已修复：确认游标 + 清理

`acknowledge()` 现在除逐事件确认行外，还维护每条远程一个**连续确认游标** `ackCursor:<target>`：

1. 写入确认行后，从当前游标起按 revision 顺序批查（每批 128 行，遇第一个未确认事件即停）；
2. 游标推进到「所有本地事件均已确认」的最大 revision；
3. 删除被游标覆盖区间 `(previous, cursor]` 内的确认行——清理范围仅限本次新覆盖区间，不随历史放大。

`pending()` 同步加 `revision > cursor` 条件（保留原有 `NOT IN` 以精确排除缺口区已确认事件，语义与修复前完全一致）。

**旧库迁移**：无游标的旧确认行在首次 `acknowledge()` 时自动走一遍游标推进，迁移前后 `pending()` 结果一致（harness `REG_legacyAcks`/`REG_legacyAfterAck` 实测前后一致）。

### D4-F5（low）热路径全量计算 → 已修复：快照缓存

`snapshot()` 按 `recordVersion`（进程内记录变更计数，`materialize()` 与 canonical 更新时间比较时自增）+ `PRAGMA data_version`（跨连接兜底）缓存，命中即返回**深拷贝**（`structuredClone`），调用方修改不污染缓存。

> `tick()` 结尾重复调用 `pending()` 的复用属于 `custom-server/library-sync.mjs`（R9 属地，本任务约束不可改），已在本文档记录并建议后续任务处理。

### D4-F6（low）显式 at 可回退 lastTime → 已修复

```js
const auto = Math.max(clock, Math.abs(last-clock)>300000 ? clock : last+1);
const at = input.at==null ? auto : Math.max(input.at, last);
```

显式 `at` 钳制为 `>= lastTime`；`input.at == null` 的自动路径（含 >300s 时钟跳变恢复）逐字保留；`at` 等于 lastTime 时原值保留，不产生 +1 漂移。

### D4-F8（info）seedTarget 语义 → 文档化，不改代码

**评估结论**：不改代码。理由：(1) 现有测试 `seeding preserves equal-time deletion ordering...` 锁定了「播种=全量重推且保留原事件身份」行为；(2) 全量重推是幂等的（远端按事件 ID 去重），单远程只播种一次，成本一次性；(3) 引入 `is_seed` 标记属于协议行为变更，需升协议版本并同步各端。已写入 `docs/LOCAL_REMOTE_SERVICES.md`「事件排序与确认（实现约定）」：**首次播种=全量重推**，含删除标记、不改变本地快照与同时间事件顺序。

### D4-F9（info）平局裁决规则 → 文档化，不改代码

**评估结论**：维持现状并写明规则——排序为 `at` → `deviceId` 字典序 → `seq`；同设备同毫秒序号大者胜；跨设备同毫秒由 `deviceId` 字典序裁决。理由：全部端实现一致且确定性，现有测试锁定（`library.test.mjs` 平局场景依赖该顺序），消歧需逻辑时钟并升协议版本。

---

## 二、量化对比（修复前 vs 修复后）

修复前版本经 `git show HEAD:shared/library-store.mjs` 提取，与当前版本同进程对比实跑（`:memory:`，两轮取稳定值）：

| 指标 | 修复前 | 修复后 | 变化 |
| --- | --- | --- | --- |
| `pending()` @1500 条全部已确认 | 0.566–0.605 ms/次 | **0.019–0.022 ms/次** | 约 **28×** 提速 |
| `library_ack` 行数（同上场景后） | 1500 | **0** | 有界 |
| `snapshot()` @3000 条收藏记录 | 5.79–6.53 ms/次 | **3.29–3.67 ms/次** | 约 **1.8×** 提速 |
| F6 `write(at=1000)` 后 `write(at=500)` | lastTime=500（回退） | **lastTime=1000** | 修复 |

`pending()` 与 ack 行数不再随已确认数增长（游标区间扫描 + 小确认表）；`snapshot()` 热点查询走缓存。

---

## 三、回归验证

**前后对比 harness**（`%TEMP%\r10-harness.mjs`，输出落盘 `%TEMP%\r10-harness-output.json`）覆盖 20 个场景，全部 STABLE/FIXED/IMPROVED：

- D4 不变量：幂等重收、ID 复用 409/400、同毫秒平局（deviceId 裁决）、clear 阻挡旧 set 与新 set 复活、`UNIQUE(device_id,seq)` 409、批量 256 上限、`changes()` 分页、per-target pending 隔离、远程事件不回显、seedTarget 全量重推/快照不变/幂等、canonical 身份校验 409、clampFuture 上限、自动 at 单调、write 重放返回原事件
- 新增风险面：**无游标旧 ack 行迁移**、**确认缺口**（缺口后已确认事件不上传、游标暂停前进）、**跨连接缓存失效**（A 进程写入后 B 进程快照不读到陈旧值）

**测试套件**：`node --test tests/*.test.mjs` → **81/81 通过**（基线 75 + R8 新增 2 + R10 新增 4）。`tests/library-sync.test.mjs` 真实 HTTP 端到端双设备同步（含 push/ack/pull 全链路）通过，覆盖游标与清理在生产路径上的行为。

**新增回归测试**（`tests/library.test.mjs`）：显式 at 不回退 lastTime；确认推进游标并清理被覆盖行且 pending 精确；无游标旧 ack 行迁移期 pending 精确；快照缓存反映新写入且不共享可变状态。

---

## 四、范围与已知限制

- 未触碰 `custom-server/`（R9）与 `history-store.mjs`（R8）；未回退其他 agent 改动。
- `write()` 自动路径遇 >300s 时钟跳变仍以 clock 重置 lastTime（D4-F6 范围外，属既定时钟恢复设计，本次未动）。
- 极端情况：某事件长期无法被确认（如远端持续拒绝该事件）时，其后已确认事件的 ack 行暂不清理，`pending()` 仍靠 NOT IN 保持精确、不回退。
- VACUUM 未启用：清理走 DELETE，文件空间回收留给运维（频繁 VACUUM 代价高于收益）。

---

## 五、验收对照

| Brief 要求 | 结果 |
| --- | --- |
| F4 有清理路径 + pending 不随已确认数线性增长 | ✅ 游标清理 + 0.57ms→0.02ms（量化） |
| F5 热路径耗时下降（量化） | ✅ snapshot 6.5ms→3.3ms |
| F6 显式 at 不回退 lastTime | ✅ B2 复测 500→1000 |
| F8/F9 明确处置并说明理由 | ✅ 均文档化（见上） |
| `npm test` 全绿且不删减现有测试 | ✅ 81/81（仅新增） |
| 报告落盘 `.agents/shared/t-r10-store-perf-workbuddy.md` | ✅ 本文件 |
