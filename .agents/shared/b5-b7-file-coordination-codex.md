> 2026-10-16 后续更新：DSH裁决1已授权，OpenCode释放设备后由Codex完成方案A接线并通过真实四路由验证。旧patch/staged存在reqStart缺陷，禁止直接应用。最新证据及窗口释放见 [正式交付](b5-b7-final-integration-codex.md)，下文保留协调历史。

# B5/B7 文件写入协调

2026-10-16，codex 已领取 B5/B7，已重读职责与共同 brief，检查现有差异。

B5/B7 与 B6 均涉及 custom-server/index.mjs；B6 由 antigravity 执行，暂不写该文件。请 DSH 指定单一写者：建议 codex 交付可导入的 timing/prefetch 独立模块与精确接线片段，由 B6 唯一写者接入，或由 DSH 明确放行串行写入窗口。server/provider.mjs 的现有差异保持。

先执行 scripts/perf、tests、shared/recommendation-core.cjs 的独立工作。B5 的 15% 是待测目标，Q2 仅修复标签，不能预设其必有响应速度收益；将如实报告同条件对比。

请 B9 清理保留本轮 outputs/testing 下 B5/B7 的在用测量证据和现有 Q1/Q2 证据，不应执行与保留证据冲突的整目录清空。

## 可交付接线（等待 DSH 明确单写者）

B5 新增 custom-server/request-timing.mjs，B7 新增 custom-server/prefetch-metrics.mjs，均独立测试。可由 B6 的 index 唯一写者接入：

1. 导入 `traceRequest`（./request-timing.mjs）和 `createPrefetchMetrics`（./prefetch-metrics.mjs）。
2. HTTP callback 第一行：`if (process.env.HG_TIMING === '1') traceRequest(req, res);`。默认关闭，不记录 query/凭据。
3. 建立 `const prefetchMetrics = createPrefetchMetrics();`，把现有 queue loader 函数包装为 `prefetchMetrics.run(async () => { /* 原 loader 原样 */ })`；queue options 加 `concurrency: 2`，保留 enabled。
4. 需要采样时取 prefetchMetrics.snapshot()，或仅在开发测量的 IPC ready/独立测试中读取；生产不向工作区 outbox 无限写日志。scripts/perf/bench-prefetch.mjs 会把受控8项元数据排队实验的时间加权平均/峰值写入 .agents/outbox/prefetch-stats.json（明确标注 synthetic，不冒充实网统计）。

尚未改 index，不借此修改 provider 默认并发，也不触碰 B6 文件。请明确串行写入窗口或请 B6 完成以上小接线后通知 Codex。

## 20:35 复查

B6 已在 index 增加 reqStart/finish 的 [timing] 日志，看到该成果，不应重复记录；建议使用 B5 的 opt-in traceRequest 替代这段（同时有 Server-Timing 响应头、单调时钟、异常关闭去重和ID脱敏）。现在仍没有 Server-Timing，B5 实网快照的 serverMs=null，不能当作已测。

注意 tests/{prefetch-routes,prefetch-wire,quality-labels}.test.mjs 从 function json 起提取 index 到 VM。若接入 createPrefetchMetrics，需在这三个测试上下文导入/传入真实 createPrefetchMetrics；不能因缺少导入而把测试失败误判业务失败。Codex可以在DSH放行后统一补这些接线测试，或请B6写者一并处理。

## 隔离接线验证已备妥

.agents/shared/b5-b7-index-hooks.patch 已生成（未应用）。该补丁的独立副本已通过实际后端启动、Server-Timing 响应头与两部剧的详情/首集画质预取：maxActive=2、2/2成功，平均并发1.587。复跑脚本 scripts/perf/verify-b5-b7-hooks.mjs，证据 .agents/outbox/prefetch-stats-proposed-hooks.json；所有受控进程已退出。最终当前工作区 npm test 210/210通过。仍等待DSH指定写入窗口或B6写者正式应用，任务保留claimed，不冒充已整合。
