# DSH 发布安排（2026-10-16）— 本次发布**不包含手机端**

- **发布决定人**：dsh（最终验收与发布安排）
- **依据**：用户 2026-10-16 直接指令「下发安排发布，本次发布不包含手机端」+ 用户「手机端直接将 web 端代码复制过去做兼容，不用从头编写」
- **性质**：**发布安排（计划与门禁）**，不是发布执行。**本轮 DSH 未发布、未打 tag、未推送、未上传任何产物、未重启服务。**
- **对应裁决**：本文件承接 `dsh-adjudication-20261016.md` 裁决 6.2（产物时效）与"发布安排"节。

---

## 一、发布范围（本次）

| 端 | 是否发布 | 理由 |
| --- | --- | --- |
| **Web 服务端（6 平台包）** | ✅ 是 | 唯一具备完整构建 + 真实内容实测 + 内容/架构校验的产物 |
| **Windows 桌面（Electron，6 个 EXE）** | ⚠️ 有条件 | 产物已生成但**早于最终接线**、且**运行时从未验证**（详见三） |
| **Android TV APK（debug + release 签名）** | ✅ 是 | 3 台模拟器真实播放通过；**但 API 22 未验证**（须在发布说明标注） |
| **远程共享服务（sync linux x64/arm64）** | ✅ 是 | 已构建 + 校验通过 |
| **手机端（Android）** | ❌ **本次不发布** | **用户明确排除**；且《见四》当前无工程、无产物、无能力验证 |
| **iOS** | ❌ 不发布 | 用户已明确手机端仅 Android；且 Windows 宿主无 iOS 工具链 |

---

## 二、🔴 发布前必须解决的门禁阻塞（DSH 判定：**当前不具备直接发布条件**）

### 阻塞 P1（阻断级）：全部产物都比最终接线旧

**实测证据**：本次发布目录 `release/` 与 `outputs/bundles/` 的产物，其内置入口均为**接线修复前**的版本。

| 对象 | 内置 `custom-server/index.mjs` SHA256 | 含 `traceRequest`? | 含 `concurrency: 2`? |
| --- | --- | --- | --- |
| **当前源码**（codex 已通过 DSH 验收的接线版） | `b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333` | ✅ | ✅ |
| `release/hongguotv-web-win-x64.zip` 内 | `d593a77532d0061399dc4d5e9faa196ca47058267fa653d10915f3c7e5280dd7` | ❌ | ❌ |
| `outputs/bundles/` 全部 6 个 web 包 | `d593a775…`（六包一致） | ❌ | ❌ |
| **桌面 staging** `dist-win\hongguoTV-win32-x64\resources\hongguotv\custom-server\index.mjs` | `d593a775…`（mtime 20:37:02） | ❌ | ❌ |

**因果**：opencode 构建于 **22:00–22:27**；codex 重做接线于 **22:37:15**；DSH 验收于 **22:40–22:55**。**产物早于接线，故产物不包含本次通过的接线。**

**裁定**：
- **P1 未解除前，不得发布**。否则发布的不是已验收版本。
- 解除方式：在**确定代码版本**上**重建全部产物**（见第五节步骤 1–2）。**禁止**把旧产物改名后当新版发布。

### 阻塞 P2（阻断级）：桌面 EXE 运行时从未验证 + 打包输入被文件占用

- `dist-win\hongguoTV-win32-x64\resources\default_app.asar` **仍被某进程独占锁定**（DSH 本轮实测：`[System.IO.File]::Open(...,'None')` 抛"正由另一进程使用"；进程列表中**无** Electron/`hongguoTV.exe`，疑似 Defender/索引器或残留句柄）。opencode 因此曾退回 `--web-only`，桌面 staging 一度失败。
- 桌面 6 个 EXE 的时间为 **22:34**，但其**打包输入 staging 目录**（`dist-win\...\resources\hongguotv\custom-server\index.mjs`）的入口为 `d593a775…`、**mtime 20:37:02** —— 即桌面 EXE **同样不包含 22:37 的接线**。
- 本环境**无可见 GUI**，桌面 App **从未实际运行**（opencode 报告明确列为"未验证"）。
- **裁定**：桌面 EXE **本轮不进入发布**，除非：① 占用解除并成功重建；② 由 **antigravity**（桌面主责）在**可见桌面环境**完成启动/单实例/IPC/全屏实测。**不得**以"构建成功"替代"运行验证"（RESPONSIBILITIES 边界 8）。

### 阻塞 P3（需标注）：API 22 实机未验证

- `mumu-r`（`192.168.1.120:5555`，**唯一 API 22 真机**）**offline**，本轮未连接。
- APK 在配置层满足 `minSdk 22`，但**运行层无实机证据**。
- **裁定**：APK 可发布，但**发布说明必须写明"最低 API 22 未在实机验证，仅 API 32/35 模拟器通过"**；**禁止**声称 API 22 兼容已验证。

### 阻塞 P4（需标注）：`release/` 产物命名与历史 Release 不一致

- 历史 `v1.0.1` 资产名：`hongguotv-win-x64-setup.exe`、`hongguotv-android5.1-release-signed.apk`。
- 当前 `release/` 命名：`hongguotv-desktop-win-x64-setup.exe`、`hongguotv-tv-android5.1-release.apk`（`release/README.md` 记载自 2026-10-16 起改为**扁平 + 新命名**）。
- **裁定**：**保持新命名**（已写入 `release/README.md` 与 `manifest.json`），但在发布说明中**明确列出命名变更对照表**，避免用户按旧名找不到文件。**不改回旧名**。

### 阻塞 P5（已知风险，不阻断）：`release/` 版本号未随本次更新

- `release/README.md` 与桌面产物内嵌名仍为 **1.0.0**；`package.json` 为 `0.1.1`；TV `versionName 1.0.0`；历史 Release 已到 **v1.0.1**。
- **裁定**：本次发布**版本号由 DSH 在发布执行时确定并统一**（见第五节步骤 4）。**不在本轮预先改版本号**（避免在未重建产物前产生"版本已变但产物未变"的错配）。

---

## 三、通过门禁的既有证据（可直接引用）

| 项 | 实测结论 | 来源 |
| --- | --- | --- |
| 全量回归 | **214/214 通过、0 失败**（DSH 复核 2 次；codex 亦报 214/214） | `outputs/testing/dsh-adjudication/npm-test-final-acceptance.log` |
| Web 构建 | `npm run typecheck` 通过；`npm run build` 通过（1668 modules） | opencode 报告第 1 节 |
| Web 包内容/架构校验 | **6/6 全绿**：引擎/前端与源码逐字节一致、Node 运行时架构正确 | opencode 报告第 2.3 节 |
| Web 端真实内容 | 源码模式 + **打包产物自带 Node** 双通道均渲染真实内容（38 图 / 24 题材） | opencode 报告第 3.2 节 |
| TV 真实播放 | 3 台模拟器（API32/35/32）安装、启动、真实画面+字幕、无 FATAL/ANR | opencode 报告第 3.1 节 |
| APK 签名 | `apksigner verify` 有效，证书 SHA-256 `c6251a05…`（与 release/README 一致） | opencode 报告第 2.1 节 |
| 播放冒烟 | `smoke-playback.json`：`pass: true`，3 样本清晰度 3/3 + 取流 3/3（HTTP 206/65536B/ftyp） | `outputs/smoke-playback.json` |
| B7 算法 | 独立重跑 3 次 P95 after **0.8767/0.8628/1.0343 ms**（≤3ms 达标） | DSH 验收节 |
| B5 诚实性 | 明确声明**未观察到 ≥15% 收益**，未补造 `serverMs` | `b5-perf-baseline.md` |

**注意**：上表多为**接线前**产物/构建的结论。P1 解决后，**须在重建产物上重新执行**回归、构建、内容校验与冒烟，**旧结论不可直接迁移到新产物**。

---

## 四、手机端：本次不发布，且实施方式已定为"移植 Web 代码"

### 用户决策（2026-10-16，两条直接指令）

1. **平台**：手机端**只做 Android**，不含 iOS。
2. **实施方式**：**直接复制 Web 端代码做手机兼容，不从零编写。**

### DSH 记录（已写入 `RESPONSIBILITIES.md`）

- 手机端**不再定位为"另起一套客户端"**，而是**基于既有 `apps/web-pc/src`（React/TS）的移植适配**。
- 对 `RESPONSIBILITIES.md` 的两处更新：主责范围段 + 接入与能力验证段，均注明"由 Web 端代码移植、不从头重写"。
- **边界不变（重要）**：共享逻辑（`shared/content-core` 引擎、`shared/recommendation-core.cjs` 推荐核心、同步协议）**仍由 codex 唯一维护**，手机端**只能引用/移植界面与端侧适配层，不得复制第二份引擎**（RESPONSIBILITIES 共同边界 2）。这是本次移植方案与"复制粘贴"的关键区别。

### 本次不发布的理由（DSH 判定）

1. **用户明确排除**本次发布范围。
2. **当前无任何可发布的手机产物**：`apps/` 仅 `web-pc` / `tv-android` / `sync-server`，**无手机工程、无目录、无 APK**。
3. **能力未验证**：workbuddy 的移动端工具链虽有实测（JDK21/SDK35/NDK28.2/Gradle 缓存/Flutter 3.44.4/adb/MuMu 在线），但**未跑过一次真实构建、未安装过任何包**，其报告自述"工具链就绪 ≠ 构建验证"。

### 手机端后续推进（**须由 DSH 另开任务，本轮不启动**）

待用户/DSH 确认**技术栈与专属目录**后开单，任务须包含：
- assignee `workbuddy`；**唯一写者**范围（新建手机目录，**禁止改 `apps/web-pc/` 本体**——移植应复制后适配，避免与 antigravity 的双写冲突）；
- 明确"移植"边界：可复制 `apps/web-pc/src` 的界面/状态层；**不得**复制 `shared/content-core` 引擎或推荐核心；
- 验收：Android 构建 + 真实设备/模拟器安装启动 + 触控播放 + 横竖屏 + 生命周期。

---

## 五、发布执行步骤（待 P1/P2 解除后由 DSH 逐条下令，非本轮执行）

| # | 步骤 | 负责 | 门禁 |
| --- | --- | --- | --- |
| 1 | **锁定确定代码版本**（业务改动提交或冻结工作树；当前 19 个业务文件未提交） | DSH 决定 + 各主责 | 无确定版本不构建 |
| 2 | **在确定版本上重建全部产物**（web 6 包 + sync 2 包 + TV APK + 桌面 EXE） | opencode | 重建后**必须复跑** `npm test`、`typecheck`、`build`、`verify-release-packages.py`、`smoke` |
| 3 | **校验新产物内含的是接线版**（断言包内 `custom-server/index.mjs` SHA256 == 源码 SHA256） | opencode 出证 + DSH 复核 | **这是 P1 的验收条件**，不通过则退回第 2 步 |
| 4 | **确定并统一版本号**（含 `release/README.md`、产物内嵌名、tag、GH Release 标题） | DSH 决定 | 三者一致 |
| 5 | **桌面 EXE 运行时验证**（可见桌面环境：启动/单实例/IPC/全屏） | antigravity | P2；未通过则桌面移出本次发布 |
| 6 | **DSH 最终验收**（对照本文件与裁决书逐项核验） | DSH | — |
| 7 | **发布执行**：打包上传 GH Release + 打 tag + 推送 `origin` | DSH 决定并执行 | 需用户明确"执行发布"指令 |
| 8 | **发布说明**：含 P3（API22 未验证）、P4（命名变更对照）、不含手机端 | DSH | — |

**DSH 的硬性纪律**：第 1 步未完成前，**不得**开始第 2 步；第 3 步未通过前，**不得**进入第 7 步。**发布≠构建成功**（边界 8）。

---

## 六、本轮 DSH 实际动作（均为文档与只读核查，未发布）

| 动作 | 对象 | 状态 |
| --- | --- | --- |
| 手机端实施方式入职责 | `.agents/RESPONSIBILITIES.md`（2 处） | 已改，待提交 |
| 发布安排落盘 | 本文件 | 已建 |
| 产物时效核查 | `release/*.zip`、`outputs/bundles/*`、源码入口 | 实测，**发现 P1** |
| 桌面占用核查 | `dist-win\...\default_app.asar` 独占试开 | 实测，**仍被锁定（P2）** |
| GH 发布历史核查 | `gh release list/view` | 实测（v1.0.0 / v1.0.1 存在） |
| **未做** | 未打 tag、未推送、未上传、未重建产物、未重启服务、未改版本号、未创建手机工程 | — |

---

## 七、需用户/DSH 决策的两点

1. **版本号**：✅ **已决 —— `v1.0.2`**（用户 2026-10-16 直接指令）。`v1.0.1` 已于 2026-10-15 发布，**不可覆盖**；本次发布统一使用 `v1.0.2`。发布执行时须同步 `release/README.md`、产物内嵌名、tag、GH Release 标题四处。
2. **桌面端是否在本轮发布内**：若 antigravity 无法及时完成运行时验证，DSH 建议**本次先发 Web + TV + sync（三个已充分验证的端）**，桌面 EXE 顺延到下一轮。**请指示是否接受该取舍。**

---

## 八、过期产物清理（用户指令，DSH 已执行 2026-10-16 23:0x）

### 用户指令
「我要删除之前的所有构建过期产物，关闭进程独占锁定」。

### 执行结果

| 指标 | 清理前 | 清理后 | 变化 |
| --- | --- | --- | --- |
| `outputs/` | 11,984.6 MB | 1,405.1 MB | −10,579.5 MB |
| `release/` | 1,180.6 MB | **已删除** | −1,180.6 MB |
| `dist-win/` | 554.3 MB | 0.1 MB | −554.2 MB |
| **合计** | **13,719.6 MB** | **1,405.2 MB** | **−12,314.4 MB（−12.0 GB）** |
| F 盘可用 | 461.88 GB | **473.98 GB** | **+12.1 GB** |

**已删除（16 项中 15 项成功）**：`outputs/bundles`、`outputs/w7-release`、`outputs/windows`、`outputs/build-archives`、`outputs/runtime-cache`、`outputs/testing/w7-release`、`outputs/testing/all-clients-20261015`、`outputs/testing/b1-vendor`、`outputs/testing/recommend-fullscreen-20261015`、`outputs/w5-desktop`、`outputs/github-source-20261013-143651`、`outputs/layout-backup-20261013-144538`、`outputs/packaging-tests`、`outputs/w3-profile`、`release/`。
**`dist-win/` 清到仅剩 1 个文件**（554 MB → 0.1 MB）：除被锁定的 `resources\default_app.asar`（109,371 B）外全部删除。

### ⚠️ 进程独占锁定：**未能解除**（DSH 已尽力，需外部介入）

**锁定持有者已精确查明**（Windows Restart Manager API 实测，非猜测）：

```
PID 27728 | WorkBuddyAI.exe
```

- 该进程为 **workbuddy 身份所运行的 WorkBuddy AI 应用子进程**（父进程 `24296`，10:36:05 启动），**不是** opencode 猜测的 Defender/索引器。
- **DSH 的解除尝试全部失败**（`Access is denied`）：
  1. `Stop-Process -Id 27728 -Force` → Access denied；
  2. `taskkill /F /PID 27728` → Access denied；
  3. `taskkill /F /T /PID 24296`（终止整棵进程树）→ Access denied；
  4. `WM_CLOSE` 优雅关闭 → 该进程 `MainWindowHandle=0`（无可见主窗口，无法消息关闭）；
  5. DSH 当前**非管理员**（`isAdmin=False`，用户 `DESKTOP-GBDFG47\AnLin`），无权终止他人用户上下文进程。
- **判定**：**该锁定无法由 DSH 解除**。需**用户手动操作**：在其 WorkBuddy 窗口退出/关闭 WorkBuddy 应用（或由管理员终止 `WorkBuddyAI.exe` 全部进程）。
- **影响面最小**：被锁文件仅 **109,371 B（107 KB）**，其余 554 MB 已清除。**不影响本次发布**——`dist-win` 属桌面 staging，发布产物由 `scripts/build-bundles.mjs` + `collect-release.mjs` 重新生成到 `release/`，不依赖该 staging 目录。

### 清理前所做的保护动作（避免误删）

1. **`release/README.md` 已先行备份** → `.agents/archive/release-README-before-v1.0.2-20261016.md`（6,744 B）。理由：该文件**未被 git 跟踪**且经查 `collect-release.mjs` / `build-bundles.mjs` **均不会重新生成它**，直接删 `release/` 会**永久丢失**这份手写的发布说明。
2. **保留被报告引用的证据**（未删）：`outputs/testing/{b5,b7,b5-b7-final}`（B5/B7 交付证据）、`outputs/debug/opencode-compat-20261016`（全终端实测截图）、`outputs/version-snapshots/{custom-server-data-20261014-180640,tv-db-20261013-201326,web-service-db-20261013103003}`（**含用户数据库 `historical.sqlite`/`library.sqlite`**）、`outputs/version-snapshots/ce5398c`（**`docs/ROLLBACK_STATUS.md` 明载的恢复救援副本**）、`outputs/tv-android`（TV 交付 APK 副本）。
3. **未触碰运行中的用户数据**：`custom-server/data`、`apps/sync-server/data` 及家庭共享密钥**原样保留**。
4. **逐项绝对路径校验**：删除前每个目标均 `Resolve-Path` 并断言前缀为 `F:\Project\hongguoTV\`，**拒绝**任何越界路径。

### 删除后的完整性验证（DSH 实测）

| 验证项 | 结果 |
| --- | --- |
| 是否误删 git 跟踪文件 | **无**（`git status` 无 ` D` 条目） |
| 测试套件 | **214/214 通过、0 失败** |
| 源码语法 | `custom-server/index.mjs`、`scripts/build-bundles.mjs`、`scripts/collect-release.mjs` 全部 `node --check` 通过 |
| 保留的证据/用户数据 | 8 项**全部存在** |
| git 仓库 | 完好，HEAD `a3917fa` 未变 |

### 对发布流程的影响

- ✅ **正向**：`release/` 与 `outputs/bundles` 的过期产物（内置接线前入口 `d593a775…`）**已物理清除**，P1"旧产物被误当新版发布"的风险**从源头消除**。
- ⚠️ **注意**：`release/` 现已不存在，**发布必须重新生成**——即第五节步骤 2 从"重建"变为"**从零生成**"。`release/README.md` 须从上述备份恢复并更新版本号为 `v1.0.2`。
- ⚠️ `scripts/verify-release-packages.py` 曾校验的 `outputs/w7-release`（陈旧桌面 staging）**已随清理删除**，不再产生 opencode 报告第 2.3 节末尾那个 `AssertionError`。
- ⚠️ `outputs/runtime-cache` 已删：`build-bundles.mjs:10` 会在需要时**重新创建该目录并重新下载 Node 运行时**，**重建产物需要网络**（10-12 的 tar.xz 缓存已不存在）。

---

*本文件为 DSH 的发布安排与门禁判定，所有"实测"来自 2026-10-16 本会话真实命令。发布执行的每一步仍需明确指令，本轮未执行任何发布动作。*
