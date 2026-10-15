# W1 端口自动递增交付

日期 2026-10-15（Asia/Shanghai），执行方 codex；任务 t-w1-port-autoincrement。

## 结果与实现

- 内容服务默认 8788 起、共享服务默认 8791 起，各最多尝试 11 个连续端口，仅 EADDRINUSE 时递增；其他错误立即给出原因。
- 显式 HG_PORT 优先并严格使用该端口；PORT=0 保留系统分配语义。失败提示包含范围、netstat/lsof 和 HG_PORT 指引。成功打印实际地址，通过 ready IPC 返回实际端口。
- launcher 仅在 backend-ready 后发布实际端口，初始 port=0，重复启动复用自身服务，停止只控制其所属服务。
- Vite strictPort=false 使用原生自动递增。内容服务写入数据目录 service-address.json；Vite 启动时验证 PID 和健康服务身份，读取实际后端端口，避免代理仍指向占用的 8788。HG_BACKEND_URL 可显式覆盖目标。地址登记失败只警告，不使健康服务退出；关服仅删除本 PID 的登记。

改动：shared/listen-port.mjs、custom-server/index.mjs、apps/sync-server/index.mjs、scripts/service-launcher.mjs、apps/web-pc/vite.config.ts；新增 tests/listen-port.test.mjs。tests/playback-p0.test.mjs 仅适配旧 VM fixture 的启动代码截取边界，原测试断言未改。

必要打包依赖修正：scripts/build-bundles.mjs 的共享文件清单新增 listen-port.mjs；否则新静态 import 会造成 Web／sync／桌面包缺模块。独立审查发现此项后，已重新生成包并检查实际归档。W3 同时移除桌面 fork 继承的 HG_PORT，使桌面 PORT=0 不被覆盖；该改动归 W3 文件范围。

## 验证命令与证据

```powershell
node --test tests/listen-port.test.mjs tests/desktop-fullscreen.test.mjs
node .agents/shared/w1-port-integration.mjs
node .agents/shared/w1-vite-check.mjs
npm test
npm run build
node scripts/build-bundles.mjs --platforms=win-x64,linux-x64 --web-only
```

专项 6/6、最终完整回归 115/115，通过；Web 构建成功。首轮回归有一个既有 sync-key 测试出现 fetch failed，未改其实现或断言，重跑及后续最终回归均全绿。命令日志 outputs/w-regression-final.log、outputs/w-web-build.log、outputs/w3-bundle-final.log。

真实占用验证（独立数据目录，测试自有 socket／进程结束后清理）：

| 场景 | 实际结果 |
| --- | --- |
| 占用 8788 | 内容服务 8789，健康接口 200，进程保持存活 |
| 占用 8788–8790 | 内容服务 8791，健康接口 200 |
| 占用 8788–8798 | exit 1，清晰范围和释放／HG_PORT 指引 |
| HG_PORT=8899 且占用 | exit 1，不递增 |
| HG_PORT=8899 且可用 | 实际 8899 |
| PORT=0 | 实际系统分配端口，健康接口 200 |
| 共享服务 8791 占用 | 实际 8792，健康接口 200 |
| Web launcher | 实际 8789，重复 start 正常复用，stop 清理状态 |
| sync launcher | 实际 8792，重复 start 正常复用，stop 清理状态 |
| Vite 3000 占用／后端 8788 占用 | 页面 3001、后端 8789；页面 /api/rank/types 经代理返回 200、4 个类型 |
| 桌面继承 HG_PORT=8899 | 仍系统分配随机端口，健康接口 200，见 W3 证据 |

原始结果 .agents/shared/t-w1-port-results.json、t-w1-vite-results.json、t-w3-fullscreen-results.json；逐场景日志 outputs/w1-tests/*.log。

首次集成脚本用 0.0.0.0 占位而服务绑定 127.0.0.1，在本机可同时绑定，不能作为同地址占用证据；改为相同 127.0.0.1 后全部场景通过。另修正测试对 IPC 和日志到达先后的错误假设；未将其误判为服务实现问题。

Windows Web ZIP 和 Linux x64 Web／sync TAR 实际包含 shared/listen-port.mjs；x64 桌面最终实际启动进一步证明包内依赖齐全。outputs/bundles/SHA256SUMS.txt 已更新。ARM64／macOS 旧包本轮未重建，脚本已修复复制规则，分发这些平台前应重建。

## 限制与边界

Vite 使用原生递增机制，没有服务端的 11 次上限；代理在 Vite 启动时发现后端地址，建议先启动后端。若运行中更换后端端口，应重新启动 Vite，或指定 HG_BACKEND_URL；本任务未实现持续服务发现。没有停止或重启用户原有服务；未修改 TV 或其他代理的 Web src 文件，未提交／推送。
