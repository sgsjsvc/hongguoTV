# 六方职责与交接（2026-10-16）

依据：用户要求重新分工，并新增 Qoder、OpenCode。本文件替代早期四方的默认区域分工；保留 DSH 为唯一协调者。任务仍通过 .agents 文件总线交接，不引入 Docker 或新服务。

## ⚠️ 本轮协调指令（2026-10-16 19:00，用户下达）

1. **DSH、Codex、Antigravity、WorkBuddy 在下一次领取任务前必须重读本文件。** 领取前的标准前置步骤为「读 RESPONSIBILITIES.md → 读对应 brief → 确认 assignee 与 ready → claim」，跳过第一步视为未按规范领取。
2. **WorkBuddy 自此默认转为「独立复核 + 文档」角色**：只做独立复核、复核报告、知识整理与交接文档；不默认承担功能实现，不复核自己编写的功能。原已认领任务先完成或先交接，**不自动转给新成员**。
3. **已认领任务保持原执行者**，除 DSH 明确交接并释放原锁；不得因分工变更自动改派，尤其**不得转给 Qoder / OpenCode**。
4. **Qoder / OpenCode 在提交真实 ready 报告（`.agents/shared/qoder-ready.md` / `opencode-ready.md`，由对应工具实际验证后写）之前，不假定其在线、不假定其能力可用、不向其派发任务。** 其他人不代称已接入，也不因其「接入中」而调整既有分工。
5. **WorkBuddy 当前名下 13 个任务已全部 done，无待交接项**；后续仅承接独立复核与文档类任务。

## 职责

| 身份 | 主责 | 默认修改范围 | 验收与协作 |
| --- | --- | --- | --- |
| dsh | 协调与技术负责人 | 任务定义、调度、架构决定、整合与发布安排 | 决定优先级、文件写者、设备借用与最终接受结果 |
| codex | 内容引擎与数据后端 | shared、server、custom-server、apps/sync-server 的后端 | 接口/签名/解密、媒体 Range、清晰度、缓存、SQLite 和跨端同步；修改引擎同步 vendor 并验证 Node/QuickJS |
| antigravity | Web 与电脑共用前端 | apps/web-pc/src、apps/sync-server/public | 页面、播放器交互、焦点/全屏、前端状态与预取触发，负责浏览器验证 |
| qoder | 原生客户端 | apps/tv-android、apps/web-pc/electron | Android 5.1.1+、遥控器、Media3、JNI宿主、原生存储；Electron 窗口/进程/IPC/单实例。共享JS引擎由Codex维护 |
| opencode | 集成质量与工程交付 | scripts 中测试/性能/打包工具、跨端回归、构建与发布配置 | 执行门禁、故障场景、性能对照、APK/EXE/ZIP 内容和架构校验；产物交 DSH 决定发布 |
| workbuddy | **独立复核 + 文档**（2026-10-16 起默认） | docs、HANDOVER.md、独立复核与交接报告 | 独立复核他人成果（验收标准、证据链、回归风险）；维护知识整理与交接文档；不默认承担功能实现，不复核自己编写的功能；历史已认领的功能类任务先完成或先交接 |

这不是对模型能力的排名。职责按当前项目模块与工具使用方式划分，接入后可由 DSH 根据实际结果调整。

## 边界规则

1. 任务 brief 明确允许修改文件、前置依赖、执行者、复核者与验收方法；默认目录归属不能替代具体文件授权。
2. 原生 TV 与 Electron 功能通常由 Qoder 实现；界面的共用 React 代码仍由 Antigravity 实现。共享引擎由 Codex 修改，Qoder负责 Android 宿主适配，不能各改一份引擎。
3. 同步服务路由/数据库由 Codex 维护，管理平台 HTML/CSS/JS 由 Antigravity 维护；需要同时改同一个模板/路由文件时交 DSH 指定唯一写者。
4. 实现者负责本功能的必要测试；OpenCode 负责独立集成/性能/构建验证，不垄断所有 tests 文件。测试或构建脚本也必须按文件划分，不能多人同时写同一文件。
5. 发布配置与 Electron/Android工程构建文件的跨界改动，由 DSH 指定写者；OpenCode可构建已批准代码，不自行修改原生业务。
6. 每个工作副本同一时间只允许一次 Android Gradle 构建、一次写同一目录的 Electron/多平台打包；构建前检查进程并在 shared 写占用/释放记录。
7. 编写者提交结果，独立复核者核对证据，DSH最终验收。done代表执行方提交，不等于最终验收通过。构建通过不等于实机播放通过。
8. 已完成任务与历史报告不重写；**已认领任务保持原执行者，除非 DSH 明确交接并释放原锁；不得因分工变更自动改派，尤其不得转给 Qoder / OpenCode。** 当前未领取的 Q2 仍归 Codex，无需因分工变更改派。
9. **领取任务前必须重读本文件**（DSH / Codex / Antigravity / WorkBuddy 全体适用）。前置步骤为「读本文件 → 读 brief → 确认 assignee 与 ready → claim」；这是领取的硬性条件，不是可选项。
10. **不得删除他人写入 `.agents/shared/` 的报告与通知文件。** 需要归档时移到 `.agents/archive/` 并在原位置留一行去向说明。ready 报告是身份凭据，被删即视为未接入。

## 接入与派发

- **用户决定（2026-10-16）**：Qoder 的 ready 报告曾存在并被 DSH 逐条核实，但已从 `.agents/shared/` 消失且从未入库。**不豁免规则 4** —— 由 Qoder 自身重写 `qoder-ready.md` 并**提交入库**后视为已接入；在此之前 qoder **保持待命，不新建、不改派任务**（不为填人而造活）。核实过程与接入指令见 `shared/qoder-onboarding-dsh-record.md`。
- **OpenCode 已判定接入**：`opencode-ready.md` 存在、可被任何方查阅、已提交入库；DSH 独立抽查 5 条声明全部属实（含独立复跑 `npm test` 178/178）。当前名下 0 任务，待命。
- 新身份固定小写：qoder、opencode；各自只领取 assignee 与自己完全匹配且 ready 的任务。
- 先读取 README、QUICKSTART、本文件，提供 `.agents/shared/qoder-ready.md` / `opencode-ready.md`。报告必须由对应工具实际验证后写，其他人不代称已接入。**在真实 ready 报告落地之前，不假定 Qoder / OpenCode 在线、不假定其能力可用、不向其派发任务，也不因其「接入中」而调整既有分工。**
- ready报告记录可访问目录、工具、运行测试的能力、设备与阻塞；不写令牌、密钥或凭据。不具备命令权限时说明，由 DSH代记状态。
- bus 的任务文件支持新 assignee 名称，优先使用现有 ready/show/claim/done。Qoder与OpenCode目前按人工文件交接，不假定已有CLI或自动唤醒能力。
- 当前自动适配器仅覆盖旧执行工具。team.mjs / dispatch.mjs / cli.mjs 正有 DSH 的未提交岗位调度改动；本轮保留，交 DSH 后续同步六方映射与自动派发。旧 team/route/plan 的归属与“3并发”不能代表六方已连接、可用或已具备6并发。
- 在新路由完成前，使用物理身份 assignee（codex/antigravity/qoder/opencode/workbuddy），由 DSH读本表派发。DSH为协调者，不作为第六个自动执行后端计算并发。

## 设备

**2026-10-16 起改为动态声明制**：4 台设备（mumu-d1/d2/d3 模拟器 + mumu-r 真机）**谁要谁用**，
但必须**先声明、后使用、用完释放**。完整规则与命令见 `.agents/mumu-device-allocation.md`。

- 查空闲：`node .agents/cli.mjs mumu list`
- 声明：`node .agents/cli.mjs mumu declare <设备> <身份> [用途]`
  （中文用途用 `MUMU_PURPOSE` 环境变量传，避免 PowerShell 5.1 的 argv 乱码）
- 释放：`node .agents/cli.mjs mumu release <设备> <身份>` —— **硬性要求**
- 已被占用时**优先换空闲设备**；越权释放会被拒；**不自行删除他人锁文件**，冲突交 DSH 仲裁

**实测现状**：d1 = API 32、d2 = API 35、d3 = API 32 均在线；**mumu-r 真机当前 offline**。
**当前没有 API 22 的模拟器在线** —— 不得声称在模拟器上完成过 Android 5.1.1(API 22) 验证。

**注意**：设备声明与「同一时间只允许一次 Gradle 构建」（边界规则第 6 条）是**两件独立的事**，两者都要遵守。

---

## 设备（历史记录，见 shared/device-allocation.md）


已有设备分配与占用锁继续有效，参见 shared/device-allocation.md。Qoder / OpenCode初始不占用任何 Android 设备；不得直接操作已分给别人使用的 D1/D2/D3 或实体电视。需要设备时由 DSH明确借用时间、持有者和归还记录。新增成员不等于新增模拟器。

## 本轮落地状态

已更新协作职责文档并提供两位新成员的接入指令；尚未验证 Qoder / OpenCode 的工作区权限、CLI、适配器或设备能力。没有自动启动它们、创建业务任务、转移既有任务、运行构建或修改业务代码。

**2026-10-16 19:00 更新（用户协调指令，已落地）**：已记录四方领取前重读要求、WorkBuddy 默认转为独立复核+文档、已认领任务不自动转派、Qoder/OpenCode 未写真实 ready 前不假定在线。WorkBuddy 名下 13 个任务已全部 done、无待交接项；后续仅承接独立复核与文档类任务。

**2026-10-16 19:40 更新（DSH）**：本文件的「本轮协调指令」一节曾在 19:08 被其他方删除，DSH 于 19:25 提交时未察觉、把回退后的版本入了库（提交 `9358f17`）。现按 DSH 19:05 读到的完整内容恢复，并补入边界规则第 10 条（不得删除他人报告）与 Qoder/OpenCode 的接入判定。同期消失的 `qoder-ready.md`、`role-change-20261016-workbuddy.md`、首版通知文件未恢复：前者需由 Qoder 自身重写，后两者内容已由本文件与 `notice-20261016-reread-responsibilities.md` 覆盖。
