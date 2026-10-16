# v1.0.2 确定代码版本基线（DSH 执行，发布步骤 1）

- **执行**：dsh（发布步骤 1「锁定确定代码版本」）
- **时间**：2026-10-16 23:30–23:40（GMT+8）
- **分支**：`codex/first-github-push-20261013`
- **目的**：为发布步骤 2「重建全部产物」提供**唯一确定的代码版本**，消除 P1（产物早于接线）与 D5（工作区脏、构建不可追溯）两项阻塞。

---

## 一、基线提交

| 项 | 值 |
| --- | --- |
| **业务代码冻结提交** | **`a623f8a8165ba8915ff9558e354820f9efbf8fdd`**（`release(v1.0.2): 锁定确定代码版本`） |
| 协同记录入库提交 | `090cca5c8005a32b933131fe98362edffbae9af9` |
| 前置提交 | `40e6011`（v1.0.2 版本决策 + 过期产物清理） |
| 业务文件数 | **53 个**（纯业务代码，不含 `.agents/`） |
| 构建时工作树 | **完全干净**（`git status --short` 为 0 行） |

**重建产物时必须以 `a623f8a` 为准**（或其后仅含 `.agents/` 协同记录的提交 `090cca5`——二者业务代码完全相同，`090cca5` 的差异仅在 `.agents/` 内）。

---

## 二、关键不变量（DSH 实测，重建后须复核）

| 项 | SHA256 |
| --- | --- |
| `custom-server/index.mjs`（入口，DSH 已验收的接线版） | `b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333` |
| `shared/content-core/hongguo.js` | `cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2` |
| `custom-server/vendor/hongguo.cjs` | 同上（逐字节相同） |
| `server/vendor/hongguo.cjs` | 同上（逐字节相同） |

**入口含**：`const reqStart`（保留 B6 计时链）+ `import { traceRequest }`（`HG_TIMING=1` opt-in）+ `createPrefetchMetrics()` + 显式 `concurrency: 2`。

---

## 三、冻结前门禁（全绿，DSH 实测）

| 门禁 | 结果 |
| --- | --- |
| `npm test` | **214/214 通过、0 失败、0 跳过**（frozen commit 上复跑仍 214/214） |
| `npm run typecheck` | **退出 0** |
| `npm run smoke` | **通过**：3/3 清晰度（默认 1080P）+ 3/3 取流（HTTP 206 / 65536B / ftyp），健康检查 `{ok:3,empty:0,error:0}` |
| `node --check` | `custom-server/index.mjs`、`scripts/build-bundles.mjs`、`scripts/collect-release.mjs` 全部通过 |
| 共享引擎三副本 | 逐字节相同 |
| 工作树干净 | 是 |

---

## 四、提交前的安全核查（避免凭据/用户数据入库）

| 检查 | 结果 |
| --- | --- |
| 私钥/密钥模式扫描（`PRIVATE KEY`、`shared-key`、`Bearer`、`password=`、`token=`、`api_key`、`keystore`） | **0 命中** |
| `custom-server/data/**`（含 `library.sqlite`、`history.sqlite`、`service-address.json`） | **已忽略**（`.gitignore:56`） |
| `apps/sync-server/data/**`（含 `shared-key.txt`、`library.sqlite`） | **已忽略**（`.gitignore:57`） |
| `apps/tv-android/keystore.properties` | **已忽略**（`.gitignore:30`） |
| `outputs/**`（含 `outputs/smoke-playback.json`、`outputs/testing/b5/**`） | **已忽略**（`.gitignore:53`） |
| `dist-win/**`、`release/**` | **已忽略**（`.gitignore:17,54`） |
| `apps/web-pc/dist`（前端构建产物） | **已忽略**（`.gitignore:15`） |
| 提交体量 | 53 个业务文件，合计 **1.22 MB**，无单文件 > 1MB |

**结论**：冻结提交**不含任何密钥、Cookie、用户数据库或本地凭据**。

---

## 五、提交内容分类（53 文件）

| 领域 | 文件 |
| --- | --- |
| **后端 / 引擎（codex）** | `custom-server/index.mjs`、`custom-server/request-timing.mjs`、`custom-server/prefetch-metrics.mjs`、`custom-server/vendor/hongguo.cjs`、`server/provider.mjs`、`server/vendor/hongguo.cjs`、`shared/content-core/hongguo.js`、`shared/recommendation-core.cjs` |
| **Web / 桌面（antigravity）** | `apps/web-pc/src/{App.tsx,api.ts,video-state.ts}`、`components/{PlayerModal,RecommendStream}.tsx`、`hooks/{usePlayback,useStreamFeed}.ts`、`vite.config.ts`、`electron/main.cjs` |
| **TV（qoder）** | `MainActivity.kt`、`ArtworkLoader.kt`、`SeriesAdapter.kt`、`androidTest/{ArtworkRenderingTest,CatalogRenderingTest}.kt` |
| **测试 / 工具（opencode 领域）** | `tests/*`（15 个 mjs：backend-instrumentation、perf-measurement、prefetch-*、quality-*、query-acceleration、recommendation-performance、request-timing、vendor-fallback、video-reuse、playback-p0、build-optimize、polling-optimization）、`scripts/perf/*`（14 个）、`scripts/verify-release-packages.py`、`scripts/smoke-playback.mjs` |

**说明（越界记录，已在裁决书记录）**：codex 本轮为接线适配写入了 `tests/playback-p0.test.mjs`（+23/−1），`tests/` 属 opencode 领域。DSH 裁决为**记录不追责**（改动必要、未改断言语义）。本次冻结**一并入库**，不单独回退。

---

## 六、遗留与影响（重建产物须注意）

1. **⚠️ `outputs/runtime-cache` 已在清理中删除** → 步骤 2 重建时 `build-bundles.mjs:10` 会**重新创建该目录并重新下载 Node 运行时**，**重建需要网络**。
2. **⚠️ `release/` 已不存在** → 步骤 2 为**从零生成**；`release/README.md` 须从备份 `.agents/archive/release-README-before-v1.0.2-20261016.md` **恢复并更新版本号为 v1.0.2**（该文件不会被脚本重新生成）。
3. **⚠️ `dist-win` 残留 1 个被锁文件**（107 KB，`WorkBuddyAI.exe` 持有）——**不影响重建**（发布产物不依赖该 staging）。
4. **⚠️ 未提交的 `.agents/` 协同记录已一并入库**（48 项），使工作树干净，构建可追溯。

---

## 七、下一步（等待明确指令）

按发布计划第五节：

| 步骤 | 状态 |
| --- | --- |
| 1. 锁定确定代码版本 | ✅ **已完成**（本文件） |
| 2. 在确定版本上重建全部产物 | ⏸ **待 DSH 开启**（须 `a623f8a`，需网络） |
| 3. 校验新产物内含接线版入口 | ⏸ 待步骤 2 |
| 4. 统一版本号 v1.0.2 | ⏸ 待步骤 2（含恢复 release/README） |
| 5. 桌面运行时验证 | ⏸ **已按用户指示并入「打包测试」任务一起下派** |
| 6. DSH 最终验收 | ⏸ |
| 7. 发布执行（tag/推送/上传） | ⏸ **需用户明确「执行发布」** |

**DSH 未执行**：未重建产物、未改版本号显式字段、未恢复 release/、未打 tag、未推送、未上传。

---

*本文件为发布步骤 1 的执行与冻结记录；所有"实测"来自 2026-10-16 本会话真实命令。*
