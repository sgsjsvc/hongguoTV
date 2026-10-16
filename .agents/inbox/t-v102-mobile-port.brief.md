# T4 手机端（仅 Android）基于 Web 代码移植 —— 可行性验证与目录落地

- **任务ID**: `t-v102-mobile-port`
- **assignee**: `workbuddy`（手机端主责）
- **依赖**: 无
- **是否属本次发布**: ❌ **否**。用户已明确「本次发布不包含手机端」。本任务为**独立推进流**，不得阻塞或混入 `t-v102-rebuild` 的发布产物。

## 用户已定决策（2026-10-16，DSH 记录）

1. **平台**：手机端**只做 Android**，不含 iOS（Windows 宿主亦无 iOS 工具链）。
2. **实施方式**：**直接复制/移植 Web 端（`apps/web-pc/src`）代码做手机兼容，不从零编写。**

这两条已写入 `.agents/RESPONSIBILITIES.md`。

## DSH 的架构决定（本任务据此执行）

| 项 | 决定 | 理由 |
| --- | --- | --- |
| **手机专属目录** | **`apps/mobile/`** | 与六领域路由一致（`.agents/team.mjs` 已把 `apps/mobile/**` 划归 workbuddy） |
| **移植对象** | `apps/web-pc/src/**`（React/TS 界面与状态层）与 `apps/web-pc/dist` 构建产物 | 用户要求复用 Web 代码 |
| **既有 Web 工程本体** | **禁止修改** `apps/web-pc/**`（antigravity 主责，避免双写冲突） | RESPONSIBILITIES 共同边界 2 |
| **共享逻辑** | **禁止复制** `shared/content-core/hongguo.js`、`shared/recommendation-core.cjs`、同步协议 | 引擎/推荐核心**唯一写者为 codex**；重复维护会产生多份引擎 |
| **后端** | 复用既有 `custom-server` 接口，**不新建手机端后端** | 同上 |

## 本任务目标（两段式，先验证后落地）

### 第一段：可行性验证（必须先做，产出结论后再动代码）

按用户"复制 Web 代码"的思路，Android 上承载 Web 代码的现实路径是**WebView 容器**（Capacitor / Cordova 一类）或 WebView + 本地服务。请**实测本机条件**并如实报告，不要预设能用：

1. 工具链实测：`java -version`、`adb`、Android SDK/NDK、Gradle 缓存、**是否可安装 `@capacitor/core`/`@capacitor/android` 或 `cordova-android`**（当前实测三者**均未安装**，需联网获取）
2. 网络可达性：npm registry、dl.google.com、Maven Central（此前实测可达；`storage.flutter-dev.cn` 502）
3. 确认 **WebView 路线在 Android 5.1.1(API 22) 上的可行性**（本项目 TV 端最低 API 22；手机端最低 API 若沿用 22 需说明 WebView 内核版本限制）——若结论是"API 22 不可行"，**如实报告并给出建议的最低 API**，不要擅自降低兼容承诺
4. 明确回答：**是否确实可以只"复制 Web 代码"而无需重写界面？** 若不行的部分（如触控手势、横竖屏、生命周期、本地存储差异），**逐项列出**需适配点

**第一段产出**：`.agents/shared/t-v102-mobile-port-workbuddy.md`，含命令、原始输出、可/不可行结论、需适配清单、最低 API 建议。

### 第二段：落地（**仅在 DSH 明确放行后开始**）

第一段结论交 DSH 复核后，DSH 再决定是否开第二阶段。**本任务收到第一段报告即视为交付本阶段**，不要自行进入大规模实现。

## 明确不做

- 不修改 `apps/web-pc/**`（含 src、electron、vite 配置）
- 不复制共享引擎/推荐核心/同步协议到手机目录
- 不创建 iOS 工程、不选 iOS 工具链
- 不把 TV 工程改作手机端
- **不构建、不发布**任何手机产物到本次 v1.0.2 发布（用户已排除）
- 不提交、不推送（由 DSH 统一提交）
- 若需设备：先 `mumu declare` 后使用、用完 `mumu release`；遵守 Gradle/打包互斥

## 验收

- 第一段报告含**真实命令与原始输出**，明确区分【实测】/【未实测】
- 明确回答"能否只复制 Web 代码"，以及需适配项清单与最低 API 建议
- 未擅自创建工程目录或写入 `apps/web-pc`
- 未触碰共享引擎
