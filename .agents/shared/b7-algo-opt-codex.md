> 2026-10-16 后续更新：正式接线及原漏检修复已完成，本轮1000候选P95=1.0343ms，见 [正式交付](b5-b7-final-integration-codex.md)。下文保留前期过程/历史指标；不再以其中待协调段落代表最新状态。

# B7 推荐算法与预取优化

执行：codex，2026-10-16；当前执行报告，服务接线项待 DSH 指定 index 单写者后补充，不冒充整体完成。

## 实施边界

领取前已读职责与共同 brief、核查 ready/assignee/现有差异。仅本任务修改 shared/recommendation-core.cjs；新增 tests/recommendation-performance.test.mjs、custom-server/prefetch-metrics.mjs、tests/prefetch-metrics.test.mjs、scripts/perf/bench-append.benchmark.mjs、scripts/perf/bench-prefetch.mjs。没有改 B6 正在持有的 custom-server/index.mjs、server/provider.mjs 或共享内容引擎。

append 原来在排序比较器里反复解析标签、计算分数，并为每个输出槽多次全池 filter/some。现在每个唯一有效候选仅评分一次，按原分数与 ID 稳定排序；按类型预建有序 all/explore/marked 队列、用游标跳过已选；最终种子排序 hash 每个结果只算一次。保留原比例、20%探索、marked 优先、排重、完播排除、近期降权、模式、种子次序和分页。仍验证输入，不信任调用方所谓“已去重”标志。没有全局跨会话评分缓存，也没有凭任务中的名称去引入代码实际不存在的 seededRandom。

## 算法实测

命令：`node scripts/perf/bench-append.benchmark.mjs`。固定1000候选、每页24，50对预热+300对正式样本，前后交替顺序，各对使用相同seed/profile/now；350对输出ID精确一致。旧来源为 c2561f5 的原算法，新为工作区当前内容。两者同V8 realm编译，与生产Node CJS使用方式一致。

| 指标 | before | after |
| --- | ---: | ---: |
| P50 | 9.3736ms | 0.9297ms |
| P95 | 13.4404ms | 2.6181ms |
| P99 | 17.7650ms | 4.0579ms |

该次固定Node负载P95下降80.52%，达到≤3ms。样本、哈希、环境完整存于 outputs/testing/b7/append-benchmark.json；不是端到端API提速或所有机器/QuickJS的3ms保证。

首轮基准使用隔离VM而候选在宿主realm，测入跨realm访问开销，after P95=9.0851ms未达目标；原始日志/JSON保留为 benchmark-cross-realm-first.log / append-cross-realm-first.json。修正基准的加载方式后才得到上述Node结果，不隐藏首轮失败，也不拿同realm数据证明TV时延。

## 预取

新增可独立接线的元数据工作监测器，计数成功/失败/取消、当前/峰值活跃数及按活跃时间积分的平均并发。原队列已经支持传入concurrency=2并限制最大2；保持其默认1不动，避免改写B6文件。新增测试证明显式2时峰值不超过2、前台工作期间不启动新预取、完成后继续、取消后归零、关闭/禁用安全。

受控调度实验：`node scripts/perf/bench-prefetch.mjs`，8项各25ms模拟元数据作业。并发1总耗时214.516ms/平均0.970/峰值1；并发2总耗时110.163ms/平均1.973/峰值2。结果在 .agents/outbox/prefetch-stats.json，明确标为 synthetic-metadata-queue，不当成真实上游生产统计。没有视频预缓存或新增服务。

bytevc2 过滤路径保持原样：现有 Web/TV 消费者及 Q1/Q2 回归继续验证私有编码过滤；不为“前置”再改共享引擎、改变已有公共函数原始元数据契约。

## 测试与审查

- TDD：旧实现评分次数14248，期望1000失败；精确语义oracle通过。优化后两项全绿，第二项覆盖60组seed/mode/profile/limit（0/1/24/50/2000）×3页，含重复、非法、类型缺失及完播/近期信息。
- 推荐相关10项通过；预取指标3项通过。初次指标测试因模块尚不存在失败日志保留，随后实现后通过。
- 覆盖率：recommendation-core 行100%、分支93.44%；prefetch-metrics 行100%、分支83.33%。命令与输出见 outputs/testing/b7/coverage.log。
- 独立只读复核者运行推荐性能/预取指标/原预取9项，全绿，无代码阻断；确认尚未接线不等于任务整体完成。
- 首轮全量 `npm test` 205/205，通过；新增验证与并行成员改动后最终再跑210/210，通过，0失败/跳过，见 full-tests-final.log。
- JDK17 Android unit/build/main+test APK 构建成功；D2（15037 / 127.0.0.1:16416 / API35）安装后实际 QuickJS 执行 recommendationsMixTypesAndKeepSessionPagesStable：OK (1 test)，验证三种内容混排、同页稳定、下一页不重复、新会话改变。未修改Kotlin、未操作实机或他人设备，未声称API22性能通过。

## 尚待协调的接线

B5/B6/B7 brief 同时分配 custom-server/index.mjs，与“一文件唯一写者”冲突。已于 .agents/shared/b5-b7-file-coordination-codex.md 发出具体协调与精确接线说明，请DSH指定串行写入窗口，或请B6唯一写者导入监测器、包装原loader、显式concurrency:2。现有运行服务仍默认1，不声称已启用2或真实服务已输出指标。

已生成可审阅的 .agents/shared/b5-b7-index-hooks.patch（仅补丁文件，未应用），以当前B6入口为基础，替换重复日志为可选trace，保留原loader内容、加入监测器与显式并发2。`node --check outputs/testing/b7/staged-index.mjs` 成功；`node scripts/perf/verify-b5-b7-hooks.mjs` 在自行复制的独立临时源目录实际启动该补丁版，健康响应Server-Timing=app;dur=0.197，真实两部剧的详情+首集画质预取全部done，peak=2、started=succeeded=2、failed=cancelled=active=0、时间加权平均1.587。证据 .agents/outbox/prefetch-stats-proposed-hooks.json、outputs/testing/b7/hooks-validation.log。该验证有明确scope字段，仅证明提案的隔离副本，绝不表示工作区index/用户服务已应用。首次验证把POST预期误写200（实际契约202），保留失败日志，改测试断言后通过，无业务契约变更。

未提交/推送/发布/重启正常服务。可回退本任务的 shared 文件单独补丁（不要对整个脏工作区stash/reset；会影响其他成员），新文件为独立实现/测试。最终接线和全量回归完成后才能把B7整体标done。
