# T7 手机端 UI 彻底重构（短视频流式，竖屏）

- **任务ID**: `t-v102-mobile-redesign`
- **assignee**: `workbuddy`（手机端主责）
- **依赖**: 无（T5 `t-v102-mobile-stage2` 已由 DSH 叫停，T6 `t-v102-mobile-compat` 已由 DSH 取消；无在途冲突）
- **性质**: **UI 层彻底重写**。保留已建成的 Capacitor 工程底座，**推倒现有界面**，按本文规格重新设计。

---

## 一、用户决策（2026-10-17，取代此前指令）

| 项 | 决定 |
| --- | --- |
| 技术路线 | ✅ **保留 Capacitor + React**（不换 Kotlin/Compose，不换 Flutter） |
| 重构范围 | ✅ **仅重写 UI 层**；工程/桥接/数据层复用 |
| UI 目标风格 | ✅ **短视频流式**（对标抖音/快手）：竖屏单列大图信息流、推荐页全屏自动播放、**上下滑切剧**、底部少量 Tab |
| 验收 | ✅ **必须设备实测**（启动→首页→播放→切集，截图取证） |

⚠️ 本次**取代**用户此前「直接复制 Web 端代码做兼容」的指令。**不再以"复用桌面 UI"为目标。**

---

## 二、为什么重构（DSH 实测的失败根因，供你避免重蹈）

现有 UI 是**把桌面/TV 界面塞进手机**，实测证据：

| 证据 | 实测值 |
| --- | --- |
| `Header.tsx` 使用 `tv-nav-item` 类 | **复用了 TV/桌面导航样式** |
| 顶部导航 7 个按钮横排 + `overflow-x-auto` | 桌面式横向导航，**非手机式** |
| `Header.tsx` 中 `md:` 断点 | **24 处** → 桌面优先（desktop-first），非 mobile-first |
| 底部导航栏 | **0 处**（无 bottom tab） |
| `index.css` 自适应处理 | 仅 2 行（`tap-highlight`/`touch-action`），**无 layout 适配** |
| `RecommendStream.tsx` | 42 KB 桌面推荐流直接搬入 |

**结论**：问题不在 WebView 技术，而在**UI 是桌面形态**。本次必须从**手机使用场景**出发重新设计。

---

## 三、唯一写者范围（严格分层）

### ✅ 允许改（UI 层，全部重写）

- `apps/mobile/src/App.tsx`
- `apps/mobile/src/index.css`
- `apps/mobile/src/components/`**下全部界面组件**（`Header.tsx`、`HomePanel.tsx`、`CategoryPanel.tsx`、`RankPanel.tsx`、`SearchPanel.tsx`、`LibraryPanel.tsx`、`SettingsPanel.tsx`、`PlayerModal.tsx`、`RecommendStream.tsx`）
- `apps/mobile/src/hooks/useKeyboardShortcuts.ts`（手机无键盘，需重做或废弃）
- `apps/mobile/tailwind.config.cjs`、`index.html`

### ✅ 允许改（新增手机专用 UI 组件）

- `apps/mobile/src/components/**` 下**新建**任何手机向组件（建议命名见第五节）

### ⚠️ 谨慎改（数据/逻辑层 —— **默认保持，只在 UI 需要时做最小适配**）

| 文件 | 说明 |
| --- | --- |
| `src/api.ts` | 含后端基址解析改造；**接口契约不得改**（受 `custom-server` 约束） |
| `src/hooks/usePlayback.ts` | 播放状态机；**可改调用方式，不重写业务语义** |
| `src/hooks/useStreamFeed.ts` | 推荐流数据；**上下滑切剧需要它配合，可最小改** |
| `src/hooks/useCatalog.ts`/`useLibrary.ts`/`useSearch.ts`/`useSync.ts` | **保持** |
| `src/native/fullscreen.ts` | **保持**（已实现原生全屏桥接） |
| `src/components/BackendSetup.tsx` | **保持**（后端地址配置 UI，逻辑来自第一段适配） |
| `src/types.ts`、`video-state.ts`、`library-journal.mjs`、`history-outbox.mjs`、`recommendation-session.mjs` | **保持不动** |

### ❌ 禁止改

- ❌ `apps/web-pc/**`（antigravity 领域）
- ❌ `apps/tv-android/**`（qoder 领域）
- ❌ `custom-server/**`、`server/**`（codex 领域）
- ❌ `shared/content-core/hongguo.js`、`shared/recommendation-core.cjs`、同步协议 —— **codex 唯一写者**；
  若发现引擎层问题，**报告交 codex，不自行改**
- ❌ `apps/mobile/android/**`（Capacitor 生成的 Android 工程）——**除非** UI 重构确需改
  `AndroidManifest`/`styles`（如沉浸式状态栏、屏幕方向锁定），此时**在报告中单独说明每一处改动及理由**

**改 `android/**` 的任何一行都必须在报告中列明**（DSH 会重点复核该目录）。

---

## 四、必须实现的设计规格（短视频流式）

### 4.1 整体结构

```
┌─────────────────────────┐
│  沉浸式状态栏（透明）      │  ← 不用固定 Header 横排导航
├─────────────────────────┤
│                         │
│   内容区（竖屏单列）       │  ← 主体，随 Tab 切换
│                         │
├─────────────────────────┤
│  底部 Tab（3-5 个）       │  ← 首页 / 分类 / 追剧 / 我的（数量可调，但必须底部）
└─────────────────────────┘
```

### 4.2 硬性设计要求

| # | 要求 | 说明 |
| --- | --- | --- |
| 1 | **底部 Tab 导航** | **必须**。替换现有顶部 7 按钮横排。Tab 数量 3–5 个，图标+文字，当前项高亮 |
| 2 | **竖屏优先（mobile-first）** | 默认竖屏；**不得**以 `md:`/`lg:` 桌面断点为主要布局依据 |
| 3 | **推荐页 = 全屏视频流** | 单列、每屏一条、**上下滑切换**；视频 `object-fit: cover` 铺满 |
| 4 | **上下滑切剧** | 手势滑动切换上/下一部（不是点击分页按钮）。可用 CSS `scroll-snap` 或触摸手势实现 |
| 5 | **自动播放当前项** | 进入视口的项自动播放；离开视口暂停。**必须处理移动端自动播放限制**：失败时要**可观测报错**，不许 `play().catch(()=>{})` 静默吞错 |
| 6 | **座椅式操作区** | 右侧/底部竖排操作（收藏、清晰度、静音、分享等），符合单手可达 |
| 7 | **触控优先** | 所有主要操作可用点按/滑动完成；**无键盘依赖**（`useKeyboardShortcuts` 不得作为唯一路径） |
| 8 | **安全区适配** | 必须用 `env(safe-area-inset-*)` 处理刘海/挖孔/手势条；`viewport-fit=cover` 已设 |
| 9 | **触控目标尺寸** | 可点区域 **≥ 44×44 px**（手机可用性底线） |
| 10 | **去 TV 痕迹** | **删除** `tv-nav-item` 等 TV/桌面类名与 `focus:ring-*` 遥控器焦点样式 |
| 11 | **播放器横屏** | 详情/播放页支持旋转横屏全屏；用 `src/native/fullscreen.ts` 的桥接 |
| 12 | **列表页（分类/榜单/追剧）** | 手机式**网格海报流**（2–3 列），非桌面多列密集网格 |
| 13 | **搜索页** | 大输入框 + 键盘友好；搜索历史/联想适合手指点按 |
| 14 | **设置页** | 移动端表单化（大行高、开关控件），含后端地址入口 |
| 15 | **加载态与空态** | 骨架屏/占位、空列表提示、网络错误可重试（**明确错误，不伪装空成功**） |

### 4.3 设计语言约束（视觉）

- **保持项目现有暗色基调**（`#070a12`/`#090d16` 系）与品牌色（rose/amber 渐变），**不引入大幅配色变更**，以便与 Web/TV 端保持产品一致性
- 允许重构**排版、间距、圆角、层级**；这是"重新设计"的部分
- **不做**：复杂动画库、新 UI 框架（如 MUI/Ant）、暗/亮双主题（除非时间充裕）

### 4.4 建议的组件结构（供参考，可调整）

```
src/components/
  mobile/
    BottomTabBar.tsx        底部 Tab 导航
    VideoFeed.tsx           全屏竖滑视频流（推荐页主体）
    VideoFeedItem.tsx       单条：视频 + 信息 + 右侧操作
    PosterGrid.tsx          网格海报流（分类/榜单/追剧复用）
    PageHeader.tsx          轻量页内标题（非全局横排导航）
    TouchControls.tsx       播放器触控层
    Sheet.tsx               底部弹出面板（清晰度/选集/设置）
    LoadingState.tsx        骨架屏/空态/错误重试
  BackendSetup.tsx          （保留）
```

`App.tsx` 改造为**底部 Tab 容器**，去掉顶部 7 按钮导航。

---

## 五、必须复用的既有能力（不要重造）

| 能力 | 位置 | 说明 |
| --- | --- | --- |
| 后端地址配置 | `src/components/BackendSetup.tsx` | 局域网 IP:端口引导 |
| 原生全屏桥接 | `src/native/fullscreen.ts` | WebView `onShowCustomView` 相关 |
| 播放状态机 | `src/hooks/usePlayback.ts` | 进度/清晰度/连播 |
| 推荐流数据 | `src/hooks/useStreamFeed.ts` | 供竖滑流使用 |
| 资料库/同步 | `useLibrary.ts`、`useSync.ts`、`library-journal.mjs`、`history-outbox.mjs` | 不动 |
| 推荐会话 | `src/recommendation-session.mjs` | 不动 |
| Capacitor 配置 | `capacitor.config.ts`（cleartext/http/allowMixedContent 已配） | 除非必要不改 |
| 图标/启动屏脚本 | `.icon-gen.py`、`.splash-gen.py` | 已有，可复用 |

⚠️ **不得**把 `shared/` 引擎或推荐核心复制成第二份来"配合 UI"。UI 只消费 `api.ts` 暴露的数据。

---

## 六、必须设备实测（用户明确要求）

### 6.1 设备与去重规则（用户 2026-10-17）

**「测试时相同系统不进行测试」** → 实测后需测级别仅 2 个：

| API | 代表设备（取一台） |
| --- | --- |
| **API 32** | `mumu-d1`（16384）/ `mumu-d3`（16448）/ `mumu-d4`（16480）—— **三台同 API，只测一台** |
| **API 35** | `mumu-d2`（16416，唯一） |

- `mumu-d1` 与 `mumu-d4` 型号+API 相同（`23113RKC6C`/API32/Android12），仅屏幕不同 → 取其一；
  **若为覆盖尺寸额外测，须显式标注"尺寸覆盖，非系统重复"**。
- 设备命令：`node .agents/cli.mjs mumu declare <设备> workbuddy "t-v102-mobile-redesign"`，**用完 `mumu release`**。

### 6.2 必须实测的流程（每个代表机各跑一遍）

1. **安装 → 启动** → 无崩溃，冷启动耗时记录
2. **底部 Tab 切换**：每个 Tab 都能打开且渲染（截图）
3. **首页/推荐流**：竖滑**至少切换 3 条**，自动播放生效（截图 ×3）
4. **详情 → 播放**：**真实画面 + 字幕**（截图），记录实际播放时长
5. **清晰度切换** → 切换后仍可播放
6. **横屏全屏**：旋转后全屏可用
7. **收藏/追剧**：操作后落盘，重进可见
8. **logcat 全程**：无 `FATAL EXCEPTION` / ANR
9. **触控抽查**：主要按钮可点、无误触；核对无"只能在桌面鼠标操作"的残留

证据落盘：`outputs/testing/mobile-redesign-20261017/<设备>-<场景>-<状态>.png|.xml`

### 6.3 🔴 无法验证的项（必须如实标注，禁止冒充）

| 项 | 原因 |
| --- | --- |
| **arm64-v8a 真机行为** | 4 台模拟器**全为 x86_64**；无 ARM 真机 |
| **HEVC 硬解** | 同上，模拟器不能代表真实手机 |
| **API 24–31 下限** | 无该区间设备（声明 minSdk 24，但下限不可测） |
| **真实手机刘海/挖孔** | 无手机真机，模拟器无真实开孔 |

**报告必须逐项标注"未验证（原因）"，不得用 x86_64 模拟器结果声称真机结论。**

---

## 七、构建与协作纪律

- **构建互斥**：同一副本一次只允许一次 Android Gradle 构建。开工前沿用既有占用记录流程
  （`.agents/shared/`），**用完释放**。
- 设备先 declare 后用后 release；不越权释放他人锁。
- **不提交、不推送、不打 tag、不发布**（由 DSH 统一）。
- 不改他人任务状态；不删除他人报告/证据。

## 八、明确不做

- ❌ 不换技术栈（保持 Capacitor + React）
- ❌ 不动 `apps/web-pc`、`apps/tv-android`、`shared/` 引擎、`custom-server`
- ❌ 不创建 iOS 工程
- ❌ 不擅自改 `apps/mobile/android/**`（如确需，逐条列明理由）
- ❌ 不把模拟器结果冒充真机结论
- ❌ 不引入新 UI 框架

## 九、交付物

1. **重构后的 UI 代码**（第三节 ✅ 范围内的文件）
2. **设计说明**：新 UI 的结构图、Tab 划分、关键页面交互（可放报告内）
3. **报告**：`.agents/shared/t-v102-mobile-redesign-workbuddy.md`
   - 含：改动文件清单（**逐文件说明"重写/新建/最小改/保留"**）、`android/**` 改动逐条理由、
     设计决策与取舍、**设备实测矩阵**、缺陷与**未完成项**、所有**未验证项**
4. **结果**：`.agents/outbox/t-v102-mobile-redesign.json`

## 十、验收标准

1. **底部 Tab 导航存在且可用**；**顶部 7 按钮横排导航已移除**（截图对比取证）
2. **推荐页为竖屏全屏视频流**，**上下滑至少切换 3 条**且自动播放（截图 ×3）
3. **`tv-nav-item` 等 TV 类名已清除**；**无 `md:`/`lg:` 作为主要布局依据**（DSH 会用 grep 复核）
4. 安全区（`env(safe-area-inset-*)`）已适配；可点区域 ≥44px
5. **API 32 与 API 35 各一台实测通过**：安装→启动→Tab→首页→播放（真实画面）→清晰度→横屏
6. **无 `FATAL EXCEPTION`/ANR**；冷启动耗时已记录
7. 视觉**保持暗色基调与品牌色**（与 Web/TV 一致性）
8. `apps/web-pc`、`apps/tv-android`、`shared/`、`custom-server` **零改动**（DSH 用 `git diff` 复核）
9. 设备已全部释放；构建占用记录已释放
10. 报告如实区分【实测】/【未验证】，未完成项明确列出
