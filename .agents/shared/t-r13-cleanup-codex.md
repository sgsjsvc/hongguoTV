# R13 调试日志清理与回归测试纳管

负责人：codex。日期：2026-10-14。R7 已完成且 ready 确认后领取；仅修改授权文件，未覆盖其他第五轮成果。

## 改动

1. MainActivity.kt 删除三处 android.util.Log.d("TvFocus", ...)；保留 hideChrome 的焦点判断及既有分支。collectionButton.requestFocus 的调用保留，去掉只供日志使用的 ok 变量，未修改焦点控制逻辑。
2. `.agents/shared/t-r1-playback-p0.test.mjs` 移至 `tests/playback-p0.test.mjs`，仅调整 server/http.mjs 导入的相对路径。旧协作测试已删除；三份引擎的两种并发时序测试及四项后端测试全部保留，共 10 项。

## 验证

- 删除前准确找到 3 条日志：t-r13-logs-before.txt。删除后零条：t-r13-logs-after.txt。
- 移动前本轮正式 `npm test` 已为 83 项（其他 agent 新增了 8 项），不是 brief 中旧的 75 项；移入后 **93/93 全部通过**，准确增加 10 项。见完整 t-r13-node.log。
- 最终 R1/R11/R12 专项 47/47 通过，独立复核也确认测试迁移未削弱断言。
- Android `:app:assembleDebug :app:lintDebug :app:testDebugUnitTest` 均通过，BUILD SUCCESSFUL，60 个任务。日志 t-r13-android.log / t-r13-android-final.log；最后重复是因为 R12 随后调整了引擎资产，需要确认最终包。
- 最终 APK 内共享引擎与当前源码完全一致：t-r12-final-evidence.json。
- 独立只读审查确认 TvFocus 日志已移除，焦点请求仍保留，无阻断项。

## 运行边界

未重启既有服务，未提交/推送，未安装 APK。编译和 JVM 单测不代替实体遥控器行为验收。本轮仅删除观察日志，没有新增业务行为。

R11/R12 的新增测试不在本任务指定搬迁范围，仍保留协作目录并在专项命令中运行；后续可由协调者另行纳管，不擅自扩大本任务。
