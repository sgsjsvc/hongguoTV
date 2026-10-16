# T3 v1.0.2 全终端产物重建 + 产物校验 + 桌面运行时验证（打包与测试）

- **任务ID**: `t-v102-rebuild`
- **assignee**: `opencode`（统一打包与测试 / 产物校验 / 发布门禁）
- **依赖**: `t-v102-version-web`、`t-v102-version-tv`（两者 done 后才 ready；版本不一致会导致产物命名/内嵌版本错误）
- **上游依据**: `.agents/shared/dsh-release-plan-20261016.md` 步骤 2/3/5；`.agents/shared/dsh-v1.0.2-frozen-baseline.md`

## 确定代码版本（唯一构建基线）

| 项 | 值 |
| --- | --- |
| 业务代码冻结提交 | **`a623f8a8165ba8915ff9558e354820f9efbf8fdd`** |
| 入口不变量 | `custom-server/index.mjs` SHA256 必须为 **`b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333`** |
| 共享引擎不变量 | `shared/content-core/hongguo.js`、`custom-server/vendor/hongguo.cjs`、`server/vendor/hongguo.cjs` 三份 SHA256 **均为 `cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2`** |

**开工前先确认**：`git rev-parse HEAD` 与工作区版本改动已由 DSH 提交；若工作区含自己或他人的未确认改动，**停下来报告 DSH**，不得在非冻结版本上构建。

## 背景：为什么要重建（DSH 实测结论）

此前 22:00–22:27 构建的产物，其内置入口 SHA256 为 `d593a775…`（**接线修复前版本**），而 DSH 验收通过的接线版是 `b2dbaea0…`。即**旧产物不包含已验收的接线**（P1 阻断）。DSH 已按用户指令**物理删除**全部过期产物（`release/`、`outputs/bundles`、`outputs/windows`、`outputs/w7-release` 等），故本次为**从零生成**。

## 必须做（按顺序，每步留原始日志）

1. **环境确认并记录**：`node --version`、`npm --version`、JDK、`gradlew --version`；确认**无并发 Gradle 构建**在跑（构建互斥）
2. **Web 构建**：`npm run typecheck` + `npm run build`（记录 modules 数）
3. **Web/sync 便携包**：`node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,linux-x64,linux-arm64,darwin-x64,darwin-arm64`
   - ⚠️ `outputs/runtime-cache` 已被清理，**本次会重新下载 Node v22.20.0 运行时**（需网络）。若下载失败，如实报告，不要用旧缓存冒充
4. **TV APK**：`gradlew assembleDebug assembleRelease`（JDK17，命令路径参考 qoder 报告：`cmd.exe //c "set JAVA_HOME=C:\Program Files\Java\jdk-17&& gradlew.bat <task>"`）
   - 校验 `aapt badging`：`versionName` 必须为 **1.0.2**、`versionCode` 为 T2 设定值、`minSdk 22`、四 ABI
   - 校验 `apksigner verify` 签名有效
5. **桌面 EXE**：`npm --prefix apps/web-pc run build:desktop`（electron-builder → `outputs/windows`）
   - ⚠️ 前置：`beforePack` 会校验 `outputs/bundles/hongguotv-web-win-{arch}` 存在且内置 Node 架构匹配，故**必须在步骤 3 之后**
   - ⚠️ 已知风险：`dist-win\hongguoTV-win32-x64\resources\default_app.asar` 曾被 `WorkBuddyAI.exe`(PID 27728) 独占锁定（Access denied，DSH 无法解除）。若再遇占用，**如实报告并给出锁定进程**，不要跳过校验
6. **产物内容/架构校验**：`python scripts/verify-release-packages.py`，记录 6 包结果
7. **🔴 关键校验（本任务核心验收）**：**断言每个新产物内置的 `custom-server/index.mjs` SHA256 == `b2dbaea0…`**
   - Web/sync 包：解包或读取归档内 `custom-server/index.mjs` 计算 SHA256
   - 桌面 EXE：校验 `outputs/windows` staging 或 EXE 内 `resources/hongguotv/custom-server/index.mjs`
   - TV APK：校验 `assets/hongguo.js` 与源码一致（引擎），并记录 APK 自身 SHA256
   - **任一不一致即判定不通过**，退回重建，不得发布
8. **发布门禁复跑**：`npm test`（期望 214/214）、`npm run smoke`（期望 3/3 清晰度 + 3/3 取流）
9. **汇总到 `release/`**：`node scripts/collect-release.mjs`
   - 注意：`release/README.md` **不会被该脚本生成**，它保留 `*.md`。当前 `release/` 已删，**README 需从备份恢复**——恢复副本在 `.agents/archive/release-README-before-v1.0.2-20261016.md`，由 DSH 负责恢复并改版本号，**opencode 不要自行恢复**（避免与 DSH 双写）；若 `release/README.md` 缺失，正常生成其余内容即可
10. **🔴 桌面运行时验证（用户明确要求并入本任务）**：在**可见桌面环境**启动桌面 EXE/便携版，验证：启动 → 窗口出现 → 单实例（二次启动聚焦主窗口）→ IPC/全屏 → 内置后端可用
    - **诚实要求**：若本环境**无可见 GUI**（此前报告称截图工具需可见桌面窗口），**必须明确报告"无法在本环境完成运行时验证"**，并给出你尝试过的命令与实际结果。**不得以"构建成功"替代"运行验证"**（RESPONSIBILITIES 边界 8）
    - 该结论决定桌面端是否进入本次发布；**由 DSH 判定**

## 报告与结果

- 报告写 `.agents/shared/t-v102-rebuild-opencode.md`（含每步实际命令、原始输出/日志路径、SHA256 表、局限）
- 结果写 `.agents/outbox/t-v102-rebuild.json`
- 证据落盘到 `outputs/testing/v102-rebuild/`

## 明确不做

- ⚠️ **不运行 `npm run release:check` 以外的发布动作**；**不打 tag、不推送、不上传 GH Release、不发布**（发布由 DSH 执行，需用户明确指令）
- 不改任何业务源码；不改版本号字段（属 T1/T2）
- 不做手机端（本次发布不含手机端）
- 不删除 `release/README.md`、不动 `*.md`
- 不占用设备；若 TV 实测需设备，先 `mumu declare` 后使用、用完 `mumu release`
- **不提交、不推送**（由 DSH 统一提交，保持确定版本单一来源）

## 验收

- 全部产物**从 `a623f8a` 版本重建**，内含 `b2dbaea0…` 接线版入口（关键校验通过）
- `npm test` 214/214、`smoke` 通过
- `verify-release-packages.py` 6/6 全绿
- 桌面运行时验证**有明确结论**（通过 / 明确报告无法验证及原因）
- `release/` 含 manifest.json + SHA256SUMS.txt + 各端产物，校验链完整
- 报告如实标注所有未验证项与局限
