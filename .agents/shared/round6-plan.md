# 第六轮需求规划：TV 端切剧轻量提示与加载动画

**协调者**: dsh
**日期**: 2026-10-14
**范围**: **仅 TV 端**（`apps/tv-android/`）
**用户需求**：

1. 上下键切剧时**只显示剧名**，不显示整个菜单
2. 同剧自动下一集时**不显示菜单**
3. **增加加载动画**

> **范围说明**：用户明确「只针对 TV 端修改」。Web / PC / Windows 端**不在本轮范围**。

---

## 一、根因分析（已核实）

### 需求 1：上下键切剧显示整个菜单

**根因**：`MainActivity.kt:833`（`selectFeed()` 内）

```kotlin
revealChrome(); infoTitle.text = "@${series.title} · 加载中"
```

`revealChrome()` 显示**全部** chrome：

```kotlin
private fun revealChrome() {
    topHeader.visibility = ...       // 顶部导航（推荐/搜索/分类/榜单/追剧/历史/设置）
    feedOverlay.visibility = ...     // 底部操作栏 + 简介 + 标签
    progressBox.visibility = ...     // 进度条
    scrimTopView.visibility = ...    // 上渐变
    scrimBottomView.visibility = ... // 下渐变
}
```

### 需求 2：自动下一集显示菜单

**根因**：`episodeEnded():794` → `loadEpisode()` → `:755` 与 `:772` 调 `revealChrome()`

### 需求 3：无加载动画

现状：只有文字 `"@${series.title} · 加载中"`，**无动画**。

---

## 二、⚠️ 关键约束一：不能改 `revealChrome()`

它有 **9 个调用点**，其中 **7 个需要完整 chrome**：

| 行 | 所在函数 | 场景 | 需要完整 chrome |
| --- | --- | --- | --- |
| 452 | `hideEpisodeDrawer()` | 关闭抽屉 | ✅ |
| **755** | **`loadEpisode()`** | 换集准备 | ❌ 只要剧名 |
| 709 | `onIsPlayingChanged()` | 播放状态变化 | ✅ |
| **772** | **`loadEpisode()`** | 准备完成 | ❌ 只要剧名 |
| 781 | `playbackError()` | 播放错误 | ✅ |
| **833** | **`selectFeed()`** | **上下键切剧** | ❌ 只要剧名 |
| 879 | `feedError()` | 推荐错误 | ✅ |
| 932 | `returnToFeed()` | 返回首页 | ✅ |
| 1325 | `back()` | 返回键 | ✅ |
| 1374 | `onKeyDown()` | **用户按 MENU** | ✅ |

**结论**：**新增**轻量提示层，**不修改 `revealChrome()` 本身**。

---

## 三、⚠️ 关键约束二：`loadEpisode` 有 13 个调用点

| 调用点 | 场景 | 显示轻量提示 |
| --- | --- | --- |
| `episodeEnded():794` | **自动下一集** | ✅ |
| `selectFeed():840` | **切剧后首次加载** | ✅（由 selectFeed 统一处理） |
| `onNextEpisodeClick:301` | 用户点「下一集」 | ❌ |
| `chooseQuality:900` | 选画质 | ❌ |
| `onPlayerError:728` | 重试 | ❌ |
| `returnToFeed:930` | 返回首页 | ❌ |
| 其他 | 恢复/初始化 | ❌ |

**结论**：**在调用点控制**，不改 `loadEpisode` 内部逻辑。

---

## 四、任务划分（仅 TV 端）

| ID | 内容 | 负责人 | 文件 |
| --- | --- | --- | --- |
| **S1** | 轻量提示层 + 加载动画 + 三处替换 | **antigravity** | `MainActivity.kt`、`ui/SwitchHintView.kt`（新建）、`res/values*/dimens.xml` |
| **S2** | 独立复核 S1 | **workbuddy** | 只读 |

### 文件归属

| 文件 | 负责人 |
| --- | --- |
| `apps/tv-android/.../MainActivity.kt` | antigravity |
| `apps/tv-android/.../ui/SwitchHintView.kt`（新建） | antigravity |
| `apps/tv-android/app/src/main/res/values*/dimens.xml` | antigravity |
| 复核报告 | workbuddy |

**无并行冲突** —— 全部集中在 TV 端，串行执行。

---

## 五、方案设计

### 5.1 轻量提示层 `switchHint`

```
┌──────────────────────────────────┐
│  @剧名  全N集                    │
│  第 N 集 · 《剧名》              │
│  ⟳ 加载动画                      │
└──────────────────────────────────┘
```

- **位置**：屏幕中下方（参照现有 `pauseIndicator` / `seekHud` 的位置与风格）
- **关键属性**：`isFocusable = false`（**不抢焦点**）
- **背景**：半透明圆角（与现有 HUD 一致）

### 5.2 加载动画

```kotlin
val rotate = ObjectAnimator.ofFloat(spinner, "rotation", 0f, 360f).apply {
    duration = 1000
    repeatCount = ValueAnimator.INFINITE
    interpolator = LinearInterpolator()
}
```

**硬性要求**：提示隐藏时**必须停止动画**（`rotate.cancel()`），避免后台空转耗电。

### 5.3 三处替换

| 原位置 | 改为 |
| --- | --- |
| `selectFeed():833` | 先 `hideChromeNow()`，再 `showSwitchHint(series, episode=null)` |
| `loadEpisode():755` | 仅当 `showSwitchHint == true` 时显示轻量提示 |
| `loadEpisode():772` | 播放就绪 → `hideSwitchHint()` |

### 5.4 隐藏时机

- **播放就绪**：`onPlaybackStateChanged` 进入 `STATE_READY`
- **超时兜底**：8 秒强制隐藏
- **加载失败**：`playbackError()` / `feedError()` 时隐藏并回到完整 chrome

---

## 六、验收标准

1. **上下键切剧**：只显示剧名 + 集数 + 动画，不显示顶部导航与操作栏
2. **自动下一集**：同样只显示轻量提示
3. **用户按 MENU**：仍能唤出完整 chrome（**不能回归**）
4. **加载失败**：回到完整 chrome 并显示错误
5. **动画停止**：提示隐藏后动画不再运行
6. 用户点「下一集」/ 选画质 / 重试时**不显示**轻量提示
7. 构建/lint/测试通过
8. **截图证据**：切剧瞬间 / 自动下一集 / 按 MENU 三种状态

---

## 七、风险

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| 误改 `revealChrome()` | 影响 9 个调用点 | 明确要求**新增**轻量层 |
| MENU 失效 | 轻量提示期间按 MENU 应能唤出完整 chrome | 列为验收项 |
| 焦点错乱 | 提示层可能抢焦点 | 设 `isFocusable = false` |
| 动画泄漏 | 提示隐藏后动画仍运行 | 明确要求停止 |
| `loadEpisode` 区分 | 13 个调用点需精确控制 | 用可选参数 + 调用点传值 |

---

## 八、状态

**待派发 S1。** S2（复核）依赖 S1。
