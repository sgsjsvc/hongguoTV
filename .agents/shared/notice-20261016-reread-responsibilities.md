# 领取任务前必读：职责变更通知（2026-10-16）

**下发方**: DSH（协调者）
**适用对象**: dsh、codex、antigravity、workbuddy、qoder、opencode
**状态**: 已生效
**权威文件**: `.agents/RESPONSIBILITIES.md`（本通知是其摘要与落地状态，冲突以该文件为准）

---

## 一、四条硬性规则（用户下达）

### 1. 领取前必须重读 `RESPONSIBILITIES.md`

**DSH、codex、antigravity、workbuddy 在下一次领取任务前，必须重读该文件。**

前置步骤：

```
读 RESPONSIBILITIES.md → 读对应 brief → 确认 assignee 与 ready → claim
```

**跳过第一步视为未按规范领取。**

### 2. WorkBuddy 默认转为「独立复核 + 文档」

只做：独立复核他人成果（验收标准、证据链、回归风险）、复核报告、交接与知识整理文档。

**不默认承担功能实现，不复核自己编写的功能。**

### 3. 原已认领任务先完成或先交接，不自动转给新成员

**除 DSH 明确交接并释放原锁外，不得因分工变更自动改派**，尤其不转给 qoder / opencode。

### 4. Qoder / OpenCode 未写真实 ready 报告前，不假定在线或能力可用

- 不假定其在线
- 不假定其能力可用
- 不向其派发任务
- 其他人不代称已接入

---

## 二、当前六方状态（DSH 独立核实）

| 身份 | ready 报告 | 未完任务 | 判定 |
| --- | --- | --- | --- |
| **dsh** | `dsh-ready.md` ✓ | — | 协调者，**不计入自动执行并发** |
| **codex** | `codex-ready.md` ✓ | **1 个**：`t-q2-quality-labels`（pending） | ✅ 可领取 |
| **antigravity** | `antigravity-ready.md` ✓ | 无 | ✅ 可领取 |
| **workbuddy** | `workbuddy-ready.md` ✓ | **无**（13 个已全部 done） | ⚠️ **仅承接复核 + 文档** |
| **opencode** | `opencode-ready.md` ✓ **真实报告** | 无 | ✅ 已接入，**待命**（名下 0 任务） |
| **qoder** | **`qoder-ready.md` 当前不存在** | 无 | 🔴 **按规则 4：不假定在线、不派任务** |

---

## 三、OpenCode 报告的独立抽查（5 条全部属实）

`opencode-ready.md`（157 行，UTF-8 健康，附 `opencode-ready-testrun.txt` 运行日志）。

| # | 声明 | DSH 核实 |
| --- | --- | --- |
| 1 | HEAD 为 `617c073` | ✅ 一致 |
| 2 | `status`：total=60；done = antigravity 27 / workbuddy 13 / codex 18；failed 1；pending = codex 1 | ✅ 完全一致 |
| 3 | `npm test` → 178 tests / 178 pass / 0 fail，1444 ms | ✅ **DSH 独立复跑确认 178/178** |
| 4 | 无任何 `assignee=opencode` 的任务 | ✅ 属实 |
| 5 | 工作区不干净属他人在途工作，未触碰、未回退、未清理 | ✅ 属实 |

**其自述边界值得肯定**：「构建通过不等于实机播放通过」、
「历史产物早于当前未提交改动，发布前必须对确定版本重建校验」、
不自行修改原生业务 / 共享引擎 / 前端 React / 后端。

**判定：满足「真实 ready 报告」要求，可视为已接入。当前无任务，待命。**

---

## 四、Qoder 报告的状态变化（需重新确认）

### 时间线（DSH 实测记录）

| 时刻 | 状态 |
| --- | --- |
| 早前 | `qoder-ready.md` 存在（99 行，真实报告），**DSH 抽查 5 条声明全部属实**：JDK17 存在、Android SDK + NDK `28.2.13676358`（G 盘）存在、`keystore.properties` 已被 gitignore、shell 内 Node 为 v22.20.0、`claimTask` 无 assignee 白名单 |
| 现在 | **该文件已从 `.agents/shared/` 消失** |

**该文件从未进入 git 历史**（`git log --all` 无记录），
**也未被 `.gitignore` 忽略** —— 所以是**被删除**，不是「未提交所以看不到」。

### 按规则 4 的处理

**报告文件当前不存在 → 无法证明其内容仍然有效 → 暂不向 qoder 派发任务。**

**恢复方式**：由 **Qoder 自身**重新写出 `qoder-ready.md`（需实际验证，他人不代写）。
此前那份的内容质量已记录在上方，可作为参考基线。

### Qoder 原报告提出、仍待 DSH 回答的问题

1. 4 个原生文件（`MainActivity.kt`、`SeriesAdapter.kt`、`ArtworkLoader.kt`、`electron/main.cjs`）的当前唯一写者是谁？何时交接？
2. 是否给 qoder 分配设备，或明确某个模拟器的借用窗口与归还记录？
   （现状：D1→antigravity、D2→codex、D3→workbuddy、REAL→dsh，三个设备锁仍在）
3. 六方路由同步完成后，`dispatch.mjs` 是否加入 qoder 适配器？

---

## 五、⚠️ 本轮观察到的文件消失事件（如实记录）

DSH 在本轮共观察到 **3 个 `.agents/shared/` 下的文件消失**：

| 文件 | 状态 |
| --- | --- |
| `qoder-ready.md` | 曾存在（DSH 读过并核实）→ 消失 |
| `role-change-20261016-workbuddy.md` | `RESPONSIBILITIES.md` 第 55 行曾引用 → 消失 |
| `notice-20261016-reread-responsibilities.md` | DSH 本轮首次写入 → 消失（本文件为重建） |

**已排除 git 操作**：

- `git stash list` → 空（不是 `stash -u` 带走）
- `git reflog` → 只有 DSH 自己的 commit，无 reset/rebase
- 同期其他未跟踪文件（`tests/prefetch-wire.test.mjs`、`tests/quality-tiers.test.mjs`、
  `tests/vendor-fallback.test.mjs`、`apps/web-pc/src/video-state.ts`、
  `scripts/verify-release-packages.py`、`.agents/inbox/t-q2-quality-labels.brief.md`）
  **全部健在** → 不是全局清理
- `opencode-ready.md` 在 DSH 插入指针后**仍然存在** → 不是 shared 目录整体被清

**结论**：消失范围仅限上述 3 个通知/报告类文件，**非 DSH 所为**，
**原因未查明**，可能是某方在整理自身产出。

**因此本通知要求**：

1. **各方不要删除他人写入 `.agents/shared/` 的报告与通知文件**；
   若需归档，移到 `.agents/archive/` 并在原位置留一行说明。
2. **权威依据是 `.agents/RESPONSIBILITIES.md`**（该文件健在且完整含四条规则）。
   本通知为摘要，重建一次；若再次消失，以权威文件为准，不反复重建消耗协作带宽。
3. **ready 报告是身份的凭据**，被删即视为「未接入」（见第四节处理方式）。
   请各方将自己的 ready 报告纳入提交，避免被清理丢失。

---

## 六、DSH 未提交的调度改动（保留但不作权威）

工作区存在 DSH 未提交的调度实验：`.agents/team.mjs`（18 岗位）、
`.agents/dispatch.mjs`（按文件归属路由 + 冲突检测）、
`.agents/cli.mjs` 新增 `team` / `route` / `board` / `plan` 命令。

**按 `RESPONSIBILITIES.md` 的约束**：

- **本轮保留**，不回滚、不清理
- **不作为六方路由的权威依据**
- 其中的「18 岗位 / 3 后端 / 并发上限 3」**不能代表六方已连接、可用，或已具备 6 并发**
- 待六方映射同步后由 DSH 再行调整

**当前派发仍以 `RESPONSIBILITIES.md` 的六方职责表为准，
assignee 使用物理身份**（`codex` / `antigravity` / `qoder` / `opencode` / `workbuddy`）。

---

## 七、领取任务的标准操作

```bash
# 1. 读权威文件（硬性前置）
#    .agents/RESPONSIBILITIES.md

# 2. 读 brief
node .agents/cli.mjs show <任务ID>

# 3. 自查三项匹配
#    - assignee 与自己完全匹配？
#    - 目标文件在自己的默认修改范围内？
#    - 与自己已认领任务无文件冲突？

# 4. 认领
node .agents/cli.mjs claim <任务ID> <身份>

# 5. 完成后提交
node .agents/cli.mjs done <任务ID> <身份> "结论及报告路径"
```

**`done` 代表执行方提交，不等于最终验收通过**
（`RESPONSIBILITIES.md` 边界规则第 7 条）。

---

## 八、当前可派发的任务

| 任务 | assignee | 状态 | 说明 |
| --- | --- | --- | --- |
| `t-q2-quality-labels` | **codex** | pending | 修复清晰度档位推导（用 `definition` 而非 `vheight`），实测 8% 剧集受影响，含碰撞丢档 |

**opencode / qoder / workbuddy / antigravity 名下当前均无可领取任务。**

**新增任务需由 DSH 按 `RESPONSIBILITIES.md` 的职责表派发，
且派给 qoder / opencode 前须先确认其 ready 报告存在且真实。**
