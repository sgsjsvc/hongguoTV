# 响应速度与资源清理专项（B5-B9）

**协调方**: DSH
**日期**: 2026-10-16
**原则**: 不增加视频缓存、不引入新服务、不破坏现有业务逻辑、所有改动可回退、必须加回归测试

---

## 一、任务拆分与派发

| 任务 | assignee | 范围 | 核心目标 |
| --- | --- | --- | --- |
| **B5 响应速度测量基建** | codex | `scripts/perf` / `custom-server/index.mjs` | 建立端到端耗时测量框架（客户端 → 服务端） |
| **B6 查询接口加速** | antigravity | `custom-server/index.mjs` / `server/provider.mjs` | 首页/分类/榜单/搜索/推荐接口冷启动 < 300 ms |
| **B7 算法与预取优化** | codex | `shared/recommendation-core.cjs` / `custom-server/index.mjs` | 推荐 `append()` ≤ 3 ms，预取队列并发上限合理 |
| **B8 前端构建产物精简** | opencode | `apps/web-pc/` | 删除未用依赖、缩减 bundle size、移除重复资源 |
| **B9 清理无用历史打包文件** | workbuddy | `outputs/`, `release/` | 清理旧产物、保留校验和清单 |

**并发**: 5 个后端同时跑（含 dsh 作为协调者不参与执行）

---

## 二、各任务详细要求

### B5 响应速度测量基建（codex）

**目标**: 建立端到端耗时测量框架，支持：
- 单次请求耗时（cold/warm）
- 接口 P50/P95/P99 分位
- CPU/内存占用对比

**要求**:

1. **新增测量脚本** (`scripts/perf/measure-end-to-end.mjs`)：
   - 从浏览器发起请求（CDP + fetch）
   - 记录每个阶段时间戳（DNS/TCP/TLS/TTFB/Content）
   - 输出 CSV + JSON（CSV 用于可视化，JSON 用于对比基线）

2. **服务端注入追踪点** (`custom-server/index.mjs:479+`)：
   ```javascript
   const t0 = Date.now();
   // ... route logic
   console.log(`[timing] ${pathname} cost=${Date.now()-t0}ms`);
   ```

3. **基准对比**:
   - Q2 修复前（v617c073，definition 优先未启用）
   - 当前版本（c2561f5，definition 优先已启用）
   - 预期收益 ≥ 15%

4. **必须加测试**: `tests/perf-measurement.test.mjs` 验证脚本自身准确性（±5% 误差以内）

**验收**:
- 脚本实测 30 部剧集 API，生成报告 `.agents/shared/b5-perf-baseline.md`
- 提供前后对比图（heatmap + line chart）

---

### B6 查询接口加速（antigravity）

**目标**: 首页/分类/榜单/搜索/推荐接口冷启动 < 300 ms，热请求 < 50 ms

**措施**:

1. **增强 `routerData` 的 `pageCache` TTL**（`shared/content-core/hongguo.js`）:
   - 当前 180 s → 改为 **300 s**（首页/榜单稳定）
   - 分类页动态 tag 的 cache key 需更精准（tag+page+type）

2. **预取推荐列表的前置数据** (`custom-server/index.mjs:12-14`):
   - `/api/recommend` 返回后，异步触发同页下一部的详情预取（利用空闲连接）
   - **不改变推荐结果**，仅减少后续切换时的等待

3. **搜索引擎批量化** (`custom-server/index.mjs:400+`):
   - 搜索关键字时并行请求上游 2 个 fallback source（超时 2 s 取快的那个）
   - 合并响应去重

4. **Redis-style 本地 LRU Cache** (`custom-server/index.mjs:350+`):
   - 热点接口（首页/榜单 Top10）在 Node 内存层再挂一层 50 MB LRU
   - TTL 300 s，LRU  eviction 策略

**注意**: 不得添加 Redis/Memcached 等外部服务，纯 Node 实现

**验收**:
- 30 次连续调用 `npm test`（复现压测），统计冷/热启动分布
- 报告 `.agents/shared/b6-query-acceleration-antigravity.md`，附 curl/wrk 压测日志

---

### B7 算法与预取优化（codex）

**目标**:
- `RecommendationSession.append(candidates, limit)` ≤ 3 ms（当前 ~2.5–6 ms）
- 预取队列并发上限合理（当前 1，建议 2–3）
- 无无效计算

**措施**:

1. **`recommendation-core.cjs` 的 `append` 优化**:
   - 移除排序后的 `score` 遍历（改为一次遍历同时计算 score+rank）
   - `uniqueSet` 复用（传入的 `candidates` 若已有去重标记则跳过）
   - `seededRandom` 缓存种子（避免每次重新分配）

2. **预取队列并发上限**:
   - `custom-server/index.mjs:439`: `createPrefetchQueue(..., { concurrency: 2 })`
   - 监控 `outbox/prefetch-stats.json` 记录平均并发数

3. **无效候选过滤前置**:
   - 上游返回的 `video_list` 有 `bytevc2` 档，引擎层直接丢弃（已在但确认是否覆盖全场景）

**验收**:
- 1000 条候选数据集，运行 `bench-append.benchmark.mjs`，P95 ≤ 3 ms
- 报告 `.agents/shared/b7-algo-opt-codex.md`

---

### B8 前端构建产物精简（opencode）

**目标**: 减小 web 打包体积、提升首屏加载速度、移除冗余依赖

**措施**:

1. **Tree-shaking 强制开启** (`apps/web-pc/vite.config.ts`):
   ```typescript
   build: {
     rollupOptions: {
       output: { manualChunks: { vendor: ['react', 'react-dom'] } },
       treeshake: 'smallest'
     }
   }
   ```

2. **移除未用第三方库**:
   - `pnpm why --depth=0` 扫描未引用依赖
   - 移除 `eslint-plugin-prettier`（开发期才用）、`prettier-quick`、`husky` 等 CI 工具

3. **压缩静态资源**:
   - PNG/WebP/SVG 统一转换 WebP（vite-plugin-webp-converter）
   - 字体 subset 处理（只保留中文字符集）

4. **Bundle Analyzer**:
   - 运行 `vite-bundle-analyzer` 识别 > 100 KB 的 chunk
   - 动态导入大型组件（播放器全屏弹窗、历史记录侧边栏）

**验收**:
- `dist/assets/` 总量从当前的 357 KB → < 280 KB（gzip）
- 首屏 FCP 从当前 1.4 s → < 1.0 s（Chrome Lighthouse）
- 报告 `.agents/shared/b8-build-optimize-opencode.md`

---

### B9 清理无用历史打包文件（workbuddy）

**目标**: 释放磁盘空间、简化发布流程、保留必要校验证据

**措施**:

1. **定义保留策略**:
   - 保留最近 3 个月的 release 包（手动判断或基于 `manifest.json` 的时间戳）
   - 保留所有 `.md` 文档（README、部署指南等）
   - 保留 `SHA256SUMS.txt`（最新 10 份）
   - 保留 `manifest.json`（最新 10 份）

2. **清理目录**:
   - `outputs/` 下除 `bundles/`、`runtime-cache/` 外全部清空
   - `release/` 下非 Windows EXE/ZIP 全部清掉（Android APK 仅保留最新版 2 个 ABI）

3. **清理构建缓存**:
   - `node_modules/.cache/`
   - `.gradle/caches/`（保留 latest 版本）

4. **生成清理报告**:
   - `.agents/shared/b9-clean-report-workbuddy.md` 包含：
     - 清理前的总大小
     - 清理掉的项列表
     - 节省空间量

**验收**:
- 清理后 `outputs/` < 2 GB（当前 ~5 GB）
- `release/` 仍保留完整校验链（可回滚到任意一份）

---

## 三、共同约束

1. **禁止添加外部依赖**（Redis、Elasticsearch、Nginx 等）
2. **必须加单元测试**（新代码覆盖率 ≥ 80%）
3. **保持向后兼容**（不破坏现有接口签名）
4. **所有改动可回退**（提交时需附 `git stash` 能还原的命令）
5. **性能改进必须有定量指标**（Before/After 对照表）

---

## 四、交付物汇总

| 任务 | 报告路径 | 验证方式 |
| --- | --- | --- |
| B5 | `.agents/shared/b5-perf-baseline.md` | 运行 `measure-end-to-end.mjs` |
| B6 | `.agents/shared/b6-query-acceleration-antigravity.md` | wrk 压测日志 |
| B7 | `.agents/shared/b7-algo-opt-codex.md` | bench-append.benchmark.mjs |
| B8 | `.agents/shared/b8-build-optimize-opencode.md` | Lighthouse 报告 |
| B9 | `.agents/shared/b9-clean-report-workbuddy.md` | du -sh 对比 |

---

## 五、开始执行

**请各 agent 认领任务前确认**:

1. 重读本 brief + 《RESPONSIBILITIES.md》第 9 条（领取前必读）
2. 确认该任务在自己的默认修改范围内
3. 与已认领任务无文件冲突
4. claim 动作 → `node .agents/cli.mjs claim <id> <身份>`

**DSH 承诺**: 每轮结束后汇总进度，如有阻塞及时介入。

---

## 六、验收标准（全体通用）

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 性能指标达到目标值 | 报告中的数据对比 |
| 2 | 全量测试通过 | `npm test` 189 项全绿 |
| 3 | 代码审查无 blocker | 至少 1 人 review |
| 4 | 回归测试无异常 | 压力测试/随机抽样 |
| 5 | 报告完整且可复现 | 其他人可复跑相同实验 |
