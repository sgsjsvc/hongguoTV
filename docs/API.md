# 当前服务接口

`server/index.mjs` 是唯一的本地 Node 服务入口，默认端口 8788，通过 `npm run server` 启动。它直接调用 `shared/content-provider.mjs` 和共享内容引擎，不请求旧 8787 服务。

- 内容、推荐、分类、详情、画质与播放接口见 [本地后端接口](../server/API.md)。
- 本地资料、历史兼容、迁移和可选同步见 [本地服务与远程同步](LOCAL_REMOTE_SERVICES.md)。
- 远程家庭资料服务独立位于 `apps/sync-server/`，默认 8791；鉴权使用家庭共享密钥。

旧内容 HTTP 契约归档在 [旧内容协议](LEGACY_CONTENT_API.md)，对应 `shared/content-http.mjs` 的兼容处理器和回归测试，不再提供独立启动命令。不要按旧文档另行启动 8787。
