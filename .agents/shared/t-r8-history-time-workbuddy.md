# R8 历史存储时序缺陷修复 — workbuddy 复核与实施报告

**任务 ID**: `t-r8-history-time`
**负责人**: workbuddy
**日期**: 2026-10-14
**状态**: 已完成
**修改文件**: `custom-server/history-store.mjs`（仅此一个业务文件）、`tests/history-store.test.mjs`（新增 2 条回归测试）

---

## 一、修复内容

### D4-F1（medium）importLegacy 水位线无视时间

**位置**: `custom-server/history-store.mjs` `importLegacy()`

**修复前**：墓碑与清空水位线只查存在性——只要 `tombstones`/`deletion_watermarks` 有行，任何 `updatedAt` 的导入条目都被丢弃。

**修复后**：两项检查均改为时间比较，与 `registerSession` 的同构逻辑一致：

```js
const removed = SELECT deleted_at FROM tombstones WHERE series_id=? AND source=?  ?? -1
const cleared = SELECT deleted_at FROM deletion_watermarks WHERE source=?        ?? -1
if (item.updatedAt <= Math.max(removed, cleared)) continue;
```

**行为变化**：清空/删除之后更新的数据可入库；陈旧数据仍被拦截。墓碑路径同样从「存在即挡」改为「时间比较」（与 registerSession 对 `max(tombstone, watermark)` 的比较完全一致）。

### D4-F7（low）未来时间戳通过删除检查

**位置**: `custom-server/history-store.mjs` `registerSession()`

**修复前**：`timestamp()` 容许 `startedAt` 最多为 `now+300000`（时钟偏移容灾），删除检查直接采信该声称时间，`now+290000` 可跃过墓碑/水位线。

**修复后**：在时间比较前增加未来声称守卫——存在删除标记时，声称的 `startedAt` 最多容许 **1 秒**时钟偏差，超出即拒绝：

```js
const deletedAt = Math.max(removed, cleared);
if (deletedAt >= 0 && startedAt > Date.now() + 1000) throw 410 'history session predates deletion';
if (startedAt <= deletedAt) throw 410 'history session predates deletion';
```

**设计取舍**：
- 容差收紧到 1s（D4 建议「秒级」）。未采用「钳制到接收时刻」方案：钳制无法拒绝超越阈值的时间声称（钳制值永远大于过去的标记时间），实测推演后只有显式拒绝能同时满足「+1ms 同毫秒注册可用」与「+290s 拒绝」。
- 守卫仅在**存在删除标记**时生效；无标记时保持原有 `now+5min` 钳制，避免把健康客户端的时钟偏差判成错误。
- `saveProgress` 的 `observedAt` 未来钳制不动（不参与删除判定，无绕过面）。

---

## 二、验证证据（修复前失败 + 修复后通过）

**方法**：`git show HEAD:custom-server/history-store.mjs` 提取修复前版本，与当前版本在同一进程内对同一组场景做前后对比实跑（`:memory:`，不污染真实数据）。harness 未入库，位于 `%TEMP%\r8-harness.mjs`，输出落盘 `%TEMP%\r8-harness-output.json`。

| 场景 | 修复前 | 修复后 | 结论 |
| --- | --- | --- | --- |
| I1 清空后 updatedAt=水位线+60s 的导入 | `list('tv').length=0`（丢弃） | `=1`（入库） | F1 修复 |
| I1 对照组 同状态 `registerSession(startedAt=now+1)` | accepted | accepted | 修复前两入口矛盾（证据），修复后一致 |
| I1b 陈旧导入（updatedAt=水位线-60s） | 拦截 | 拦截 | 无回归 |
| I2 墓碑后 `registerSession(startedAt=now+290000)` | accepted | **410** | F7 修复 |
| I2 同场景 `saveProgress` | accepted | 404（会话未建成） | 连带修复 |
| I2b 墓碑后 `startedAt=now+500`（小偏差） | accepted | accepted | 容差保留 |
| I2c 墓碑后 updatedAt=墓碑+60s 的导入 | 0（丢弃） | 1（入库） | 墓碑路径同步时间化 |
| I2d 墓碑后陈旧导入 | 拦截 | 拦截 | 无回归 |

**测试套件**：`node --test tests/*.test.mjs` → **77/77 通过**（基线 75 + 新增 2 条：`legacy data updated after a clear or tombstone is importable...`、`a claimed future startedAt cannot jump over deletion markers beyond one second of skew`）。

**新增回归测试同时锁定**：墓碑后新数据的导入与 registerSession 行为一致；+290s 拒绝且 saveProgress 404；+500ms 偏差仍可用。

---

## 三、范围与未触碰项

- 未改 `custom-server/index.mjs`（R9 负责）、`shared/library-store.mjs`（R10 负责）。
- 未回退工作区其他 agent 的改动（`git status` 仅本任务两个测试/源码文件 + 文档属本任务范围）。
- `startedAt=0`（epoch）在无删除标记时仍可注册——既有行为，F1/F7 范围外，未改动。

---

## 四、验收对照

| Brief 要求 | 结果 |
| --- | --- |
| F1：清空后更新的数据能入库 | ✅ I1 复测 0→1 |
| F7：未来 startedAt 不能绕过删除标记 | ✅ I2 复测 accepted→410 |
| `npm test` 全绿 | ✅ 77/77 |
| 报告落盘 `.agents/shared/t-r8-history-time-workbuddy.md` | ✅ 本文件 |
| 修复前后对比证据 + 不污染真实数据 | ✅ 上表 + `:memory:` harness |
