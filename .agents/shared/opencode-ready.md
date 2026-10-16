# OpenCode 接入报告（opencode-ready）

> ## ⚠️ 领取任务前必读
> 2026-10-16 起，领取任何任务前必须重读 .agents/RESPONSIBILITIES.md。
> 前置步骤：**读 RESPONSIBILITIES.md → 读 brief → 确认 assignee 与 ready → claim**。跳过第一步视为未按规范领取。
> 详见 .agents/shared/notice-20261016-reread-responsibilities.md。
>

**身份**: opencode（集成质量与工程交付）
**生成时间**: 2026-10-16
**主机**: Windows（workdir `F:\Project\hongguoTV`）
**状态**: 已接入。仅完成只读探测与既有测试套件运行，**未改业务代码、未构建、未启停服务、未安装**。

> 本报告由 opencode 工具实际执行命令后写入；不用他人代写，不写凭据/密钥/Cookie。

---

## 1. 已读取的约束文件

| 文件 | 状态 |
| --- | --- |
| `.agents/README.md` | 已读 |
| `.agents/QUICKSTART.md` | 已读 |
| `.agents/RESPONSIBILITIES.md` | 已读 |
| `.agents/shared/six-agent-onboarding.md` | 已读（本身份的接入指令） |
| `.agents/shared/dsh-ready.md` | 已读（协调者现状） |
| `.agents/shared/device-allocation.md` | 已读（设备归属，本次不占用任何设备） |

---

## 2. 环境实测（命令与原始结果）

| 项 | 命令 | 实测结果 |
| --- | --- | --- |
| Node | `node --version` | `v22.20.0`（package.json 要求 `>=22.13.0`，满足） |
| npm | `npm --version` | `10.9.3` |
| Git | `git --version` | `2.51.0.windows.1` |
| Java | `java -version` | `21.0.9+7-LTS`（TV 工程要求 JDK17 编译目标，21 可编译） |
| Python | `python --version` | `3.9.7`（可跑 `verify-release-packages.py`） |
| adb | `Test-Path %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe` | `True` |
| Android SDK | `platforms/` / `build-tools/` | 仅 `android-35`；`build-tools` `34.0.0`+`35.0.0` |
| Android NDK | `Sdk/ndk/` 与 `local.properties` | `28.2.13676358`（`local.properties` 指向 `G:\...\ndk\28.2.13676358`，存在） |
| CMake | `G:\_sofetwar\androdsdk\cmake\3.22.1` | 存在（TV 工程 `version = "3.22.1"`，满足；SDK 自带 cmake 目录为空） |
| Gradle | `~/.gradle/wrapper/dists` | 已缓存 `gradle-8.11.1-bin`（TV wrapper 指定版本，无需下载） |
| web 端依赖 | `apps/web-pc/node_modules` | 已安装（含 `vite`、`tsc`、`electron`、`electron-builder` 的 `.bin`） |
| 根依赖 | `node_modules` | 已存在（含 axios） |

**版本控制状态**（只读观察，未改动、未回退、未清理）：
- 分支 `codex/first-github-push-20261013`，HEAD `617c0739fee75049e7f3a2f9347d0c0860c28634`。
- 工作区**不干净**：`27` 个已修改 + `31` 个未跟踪文件（含 `.agents/`、`apps/web-pc/src`、`apps/tv-android`、`custom-server`、`server`、`shared/content-core`、多个 `tests/*`）。属其他方在途工作，本报告未触碰。

---

## 3. 可访问目录（已验证）

项目根 `F:\Project\hongguoTV` 下可读写：

`.agents/`（含 `inbox/ outbox/ state/ logs/ shared/ archive/`）、`shared/`、`custom-server/`、`server/`、`apps/web-pc/`、`apps/tv-android/`、`apps/sync-server/`、`scripts/`（含 `scripts/perf/`）、`tests/`、`docs/`、`outputs/`、`release/`、`dist-win/`。

---

## 4. 已验证的命令与结果

### 4.1 协作总线 CLI（读写均可用）

```powershell
node .agents/cli.mjs status
node .agents/cli.mjs ready
node .agents/cli.mjs list
node .agents/cli.mjs list pending
```

**实测结果**：
- `status`：`total=60`；`done` = antigravity 27 / workbuddy 13 / codex 18；`failed` = antigravity 1；`pending` = codex 1。
- `ready`：仅 1 条 —— `t-q2-quality-labels`（**assignee=codex**）。
- **无任何 `assignee=opencode` 的任务**（inbox/outbox/state 内亦无 opencode 记录）。

> 结论：本身份当前**无 ready 任务可领取**，按规范待命，不自行扩展范围。
> `doctor` / `run` 未执行 —— `doctor` 会启动其他 agent 的可执行探测，`run` 会自动调度；均超出本次「不启停、不自动派发」的要求。

### 4.2 既有测试套件（已实际运行）

```powershell
npm test        # => node --test tests/*.test.mjs
```

**实测结果**：`# tests 178 / # pass 178 / # fail 0 / # skipped 0`，耗时 `1444 ms`（约 1.4 s）。
完整日志：`.agents/shared/opencode-ready-testrun.txt`（本次运行产生，含 `1..178 / # pass 178 / # fail 0`）。

- 覆盖 31 个测试文件（`tests/*.test.mjs`），含播放 P0、设备标识契约、预取、同步、清晰度档位、桌面全屏等。
- 测试仅使用 **loopback + 临时端口/内存 mock**（如 `127.0.0.1:0`、mock axios），**不访问真实上游、不连外网**；未连接任何 D1/D2/D3/真机、未启停常驻服务。
- 说明：测试通过只证明**代码契约与逻辑层**成立，**不等于**真机可播放。

---

## 5. 构建/打包工具（存在已确认，本次未运行）

| 能力 | 入口 | 状态 |
| --- | --- | --- |
| Web/桌面前端构建 | `npm run build`（`tsc && vite build`） | 工具齐备，未执行 |
| 前端类型检查 | `npm run typecheck` | 工具齐备，未执行 |
| 桌面打包 | `npm --prefix apps/web-pc run build:desktop`（electron-builder） | 工具齐备，未执行 |
| 多平台发布包 | `npm run build:bundles` → `scripts/build-bundles.mjs` | 存在，未执行 |
| 播放冒烟门禁 | `npm run smoke` → `scripts/smoke-playback.mjs` | 存在，未执行（会请求服务/上游） |
| 发布门禁 | `npm run release:check`（test + typecheck + smoke） | 存在，未执行 |
| TV APK | `apps/tv-android/gradlew` + `app/build.gradle.kts`（compileSdk 35 / minSdk 22 / 4 ABI：armeabi-v7a, arm64-v8a, x86, x86_64 / v1+v2 签名） | gradle 已缓存、NDK/CMake 就位，未执行 |
| 产物内容校验 | `scripts/verify-release-packages.py`（校验引擎/前端与源码一致、Node runtime 架构 PE/ELF/Mach-O、APK/EXE 位架构） | 存在，未执行 |

**既有构建产物（只读清点，未重新生成）**：

- `apps/web-pc/dist/`（`index.html`、`assets/`、favicon）。
- `dist-win/hongguoTV-win32-x64/`、`dist-win/hongguoTV-Windows-x64.zip`。
- `release/`：16 个产物（web 6 平台、desktop 6 EXE、sync 2、TV APK 2）+ `manifest.json` + `SHA256SUMS.txt`；`manifest.json` 生成于 `2026-10-16T03:53:08Z`，`totalFiles=16`。
- `outputs/`：历史构建/测试日志与 staging（`outputs/bundles/`、`outputs/w7-release/` 等）。

> ⚠️ 这些产物**早于当前工作区未提交改动**，不能代表当前代码状态；发布前必须对**确定的代码版本**重建并校验，不能直接采信历史产物。

---

## 6. 能力清单（对齐 RESPONSIBILITIES 第 13 行）

**可用**：
1. 跨端回归执行：`npm test`（178 项）可复现运行；可另写/接入独立集成测试（`tests/`、`scripts/` 归本身份与其他方按文件划分）。
2. 性能对照：`scripts/perf/*.mjs` 与 `scripts/check-*.mjs` 类脚本可运行（只读/测量），可做前后对照。
3. 发布门禁：`release:check`、`smoke`、`verify-release-packages.py` 具备执行条件。
4. 构建打包：web/桌面（vite + electron-builder）、TV APK（gradle 8.11.1 + NDK + CMake）工具链齐备。
5. 产物内容校验：可校验归档内容与源码一致性、Node runtime 与原生二进制架构、APK/EXE 架构与签名。
6. 文件总线：`status/ready/list/show/claim/done/fail` 读写可用。

**明确不做（除非任务显式授权）**：修改原生业务（`apps/tv-android`、`apps/web-pc/electron`）、共享引擎（`shared/content-core`）、前端 React（`apps/web-pc/src`）、后端（`custom-server`、`server`、`apps/sync-server`）；不自行改发布配置；不代表 DSH 做最终验收或发布。

---

## 7. 验证立场（本身份执行准则）

- **HTTP 成功 ≠ 播放成功**：接口 200 只作前置，必须结合真实媒体解出/渲染证据。
- **构建成功 ≠ 运行成功**：APK/EXE 产出只作门禁之一，须有对应代码版本的运行证据。
- **不据历史产物下结论**：产物必须绑定明确的提交/工作区版本。
- 每次任务记录：环境、命令原文、实际输出、样本范围与局限。

---

## 8. 阻塞与局限

| # | 项 | 说明 |
| --- | --- | --- |
| B1 | 无 opencode 任务 | 当前 `ready` 仅 `t-q2-quality-labels`（codex）。本身份待命，不抢领他人任务。 |
| B2 | 工作区脏 | 27 改 + 31 未跟踪。任何构建/回归必须先锁定或记录基线版本，否则结论不可追溯。 |
| B3 | 无独立构建隔离 | 同一工作副本不能并发构建（RESPONSIBILITIES 第 6 条）。需 DSH 指定构建窗口并在 `shared/` 记录占用/释放。 |
| B4 | 设备不可默认占用 | 未分配设备给 opencode；D1/D2/D3/REAL 均属他人。需真机/模拟器验证时由 DSH 明确借用时间与归还。 |
| B5 | 真实播放验证缺设备 | 无设备即无法独立取得「真机播放」证据，需依赖 DSH/Qoder 的设备窗口或他人已采集证据。 |
| B6 | 自动适配器未覆盖本身份 | `adapters.mjs` 仅 codex/antigravity/workbuddy；本身份走**人工文件总线**，不调用 `run`，不假定自动唤醒。team/route/plan 旧映射待 DSH 同步六方。 |
| B7 | 控制台中文编码 | PowerShell 下部分外源输出（如 java）出现乱码；正式证据落盘用 UTF-8 文件而非控制台重定向（参照 `shared/lesson-powershell-encoding.md`）。 |
| B8 | 外网/上游依赖 | `smoke` 与真实播放验证依赖上游可达性；上游封禁/空体（见 device-identity 事故）会使验证不可复现，需在样本与局限中标注。 |

---

## 9. 待命

本身份已完成接入验证。当前**无 assignee=opencode 的 ready 任务**，按规范待命，不自行扩大范围、不改业务代码、不构建、不启停服务。

收到 DSH 派发的、`assignee=opencode` 且依赖已满足的任务后：先检查现有差异与文件唯一写者 → 确认是否已有构建/是否需构建窗口 → 领取 `claim` → 按任务跑验证 → 以 `done` 提交，并在 `.agents/shared/<任务ID>-opencode.md` 写完整证据（环境/命令/结果/样本/局限）。
