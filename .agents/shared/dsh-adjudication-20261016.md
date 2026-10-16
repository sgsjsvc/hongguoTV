# DSH 裁决书（2026-10-16，六领域协同）

- **裁决人**：dsh（统筹协调、接口与唯一写者协调、整合、最终验收与发布安排）
- **裁决时间**：2026-10-16 22:00–23:00（GMT+8）
- **依据**：`.agents/RESPONSIBILITIES.md`（六领域分工，现行唯一依据）、`.agents/START_HERE.md` 第 5/6 条、`mumu-device-allocation.md`、`t-b5-to-b9-optimization.brief.md`
- **性质**：本文件是**裁决与授权边界**，不是业务交付。本轮 DSH 只做：只读核查、隔离副本实证、协作文档路由同步、`git add` 暂存（**未提交、未推送**）、设备/阈值/门禁口径裁定。
- **未做**：未改任何业务代码、未应用接线、未改他人任务状态或锁、未抢占 opencode 正在占用的设备、未构建、未安装、未发布。

---

## 裁决 1：`custom-server/index.mjs` 唯一写者 + B5/B7 接线版本

### 事实（实证）

1. **该文件无唯一写者**：`t-b5-to-b9-optimization.brief.md` 第 13/14/15 行把 `custom-server/index.mjs` **同时**分给 B5(codex)、B6(antigravity)、B7(codex)。B6 已于 `2026-10-16T12:40:56Z` 置 done，并在该文件留下 `reqStart`（`:517`）与 `[timing]` finish 日志（`:520-524`）。
2. **两版接线入口都缺 `reqStart` 定义**（`Select-String` 实测）：
   - 当前 `custom-server/index.mjs`：`const reqStart =` **1 处**，`reqStart` 引用 27 处（基线，可用）。
   - `outputs/testing/b7/staged-index.mjs`：**0 处定义**，24 处引用。
   - `.agents/shared/b5-b7-index-hooks.patch` 应用后：同样 **0 处定义**。
3. **实证结果**（`outputs/testing/dsh-adjudication/probe.mjs`，隔离副本真实起服 + 真实 HTTP 探针，`probe-result.json`）：

| 入口版本 | `/health` | `/api/banners` | `/api/sections` | `/api/rank/types` | `/api/recommend` | `/api/definitely-missing` |
| --- | --- | --- | --- | --- | --- | --- |
| 当前 `custom-server/index.mjs` | 200 | 200 | 200 | 200 | 400 | 404 |
| `staged-index.mjs`（接线版） | 200 | **500** | **500** | **500** | **500** | 404 |

服务端日志实测 4 条 `[API Gateway Error]: reqStart is not defined`。

4. **为何 Codex 的"验证成功"漏检**（机制已定位，非指责）：
   - `scripts/perf/verify-b5-b7-hooks.mjs` 只断言两处：`/health`（`:25`）与 `/api/prefetch*`（`:28-36`）。
   - `/health` 的 `json()` 调用**本身没有传 `reqStart`**，因此天然不触发该错误 —— 所谓 health `Server-Timing: app;dur=0.197` 只能证明 `traceRequest` 模块生效，**不能证明路由可用**。
   - 断言从未打 `/api/banners`、`/api/sections`、`/api/rank/types`、`/api/recommend` 中任何一条。
   - 故 `peak=2`、`averageConcurrency=1.587` 这些并发数字**仍然有效**（预取路径确实工作），但**"接线整体可用"的结论不成立**。

### 裁决

1. **唯一写者裁定**：`custom-server/index.mjs` 的**唯一写者指定为 `codex`**（现行职责含后端路由）。B6 已 done，不再持有该文件；antigravity 不再写入该文件，如后续 B6 类改动需要，须由 DSH 另开任务并重新指定写者。
2. **写入窗口**：授权 codex 在 **opencode 释放设备之后**（设备与构建互斥，见裁决 5）取得串行写入窗口；窗口期内**该文件只允许 codex 一个写者**。
3. **接线版本裁定**：**`b5-b7-index-hooks.patch` 与 `staged-index.mjs` 均不得直接应用**。codex 须在**当前 `custom-server/index.mjs`**（含 B6 的 `reqStart` + `[timing]` 与 `hot:recommend` 缓存）之上**重做**接线，二选一：
   - **(A) 保留 `reqStart`**：`const reqStart = Date.now();` 保留，`traceRequest` 作为 opt-in 附加（`HG_TIMING=1` 时启用），不删除 `reqStart` 传参链；
   - **(B) 彻底移除 `reqStart` 语义**：删除全部 24 处 `json(..., reqStart)` 传参与 `json()` 内的 `elapsed` 计算，改由 `traceRequest` 独占计时。
   两方案都必须保证：**所有 `reqStart` 引用点与定义点同生共死**。
4. **验证要求（验收前置，硬条件）**：接线后必须补一组**路由级**验证，至少覆盖 `/api/banners`、`/api/sections`、`/api/rank/types`、`/api/recommend`，断言 HTTP 200 且响应体非错误；并显式断言 `HG_TIMING=1` 时存在 `Server-Timing`。**只打 `/health` 的验证不予采信**。
5. **B5/B7 状态**：保持 **claimed（codex）**，不标 done。本轮 DSH 未动其锁与任务状态。
6. **保留要求**：重做时必须保留现有 `hot:recommend` 页面缓存、`X-Cache` 语义、B6 的 `fetchOfficialHome()` 预热与预取前置逻辑；不得借接线改动业务行为。

---

## 裁决 2：旧 team / dispatch 路由同步

### 事实

`node .agents/cli.mjs route` 旧实现实测错误：`…/tv/MainActivity.kt → tv-play → 后端 workbuddy`（应为 qoder）、`apps/web-pc/electron/main.cjs → ops → 后端 workbuddy`（应为 antigravity）、`tests/perf-measurement.test.mjs → 未匹配`（`tests/**/*.test.mjs` 的 glob 翻译把 `tests` 根下的文件漏掉）。`team.mjs`/`dispatch.mjs` 当时**均未被 git 跟踪**。

### 裁决与执行（DSH 已执行，未提交）

1. **重写 `.agents/team.mjs`**：6 个身份（dsh / antigravity / qoder / workbuddy / codex / opencode），fileScope 按 RESPONSIBILITIES 的六领域划定；旧岗位 id 通过 `LEGACY_ROLE_ALIAS` + `resolveRole()` **只用于解析历史任务**，不再作为派单依据。
2. **重写 `.agents/dispatch.mjs`** 与修正 `.agents/cli.mjs` 的 `team`/`route`/`board`/`plan` 输出文案（岗位→身份）。
3. **修复 glob**：新增 `globToRegExp()`，正确处理 `**`（跨目录，可为零层）与 `*`（不跨目录）。
4. **实测复核（全部通过）**：

| 文件 | 裁决后主责身份 |
| --- | --- |
| `apps/tv-android/.../MainActivity.kt` | **qoder** ✅（旧为 workbuddy） |
| `apps/web-pc/electron/main.cjs` | **antigravity** ✅（旧为 workbuddy） |
| `tests/perf-measurement.test.mjs` | **opencode** ✅（旧为未匹配） |
| `apps/sync-server/public/admin.js` | **antigravity** ✅ |
| `apps/sync-server/index.mjs` | **codex** ✅（public 界面与后端路由已分开） |
| `custom-server/index.mjs`、`server/provider.mjs`、`shared/content-core/hongguo.js` | **codex**（与现行一致） |
| `apps/mobile/README.md` | **workbuddy** ✅ |
| `release/manifest.json`、`scripts/**` | **opencode** ✅ |
| `.agents/inbox/*.json`、`.agents/state/*.lock.json` | **dsh** ✅ |

`board` 实测：dsh 0 / antigravity 28 done+1 failed / qoder 0 / workbuddy 14 done / codex 19 done+2 claimed / opencode 1 done；`plan` 仅 codex 的 B5/B7 在途，无文件冲突（旧实现因 tests glob 缺陷会漏报）。
5. **`route` 未覆盖路径留空**（如 `.agents/shared/*.md`）：该目录是**各方共用报告落点**，刻意**不**计入 dsh 独占，保持"未匹配"是正确行为，不作"修复"。
6. **`plan` 的并发口径修正**：旧写"并发上限 3（物理后端数）"已失效；现改述为"6 个身份，其中可自动触发的后端以 `doctor` 为准（qoder/opencode 无适配器，需人工交接）"。

---

## 裁决 3：协作文档与 qoder-ready 入库核验

### 事实

六份 `*-session-ready.md`、`qoder-ready.md`、`START_HERE.md`、`notice-20261016-six-domains-new-sessions.md`、`six-agent-onboarding.md` **均未被 git 跟踪**；`RESPONSIBILITIES.md`「接入与能力验证」要求「由 DSH 核验入库后视为接入」尚未满足。

### 裁决（DSH 已执行暂存，未提交）

1. **已 `git add`**（17 项，全部在 `.agents/` 内，**零业务文件**）：`START_HERE.md`、`RESPONSIBILITIES.md`、`README.md`、`QUICKSTART.md`、`team.mjs`、`dispatch.mjs`、`notice-20261016-six-domains-new-sessions.md`、`six-agent-onboarding.md`、`qoder-ready.md`、`qoder-session-ready.md`、`qoder-onboarding-dsh-record.md`、`dsh-session-ready.md`、`antigravity-session-ready.md`、`codex-session-ready.md`、`opencode-session-ready.md`、`workbuddy-session-ready.md`、`workbuddy-mobile-readiness.md`。
2. **提交归属**：由 DSH 提交（提交信息建议 `docs(agents): 六领域职责、接入报告与路由同步`），**不代其他 Agent 提交其业务改动**。
3. **入库后核验结论**：
   - `qoder`：`qoder-ready.md` + `qoder-session-ready.md` 入库后，**TV 端接入条件满足**（其能力实测在报告内，本轮 DSH 复核到 `minSdk 22`、四 ABI、Gradle 8.11.1 wrapper 与本机工具链一致）。
   - `opencode`：报告在库，能力结论**限于其真实报告与证据**。
   - `antigravity` / `codex` / `workbuddy`：同上，各自报告在库。
4. **入库前不得派发依赖"未核验能力"的实现任务**；本条随提交生效。

---

## 裁决 4：设备登记与构建互斥

### 事实

- 接入时 `mumu list` 4 台全空闲；**裁决期间实测 opencode 于 21:58 声明占用 `mumu-d1/d2/d3`**（用途"最新版全终端兼容测试"，`expiresAt: null`）。
- **裁决收尾时复查：opencode 已释放全部 3 台**，`mumu list` 4 台复归空闲 → 该身份已履行"用完释放"，登记链路闭环。
- 两套登记并存：旧 `state/device-d1/d2/d3.lock.json`（**已被 git 跟踪**，`status=claimed-ready/claimed-connected`）与新 `state/mumu-*.lock.json`（未跟踪，`type=mumu-lock`）。
- 全仓 grep 确认：`cli.mjs` 的 `mumu list/declare/release/who` 只读写 `state/<设备ID>.lock.json`；**除历史文档外无任何代码读取 `device-d*`**。

### 裁决

1. **不删除、不移动他人在用证据**（边界 10）。旧 `device-d*.lock.json` 是 10-15 的历史登记，**归档由 DSH 执行**（opencode 已释放，无占用期间风险）：
   - **原样归档**副本至 `.agents/archive/device-locks-before-dynamic-20261016/`（3 个文件，字节级保留）；
   - **原位置保留原文件**，仅新增 `supersededBy` 字段（`at`/`by`/`reason`/`effectiveRegistry`/`readBy`/`archivedCopy`/`action`），**不作任何字段删除或改写**；
   - **去向已在原引用文件 `shared/device-allocation.md` 顶部注明**（该文件头部已加失效横幅，指向 `mumu-device-allocation.md` 与本归档路径）。
   - 实测：3 个锁经 `node -e require(...)` 校验为**合法 JSON**、无 BOM、`supersededBy` 齐全；`mumu list` 与 `list claimed` 行为**不受影响**。
2. **唯一有效登记**明确为 `state/mumu-*.lock.json`（`mumu-device-allocation.md` 现行制）；旧 `shared/device-allocation.md` 的静态分配**已失效**，仅作历史参考（该文件已在设备文档中注明被取代）。
3. **占用者纪律（已获实证遵守）**：持有期间——(a) 其他身份不得 `declare` 同设备、不得强制释放；(b) **同一工作副本的 Android Gradle 构建互斥仍然有效**，占用者若同时要构建须自行串行并写占用记录；(c) 用完**必须** `mumu release`。opencode 本轮按 (c) 执行完毕。
4. `mumu-r`（唯一 API 22 真机）**offline**：**禁止声称在 API 22 验证通过**；模拟器（API 32/35）不能替代 API 22 实机验收。
5. **本轮 DSH 未声明任何设备**（未介入 opencode 的测试）。

---

## 裁决 5：B9 阈值与证据链

### 事实

- `outputs/` 实测 **11,953 MB**（含 `bundles/`、`runtime-cache/`、`testing/`），`release/` **1,265 MB**；brief 要求 `outputs/ < 2 GB` 又要求"保留校验链/所有 md 文档"。
- `outputs/` 与 `release/` 均在 `.gitignore:53-54` 内（`git check-ignore` 实测）。
- `.agents/` 下证据 120.93 MB，其中 `shared/` 的 **`.png` 161 个 = 107.71 MB**、`.log` 44 个 = 7.72 MB、`.xml` 168 个 = 3.23 MB；`archive/` 下仅 3 个 `.md`（0.02 MB）。
- **更正（已实测）**：`.agents/` 共 **735 个文件已经在 HEAD 提交内**，其中 `.agents/shared/*.png` **161 个全部已被 git 跟踪并已提交**（`git ls-tree HEAD` 实测）。故"截图会新进仓库"的说法不成立——它们**早已在仓库里**。同时 `.gitignore` 的 `*.log` 规则命中 `.agents/archive/*.log`（实测 IGNORED），`.png`/`.xml` 虽未被忽略但已在库。
- 由此，`.agents/` 的体量是**既有历史事实**，不是本轮新引入的问题。

### 裁决

1. **B9 原阈值 `outputs/ < 2 GB` 作废**。理由是它与"保留在用测量证据"（B5 的 30 剧对照、B7 的基准、Q1/Q2 证据）在数学上不可能同时成立。
2. **改判为可执行的清理口径**：
   - **保留**：`outputs/bundles/`、`outputs/runtime-cache/`、**以及被 `shared/` 报告引用的证据文件**（引用关系以 grep 实测为准）。
   - **可清理**：无任何报告引用的 `version-snapshots/`、`build-archives/`、`outputs/testing/` 下未引用目录。
   - **`release/`**：只清理 6 个 Linux/darwin 包（约 251 MB），保留 Windows EXE/ZIP + 2 个 APK + `manifest.json` + `SHA256SUMS.txt`；**校验链完整性作为硬验收**。
3. **验收标准改为**：(a) `release/` 校验链完整；(b) 被引用证据一个不少；(c) **每个删除项都有去向记录**（`.agents/shared/b9-…` 内逐条列明 删除项→原用途→是否被引用→去向），(d) 报告实测前后 `du` 对比。
4. **授权范围**：B9 若重启，须由 DSH 重新开单并限定为上述口径；**禁止整目录清空 `outputs/`**。原 B9 done 状态保留（其为"无删除的阻塞报告"，本轮不判为失败）。
5. **.agents/ 证据膨胀另立处置**：`shared/` 107 MB 截图 + 7.7 MB 日志属协同记录，**已在库、当前不清理**（仍可能被引用）；但**不得新增无引用的大截图**。若后续需要瘦身，由 DSH 单独开单，且**只归档不删除**（归档须注明去向）。

---

## 裁决 6：次级项

1. **`playback-p0.test.mjs` 时序抖动 → 根因已由 DSH 定位，改判如下。**

   **实证（本轮 5 次完整 `npm test` + 1 次接入期基线 = 6 次全量）**：通过 5 次、失败 1 次：
   - 失败那次：`tests/quality-labels.test.mjs:53`「unchanged Web qualities route retains five distinct tiers for equal-height rows」，**`error: 'fetch failed'`，`TypeError`（`node:internal/deps/undici/undici:13510`）**，耗时 109 ms。
   - 对照实验：单独连跑 `node --test tests/quality-labels.test.mjs tests/playback-p0.test.mjs` **6/6 全通过**（缩小并发后不复现）。

   **结论（更正 opencode 的归因）**：这不是"时序/性能断言抖动"，而是**并发负载下 undici `fetch` 对 loopback 服务偶发失败**——失败点在 `tests/quality-labels.test.mjs:63` 的 `await fetch(http://127.0.0.1:${port}/…)`，属**测试脚手架鲁棒性**问题，与业务逻辑无关。同类 loopback `await fetch(` 站点全仓共 **49 处、分布在 15 个测试文件**（`server`、`sync-admin`、`sync-key`、`library-sync`、`history-routes`、`library-routes`、`prefetch-routes`、`prefetch-wire`、`query-acceleration`、`recommendation-library`、`request-timing`、`perf-measurement`、`playback-p0`、`quality-tiers`、`quality-labels`），**都具备同类偶发失败条件**，不只 `playback-p0`。

   **裁决**：
   - **不作为发布阻断项**，但**必须按"已知不稳定"登记**，不得以 `npm test` 全绿作为唯一发布门禁证据（DSH 自己的 210/210 也不足采信）。
   - **指令给 opencode**：对上述 loopback `await fetch(` 站点统一加**有限重试/连接就绪等待**（或改用 `node:http` 直连以绕开 undici），并出**同环境连跑 ≥10 次**的失败率对比（修复前 vs 修复后）；报告须写明**失败测试名 + 错误码 + 次数**。
   - **诚实标注**：DSH 的 1/6 是**单机观察**，不足以给出精确失败率；判定"偶发、非确定性"成立，判定"具体概率"不成立。

2. **release 产物时效** → 现有 `release/`（`generatedAt=2026-10-16T03:53:08Z`）**早于**当前工作区未提交改动，**判定不可作为当前版本的发布产物**。正式发布前须由 opencode 按**确定代码版本**重建并校验；DSH 在此之前**不安排发布**。

3. **手机端（workbuddy）→ 平台已由用户明确：仅 Android，不含 iOS。** 用户于 2026-10-16 裁决期间直接指令「手机端只做 Android 端」。

   **据此更新**：
   - **平台范围：已决** —— 仅 Android。`workbuddy-mobile-readiness.md` 中列为阻塞的"是否含 iOS"（其第 1 项）**就此关闭**；iOS 在 Windows 宿主不可得，与本决策相符，**不再需要 macOS/Xcode 工具链**。
   - **仍然待决（2 项）**：手机端**技术栈**（Flutter / RN / 原生 / 复用 TV 工程）与**手机专属目录**（现路由占位 `apps/mobile/`，目录尚不存在）。三项中已决 1 项，**不得因平台已决就自动选型或建目录**。
   - **可复用的已实测能力**（来自 `workbuddy-mobile-readiness.md`，均为 Android 向）：JDK 21、Android SDK(platforms 35 / build-tools 34·35 / NDK 28.2)、Gradle 缓存、Flutter 3.44.4 + Dart 3.12.2、adb 1.0.41（端口 15037）、MuMu 模拟器 d1/d2/d3 在线；**未验证**：实际构建、实际安装、手机真机（当前无在线手机真机，模拟器仅 x86_64）。
   - 已在 `RESPONSIBILITIES.md` 中同步：workbuddy 主责范围标注为「手机端（仅 Android）」，并在「接入与能力验证」节写明该决策。
   - **指令**：平台已定，但**技术栈与目录未定前不派发任何手机端实现任务**；确定后由 DSH 开单，含 assignee=workbuddy、文件范围、验收条件与复核者。

4. **B6/B8/B9 的 done ≠ 最终验收** → 三者均需在**接线完成且回归通过后**由 DSH 统一验收；B8 自述 FCP<1.0s 因标签页 `visibilityState=hidden` 未实测，验收时须以真实可见页测量为准。

5. **新增提示（与裁决 1 相关）**：codex 在协调文件中已指出 `tests/{prefetch-routes,prefetch-wire,quality-labels}.test.mjs` 从 `function json(` 起把 index 截进 VM 上下文；若接入 `createPrefetchMetrics`，这些上下文**必须同步补上 `createPrefetchMetrics`**，否则测试失败会被误判为业务失败。本轮实证的偶发失败恰好落在 `quality-labels.test.mjs`，**重做接线时须一并处理**。

---

## 本轮 DSH 实际执行清单（全部未提交）

| 动作 | 对象 | 状态 |
| --- | --- | --- |
| 重写（六领域路由） | `.agents/team.mjs`、`.agents/dispatch.mjs` | 已完成，`route/team/board/plan` 四命令实测通过 |
| 修正输出文案与并发口径 | `.agents/cli.mjs`（`team`/`route`/`board`/`plan` 分支） | 已完成；**未改 `claim/done/fail/mumu` 等行为逻辑** |
| 隔离实证 | `outputs/testing/dsh-adjudication/probe.mjs` + `probe-result.json` | 已完成；临时副本自清理 |
| 暂存协作文档 | 17 项（全在 `.agents/`） | 已 `git add`，**未 commit** |
| 更正接入报告 | `.agents/shared/dsh-session-ready.md` | 已更正 3 处我先前的事实错误（设备状态、staged 版本、"patch 落后"表述） |
| **未做** | 业务代码、接线应用、任务状态、他人锁、构建、安装、发布、推送 | — |

---

## 给 codex 的下一条明确指令（裁决 1 的可执行形态）

> 身份 codex，任务 `t-b5-perf-measurement` / `t-b7-algo-optimize` 保持 claimed。
> 在 opencode 释放 `mumu-d1/d2/d3` 之后取得串行窗口，对**当前** `custom-server/index.mjs` 重做入口接线：
> (1) 使 `reqStart` 定义/引用同生共死（方案 A 或 B，二选一并说明）；(2) 接入 `traceRequest`（`HG_TIMING=1` opt-in）与 `createPrefetchMetrics` + 显式 `concurrency: 2`；(3) 保留 B6 的 `hot:recommend` 缓存、`X-Cache`、预热与预取前置；**(4) 新增路由级验证，覆盖 `/api/banners`、`/api/sections`、`/api/rank/types`、`/api/recommend` 断言 200 与非错误响应体，并断言 `Server-Timing` 存在**；(5) **不得**直接应用 `b5-b7-index-hooks.patch` 或 `staged-index.mjs`；(6) 完成后写报告并在 `done` 前附路由级验证原始输出。

---

## 裁决 1 的后续：codex 已按裁定重做接线，DSH 独立复核通过（2026-10-16 22:37–22:50）

**背景**：本裁决书落盘后，codex 于 22:37 按「给 codex 的下一条明确指令」重做了接线（`custom-server/index.mjs` 改动时间 22:37:15，新增 `tests/backend-instrumentation.test.mjs`）。DSH **未参与其实现**，仅做独立复核。

**codex 的修复方式（读取源码确认）**：
- 保留 `const reqStart = Date.now();`（现 `:520`，**定义存在**），`reqStart` 引用 28 处 / 定义 1 处 —— **方案 A（保留 `reqStart`）**，正是裁定的两个选项之一；
- 接入 `traceRequest`（`:2` 导入，`:522` 在 `HG_TIMING === '1'` 时启用）与 `createPrefetchMetrics`（`:3` 导入，`:504` 建实例，`:505` 包装 loader，`:517` 显式 `concurrency: 2`）；
- 新增 `tests/backend-instrumentation.test.mjs`，**包含裁定要求的 4 条路由断言**，并额外补了一条"变异测试"（`:74-81`）——故意删掉 `reqStart` 定义后断言 4 条路由全部 500 且报错含 `reqStart`，**正好守住本裁决发现的缺陷类型**。

**DSH 独立复核（不依赖 codex 的测试脚手架）**：
- 脚本 `outputs/testing/dsh-adjudication/verify-wiring.mjs`：复制 `shared/`+`server/`+`custom-server/` 到隔离目录，**真实 fork 后端进程**，用真实 HTTP 打 5 条路由，分别测 `HG_TIMING=1` 与 `HG_TIMING=0`，断言 200 + 无 `error` 字段 + 可解析 JSON + `Server-Timing` 的有无。

| 断言 | 实测结果 |
| --- | --- |
| `HG_TIMING=1`：4 条路由 200 且非错误响应 | **pass**（`/api/banners` 200 / 2536 B、`/api/sections` 200 / 8071 B、`/api/rank/types` 200 / 303 B、`/api/recommend` 200 / 10280 B） |
| `HG_TIMING=1`：`Server-Timing` 存在 | **pass**（`app;dur=0.170`、`app;dur=1793.982`、`app;dur=2455.366` 等） |
| `HG_TIMING=0`：`Server-Timing` 不出现 | **pass**（opt-in 语义正确） |
| 服务端日志无 `reqStart`/`ReferenceError` | **pass**（0 条） |
| codex 路由级测试 | `tests/backend-instrumentation.test.mjs` **4/4 通过** |
| 全量回归 | **214/214 通过、0 失败**（较裁决前的 210 项新增 4 项，见 `outputs/testing/dsh-adjudication/npm-test-postfix.log`） |

**复核结论**：**裁定 1 的验收条件已满足**。两版失效入口（patch / `staged-index.mjs`）**未被使用**；现行入口保留 B6 的 `reqStart` 语义与 `hot:recommend` 缓存（codex 测试 `:57` 断言同页重试仍命中 `hot:recommend`、`recommendCalls===1`），并加入了裁定要求的路由级回归。

**仍待 DSH 收口（不擅自标 done）**：
1. `t-b5-perf-measurement` / `t-b7-algo-optimize` **仍为 claimed**，DSH 未改状态。是否置 done，需 codex 先按流程提交报告并声明交付；
2. **接线后需要更新的证据**：`b5-perf-baseline.md` / `b7-algo-opt-codex.md` 中"尚未接线""服务默认并发 1"等表述**现已被实现取代**，须由 codex 更新（DSH 不代写）；
3. `.agents/shared/b5-b7-index-hooks.patch` 与 `outputs/testing/b7/staged-index.mjs` 为**已知失效产物**：应标注为"已废弃、勿使用"，**不删除**（保留审计痕迹）；
4. 本轮接线**未经 DSH 提交**（仍属 codex 未提交工作区改动），与其余 18 个业务文件一样**未纳入本次协作文档提交**。

---

*本裁决书由 DSH 依据本轮实测写成；所有"实测"结论来自 2026-10-16 本会话真实命令，未验证项已明确标注。修订历史保留在本文件内，不覆盖他人报告。*
