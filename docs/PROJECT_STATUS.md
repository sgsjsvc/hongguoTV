# 项目现状

更新日期：2026-10-13。

已实现 Web / Windows / Android TV 独立内容引擎、SQLite 资料库和可选家庭共享同步。历史统一海报网格，无来源分类；TV 无删除／清空能力。

五平台 Web 包、Windows 桌面包、Linux x64 / arm64 远程包和 Android 5.1.1 Debug APK 已生成。Node 79 项、Web 构建检查通过；Android JVM 26 项、lint和APK构建通过。当前原视频接口110001，公开360P兜底的Web媒体与API22电视观看进度验证通过，高清／全集尚未恢复。

Linux / macOS 实际启动、API 35 TV 和长时间连播尚待验收；公网部署等待主机信息。产物与架构见 [交接](../HANDOVER.md) 和 [本地服务／远程同步](LOCAL_REMOTE_SERVICES.md)。

当前按用户选择仅启动 Web（3000／8788），电脑客户端保持关闭，共享服务8791保持运行。播放源状态见 [PLAYBACK_STATUS.md](PLAYBACK_STATUS.md)，部署采用独立包和Node启动脚本。
