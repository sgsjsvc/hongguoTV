# DSH 优化建议书（2026-10-17）：UI / 性能 / 延迟 / 算法 / 卡顿等待

- **提出方**: dsh（统筹协调、架构、优先级）
- **依据**: **本轮实测数据**（非历史报告；既往 P1–P6、B5–B9 成果已核实并排除）
- **测量环境**: 本机运行中的 `127.0.0.1:8788` 服务（只读测量，未启停服务）
- **原始数据**: `outputs/testing/dsh-optimization-baseline.json`、`dsh-stream-cold-probe.json`、`dsh-stream-cold-diagnosis.json`

---

## 一、本轮实测：当前真实延迟（关键表）

| 环节 | 冷（首次） | 热（重复） | 判定 |
| --- | --- | --- | --- |
| **取流首块 256KB** | **475 / 693 / 11768 / 11844 / 12450 ms** | **24–171 ms** | 🔴 **间歇性 ~12 秒，最大瓶颈** |
| 详情 `/api/series/:id` | **3334 ms** | 1 ms | 🟠 未预取时慢 |
| 新会话推荐首屏 | **1274–2545 ms** | 1 ms | 🟠 新会话冷启动 |
| 清晰度 qualities | **576 ms** | 1 ms | 🟡 未预取时慢 |
| health / banners / sections / rank-types | 5–40 ms | 5 ms | ✅ 正常 |

### 1.1 🔴 取流首块 12 秒 —— 本报告最重要的发现

**逐剧首块冷启动（5 部）**

| 剧名 | 冷 | 热 |
| --- | --- | --- |
| 黄金时代第一季 | 475 ms | 26 ms |
| 谁说没灵根不能修仙的？ | 693 ms | 24 ms |
| 我隐藏身份，找到了新妈妈 | **11768 ms** | 25 ms |
| 天道余途：苍途问道3 | **11844 ms** | 24 ms |
| 情有独钟 | **12450 ms** | 171 ms |

**逐集诊断（同一部剧前 3 集）**

| 剧名 | ep1 | ep2 | ep3 |
| --- | --- | --- | --- |
| 影后的剧本出了错 | 733 ms | **11900 ms** | 617 ms |
| 锦绣八零，一禾寄北 | 478 | 366 | 446 |
| 我隐藏身份，找到了新妈妈 | 334 | 554 | 377 |
| 天道余途：苍途问道3 | 354 | 322 | 355 |
| 心动，恰逢其时 | 436 | 903 | 539 |

**两个决定性推断**：

1. **不是"按剧稳定"**：`我隐藏身份`、`天道余途` 在第一次测量慢（11.7s/11.8s），第二次测量快（334ms/354ms）
   → **同一部剧时快时慢**，与剧集本身无关。
2. **幅度高度一致**（11768 / 11844 / 12450 / 11900 ms）
   → 这不是网络随机抖动，而是**固定的超时/回退时间特征**。

> ⚠️ **更正既往结论**：`perf-p1-verdict.md` 曾把 11614 ms 判定为「瞬时抖动、不影响验收」。
> **本轮实测证明该判定不成立** —— 它是**可复现的间歇性缺陷**，幅度稳定在 ~12 秒。

### 1.2 根因定位（代码级，已定位到具体行）

`shared/content-core/hongguo.js:846-884` 的 `remoteRange()`：

```js
const attempt = async (target) => {
    const resp = await axios(target, { ... timeout: 30000, responseType: 'arraybuffer', signal });
    ...
};
try {
    return await attempt(primaryUrl);          // ← 先试主地址，慢/坏就白等
} catch (error) {
    if (signal?.aborted || !backupUrl) throw error;
    const result = await attempt(backupUrl);   // ← 之后才用备用地址
    if (stream.url === primaryUrl) { stream.url = backupUrl; ... }  // 粘性切换
    return result;
}
```

**机制**：主 CDN 地址（`main_url`）在部分时刻不可用/极慢，但代码是**顺序回退**：
必须等主地址**失败**，才去用备用地址（`backup_url`）。等主地址失败的那段时间就是 ~12 秒。

**佐证**：
- 热取仅 24–26 ms（`prepareHeader` 结果已缓存于 `streamCache`）→ 12 秒是**一次性准备成本**
- 一旦粘性切换到备用地址，后续该集都快（25 ms）

**修复方向（建议 codex 评估，非唯一解）**：
1. **并行竞速**：`Promise.any([attempt(primary), attempt(backup)])` 取先成功者 —— 期望把 12 s 压到 ~0.4 s
2. **快速失败**：主地址用更短超时（如 2–3 s）即回退；或对首块（256KB）用短超时、后续分片用长超时
3. **健康标记**：记录主地址近期失败，短期直接走备用，不重复试探

⚠️ 改动 `hongguo.js` 是**共享引擎**（三端共用），必须同步两个 vendor 副本并验证 Node/QuickJS。

---

## 二、优化建议（按收益/风险排序）

| # | 优化项 | 现状 → 目标 | 收益 | 风险 | 归属 |
| --- | --- | --- | --- | --- | --- |
| **O1** | **取流首块并行竞速/快速失败** | 12 s → ~0.4 s | 🔴 极大（消除最长等待） | 中（共享引擎） | codex |
| **O2** | **预取扩展到 stream 首块** | 首块未预热 → 预热 | 🔴 大（切剧≈0 等待） | 中（+256KB/剧流量） | codex |
| **O3** | **新会话推荐冷启动预热** | 1.3–2.5 s → ~0 | 🟠 大（首次进推荐流） | 低 | codex |
| **O4** | **扩大 detail 预取覆盖** | 未预取 3.3 s → ~0 | 🟠 中 | 低 | codex |
| **O5** | **Web 端加载态/骨架屏** | **0 骨架屏、0 loading 文案** | 🟠 大（**感知**等待） | 低 | antigravity |
| **O6** | **TV 端首帧/切集延迟验证** | 未测量 | 🟠 中（受益于 O1） | 低 | qoder |
| **O7** | **延迟纳入发布门禁** | 门禁无延迟指标 | 🟠 中（防退化） | 低 | opencode |
| **O8** | **算法：先测量后调优** | append 已 P95 1.03 ms（**不必再优化性能**） | 🟡 质量向 | 中 | codex |

### 2.1 关于「算法」的诚实结论

**算法性能已不是瓶颈**：`recommendation-core.cjs` 的 `append()` 经 B7 优化后 P95 = **1.03 ms**
（DSH 独立复跑 3 次：0.8767 / 0.8628 / 1.0343 ms）。**不建议再做性能优化**。

真正可优化的是**推荐质量**，但**必须先测量再改**，避免"凭感觉调参"：
- 新会话/新用户冷启动的推荐多样性（是否有足够探索）
- 近期观看降权强度是否合适
- 完播/快跳信号的实际利用程度
- 是否出现同页重复或类型单一

### 2.2 关于「UI」的说明

- **手机端**：T7 已彻底重构为短视频流式（底部 Tab + 竖滑切剧），本轮**不重复提议**
- **Web/桌面端**：实测 `apps/web-pc/src` 中**骨架屏 0 处、loading 文案 0 处**
  → 等待 1.3–12 秒期间**用户看不到任何反馈**，这是"卡顿等待"的**感知**主因（O5）
- **TV 端**：需实测首帧时间（O6）

### 2.3 一个必须说明的协作前提

本轮所有端（Web/TV/手机）**共用同一个内容引擎** `shared/content-core/hongguo.js`。
因此 **O1/O2/O3/O4 的收益对所有端同时生效**，无需每端各改一份 ——
这也是我一直坚持"引擎唯一写者是 codex"的原因。

---

## 三、任务分配（已建单，均 `pending`，由执行方自行认领）

| 任务ID | 标题 | assignee | 依赖 | 文件范围 |
| --- | --- | --- | --- | --- |
| `t-opt-stream-latency` | 取流首块 12 s 根治 + stream 预热 | **codex** | 无 | `shared/content-core/hongguo.js`、2 个 vendor、`custom-server/index.mjs` |
| `t-opt-recommend-warmup` | 推荐冷启动预热 + 推荐质量测量 | **codex** | `t-opt-stream-latency` | `custom-server/index.mjs`、`server/provider.mjs`、`shared/recommendation-core.cjs` |
| `t-opt-web-loading` | Web/桌面端加载态与骨架屏 | **antigravity** | 无 | `apps/web-pc/src/**` |
| `t-opt-tv-first-frame` | TV 端首帧与切集延迟 | **qoder** | 无 | `apps/tv-android/**` |
| `t-opt-latency-gate` | 延迟测量与发布门禁 | **opencode** | 无 | `scripts/perf/**`、`tests/**` |

**串行约束**：`t-opt-stream-latency` 与 `t-opt-recommend-warmup` 都改 `custom-server/index.mjs`
→ 第二个设 `blockedBy`，避免同一文件双写。

**并行性**：codex / antigravity / qoder / opencode 四者可完全并行（文件不重叠）。

---

## 四、测量方法（可复现）

```powershell
# 需先有运行中的服务（本轮用 127.0.0.1:8788，只读测量）
node outputs/testing/dsh-optimization-baseline.mjs   # 全链路冷热对比
node outputs/testing/dsh-stream-cold-probe.mjs       # 逐剧首块冷/热
node outputs/testing/dsh-stream-cold-diagnosis.mjs   # 同一剧前3集，判断是否按剧稳定
```

**验收要求**：优化前后必须用**同一脚本**复测并给出对比数据；
`t-opt-latency-gate` 负责把这些脚本固化为门禁。

---

*本文件由 DSH 依据 2026-10-17 本轮实测写成；历史报告（P1–P6/B5–B9）成果已核实，未重复提议。*