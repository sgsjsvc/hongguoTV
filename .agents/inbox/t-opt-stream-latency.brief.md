# O1 取流首块 12 秒根治 + stream 首块预热

- **任务ID**: `t-opt-stream-latency`
- **assignee**: `codex`（共享引擎 + 后端唯一写者）
- **依赖**: 无
- **优先级**: 🔴 **最高**（当前用户可感知的最长等待）
- **上游依据**: `.agents/shared/dsh-optimization-proposals-20261017.md`（第一节含完整实测数据与代码级根因）

---

## 一、问题（DSH 实测，可复现）

**取流首块 256KB** 出现**间歇性约 12 秒**：

| 剧名 | 冷 | 热 |
| --- | --- | --- |
| 黄金时代第一季 | 475 ms | 26 ms |
| 谁说没灵根不能修仙的？ | 693 ms | 24 ms |
| 我隐藏身份，找到了新妈妈 | **11768 ms** | 25 ms |
| 天道余途：苍途问道3 | **11844 ms** | 24 ms |
| 情有独钟 | **12450 ms** | 171 ms |

逐集诊断显示**同一部剧时快时慢**（`我隐藏身份` 首次 11768 ms、二次 334 ms），
**幅度高度一致**（11768/11844/12450/11900）→ 判定为**固定超时/回退特征**，非网络随机抖动。

> ⚠️ 这**更正**了 `perf-p1-verdict.md` 把 11614 ms 判为「瞬时抖动」的结论。

## 二、根因（已定位到行）

`shared/content-core/hongguo.js:846-884` `remoteRange()`：**顺序回退** ——
先 `attempt(primaryUrl)`，**等它失败后**才 `attempt(backupUrl)`。
主 CDN 地址（`main_url`）在被测时段不可用/极慢，等它失败的那段即 ~12 秒。
一旦粘性切换到备用地址，后续该集就快（24–26 ms）。

## 三、必须做

### 3.1 根因确认（先证后改）

1. 用 `HG_TIMING=1`（opt-in trace，已接线）或临时插桩，**分离测量**：
   - `attempt(primaryUrl)` 的实际耗时与失败原因（超时？状态码？Range 校验失败？）
   - `attempt(backupUrl)` 的实际耗时
2. **复现** ~12 秒：用 `node outputs/testing/dsh-stream-cold-probe.mjs` 多轮取样，
   给出「慢样本占比」与主/备地址各自的耗时分布
3. 报告须明确：12 秒究竟花在**超时等待**、**DNS/连接**、还是**响应体传输**

### 3.2 修复（方向建议，你可评估更优解）

任选其一或组合，**并说明取舍**：

| 方案 | 说明 | 期望 |
| --- | --- | --- |
| **A. 并行竞速** | 主/备地址**同时**发起，取先成功者（注意取消败者，避免浪费流量） | 12 s → ~0.4 s |
| **B. 快速失败** | 首块（256KB）用短超时（如 2–3 s）即回退；后续大分片可用长超时 | 12 s → ~2–3 s |
| **C. 健康标记** | 记录主地址近期失败，短期直接走备用，不重复试探 | 后续请求≈0 |

⚠️ **不得**为求快而放宽正确性校验（`媒体 Range 偏移不符`、`总长度不符`、`长度异常` 三类断言必须保留）。
⚠️ 若改动 `shared/content-core/hongguo.js`：**必须同步 `custom-server/vendor/hongguo.cjs` 与
`server/vendor/hongguo.cjs` 两份副本**，并验证 Node 与 QuickJS 两侧行为。

### 3.3 预取扩展到 stream 首块（P1 遗留的未决策项）

`perf-p1-verdict.md` 第六节记录该增强「待用户决定」，**现依据 12 秒实测数据决定实施**。

- 当前预取契约：`detail` 目标会预热第一集**画质**，**不下载视频正文**
- 目标：为「即将播放」的剧集预热 **stream 首块**（`prepareHeader` 的 ftyp+moov+CENC 索引）
- **建议保守实现**（避免流量浪费）：
  - 只预热**当前播放项的下一部/下一集**（而非整页）
  - 或复用既有 `/api/prefetch` 契约新增 `kind: "stream"`（或 `warmStream: true`），**由客户端显式请求**
  - 必须走既有 `prefetchQueue` 的并发限制与可取消机制
- 报告须给出**流量代价**（每剧多下载 KB 数）与**收益**（切剧等待下降量）

## 四、唯一写者范围

**允许改**：
- `shared/content-core/hongguo.js`
- `custom-server/vendor/hongguo.cjs`、`server/vendor/hongguo.cjs`（**必须与上者逐字节一致**）
- `custom-server/index.mjs`（仅预取相关接线）
- `server/provider.mjs`（如需）
- `tests/**`（新增回归测试）

**禁止改**：
- ❌ `apps/web-pc/**`（antigravity）、`apps/tv-android/**`（qoder）、`apps/mobile/**`（workbuddy）
- ❌ `shared/recommendation-core.cjs`（另一个任务 `t-opt-recommend-warmup` 的范围，避免双写）

## 五、验收标准

1. **根因有明确结论**：12 秒花在哪一步、为何幅度一致、主地址失败原因
2. **修复后有前后对比数据**（同一脚本 `dsh-stream-cold-probe.mjs` 复测）：
   - 目标：**冷启动最坏值 ≤ 1.5 秒**（硬指标）；期望 ~0.4 秒
   - 慢样本占比从 3/5 降至 0
3. **正确性未放宽**：三类 Range/长度断言保留且测试覆盖
4. **三副本逐字节一致**（给出三个 SHA256）
5. **全量回归**：`npm test` 通过（当前基线 214/214），并新增针对并行/回退的回归测试
6. **QuickJS 侧**：说明是否受影响及验证方式（TV 端经 JNI 执行同一引擎）
7. 报告：`.agents/shared/t-opt-stream-latency-codex.md`；结果：`.agents/outbox/t-opt-stream-latency.json`

## 六、明确不做

- ❌ 不修 `apps/**` 各端代码
- ❌ 不改推荐核心（属另一任务）
- ❌ 不为了掩盖 12 秒而只加预热（**根因必须修**）
- ❌ 不提交、不推送、不打 tag、不发布（由 DSH 统一）
- ❌ 不删除他人报告/证据/锁；不启停用户正在运行的服务（`8788` 为在用服务）