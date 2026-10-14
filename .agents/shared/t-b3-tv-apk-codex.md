# B3 Android TV APK 交付报告

执行方 codex；日期 2026-10-14；任务 t-b3-tv-apk。

## 结果与范围

构建 Debug 和未签名 Release APK，未修改 Android 源码、配置或共享引擎。Debug 已签名，可供安装调试；Release 未签名，不能作为可安装正式包，未添加正式签名密钥。

## 实际命令与结果

apps/tv-android 下执行：

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:ANDROID_NDK_HOME=$null
.\gradlew.bat :app:assembleDebug :app:assembleRelease :app:lintDebug :app:testDebugUnitTest --console=plain
```

exit 0，真实输出 BUILD SUCCESSFUL in 3m 11s，115 actionable tasks: 83 executed, 32 up-to-date。四个目标全部成功，日志 t-b3-build.log。使用既有 SDK／NDK／CMake 配置，未设置冲突的 ANDROID_NDK_HOME。

## 产物

| 文件 | 字节数 | SHA256 |
| --- | ---: | --- |
| hongguotv-android5.1-debug.apk | 8828939 | a8e43a21dfc7b18c1b179cf99e87c6f3544b98db3be3536e91c14cd71f2b11db |
| hongguotv-android5.1-release-unsigned.apk | 6857460 | 905e2a5bfd7c48bc04961b231b99be728d3e328727570dd5cc75f2fb5892037b |

目录 outputs/tv-android；校验清单 SHA256SUMS.txt。应用 com.hongguotv.tv，versionName 1.0.0、versionCode 1。

## 实际 APK 验证

SDK build-tools/35.0.0/aapt.exe dump badging 实际 Debug APK：sdkVersion='22'、targetSdkVersion='35'，native-code 包含 arm64-v8a、armeabi-v7a、x86、x86_64。证据 t-b3-badging.txt。

两个 APK 的 ZIP 清单均包含：

- lib/armeabi-v7a/libhongguo_quickjs.so
- lib/arm64-v8a/libhongguo_quickjs.so
- lib/x86/libhongguo_quickjs.so
- lib/x86_64/libhongguo_quickjs.so
- assets/hongguo.js，内容与 shared/content-core/hongguo.js 完全一致。

证据 t-b3-artifacts.json。apksigner.bat verify --verbose 实测 Debug：Verifies、v1=true、v2=true，具备 API 22 需要的 v1 签名，日志 t-b3-signature.log。minSdk 22 对应 Android 5.1，覆盖 5.1.1 安装版本要求。

## 尚未验证

此次未安装到电视或模拟器，未验证新包实机播放及四种 ABI 的实际运行。旧命名 APK 可能仍在输出目录，本报告的 SHA256 只指向此次新产物。
