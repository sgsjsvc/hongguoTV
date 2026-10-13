# 红果短剧

源码仓库：[sgsjsvc/hongguoTV](https://github.com/sgsjsvc/hongguoTV)。

非官方短剧客户端，提供独立 Web、Windows 桌面和 Android 5.1.1+ TV 应用。各端内置内容获取与播放处理，本地保存收藏、历史、搜索和偏好，可选连接家庭共享服务双向同步。

## 项目目录与重新建仓

源码位于 `apps/`、`server/`、`shared/`；`server/` 是唯一的本地后端，`shared/` 保存内容适配器及共用核心。`assets/` 保存品牌素材，`scripts/` 保存构建与检查工具，`tests/` 保存测试，`docs/` 保存说明和设计记录。

旧远程关联与工作流已清理。重新建仓时推送源码、依赖锁文件、构建配置和许可证；依赖、构建包、日志、数据库与密钥由 `.gitignore` 排除。旧 Git 历史的处理及首次推送步骤见 [推送说明](docs/PUSH_GUIDE.md)。

## 一体包

产物位于 outputs/bundles：Web 包覆盖 Windows x64、Linux x64 / arm64、macOS x64 / arm64，内置运行环境与启动／停止脚本；Windows 桌面自动管理内置后端。TV Debug APK 位于 outputs/tv-android。

Web 解压后运行 start.cmd 或 sh start.sh，停止使用对应 stop 脚本。Windows 桌面运行 红果短剧.exe。TV 不需要填写本地后端地址；获取与播放内容仍需互联网。

各端填写同一远程地址与家庭密钥即可同步；未配置时正常本地使用。历史统一海报网格，无端分类，TV 仅允许查看和续播。

部署、平台要求、数据路径和迁移见 [本地服务与远程同步](docs/LOCAL_REMOTE_SERVICES.md)。Linux / macOS 宿主与 Docker 运行验收待完成；公网部署等待主机信息。

## 开发

需要 Node 22.13+。

```powershell
npm ci
npm --prefix apps/web-pc ci
npm run server
npm run dev
npm test
npm run typecheck
npm run build
npm run build:bundles
```

本地服务默认 8788，开发页面 3000。内容直接调用内置引擎，不依赖旧的 192.168.1.21:8787。Android 构建见 [TV 工程](apps/tv-android/README.md)，交接见 [HANDOVER.md](HANDOVER.md)。
