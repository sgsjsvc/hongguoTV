> 2026-10-16 后续更新：DSH已裁定唯一写者，正式接线及四路由/214项回归已完成，见 [正式交付](b5-b7-final-integration-codex.md)。下文保留前期测量与当时的待接线事实；本次没有改写原样本。

# B5 响应速度测量基建（Codex）

日期：2026-10-16。执行方：Codex。状态：测量脚本、独立追踪模块与基线已交付；**尚待 DSH/B6 协调 `custom-server/index.mjs` 唯一写者并接线，B5 不应整体标 done。** 未停止用户服务、未提交 Git、未发布。

## 修改与范围

- 新增 `scripts/perf/measure-end-to-end.mjs`：独立 headless Chrome/Edge + CDP，在浏览器用 `fetch` 获取完整 JSON 响应，按 ResourceTiming 记录 DNS、TCP（不含 TLS）、TLS、TTFB、content、total。HTTP 缓存禁用；支持独立后端或既有 loopback 后端。输出 CSV、JSON、heatmap + line chart HTML。
- `--spawn-server` 使用 `HG_PORT=0`、独立数据目录、`HG_PREFETCH_ENABLED=0`，只关闭自己启动的进程。`--base` 模式不冒充可控制已有进程的缓存/预取状态。
- `scripts/perf/prepare-b5-snapshot.mjs`：固定源快照，第二份从第一份复制，仅撤去三份引擎的 Q2 definition 优先链，并逐文件校验差异；不改变工作区代码或用户数据库。
- 新增 `custom-server/request-timing.mjs`：可选接线模块，记录服务端响应头耗时 `Server-Timing: app;dur=...`、finish/close 总耗时与中断状态。日志仅记录允许的路由模式，动态 ID 和 query 脱敏；finish/close 只记录一次。**模块尚未接入实际入口。**
- 新增 `tests/perf-measurement.test.mjs` 和 `tests/request-timing.test.mjs`。没有修改业务路由、引擎、Provider 或现有性能脚本。

隐私：不保存请求/响应 body、密钥、完整请求 URL、媒体 URL。`corpus.json` 仅保存用于复跑的字符串剧集/分集 ID；CPU/内存样本为目标 Node 进程，不包含 Chrome 或整机占用。

## 指定版本核实与实验边界

brief 将 `617c073` 与 `c2561f5` 视为 Q2 前后版本，但实际两次提交均是协作文档修改；两者 `shared/content-core/hongguo.js` SHA256 都是 `9ce76183681421d9261db56842c27d938242200824857b57f33d64c316366afe`。不能用它们证明 Q2 性能提升。

因此经根 Codex 确认，实际测量采用固定当前工作区快照的反事实对照：`current-without-definition` 与 `actual-current`。`outputs/testing/b5/snapshot-evidence.json` 保存提交说明与逐文件 SHA256；`snapshot-diff-verification.json` 逐一复核 33 个源文件，确认仅三份引擎不同，恢复 definition 优先后全部字节相同。当前快照不是已提交版本，不能冒充某个 Git commit 的发布构建。

两组均为独立新 Node 进程、本地独立数据库，浏览器缓存和预取禁用；同一份 30 剧 corpus，串行测量每剧详情、画质接口的首次与紧接重复请求。cold 指本次进程的首次资源访问，**不是 CDN/上游全冷**；推荐采样、模块加载等共享初始化已发生。共享主机还可能存在其他 agent 活动，顺序实验不隔离网络/上游缓存波动，不能据此归因 Q2 性能退化或收益。

环境：Windows x64，Node v22.20.0，Chrome，AMD Ryzen 5 7500F，12 逻辑核。环境与 PID 在各 `results.json`。

## 实测结果

两组各 30 剧、120 请求，总计 240 请求均 HTTP 200 且 JSON 可解析，无网络失败。**此批原始测量没有保存 qualityCount，故这里只证明 HTTP/JSON 成功，不将其称为所有档位业务验收成功。** 详情首集 ID 已用于下一请求。

| 接口 / 状态 | 旧链 P50/P95/P99 ms | 当前 P50/P95/P99 ms | P50 改善 |
| --- | --- | --- | --- |
| 详情首次 | 1461.3 / 3041.3 / 4436.8 | 1425.6 / 2605.3 / 4120.0 | 2.44% |
| 详情重复 | 1.2 / 5.4 / 9.3 | 1.3 / 4.0 / 4.4 | -8.33% |
| 画质首次 | 307.5 / 415.3 / 479.1 | 327.5 / 594.4 / 604.7 | -6.50% |
| 画质重复 | 1.3 / 5.0 / 5.1 | 1.4 / 11.3 / 21.0 | -7.69% |

没有观察到 ≥15% 延迟收益，也没有足够证据把差异归因于 Q2。definition 优先解决标签正确性，不应承诺它能显著缩短网络等待。当前 30 剧初次画质 P95 594.4ms，初次详情 P95 2605.3ms，可作为后续 B6 独立测量参考。

| 目标 Node 进程 OS 采样 | 旧链 | 当前 |
| --- | --- | --- |
| 样本数 | 68 | 59 |
| 覆盖墙钟 ms | 67628 | 59398 |
| 累计 CPU ms 差 | 968.750 | 703.125 |
| 平均单核占用 | 1.43% | 1.18% |
| 采样 RSS 峰值 MiB | 82.21 | 88.08 |

CPU 为约每秒串行 OS 快照，以上从首尾累计 CPU 计算，不是逐函数 CPU profile，也不含整个进程生命周期的所有峰值。两组测量时长不同，不能直接将 CPU 累计差称为优化收益。因为本地 HTTP、IP 直连与连接复用，多数 DNS/TCP 阶段为零、TLS 全零正常，不能据此估计上游 TLS。该批 Server-Timing 样本数为 0（固定入口快照未接追踪），**没有冒充服务端分阶段实网数据**。

后续脚本已强化：显式记录 itemCount/episodeCount/qualityCount，只把详情有分集、画质数组非空的响应计入对应成功分位数；失败保留到 JSON 并返回非零退出码，避免 HTTP 200 空数据蒙混过关。旧原始结果完整保留，没有补造 count 或覆盖失败样本。

## 验证

TDD：先添加两组测试，观察缺失目标模块的红灯，再实现；最初观察记录在本轮工具输出。当前执行：

```powershell
node --test --experimental-test-coverage tests/perf-measurement.test.mjs tests/request-timing.test.mjs > outputs/testing/b5/script-tests.log 2>&1
```

实际 **9/9 通过，0 skipped**。覆盖行：测量模块 96.73%，追踪模块 100%；该次报告总行 98.36%、总分支 82.13%。准备快照辅助脚本通过上述真实快照运行验证，不冒称包含在该覆盖率分母中。

±5% 测试通过真实 CDP fetch 对可控延迟 HTTP 服务的三次传输，将 ResourceTiming 的网络总耗时与独立 `performance.now()` 包围 fetch+body 的墙钟对比；本次误差 0.1785%、0.0982%、0.0996%。服务端 250ms 响应头等待 + 250ms 内容等待同时验证 TTFB/content 不被虚报为零。服务端 span 不包含网络与浏览器调度，不能拿它作为网络总耗时的相等基准（开发中曾发现这种错误比较并改正）。

另有真实 HTTP 集成测试，验证 `writeHead/end` 的 Server-Timing、finish/close 同时发生时只记一次及动态 URL/query 脱敏；不是仅靠 EventEmitter。CLI 集成验证 JSON/CSV/HTML 隐私、冷暖摘要、CPU、外部服务语义、空 qualities 失败保留与百分位排除。无 Chrome 环境明确跳过两项浏览器测试，设置 CHROME_PATH 后执行；本机未跳过。

全量 Node 测试与业务入口接线由根 Codex 整合后记录，本报告不冒称已执行整个项目门禁。

## 复跑和产物

首次固定快照（已存在会明确拒绝覆盖；复跑快照用独立副本/经协调归档原目录）：

```powershell
node scripts/perf/prepare-b5-snapshot.mjs
node scripts/perf/measure-end-to-end.mjs --spawn-server --server-root=outputs/testing/b5/current-without-definition/source --variant=current-without-definition --out=outputs/testing/b5/before --corpus=outputs/testing/b5/corpus.json --count=30
node scripts/perf/measure-end-to-end.mjs --spawn-server --server-root=outputs/testing/b5/actual-current/source --variant=actual-current --out=outputs/testing/b5/after --corpus=outputs/testing/b5/corpus.json --count=30 --compare=outputs/testing/b5/before/results.json
```

保护本批证据时，复跑将 `--out` 改为新的目录。准备快照工具当前固定路径是本实验目录，不能误以为现有快照会自动更新。

- `outputs/testing/b5/{before,after}/results.json`：原始逐请求与阶段、OS 采样。
- `outputs/testing/b5/{before,after}/results.csv`：可直接作图的数值，不含 body。
- `outputs/testing/b5/after/comparison.html`：对照 heatmap 与折线图。
- `outputs/testing/b5/comparison-summary.json`：本表指标与 CPU 汇总。
- `outputs/testing/b5/snapshot-evidence.json`、`snapshot-diff-verification.json`：版本和严格快照差异证据。
- `outputs/testing/b5/script-tests.log`：真实浏览器误差、测试和覆盖率。

## 剩余接线（交根 Codex / DSH）

待 B6 唯一写者许可，在 `custom-server/index.mjs` 新增 `import { traceRequest } from './request-timing.mjs';`，HTTP server callback 开始处增加 `if (process.env.HG_TIMING === '1') traceRequest(req, res);`。默认关闭，避免常态日志开销；开启后实网健康/接口验证 app metric 与总耗时日志。`app` 是本地响应头等待总耗时，仍不是上游签名/网络/解密逐阶段追踪。未获文件写权前不应擅自接线，也不将部分交付称为任务完成。

根Codex补充：已生成 .agents/shared/b5-b7-index-hooks.patch，尚未应用。隔离复制的真实后端应用提案后健康响应Server-Timing为app;dur=0.197，脚本 scripts/perf/verify-b5-b7-hooks.mjs 验证成功；不重写原30剧快照或其serverMs=null事实。最终当前工作区全量npm test210/210通过（outputs/testing/b7/full-tests-final.log），不等于工作区入口已接线。具体单写者协调见 .agents/shared/b5-b7-file-coordination-codex.md。
