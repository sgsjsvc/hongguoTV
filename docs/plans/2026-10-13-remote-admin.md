# Remote Admin Implementation Plan

> For Codex: Use executing-plans to implement task by task.

Goal: 在已有共享服务提供认证后的资料管理页面。
Architecture: 公共静态页面 + Bearer 管理 API，写入共用 SQLite 事件协议，不改变客户端同步契约。
Tech Stack: Node 22 builtin modules / SQLite / HTML / CSS / ES modules.

1. tests/sync-admin.test.mjs：先验证首页、鉴权、幂等删除／清空、偏好和设备事件信息；运行失败测试确认接口缺失。
2. apps/sync-server/admin.mjs 与 server.mjs：增加静态资源和 GET /api/admin/library、POST /api/admin/operations；限制管理操作、复用认证和 LibraryStore，不暴露密钥。
3. apps/sync-server/public/index.html、admin.css、admin.js：实现登录、导航、概览、设备、资料卡、确认弹窗和偏好；使用 textContent，凭据仅内存。
4. 运行 Node 测试与实际浏览器管理流程，在隔离实例测试删除不污染家庭资料。
5. 修改 Dockerfile、build-bundles.mjs 携带静态资源，更新交接和部署说明；重启实际远程服务保留数据库，验证 8791 页面和电视同步。

当前工作区有既有迁移，复用 checkout，避免提交或覆盖无关改动。
