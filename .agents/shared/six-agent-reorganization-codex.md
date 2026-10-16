# 六方分工调整交接给 DSH

2026-10-16，依据用户要求新增 Qoder、OpenCode并重新分工，已更新 README / QUICKSTART，新增 RESPONSIBILITIES.md 和 six-agent-onboarding.md。DSH仍为唯一协调者；Codex后端/引擎，Antigravity共用前端，Qoder TV/Electron原生客户端，OpenCode集成/性能/打包验证，WorkBuddy独立复核/文档。

保留当前任务归属、设备锁和所有未提交业务改动，未派发或认领新业务任务。Q2仍归Codex。Qoder/OpenCode接入尚未验证，需要本人读取指令并写ready报告。

检测到 DSH正在新增 team.mjs / dispatch.mjs并修改cli.mjs，故未覆盖这些文件。其旧映射仍将TV分给workbuddy、QA/发布分给旧工具，并写3执行后端。请DSH在自己的改动中同步六方规则；同步前按实际assignee和RESPONSIBILITIES人工派发，不用旧route自动决定归属。接入未验证前不启用qoder/opencode的run适配器，也不宣称已实现新增自动并发。

本轮仅更改协作Markdown文件，无业务代码、服务启停、安装、构建、提交或推送。
