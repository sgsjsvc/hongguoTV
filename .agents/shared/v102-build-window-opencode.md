# v1.0.2 全终端重建 构建窗口（opencode / T3）

任务：`t-v102-rebuild`（T3 v1.0.2 全终端产物重建+校验+桌面运行时验证）
基线：`3d7b0de`（业务冻结 `a623f8a` 的后代；入口不变量 `b2dbaea0…`、引擎三副本 `cf3d685c…` 已核对一致）
开始：2026-10-17 00:1x（本地）
完成：2026-10-17 01:0x（本地）——**全部构建已完成，本构建窗口已释放**（web/桌面/TV 均已构建、校验、汇总至 `release/`）。报告：`.agents/shared/t-v102-rebuild-opencode.md`。

## 占用声明（构建互斥）

- **多平台打包**：`outputs/bundles`（`build-bundles.mjs`，6 平台 web + 2 sync）— 占用中
- **Android Gradle 构建**：`apps/tv-android/app/build`（`assembleDebug assembleRelease`）— 占用中
- **Electron 打包**：输出改道 `%TEMP%\opencode\v102-desktop`（`electron-builder --win --x64 --arm64`）

### 桌面打包受阻与改道（实测）

- 首次输出到 `outputs/windows` 失败：`EPERM: rename 'win-unpacked.tmp' -> 'win-unpacked'`。
- Restart Manager 实测锁定进程：`outputs/windows/win-unpacked.tmp/resources/default_app.asar` ← **PID 39584 `Qoder CN`**；`dist-win/.../default_app.asar` ← **PID 43064 `WorkBuddy AI`**（均为他方身份桌面 App 的工作区扫描器，**不杀**）。
- 对策：输出改到工作区外临时目录，避开扫描器；完成后回填 6 个 EXE 至 `outputs/windows`，运行时验证直接用临时目录 `win-unpacked`。

开工前检查：`java.exe`(PID 3460) 为 Gradle 8.11.1 **空闲 daemon**，锁文件 mtime 22:00:35（上次构建结束）→ 无并发 Gradle 构建，允许占用。

## 注意

- 同副本同一时间仅一次 Android Gradle 构建、一次多平台打包（RESPONSIBILITIES 边界 7）。
- 全部构建完成后释放本窗口。
- `dist-win\hongguoTV-win32-x64\resources\default_app.asar` 仍被占用（`WorkBuddyAI.exe` 在运行），且 `dist-win` 仅剩该文件（Electron 运行时已不存在）→ 步骤 3 采用 `--web-only`，跳过会产出坏包的桌面 staging。
