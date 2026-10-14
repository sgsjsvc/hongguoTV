# U6 榜单切换平铺化

**任务 ID**: `t-u6-rank-tabs`
**负责人**: antigravity
**依赖**: 无（就绪）
**协调者**: dsh

---

## 用户需求

> 把切换榜单按钮里面的内容平铺到外面

---

## 一、现状（已核实，可直接依据）

### 当前实现：点击后弹系统 Dialog

```kotlin
// ui/CatalogScreenView.kt:81-83
if (source == "rank") {
    tools.addView(TvUi.pillButton(context, "切换榜单") { onSwitchRank() })
}

// MainActivity.kt:990-994
onSwitchRank = {
    loadChoices("榜单", { repository().rankTypes() }) {
        selectedRank = it; catalogScroll = null; navigationJob = null; loadCatalog(false)
    }
}
```

`loadChoices` 最终走 `choice(...)` → 弹出**系统 `AlertDialog` 单选列表**。

### 要平铺的内容（4 项）

接口 `GET /api/rank/types` 实测返回：

```json
{"types":[
  {"slug":"hot-drama","name":"红果热播榜","key":"all"},
  {"slug":"hot-real-drama","name":"真人剧热播榜","key":"real"},
  {"slug":"hot-ai-drama","name":"AI剧热播榜","key":"ai"},
  {"slug":"hot-comic-drama","name":"漫剧热播榜","key":"comic"}
]}
```

默认选中 `hot-drama`（`MainActivity.kt:146` `private var selectedRank = "hot-drama"`）。

---

## 二、必须参照的既有先例（风格一致性）

本项目**已有两处「Dialog 改平铺」的成功实现**，请**严格保持风格一致**：

### 先例 1：`ui/DetailScreenView.kt:80-109`（分集分组 Tab）

```kotlin
val groupScroll = HorizontalScrollView(context).apply {
    isHorizontalScrollBarEnabled = false
    setPadding(0, 0, 0, TvUi.dimen(context, R.dimen.detail_group_pad_bottom))
}
val groupRow = TvUi.row(context)
val groupMinHeight = TvUi.dimen(context, R.dimen.detail_group_btn_min_height)
val groupHeight = TvUi.dimen(context, R.dimen.detail_group_btn_height)
val groupPadH = TvUi.dimen(context, R.dimen.detail_group_btn_pad_h)
val groupPadV = TvUi.dimen(context, R.dimen.detail_group_btn_pad_v)
val groupMarginEnd = TvUi.dimen(context, R.dimen.detail_group_btn_margin_end)

for (g in 0 until groups) {
    val isSelected = g == episodeGroup
    val groupBtn = Button(context).apply {
        text = "$start—$end 集"
        textSize = 13f
        isAllCaps = false
        setTextColor(if (isSelected) Color.WHITE else TvUi.TEXT_MUTED)
        background = TvUi.pillBackground(active = isSelected, radius = 20f)
        minHeight = groupMinHeight
        setPadding(groupPadH, groupPadV, groupPadH, groupPadV)
        setOnClickListener { onGroupChanged(g) }
        setOnFocusChangeListener { ... }
    }
    groupRow.addView(groupBtn, ...)
}
```

### 先例 2：`ui/EpisodeDrawerView.kt:57,96-98`（播放页选集分组）

```kotlin
groupTabsRow = TvUi.row(context)
// ...
groupTabsRow.removeAllViews()
val totalGroups = (detail.episodes.size + 49) / 50
```

**要点**：`HorizontalScrollView` + `TvUi.row` + 选中态 `pillBackground(active = ...)` + `TEXT_MUTED`/`WHITE` 文字色切换。

---

## 三、要做的事

### 1. 替换单个按钮为平铺行

在 `ui/CatalogScreenView.kt` 的 `source == "rank"` 分支（第 81 行附近），**替换**：

```kotlin
// 现在
tools.addView(TvUi.pillButton(context, "切换榜单") { onSwitchRank() })

// 改为：平铺 4 个榜单类型按钮
```

- 容器用 `HorizontalScrollView` 包裹 `TvUi.row`（窄屏防溢出）
- 每个按钮用 `TvUi.pillButton(context, name, active = isSelected)`
- 选中态高亮，未选中用 `TvUi.TEXT_MUTED`

### 2. 数据来源与加载时序

**关键**：榜单类型当前是**异步获取**的（`repository().rankTypes()`）。

- 需在进入榜单页时**预先加载**榜单类型并缓存，供平铺按钮渲染
- **不可阻塞页面**：先渲染页面主体，类型加载完后填充按钮行
- 加载失败：保留 `message(...)` 提示，或降级为不显示按钮行

**建议做法**：`MainActivity` 中维护 `rankTypesCache: List<Pair<String,String>>?`，在 `openCatalog("排行榜", "rank")` 时预取，传给 `CatalogScreenView`。

### 3. 交互

- 点击按钮 → 切换 `selectedRank` 并重新加载列表（**复用现有 `loadCatalog(false)` 路径**，不要重写加载逻辑）
- **焦点**：进入页面时焦点落在**当前选中的榜单按钮**上（显式 `requestFocus()`）
- 左右键在按钮间移动，边界正常交还（不吞键）

### 4. 兼容与清理

- 若榜单类型为空或仅 1 项 → **不显示**按钮行
- 若确认 `onSwitchRank` 无其他调用方 → 移除该回调（先全局搜索确认）

---

## 四、文件归属

**只改这三个文件**：

| 文件 | 说明 |
| --- | --- |
| `ui/CatalogScreenView.kt` | 平铺按钮行 |
| `MainActivity.kt` | 预取榜单类型、传参、移除旧回调 |
| `res/values*/dimens.xml` | 若需新增尺寸键（三档都要加） |

**不要修改** `ui/DetailScreenView.kt`、`ui/EpisodeDrawerView.kt`、`TvUi.kt`、`SeriesAdapter.kt`。

---

## 五、硬性约束

1. **绝对不要修改** `shared/content-core/hongguo.js`
2. **不要回退或清理**工作区已有的未提交改动
3. 保持 API 22 兼容（`minSdk = 22`）
4. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`
5. 设备 API 级别**以 `adb shell getprop ro.build.version.sdk` 实测为准**（该模拟器实为 **API 32**，此前有报告误写 33）

---

## 六、验收标准

1. 榜单页顶部**平铺显示 4 个榜单类型**，当前选中项高亮
2. **不再弹出系统 Dialog**
3. 切换后列表**内容确实变化**（如切到「真人剧热播榜」后剧集列表与「红果热播榜」不同）
4. 焦点落在当前选中项，左右键可移动
5. 720p 下不溢出（水平滚动生效）
6. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过
7. 报告写入 `.agents/shared/t-u6-rank-tabs-antigravity.md`

---

## 七、证据要求（三件套，缺一视为未验证）

### 1. 截图 —— 必须两步法

```powershell
# ✅ 正确
adb -s emulator-5554 shell screencap -p /sdcard/shot.png
adb -s emulator-5554 pull /sdcard/shot.png .agents/shared/<命名>.png
adb -s emulator-5554 shell rm /sdcard/shot.png

# ❌ 禁止（PowerShell 重定向破坏二进制，U1 曾因此损坏截图）
adb -s emulator-5554 exec-out screencap -p > file.png
```

**校验**：PNG 签名必须为 `89 50 4E 47 0D 0A 1A 0A`，请在报告中贴出验证结果。

### 2. dump 文件 —— 落盘到 `.agents/shared/`

**注意**：播放页的元素在 SurfaceView 上，`uiautomator dump` 可能只返回根节点。榜单页是普通 View，应可正常 dump。

### 3. 命名规范

`<任务ID>-<页面>-<状态>-<时间戳>.<ext>`
例：`t-u6-rank-tabs-list-hot-001530.png`

---

## 八、已知陷阱（协调者实测）

| 陷阱 | 说明 |
| --- | --- |
| `input tap` **无效** | 触摸事件被播放器吞掉，导航须用 DPAD |
| 冷启动唤 chrome | 按**一次 DOWN**（不要用 MENU），随后 dump 可读到完整坐标 |
| chrome 会自动隐藏 | 隐藏后 RIGHT/LEFT 变 seek 而非焦点移动（技术债 D3） |

**榜单页坐标参考**（实测 1280×720）：顶部导航「榜单」在 `[621,9][753,54]`。

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-u6-rank-tabs antigravity "结论及报告路径"
# 若阻塞
node .agents/cli.mjs fail t-u6-rank-tabs antigravity "阻塞原因及已尝试措施"
```
