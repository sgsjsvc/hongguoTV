# Docker 部署

## 当前远程共享服务

远程服务管理收藏、历史、搜索和偏好，包含浏览器管理平台，不代理内容播放。在项目根目录执行：

```sh
docker compose -f apps/sync-server/compose.yaml up -d --build
docker compose -f apps/sync-server/compose.yaml logs --tail=100
```

默认发布到宿主机 `127.0.0.1:8791`。资料与首次生成的家庭共享密钥存放在 `apps/sync-server/data/`，此目录不能推送。局域网访问可调整端口绑定，公网访问使用 HTTPS 反向代理。配置与迁移见 [本地服务与远程同步](LOCAL_REMOTE_SERVICES.md)。

## 保留的旧内容桥接服务

`server/` 的 8787 桥接服务为兼容工具；当前 Web、电脑和 TV 一体包均不要求独立启动它。根目录 `compose.yaml` 与 `server/compose.yaml` 都从本地源码构建，不依赖旧镜像仓库。

```sh
docker compose up -d --build
docker compose logs --tail=100
docker compose down
```

环境变量 `BRIDGE_BIND_IP`、`BRIDGE_PORT` 和 `BRIDGE_TOKEN` 的示例见根目录 `.env.example`。Node 不自动加载 `.env`；Compose 按其环境文件规则加载。

`.dockerignore` 排除本地密钥、数据库、依赖和构建产物。Docker 和 Linux 宿主验收以 [交付验证](DELIVERY_VERIFICATION.md) 为准。
