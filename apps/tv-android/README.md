# 红果 TV · 原生沉浸式刷剧

Android 5.1.1+（API 22），独立 Kotlin / Android Views / Media3 工程。APK 内置 QuickJS 2025-09-13、内容签名与解密引擎、原生网络和应用内媒体服务，直接访问内容源；启动无需填写 8788 地址，也无需其他设备开机。

每次启动播放推荐第一页，单集结束继续同剧下一集，全剧结束切下一部推荐。完整剧集播放结束显示相关推荐供手动选择。收藏、历史、搜索记录及画质／倍速偏好保存在原生 SQLite；每秒及关键操作记录进度，记录与待同步事件在同一事务中提交。

设置页可选配置远程共享服务器和家庭共享密钥。验证成功后双向同步收藏、历史、搜索和播放偏好；断网保留本地操作并补传，取消同步保留本地数据。历史合并为每部剧一张续播卡片，展示集数、进度条和观看时间，不再区分来源端。**TV 不提供删除或清空历史的能力。** 旧 SharedPreferences 记录原子迁入 SQLite；保留的旧服务地址仅用于一次性导入旧共享历史，失败不影响独立播放。

## 遥控器

- 无操作栏时：上／下切剧，左／右快退／快进 10 秒（长按连续调整）。
- 确定键：暂停并显示操作栏与顶部导航；底部依次提供继续播放、下一集、选集、收藏、画质、倍速。
- 推荐页顶部导航：推荐、搜索、分类、排行榜、收藏、历史、设置。播放闲置 5 秒后自动隐藏；暂停、操作栏展开或导航有焦点时保持显示。在底部操作栏按上键可进入顶部导航。
- 返回：关闭操作栏／弹层，返回上一页；刷剧根页面确认退出。
- 最后一集时“下一集”禁用；结束后的自动连播行为保持原有规则。

## 构建

JDK 17，SDK / Build Tools 35，AGP 8.9.2，Gradle 8.11.1，Kotlin 2.1.20，Media3 1.8.0，NDK 28.2.13676358，CMake 3.22.1。NDK 可安装到 SDK 默认目录，或通过 ANDROID_NDK_HOME 指向已有安装。

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'
$env:ANDROID_HOME = 'C:\Users\AnLin\AppData\Local\Android\Sdk'
.\apps\tv-android\gradlew.bat -p apps/tv-android :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Linux 使用 bash apps/tv-android/gradlew。APK：app/build/outputs/apk/debug/app-debug.apk，应用 ID：com.hongguotv.tv。Debug 包使用本机开发签名，不作为正式签名发布。

```powershell
adb -s <设备ID> install -r apps/tv-android/app/build/outputs/apk/debug/app-debug.apk
adb -s <设备ID> shell am start -n com.hongguotv.tv/.MainActivity
```

UI 和本地持久化测试：构建 :app:assembleDebugAndroidTest，安装两份 APK 后运行 adb shell am instrument -w com.hongguotv.tv.test/androidx.test.runner.AndroidJUnitRunner。

远程协议：Bearer 家庭密钥，握手校时、带实例 ID 的幂等事件上传及游标增量下载。SQLite 持久化设备 ID、序号、删除／清空标记和待上传队列；新远程目标上传原事件身份，过期响应不应改变配置。首版不提供账号同步、下载、手机遥控及自动更新。

QuickJS 自编译四种 ABI（armeabi-v7a、arm64-v8a、x86、x86_64），所有 ABI 的最低平台均为 API 22。Gradle 自动将 shared/content-core/hongguo.js 打入 APK。签名、元数据解析及 Spade URL 解密沿用共享引擎；MP4 CENC 索引和实际 Range 解密使用对应原生实现，避免老电视上大段视频数据经过 JS Buffer。第三方许可证随 APK assets 一起打包。

实机调试：adb connect 192.168.1.120:5555。设备为 Android 5.1.1 / API 22、armeabi-v7a、1280×720。部分厂商系统会在应用进入后台时强制杀进程；冷启动按设计重新进入推荐，历史记录仍持久化保存。
