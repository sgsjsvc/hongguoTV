# TV 普通全屏上下键切集

2026-10-15，用户直接指令「完成TV端」，接续 Web / Windows 上下键切集需求。

业务范围：MainActivity 普通播放（Screen.FULL / 非 feedMode）、操作栏隐藏且无弹窗/抽屉时 ↑ 上一集、↓ 下一集。首尾 Toast 提示，不跨剧循环；repeatCount 非 0 不连跳。切集前调用 saveProgress，复用 loadEpisode 的取消旧请求及 generation 隔离；使用 showSwitchHint 保持操作栏隐藏，便于继续按方向键。菜单、抽屉焦点及推荐切剧不变。

修改文件：
- `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`
- `apps/tv-android/app/src/main/java/com/hongguotv/tv/PlaybackPolicy.kt`
- `apps/tv-android/app/src/test/java/com/hongguotv/tv/PlaybackPolicyTest.kt`
- 新增 `apps/tv-android/app/src/androidTest/java/com/hongguotv/tv/FullEpisodeKeysTest.kt`

保留其他 agent 在 CatalogScreenView.kt / TvUiLayoutTest.kt 的已有差异，未覆盖或回退。

验证：新增策略测试先失败（缺少 remoteEpisodeIndex），实现后 `:app:testDebugUnitTest` 32 项通过；`:app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest` 成功，JDK 17。日志 `outputs/testing/tv-episode-red.log` / `tv-episode-build.log`。

仅使用分配给 Codex 的 D2（ADB server 15037 / 127.0.0.1:16416 / API 35），安装 debug 与测试 APK，运行 `am instrument -w -r -e class com.hongguotv.tv.FullEpisodeKeysTest com.hongguotv.tv.test/androidx.test.runner.AndroidJUnitRunner`：OK (1 test)。真实注入 DPAD 上下键验证切集、首尾、保持普通播放页、菜单及抽屉不切集；重复 KeyEvent 验证防长按。通过本地 MockWebServer 返回画质并检查选中媒体 ID，未验证视频解码或声音。本次未操作 D1 / D3 / 实体电视。

APK：`outputs/testing/tv-episode-shortcuts-20261015/hongguotv-tv-debug.apk`。仍 minSdk 22；Android 5.1.1 实体电视上的本次交互待 DSH 验收。未提交、推送或修改 Web / Windows 业务代码。
