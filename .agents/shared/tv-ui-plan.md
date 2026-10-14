# TV UI 自适应与布局优化 — 任务规划（v2）

**协调者**: dsh
**日期**: 2026-10-13
**范围**: `apps/tv-android/` Kotlin UI 层。**不触碰 `shared/content-core/hongguo.js`**，不触发共享引擎隔离问题。

---

## 重要前置发现

Antigravity **此前已完成一轮 TV UI 优化**（计划见其会话产物 `tv_ui_optimization_plan.md`）。经核对当前代码，**已落地**：

| 功能 | 状态 | 代码位置 |
| --- | --- | --- |
| 底部半透明选集抽屉 | ✅ 已落地 | `MainActivity.kt:88-90`、`buildEpisodeDrawer` |
| 居中 Seek HUD | ✅ 已落地 | `MainActivity.kt:74-76`、`buildSeekHud` |
| 集数分组 Tab（替代弹窗） | ✅ 已落地 | `MainActivity.kt:90`、`723-724` |
| 操作栏视觉分级 | ✅ 已落地 | `tv_reordered_actions.png` |

**未落地**：焦点外发光、拼音首字母键盘、历史进度胶囊。

**关键缺口**：Antigravity 的原计划**完全没有"多分辨率自适应"** —— 这正是本轮的新需求，不存在重复劳动。

---

## 现状诊断（已核实）

### E1. 零屏幕适配 ← 本轮核心

| 检查项 | 结果 |
| --- | --- |
| `res/values/dimens.xml` | **不存在** |
| `res/values-sw600dp/`、`values-w1280dp/` | **不存在**（仅单一 `values/`） |
| `dp()` 硬编码调用点 | **108 处**（`MainActivity.kt`） |
| XML 布局文件 | **0 个**（UI 全代码构建） |
| `res/` 子目录 | 仅 `drawable*`、`mipmap-*`、`values` |

所有尺寸按 1080p 调死。720p 电视拥挤，4K 电视偏小。

### E2. 布局结构

`MainActivity.kt` = **1835 行**，UI 构建与业务逻辑混杂。用户已确认要重组。

### E3. 遥控器

`onKeyDown`（1691–1825）已覆盖 `DPAD_*`、`ENTER`、`SPACE`、`MENU`、`MEDIA_PLAY_PAUSE`、`BACK`。

**未覆盖**：`MEDIA_NEXT` / `MEDIA_PREVIOUS` / `MEDIA_FAST_FORWARD` / `MEDIA_REWIND`、数字键、`CHANNEL_UP` / `CHANNEL_DOWN`。

**长按 seek 缺陷**：用 `System.currentTimeMillis()` 1200ms 时间窗累加（1757–1762），非 `event.repeatCount`，行为随遥控器重复率漂移。

---

## 用户已确认的范围

- ✅ 屏幕自适应（尺寸资源化）
- ✅ 布局结构重组（拆分 1835 行单文件）
- ✅ 统一各页面布局风格
- ❌ 遥控器按键补齐（**本轮未选**，见下方说明）
- 验证设备：**模拟器 `emulator-5554`**

> 遥控器项用户未勾选。但 E3 的长按缺陷会影响布局重组后的焦点行为，故列入**观察项**，不主动改，除非重组过程中必须触及。

---

## 任务划分

原则：**每个文件同一时间只有一个修改者**（QUICKSTART 第 13 行）。

### 文件归属表

| 文件 | 修改者 |
| --- | --- |
| `res/values/dimens.xml`（新建） | **antigravity** |
| `res/values-sw600dp/dimens.xml`（新建） | **antigravity** |
| `res/values-w1280dp/dimens.xml`（新建） | **antigravity** |
| `TvUi.kt` | **antigravity** |
| `MainActivity.kt` | **antigravity** |
| `ui/` 下新建的拆分文件 | **antigravity** |
| `app/src/test/**/*Test.kt` | **antigravity** |
| 复核报告 | **workbuddy** |

**本轮 `apps/tv-android/` 全部归 antigravity 独占。** Codex 不参与 —— 其定位是后端/算法，TV UI 层无可复用改动；分给多人会造成 `MainActivity.kt` 同文件冲突。

### 串行要求

尺寸资源化与布局重组**都改 `MainActivity.kt`**，必须串行，不可并行：

```
T1  尺寸资源化（dimens + TvUi + MainActivity 替换 108 处 dp）
T2  布局重组（拆分单文件、统一页面风格）   ← 依赖 T1
T3  单测 + lint + 构建                    ← 依赖 T2
T4  独立复核（workbuddy）                 ← 依赖 T3
T5  模拟器多分辨率验证（dsh）              ← 依赖 T4
```

---

## 验收标准

### A. 屏幕适配

1. `res/values/dimens.xml` 存在，`MainActivity.kt` 中**硬编码字面量 dp 调用归零**
2. 至少 3 档尺寸资源：基准 / `sw600dp` / `w1280dp`
3. **模拟器实测**至少两种分辨率（如 1280×720、1920×1080）下：无重叠、无截断、无溢出
4. 关键元素（顶部导航、操作栏、进度条、选集抽屉）在各分辨率下均可见可聚焦

### B. 布局重组

5. `MainActivity.kt` 行数显著下降，UI 构建代码迁至独立文件
6. 各页面（首页 / 目录 / 详情 / 设置 / 搜索）布局风格统一
7. **无功能回归**：现有抽屉、Seek HUD、分组 Tab 行为不变

### C. 回归

8. `./gradlew :app:testDebugUnitTest` 通过（现有 JVM 19 项不得减少）
9. `./gradlew :app:lintDebug` 通过（项目 `abortOnError = true`）
10. `./gradlew :app:assembleDebug` 通过

### D. 验证纪律

11. **不以"构建成功"替代实际显示验证**（QUICKSTART 第 35 行）
12. 截图需能对应到明确的构建版本（记录构建时间或 APK 哈希）

---

## 已知风险

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| 模拟器无真实硬件解码器 | 只能验证布局，不能验证播放 | 播放验证仍以 192.168.1.120 为准 |
| 模拟器是 API 22 还是新版？ | 需确认，API 22 布局行为与新版有差异 | 派发前先探测 |
| `lint abortOnError=true` | 新增资源可能触发规则 | 每步先跑 lint |
| 1835 行改动面大 | 易漏改误改 | 逐段替换 + `git diff` 核对 |
| 资源限定符选择 | `sw600dp` 按最小宽度，电视多横屏 | 以宽度限定符 `w1280dp` 为主 |

---

## 执行顺序与依赖

```
T1 (antigravity) ──> T2 (antigravity) ──> T3 (antigravity) ──> T4 (workbuddy) ──> T5 (dsh)
```

**尚未派发。** 等待用户确认后写入 inbox。
