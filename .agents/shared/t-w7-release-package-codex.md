# W7 Web / Windows 发布包执行结果

日期 2026-10-15，负责人 codex。领取后执行，当前没有其他 ready 的 codex 任务。

## 交付与修改

`release/web/` 更新六平台 Web 一体包及打包脚本伴随生成的两份 Linux 同步服务包；`release/windows/` 更新 x64 / arm64 的 NSIS 安装版与便携版。保留 release/tv 原有五份 APK，本任务不修改或打包 TV。旧无架构名的两份通用 EXE 移至 `outputs/testing/w7-release/previous-universal/`，避免旧文件混入本轮交付。构建新生成的可选通用 EXE 保存在 outputs/w7-release，本轮未收集。手动收集而不调用 collect-release，避免该脚本清空无关 TV 目录。

新增只读校验脚本 `scripts/verify-release-packages.py`、`.agents/shared/w7-verify-installers.py`，新增实网 UI 验证脚本 `.agents/shared/w7-live-release-check.cjs`。业务源码、引擎及 Electron 配置未修改。更新 release 的 manifest、SHA256SUMS、README 与本轮说明，未提交、推送或外网发布。

## 构建及门禁

1. `npm run release:check`：退出 0，144/144 测试、typecheck、播放 smoke 全通过。3 个真实样本《玫瑰轻颤时》《二嫁有喜》《婚后恋爱禁止条例》均有实际清晰度，720P Range 返回 206 / 65536 B / ftyp，末次 health.upstreamHealthy=true。
2. `npm run build`：退出 0。
3. `node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,darwin-x64,darwin-arm64,linux-x64,linux-arm64 --web-only`：退出 0。使用 --web-only 跳过旧 dist-win 桌面 ZIP 分支，桌面另用 Electron Builder。
4. 删除本进程 HG_ELECTRON_DIST、ELECTRON_RUN_AS_NODE 后，Electron Builder `--config electron-builder.config.cjs --win --x64 --arm64 --config.directories.output=F:/Project/hongguoTV/outputs/w7-release --publish=never`：退出 0。未强制复用 x64 Electron，两架构独立原生 PE 校验通过。

日志：`outputs/testing/w7-release/{release-check.log,web-build.log,bundles.log,desktop-build.log}`。

## 产物内容验证

`python scripts/verify-release-packages.py`：六个真实 Web 压缩包内的引擎、custom-server/index、listen-port、前端与当前源码逐字节一致；引擎有 deviceEntropy、typeof crypto.randomBytes，不含旧固定 ID。前端含「退出全屏」「滚轮」。Windows Node PE、Linux ELF、macOS Mach-O 架构正确，Unix 启动脚本及 Node 可执行位正确。两份 unpacked 桌面 app、Node 架构及 main/preload/front-end 一致。

`python .agents/shared/w7-verify-installers.py`：从四个最终 EXE 实际解出嵌入载荷并逐字节验证引擎、端口模块、main/preload、前端；各包的原生 app / Node PE 架构分别为 x64=0x8664、arm64=0xAA64。外层 NSIS 启动器的 PE 架构不等同于内嵌 app 架构。7za 对 PE overlay 的警告返回 1 允许，但所有提取文件必须验证存在且内容匹配。

证据：`archive-verification.log/json`、`installer-verification.log/json`、四份 extract 日志及实际载荷目录，均在 `outputs/testing/w7-release/`。

## 实网功能验证

Web：真实解压 outputs/bundles/hongguotv-web-win-x64.zip，以包内 Node 启动、独立数据目录及动态端口；日志 `web-live-server.log`，健康输出 `web-health.json`。Chrome 实际播放真实上游，readyState=4、paused=false、currentTime>0.3，1080×1920；点击推荐全屏后 innerWidth/Height=screen.width/height=2304/1536，header 隐藏，Esc 恢复。见 web-live-results.json / web-live-fullscreen.png。

Windows：实际启动本次 x64 unpacked 应用与自有后端，CDP 加载真实自定义协议页面，未替换内容或媒体接口。第二次运行真实视频 readyState=4、paused=false、1080×1924；推荐全屏屏幕级尺寸 2304×1536，header 隐藏，Esc 恢复。见 desktop-health.json、desktop-live-results.json、desktop-live-fullscreen.png。

**保留失败证据**：第一次桌面真实样本《九尾女判官》出现 errorCode=4 / FFmpegDemuxer open context failed，超时退出；检查该分集五档 HEVC 清晰度均返回，1080P Range 请求成功 206 / 65536 B / ftyp，canPlayType(HEVC)=probably。重新启动另一推荐样本播放通过。根因未确认，不将重试通过当作原失败已修复；请求 DSH 独立安排该分集与初次取流/媒体容器问题排查，本任务未越界修改播放器或引擎。失败日志 desktop-live-failure.json 与成功报告并存。

## 限制与签名

本机 Windows x64，未在 arm64 Windows / Linux / macOS 上执行程序；这些平台仅验证构建和包内容/原生架构。未验证所有剧集和所有清晰度。

`Get-AuthenticodeSignature`：四个交付 EXE **NotSigned**。未取得有效签名凭据，按任务允许的未签名交付分支报告；无凭据写入文件，未把 electron-builder 的 signtool 日志当作已签名。结果 signature-status.json。

本次测试仅创建和关闭自有应用/后端；未停止原有开发服务。大小与 SHA256 见下表及 release/SHA256SUMS.txt，manifest.updatedByW7 区分本轮更新和保留 TV。


| 本轮产物 | 字节 | SHA256 |
| --- | ---: | --- |
| windows/红果短剧-1.0.0-arm64-portable.exe | 108510846 | 8abc75f7d8ff55c1a214b67e8d539822969a864172fc490af7a42cfbb780874e |
| windows/红果短剧-1.0.0-arm64-setup.exe | 108775869 | c912ada75dc8d71327ebb0d94cd19291a1ba2b706297012c40e220a39ef45f8f |
| windows/红果短剧-1.0.0-x64-portable.exe | 117436853 | 667e21f0ae462e3032bf9cade68a7ad0378706991d4a02d585eded4340961d3c |
| windows/红果短剧-1.0.0-x64-setup.exe | 117702369 | 6ef8017740ea4a7f888602562bc70f9888005e9dd579d545c470fa5dad8089dd |
| web/hongguotv-sync-linux-arm64.tar.gz | 43220861 | 4376c8b31bf02cade636422fc545752d2a678a6ea4244b337bf996485d0ff98c |
| web/hongguotv-sync-linux-x64.tar.gz | 43369948 | 1a705e730d2e5502b0991febe50ee0beda52e6823767eca4816c8a7e27cf1d44 |
| web/hongguotv-web-darwin-arm64.tar.gz | 37761687 | 1936688704d2bd536080223fbe8f41247cb35e6f32c262dbbb83219bef2e82c7 |
| web/hongguotv-web-darwin-x64.tar.gz | 38969568 | d4bd75a25807d8a5ee06f1785a3b95d0f1bc688241b0472dcc91c164032f2aa2 |
| web/hongguotv-web-linux-arm64.tar.gz | 44477792 | 19964cc850d4abe813cb2f10b68065bdd4933d20583a24ebb0cf6e62a1c87df8 |
| web/hongguotv-web-linux-x64.tar.gz | 44622475 | 67221066bc049feff6c26b3aada37f80f120e49d247dcd693e46b8ad66415fe6 |
| web/hongguotv-web-win-arm64.zip | 29708059 | 49ab502b25920645be4639150b88e70cdc99bb70dbc4030e2f4d2fed5ac123b4 |
| web/hongguotv-web-win-x64.zip | 34202018 | 6f8a3d9cac4467bce18ecc06c83d7fa034c13fa5691e2f1963592ba5bf4e1d20 |
