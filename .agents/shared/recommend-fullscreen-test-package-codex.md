# 推荐全屏测试包交付

日期：2026-10-15。用户直接要求打包测试；未修改业务代码，未提交或推送。

输出目录：`outputs/testing/recommend-fullscreen-20261015/`。

- Windows x64 便携版：`红果短剧-1.0.0-x64-portable.exe`。
- Windows x64 安装版：`红果短剧-1.0.0-x64-setup.exe`。
- Web 一体包：`outputs/bundles/hongguotv-web-win-x64.zip`。

构建：`npm run build`、`node scripts/build-bundles.mjs --platforms=win-x64 --web-only`、Electron Builder `--win --x64 --publish=never`，均退出 0。构建日志保存在输出目录。

验证：实际运行本次 `win-unpacked/红果短剧.exe`；PATH 为空时首页及内置服务健康检查均为 200，退出关闭自有应用。实际桌面全屏测试通过：推荐页全屏隐藏顶部导航，Esc 和退出全屏按钮均恢复导航，视频元素保留。内容使用测试夹具，本次没有重新验证真实上游清晰度或播放接口。

包内 6 个前端文件及 Electron main/preload 与本次构建源文件逐字节一致；内置 Node 和端口辅助模块存在。结果及 SHA256 保存在输出目录的 `startup-results.json`、`fullscreen-results.json`、`package-verification.json`、`SHA256SUMS.txt`。

测试辅助脚本新增可选 `HG_DESKTOP_TEST_EXECUTABLE`，用于指定本次隔离输出，不影响默认路径。构建期间其他 agent 的业务修改未覆盖或回退；交付物以打包快照为准。
