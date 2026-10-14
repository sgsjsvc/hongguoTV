# R1 播放链路 P0 修复报告

任务：`t-r1-playback-p0`。负责人：codex。日期：2026-10-14（Asia/Shanghai）。

状态：实现和验收检查完成，提交 DSH 复核。只处理 D1-F1 / D1-F2，没有实施 R11 / R12。未提交或推送，未重启既有服务，未安装 APK。

## 改动范围

业务代码仅修改以下四个文件：

| 文件 | 本轮改动（git diff --numstat） |
| --- | --- |
| `shared/content-core/hongguo.js` | +11 / -6 |
| `custom-server/vendor/hongguo.cjs` | +11 / -6 |
| `server/vendor/hongguo.cjs` | +11 / -6 |
| `custom-server/index.mjs` | +25 / -3 |

新增测试与验收证据位于 `.agents/shared/`。其他 agent 的 TV UI、任务状态等工作区修改未覆盖、回退或清理。

## D1-F1：并发备用 CDN 切换

原问题：两个请求共用 stream，均在主地址失败后切换备用地址。先完成者清空 backupUrl，后完成者把已清空的值写入 url，导致后续媒体请求地址为空。另一个时序是晚到的主源失败发生在另一个请求已清空备用字段之后，导致本来可用的备用源无法重试。

修复：在进入异步下载前，将主、备地址保存为本次请求的局部不可变值。备用请求成功后，仅在共享主地址仍等于本次原主地址时执行状态切换；清除备用字段也核对当前值。这样并发成功或迟到失败均使用稳定的备用目标，不覆盖其他请求已经完成的切换。

可选第四参数 signal 转发给 Axios。客户端已取消时不再向备用源重试。未加入全局 AbortController 依赖到共享引擎；原有三个参数的调用仍有效，TV 原生 HTTP 适配器维持原接口。

## D1-F2：分片失败与断开处理

- 发送成功头之前先下载并解密首个媒体分片，首片失败返回 JSON 502。
- 首片复用于发送循环，不额外重复下载；HEAD 仅使用 prepared 元数据，不下载媒体正文。
- 已发送响应后分片失败，销毁响应，客户端收到 aborted，而不是等待剩余正文。
- 每个 Node 媒体请求有独立 AbortController；客户端断开时取消正在进行的该请求媒体分片下载。结束路径清理 close 监听器和取消资源。
- 在共享模型/头部预取结束后再次检查客户端是否已断开，避免继续发起正文下载。

## 修复前失败证据

回归测试文件：`t-r1-playback-p0.test.mjs`。在修改业务代码之前实际运行：

```powershell
node --test .agents/shared/t-r1-playback-p0.test.mjs
```

结果：10 项中 9 项失败、1 项通过。原始日志：`t-r1-playback-p0-before.log`。

- 三份引擎的同时成功时序均得到 `actual: ''`，预期为 backup。
- 三份引擎的晚到失败时序均拒绝并报 late primary failure。
- 中途失败未产生 aborted；首片失败未返回预期 502；客户端关闭未取消活动媒体请求。
- HEAD 和正常多片正文对照通过。

第四轮历史证据也保留在 `t-d1-playback-discovery-evidence.json`：并发后 finalUrl 为空；媒体发送 1048576 / 2097152 字节后未结束，由探针观察超时后主动断开。没有改写历史发现探针来掩盖原来的失败。

## 修复后验证

| 检查 | 命令 / 方法 | 实际结果 |
| --- | --- | --- |
| 新增回归 | `node --test .agents/shared/t-r1-playback-p0.test.mjs` | 10 通过、0 失败；独立审查再次运行同样通过 |
| 现有 Node 回归 | `npm test` | 75 通过、0 失败，退出码 0 |
| Android 构建 | `apps/tv-android/gradlew.bat :app:assembleDebug --console=plain` | BUILD SUCCESSFUL，退出码 0，44 个任务 |
| 四份业务代码差异 | `git diff --check -- <四个授权文件>` | 通过 |
| 副本一致性 | 比较三份 remoteRange 函数及归一化全文差异 | 函数完全一致；副本仅保留原第 138 行 category_$ 兼容差异 |
| APK 引擎资产 | 读取 APK 的 assets/hongguo.js 与共享源码比较 SHA-256 | 完全一致 |

证据文件：

- `t-r1-playback-p0-after.log`
- `t-r1-playback-p0-node.log`
- `t-r1-playback-p0-android.log`
- `t-r1-playback-p0-consistency.json`
- `t-r1-playback-p0-apk-evidence.json`

新增测试独立放在协作目录，以遵守业务修改仅四个指定文件的任务边界；`npm test` 当前只运行已有 tests 目录的 75 项，**不会自动包含这 10 项新增测试**。两条命令均已独立运行。协调者可以在后续授权中将新增回归纳入正式测试目录或 CI。

### APK 构建环境与首次失败

JDK：`C:\Program Files\Java\jdk-17`。SDK：项目现有 local.properties。首次构建时本会话额外设置 ANDROID_NDK_HOME，导致与已有 ndk.dir 重复，错误为 CXX1100。清除构建进程的 ANDROID_NDK_HOME 后重新运行成功，未修改 Android 配置文件。首次失败日志保留在 `t-r1-playback-p0-android-initial.log`。

APK：`F:\Project\hongguoTV\apps\tv-android\app\build\outputs\apk\debug\app-debug.apk`。

APK SHA-256：`3a7b0aa73ec99fdb035414b2b001f45b1e4acb743ea57a15ff67d68f21c62b4e`。

包内引擎和共享源码 SHA-256：`18d9a6a3b0bf136d41a21a7607b87e822b37877c058706dc6b359a879bdc1573`。

APK 包含构建时整个工作区的 Android 代码，包括其他 agent 的 UI 改动；不把它当作 R1 的独立已发布版本。

## 独立复核

按 requesting-code-review 技能进行了独立只读审查。审查者运行新增 10 项测试并确认通过，未发现 R1 必须修复的问题；指出共享头部预取尚不接受单个请求的取消信号，已作为下述限制记录。审查者没有修改文件或任务总线。

## 剩余风险与部署边界

1. 取消能力限定于活动媒体分片；多个客户端共享的 resolveStream / prepareHeader 预取不会随单客户端关闭取消，以免中断其他使用者。不能声称全部上游请求都会取消。
2. 未做实体 TV 安装、API 22 运行、真实音视频解码或故障 CDN 实机验证。APK 构建及资产一致性不代替这些验收；共享引擎使用现有 QuickJS 支持的语法，未修改 TV 原生代码。
3. 既有服务没有重启，正在运行的 Node 进程不会自动加载本次修复。由 DSH 按整体任务编排统一部署和重启，再进行真实媒体回归。
4. 新增测试通过真实当前 HTTP handler 和引擎执行路径、可控故障网络依赖验证，不以官方源的瞬时状态替代并发故障回归。并未声称恢复全部画质或解决其他 D1 发现。
5. 备用源的媒体身份、Content-Range 校验、CENC 索引和缓存优化仍属 R11 / R12，不在本轮扩展。
6. 只修改响应错误与取消处理，没有重新设计整个模型请求生命周期或共享缓存。若共享预取变为主要耗时，需要另行设计引用计数和取消策略。

R1 完成后可解除对 R9 的文件占用；R11 / R12 仍按任务依赖串行，由协调者安排。
