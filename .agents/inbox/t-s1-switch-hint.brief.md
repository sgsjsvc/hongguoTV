# S1 TV 端切剧轻量提示与加载动画

**任务 ID**: `t-s1-switch-hint`
**负责人**: antigravity
**依赖**: 无（可并行）
**协调者**: dsh
**范围**: **仅 TV 端**（`apps/tv-android/`）。Web / PC / Windows 端**不在本轮范围**。

---

## 一、用户需求

> 使用上下键切换剧时只显示这个（剧名），不要显示整个菜单，从而方便短剧的切换。
> 同一短剧再自动下一集时不要显示菜单。增加加载动画。

> **范围说明**：用户明确「只针对 TV 端修改」。**不要改动 `apps/web-pc/` 或任何其他端。**

---

## 二、根因（已核实）

### 问题 1：上下键切剧显示整个菜单

`MainActivity.kt:833`（`selectFeed()` 内）：

```kotlin
revealChrome(); infoTitle.text = "@${series.title} · 加载中"
```

`revealChrome()` 显示**全部** chrome：顶部导航 + 底部操作栏 + 简介 + 进度条 + 上下渐变。

### 问题 2：自动下一集显示菜单

`episodeEnded():794` → `loadEpisode()` → `:755` 与 `:772` 调 `revealChrome()`

### 问题 3：无加载动画

现状只有文字 `"@${series.title} · 加载中"`，无动画。

---

## 三、⚠️ 关键约束：不能改 `revealChrome()`

`revealChrome()` 有 **9 个调用点**，其中 **7 个需要完整 chrome**：

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

**要求**：**新增**轻量提示层，**不要修改 `revealChrome()` 本身**。

---

## 四、⚠️ 第二个关键点：`loadEpisode` 有 13 个调用点

| 调用点 | 场景 | 是否显示轻量提示 |
| --- | --- | --- |
| `episodeEnded():794` | **自动下一集** | ✅ **显示** |
| `selectFeed():840` | **切剧后首次加载** | ✅ 显示（由 selectFeed 统一处理） |
| `onNextEpisodeClick:301` | 用户点「下一集」 | ❌ 不显示 |
| `chooseQuality:900` | 选画质 | ❌ 不显示 |
| `onPlayerError:728` | 重试 | ❌ 不显示 |
| `returnToFeed:930` | 返回首页 | ❌ 不显示（走完整 chrome） |
| 其他 | 恢复/初始化 | ❌ 不显示 |

**要求**：**在调用点控制**，不要改 `loadEpisode` 内部逻辑。

**建议实现**：给 `loadEpisode` 增加可选参数（如 `showSwitchHint: Boolean = false`），仅 `episodeEnded` 传 `true`；`selectFeed` 自行调 `showSwitchHint`。

---

## 五、要做的事

### 5.1 新增轻量提示层

建议新建 `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/SwitchHintView.kt`，或直接在 `MainActivity` 内构建（你判断哪个更清晰）。

**内容**：

```
┌──────────────────────────────────┐
│  @剧名  全N集                    │
│  第 N 集 · 《剧名》              │
│  ⟳ 加载动画                      │
└──────────────────────────────────┘
```

**位置**：屏幕中下方（参照现有 `pauseIndicator` / `seekHud` 的位置与风格）

**关键属性**：

- `isFocusable = false`（**不抢焦点**）
- 背景半透明圆角（与现有 HUD 风格一致）

### 5.2 加载动画

**推荐**：纯代码旋转动画

```kotlin
val spinner = TextView(context).apply { text = "◜"; textSize = ...; setTextColor(TvUi.RED) }
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
| `loadEpisode():755` | 仅当 `showSwitchHint == true` 时显示轻量提示，否则保持原 `revealChrome()` |
| `loadEpisode():772` | 播放就绪 → `hideSwitchHint()`，**不调** `revealChrome()`（当 `showSwitchHint == true`） |

### 5.4 隐藏时机

- **播放就绪**：`onPlaybackStateChanged` 进入 `STATE_READY` 时隐藏
- **超时兜底**：8 秒后强制隐藏（避免卡住）
- **加载失败**：`playbackError()` / `feedError()` 时隐藏轻量提示并回到完整 chrome

---

## 六、硬性约束

1. **只改这些文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/SwitchHintView.kt`（若新建）
   - `apps/tv-android/app/src/main/res/values*/dimens.xml`（三档，若需新增尺寸）
2. **不要修改** `ui/` 下其他已有组件
3. **不要修改** `revealChrome()` 本身
4. **不要修改** `apps/web-pc/`（S2 由 codex 负责）
5. **不要回退**第五轮修复
6. 保持 API 22 兼容
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 七、验收标准

1. **上下键切剧**：只显示剧名 + 集数 + 动画，**不显示**顶部导航与操作栏
2. **自动下一集**：同样只显示轻量提示
3. **用户按 MENU**：仍能唤出完整 chrome（**不能回归**）
4. **加载失败**：回到完整 chrome 并显示错误
5. **动画停止**：提示隐藏后动画不再运行
6. 用户点「下一集」/ 选画质 / 重试时**不显示**轻量提示
7. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过
8. 报告写入 `.agents/shared/t-s1-switch-hint-antigravity.md`

---

## 八、证据要求（三件套）

**必须提供三种状态的截图**：

1. **上下键切剧瞬间** → 轻量提示
2. **自动下一集瞬间** → 轻量提示
3. **按 MENU** → 完整 chrome（证明未回归）

```powershell
# 冷启动 + 唤出 chrome（协调者实测有效）
adb -s emulator-5554 shell am force-stop com.hongguotv.tv
adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
Start-Sleep -Seconds 20
adb -s emulator-5554 shell input keyevent 20

# 截图两步法（禁止 shell 重定向）
adb -s emulator-5554 shell screencap -p /sdcard/s.png
adb -s emulator-5554 pull /sdcard/s.png .agents/shared/<命名>.png
```

**校验 PNG 签名**必须为 `89-50-4E-47-0D-0A-1A-0A`。

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `input tap` 无效 | 触摸被播放器吞掉，须用 DPAD |
| chrome 会自动隐藏 | 隐藏后 RIGHT/LEFT 变 seek |
| 播放页 dump 受限 | 元素在 SurfaceView 上，可能只返回根节点 |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-s1-switch-hint antigravity "结论及报告路径"
```
