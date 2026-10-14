# B2 Web 与同步服务自包含包交付报告

执行方 codex；日期 2026-10-14；任务 t-b2-web-bundle。

## 结果与范围

完成要求的五平台 Web 包，额外生成 win-arm64 包供 B1 使用；完成两个 Linux 同步服务包，共八个归档。使用现有 --web-only 避开旧桌面 ZIP 文件占用，未修改脚本或业务代码。归档未包含 Docker、用户数据库、共享密钥或运行状态文件。

## 命令与结果

apps/web-pc 下执行 npm run build，exit 0；随后根目录执行：

```powershell
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,linux-x64,linux-arm64,darwin-x64,darwin-arm64 --web-only
python .agents/shared/t-b2-verify.py
```

构建与归档验证均 exit 0。日志 t-b-web-build.log、t-b2-build.log。Node 22.20.0 使用官方发行包并由打包脚本验证 SHA256。全部包含运行环境、服务代码和所属启动／停止脚本，Web 包包含新构建前端。

## 产物与校验

完整逐包文件名、字节数、SHA256 见本报告附表及 t-b2-artifacts.json。目录 outputs/bundles，发布校验清单 outputs/bundles/SHA256SUMS.txt。

| 文件 | 字节数 | SHA256 |
| --- | ---: | --- |
| hongguotv-web-win-x64.zip | 33871277 | b8e252d0e564d883a72e2918a5668f0c14e80a9cc0b721f4dae4c493a864d567 |
| hongguotv-web-win-arm64.zip | 29482057 | b44f1e11863668cd496e0c3244cbcb6faf29c017bdc58a354450b77d4edae82b |
| hongguotv-web-linux-x64.tar.gz | 44400023 | f537dec55a401c65a8e66b946e61e3bd337b3a8c257bc84ba98e909fcbd9a000 |
| hongguotv-web-linux-arm64.tar.gz | 44251318 | cd19d4c2dc4277d8d001643a88fcb151e07f1499f27b968a5dacc0ab2cbcf9bd |
| hongguotv-web-darwin-x64.tar.gz | 38743253 | effdbba1424883ff7f4e00518c26e89dcc97262c64438f7df37d81896c8ff13b |
| hongguotv-web-darwin-arm64.tar.gz | 37531624 | 3c467fe29509ce5ea27146bf8cc4cb9c7299383b140b5ed906e3fa6f025d0a7a |
| hongguotv-sync-linux-x64.tar.gz | 43369056 | 381c3405f00952f96448b35f52a789e02eb65336c82df10d3ea4e00a903a902c |
| hongguotv-sync-linux-arm64.tar.gz | 43219945 | 67db1a8bb8ef3aa0346ac7ee92d68e942afdc5ce2da0e6e57de9ca5d4f1058bb |

## 验证

逐包检查 ZIP CRC／TAR 可读性、文件清单、包内运行时及启动脚本引用。Windows PE、Linux ELF、macOS Mach-O 的 x64／ARM64 架构均正确；全部 POSIX runtime/node、start.sh、stop.sh 在归档中为 0755。前端和共享 hongguo.js 与当前源文件一致。

Windows x64 隔离启动：PATH 为空，用包内 runtime/node.exe 执行 scripts/service-launcher.mjs start，独立 HG_DATA_DIR=outputs/packaging-tests/web-no-node，HG_PORT=0，HG_SERVICE=web。动态端口 1418，健康与首页均 200，HTML 正确，重复 start 复用所属服务，stop 正常结束。证据 t-b2-no-node-smoke.json；没有操作原有服务。

## 尚未验证

Linux／macOS／Windows ARM64 未实际启动，仅完成归档、架构、权限与脚本检查。Windows x64 PATH 清空验证不是全新虚拟机验收。未实际部署同步服务，不声称兼容任意系统版本或所有 CPU。
