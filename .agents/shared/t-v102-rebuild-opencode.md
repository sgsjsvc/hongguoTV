# T3 v1.0.2 全终端产物重建 + 产物校验 + 桌面运行时验证 — opencode 交付报告

- **任务ID**: `t-v102-rebuild`（assignee `opencode`）
- **领取**: `node .agents/cli.mjs claim t-v102-rebuild opencode` → `status=claimed`，`claimedAt=2026-10-16T16:13:27.376Z`，锁 `.agents/state/t-v102-rebuild.lock.json`
- **执行**: 2026-10-17 00:13–01:0x（GMT+8）
- **分支 / HEAD**: `codex/first-github-push-20261013` / **`3d7b0de`**（业务冻结 `a623f8a` 的后代）
- **证据目录**: `outputs/testing/v102-rebuild/`（每步原始日志）
- **未提交、未推送、未打 tag、未发布**（由 DSH 统一提交）

## 一、基线核对（开工前）

| 项 | 结果 |
| --- | --- |
| `git rev-parse HEAD` | `3d7b0de484c3cc6e75d4ffd65b1ade67d8697385` |
| `a623f8a` 是 HEAD 祖先 | **True** |
| `a623f8a..HEAD` 非 `.agents` 改动 | **仅 3 个版本文件**：`apps/tv-android/app/build.gradle.kts`、`apps/web-pc/package.json`、`apps/web-pc/package-lock.json`（T1/T2 版本号统一）→ 业务代码与 `a623f8a` 逐字节一致 |
| 工作区 | 干净（仅他方 `t-v102-mobile-port` 的 `.agents/` 在途改动，未触碰） |

**不变量（实测，当前工作树）**

| 文件 | SHA256 | 期望 | 一致 |
| --- | --- | --- | --- |
| `custom-server/index.mjs`（入口） | `b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333` | `b2dbaea0…` | ✅ |
| `shared/content-core/hongguo.js` | `cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2` | `cf3d685c…` | ✅ |
| `custom-server/vendor/hongguo.cjs` | `cf3d685c…` | `cf3d685c…` | ✅ |
| `server/vendor/hongguo.cjs` | `cf3d685c…` | `cf3d685c…` | ✅ |

## 二、逐步执行（命令 → 实际结果）

| 步 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| 1 | 环境/互斥检查 | Node v22.20.0、npm 10.9.3、Python 3.9.7；`java.exe`(PID 3460)=Gradle 8.11.1 **空闲 daemon**（锁 mtime 22:00:35）→ 无并发 Gradle 构建 | `01-env.txt` |
| 2 | `npm run typecheck` + `npm run build` | typecheck exit=0；build exit=0，**1668 modules**，B8 分包完好 | `02-typecheck.log`、`03-web-build.log` |
| 3 | `node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,linux-x64,linux-arm64,darwin-x64,darwin-arm64 **--web-only**` | 6 web + 2 sync 生成；`runtime-cache` 联网重下 Node v22.20.0（6 平台）✅ | `04-bundles.log` |
| 4 | `gradlew assembleDebug assembleRelease`（JDK17） | **BUILD SUCCESSFUL in 22s** | `05-tv-build.log` |
| 5 | `npx electron-builder --config electron-builder.config.cjs --win --x64 --arm64 --publish=never -c.directories.output=<TEMP>` | **成功**，6 EXE（universal/x64/arm64 × setup/portable） | `08b-desktop-build-temp.log` |
| 6 | `python scripts/verify-release-packages.py` | **8/8 全绿**（web 6/6 + 桌面 2/2），exit=0 | `06-verify-packages.log`、`06b-archive-verification.json` |
| 7 | 关键校验：产物内置入口 SHA256 | **全部 == `b2dbaea0…`**（见三） | `07-entry-sha-bundles.json`、`07b-entry-sha-desktop.txt` |
| 8 | `npm test` + `npm run smoke` | **tests 214 / pass 214 / fail 0**（exit 0）；**清晰度 3/3 + 取流 3/3**（exit 0） | `09-npm-test.log`、`10-smoke.log` |
| 9 | `node scripts/collect-release.mjs` | `release/` = **16 产物 + manifest.json + SHA256SUMS.txt**；SHA256 复校 **16/16 OK** | `11-collect-release.log` |
| 10 | 桌面运行时验证 | **通过**（见四） | `12-desktop-runtime-cdp.json` |

## 三、🔴 关键校验（本任务核心）：产物内置入口 == `b2dbaea0…`

| 产物 | 内置 `custom-server/index.mjs` | 引擎 `hongguo.js` |
| --- | --- | --- |
| `hongguotv-web-win-x64.zip` | ✅ `b2dbaea0…` | ✅ `cf3d685c…` |
| `hongguotv-web-win-arm64.zip` | ✅ | ✅ |
| `hongguotv-web-linux-x64.tar.gz` | ✅ | ✅ |
| `hongguotv-web-linux-arm64.tar.gz` | ✅ | ✅ |
| `hongguotv-web-darwin-x64.tar.gz` | ✅ | ✅ |
| `hongguotv-web-darwin-arm64.tar.gz` | ✅ | ✅ |
| 桌面 `win-unpacked/resources/hongguotv/custom-server/index.mjs` | ✅ `b2dbaea0…` | ✅ |
| 桌面 `win-arm64-unpacked/…` | ✅ | ✅ |
| TV `app-debug.apk` / `app-release.apk` → `assets/hongguo.js` | 引擎 ✅ `cf3d685c…`（+ `recommendation-core.cjs`/`category-contract.cjs` 亦逐字节一致） | — |

> sync 包（`hongguotv-sync-linux-*`）结构不含 `custom-server/`（仅 `apps/sync-server/`），故不适用该项；其内容由步骤 6 的 `keepWeb` 命名保留、`verify-release-packages.py` 不覆盖 sync。

**结论：P1（旧产物入口为接线前 `d593a775…`）已消除——全部新产物均为已验收接线版 `b2dbaea0…`。**

## 四、🔴 桌面运行时验证（明确结论：**通过**）

环境**存在可见桌面**（窗口 `visible=True`）。以隔离 profile 启动 x64 `win-unpacked\红果短剧.exe`：

| 项 | 实测 |
| --- | --- |
| 启动 | `startup-stage.log`: `starting-backend → backend-ready → migration-* → creating-main-window` |
| 窗口出现 | PID 31180，`visible=True`，`minimized=False`，标题「红果短剧 - 多端客户端」，尺寸 1725×1075 |
| 单实例 | 二次启动 PID 27892 **`HasExited=True`**（单实例锁生效）；主窗口仍**唯一**（hwnd `147131776` 不变） |
| IPC / 全屏 | `window.hongguotvDesktop.isDesktop=true`；`isFullScreen()` `false → setFullScreen(true)=true → setFullScreen(false)=false`（IPC `fullscreen:set/is` 生效） |
| 内置后端 | 页面内 `fetch('/api/sections')` → **HTTP 200** |
| 渲染 | `#root.childElementCount=1`；`location.href='hongguotv://app/'`；UA 含 `hongguotv-web-pc/1.0.2 Electron/40.0.0` |

启动方式（复现）：`$env:HG_DESKTOP_PROFILE=<隔离目录>; Start-Process 红果短剧.exe -ArgumentList "--remote-debugging-port=9333","--remote-allow-origins=*"`，用 CDP（`outputs/testing/v102-rebuild/cdp-eval.mjs`）执行上表表达式。验证后已杀进程、释放端口。

## 五、`release/` 汇总（16 产物，SHA256 全部复校 OK）

| 文件 | SHA256 |
| --- | --- |
| `hongguotv-desktop-win-universal-setup.exe` | `af765cabb73284aee9ef20bf625246f7860a4dea90e38967c763caeedbbcb6ba` |
| `hongguotv-desktop-win-universal-portable.exe` | `735c6d37b4ca87d295c438a55e195c6fcfffe4099c9f714fa4e4d9506b5929d6` |
| `hongguotv-desktop-win-x64-setup.exe` | `e969c517646b80697c221c043ea3344ad019195daf41d373e1063fde1aa2f19e` |
| `hongguotv-desktop-win-x64-portable.exe` | `21b423d9103380baf04ddd95e263971bbb67aa9dd110882a8542c58018a5ef3a` |
| `hongguotv-desktop-win-arm64-setup.exe` | `622cb950bdd3288a1cd84c36484c4919b42a1a4944309e6b82d633a862472e2c` |
| `hongguotv-desktop-win-arm64-portable.exe` | `b7f426981086436550c95e0d023a87a4254b2637748f82dc13a95c6ae740f224` |
| `hongguotv-web-win-x64.zip` | `8d9819b91a0a776e312d2693cd93a0f63afb29a569c1d67302e70aef023fa104` |
| `hongguotv-web-win-arm64.zip` | `082be109aa2bddc71beb3174ad8e1aa42caaa4af13f2f8c88423ae34ed6c197d` |
| `hongguotv-web-linux-x64.tar.gz` | `df34d3e092fac9da821bb47f55082afffa758490721a919e5cd7602d0548dba6` |
| `hongguotv-web-linux-arm64.tar.gz` | `143a09b743b75bc23d747372bca87f4d31405c03779d41415d0afc4e509a9a21` |
| `hongguotv-web-darwin-x64.tar.gz` | `289d8db7462c00b1539845f6370995192b7bc2d161c57f22801ea23a4e81ecff` |
| `hongguotv-web-darwin-arm64.tar.gz` | `42a266bd9edfac5773dd0d8f949a0325a8daf37fad9a6116fa3e582860bd6671` |
| `hongguotv-sync-linux-x64.tar.gz` | `ec3738d29d7200f3cff2926f12a14fb0d8f82b91d1e4b02880579150f7afae7d` |
| `hongguotv-sync-linux-arm64.tar.gz` | `9a7114d4b4017837138e29bb4edd66592f091e9e90634e5e4a0592e76e68d797` |
| `hongguotv-tv-android5.1-debug.apk` | `a23e787172407cc6c5a00184f6d96e89bee3a5a9eadde4d850caf1c75625ef9f` |
| `hongguotv-tv-android5.1-release.apk` | `d6ddf1d63113f98d90f4e0025f1b199da685931a859712f35d0afce75682dd8d` |

TV APK 校验：debug/release 均 `versionCode=3`、`versionName=1.0.2`、`minSdk=22`、`targetSdk=35`、四 ABI（arm64-v8a/armeabi-v7a/x86/x86_64）；`apksigner verify` 有效（release 证书 `CN=HongguoTV` SHA-256 `c6251a05…`；debug 为 Android Debug）。

## 六、偏离与局限（如实标注）

1. **步骤 3 使用 `--web-only`（偏离 brief 字面命令）**：`dist-win/hongguoTV-win32-x64` 已被清空至只剩一个被锁的 `default_app.asar`（Electron 运行时不存在），全量模式的桌面 staging 会产出**缺运行时的坏包**；该 zip 也不在 `collect-release` 的收集范围。桌面产物由步骤 5 的 electron-builder 产出。已记录于 `.agents/shared/v102-build-window-opencode.md`。
2. **步骤 5 改道工作区外 + 用 README 命令（`--x64 --arm64`）**：
   - brief 字面为 `npm --prefix apps/web-pc run build:desktop`，但该脚本无架构参数，只出宿主架构（x64），会缺 arm64/universal；故采用 README 记录的 `npx electron-builder … --win --x64 --arm64`。
   - 首次输出到 `outputs/windows` **失败**：`EPERM: rename 'win-unpacked.tmp' -> 'win-unpacked'`。Restart Manager 实测锁定进程：`outputs/windows/win-unpacked.tmp/resources/default_app.asar` ← **PID 39584 `Qoder CN`**；`dist-win/.../default_app.asar` ← **PID 43064 `WorkBuddy AI`**（均为他方身份桌面 App 的扫描器，**未杀**）。故输出改到 `%TEMP%\opencode\v102-desktop`，完成后回填 6 EXE 至 `outputs/windows`（`collect-release` 的输入）。
3. **步骤 6 的路径适配**：`verify-release-packages.py` 桌面段硬编码 `outputs/w7-release/{win-unpacked,win-arm64-unpacked}`（已被 DSH 清理）。本次以**目录联接** `outputs/w7-release → %TEMP%\opencode\v102-desktop` 让脚本**原样**通过（未改动脚本、未放宽断言），验证后已移除联接。
4. **桌面 EXE 未签名**：环境无 `HG_CODESIGN_PFX/PASSWORD` → 6 个 EXE 均 `NotSigned`（符合配置的"无证书跳过签名"）。
5. **未做**：未占用任何 Android 设备（brief 不要求 TV 实测）；**API22 实机未验证**（沿用既有局限）；手机端不在本次范围；未提交/推送/打 tag/发布。
6. `release/README.md` **未由我恢复**（brief 第 42 行明确由 DSH 恢复并改版本号）；`collect-release.mjs` 已保留 `*.md` 语义，当前 `release/` 无 `*.md`。

## 七、验收对照

| 验收项 | 结果 |
| --- | --- |
| 全部产物从 `a623f8a` 重建，含 `b2dbaea0…` 入口 | ✅（业务代码 == `a623f8a`；入口/引擎不变量全部命中） |
| `npm test` 214/214、`smoke` 通过 | ✅ 214/214、3/3+3/3 |
| `verify-release-packages.py` 6/6 全绿 | ✅ web 6/6（另桌面 2/2） |
| 桌面运行时验证有明确结论 | ✅ **通过**（可见窗口 + 单实例 + IPC/全屏 + 内置后端 200） |
| `release/` 含 manifest.json + SHA256SUMS.txt + 各端产物 | ✅ 16 产物，SHA256 16/16 OK |
| 未验证项/局限已标注 | ✅ 见六 |
