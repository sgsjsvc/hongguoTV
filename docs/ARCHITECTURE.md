# 项目架构

Web / Windows 共用界面和 Node 本地后端核心，各自保存独立 SQLite 与配置。Windows 通过 Electron 管理动态本机端口，用稳定自定义协议加载页面，退出只停止自己启动的进程。

server/ 是唯一的本地 Node 后端入口，通过 shared/content-provider.mjs 调用 shared/content-core/hongguo.js 获取内容，提供签名、解密和 Range 播放接口。TV 使用相同源文件及 QuickJS JNI，网络、加密与媒体字节处理使用原生实现，不依赖 Node 或其他设备。旧 8787 启动入口已移除；shared/content-http.mjs 保留兼容协议处理器和既有媒体安全回归测试，不启动独立服务。

本地 SQLite 保存完整资料、删除标记与待同步事件，操作和事件队列事务提交。可选远程服务仅保存家庭资料，通过握手校时、幂等上传与增量下载合并；取消配置保留本地资料，游标和确认按远程实例隔离。

同步收藏、统一历史、搜索和显式修改的默认画质／倍速；地址、密钥与设备设置不共享。远程不代理视频，内容播放仍需要互联网。接口、数据目录、产物和部署见 [LOCAL_REMOTE_SERVICES.md](LOCAL_REMOTE_SERVICES.md)。
