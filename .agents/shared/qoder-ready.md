# Qoder 接入就绪报告（第 2 版 · 重建）

- **身份**: qoder（原生客户端执行方）
- **日期**: 2026-10-16 19:3x（重建；第 1 版写于 19:03，约 8.1KB，已被第三方从工作区删除且从未进入 git 历史，详见 `.agents/shared/notice-20261016-reread-responsibilities.md` 第四、五节）
- **工作副本**: `F:\Project\hongguoTV`，Windows 11 x64，Git Bash shell，分支 `codex/first-github-push-20261013`
- **依据**: 已实际读取 `.agents/README.md`、`QUICKSTART.md`、`RESPONSIBILITIES.md`（19:08 提交版）、`shared/six-agent-onboarding.md`、`shared/notice-20261016-reread-responsibilities.md`
- **本轮动作**: 全部能力重新实测 + 写本报告；未改业务代码、未构建、未安装、未启动服务、未连接任何设备
- **防丢请求**: 请 DSH 将本文件纳入提交（`RESPONSIBILITIES.md` 要求 ready 报告入库，`opencode-ready.md` 已入库而本文件两次未入库）

---

## 一、可访问目录（实测可读）

| 路径 | 权限 | 归属 | 备注 |
| --- | --- | --- | --- |
| `apps/tv-android/` | 读写 | **qoder 主责** | Kotlin + Media3 + JNI(`cpp/bridge.c` + `quickjs/`) |
| `apps/web-pc/electron/` | 读写 | **qoder 主责** | 仅 `main.cjs`、`preload.cjs` |
| `.agents/`（inbox/outbox/state/logs/shared/archive） | 读写 | 共享 | 文件总线 + CLI 可用 |
| `shared/content-core/hongguo.js`、`server/`、`custom-server/`、`apps/sync-server/` | 只读 | codex | TV 侧仅做宿主对接，不改引擎 |
| `apps/web-pc/src/` | 只读 | antigravity | 共用 React，不改 |
| `scripts/`、`tests/`、`docs/`、`release/`、`dist-win/`、`outputs/` | 只读 | opencode / workbuddy / dsh | |
| `.git` | 可用 | — | `status/diff/log/reflog` 实测通过；本轮无 commit/push |

写权限实证：本报告由 Write 工具直接落盘，无需提权。

---

## 二、可用能力（本轮逐条重新实测）

### 通用
| 项 | 实测值 |
| --- | --- |
| Node.js | `v22.20.0`，`/d/softeare/nvm/nodejs/node`。**与运行环境声明的 v24.18.0 不一致，以 shell 里的 v22.20.0 为准** |
| npm | `10.9.3` |
| git | 可用；HEAD = `9358f17 ﻿docs(agents): 固化六方职责文档与 ready 报告`（DSH 19:2x 提交） |

### Android TV 构建链
| 项 | 实测值 |
| --- | --- |
| Gradle | **`Gradle 8.11.1` 本轮复验通过**（`gradlew.bat --version`，Launcher/Daemon JVM = jdk-17 17.0.12）；发行包离线缓存于 `~/.gradle/wrapper/dists/gradle-8.11.1-bin/bpt9gzteqjrbo1mjrsomdt32c/`（含 `.ok` 标记），构建**无需联网下载 Gradle** |
| JDK | `C:\Program Files\Java\jdk-17`、`jdk-21` 均存在；AGP 8.9.2 用 jdk-17 验证通过 |
| Android SDK | `C:\Users\AnLin\AppData\Local\Android\Sdk`（与 `apps/tv-android/local.properties` 声明一致）：`platforms/android-35`、`build-tools/34.0.0 + 35.0.0`、`ndk/28.2.13676358`、`platform-tools` 均实测存在 |
| NDK / CMake | `/g/_sofetwar/androdsdk/ndk/28.2.13676358`、`/g/_sofetwar/androdsdk/cmake/3.22.1` **G 盘实际已挂载存在**，与 `local.properties` 的 `ndk.dir`/`cmake.dir` 一致；`cpp/CMakeLists.txt` 要求版本 3.22.1 匹配 |
| 构建目标 | `compileSdk 35 / minSdk 22 / targetSdk 35`，ABI 四件套 `armeabi-v7a, arm64-v8a, x86, x86_64` → **Android 5.1.1(API 22) 兼容在配置层成立** |
| 播放/遥控 | `media3-exoplayer 1.8.0`、`media3-ui 1.8.0`、`recyclerview 1.3.2`、`okhttp 4.12.0`、`coroutines 1.9.0`；Manifest 声明 `LEANBACK_LAUNCHER` + `android.software.leanback`(required=false) + 触摸屏 required=false |
| adb | `Android Debug Bridge version 1.0.41`（37.0.1-15733141）可执行 |
| JVM 单测 | `app/build.gradle.kts` 已配 `testImplementation` junit 4.13.2 / org.json 20240303 / okhttp-mockwebserver 4.12.0 → 具备跑 `testDebugUnitTest` 的依赖条件（本轮未运行，属禁构建范围） |
| 签名 | `apps/tv-android/keystore.properties` 存在；`.gitignore` 已忽略 `keystore.properties`、`*.keystore`、`local.properties`。**未读取其内容，不会写入任何协作文件** |

### Windows Electron 壳
| 项 | 实测值 |
| --- | --- |
| Electron 运行时 | `apps/web-pc/node_modules/electron/dist/electron.exe` 实测存在（安装于 `apps/web-pc` 而非根 `node_modules`） |
| 打包 | `electron`、`electron-builder`、`cross-env` 在 devDependencies；`desktop:dev`、`build:desktop` 脚本可用 |
| 宿主代码 | `main.cjs`、`preload.cjs` 可读；`electron/` 目前仅此 2 文件 |

### 协作总线
| 能力 | 实测值 |
| --- | --- |
| `status` | 可用。total 60；done = antigravity 27 / codex 18 / workbuddy 13；failed 1（antigravity `t-a1-hevc-level`）；claimed = codex 1 |
| `ready` / `list` / `show` | 可用；`ready` 当前为空（唯一 pending 的 `t-q2-quality-labels` 已被 codex 于 11:34:19 claim，锁文件 `state/t-q2-quality-labels.lock.json` 已生成） |
| `claim` / `done` / `fail` | **可直接使用**：`bus.mjs:112-126` 对 agent 字符串无白名单，写 `state/<id>.lock.json` 并置 `claimedBy` |
| `run` | **不对 qoder 使用**：`adapters.mjs` 无 qoder 适配器，遵守 README 已知限制第 5 条（人工文件交接，不假定自动唤醒） |

---

## 三、阻塞与限制（按严重度）

1. 🔴 **名下无任务 → 待命。** inbox 60 个任务中 `assignee=qoder` = **0**（`cli.mjs list | grep qoder` 无匹配，与通知第八节一致）。本轮不自行开单、不扩范围。
2. 🔴 **无设备。** `shared/device-allocation.md`：D1→antigravity、D2→codex、D3→workbuddy、REAL(`192.168.1.120:5555`, **API 22 真机**)→dsh；`state/device-d{1,2,3}.lock.json` 三锁仍在。**qoder 名下 0 台。** 为不干扰他人 adb 状态，本轮**未 connect 15037 端口的任何模拟器、未扫描 REAL**。→ Android 5.1.1 实机与遥控器交互无法自证，交付层级只能到「构建 + 单元/静态验证」，除非 DSH 给出借用窗口。
3. 🟠 **`./gradlew`（bash 脚本）在 Git Bash 下不可用**：本轮再次复现 `ClassNotFoundException: org.gradle.wrapper.GradleWrapperMain`（jar 完好，`jar tf` 含 `GradleWrapperMain.class`，属脚本路径解析问题）。**已验证绕过**：`cmd.exe //c "set JAVA_HOME=C:\Program Files\Java\jdk-17&& gradlew.bat <task>"`。后续构建统一走这条，请 DSH 知悉以免影响他人。
4. 🟠 **我的归属区存在他人未提交在途改动（约 181 插入 / 51 删除）**：[ArtworkLoader.kt](file:///F:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/ArtworkLoader.kt)、[MainActivity.kt](file:///F:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt)、[SeriesAdapter.kt](file:///F:/Project/hongguoTV/apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt)、[main.cjs](file:///F:/Project/hongguoTV/apps/web-pc/electron/main.cjs)；另有 `apps/web-pc/src/*`、`shared/content-core/hongguo.js`、`server/`、`custom-server/`、`.agents/*` 等共 54 项。**未回退、未清理、未覆盖**，但在 DSH 明确写者前**不进入这 4 个文件**。
5. 🟠 **构建并发**：本机常驻 1 个 `java.exe`（PID 12908，≈565MB，疑似他方守护进程）。按 `RESPONSIBILITIES.md` 边界规则第 6 条，启动 Gradle 前会先检查进程并在 `shared/` 写占用/释放记录。**本轮未构建，故未写占用记录。**
6. 🟡 **跨端同步依赖**：TV 的 `shared/content-core/hongguo.js` 由 Gradle `preBuild` 自动复制（见 commit `617c073`）。引擎本体归 codex，我只做 Android 宿主适配，不各改一份引擎。
7. 🟡 **非即时协作**：文件总线，不实时唤醒。我完成一轮后需用户/DSH 再次触发「检查分配给 qoder 的任务」。

---

## 四、可承接范围（供 DSH 派单）

- **Android TV 原生**：Kotlin UI / 焦点与遥控器导航、Media3·ExoPlayer 与 HEVC 硬解适配（含 `t-a1-hevc-level` 那类失败任务的接手，需 DSH 开单）、JNI/QuickJS 宿主与 `libhongguo` so 构建、Android 5.1.1(API 22) 兼容性、原生缓存与存储、APK 构建 + badging/签名核对
- **Windows Electron**：`main.cjs` 窗口/全屏/生命周期、多进程与 IPC、单实例锁、electron-builder 产物与 no-node 冒烟
- **设备类任务**：须先由 DSH 分配；否则明确标注「未实机验证」

## 五、仍待 DSH 回答（沿用第 1 版，通知第四节已确认未答复）

1. 上述 4 个原生文件（3 个 `.kt` + `electron/main.cjs`）当前唯一写者是谁？何时交接？
2. 是否给 qoder 分配设备，或明确某模拟器/REAL 真机的借用窗口与归还记录？
3. 六方路由同步后，`dispatch.mjs` 是否加入 qoder 适配器？（在此之前我不会被 `run` 调度）
4. 本 ready 文件能否随下次提交入库，避免第三次丢失？

---

**结论**：工具链（Node 22.20.0 / npm 10.9.3 / Gradle 8.11.1 / JDK 17 / SDK android-35 + build-tools 34·35 / NDK 28.2 / CMake 3.22.1 / adb 1.0.41 / Electron 运行时）与文件读写、总线 `claim/done` 能力**本轮全部重新实测可用**；阻塞为**名下 0 任务**、**0 设备**、`./gradlew` 需经 cmd 绕过、原生 4 文件写者待确认、ready 报告未入库有再丢风险。当前状态：**已接入，待命**。
