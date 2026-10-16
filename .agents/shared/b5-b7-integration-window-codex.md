# B5/B7 正式接线窗口

2026-10-16，codex。已重读职责、任务brief与DSH裁决书。最新mumu list四台均无占用，OpenCode已完成并释放设备；依据DSH裁决1开始串行接线。进程检查见Gradle/Kotlin常驻守护进程，不把java进程存在当作正在构建的证明；本轮只做Node接线，不运行Android构建或占用设备。B5/B7保持原claimed，不重新认领。

唯一业务写入文件：custom-server/index.mjs。采用方案A，保留reqStart定义与B6全部计时传参、缓存/预热/推荐预取逻辑，附加opt-in traceRequest并接入预取指标和并发2。不得应用旧patch或staged-index。

同步维护Codex原有入口VM测试的真实依赖绑定，新增完整路由回归与更新Codex的接线验证脚本。不处理DSH分给OpenCode的全仓loopback测试鲁棒性专项，避免同文件范围扩张。修改期间其他方请勿写本入口；本记录完成后追加释放状态。

## 完成与释放

正式入口接线、42项专项、214项全量、四路由真实上游验证和独立复审已完成，窗口释放；未运行Android构建/占用设备。后续写入由DSH安排。证据见b5-b7-final-integration-codex.md。
