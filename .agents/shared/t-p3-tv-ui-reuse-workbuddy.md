# P3 TV 端切集不重建 UI 树 — 交付报告（workbuddy）

- **任务 ID**: `t-p3-tv-ui-reuse`
- **执行人**: workbuddy（总线 `assignee=workbuddy`；任务书正文写「负责人 codex」、提交示例也写 codex —— **以总线为准**）
- **日期**: 2026-10-16
- **改动文件**: `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`（仅此一个）
- **验证设备**: **D3** `127.0.0.1:16448`（1280×720 @192dpi）
  > 任务书 §五 写的是 D1，但 `device-allocation.md` 规定 workbuddy → D3，且总线 `assignee=workbuddy`。按分配规范用 D3。
- **结论**: 改动已完成并通过 8 项行为验证 + 32 项单测；但 **任务书的核心前提与实测不符**（见 §二），实际收益 ≈ 0

---

## 一、结论速览

| # | 验收项 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 切集时 `navigation` 子视图不被清空 | ✅ 已核实 | 代码 + `dumpsys` 视图树（§二、§三） |
| 2 | 切集后集数徽标正确 | ✅ 已核实 | 第 1 集 → **第 2 集** |
| 3 | 切集后副标题正确 | ✅ 已核实 | `第 1 集 · 《知许不许》 第 1 集` → **`第 2 集 · … 第 2 集`** |
| 4 | 切集后焦点在播放区（无丢失） | ✅ 已核实 | 焦点保留在播放器内「下一集」按钮 |
| 5 | 切集后封面未重新加载 | ✅ 已核实（代码路径） | `seriesChanged=false` 时不调用 `artwork.load` |
| 6 | 切剧后 UI 正确重建 | ✅ 已核实 | 标题/标签/描述/合集全部更新 |
| 7 | 自动下一集正常 | ✅ 已核实 | 第 2 集播完自动切第 3 集 |
| 8 | 全剧结束切下一部 | ⚠️ **仅代码核实**（未实测） | 需播完 117 集，见 §五 |
| 9 | 切换清晰度不影响 UI | ✅ 已核实 | 1080P → 720P，其余字段与视图 ID 全不变 |
| 10 | TV 单元测试 32 项通过 | ✅ 已核实 | `32 tests / 0 failures` |

**构建**：`:app:testDebugUnitTest :app:assembleDebug` → **BUILD SUCCESSFUL in 38s**（APK md5 `eb2a5219…`）

---

## 二、🔴 重要更正：任务书的核心前提与实测不符

任务书 §一 断言：

> 「**每次切集都销毁并重建整个 `navigation` 视图树**」
> 「这是最直接的证据：这些 `TextView.text` 赋值只对已存在的视图有效，而紧接着 `removeAllViews()` 把它们全部丢弃」

**实测结论：该断言不成立。** 三条独立证据：

### 证据 1（代码）：`feedOverlay` 挂在 `root` 上，不在 `navigation` 里

```
MainActivity.kt:254  // 9. Navigation Panels (Catalog / Detail / Settings)
MainActivity.kt:255  navigation = FrameLayout(this)
MainActivity.kt:256  root.addView(navigation, ...)

MainActivity.kt:405  root.addView(feedOverlay, FrameLayout.LayoutParams(-1, -1))   ← 播放器 UI 在这里
MainActivity.kt:361  episodeBadge = overlay.episodeBadge                            ← 徽标属于 feedOverlay
```

`episodeBadge / infoTitle / infoSubtitle / infoTags / infoDesc / collectionButton` 全部是
**`feedOverlay`（`PlayerOverlay`）的成员**，而 `feedOverlay` 是 `root` 的子视图，**与 `navigation` 平级**。
`navigation` 只承载 **Catalog / Detail / Settings / Search** 面板（见 `navigation.addView` 的 5 个调用点）。

因此 `navigation.removeAllViews()` **根本碰不到**任务书 808–817 行更新的那些 TextView。

### 证据 2（运行时）：播放中 `navigation` 的子节点数为 **0**

`adb shell dumpsys activity top` 的 View Hierarchy 中，`navigation` 为根容器最后一个子视图：

```
android.widget.FrameLayout{46a3ffd V.E...... ........ 0,0-1280,720}     ← navigation，无任何子节点
  android.view.ViewStub{b6a84f2 G.E...... ......I. 0,0-0,0 #10201b3 android:id/action_mode_bar_stub}
```

且所有进入播放的路径都已提前清空它：

| 路径 | 清空点 |
| --- | --- |
| `selectFeed()`（切剧） | `MainActivity.kt:908` `navigation.removeAllViews()` |
| `playDetailWithRecord()`（详情→播放） | `stopForNavigation(Screen.FULL)` → `MainActivity.kt:753` `navigation.removeAllViews()` |
| `episodeEnded / onNextEpisodeClick / chooseQuality / onPlayerError` | 同剧内，`navigation` 本就为空 |

→ **`loadEpisode` 里的 `navigation.removeAllViews()` 在所有调用路径上都是 no-op。**

### 证据 3（运行时）：视图对象 ID 全程不变

跨 **切集 / 切剧 / 切清晰度 / 自动下一集** 5 次采样，`dumpsys` 中的视图哈希完全相同：

| 采样点 | PlayerView | AppHeaderView | PlayerOverlay |
| --- | --- | --- | --- |
| 基线（第1集） | `8a21d5d` | `982798a` | `437fd5c` |
| 切集后（第2集） | `8a21d5d` | `982798a` | `437fd5c` |
| 切剧后（绿意萌熹） | `8a21d5d` | `982798a` | `437fd5c` |
| 切清晰度后（720P） | `8a21d5d` | `982798a` | `437fd5c` |
| 自动下一集后（第3集） | `8a21d5d` | `982798a` | `437fd5c` |

若视图树真被销毁重建，这些哈希必然变化。**实测全程不变** → 未发生重建。

### 附带更正：`artwork.load` 同样是 no-op

`ArtworkLoader.kt:36` 已有短路：

```kotlin
if (target.tag == url && (target.drawable != null || pending[target]?.url == url)) return
```

同剧切集时 `backdrop.tag` 已是同一封面 URL 且 drawable 非空 → 直接 return，**不会重新下载/解码封面**。

> **小结**：任务书列出的两项代价（「UI 重建」+「封面重新加载」）在改动前**都已不存在**。
> 因此 P3 不是性能优化，而是一次**语义澄清 + 防御性硬化**。

---

## 三、本次改动

`MainActivity.kt` 唯一改动（`git diff` 摘要）：

```diff
+    // Series id whose series-level text is currently rendered in the in-player overlay.
+    private var chromeSeriesId: String? = null
```

```diff
-        // Update In-Player Overlays
+        // 切集（同一部剧）只更新会变化的集数徽标与副标题，保留既有视图树；
+        // 仅当切换剧集（series 变化）时才刷新系列级字段、清空导航容器并重新加载封面。
+        val seriesChanged = chromeSeriesId != detail.series.id
+        chromeSeriesId = detail.series.id
         episodeBadge.text = "第 ${episode.number} 集"
-        infoTitle.text = ...
         infoSubtitle.text = "第 ${episode.number} 集 · 《…》 第 ${episode.number} 集"
-        val tagList = ...
-        infoTags.text = ...
-        infoDesc.text = ...
-        collectionButton.text = ...
         playButton.text = ...
+        if (seriesChanged) {
+            infoTitle.text = ...; infoTags.text = ...; infoDesc.text = ...; collectionButton.text = ...
+            navigation.removeAllViews()
+            artwork.load(detail.series.cover, backdrop)
+        }
         updateFavState()
-
-        navigation.removeAllViews()
```

并在两处错误路径补上状态复位（否则错误文案会被同剧切集「跳过系列级刷新」而残留）：

```kotlin
// playbackError(): collectionButton.text = "重试加载" 之后
+        chromeSeriesId = null
// feedError():     collectionButton.text = "重新加载推荐" 之后
+        chromeSeriesId = null
```

**为什么仍然做这个改动**（尽管收益为 0）：
1. 任务书明确要求，且验收项 1 要求「切集时 navigation 子视图不被清空」；
2. 把「切集只改集数相关字段」这一**代码原有意图**显式化（原 808–817 行就是这么写的）；
3. 消除潜在隐患：若将来有调用方在 `navigation` 非空时调用 `loadEpisode`，原代码会误删面板；现在只在切剧时清空。

---

## 四、逐项验证证据

### 4.1 切集（同剧：知许不许 第 1 集 → 第 2 集）

| 字段 | 切集前 | 切集后 | 期望 |
| --- | --- | --- | --- |
| 集数徽标 | 第 1 集 | **第 2 集** | ✅ 变 |
| 副标题 | 第 1 集 · 《知许不许》 第 1 集 | **第 2 集 · 《知许不许》 第 2 集** | ✅ 变 |
| 标题 | @知许不许 全68集 | 不变 | ✅ 不变 |
| 标签 | #短剧 #爱情 #都市爱情 #女性成长 #闪婚 #先婚后爱 | 不变 | ✅ 不变 |
| 描述 | 「面对相恋十年男友的背叛…」 | 不变 | ✅ 不变 |
| 合集按钮 | 合集：知许不许 \| 全68集 > | 不变 | ✅ 不变 |
| 焦点 | 下一集 | **下一集** | ✅ 未丢失 |

### 4.2 切剧（知许不许 → 绿意萌熹）

| 字段 | 切剧后 |
| --- | --- |
| 标题 | **@绿意萌熹：蛙系萌娃闹翻忧郁老爸 全117集** |
| 集数徽标 | **第 1 集** |
| 副标题 | **第 1 集 · 《绿意萌熹：蛙系萌娃闹翻忧郁老爸》 第 1 集** |
| 标签 | **#短剧 #萌宝 #都市 #豪门** |
| 描述 | **「在福利院长大的两岁萌娃熹宝被豪门霍家寻回…」** |
| 合集按钮 | **合集：绿意萌熹：蛙系萌娃闹翻忧郁老爸 \| 全117集 >** |

→ 系列级字段全部正确刷新（即任务书所说的「重建」= 内容刷新；**视图对象未重建**，见 §二证据 3）。

### 4.3 切换清晰度（1080P → 720P）

画质对话框选项：`1080P / 720P / 540P / 480P / 360P`。选 720P 后：

- 画质按钮 `1080P` → **`720P`** ✅
- 徽标 / 标题 / 副标题 / 标签 / 描述 / 合集 **全部不变** ✅
- 视图对象 ID 不变 ✅

### 4.4 自动下一集

暂停于 `00:32 / 01:56`（第 2 集）后恢复播放，等待 100s：
`第 2 集` → **`第 3 集`**，进度 `00:15 / 01:55`（新集已开始）。✅

### 4.5 单元测试

```
套件文件=8  用例=32  失败=0  跳过=0
```

---

## 五、未验证 / 限制（如实标注）

| 项 | 说明 |
| --- | --- |
| **「全剧结束切下一部」** | **仅代码核实**：`episodeEnded()` → `if (activeIndex == lastIndex) { …; if (feedMode) switchFeed(1) else showRelated(...) }`。要实测需播完 117 集，成本不可接受。该路径未被本次改动触及。 |
| **「切集后封面未重新加载」** | 为**代码路径核实**（`seriesChanged=false` 时不调用 `artwork.load`；且 `ArtworkLoader` 自带 tag 短路）。未做逐帧像素比对，无法给出「无闪烁」的视觉证据。 |
| **焦点「在播放区」的口径** | 本次切集由「下一集」按钮触发，焦点**保留在该按钮**（属播放器 overlay 内），未出现回退到网格/根视图。若期望焦点落到 `playerView`，则需由自动下一集路径（`focusPlayback()`）触发；本轮自动下一集时 overlay 可见，未单独断言 `playerView` 的 `focused`。 |
| **设备** | 用 D3（1280×720 @192），非任务书所写的 D1。结论与设备无关（纯逻辑路径）。 |
| **收益量化** | **未测得任何收益**，因为改动前该操作已是 no-op（§二）。 |

---

## 六、结论与建议

1. **改动本身**：安全、行为等价、意图更清晰，已通过全部可验证项（8 项行为 + 32 项单测 + 构建成功）。
2. **请协调者注意**：`perf-baseline.md` 中「问题 3：TV 端切集重建 UI 树（影响：UI 重建、焦点恢复、布局重算有额外开销）」
   这一条**不成立**，建议从性能基线中移除或降级为「代码清晰度问题」，以免后续任务重复投入。
3. **真正的 TV 端性能收益**在别处：详情接口缓存（P1，省 ~1367ms）、预加载下一部剧（省 ~1407ms）。
   本次改动对切集耗时的贡献可视为 **0**。
4. **附带建议**：`loadEpisode` 内的 `navigation.removeAllViews()` 已改为「仅切剧时执行」，
   建议同时在 `loadEpisode` 的 KDoc/注释中写明「调用方负责确保 navigation 面板已由 `stopForNavigation` 清理」，
   避免未来有人依赖该副作用。

---

## 七、证据文件清单

| 文件 | 内容 |
| --- | --- |
| `.agents/shared/t-p3-base.xml` | 切集前 dump（第 1 集 + 焦点/字段） |
| `.agents/shared/t-p3-next.xml` | 切集后 dump（第 2 集） |
| `.agents/shared/t-p3-switch.xml` / `.png` | 切剧后 dump 与截图（绿意萌熹） |
| `.agents/shared/t-p3-quality-dialog.xml` | 画质对话框 |
| `.agents/shared/t-p3-quality.xml` | 切 720P 后 dump |
| `.agents/shared/t-p3-seek.xml` | 快进尝试 dump |
| `.agents/shared/t-p3-autonext.xml` | 自动下一集后 dump（第 3 集） |

`dumpsys` 视图树原始快照（本机临时）：`/tmp/tv_base.txt`、`/tmp/tv_next.txt`、`/tmp/tv_sw.txt`、`/tmp/tv_q.txt`、`/tmp/tv_final.txt`
—— 用于 §二证据 2/3 的视图对象 ID 比对。

---

## 八、声明

1. 仅修改 `MainActivity.kt`，未触碰 `server/provider.mjs`、`custom-server/`、`apps/web-pc/src/`、`shared/content-core/hongguo.js`。
2. 播放器复用（`setMediaItem` + `prepare`）未改动。
3. 未执行 `git checkout` / `git reset` / `git clean`。
4. 结论区分「已核实」与「仅代码核实」，未验证项已在 §五 显式列出。
