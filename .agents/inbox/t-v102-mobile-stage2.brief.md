# T5 手机端第二段：建 `apps/mobile`（Capacitor）并完成安卓实测

- **任务ID**: `t-v102-mobile-stage2`
- **assignee**: `workbuddy`（手机端主责）
- **依赖**: 无（第一段可行性验证 `t-v102-mobile-port` 已 done）
- **性质**: 实现 + 自测。**不属 v1.0.2 发布**（v1.0.2 已发布，本任务成果留待后续发布）
- **放行依据**: 用户 2026-10-17 选择「手机端第二段：建 apps/mobile 并测」

## 一、已定决策（沿用第一段结论与被批准的方向）

| 项 | 决定 | 来源 |
| --- | --- | --- |
| 平台 | **仅 Android**，不含 iOS | 用户 2026-10-16 |
| 实施方式 | **移植/复制 Web 端代码**，不从零编写 | 用户 2026-10-16 |
| 技术栈 | **Capacitor 8**（实测可安装；`@capacitor/android` 8.5.3） | 第一段实测 + 用户本次放行 |
| **minSdk** | **24（Android 7.0）** | 第一段建议：Capacitor 8 默认 24；**不沿用 22**（WebView 内核停更，且 API22 真机 offline） |
| 专属目录 | **`apps/mobile/`** | DSH（路由已预留，`.agents/team.mjs` 中 `apps/mobile/**` 归 workbuddy） |

⚠️ **若你实测发现 Capacitor 8 在此构建环境有硬阻塞**（例如 CLI/AGP/JDK 不兼容），
**不要自行改用其它技术栈**——停下来在报告中给出证据与备选建议，交 DSH 决定。

## 二、唯一写者范围（严格）

**允许新建/修改**：

- `apps/mobile/**`（全新目录，你的专属领域）
- `.agents/shared/t-v102-mobile-stage2-workbuddy.md`（报告）
- `.agents/outbox/t-v102-mobile-stage2.json`（结果）

**禁止修改**（重要，防双写冲突）：

- ❌ `apps/web-pc/**`（antigravity 领域，含 src / electron / vite.config.ts / package.json）
- ❌ `shared/content-core/hongguo.js`、`shared/recommendation-core.cjs`、同步协议
      —— **共享逻辑唯一写者是 codex**，**只可引用/复制到 mobile 的构建输入，不得维护第二份引擎**。
      实践上：优先经 vite `@shared` 别名直接引用仓库根的 `shared/`，**不要**把引擎源码复制进 `apps/mobile` 后独立演进。
- ❌ `apps/tv-android/**`（qoder 领域）
- ❌ `custom-server/**`、`server/**`（codex 领域）

## 三、必须做

### 3.1 建工程

1. 建 `apps/mobile/`，**从 `apps/web-pc` 移植**：`src/**`、`vite.config.ts`、`tsconfig.json`、`index.html`、`tailwind.config`（若有）、`postcss.config`（若有）
2. `apps/mobile/package.json`：**剔除 electron / electron-builder / cross-env**；依赖与 web-pc 对齐（react 18.3.1、react-dom、axios、lucide-react + vite 6、ts、tailwind、@vitejs/plugin-react）；**加 Capacitor 依赖**
3. `vite.config.ts`：`base: "./"` 保留；**`server.proxy` 仅用于本地 dev，产物不依赖它**；保留 `@shared` 别名指向仓库根 `shared/`（按相对路径自算层级）
4. Capacitor 初始化：应用 ID 建议 `com.hongguotv.mobile`、应用名「红果短剧」、`webDir` = vite 产物目录；`npx cap add android`；**minSdk 24**
5. 应用外壳：图标、启动屏、版本号与项目版本策略对齐（**版本号写 1.0.2 或由 DSH 后定，不要自造**）

### 3.2 必须适配的项（第一段已列出 11 项，逐项处理并在报告中标记完成状态）

按第一段报告第四节施工，**至少完成下列高优先级项**：

1. **后端基址解析**（必须）：`api.ts` 中 `window.location.protocol === "file:"` 的分支在 Capacitor 容器**不命中**；
   改为显式后端基址：读 settings → 无则**引导用户输入局域网 IP:端口**；axios `baseURL` 与视频直链同源处理
2. **明文 HTTP 许可**（必须）：后端为 LAN `http://`；配置允许 cleartext（Capacitor `server.cleartext` / network security config）
3. **触控交互**（必须）：手机无键盘；`useKeyboardShortcuts` 的键位映射不得作为唯一操作方式；补触控手势
4. **HTML5 全屏 spike**（必须，优先）：`requestFullscreen()` 在 Android WebView 需宿主 `WebChromeClient.onShowCustomView`；
   **先做 spike 实测**，必要时用自定义桥/插件
5. **自动播放策略**（必须）：`video.play().catch(()=>{})` 的静默吞错在移动端会掩盖失败；改为可观测错误
6. **横竖屏与布局**（必须）：手机竖屏为主，核对各页布局不溢出/不遮挡
7. **生命周期**（建议）：后台音频焦点、回前台恢复、MediaSession
8. **HEVC 真机解码**（必须，验收前）：上游清晰度多为 HEVC；WebView 走平台 MediaCodec，**随机型而异**；
   **必须在真机/目标机型验证**，失败则如实报告（不要声称可播）

### 3.3 构建与实测

1. `npm run build`（tsc + vite）在 `apps/mobile` 内通过
2. Capacitor 同步 + Gradle 构建 APK（**构建互斥：同一副本一次只允许一次 Android Gradle 构建**；开工前查 `java.exe`/daemon，在 `.agents/shared/` 写占用记录，用完释放）
3. **设备实测**（先 `mumu declare` 后用、用完 `mumu release`）：
   - 至少一台在线模拟器（`mumu-d1` API32 / `mumu-d2` API35 / `mumu-d3` API32）完成：安装 → 启动 → 首页 → 分类/榜单 → 详情 → **真实播放** → 清晰度切换 → 连播 → 历史
   - 截图与 UI 层级证据落盘 `outputs/testing/mobile-stage2-20261017/`
   - `logcat` 无 `FATAL EXCEPTION` / ANR
4. **注意**：`mumu-r`（API22 真机）**offline**；本任务 minSdk 24，**不需要也不得声称 API 22 验证**。

## 四、报告与结果

- 报告：`.agents/shared/t-v102-mobile-stage2-workbuddy.md`
- 结果：`.agents/outbox/t-v102-mobile-stage2.json`

报告须含：环境与命令、`apps/mobile` 目录结构、**移植清单（哪些文件直接复制、哪些改了、为什么）**、
11 项适配的逐项完成状态（已完成/未完成/spike 结论）、构建日志、**设备实测矩阵**、
**缺陷与未完成项**（明确区分【实测】/【未实测】）、以及**未经验证的假设**。

## 五、明确不做

- ❌ 不懂 `apps/web-pc` 本体（移植是"复制后在新目录适配"，不是改 web-pc）
- ❌ 不复制引擎/推荐核心为第二份可独立演进的实现
- ❌ 不创建 iOS 工程、不选 iOS 工具链
- ❌ 不改 TV 工程、不改后端
- ❌ **不打 tag、不推送、不发布**（发布由 DSH 决定；本次成果不并入已发布的 v1.0.2）
- ❌ 不擅自更换技术栈（遇阻塞停下报告，交 DSH）
- ❌ 不删除他人报告/证据/锁；不越权释放他人设备

## 六、验收

- `apps/mobile/` 建成，`npm run build` 通过，能产出 Android APK
- **至少一台设备上完成真实播放**（非仅安装/HTTP 成功），有截图与 logcat 证据
- 第三节高优先级适配项有逐项结论；**全屏与 HEVC 两项必须有实测结论**
- `apps/web-pc`、`shared/`、`apps/tv-android` **零改动**（DSH 会用 `git diff` 复核）
- 设备已全部释放；构建互斥已遵守（占用记录已释放）
- 报告如实区分【实测】/【未实测】，未完成项明确列出
