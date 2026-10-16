# P3 TV 端切集不重建 UI 树

**任务 ID**: `t-p3-tv-ui-reuse`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: Android TV 端切集渲染

---

## 一、问题（协调者定位）

**`apps/tv-android/.../MainActivity.kt:819`**：

```kotlin
private fun loadEpisode(index: Int, position: Long = 0, autoplay: Boolean = true, resetRetry: Boolean = true) {
    ...
    navigation.removeAllViews()   // ← 每次切集销毁整个视图树
    if (showSwitchHint) {
        hideChromeNow()
        showSwitchHint(...)
    } else {
        revealChrome()
    }
    if (!overlayVisible) focusPlayback()
    ...
}
```

**每次切集都销毁并重建整个 `navigation` 视图树。**

### 影响

| 项 | 代价 |
| --- | --- |
| UI 重建 | 布局计算 + 视图创建 |
| 焦点恢复 | 需重新 `focusPlayback()` |
| 封面加载 | `artwork.load(detail.series.cover, backdrop)` 重新触发 |

### 对比：TV 的播放器复用是对的

TV 端用 Media3 的 `setMediaItem()` + `prepare()` **复用 ExoPlayer**
（`MainActivity.kt:843`），这部分无需改动。

**问题仅在 UI 树。**

---

## 二、要求

### 2.1 切集时复用 UI 树

**目标**：切集时**不重建** `navigation`，只更新其中的内容。

**关键洞察**：切集时变化的只有：

| 内容 | 切集时是否变化 |
| --- | --- |
| 集数徽标 `episodeBadge` | ✅ 变 |
| 标题 `infoTitle` | ❌ 不变（同一部剧） |
| 副标题 `infoSubtitle` | ✅ 变（集数） |
| 标签 `infoTags` | ❌ 不变 |
| 描述 `infoDesc` | ❌ 不变 |
| 合集按钮 `collectionButton` | ❌ 不变（同一部剧） |
| 封面 `artwork` | ❌ 不变（同一部剧） |

**所以切集时只需更新 2 个字段**，不需要重建整个视图树。

### 2.2 区分「切集」与「切剧」

| 场景 | 是否重建 UI |
| --- | --- |
| **切集**（同剧内） | ❌ **不重建**，只更新徽标与副标题 |
| **切剧**（换一部） | ✅ 需要重建（标题、标签、描述、封面都变） |

**建议**：把 `loadEpisode` 的 UI 更新逻辑抽出来，切集走轻量路径。

### 2.3 必须验证的行为

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 切集后集数徽标正确 | 显示新集数 |
| 2 | 切集后副标题正确 | 显示新集数 |
| 3 | 切集后**焦点仍在播放区** | 无焦点丢失 |
| 4 | 切集后封面未重新加载 | 无闪烁 |
| 5 | 切剧后 UI 正确重建 | 标题/标签/描述/封面都更新 |
| 6 | 自动下一集正常 | 播放新集 |
| 7 | 全剧结束切下一部 | UI 正确重建 |
| 8 | 切换清晰度 | 不影响 UI |

---

## 三、硬性约束

1. **可改文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/` 下相关文件（如需）
2. **不要改** `server/provider.mjs`、`custom-server/`（另一任务）
3. **不要改** `apps/web-pc/src/`（另一任务）
4. **不要改** `shared/content-core/hongguo.js`
5. **不要破坏** 播放器复用（`setMediaItem` + `prepare`）
6. 保持 TV 单元测试通过（32 项）
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 切集时 `navigation` 子视图**不被清空** | 代码核实 + 实测 |
| 2 | 切集后集数徽标与副标题正确 | dump 验证 |
| 3 | 切集后焦点在播放区 | dump 的 `focused="true"` |
| 4 | 切剧时 UI 正确重建 | dump 验证 |
| 5 | 自动下一集正常 | 实测 |
| 6 | 8 项行为验证全部通过 | |
| 7 | TV 单元测试 32 项通过 | |
| 8 | 报告写入 `.agents/shared/t-p3-tv-ui-reuse-codex.md` | |

---

## 五、验证方法

### 环境

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb connect 127.0.0.1:16384     # D1
& $adb -s 127.0.0.1:16384 install -r apps\tv-android\app\build\outputs\apk\debug\app-debug.apk
```

**注意**：设备可能已断开，需先 `adb connect`。若 D1/D2/D3 不可用，
可尝试真机 `192.168.1.120:5555`（可能也需重连）。

### 验证 UI 是否重建

**方法**：在 `loadEpisode` 前后记录 `navigation.childCount` 或给视图打标记。

或用更简单的方式：**测量切集耗时**，对比优化前后。

### 测量切集耗时

用 `dumpsys` 或日志时间戳测量从按键到画面更新的时间。

---

## 六、证据要求

1. **代码对比**：切集路径不再调用 `removeAllViews()`
2. **dump 验证**：切集后集数徽标与副标题正确
3. **焦点验证**：切集后 `focused="true"` 仍在播放区
4. **切剧回归**：切剧后 UI 正确重建
5. **8 项行为验证**结果
6. TV 单元测试输出

---

## 七、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **视图复用后内容不更新** | 必须显式更新徽标与副标题 |
| **切剧遗漏重建** | 切剧时标题/标签/描述/封面都变，必须重建 |
| **焦点丢失** | 复用视图时焦点可能不在预期位置 |
| **`removeAllViews` 的其他调用点** | 检查是否有别处也调用（如 `renderCatalog`） |
| 设备断开 | adb 需先 connect |
| 引擎无 `randomBytes` | TV 的 QuickJS 环境限制（已知） |

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-p3-tv-ui-reuse codex "结论及报告路径"
```
