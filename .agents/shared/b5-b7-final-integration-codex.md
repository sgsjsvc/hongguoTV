# B5/B7 正式接线交付

执行方codex，2026-10-16（Asia/Shanghai）。B5/B7已完成本轮执行与验证，提交DSH验收；不是正式发布。

## 授权与修正

已重读RESPONSIBILITIES、原brief及dsh-adjudication-20261016.md裁决1/最后指令。mumu list确认OpenCode已释放设备，按DSH指定的唯一写者窗口在当前入口重新接线，未重新claim。

此前旧补丁误删reqStart，原验证只打health/prefetch，遗漏使用该变量的路由，导致隔离提案的其他路由500。DSH反馈已核实并修正。本次没有应用旧b5-b7-index-hooks.patch，也没有读取staged-index作为入口；旧文件仅保留错误证据，**禁止用于安装/接线**。旧并发测量有效，但旧“接线整体可用”结论不成立，以本报告取代。

采用方案A：保留一处`const reqStart = Date.now()`及全部B6传参/elapsed/X-Response-Time/finish日志，附加`HG_TIMING=1`才执行的traceRequest。建立prefetchMetrics，包装原loader，并显式concurrency:2。hot:recommend缓存、X-Cache、fetchOfficialHome预热与推荐前两项预取保持原样。

本次入口SHA256：`b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333`。共享引擎及两份vendor未改且逐字节相同，SHA256均为`cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2`。

## 本轮文件

- custom-server/index.mjs：上述正式接线。
- 新增tests/backend-instrumentation.test.mjs：四项路由级回归，覆盖timing开关、reqStart/B6计时链、非空响应、缓存重试、推荐前置预取与峰值2；删除reqStart定义的突变版本四路由均500，验证确实捕获原漏检。
- tests/prefetch-routes、prefetch-wire、quality-labels、quality-tiers、query-acceleration、playback-p0：仅为入口VM上下文补真实traceRequest/createPrefetchMetrics导入和绑定，没有把计时/指标伪造为空实现。
- scripts/perf/verify-b5-b7-hooks.mjs：改为复制当前工作入口、独立端口和数据目录，覆盖四路由、有效推荐session、缓存HIT、Server-Timing与真实元数据预取；使用node:http，不引入新的undici loopback依赖。仅验证副本追加IPC指标读取，未新增生产HTTP接口。

未修改其他成员业务，不改发布配置或用户数据，不提交/推送。

## 先失败后通过、回归与复审

- 新回归在未接线入口：4项中3失败/1通过，缺少Server-Timing/指标对象；正式接线后4/4通过。red.log、green.log保留。
- `node --test tests/backend-instrumentation.test.mjs tests/prefetch-routes.test.mjs tests/prefetch-wire.test.mjs tests/playback-p0.test.mjs tests/quality-labels.test.mjs tests/quality-tiers.test.mjs tests/query-acceleration.test.mjs`：**42/42通过**。
- `npm test`：**214/214通过，0失败、0跳过**。真实浏览器计时误差0.3124%、0.0794%、0.0998%，均小于5%。日志outputs/testing/b5-b7-final/full-tests.log。
- 独立只读复审：新增路由+预取指标+追踪测试**10/10通过**，确认reqStart/B6链与业务语义保留，无阻断发现。按建议放宽实网脚本“started必须恰为2”的竞态断言：如果POST时预取已完成，可合法再次warm，允许2–4次；仍要求全部成功、峰值2、最终active=0。修改后实网复跑成功，实际仍为2次。
- `node --check custom-server/index.mjs`及本轮文件`git diff --check`通过。

DSH已登记的并发负载下旧loopback fetch偶发失败不因此被撤销；单次214全绿不是唯一发布门禁，OpenCode的跨仓鲁棒性专项和独立发布验证仍按其任务执行。本轮未越界修其49处站点。

## 当前入口的真实路由验证

命令：`node scripts/perf/verify-b5-b7-hooks.mjs`。真实加载当前入口、单独工作源副本/数据/端口，真实上游，不重启用户服务；副本入口源哈希与上文一致。首次和修正断言后的输出均保留：live-routes-first.log、live-routes.log。

| 路由 | HTTP | 实际响应 | Server-Timing | B6计时/缓存 |
| --- | --- | --- | --- | --- |
| /api/banners | 200 | banners数组4项，无error | app;dur存在 | X-Response-Time保留 |
| /api/sections | 200 | sections数组4项，无error | app;dur存在 | X-Response-Time保留 |
| /api/rank/types | 200 | types数组4项，无error | app;dur存在 | X-Response-Time保留 |
| /api/recommend | 200 | items数组24项，无error，有效session | app;dur存在 | 重复请求X-Cache=HIT，结果完全一致 |

推荐触发的真实两项详情/首集画质元数据预取均done：maxActive=2、started=succeeded=2、failed=cancelled=active=0。最终时间加权平均并发0.53955，分母包含启动后首页/推荐等待等空闲时间，不把它误写为“活跃期间并发2”或要求均值必须大于1。

原始结构证据：`.agents/outbox/prefetch-stats-final.json`；完整stdout：`outputs/testing/b5-b7-final/live-routes.log`；该日志中的sourceDir包含本次自身服务日志。未把元数据成功冒称所有清晰度视频音画验收。

## B5/B7原验收指标与边界

B5原30剧、240次HTTP/JSON成功的CSV/JSON与heatmap/line chart保持引用在b5-perf-baseline.md；没有用本次4路由验证补造原数据的serverMs或qualityCount。旧对照未证实15%网络提速，结论不变；两个指定Git提交实际无Q2业务差异的事实也不变。本轮完成追踪正式接线和此前缺失的路由验证。

B7本轮复跑固定1000候选、50对预热+300对正式样本，350对输出ID精确一致：P95 **8.6809ms → 1.0343ms**（下降88.09%），满足≤3ms；P50 5.4401ms→0.5830ms，P99 10.7070ms→1.2999ms。日志/本轮原始JSON在outputs/testing/b5-b7-final/append-benchmark.log与append-benchmark.json。原默认outputs/testing/b7/append-benchmark.json现为本轮结果，旧2.6181ms摘要仍保留在原benchmark.log及B7历史报告，不将不同轮次混作同一批数据。

本次只改Node入口，未改共享引擎/推荐算法、Kotlin/JNI或前端，未运行Android构建、占用设备或声称本次QuickJS/API22实机重验通过。用户当前已运行服务需DSH安排更新/重启后才加载新入口；没有自动部署、重打包或替换release产物。

窗口已完成，交DSH验收与后续发布安排。
