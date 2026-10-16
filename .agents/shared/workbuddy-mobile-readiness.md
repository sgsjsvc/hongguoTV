# WorkBuddy 手机端就绪评估（mobile-readiness）

- 身份：workbuddy（主责领域：手机端客户端）
- 时间：2026-10-16 21:35–21:50（GMT+8）
- 依据：`.agents/RESPONSIBILITIES.md`（六领域分工）、`.agents/START_HERE.md` 第 5 条、`.agents/mumu-device-allocation.md`
- 性质：本次接入的**实测能力评估**，非任务交付；不选型、不建工程、不改业务代码。
- 说明：本文件为 `workbuddy-mobile-readiness.md` 首版补充（原不存在），与旧 `workbuddy-ready.md`（历史复核角色记录）并存，均不删除。

---

## 结论摘要

本机（Windows 11 x64）**已具备 Android 手机应用开发与调试的基础工具链**：JDK 21、Android SDK（platform-tools/build-tools/NDK/平台 35）、Gradle 发行版缓存、Flutter 3.44.4 + Dart 3.12.2、MuMu12 模拟器 3 台在线，adb 调试通道实测可用（已按规则声明—使用—释放）。**网络可达 npm/Maven/Google 源**。

但以下关键项均未确定或不可用，在 DSH/用户明确前**不开始任何手机端实现**：

1. **无手机独立工程**：`apps/` 仅 `web-pc`、`tv-android`、`sync-server`（实测确认），无手机专属目录。
2. **技术栈未定**：不自行选择（Flutter/RN/原生/复用 TV 工程均未授权），本报告只列工具链现状。
3. **未运行任何构建**：遵守「不因开新会话自动构建/安装」约束；工具链就绪 ≠ 构建已验证。
4. **iOS 不可行**：Windows 宿主，无 macOS/Xcode；WSL 被本机安全策略禁用。是否包含 iOS 需 DSH/用户决策，不自动假定。
5. **无 API 22 真机**：`mumu-r`（192.168.1.120:5555，API 22）当前离线；三台在线模拟器为 x86_64（API 32/32/35），无法覆盖 ARM 原生行为与低版本兼容。

---

## 一、实测方法与命令（本次实际执行）

| # | 命令 | 目的 |
| - | --- | --- |
| 1 | `node --version` / `npm --version` / `python --version` / `git --version` | 运行时版本 |
| 2 | `java -version` / `javac -version` | JDK 可用性 |
| 3 | `ls $LOCALAPPDATA/Android/Sdk/{platforms,build-tools,ndk,platform-tools}` | SDK 组件 |
| 4 | `adb --version` / `adb devices -l`（`ANDROID_ADB_SERVER_PORT=15037`） | 调试桥与设备 |
| 5 | `gradle-wrapper.properties` + `ls ~/.gradle/wrapper/dists` | Gradle 基线 |
| 6 | `dart --version` / `flutter --version` / `ls ~/.pub-cache` | Flutter/Dart 状态 |
| 7 | `ls apps/` | 确认无手机工程 |
| 8 | `curl -sI --max-time 8 <registry hosts>` | 网络可达性 |
| 9 | `mumu declare mumu-d1 workbuddy` → `adb -s ... shell getprop/wm size` → `mumu release mumu-d1 workbuddy` | 调试通道实测 |
| 10 | `node .agents/cli.mjs doctor` | 各 agent 可用性探测 |
| 11 | 工作区临时文件写入/删除 | 目录写权限 |

完整输出摘录见第五节；本报告所有结论按【实测】【代码级】【未实测】标注。

---

## 二、主机与运行时【实测】

| 项 | 实测值 |
| - | --- |
| OS | Microsoft Windows 10.0.26200.9711（x64/AMD64） |
| 磁盘 | F: 932G 总量 / 462G 可用（51% 已用） |
| Node（PATH，managed） | v22.22.2；npm 10.9.7 |
| Node（system） | v22.20.0（nvm） |
| Python（managed / system） | 3.13.14 / 3.9.7 |
| Git | 2.55.0.windows.3（PortableGit） |
| 工作区写权限 | 实测 OK（根目录建/删临时文件成功） |
| 已知环境陷阱 | 本机 shell 注入 `ELECTRON_RUN_AS_NODE=1`，直接运行 `electron.exe` 会退化为纯 Node（与手机无关，但影响本机 Electron 类操作） |
| WSL | **被安全策略禁用**（`wsl.exe` 在程序黑名单，沙箱拒绝启动） |

## 三、Android 工具链【实测】

| 组件 | 状态 | 实测值 / 路径 |
| - | --- | --- |
| JDK | ✅ 可用 | Oracle/OpenJDK **21.0.9**（`java`、`javac` 均在 PATH；`JAVA_HOME` 未设置） |
| Android SDK（用户级） | ✅ 存在 | `%LOCALAPPDATA%\Android\Sdk`：platform-tools、platforms、build-tools、ndk、licenses |
| Android SDK（G 盘第二份） | ✅ 存在 | `G:\_sofetwar\androdsdk`（TV 工程 `local.properties` 指向，含 cmake 3.22.1 与 NDK 28.2.13676358） |
| adb | ✅ | Android Debug Bridge 1.0.41 / 37.0.1；项目统一端口 `ANDROID_ADB_SERVER_PORT=15037` |
| SDK 平台 | ⚠️ 仅 android-35 | `platforms/android-35`；其他 API 平台需按需安装 |
| build-tools | ✅ | 34.0.0、35.0.0 |
| NDK | ✅ | 28.2.13676358（与 TV 工程 `ndk.dir` 一致） |
| Gradle | ✅ 发行版已缓存 | wrapper 8.11.1（TV 工程）；`~/.gradle/wrapper/dists` 有 8.11.1 / 8.14.3 / 9.1.0 / 9.4.1 / 9.7.1 |
| AGP / Kotlin（既有工程实证） | 【代码级】 | TV 工程 AGP 8.9.2 + Kotlin 2.1.20，证明本机跑过 Android Gradle 构建 |
| cmdline-tools / sdkmanager | ❌ 未安装 | 无法用 sdkmanager 装平台/组件，可后补 |
| Android Studio / AVD | ❌ 未安装 | 无 IDE；模拟器由 MuMu 提供 |
| scrcpy | ❌ 未安装 | 无投屏控制工具 |
| Kotlin 独立编译器 | ❌ 不在 PATH（Gradle 插件自带，不影响工程构建） | — |

## 四、跨端/移动框架【实测】

| 框架 | 状态 | 实测值 |
| - | --- | --- |
| Flutter | ✅ SDK 存在且 Dart 已引导 | `D:\flutter`，**Flutter 3.44.4 stable**（revision ad70ec4617，2026-06-24），Dart 3.12.2，DevTools 2.57.0 |
| Flutter 工程经验 | ⚠️ 无 | `~/.pub-cache` 为空——本机**从未构建过 Flutter 工程**（能跑 ≠ 跑过） |
| React Native CLI | ❌ 未安装 | `react-native: no` |
| Cordova | ❌ 未安装 | — |
| CocoaPods | ❌ 无（Windows 无 iOS 工具链） | — |

> 纪律声明：列出 Flutter ≠ 选定 Flutter。技术栈由 DSH/用户确定后我再按任务执行。

## 五、设备与调试通道【实测】

| 设备 | 地址 | API | 状态（实测） |
| - | --- | --- | --- |
| mumu-d1 | 127.0.0.1:16384 | 32 | 在线（Android 12，x86_64，720x1280 物理 + 1280x720 覆盖分辨率） |
| mumu-d2 | 127.0.0.1:16416 | 35 | 在线 |
| mumu-d3 | 127.0.0.1:16448 | 32 | 在线 |
| mumu-r | 192.168.1.120:5555 | 22 | **offline**（API 22 真机，恢复时间未知） |

- **调试通道实测通过**：按 `mumu-device-allocation.md` 流程声明 `mumu-d1`（workbuddy，用途 mobile-readiness-probe）→ `adb -s 127.0.0.1:16384 shell getprop/wm size` 正常返回 → 立即释放，`mumu list` 复核为空闲。全程未安装应用、未改设备设置（覆盖分辨率是既有状态，非本次设置）。
- 模拟器均为 **x86_64**：ARM 库行为、真实 GPU/解码性能不能覆盖；手机端验收建议保留实机环节（当前无可用手机真机）。
- 设备互斥规则已知悉：同一工作副本一次 Android Gradle 构建；设备声明与构建互斥是两件独立的事。

## 六、网络与依赖源【实测】

| 主机 | 结果 | 说明 |
| - | --- | --- |
| registry.npmjs.org | 200（经代理 CONNECT） | npm 可用 |
| repo1.maven.org/maven2 | 200 | Maven Central 可用 |
| dl.google.com | 200 | Google 源可用 |
| storage.googleapis.com | 200 | Flutter 官方制品源可用 |
| storage.flutter-dev.cn | **502** | Flutter 国内镜像不可用（用官方源时需注意） |

## 七、构建能力评估

- **具备**：JDK + SDK + NDK + Gradle 缓存 + AGP/Kotlin 实证 + Flutter SDK——手机端 Android 工程（无论最终选型）具备**动起来**的本机基础。
- **未验证**：本次**没有运行任何构建/安装**（接入纪律约束）。构建互斥、gradle 守护进程冲突风险已在 `RESPONSIBILITIES.md` 边界 7 与旧报告中记录；真正构建前需检查进程并写占用记录。
- **缺失补位项**：sdkmanager（cmdline-tools）、Android Studio（可选）、scrcpy（可选投屏）、iOS 工具链（不可补，Windows 宿主）。

## 八、阻塞与待决（交 DSH/用户）

| # | 事项 | 状态 |
| - | --- | --- |
| 1 | 手机端平台范围：仅 Android 还是含 iOS？iOS 在 Windows 宿主不可行 | **待决策**，不自动假定含 iOS |
| 2 | 技术栈与手机专属目录：Flutter / RN / 原生 / 复用 TV 工程改造？ | **待决策**，不自行选型、不创建工程、**不把 TV 改为手机版** |
| 3 | 开发/验收真机：当前无在线手机真机，仅 x86_64 模拟器 | 待 DSH 安排设备窗口 |
| 4 | API 22 真机（mumu-r）offline | 与 TV 兼容验收相关，恢复时间未知 |
| 5 | 签名/发布配置（手机端 keystore、应用标识） | 未开始，归 OpenCode 打包范畴前需明确 |

## 九、下一步（等明确指令后执行）

1. DSH/用户确定平台与技术栈 → 明确手机专属目录与任务 brief（含 assignee=workbuddy、文件范围、验收条件、复核者）。
2. 按 `RESPONSIBILITIES.md` 边界 9 流程领取：读职责 → 读 brief → 核对 assignee/ready/文件冲突 → claim。
3. 首项任务若涉及构建：先检查 Gradle/打包进程并写占用记录，遵守构建互斥；设备先声明后使用、用完释放。
4. 若需补工具链（sdkmanager 等）：按任务授权执行，不擅自安装。

---

*评估人：workbuddy。所有「实测」结论来自 2026-10-16 21:35–21:50 本会话真实命令；未见、未试的一律标注未验证。*
