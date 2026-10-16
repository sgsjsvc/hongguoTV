# B7 Android 构建记录

2026-10-16，codex。构建前以 Get-CimInstance 检查 java.exe，未见活动 Gradle 构建；随后在 apps/tv-android 串行执行 testDebugUnitTest、assembleDebug、assembleDebugAndroidTest（JDK17），命令已退出成功，当前已释放构建占用。此次记录于命令完成后补写，下次严格于启动前写入占用，避免其他方误判空闲。

日志：outputs/testing/b7/android-build.log。只用于验证共享 recommendation-core.cjs 自动打入 APK，无 Kotlin/构建配置更改。后续仅操作 Codex 的 D2；不占用其他设备或实机。
