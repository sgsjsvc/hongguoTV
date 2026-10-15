# 任务复核报告：Q2 卡片空白与自动分页 — 独立复核（t-q2-verify-card）

**复核方**: workbuddy（独立于 Q1 实施方 antigravity）
**被复核对象**: `t-q1-card-autopage`（Q1 分类/排行榜卡片空白修复 + 自动分页）
**执行设备**: **D3** `127.0.0.1:16448`（Android 12/API 32，1280×720 @192dpi → `sw600dp` 档）
**复核 APK**: `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk`（12:43:49 构建，MD5 `94c0ccefcd0cdec296de4109674f6402`，8,829,483 B）
**复核时间**: 2026-10-15 12:47–13:1x
**硬性约束遵守**: 只读复核（未修改任何生产代码）；只用 D3；未执行 `git checkout/reset/clean`

---

## 一、结论速览

| # | 核查项 | 结论 | 关键证据 |
|---|---|---|---|
| 2.1 | 卡片底部空白消除 | ✅ **基本消除**（分类页余 ~10dp = 卡片自身 padding；榜单页余 ~26.7dp，因空「集数」行） | dump 坐标前后对比（§3.1） |
| 2.2 | 同行卡片等高 | ✅ **等高**（未获焦卡统一 333px）；获焦卡按 `scale 1.04` 等比放大 | dump 坐标（§3.2） |
| 2.3 | 「加载更多」按钮移除 | ✅ **已移除**（dump 无该文本；修复前基线 dump 中存在） | dump 文本搜索（§3.3） |
| 2.4 | 自动分页生效 | ✅ **生效**（分类页实测连翻 12 页；榜单页实测翻到第 3 页，标题变化） | TCP 请求探针 + 标题对比（§3.4） |
| 2.5 | 🔴 不频繁查询 | ✅ **约束有效**（最大并发 = 1；1.1s 内 40 次快按仅 1 次请求；每页严格 1 次请求） | TCP 连接探针（§3.5） |
| 2.6 | 边界情况 | ⚠️ 部分实测（末页停止✅）+ 代码核实（C5/C6/C7） | §3.6 |
| 2.7 | 越界改动 | ✅ **无**（仅 3 个 Java 文件，无 `dimens.xml`/`hongguo.js`/`custom-server/`） | `git diff HEAD`（§3.7） |
| 2.8 | 调试日志残留 | ✅ **无**（Q1 确已清理） | grep（§3.8） |
| — | 死代码残留 | ⚠️ 发现 2 处（不阻断） | §4.2 |

**总体结论：Q1 三项需求均已达成，实现方案（`WRAP_CONTENT` + `onNearBottom` + `triggerAutoPage` 守卫）正确且经实测验证。** 发现 1 处表述不准确（Q1 报告「空白 0px」）与 2 处无害死代码，均不阻断。

---

## 二、复核方法与环境

### 2.1 关键前提：应用内嵌本地 HTTP 服务

复核中发现（对验证 2.5「不频繁查询」至关重要）：

- `LocalContentService.kt:16` 在**随机端口**（`ServerSocket(0, 8, 127.0.0.1)`）监听，仅服务 `/api/*` JSON 路由（`/health`、`/api/recommend`、`/api/search`、`/api/category/tags`、`/api/category/list`、`/api/rank/types`、`/api/rank/list`、`/api/series/*`、`/api/episodes/*`）。
- **图片（封面）不经本地端口**：`SeriesAdapter.kt:144 artwork.load(series.cover, holder.image)` 的 `cover` 为远端 CDN URL（`cleanUrl` 仅做反转义），走外网连接。
- **响应头 `Connection: close`** → **每次 API 请求新建一条 TCP 连接**。

⇒ 因此**「到本地端口的 TCP 连接数」= 「API 请求数」**，可用作精确的请求计数器（图片不干扰）。

### 2.2 请求计数探针（本复核的核心手段）

设备侧高频采样 `/proc/net/tcp` 视图：

```sh
# 端口由 ss -ltn 动态发现（随机端口，每次启动变化）
while true; do ts=$(date +%s%3N); ss -tan | grep $PORT | grep -v LISTEN | sed "s|^|$ts |"; sleep 0.01; done
```

- 采样率 ≈ 300+ 次/秒（≈3ms/次），足以捕获 ESTAB 阶段（本地 API 内含远端抓取，单次耗时 ≫ 采样间隔）。
- 统计口径：**仅计「首次出现 ESTAB 状态」的客户端端口** = 新发起的请求；`TIME-WAIT`-only 端口视为采样前已完成的背景请求（排除）。
- 分阶段打点（IDLE / SLOW / RAPID / AFTER）写入独立文件，避免重定向交错。

### 2.3 设备与环境陷阱（复用 P2 经验）

- adb 必须 `-P 15037`（MuMu 自带 `adb.exe`；本机 5037 被占用）。adb 路径：`/d/Program Files/Netease/MuMu/nx_main/adb.exe`。
- `MSYS_NO_PATHCONV=1` 必需；多设备并存必须 `-s 127.0.0.1:16448`。
- 视频播放中 UI 无法 idle → `uiautomator dump` 失败（`could not get idle state`）；须先暂停（`CENTER`）或先导航后 dump。
- 导航可靠路径：`MENU`（唤 chrome，焦点落「合集」action idx2）→ `DPAD_UP`（→ nav[2]「分类」）→ `RIGHT`（→「榜单」）→ `CENTER`。

---

## 三、逐项核查详情

### 3.1 卡片底部空白（重点）

**修复前基线**（`.agents/shared/t-p1-category.xml`，1920×1080，density≈1.667，`sw600dp`）：

```
未获焦卡片  y[122,672]  h=550px(=330dp 固定值)  imgH=330px(=198dp)  内容底=584  底部余白=88px(=52.8dp)
获焦卡片    y[111,683]  h=572px(=330dp×1.04)    imgH=344px          底部余白=92px(=52.6dp)
该 dump 中同时存在文本「加载更多 · 第 X 页」 ← 修复前按钮存在的直接证据
```

**修复后实测**（`.agents/shared/t-q2-cat-p1.xml`，1280×720，density=1.2，`sw600dp`）：

```
未获焦卡片  y[78,411]   h=333px(=277.5dp, WRAP_CONTENT)  imgH=238px(=198dp)  内容底=399  底部余白=12px(=10dp)
获焦卡片    y[71,418]   h=347px(=333×1.04)                                    底部余白=13px
```

**dp 归一化对比**（消除密度差）：

| 项 | 修复前 | 修复后 | 变化 |
|---|---|---|---|
| 卡片高度 | **330 dp（写死）** | **277.5 dp（内容驱动）** | −52.5 dp |
| 内容合计（图 198 + 标题 + 徽标 + padding） | ~277 dp | ~277.5 dp | — |
| **底部余白** | **52.8 dp（16%）** | **10 dp（3.6%）** | **−81%** |

**结论（已核实）**：
- 固定高度 `series_card_width`(=330dp) 造成的 **52.8dp「松弛空白」已被彻底消除**；`WRAP_CONTENT` 使卡片高度贴合内容。
- 残留的 12px（10dp）**并非浪费空白**，而是卡片自身的 `setPadding(cardMargin…)`（`series_card_margin`=7dp）与徽标内底距（`series_card_badge_pad_bottom`=3.5dp）之和 —— 属设计内边距。
- **⚠️ 与 Q1 报告的偏差**：Q1 报告称「底部多余空白：0px（100% 消除）」，**该表述不准确**。实测仍有 10dp 内边距（榜单页更大，见 §4.1）。

### 3.2 同行卡片等高（易忽略项）

同一行 5 张未获焦卡片（`.agents/shared/t-q2-cat-p1.xml`）：

| 卡片 | y 范围 | 高度 | 顶部 |
|---|---|---|---|
| 京夜诱温 | [78,411] | 333 | 78 |
| 妹妹博士毕业宴上… | [78,411] | 333 | 78 |
| 雾锁情迷 | [78,411] | 333 | 78 |
| 分手四年，傅机长失了控 | [78,411] | 333 | 78 |

**结论（已核实）**：同行卡片 **完全等高、顶部对齐**（333px 统一）。第 1 张卡 `[71,418]`（347px）高出的部分为**焦点放大**：`SeriesAdapter.kt:139-146` 中 `holder.card.scaleX/scaleY = 1.04f`，347/333 = 1.042 ≈ 1.04 ✓，**为设计行为，非等高缺陷**。

**成因**：卡片内图片容器高度为**固定 dp**（`series_card_image_height`=198dp，`SeriesAdapter.kt:84`），标题 `maxLines=2, minLines=2`（`SeriesAdapter.kt:96`），故高度恒定 → 天然等高（比 `WRAP_CONTENT` 带来的参差风险更稳）。

### 3.3 「加载更多」按钮是否移除

- **修复后**（`.agents/shared/t-q2-cat-p1.xml`、`t-q2-rank-p1.xml`）：全文无「加载更多」/「下一页」/「第 X 页」文本。✅
- **修复前**（`.agents/shared/t-p1-category.xml`）：**存在**「加载更多 · 第 X 页」按钮节点。✅（前后对照）
- **代码**：`git diff` 显示 `MainActivity.kt` 中 `if (!catalog.ended …) { catalogView.addLoadMoreButton(…) {…} }` 整块被删除。✅

**结论（已核实）**：按钮已移除。

### 3.4 自动分页是否生效（须有「数据增加」证据）

> ⚠️ 静态截图不足以证明；以下均以「新标题出现」为数据增加的证据。

**分类页**（`t-q2-probe3.log`，D3 全新进入分类页）：

- 150 次 DPAD_DOWN（33.3s）期间，向本地端口发起 **12 次请求**，时间点（ms）：
  `1298, 4586, 7819, 10138, 13306, 16267, 19484, 21935, 24400, 27294, 30214, 33093`
- 末态 dump（`t-q2-cat-stable.xml`）出现第 1 页未见的标题（如「铜雀春生」「我家长嫂不好惹」「被赶下山后我成了京城团宠」等），**列表持续延伸**。
- 结合 `t-q2-probe3.log` 的 12 次请求 ⇒ 至少翻至第 13 页。

**榜单页**（`t-q2-probe6.log`，D3 全新进入榜单页）：

- 30 次慢速下翻 + 20 次快按，发起 **2 次请求**（t=478ms、3559ms）。
- 末态 dump（`t-q2-rank-end3.xml`）标题含 **第 3 页**条目：`我合成了全世界第1季`、`谁说纨绔不能当状元第五季`、`烬九州：第三十二季`（经 `/api/rank/list?type=all&page=3` 独立比对确认）。
- 独立验证榜单 API 分页有效：page1/2/3 各 20 条且内容互异。

**结论（已核实）**：滚动到底部自动加载下一页生效，且**数据真实增加**。

### 3.5 🔴 是否真的「不频繁查询」（最关键）

**方法**：TCP 连接探针（§2.2），统计「新增 ESTAB 请求数」与「单次采样最大并发 ESTAB」。

| 测试 | 场景 | 请求数 | 最大并发 ESTAB | 结论 |
|---|---|---|---|---|
| 探针 v2（分类页） | IDLE 5s（0 输入） | 1 | 1 | 静置不请求风暴 |
| 探针 v2 | SLOW 6 次/1s | 1 | 1 | 每次翻页 1 请求 |
| 探针 v2 | **RAPID 40 次 / 1.135s** | **1** | **1** | **1.1 秒内 40 次快按只发 1 次请求** |
| 探针 v2 | AFTER 5s（静置） | 0 | 1 | 无尾随重复请求 |
| 探针 v3（分类页） | 150 次 / 33.3s | 12（间隔 2.5–3.3s） | **1** | 一页一请求，串行 |
| 探针 v3 | 续 40 次快按 | 1 | 1 | 无重复 |
| 探针 v6（榜单页） | 30 次 / 13.1s + 20 次快按 | 2 | **1** | 一页一请求，串行 |

**结论（已核实，强证据）**：

1. **请求进行中不会被再次触发** —— 全部 6 组测试中**单次采样最大并发 ESTAB 恒为 1**，从未出现两条请求连接同时存在。
2. **连续快速滚动不产生重复请求** —— 1.135 秒内 40 次 DPAD_DOWN 仅产生 **1 次请求**；150 次下翻仅 12 次请求（≈每页 1 次），请求间隔 2.5–3.3s，与单页加载耗时一致。
3. **无请求风暴** —— 静置（IDLE/AFTER）阶段请求数为 0（IDLE 的 1 次为上一页加载的尾随，非重入）。

**代码层印证**（`MainActivity.kt:1197-1210 triggerAutoPage`）：

```kotlin
private fun triggerAutoPage() {
    if (catalog.ended || navigationJob?.isActive == true || loadingCatalogMore || loadCatalogMoreFailed) return
    val manager = catalogGrid?.layoutManager as? GridLayoutManager ?: return
    val total = manager.itemCount; val lastVisible = manager.findLastVisibleItemPosition()
    if (total <= 0 || lastVisible < total - 5) return
    loadingCatalogMore = true; catalogScroll = manager.onSaveInstanceState(); loadCatalog(nextPage = true)
}
```

四重守卫（`ended` / `navigationJob.isActive` / `loadingCatalogMore` / `loadCatalogMoreFailed`）在设置 `loadingCatalogMore=true` 前完成，且该赋值与 `loadCatalog` 均在同一主线程同步执行，**不存在检查-使用竞态**。`loadCatalog` 成功/失败路径均复位 `loadingCatalogMore`（`MainActivity.kt:1088-1097`）。

> 注：Q1 报告中的 `Log.d("CatalogPage", …)` 证据已被其自行删除（见 §3.8），**无法复现其原始日志**；上述结论由我方独立探针得出。

### 3.6 边界情况

| 场景 | 期望 | 复核结果 |
|---|---|---|
| 已到末页不再请求 | 停止 | ✅ **已核实**：榜单页在已加载完（含第 2/3 页）后再连按 90 次 → 仅 0–1 次请求（`t-q2-probe4/5.log`）；代码 `catalog.ended` 为 `triggerAutoPage` 首条守卫；`ended` 判定含 `page>=5`、`rows.isEmpty()`、本页无新增三项 |
| 切换榜单重新触发 | 能 | ✅ **代码核实**：`onRankSelected`（`MainActivity.kt:1135-1141`）重置 `catalog.ended=false; loadingCatalogMore=false; loadCatalogMoreFailed=false; page=1` |
| 切换分类筛选重新触发 | 能 | ✅ **代码核实**：`onFilterSelected`（`MainActivity.kt:1124-1131`）同样重置 |
| 加载失败不无限重试 | 不重试 | ✅ **代码核实**：失败置 `loadCatalogMoreFailed=true`（`MainActivity.kt:1096`），该标志为 `triggerAutoPage` 守卫之一 → 自动分页停摆，仅手动「重试」按钮可复位（`MainActivity.kt:1100`）。⚠️ **未能实测**（未制造网络失败场景） |
| 加载中不阻塞焦点 | 不阻塞 | ✅ **实测观察**：加载期间 DPAD_DOWN 仍持续生效（探针测试中焦点随按键移动）；`loadCatalog` 在 `scope.launch` 协程中执行，UI 线程未阻塞 |

### 3.7 是否有越界改动

`git diff HEAD --stat` 结果（生产代码）：

```
apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt        | 50 +++++++++++-----
apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt       |  2 +-
apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt| 22 +++++++++-
```

- **仅 3 个授权文件被修改**；授权清单中的 `res/values*/dimens.xml` **未被改动**（采用方案 A，无需改 dimen）。
- **未触碰** `shared/content-core/hongguo.js`、`custom-server/`。✅
- 其余改动均为 `.agents/` 总线文件（任务/日志/锁）。

**结论（已核实）**：无越界改动。

### 3.8 是否遗留调试日志

- `grep -rn "Log\.(d|e|i|w|v)(" apps/tv-android/app/src/main/java/` → 仅命中**既有** `StandaloneEngine.kt:47/125`（与本任务无关）。
- `git diff HEAD -- apps/tv-android/` 中**无任何 `Log.` 新增行**。
- 全文搜索 `CatalogPage` → 无残留（Q1 报告中的 `D CatalogPage:` 标签已清除）。

**结论（已核实）**：**无调试日志残留**，Q1 清理彻底。

---

## 四、发现的问题（均不阻断）

### 4.1 Q1 报告「底部空白 0px」表述不准确

- **实测**：分类页残留 12px（10dp）＝卡片 padding（7dp）+ 徽标内底距（3.5dp）；榜单页残留 32px（26.7dp）。
- **性质**：该残留是**设计内边距/占位**，非固定高度松弛。Q1 的「0px」结论方向正确（松弛已消除），但**数值表述失实**，建议报告改为「固定高度松弛 52.8dp → 0；保留设计内边距约 10dp」。
- **榜单页额外问题**：榜单卡片的第 3 子节点为**空 TextView**（集数为空），仍占 24px（20dp）高度，导致榜单卡底部余白达 32px（26.7dp）。建议：`subtitle` 为空时 `badge.visibility = GONE`。

### 4.2 死代码残留（无害，建议清理）

- `CatalogScreenView.kt:329 fun addLoadMoreButton(...)` —— **已无任何调用方**（原调用点已删）。
- `R.dimen.series_card_width`（三档 dimens 均定义）—— **已无任何引用**（`SeriesAdapter` 已改用 `WRAP_CONTENT`）。
- 二者均不影响运行；建议后续清理轮次一并移除，避免误导。

### 4.3 提示（非本次改动引入）

- `values-w1280dp` 被 `values-sw600dp` 遮蔽（Android 限定符优先级：smallestWidth 先于 available width）——该既有工程问题已由我方另行记录于 `.agents/shared/device-dimens-bucket-correction.md`，本任务不涉及。

---

## 五、无法核实项（如实说明）

1. **Q1 原始 logcat 证据**：Q1 报告引用的 `D CatalogPage` 日志已被其删除，无法复现；本报告改用独立 TCP 探针复测（结论一致且更强）。
2. **失败重试路径**：未构造网络失败场景，`loadCatalogMoreFailed` 的实际拦截效果仅作代码核实（未实测）。
3. **其他分辨率档位**：本次仅覆盖 `sw600dp`（D3 当前档）。`values`/`values-w1280dp` 档未实测（后者因遮蔽不可达）。
4. **`values` 默认档布局**：D1（Q1 用机）为 720p@240dpi → 实为 `values` 档，与 D3 的 `sw600dp` 不同；Q1 报告中的 720p 数值与本次 sw600dp 数值不可直接横比（本报告已按 dp 归一化处理）。

---

## 六、复核结论

**Q1（`t-q1-card-autopage`）三项需求全部达成，判定：通过（Pass）。**

- 需求 1（删空白）：✅ 达成。固定高度松弛（52.8dp）已消除；卡片改内容驱动。
- 需求 2（自动分页、去按钮）：✅ 达成。按钮已移除；滚动到底自动加载（分类页实测连翻 12 页、榜单页至第 3 页）。
- 需求 3（约束、不频繁查询）：✅ 达成。实测最大并发恒为 1，1.1s 内 40 次快按仅 1 请求，每页严格 1 请求。

**建议（不阻断交付）**：修正 Q1 报告的「0px」表述；清理 2 处死代码；榜单卡片空集数行改为 `GONE`。

---

## 七、证据文件清单（`.agents/shared/`）

**UI dump（几何/结构证据）**
- `t-q2-cat-p1.xml` — 分类页第 1 页（修复后，卡片几何主证据）
- `t-q2-cat-stable.xml` — 分类页深翻后（含第 2 页起标题）
- `t-q2-cat-end.xml` / `t-q2-cat-endpage.xml` — 分类页滚动后末态
- `t-q2-rank-p1.xml` / `t-q2-rank-fresh.xml` — 榜单页第 1 页（顶部 Tab 平铺、卡片几何）
- `t-q2-rank-end3.xml` — 榜单页末态（含第 3 页标题）
- `t-q2-chrome.xml` / `t-q2-chrome2.xml` — chrome 导航结构
- `t-p1-category.xml`（既有基线）— 修复前卡片几何 + 「加载更多」按钮存在证据

**请求探针日志（不频繁查询证据）**
- `t-q2-probe2.log` + `t-q2-marks2.log` — 分类页 IDLE/SLOW/RAPID 分相位
- `t-q2-probe3.log` + `t-q2-marks3.log` — 分类页 150 次长滚动（12 请求）
- `t-q2-probe4.log` / `t-q2-probe5.log` + `t-q2-marks4/5.log` — 榜单页重复滚动
- `t-q2-probe6.log` + `t-q2-marks6.log` — 榜单页全新受控（2 请求，第 2/3 页）
- `t-q2-ss-burst.log` / `t-q2-ss-scroll.log` — 早期连接采样

**探针脚本**
- `q2_probe.sh` / `q2_probe3.sh` / `q2_probe4.sh` — 设备侧分相位采样脚本
- `q2_analyze.py` — dump 卡片几何解析脚本
