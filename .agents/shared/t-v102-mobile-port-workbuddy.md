# T4 手机端（仅 Android）基于 Web 代码移植可行性验证 —— 第一段报告

- **任务**：`t-v102-mobile-port`（assignee=workbuddy，claimed 2026-10-17 00:15，认领前已重读 23:00 版 `RESPONSIBILITIES.md`）
- **性质**：第一段可行性验证。**未创建手机工程、未写 `apps/web-pc/**`、未复制共享引擎、未构建/发布手机产物、未提交推送、未占用任何设备**
- **配套文件**：本机能力基线见 `.agents/shared/workbuddy-mobile-readiness.md`（2026-10-16 21:35 实测）

---

## 一、结论摘要（先回答核心问题）

**问：能否只「复制 Web 代码」而无需重写界面？**
**答：可以复用绝大部分代码（估计 ≥70% 直接沿用），但不能零适配直接运行。** 界面、状态层、播放链路、轮询同步全部是标准 Web 技术（React 18 + axios + Tailwind + 原生 `<video>` 直链），WebView 容器（Capacitor / Cordova）可直接承载；但存在 **11 项必须适配点**（第四节），集中在后端基址解析、触控交互、HTML5 全屏的原生依赖、自动播放策略、横竖屏布局、HEVC 真机解码。

**最低 API 建议：minSdk 24（Android 7.0）**，即 Capacitor 8 的默认值。**不建议沿用 API 22**（第五节给出证据）。

**工具链结论：本机具备第二段落地的全部基础条件**——Capacitor 8.5.3 与 Cordova 13/cordova-android 15 均实测安装成功且 CLI 可运行；JDK 21、Android SDK/NDK、Gradle 发行版缓存齐备；npm/Maven/Google 源可达。

---

## 二、工具链实测（真实命令 + 原始输出）

### 2.1 registry 元数据（实测）

```text
$ npm view @capacitor/core version dist-tags
version = '8.5.3'
dist-tags = { latest: '8.5.3', latest-6: '6.2.2', latest-7: '7.6.9', next: '9.0.0-alpha.8', ... }

$ npm view @capacitor/android version engines   → 8.5.3
$ npm view @capacitor/android peerDependencies  → { '@capacitor/core': '^8.5.0' }
$ npm view cordova-android version engines
version = '15.1.0'
engines = { node: '>=20.17.0 || >=22.9.0' }
```

### 2.2 临时目录安装实测（工作区外，未碰项目）

```text
$ PROBE_DIR=$(mktemp -d -t wb-mobile-probe-XXXX)   → C:\Users\AnLin\AppData\Local\Temp\wb-mobile-probe-EuqH
$ npm install @capacitor/core @capacitor/android @capacitor/cli --no-audit --no-fund
added 98 packages in 5s
$ npm install cordova cordova-android
added 193 packages in 9s
$ node -e "require(...)"  → @capacitor/core 8.5.3 / @capacitor/android 8.5.3 / @capacitor/cli 8.5.3 / cordova 13.0.0 / cordova-android 15.1.0
$ ./node_modules/.bin/cap --version       → 8.5.3
$ ./node_modules/.bin/cordova --version   → 13.0.0
```

**结论：Capacitor 与 Cordova 两路线在本机（Node v22.22.2 / npm 10.9.7）均可安装、CLI 可运行。**

### 2.3 最低 API（minSdk）实测证据

| 包 | 证据（安装后实读） | minSdk |
| - | --- | --- |
| `@capacitor/android` **8.5.3** | `capacitor/build.gradle:46`：`minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24` | **默认 24** |
| `@capacitor/android` **6.2.2** | 同文件同行为，默认值 **22**（npm pack + 解压实读） | 22（旧版分支，latest-6 止于 6.2.2） |
| `cordova-android` **15.1.0** | `templates/project/app/build.gradle:196`：`minSdkVersion cordovaConfig.MIN_SDK_VERSION`（偏好项可配，默认值未在包内找到硬编码，第二阶段建工程时实测） | 可配置 |

### 2.4 本机既有条件（引自 10-16 实测，未重复验证）

- JDK 21.0.9；Android SDK（用户级 + `G:\_sofetwar\androdsdk`，NDK 28.2.13676358，仅 android-35 平台，build-tools 34/35）
- Gradle 发行版缓存 5 版（8.11.1/8.14.3/9.1.0/9.4.1/9.7.1）；TV 工程实证 AGP 8.9.2 + Kotlin 2.1.20 跑通过
- Flutter 3.44.4 + Dart 3.12.2 在（本任务不走 Flutter，备查）
- 网络：npm registry / Maven Central / dl.google.com / storage.googleapis.com 可达；**storage.flutter-dev.cn 502**（国内 Flutter 镜像不可用，不影响本任务）
- 设备：MuMu12 三台在线（API 32×2、API 35×1，均 x86_64）；**mumu-r（唯一 API 22 真机）offline**；本任务未使用设备（`mumu list` 全空闲）
- 限制：WSL 被本机安全策略禁用；无 Android Studio / sdkmanager / scrcpy（均不影响 WebView 路线）

---

## 三、Web 代码复用性分析（代码级，2026-10-17 实读 apps/web-pc/src）

**技术栈**：React 18.3.1 + Vite 6 + TS 5.7 + Tailwind 3.4 + axios 1.7；`base: "./"`；`dist/` 已存在（index.html + assets）；`index.html` viewport 已是移动端写法（`width=device-width, initial-scale=1.0`）。

| 维度 | 现状（证据） | 可复用性 |
| - | - | --- |
| 界面/组件层 | 10 个组件 + 6 个 hooks，纯 React/Tailwind | ✅ 直接复制 |
| 播放内核 | 原生 `<video>` + 直链 URL（`/api/episodes/{id}/stream`），**无 HLS/MSE/播放器库**（grep hls/m3u8/MediaSource 均无命中） | ✅ 复制；WebView 直接走平台媒体栈 |
| 共享引擎 | src 仅 2 处经 `@shared` 别名引用（`legacy-migration.mjs`、`utils`）；引擎/推荐核心/同步协议在 custom-server 侧 | ✅ 副本保留别名指向 `shared/`，**不复制**（符合边界 2） |
| 本地存储 | `localStorage` + 服务端 SQLite（`/api/library` 10s 轮询 + 事件队列 outbox） | ✅ WebView 原生支持 localStorage |
| 桌面桥 | Electron 桥 `window.hongguotvDesktop` 全部有 `?.isDesktop` 守卫（App.tsx:410-418、useKeyboardShortcuts:52-60、RecommendStream:171-173/196-197/247-248） | ✅ 移动端缺失时自动走 DOM API 分支 |
| 已有触控 | RecommendStream 进度条 `onTouchStart/onTouchEnd`（:799/:822）；`onWheel` 滚轮切流（:269-280） | ⚠️ 部分：进度条可拖动；**切流/频道切换无手势** |
| 后端基址 | `api.ts:31`、`api.ts:213`：`window.location.protocol === "file:"` 时才取 `getSettings().baseUrl`（默认 `http://127.0.0.1:8788`），否则相对路径同源 | ❌ **Capacitor 默认非 file: 方案**（本地虚拟主机加载），该分支不命中 → 相对路径打到容器本地（见适配 #1） |
| 键盘/遥控 | 空格/F/M/N/P/方向键/上下切集/音量（useKeyboardShortcuts.ts 全量） | ❌ 手机无键盘（见适配 #3） |
| 自动播放 | 多处 `video.play().catch(() => {})`（PlayerModal:173、usePlayback:107/161/207 等） | ⚠️ 移动端自动播放限制 + 静默吞错（见适配 #5） |
| baseUrl 设置 | SettingsPanel **无 baseUrl 入口**（grep 无命中） | ❌ 手机端需要后端地址配置 UI（适配 #1 的配套） |

---

## 四、必须适配项清单（在 `apps/mobile` 副本中改，不动 `apps/web-pc`）

| # | 适配项 | 现状证据 | 方案（第二阶段） | 级别 |
| - | - | --- | --- | --- |
| 1 | **后端基址解析** | `api.ts:31/213` `file:` 分支在 Capacitor 容器不命中 | 副本内改为 Capacitor 检测 + 显式 `backendBaseUrl`（先读 settings，无则引导用户输入局域网 IP:端口）；axios baseURL 与视频直链同源处理 | 必须 |
| 2 | **明文 HTTP 许可** | 后端为 LAN `http://` | Capacitor `server.cleartext` / network security config 允许 http | 必须 |
| 3 | **触控手势** | 键盘+滚轮驱动交互 | 加手势：单击显隐控制栏、左右滑动 seek、上下/双击音量、竖向滑动切流、双击快进 | 必须 |
| 4 | **HTML5 全屏** | `container.requestFullscreen()`（RecommendStream:212-215、App:402-408） | Android WebView 需宿主 `WebChromeClient.onShowCustomView` 支持；Capacitor 默认支持程度第二阶段实测，必要时用自定义桥/插件 | 必须（spike 优先） |
| 5 | **自动播放策略** | `video.play().catch(()=>{})` 静默失败 | 确保从用户手势链路进入；推荐流首屏静音自动播放 + 失败可见提示（去掉裸 catch） | 必须 |
| 6 | **横竖屏布局** | 桌面优先（`h-screen w-screen`、`md:` 断点、播放器弹窗） | 竖屏浏览布局重排；播放强制横屏 + 锁定策略 | 必须 |
| 7 | **生命周期/后台** | 已有 `pagehide`/`visibilitychange` 进度快照（App:286-296） | 补：后台音频焦点、回前台恢复、MediaSession 锁屏控制（增强项） | 建议 |
| 8 | **HEVC 真机解码** | 上游全部清晰度为 HEVC（项目既有结论，ByteVC1） | WebView 走平台 MediaCodec，硬件 HEVC 随机型而异；需真机矩阵验证，失败则回退软解或走 TV 的 JNI 路线（DSH 决策） | 必须（验收前） |
| 9 | **构建入口** | vite `tsc && vite build` 产物 `dist/` | `apps/mobile` 复制 web 构建配置（去 electron/electron-builder 依赖），Capacitor `webDir=dist`；保留 `@shared` 别名 | 必须 |
| 10 | **应用外壳** | — | Capacitor 工程：应用 ID、图标、启动屏、版本号（与 v1.0.2 版本策略对齐，归 opencode 打包范畴） | 必须 |
| 11 | **权限** | `online/offline` 监听已存在（api.ts:119-126） | `android.permission.INTERNET`；WiFi 状态用于引导连后端 | 必须 |

---

## 五、最低 API 建议与 API 22 评估

**建议：minSdk = 24（Android 7.0）**，理由：

1. Capacitor 8（当前最新，长期维护线）默认 minSdk **24**（实测 `capacitor/build.gradle:46`）；
2. 覆盖 Android 7.0+ 机型，与现代 WebView 内核生命周期匹配。

**不建议沿用 API 22**（虽然 TV 端为 API 22）：

1. 工具链侧：Capacitor 8 默认门槛是 24；要 22 只能降到 Capacitor 6.2.2（旧版分支，已非 latest）或 Cordova 定制；
2. **内核侧（决定性）**：API 22 设备的 WebView 内核陈旧且早已停止 Chromium 更新——当前 Chrome/WebView 官方系统要求为 **Android 10+**（2026-10-16 实测抓取 Wikipedia 信息框）；本前端是 Vite 6/React 18 面向现代浏览器的产物，在旧内核上的兼容性无保证；「最后一个支持 Android 5.x 的 WebView 版本号」未检索到权威来源，如实标注**【未核实】**，不作结论依据；
3. 验证侧：无 API 22 设备可实测（`mumu-r` offline，在线模拟器最高 API 35）；
4. 备选路线：若产品强制覆盖 API 22，WebView 路线不合适，应评估复用 TV 端原生工程（JNI/QuickJS 宿主）——**需 DSH 决策并指定原生模块唯一写者，超出本任务范围**。

---

## 六、第二阶段建议（待 DSH 明确放行后执行）

1. 建 `apps/mobile/`：Capacitor 8 路线；复制 `apps/web-pc/src` + `vite.config.ts` + `tsconfig` + 精简 `package.json`（剔除 electron/electron-builder）；
2. `npx cap add android`（minSdk 24）→ 跑通冒烟：首页 → 分类/榜单 → 详情 → 播放 → 清晰度切换 → 连播 → 历史同步；
3. 优先 spike 两项高风险：**HTML5 全屏在 Capacitor WebView 的行为**（适配 #4）、**HEVC 在目标机型的硬解**（适配 #8）；
4. 后端部署形态先行方案：手机与 PC 同局域网访问 `custom-server`（Wi-Fi），设置页输入地址；「WebView + 本地 Node 服务」不在本阶段范围；
5. 设备与构建：按 `mumu-device-allocation.md` 声明设备；遵守 Gradle 构建互斥并写占用记录；
6. 打包入库归 opencode（本任务不产出发布物，v1.0.2 不含手机端）。

---

## 七、未实测与风险（如实标注）

| 项 | 状态 |
| - | --- |
| Capacitor 实际建 Android 工程、编译 APK | **未实测**（第二阶段，遵守「不擅自创建工程」） |
| HTML5 全屏 API 在 Capacitor WebView 的行为 | **未实测** |
| HEVC 在真实手机的解码表现 | **未实测**（无手机真机；模拟器 x86_64 无 HEVC 硬解） |
| API 22 WebView 行为 | **未实测**（无设备；给出不沿用 22 的建议） |
| cordova-android 默认 minSdk 数值 | **未实测**（包内无硬编码默认值） |
| Capacitor Android 加载方案具体 scheme（http/https localhost） | **未实测**（版本相关，第二阶段确认；已按「非 file:」做适配设计） |
| 最后一版支持 Android 5.x 的 WebView 版本号 | **未核实**（未检索到权威来源，不作为结论依据） |
| 「≥70% 代码直接沿用」 | 为代码级审查的判断比例，非精确测量 |

---

## 八、边界遵守声明

- 未创建 `apps/mobile/` 或任何工程目录；未写入/修改 `apps/web-pc/**`；未复制 `shared/` 引擎/推荐核心/同步协议；
- 未构建、未安装、未发布任何产物；未提交、未推送；未占用设备（`mumu list` 全程空闲）；未改他人任务与锁；
- Capacitor/Cordova 实测安装在工作区外临时目录（`%TEMP%\wb-mobile-probe-EuqH`），报告完成后已清理；
- 本报告为第一段交付；第二阶段是否开始，**等 DSH 复核本报告后明确放行**。

---

*报告人：workbuddy。所有「实测」来自 2026-10-16 深夜至 2026-10-17 凌晨本会话真实命令与文件实读；「代码级」为源码审查；「未实测/未核实」已逐项标注。*
