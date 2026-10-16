# P4 TV 列表渲染交付（codex）

日期：2026-10-16。执行范围为已认领的 `t-p4-tv-render`；任务状态由 root/codex 统一提交。没有修改 MainActivity、引擎、Web、后端或其他 agent 的测试与性能脚本，没有提交 Git。

## 实际改动

- `apps/tv-android/app/src/main/java/com/hongguotv/tv/ArtworkLoader.kt`：相同目标的相同 URL 已显示/加载中时跳过；缓存命中直接替换 bitmap，不先清空；仅未命中时清空。每个 ImageView 记录独立 Pending 身份，重绑/回收取消旧 coroutine 和真实 OkHttp Call；即使 A→B→A，也不能被第一个 A 的迟到响应覆盖。失败后可重试相同 URL。
- 图片使用 **OkHttp enqueue**，`maxRequests=4`、`maxRequestsPerHost=4`，下载与解码均在异步 callback 生命周期内。并非仅对同步 execute 设置无效的 dispatcher 限额。取消活跃请求会立即腾出网络槽；在 UI layout/bind 后启动 HTTP，回收发生在同一 pass 时可以不发请求。关闭时取消任务、清引用、取消 HTTP、清连接池与 bitmap 缓存。
- `apps/tv-android/app/src/main/java/com/hongguotv/tv/SeriesAdapter.kt`：每个 Holder 创建时计算一次圆角并预建金/银/铜/普通四种 GradientDrawable；bind 按索引复用。`onViewRecycled` 清理请求、tag、drawable、点击/焦点监听、缩放、内容说明、文案和进度。
- 新增 `ArtworkRenderingTest.kt` 和 `CatalogRenderingTest.kt`，均位于 `app/src/androidTest/java/com/hongguotv/tv/`，不改现有测试。

## 验证环境与命令

JDK 17，本机 SDK 35；只操作 codex 的 D2 `127.0.0.1:16416`，ADB server 15037。设备 API 35，实际 `wm size` 为 physical 1080×1920、override 1280×720，本轮未改分辨率，也未操作 D1/D3/实体电视。

构建前检查没有其他活跃 Gradle 构建，并通过 `.agents/shared/p4-build-window-codex.md` 提示 WorkBuddy 避免争用。

```powershell
$env:JAVA_HOME='C:/Program Files/Java/jdk-17'
cd apps/tv-android
./gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest --console=plain
```

最终 `outputs/p4-final-build.log`：`BUILD SUCCESSFUL`，原有 **32 个单元测试全部通过**。lint **0 errors、79 warnings**，未将现有警告计为零。Debug APK 和 instrumentation APK 构建通过。

```powershell
adb -P 15037 -s 127.0.0.1:16416 install -r apps/tv-android/app/build/outputs/apk/debug/app-debug.apk
adb -P 15037 -s 127.0.0.1:16416 install -r apps/tv-android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -P 15037 -s 127.0.0.1:16416 shell am instrument -w -r -e class com.hongguotv.tv.ArtworkRenderingTest,com.hongguotv.tv.CatalogRenderingTest -e p4Label verified-final-acceptance com.hongguotv.tv.test/androidx.test.runner.AndroidJUnitRunner
```

最终 `outputs/p4-final-device.log`：**OK (10 tests)**。9 条封面行为测试加 1 条真实三页面滚动集成测试。注意 Android instrumentation 正常完成也返回 `INSTRUMENTATION_CODE: -1`，以 JUnit `OK`/失败数量判定，不能仅看 shell 退出码。

### 先失败后通过证据

- 修改业务前，真实 ImageView+MockWebServer 的首批 6 条测试跑出 5 个预期失败：16 个同时 HTTP、20 次同目标重复请求、徽标重复创建、同图片 drawable 重建、回收 tag 未清理。日志 `outputs/p4-red-device.log`。旧的 A→B URL 校验本来已能通过，并未误称为本次才修复。
- 另以同一修复前 APK 重现 A→B→A：`outputs/p4-red-aba.log`，蓝色新 A 被旧红色 A 覆盖，**1 test / 1 failure**；修复后在最终 10 条测试中通过。
- 旧 APK 是修改业务前构建并从 D2 拉取的 `outputs/p4-before.apk`，SHA256 `9FE881E77535278C739A6F33C29AEEC6F427924F6984C9A6ED0837613B54C49D`。

## 8 项行为核对

| 行为 | 本轮实际证据 |
| --- | --- |
| 分类快速滚动无错位 | 真实 MainActivity 分类页，120 张不同色封面，40 次往返滚动，返回后逐 Holder 校验 tag 与 bitmap 像素匹配 |
| 榜单无错位/缓存闪烁 | 同样滚动并检查；真实 ImageView 记录 setter，缓存/相同图不发生 null 清空。未录制连续视频，不能用静态截图证明任意帧零闪烁 |
| 返回已加载位置 | 真实缓存第二个目标立即有图、无 clear；目录往返后封面正确 |
| Top 1/2/3 | 实际绘制 GradientDrawable 到 bitmap 验证金/银/铜颜色，截图也已目视检查 |
| Top 4+ | 验证普通深色渐变、Top 文案和四种 drawable 身份复用 |
| 分类左栏 | 点击爱情筛选，等待新 CatalogScreenView.selectedTag 为 romance 后重新核对封面；未仅检查同步字段变化 |
| 搜索结果 | 等待真正的 source=search 页面，独立滚动、校验封面和截图 |
| 内存 | 三组前后 meminfo；新包 PSS 约 95–114 MiB。未出现这些短场景持续增长的证据，但**不能证明无泄漏**；Android 5.1.1 长时间滚动/heap 分析仍待验收 |

测试数据为本地 HTTP 的确定性不同色封面，没有依赖真实内容源，也未改收藏/历史数据库。临时 `contentTestOrigin` 在 finally 中恢复原值。

## gfxinfo 对照（不夸大性能收益）

修复前后各 3 次同一确定性场景，每页 120 条、40 次 `scrollBy`，API 35/720p。只使用 `outputs/p4-device-evidence/p4-verified-before*` 和 `p4-verified-final*` 的三组主样本（不包含 acceptance 额外确认），汇总在 `outputs/p4-device-evidence/verified-summary.json`。

| 页面 | Janky% 中位数 前→后 | P90 ms 前→后 | P95 ms 前→后 | P99 ms 前→后 |
| --- | --- | --- | --- | --- |
| 分类 | 2.04 → 1.92 | 10 → 12 | 15 → 14 | 18 → 20 |
| 榜单 | 0 → 0 | 5 → 5 | 5 → 5 | 5 → 5 |
| 搜索 | 0 → 0 | 5 → 5 | 5 → 5 | 5 → 5 |

分类只有约 49–52 帧/组，前后结果接近且 P90/P99 有波动；**这些数据不足以声称整体帧率显著提升**。明确收益是回收清理、重复请求消除、真实并发限制和徽标分配复用，已有行为断言；真实低端电视长时间滚动仍需验收。

新包三组分类 PSS：112.61→113.82、95.28→98.36、107.64→110.19 MiB；同组榜单随后为114.14→112.15、98.04→96.23、110.06→108.21 MiB；搜索随后为112.62→111.77、96.67→95.65、108.66→107.64 MiB。包含首次图片缓存增长与 GC 波动，不据此判断绝对无泄漏。

### 实测脚本修正说明

早期目录测试仅等待 itemCount=120，可能看见上一页旧 grid。目视检查 rank 截图发现问题后，已改为同时等待 `currentCatalogView.source`，分类筛选同时等待新 view 的 `selectedTag`，并等 compositor 后截图。早期未带 `verified-` 的目录证据不用于最终验收；报告数字只取修正后的新旧各三组。未覆盖其他 agent 的 `scripts/perf/` 文件。

可查看最终截图：

- `outputs/p4-device-evidence/p4-verified-final-acceptance/category-return.png`
- `outputs/p4-device-evidence/p4-verified-final-acceptance/rank-start.png`
- `outputs/p4-device-evidence/p4-verified-final-acceptance/search-return.png`

## 产物与剩余事项

最终 `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk` SHA256：`F037F14DE0F43AC33B525640A6D2E0192D1F14A6425B1E1D0550BFEA0DE370C0`。D2 已安装最终新包，无 release 发布或用户实体电视安装。API 22 实体电视、真实内容源、长期滚动与严谨泄漏分析未验证，交给 DSH 后续验收。

Android 构建窗口已结束，root 可以独立审查。本子执行不调用 claim/done，不提交 Git。

## Root 独立验收

root/codex 已读取业务 diff、最终构建日志、32 份单元测试统计（32 tests / 0 failures）、APK SHA256 和修正后的 gfx/mem 对照，并实际查看最终榜单截图。另由只读审查者复核 enqueue 限并发、取消、ABA 隔离、缓存命中、回收和 API 22 兼容，未发现阻断问题。

root 在 D2 独立重跑 ArtworkRenderingTest 与 CatalogRenderingTest：**OK (10 tests)**，日志 `outputs/p4-root-verify.log`，耗时 11.36 秒，使用 p4Label=codex-root-verify。文件 SHA256 与子执行报告一致。认可行为修复完成，保留低端真机长期滚动、严谨泄漏分析及帧率收益未证实的限制。
