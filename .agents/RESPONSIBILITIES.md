# 六方职责与交接（2026-10-16）

依据：用户要求重新分工，并新增 Qoder、OpenCode。本文件替代早期四方的默认区域分工；保留 DSH 为唯一协调者。任务仍通过 .agents 文件总线交接，不引入 Docker 或新服务。

## 职责

| 身份 | 主责 | 默认修改范围 | 验收与协作 |
| --- | --- | --- | --- |
| dsh | 协调与技术负责人 | 任务定义、调度、架构决定、整合与发布安排 | 决定优先级、文件写者、设备借用与最终接受结果 |
| codex | 内容引擎与数据后端 | shared、server、custom-server、apps/sync-server 的后端 | 接口/签名/解密、媒体 Range、清晰度、缓存、SQLite 和跨端同步；修改引擎同步 vendor 并验证 Node/QuickJS |
| antigravity | Web 与电脑共用前端 | apps/web-pc/src、apps/sync-server/public | 页面、播放器交互、焦点/全屏、前端状态与预取触发，负责浏览器验证 |
| qoder | 原生客户端 | apps/tv-android、apps/web-pc/electron | Android 5.1.1+、遥控器、Media3、JNI宿主、原生存储；Electron 窗口/进程/IPC/单实例。共享JS引擎由Codex维护 |
| opencode | 集成质量与工程交付 | scripts 中测试/性能/打包工具、跨端回归、构建与发布配置 | 执行门禁、故障场景、性能对照、APK/EXE/ZIP 内容和架构校验；产物交 DSH 决定发布 |
| workbuddy | 独立审查与知识整理 | docs、HANDOVER.md、独立复核与交接报告 | 审查需求符合度、证据和风险；不默认承担功能实现，不复核自己编写的功能 |

这不是对模型能力的排名。职责按当前项目模块与工具使用方式划分，接入后可由 DSH 根据实际结果调整。

## 边界规则

1. 任务 brief 明确允许修改文件、前置依赖、执行者、复核者与验收方法；默认目录归属不能替代具体文件授权。
2. 原生 TV 与 Electron 功能通常由 Qoder 实现；界面的共用 React 代码仍由 Antigravity 实现。共享引擎由 Codex 修改，Qoder负责 Android 宿主适配，不能各改一份引擎。
3. 同步服务路由/数据库由 Codex 维护，管理平台 HTML/CSS/JS 由 Antigravity 维护；需要同时改同一个模板/路由文件时交 DSH 指定唯一写者。
4. 实现者负责本功能的必要测试；OpenCode 负责独立集成/性能/构建验证，不垄断所有 tests 文件。测试或构建脚本也必须按文件划分，不能多人同时写同一文件。
5. 发布配置与 Electron/Android工程构建文件的跨界改动，由 DSH 指定写者；OpenCode可构建已批准代码，不自行修改原生业务。
6. 每个工作副本同一时间只允许一次 Android Gradle 构建、一次写同一目录的 Electron/多平台打包；构建前检查进程并在 shared 写占用/释放记录。
7. 编写者提交结果，独立复核者核对证据，DSH最终验收。done代表执行方提交，不等于最终验收通过。构建通过不等于实机播放通过。
8. 已完成任务与历史报告不重写；已认领任务保持原执行者，除非 DSH明确交接并释放原锁。当前未领取的 Q2 仍归 Codex，无需因分工变更改派。

## 接入与派发

- 新身份固定小写：qoder、opencode；各自只领取 assignee 与自己完全匹配且 ready 的任务。
- 先读取 README、QUICKSTART、本文件，提供 `.agents/shared/qoder-ready.md` / `opencode-ready.md`。报告必须由对应工具实际验证后写，其他人不代称已接入。
- ready报告记录可访问目录、工具、运行测试的能力、设备与阻塞；不写令牌、密钥或凭据。不具备命令权限时说明，由 DSH代记状态。
- bus 的任务文件支持新 assignee 名称，优先使用现有 ready/show/claim/done。Qoder与OpenCode目前按人工文件交接，不假定已有CLI或自动唤醒能力。
- 当前自动适配器仅覆盖旧执行工具。team.mjs / dispatch.mjs / cli.mjs 正有 DSH 的未提交岗位调度改动；本轮保留，交 DSH 后续同步六方映射与自动派发。旧 team/route/plan 的归属与“3并发”不能代表六方已连接、可用或已具备6并发。
- 在新路由完成前，使用物理身份 assignee（codex/antigravity/qoder/opencode/workbuddy），由 DSH读本表派发。DSH为协调者，不作为第六个自动执行后端计算并发。

## 设备

已有设备分配与占用锁继续有效，参见 shared/device-allocation.md。Qoder / OpenCode初始不占用任何 Android 设备；不得直接操作已分给别人使用的 D1/D2/D3 或实体电视。需要设备时由 DSH明确借用时间、持有者和归还记录。新增成员不等于新增模拟器。

## 本轮落地状态

已更新协作职责文档并提供两位新成员的接入指令；尚未验证 Qoder / OpenCode 的工作区权限、CLI、适配器或设备能力。没有自动启动它们、创建业务任务、转移既有任务、运行构建或修改业务代码。
