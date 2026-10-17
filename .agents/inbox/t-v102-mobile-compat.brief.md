# T6 手机端兼容性验证与适配（精细版）

- **任务ID**: `t-v102-mobile-compat`
- **assignee**: `workbuddy`（手机端主责）
- **依赖**: **`t-v102-mobile-stage2`**（先完成建工程与首轮实测，本任务在其交付**并通过 DSH 验收**后开工；未 done 前不得开工，避免与在途工作双写同一批文件）
- **性质**: 在已建成的 `apps/mobile/` 上做**兼容性验证 + 适配**。**不属已发布的 v1.0.2**，成果留待后续发布。

---

## 一、开工前置（硬性）

1. **确认 `t-v102-mobile-stage2` 已 done 且经 DSH 验收**：读 `.agents/shared/t-v102-mobile-stage2-workbuddy.md`、`.agents/shared/dsh-mobile-stage2-verdict.md`（若存在）。
   **若 T5 仍在 claimed，停下来报告 DSH，不要并行改 `apps/mobile/`。**
2. `node .agents/cli.mjs mumu list` 确认设备空闲后再 `declare`。
3. 确认 `apps/web-pc/`、`shared/`、`apps/tv-android/` 仍为**零改动**（`git status`）。

## 二、当前实测基线（DSH 2026-10-17 核实，供你比对）

| 项 | 实测值 | 来源 |
| --- | --- | --- |
| 手机端目录 | `apps/mobile/`，含 `android/`、`dist/`、`capacitor.config.ts` | 文件系统实测 |
| 应用 ID | `com.hongguotv.mobile` | `capacitor.config.ts` / `build.gradle` |
| 版本 | `versionCode 3` / `versionName 1.0.2` | `android/app/build.gradle` |
| **minSdk / targetSdk / compileSdk** | **24 / 36 / 36** | `android/variables.gradle` |
| Capacitor | `@capacitor/core 8.5.3`、`@capacitor/android 8.5.3`、`@capacitor/app 8.0.0` | `package.json` |
| 已有新增适配文件 | `src/components/BackendSetup.tsx`、`src/native/fullscreen.ts` | 目录实测 |
| cleartext | `usesCleartextTraffic="true"`；配置 `androidScheme:"http"` + `allowMixedContent:true` | `AndroidManifest.xml` / config |
| 已构建 APK | `android/app/build/outputs/apk/debug/app-debug.apk`（4,680,536 B） | 构建产物 |
| 权限 | 仅 `INTERNET` | `AndroidManifest.xml` |

## 三、🔴 兼容性验证的关键约束（DSH 实测，直接决定本任务边界）

### 3.1 设备现实

| 设备 | 地址 | API | **ABI** | 屏幕 |
| --- | --- | --- | --- | --- |
| `mumu-d1` | 127.0.0.1:16384 | 32 | **x86_64** | 720×1280（override 1280×720） |
| `mumu-d2` | 127.0.0.1:16416 | 35 | **x86_64** | 1080×1920 |
| `mumu-d3` | 127.0.0.1:16448 | 32 | **x86_64** | 1080×1920（override 1280×720, density 192） |
| `mumu-d4` | 127.0.0.1:16480 | 32 | **x86_64** | 900×1600 |
| **电视（实机）** | 192.168.1.112:5555 | 22 | — | **当前 ADB 不可达**（网络通、端口全关） |

### 3.2 「相同系统不重复测试」规则（用户 2026-10-17 指令）

**同一 API 级别只测一台。** 实测后需测的系统级别仅 **2 个**：

| API | 代表设备（取一台） | 说明 |
| --- | --- | --- |
| **API 32** | `mumu-d1`（**推荐**，已装过 mobile 包）或 `mumu-d3` / `mumu-d4` | 三台同 API，**只测一台** |
| **API 35** | `mumu-d2`（唯一） | 必测 |

- `mumu-d1` 与 `mumu-d4` **型号+API 完全相同**（`23113RKC6C`/API32/Android12），仅屏幕不同 → 按规则**取其一**。
- **若要额外覆盖屏幕尺寸差异**，须在报告中**显式标注"尺寸覆盖，非系统重复测试"**，否则视为违反去重规则。
- ⚠️ **没有 API 24-31 设备**：`minSdk=24` 的**低端下限无法实测**，报告须明确标注该缺口，
  **不得**用 API 32 结果声称"minSdk 24 已验证"。

### 3.3 🔴 模拟器全为 x86_64 —— 本任务最大的验证盲区

- **所有在线模拟器都是 x86_64**，而**真实手机绝大多数是 arm64-v8a**。
- 因此：**ARM 原生库行为、真实 GPU 解码、真实 HEVC 硬解，模拟器一律不能代表**。
- **HEVC 解码**（上游清晰度多为 HEVC）：必须**明确报告"仅在 x86_64 模拟器观察，未在 ARM 真机验证"**。
  **禁止**据模拟器结果声称"手机端 HEVC 可播"。
- 若本任务期间**无 ARM 真机可用**（当前确实没有），该项**只能标记为未验证**，并给出所需机型建议。

### 3.4 APK ABI 声明核对（必做）

检查 `apps/mobile/android/app/build.gradle` 是否声明 ABI 过滤：
- 若**未声明** → Capacitor/Gradle 默认通常只打 **arm64-v8a + armeabi-v7a + x86 + x86_64**（或仅 arm 系）
- **必须实测 `aapt dump badging` 读出 `native-code` 列表**，并说明：
  - 是否含 x86_64（否则装不进当前模拟器，必须解释为何先前能装）
  - 是否覆盖 arm64-v8a（**真实手机必需**）
- 若缺 arm64，**这是兼容性缺陷**，须报告并给出修复方案（交 DSH 决定是否授权改配置）。

## 四、必须验证的兼容性维度（逐项给结论，不许"大概可以"）

### A. 系统版本兼容
1. **API 32**（代表机）与 **API 35**（`mumu-d2`）：安装 → 启动 → 首页 → 分类/榜单 → 详情 → **真实播放** → 清晰度 → 连播 → 历史
2. **API 24 下限**：如实标注**无法实测**；如能说明代码/依赖为何需要 24（Capacitor 8 门槛），一并写明

### B. ABI / 架构兼容
3. `aapt badging` 的 `native-code` 列表 vs 实际需求（见 3.4）
4. 在 x86_64 模拟器上**安装并运行**（验证 x86_64 通道）
5. **arm64-v8a 通道：无法实测** → 明确标注，并给出结论依据（仅静态核对声明）

### C. 屏幕与布局兼容（手机形态）
6. **竖屏为主**：核对各页不溢出、不遮挡、可滚动；记录实际 `wm size`/`density`
7. **横屏**：旋转后布局是否可用（`MainActivity` 已声明 `configChanges` 含 `orientation|screenSize`，确认旋转不重建 Activity、播放不中断）
8. **不同尺寸/密度**：至少用 2 种屏幕（如 d1 的 720×1280@240 与 d4 的 900×1600@240，**显式标为尺寸覆盖**）核对布局
9. **刘海/挖孔/安全区**：如设备支持，核对顶栏与播放器不被遮挡

### D. WebView 与运行时兼容
10. **HTML5 全屏**：`src/native/fullscreen.ts` 的实现在真机 WebView 的行为（**必须在设备上实测**，记录成功/降级路径）
11. **混合内容 / cleartext**：LAN `http://` 后端在本机 `http://localhost` 页面下的 XHR 是否被拦（配置已设 `allowMixedContent`，需**实测确认真的生效**）
12. **WebView 内核版本**：记录设备 WebView 版本（`dumpsys webviewupdate` 或 `getprop`），据以说明 API 24 设备的内核风险（**该风险无法在本机实测**）

### E. 移动端交互兼容
13. **触控**：点击/滑动手势覆盖主要操作（**无键盘**，`useKeyboardShortcuts` 不得成为唯一路径）
14. **自动播放策略**：移动端限制下的首次播放是否需用户手势；失败时是否**可观测报错**（不是静默吞错）
15. **生命周期**：切后台/回前台、锁屏、来电话等中断后能否恢复播放与进度
16. **音频焦点**：与其他 App 抢占时行为

### F. 媒体兼容
17. **清晰度档位**：档位数量、默认档、切换后是否仍可播
18. **Range/断点**：拖动进度条是否重新请求并续播
19. **HEVC**：见 3.3 —— **模拟器结果不作数**，必须标注未在 ARM 真机验证

### G. 稳定性与性能
20. `logcat` 全程无 `FATAL EXCEPTION` / ANR；记录冷启动耗时
21. `dumpsys meminfo` 内存峰值、`dumpsys gfxinfo` 帧数据（滚动/列表/播放页）

## 五、证据要求

- 截图与 UI 层级：`outputs/testing/mobile-compat-20261017/<设备>-<场景>-<状态>.png|.xml`
- 每个结论必须**可追溯到具体命令或截图**；矩阵表每格填实测值，未测项填「**未测（原因）**」
- APK 标识：`aapt dump badging` 输出 + APK SHA256

## 六、唯一写者范围

**允许改**：
- `apps/mobile/**`（你的领域）
- `.agents/shared/t-v102-mobile-compat-workbuddy.md`、`.agents/outbox/t-v102-mobile-compat.json`

**禁止改**：
- ❌ `apps/web-pc/**`（antigravity）；❌ `apps/tv-android/**`（qoder）；❌ `custom-server/**`、`server/**`（codex）
- ❌ `shared/content-core/hongguo.js`、`shared/recommendation-core.cjs`、同步协议（**codex 唯一写者**）
- ❌ **不得为"修兼容"去改共享引擎**；若发现引擎层问题，**报告交 codex**，不自行改

## 七、构建与设备纪律

- **构建互斥**：同一副本一次只允许一次 Android Gradle 构建。开工前查 `java.exe`/Gradle daemon，
  在 `.agents/shared/` 写占用记录，**用完释放**。
- 设备：先 `node .agents/cli.mjs mumu declare <设备> workbuddy "t-v102-mobile-compat"`，**用完 `mumu release`**。
- 尊重去重规则（见 3.2）；请勿同时占用多台同 API 设备。
- **不自行释放他人锁**；不改他人任务状态。

## 八、明确不做

- ❌ **不提交、不推送、不打 tag、不发布**（由 DSH 统一）
- ❌ 不擅自更换技术栈或降 minSdk（遇阻塞停下报告，交 DSH）
- ❌ 不创建 iOS 工程
- ❌ 不把模拟器结果冒充 ARM 真机 / API 24 结论
- ❌ 不删除他人报告、证据或锁

## 九、验收标准

1. 兼容性矩阵完整：**系统 × 屏幕（标尺寸覆盖）× 功能项**，每格实测值或「未测（原因）」
2. `aapt badging` 的 ABI 列表已核对，**是否含 arm64-v8a 有明确结论**
3. **全屏 / 混合内容 / 触控 / 自动播放 / 生命周期**五项有**设备实测**结论
4. **HEVC 与 API 24 明确标注未验证**及原因；**未用模拟器冒充真机结论**
5. 报告如实区分【实测】/【未实测】，含缺陷清单（严重度+复现+证据路径）
6. `apps/web-pc`、`shared/`、`apps/tv-android` **零改动**（DSH 用 `git diff` 复核）
7. 设备已全部释放；构建占用记录已释放
