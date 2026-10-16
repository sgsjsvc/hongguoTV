# P1 预取接口（供 Web / Windows 接入）

范围：本地 Node 后端，TV QuickJS 独立引擎不使用本接口。业务 UI 文件由 P2/P5 执行方维护，codex 不改动客户端。

- `POST /api/prefetch`，JSON `{ "targets": [{"kind":"detail","id":"剧集ID"},{"kind":"qualities","id":"分集ID","seriesId":"剧集ID"}] }`。ID 必须为字符串，每批 1–8 个目标。
- 返回 202，包含随机 `id`、`state`、`targets`。detail 目标会同时预热第一集画质；不会下载视频正文。
- `GET /api/prefetch/:id` 获取状态。批次 `pending/complete/cancelled`，各目标 `queued/running/done/failed/cancelled`。complete 代表结束，需检查目标是否 done。
- `DELETE /api/prefetch/:id` 取消当前批次。多个批次共用目标时，最后一个订阅者取消才取消上游。前台请求已加入时不会被后台取消影响。
- 启动环境 `HG_PREFETCH_ENABLED=0` 关闭；POST 返回 enabled=false / state=disabled。客户端也可直接不发预取请求。
- 后台默认 1 并发，有队列/批次容量限制，错误静默隔离，前台详情和画质请求进行时不会启动新的预取。
- `GET /api/series/:id?fresh=1` 强制刷新原 pageCache；响应头 X-Cache=HIT/MISS/BYPASS（已 expose 给跨域）。仍保留现有 180 秒 TTL，不另建详情缓存。

建议当前项详情加载后预取同页后一部，离开/切换时 DELETE 旧批次；不预取推荐分页以免改变服务端会话顺序。预取接口尚未自动接到任何客户端触发器，需要客户端维护方按需接入。
