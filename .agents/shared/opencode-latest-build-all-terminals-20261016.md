# 最新版全终端构建与兼容测试报告（opencode 直派任务）

- **执行方**: opencode（统一打包与测试 / 产物校验 / 发布门禁）
- **任务来源**: 用户直接指派（"构建最新版进行测试现在拥有的所有终端兼容设备"），结果交 DSH 汇总
- **执行时间**: 2026-10-16 21:5x–22:2x +08:00
- **基线版本**: 分支 `codex/first-github-push-20261013` @ `8f66d2fb4fa295480e8f436e7c7036afbe1dd008`
  - 工作区**脏**：26 修改 + 76 未跟踪（含 apps/web-pc/src、apps/tv-android、custom-server、server、shared/content-core 等）。
  - **本次构建反映当前工作树**（含各方未提交改动），非某个已提交提交；下文所有产物哈希对应该工作树状态。
- **未触碰**: 端口 3000（vite dev）与 8788（既有 Web 服务）为他人在用，未启停；未改业务代码；未回退/清理他人改动；未动 `release/`。

---

## 1. 构建结果

| 目标 | 命令 | 结果 |
| --- | --- | --- |
| Web 类型检查 | `npm run typecheck` | ✅ 通过（无输出） |
| Web 生产构建 | `npm run build`（tsc && vite build） | ✅ 通过，1668 modules，首屏分包与 B8 一致（`index 67.96KB` / `react 134.61KB` / `vendor 73.30KB` + 7 个按需 chunk） |
| 全部便携包 | `node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,linux-x64,linux-arm64,darwin-x64,darwin-arm64 --web-only` | ✅ 生成 **6 个 web 包 + 2 个 sync 包**（见第 4 节） |
| TV APK | `gradlew assembleDebug assembleRelease`（JDK17） | ✅ BUILD SUCCESSFUL（52s）；release 用 `keystore.properties` 签名 |
| 桌面 EXE | `build:desktop`（electron-builder） | ⚠️ **未完成**（见第 6 节阻塞 D1） |

- 说明：`--web-only` 用于跳过 `build-bundles.mjs` 末尾的 Windows 桌面 staging 步骤（该步骤被文件占用阻塞，见第 6 节）。
- Gradle 构建前无并发 Gradle 构建；构建后未遗留占用锁。

---

## 2. 产物与校验和（本次新产物）

### 2.1 Android TV APK

| 文件 | 类型 | 大小 | SHA256 |
| --- | --- | --- | --- |
| `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk` | debug | 8 689 428 B | `A120451FDE66DC75664D9F7935726B4E6211421EC3FEC1E076B0C7F50BD3B52C` |
| `apps/tv-android/app/build/outputs/apk/release/app-release.apk` | release 签名 | 6 905 326 B | `8D59C6D920D2B5F288B8B473EBFBE9E3C86A7926862008F40180B89774E750D7` |

- `aapt` badging：`com.hongguotv.tv` versionCode 1 / versionName **1.0.0** / minSdk **22** / targetSdk 35 / native-code **arm64-v8a, armeabi-v7a, x86, x86_64**。
- `apksigner verify`：release 签名有效，DN `CN=HongguoTV, OU=TV Client, ...`，证书 SHA-256 `c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151`（与 release/README 记录一致）。
- APK 内容：4 个 ABI 的 `libhongguo_quickjs.so`（QuickJS JNI）+ `assets/hongguo.js`（打包的共享引擎）+ `assets/content-api.js` + 5 个 dex。
- debug APK 由 Gradle 判定 **UP-TO-DATE**（输入与当前源一致，产物时间 20:28）；release 为本次新建（22:00）。

> ⚠️ 与 `release/manifest.json`（03:53）对比：旧 debug=`9fe881e7…`(8 561 225B)、旧 release=`3b41438c…`(6 902 274B) —— **本次产物哈希与大小均不同**，证明"最新版"确有代码变化。

### 2.2 Web / Sync 便携包（`outputs/bundles/`）

| 文件 | 大小(MB) | SHA256 |
| --- | --- | --- |
| `hongguotv-web-win-x64.zip` | 32.84 | `E045DDE3C08F8FD92D3185CFADB19DD767C8C0AB7C8111990DF50B6A2C27D7AA` |
| `hongguotv-web-win-arm64.zip` | 28.45 | `CB32223359AB192397093072114588B71FBE9F6194437368AD192B164D8A479C` |
| `hongguotv-web-linux-x64.tar.gz` | 42.67 | `74ADA03BE4326120CDF8918E62A0481DB4C506608B17262A5DEC23B9ED8A0BFE` |
| `hongguotv-web-linux-arm64.tar.gz` | 42.53 | `BA47114CCFD771FFB4CC1B55AF2263F0CC16C6F59090C9272E71DC31D6EE6E9D` |
| `hongguotv-web-darwin-x64.tar.gz` | 37.28 | `98E637A532BEC24901FE783B487EB18B9502C38607719E9C4C257ECC4D628D10` |
| `hongguotv-web-darwin-arm64.tar.gz` | 36.13 | `82B2C30F6ABEA07211E34404CC21811E99862D8B7C2ABE6C69A18C5B3BEDB72E` |
| `hongguotv-sync-linux-x64.tar.gz` | 41.36 | `D42C760430C98FCC383DCD4D6F9D163985B5110CBAED580115A99C31B251A363` |
| `hongguotv-sync-linux-arm64.tar.gz` | 41.22 | `03B78C4AD668CC1317216080E43FAA4F946BFEA97928A0C3B0653F465E203140` |

> 注：zip/tar 内嵌文件时间戳，故同内容重复构建哈希会变；内容一致性由第 3 节校验脚本判定。

### 2.3 产物内容/架构校验（`scripts/verify-release-packages.py`）

```
win-x64 / win-arm64 / darwin-x64 / darwin-arm64 / linux-x64 / linux-arm64
→ engineMatchesSource=true, frontendMatchesSource=true, runtimeArchitecture=true, listenPort=true  (6/6 ✅)
```

- 校验内容：包内 `shared/content-core/hongguo.js`、`custom-server/index.mjs`、`shared/listen-port.mjs` 与源码**逐字节一致**；`apps/web-pc/dist` 前端与源码一致；内置 Node 运行时 PE/ELF/Mach-O 架构正确；`start.sh/stop.sh` 可执行位正确。
- 脚本随后校验 `outputs/w7-release` 的**旧桌面解包产物**时 `AssertionError`（引擎与当前源不一致）——那是 03:53 的陈旧桌面 staging，**非本次 web 包问题**，因本次未重建桌面（见第 6 节）。**web 包 6/6 全绿。**

---

## 3. 终端兼容测试

### 3.1 Android TV 终端（设备动态声明后使用，已释放）

| 设备 | 地址 | API | 安装包 | 启动 | 内容获取 | 真实播放 | 崩溃 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mumu-d1 | 127.0.0.1:16384 | 32 | **release**（签名匹配原位） | ✅ | ✅ | ✅ | 无 |
| mumu-d2 | 127.0.0.1:16416 | 35 | **debug** | ✅ | ✅ | ✅ | 无 |
| mumu-d3 | 127.0.0.1:16448 | 32 | **debug** | ✅ | ✅ | ✅ | 无 |

- 安装：D2/D3 debug `install -r` 成功（保留数据）；D1 原为 release 签名，改用 release APK `install -r` 成功（保留数据）。**debug/release 签名不同，不能互相覆盖**（与 release/README 一致）。
- 实测：三台均启动 `com.hongguotv.tv/.MainActivity`，抓取到**真实短剧画面 + 字幕**（如"她却点了我的穴道"/"这把纯纯高端局"/"我的爸爸"）、推荐流叠层（`@都市宗主 全140集 / 第1集·《都市宗主》`）、"精彩内容加载中…"等，`logcat` **无 App FATAL/ANR**（日志中的 `AndroidRuntime`/SIGSEGV 来自我调用的 uiautomator dump 进程，非 App）。
- 截图证据：`outputs/debug/opencode-compat-20261016/{d1-api32,d2-api35,d3-api32}[-home].png`；UI 层级：同名 `-window.xml`。

### 3.2 Web 终端（浏览器）

两通道均端到端验证：

1. **最新源码模式**：以最新 `custom-server` + 最新 `dist` 起服务（端口 18888，独立数据目录）。首页渲染标题「红果短剧 - 多端客户端」、导航（首页/推荐/分类/榜单/搜索/追剧/设置）、Banner、真实热播列表（38 图）；点击「分类」→ 加载「官方题材全部分类 · 官网当前 24 种题材」，24 个题材标签 + 真实剧集列表（24 图）。
2. **打包产物模式**：用 `outputs/bundles/hongguotv-web-win-x64` 内**自带 Node v22.20.0** 运行 `custom-server/index.mjs`（端口 18900，独立数据目录）→ 浏览器渲染同样完整（真实内容，38 图）。验证了"免环境"便携包可用。
   - 服务端日志确认首页/分类/榜单 API 与分包 chunk（`CategoryPanel-*.js`）正常返回。

**代际限制**：harness 浏览器截图工具需**可见桌面窗口**（本环境不可见），故 Web 证据为 DOM 文本/结构，无像素截图（同 B8 报告限制）。

### 3.3 桌面（Electron）与手机终端

- **未验证**（见第 6 节）：桌面 EXE 未构建成功且无可见 GUI 可运行；手机端无独立工程。
- **真机 API22**：`mumu-r`(192.168.1.120:5555) **offline**，未能连接，**最低 API 兼容未在实机验证**；不得以 API32/35 模拟器替代 API22 结论。

---

## 4. 测试套件（回归）

```powershell
npm test   # node --test tests/*.test.mjs
```

- 本会话连跑 3 次：210 项，分别 **207 / 210 / 209** 通过。
- 唯一稳定复现的抖动项：`tests/playback-p0.test.mjs:42`「cancelling qualities prefetch cannot interrupt a foreground stream sharing video metadata」——**时序敏感**，重跑可通过。**建议 DSH 决定是否将此类列入门禁白名单或加严**。
- 旧 B8 记录的 7 项 `console.log is not a function` 失败本次**未复现**。

---

## 5. 结论

| 终端 | 构建 | 实测 | 结论 |
| --- | --- | --- | --- |
| Web（浏览器） | ✅ | ✅ 源码 + 打包双通道 | **通过** |
| Windows 桌面（Electron） | ❌ 阻塞 | 未运行 | **未验证** |
| Android TV（API32/API35 模拟器） | ✅ | ✅ 3 台真实播放 | **通过** |
| Android TV（API22 实机） | APK 支持 minSdk22 | 设备 offline | **未验证** |
| 手机端 | 无工程 | — | **未验证（无工程）** |

**正式发布由 DSH 决定**。本次仅执行方交付：构建 + 实测 + 产物校验，非最终验收。

---

## 6. 阻塞与需处理事项

| # | 项 | 详情 | 建议归属 |
| --- | --- | --- | --- |
| D1 | **桌面打包被文件占用阻塞** | `dist-win/hongguoTV-win32-x64/resources/default_app.asar` 被某进程独占锁定（进程列表中无 Electron/`hongguoTV.exe`，疑似 Defender/索引器或残留句柄），`Compress-Archive` 失败，未生成桌面 zip；`outputs/w7-release` 旧桌面解包与当前源不一致。且本环境无可见 GUI，桌面 App 无法运行验证。 | DSH 协调：确认占用源 + 指定桌面构建窗口；antigravity（桌面主责） |
| D2 | **手机端无独立工程** | 无目录、无技术栈，opencode 手机打包/测试能力未验证。 | DSH / workbuddy |
| D3 | **API22 真机 offline** | 最低 API 兼容缺实机证据。 | DSH 协调真机恢复 |
| D4 | **时序测试抖动** | `playback-p0.test.mjs:42` 非确定性失败，影响门禁判定。 | DSH 决定门禁策略；测试作者 |
| D5 | **工作区脏** | 构建绑定当前未提交工作树；如需可追溯发布，须先锁定/提交确定版本。 | DSH |

**未做（等明确指令）**：未运行 `release:check`（含 smoke，依赖上游可达）；未运行 `collect-release.mjs`（会清空 `release/`，属发布动作）；未改发布配置/版本号；未推送。

---

## 7. 交付物清单

- 报告：本文件 `.agents/shared/opencode-latest-build-all-terminals-20261016.md`
- 构建日志：`outputs/logs/opencode-tv-build-20261016.log`
- 设备证据：`outputs/debug/opencode-compat-20261016/`（截图 + UI 层级）
- 产物：APK（`apps/tv-android/app/build/outputs/apk/{debug,release}/`）、便携包（`outputs/bundles/`）
- 测试运行：见第 4 节
