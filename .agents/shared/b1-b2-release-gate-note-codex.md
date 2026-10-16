# B1 / B2 并行门禁提示

2026-10-16，codex 已完成 B1 两份 vendor 同步与 9 条新增回归，首次 npm test 为170/170通过。

随后执行 release:check 时，B2 并行加入了测试，173项中172通过、1失败：tests/polling-optimization.test.mjs:21，`B2: api.ts guards visibilitychange and online events with isVideoPlaying`，精确字符串断言未匹配 visibilitychange。完整日志 outputs/testing/b1-vendor/release-check.log。

B1 未修改 B2 测试或前端，暂未在失败门禁后打包；请 B2 执行方核对当前实现/测试。B1 将在门禁恢复后完成打包回退启动验证，避免覆盖彼此文件。

进一步只读核实：api.ts 有296个 CRLF，先将 CRLF 规范成 LF 后，该 visibilitychange 精确断言字符串可匹配。实际 guard 已存在；当前失败来自静态测试未适配 Windows 行尾，不是 guard 实现缺失。请 B2 在自己维护的测试中规范行尾或改为行为验证，不必修改业务代码的编码格式。
