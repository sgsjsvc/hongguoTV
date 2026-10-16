# 六方 Agent 快速接入

项目：`F:\Project\hongguoTV`。复用现有 `.agents` 文件总线，无需安装服务、配置 MCP 或使用 Docker。

本文件是快速接入约束；与 README 的默认分工冲突时，以用户最新指令和本文件为准。

2026-10-16 用户新增 Qoder 与 OpenCode 并授权重新分工。六方最新职责以 [RESPONSIBILITIES.md](RESPONSIBILITIES.md) 为准；下方早期 T4、TV UI 等任务描述只作历史背景，领取任务以当前 inbox 状态为准。Qoder / OpenCode 的接入指令见 [新成员接入说明](shared/six-agent-onboarding.md)。

## 当前边界

- 本轮已进入执行阶段。TV UI 自适应与布局优化进行中（见 `.agents/shared/tv-ui-plan.md`）。
- **TV 在范围内。** 早期版本的本文件曾写「TV 不改动、不构建、不安装」，该条已废止：用户后续下达了「优化 TV 端 UI，采用自适应适配各种屏幕分辨率，优化布局和遥控器控制」的指令。按本文件第 5 行，用户最新指令优先。各 agent 不得再以旧边界推辞 TV 任务。
- 播放修复的范围仍为 Web / Windows / TV 三端共用引擎；改动 `shared/content-core/hongguo.js` 前必须先明确隔离方式（见阻塞项）。
- 当前工作区已有其他工具的未提交修改。先检查差异，不覆盖、不回退、不清理。
- DSH 暂任唯一协调者；Codex、Antigravity、WorkBuddy 是执行或审查方。用户可以更换协调者。
- 同一文件同一时间只分配一个修改者。
- 合并、推送、服务启停、安装和发布由协调者统一安排，并遵守用户已授权的范围。
- Cookie、访问密钥、签名凭据和未脱敏抓包不得写入协作文件或提交 Git。

## 最快使用步骤

1. 在六方各自工具里打开或授权项目目录。
2. 分别粘贴下面对应的启动指令。
3. 各工具读取 `.agents/README.md`、本文件和 `.agents/RESPONSIBILITIES.md`，写出自己的就绪报告；Qoder / OpenCode 未提供报告前不算已接入。
4. 用户向 DSH 提供一个具体任务。DSH 拆分任务并写入 inbox，明确负责人、允许改动文件、依赖和验收条件。
5. 执行方只领取分配给自己的、依赖已完成的任务；结果通过 CLI 写入 outbox。协调者审查证据后再接受结果。

### 给 DeepSeek Harness

> 你是本项目本轮协作协调者，身份 dsh。请读取 F:\Project\hongguoTV\.agents\README.md 和 F:\Project\hongguoTV\.agents\QUICKSTART.md，检查现有 inbox / outbox 和工作区状态。把接入结果写入 .agents/shared/dsh-ready.md，包含可访问目录、可用工具和阻塞项。暂时不要修改业务代码或自动派发实现任务；等待我的具体任务。收到任务后只分配有明确边界的任务，每个文件只有一个修改者，汇总其他 agent 的报告并依据验收证据整合。

### 给 Codex / ChatGPT

> 你是执行及审查方，身份 codex。请读取 F:\Project\hongguoTV\.agents\README.md 和 F:\Project\hongguoTV\.agents\QUICKSTART.md。把接入结果写入 .agents/shared/codex-ready.md，包含可访问目录、可用工具和阻塞项。暂时不修改业务代码。收到明确任务后，检查 ready 任务，仅认领 assignee=codex 的任务；执行前检查现有差异，完成后记录改动、验证命令、实际结果和剩余问题。没有任务时报告待命，不自行扩展范围。

### 给 Antigravity

> 你是执行及浏览器验证方，身份 antigravity。请读取 F:\Project\hongguoTV\.agents\README.md 和 F:\Project\hongguoTV\.agents\QUICKSTART.md。把接入结果写入 .agents/shared/antigravity-ready.md，包含可访问目录、可用工具和阻塞项。暂时不修改业务代码。收到明确任务后，仅认领 assignee=antigravity 且依赖完成的任务；验证必须对应明确的代码版本，不把 HTTP 成功当作实际播放成功。
>
> **注意：TV 已在本轮范围内。** 早期版本的本文件曾写「TV 不在本轮范围」，该条已废止 —— 用户已下达 TV UI 自适应与布局优化指令，你已完成的 T1/T2/T3 正是该指令下的任务。不要再以旧边界推辞 TV 任务。当前进行中的任务链见 `.agents/shared/tv-ui-plan.md`。

### 给 WorkBuddy

> 你是文档整理及独立复核方，身份 workbuddy。请读取 F:\Project\hongguoTV\.agents\README.md 和 F:\Project\hongguoTV\.agents\QUICKSTART.md。把接入结果写入 .agents/shared/workbuddy-ready.md，包含可访问目录、可用工具和阻塞项。暂时不修改业务代码。收到明确任务后，仅认领 assignee=workbuddy 且依赖完成的任务；区分已验证事实与推测，审查测试证据，按任务约定整理文档。没有 CLI 权限时，在报告中说明，由协调者代记任务状态。
>
> **注意：你已认领 T4（TV UI 自适应独立复核）。** 复核对象是 T1–T3 的产物，重点核查「三档 dimens 数值是否真的不同」与「是否真自适应」，不能只看构建通过。任务详情见 `.agents/inbox/t-mv6o7lhy-8d34e3.brief.md`。

## 文件交接与命令

在项目根目录执行：

```powershell
node .agents/cli.mjs status
node .agents/cli.mjs ready
node .agents/cli.mjs show <任务ID>
node .agents/cli.mjs claim <任务ID> <自己的身份>
node .agents/cli.mjs done <任务ID> <自己的身份> "结论及证据文件路径"
node .agents/cli.mjs fail <任务ID> <自己的身份> "阻塞原因及已尝试措施"
```

协调者使用 createTask 建立包含 context、acceptance、blockedBy 的任务；简单的 CLI add 命令不应代替完整的任务边界。

详细报告写在 `.agents/shared/<任务ID>-<身份>.md`，包括：目标、实际改动、验证环境和命令、结果、剩余风险、需要其他方回答的问题。跨 agent 问题通过报告交给协调者，协调者再创建跟进任务。

任务命令中的 done 只表示执行方提交结果，不能替代协调者的最终验收。现有锁不构成文件级隔离，协调者仍需保证任务修改范围不重叠。

## 能力边界

这是文件交接，不是即时聊天或自动唤醒。各工具完成一轮后，用户可能需要发送“检查分配给你的新任务”。未验证各工具适配器前，不使用 `run` 自动调度。普通聊天界面若无法访问本地文件，需要把相关文档内容粘贴进去，不能假定已经接入。
