# P1 播放预取执行结果

负责人 codex，2026-10-16。执行已认领的 `t-p1-detail-cache`，按修正后的 brief 实现预取基础设施，而非再建详情缓存。

## 设计与范围

采用后端通用预取接口，便于客户端显式提交、查询、取消。仅 provider 方法不能表达离开页面时取消一批请求，所以选 POST/GET/DELETE 接口。`detail` 目标自动预热首集画质，`qualities` 支持直接传分集 ID。未扩展 rank/category/recommend：前两者为建议项，推荐存在顺序约束；明确拒绝未实现 kind。

- `POST /api/prefetch`：targets 1–8 项，字符串 ID。返回 202 和随机批次 ID。
- `GET /api/prefetch/:id`：批次与目标状态；complete 表示结束，不代表每项目标成功。
- `DELETE /api/prefetch/:id`：取消批次，不影响其他批次或已加入的前台订阅者。
- `HG_PREFETCH_ENABLED=0`：关闭并返回 enabled=false；客户端也可不提交预取。
- 默认后台并发 1（上限 2），排队资源至多 32、状态批次至多 64；去重，已完成状态按需回收。前台详情/画质/取流元信息加载时暂不调度新的后台任务；预取失败隔离并记录目标 failed，不打断主流程。
- AsyncLocalStorage + Axios 拦截器将底层请求的取消信号传入真实网络请求。共享资源按订阅者计数，全部放弃时才 abort；/stream 也加入同一个 video-info 资源，避免取消预取打断前台播放。
- 详情继续使用已有 pageCache，TTL 180 秒 / 容量 100，不另建详情数据缓存。增加短期请求合并。fresh=1/true 绕过旧缓存，使用刷新代际隔离与普通请求，避免并发 fresh 命中旧缓存；X-Cache=HIT/MISS/BYPASS 可观测，刷新期间普通请求状态为 MISS。

业务修改仅 `server/provider.mjs` 与 `custom-server/index.mjs`。未修改共享引擎、Web 源码或 TV 源码。新增 tests/prefetch.test.mjs、tests/prefetch-routes.test.mjs；更新 playback-p0 的生产 handler fixture 并增加取消并发回归。

接口契约已交接 `.agents/shared/p1-prefetch-api-contract.md`。**本任务未修改客户端触发器**，自动提交“下一部”预取需 Web/Windows 维护方接入；TV 独立 QuickJS 引擎不使用 Node 接口。本轮不能声称所有端的自动切剧已经完成预取接入。

## 验证

按 TDD：先得到缺少导出导致测试失败，再实现；独立审查发现 fresh 与普通请求竞争、预取取消可能中断流解析，两项均补回归确认 RED 后修复至 GREEN。详情 fixture 将真实 coalescer 与 provider 放入同一 VM，验证刷新等待旧请求、并发刷新、预先取消不遗留锁。队列测试覆盖去重、真实并发限制、前台优先、失败隔离、关闭、取消和前台共享。HTTP fixture 验证 API、状态、首集画质预热、X-Cache、fresh、错误输入；真实 stream HTTP 测试验证取消后台时前台继续返回媒体数据。

- `npm test`：151 / 151 通过，日志 `outputs/testing/p1-node-tests-final.log`。
- `npm run smoke`：三部真实样本全部画质查询成功、720P Range 206 / 65536 B / ftyp，health.upstreamHealthy=true。日志 `outputs/testing/p1-smoke-final.log`。使用独立数据目录与 8898 临时端口，未重启原服务。
- 独立只读审查及复审由 p1_review 完成，发现的两个重要问题已修复；随后补强同 VM 测试。

## 实网耗时与限制

执行 `.agents/shared/p1-live-prefetch-check.mjs`，调用协调者 `scripts/perf/measure-real-switch.mjs` 的原始逻辑，只替换 BASE 指向自有随机端口并固定推荐 session。因 brief 的 outputs/debug 路径不存在，使用仓库现有 scripts/perf 路径，未改测量源文件。冷服务与预取服务分别启动以隔离缓存。

最终证据 `outputs/testing/p1-prefetch/`：

- `before-measure-real-switch.log`：原脚本冷切剧四部平均 5481 ms，其中详情平均 1942 ms；已缓存场景 A=981 ms。
- 六个目标后台预取完成共约 11177 ms（并发 1）。预取后详情 0.93–3.19 ms，全部 HIT、全部低于 50 ms；画质 0.48–1.11 ms。
- 首次取流加总：218.7、256.1、11615.5、234.8、299.6、97.9 ms，5/6 低于 300 ms。一个样本首段取流约 11.6 秒，导致全部平均 2120.4 ms，**不能宣称所有切剧均 <300 ms**。首轮同样观察到该样本取流约 10 秒，证据保存在 p1-prefetch-first-pass；该慢点在视频媒体获取/准备，详情及画质已命中，不属于再次缺少详情缓存。
- `after-measure-real-switch.log`：原脚本已缓存场景 A=75 ms，B 因详情已预取而按原逻辑跳过，**不把跳过当作所有冷切剧均达标**。
- fresh=1 实测 BYPASS，约 2615.7 ms；证明实际重新请求上游。
- `.agents/shared/p1-concurrent-check.mjs`：实际后台冷详情处于 running 时，前台已缓存详情连续五次 0.77–2.56 ms，空闲对照约 1.29 ms；随后 DELETE 成功取消。见 concurrent-results.json。这是缓存前台请求的实测，不代表所有网络负载下均无带宽竞争。

详细数字见 results.json；不改 CDN、重试、媒体引擎或客户端源码来掩盖剩余慢样本。需 DSH 决定后续媒体首段/容器准备优化；无离线下载，预取不下载视频正文。

## 交接

符合本任务硬验收的接口、详情 <50 ms、并发/取消/失败隔离、fresh、可观测及全测试已完成。全链路 <300 ms 的目标未在全部样本达成，明确保留；客户端触发接入也仍需其执行方。未提交、推送、重启用户服务或发布新包。
