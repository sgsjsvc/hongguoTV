# 三端测试包交付

用户直接要求打包 TV / Web / 电脑端。输出 `outputs/testing/all-clients-20261015/`，包含 TV debug APK、Windows x64 Web 一体 ZIP、电脑安装版及便携版。本次无业务代码改动，未提交或推送，未操作其他 agent 设备。

构建：`npm run build`、`node scripts/build-bundles.mjs --platforms=win-x64 --web-only`、Electron Builder `--win --x64 --publish=never`、Android `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug` 全部退出 0。Node 测试 140/140，Android 单元测试 32/32。

Web ZIP 前端与最新 dist 逐字节一致；使用包内 Node、独立数据目录、随机端口启动解包后端，首页和健康接口 200，关闭自有进程。电脑包 6 个前端文件及 main/preload 与最新构建一致；PATH 为空时真实自定义协议首页/健康接口 200，正常退出。

本地夹具交互测试 Web 及新电脑包原生全屏上下切集通过，包括首尾、保持全屏和退出后音量操作。D2 API 35 运行 FullEpisodeKeysTest，OK (1 test)。APK 与本次 Gradle 输出相同。未重新验证上游播放或 Android 5.1.1 实体电视。

构建日志、交互结果、package-verification.json、SHA256SUMS.txt 和测试说明均在交付目录。已有用户应用及服务未停止；调试测试只关闭自身窗口和进程。
