# S1 TV 端切剧轻量提示与加载动画 验收报告

**任务 ID**: `t-s1-switch-hint`  
**执行人**: antigravity  
**状态**: 完成并通过全绿验收  
**范围**: 仅 TV 端（`apps/tv-android/`）  

---

## 一、需求背景与修复方案

### 1. 原始问题
- 用户反馈：使用上下键切换剧时，不要显示整个庞大菜单（导航、操作按钮、简介、进度条、渐变遮罩），只需显示剧名；同一短剧自动跳下一集时同样不显示菜单，并增加加载动画。
- 根因分析：
  - `selectFeed()` (原第 833 行) 直接调用 `revealChrome()`，强行唤出全套 Chrome。
  - `episodeEnded()` 调用 `loadEpisode()`，内部在加载开始和准备就绪两处均调用 `revealChrome()`。
  - 原有提示仅为纯文本 `"@${series.title} · 加载中"`，缺乏动画反馈。

### 2. 架构设计与约束恪守
- **严格未修改 `revealChrome()`**：保留其作为全套菜单唤出入口，7 处依赖完整 Chrome 的调用点（如按 MENU 键、关闭抽屉、播放状态变化、返回首页等）完全不受影响。
- **新建轻量提示组件 `SwitchHintView` (`apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/SwitchHintView.kt`)**：
  - 内容结构：剧名（`@剧名`）+ 剧集总数徽章（`全N集`）+ 当前分集（`第 N 集 · 《剧名》`）+ 旋转动画器（`◜` 纯代码 `ObjectAnimator`）。
  - 核心属性：`isFocusable = false`、`isClickable = false`，不抢占焦点，沉浸居中偏下半透明圆角 HUD 风格。
  - 动画生命周期：显示时 `rotateAnimator.start()`，隐藏及 `onDetachedFromWindow` 时强制 `rotateAnimator.cancel()`，杜绝后台空转耗电。
- **调用点精准控制**：
  - 给 `loadEpisode` 增加可选参数 `showSwitchHint: Boolean = false`，仅在自动下一集（`episodeEnded`）与切剧首次加载（`selectFeed`）时传 `true`。
  - 手动点击「下一集」、选清晰度、重试、返回等 11 个调用点默认保持 `false`，不显示轻量提示。
  - 隐藏时机：进入 `STATE_READY` 瞬间隐藏；8 秒超时安全兜底；`playbackError()` / `feedError()` 失败时隐藏轻量提示并回到完整 Chrome。
  - 在轻量提示展示期间，显式屏蔽 `pauseIndicator`（“播放已暂停”），保持界面极致简洁清爽。
- **尺寸资源化**：
  - 在 `values/dimens.xml`、`values-sw600dp/dimens.xml`、`values-w1280dp/dimens.xml` 三档配置中补充 `switch_hint_*` 资源，适配 720p、1080p 等不同屏幕。

---

## 二、验收标准达成情况

| 验收项 | 期望行为 | 实际验证结果 |
| --- | --- | --- |
| **1. 上下键切剧** | 仅显示剧名 + 集数 + 旋转动画，不显示顶部导航与操作栏 | **达成**：截图见 `t-s1-switch-drama.png` |
| **2. 自动下一集** | 跨集播放结束自动跳转瞬间仅显示轻量提示与动画 | **达成**：截图见 `t-s1-auto-next.png` |
| **3. 按 MENU 键** | 仍能唤出完整 Chrome（导航、操作按钮、进度条），零功能回归 | **达成**：截图见 `t-s1-menu.png` |
| **4. 加载失败** | 回到完整 Chrome 并展示错误信息与重试按钮 | **达成**：`playbackError` / `feedError` 自动调用 `revealChrome()` |
| **5. 动画生命周期** | 提示隐藏或 View Detach 后，动画立即 cancel，无后台耗电 | **达成**：`hide()` 与 `onDetachedFromWindow()` 均显式 cancel |
| **6. 其他操作防误触** | 手动点击下一集 / 选清晰度 / 重试不显示轻量提示 | **达成**：各调用点参数默认 `false` |
| **7. 编译与检查通过** | `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过 | **达成**：全绿构建通过 |

---

## 三、证据三件套（真实设备验证）

### 1. 截图文件与 PNG 魔数签名验证

```powershell
@("t-s1-switch-drama.png", "t-s1-auto-next.png", "t-s1-menu.png") | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes(".agents/shared/$_")[0..7]
    $sig = ($bytes | ForEach-Object { $_.ToString("X2") }) -join "-"
    [PSCustomObject]@{ File = $_; Signature = $sig; Valid = ($sig -eq "89-50-4E-47-0D-0A-1A-0A") }
}
```

输出：
```
File                  Signature               Valid
----                  ---------               -----
t-s1-switch-drama.png 89-50-4E-47-0D-0A-1A-0A  True 
t-s1-auto-next.png    89-50-4E-47-0D-0A-1A-0A  True 
t-s1-menu.png         89-50-4E-47-0D-0A-1A-0A  True 
```

### 2. 状态截图展示说明
- **上下键切剧瞬间**: `.agents/shared/t-s1-switch-drama.png`  
  显示剧名 `@重生七零东北，悔婚后我打猎致富乡野`、`全90集`、`内容加载中...` 与红色旋转动画器 `◜`，全屏无任何顶栏与底栏。
- **自动下一集瞬间**: `.agents/shared/t-s1-auto-next.png`  
  当上一集自然播毕过渡时，精准展示 `@重生七零东北，悔婚后我打猎致富乡野`、`全90集`、`第 3 集 · 《...》` 与旋转动画器。
- **用户按 MENU 键**: `.agents/shared/t-s1-menu.png`  
  完整唤出顶部导航标签（推荐、搜索、分类、榜单、追剧、历史、设置）、分集 Pill Badge、底栏剧集描述与全部控制按钮（播放、下一集、合集、追剧、倍速、画质）及底部进度条，证明核心交互未发生任何回归。

---

## 四、工程与测试验证命令

### 1. Android 端编译与测试
```powershell
cd apps/tv-android
cmd /c "gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest"
```
输出：`BUILD SUCCESSFUL`，27 actionable tasks 通过，0 errors，0 warnings。

### 2. 全局测试套件回归
```powershell
npm test
```
输出：`93/93 pass`，全绿通过。
