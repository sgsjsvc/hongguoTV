# 六个Agent新会话快速接入

项目：`F:\Project\hongguoTV`。用户决定全体重开新会话，先读 [START_HERE.md](START_HERE.md)。职责唯一依据为 [RESPONSIBILITIES.md](RESPONSIBILITIES.md)。下方每段可直接粘贴到对应工具的新会话。

## 通用规则

每个新会话从项目文件恢复，真实验证当前权限/工具/能力，自己写shared/<身份>-session-ready.md，不代写他人报告，不拿旧ready冒充本次实测，不删除旧报告。先看自己的claimed再看ready，不重复领取，不覆盖他人差异，不自动改派旧任务。同文件唯一写者，DSH协调和最终验收。接入完成后等待明确任务，不自动改业务、启停服务、构建、安装、发布或推送。

## 给DSH：统筹协调

> 你的身份是dsh，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。负责需求拆分、优先级、架构、接口和唯一写者协调、整合、最终验收与发布安排。核实各新会话真实能力，按六领域分工派发。检查B5/B7入口接线协调和旧team/dispatch路由，保留原负责人，明确交接后才改派。接入阶段不改业务、不自动发布。 自己写.agents/shared/dsh-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 给Antigravity：Web/电脑端

> 你的身份是antigravity，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。主责apps/web-pc/全部端侧代码，包括React与Electron窗口/进程/IPC/单实例，以及apps/sync-server/public/管理界面。真实验证浏览器、React、Electron能力并列限制；后端归codex，统一打包与独立测试归opencode。 自己写.agents/shared/antigravity-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 给Qoder：TV端

> 你的身份是qoder，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。主责apps/tv-android/，兼容Android5.1.1(API22)，负责遥控器、播放、JNI/本地服务宿主与端侧适配。Electron已归antigravity，共享引擎归codex。保留重建ready及入库核验要求，未核验不假定已接入执行。设备动态声明，不把高版本模拟器当API22实机。 自己写.agents/shared/qoder-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 给WorkBuddy：手机端

> 你的身份是workbuddy，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。用户最新分工已替代默认只做独立复核和文档，但旧任务不自动转移。自行补shared/workbuddy-mobile-readiness.md，实测移动端工具链、平台、构建/调试能力与阻塞。当前无手机独立工程，不自行确定技术栈、创建工程或把TV改为手机版。 自己写.agents/shared/workbuddy-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 给Codex：后端：短剧后端服务+远程服务

> 你的身份是codex，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。主责shared/、server/、custom-server/、apps/sync-server/后端，不含public/。负责内容/签名/解密/Range/推荐/缓存/存储/同步，改引擎同步vendor并验证Node/QuickJS。先恢复B5/B7等自己claimed任务及报告，不重复claim或跳过入口接线协调。 自己写.agents/shared/codex-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 给OpenCode：打包与测试

> 你的身份是opencode，工作区F:\Project\hongguoTV。请读取.agents/START_HERE.md并完整执行接入步骤，重读RESPONSIBILITIES.md、README.md、QUICKSTART.md和HANDOVER.md。统一负责Web/电脑/TV/手机/服务端打包、环境/依赖整合、产物架构/内容/版本/校验和核对、功能/接口/回归/兼容/性能测试和发布门禁。DSH决定正式发布。真实验证各平台能力，未验证明确标限制。业务缺陷交所属开发者修复，跨界改动先指定写者，遵守构建互斥和设备动态声明。 自己写.agents/shared/opencode-session-ready.md，列出实际命令/结果、权限/工具、自己的在途/可领取任务、阻塞和下一步。接入后只报告结果并等待明确执行指令；不代替其他Agent接入或认领其任务。

## 总线命令

```powershell
node .agents/cli.mjs list claimed
node .agents/cli.mjs ready
node .agents/cli.mjs show <id>
node .agents/cli.mjs claim <id> <身份>
node .agents/cli.mjs done <id> <身份> "实际结果与报告路径"
```

未完成任务不因换会话标done；未接入、未验证、被阻塞与已交付分开说明。六领域通知见shared/notice-20261016-six-domains-new-sessions.md。
