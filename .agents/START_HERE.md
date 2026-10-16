# 所有Agent的新会话启动入口

用户已要求全部Agent重开新会话。先恢复项目事实，再执行明确任务，不依赖旧聊天记忆。

1. 确认工作区为 `F:\Project\hongguoTV`，身份使用固定小写名称。
2. 依次读取 `.agents/RESPONSIBILITIES.md`、`.agents/README.md`、`.agents/QUICKSTART.md`、`HANDOVER.md`。用户最新指令优先，具体brief优先于默认目录归属。
3. 只读检查 `git status --short`、inbox、outbox及相关shared报告；运行 `node .agents/cli.mjs list claimed` 和 `node .agents/cli.mjs ready`。有自己claimed任务时先恢复状态与剩余事项，不重复claim，不接管他人任务或释放他人锁。
4. 自行实测本会话的目录权限、工具与必要能力，写 `.agents/shared/<身份>-session-ready.md`：身份、时间、工作区/分支、已读职责、实际命令/结果、能力与限制、在途任务、阻塞和下一步。旧ready保留，不能复制旧实测当本次结果，不代写他人报告。同名session-ready若已存在，先归档再更新。
5. 手机目前无独立工程，WorkBuddy先自行补workbuddy-mobile-readiness.md，不自行选技术栈或创建工程。Qoder重建ready的入库条件仍由DSH核验；职责不等于已就绪。
6. 接入完成后报告自己的在途/可领取任务及阻塞，等待明确执行指令。收到继续/领取并完成等指令后，重读职责和brief、核查assignee/ready/冲突再执行。不能因开新会话自动启动服务、构建、安装、发布或推送。
7. 设备用前读 `.agents/mumu-device-allocation.md`，先声明后使用，用完释放；Gradle和同目录打包互斥。旧设备状态不代表当前可用。

## 特别需要恢复的上下文

本次整理时仅B5/B7仍由Codex领取，以实时总线为准。两项独立代码/测量与接线补丁已交，入口接线尚待DSH协调，尚未整体done。读取shared/b5-b7-file-coordination-codex.md、b5-perf-baseline.md、b7-algo-opt-codex.md，不重复开发或宣称接线已应用。

旧team/route/plan仍有岗位映射及DSH在途改动，不能作为新六领域派发依据。DSH同步前按职责与真实assignee人工交接。本入口不是自动执行业务任务授权。
