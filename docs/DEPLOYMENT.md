# 使用独立包与启动脚本部署

所有服务直接运行包内 Node，无需系统安装 Node/npm。源码开发需要 Node 22.13+。各平台产物位于 `outputs/bundles/`，选择对应操作系统与 CPU 架构。

## Web 服务

解压对应 `hongguotv-web-*` 包后，Windows 双击 `start.cmd`，Linux/macOS 执行 `sh start.sh`；停止使用同目录 `stop.cmd` 或 `sh stop.sh`。默认浏览器地址 `http://localhost:8788`。

数据保存在用户资料目录 `HongguoTV/web-service`，更新程序不覆盖资料。`HG_DATA_DIR` 指定自定义目录，`HG_PORT` 指定端口，`HG_HOST` 指定监听地址；需要局域网访问时使用 `HG_HOST=0.0.0.0`。重复启动会提示现有实例，停止脚本只停止属于该数据目录的实例。

## Windows 电脑客户端

解压 `hongguotv-desktop-win-x64.zip`，运行 `红果短剧.exe`。客户端自动启动独立后端并分配本机端口，退出时关闭其后端；资料位于 Electron 用户目录的 `local-service/`。不需要先启动 Web 服务。

## 远程共享服务

Linux x64/arm64 解压对应 `hongguotv-sync-*` 包后执行：

```sh
export HG_HOST=127.0.0.1
export HG_PORT=8791
# 如需固定数据目录：export HG_DATA_DIR=/srv/hongguotv-data
sh start.sh
```

启动脚本显示日志位置与 `shared-key.txt` 路径。首次启动生成家庭共享密钥；各端填写同一服务地址和密钥。停止执行同目录 `sh stop.sh`，使用相同环境变量和数据目录。局域网访问可设置 `HG_HOST=0.0.0.0`；公网使用 HTTPS 反向代理，监听本机地址。

管理平台与共享接口使用同一端口 8791；界面无需单独构建。更新先停止旧实例，替换程序文件后使用原数据目录启动。数据库和密钥必须保留，不复制测试数据覆盖现有资料。

## Android TV

安装 `outputs/tv-android/hongguotv-android5.1.1-debug.apk`，支持 Android 5.1.1+。TV 内置内容引擎，独立播放；共享服务为可选配置。覆盖安装保留应用资料，TV 不提供历史删除功能。

当前播放来源及限制见 [播放状态](PLAYBACK_STATUS.md)。本机按用户选择只启动 Web，电脑客户端只保留构建包；两个客户端无需同时启动。

Linux/macOS 宿主运行与公网部署尚待对应环境验证；Windows 和 TV 实机验收见交接记录。
