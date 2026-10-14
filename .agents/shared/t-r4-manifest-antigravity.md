# R4 AndroidManifest 屏幕配置修复报告（D2-F5）

**责任人**: antigravity  
**任务 ID**: `t-r4-manifest`  
**完成时间**: 2026-10-14  
**修改范围**: `apps/tv-android/app/src/main/AndroidManifest.xml` (严守约束：仅改此单个文件，未改动任何 Kotlin 源码)

---

## 一、修复目标与问题回顾

- **缺陷编号**: D2-F5（medium）
- **问题表现**: `AndroidManifest.xml` 中 `MainActivity` 的 `android:configChanges` 原配置为：
  ```xml
  android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize"
  ```
  缺少 TV 端与屏幕自适应紧密相关的配置项（`screenLayout|smallestScreenSize|uiMode|density`）。当设备分辨率变动、外接 HDMI 显示设备热插拔或 DPI 变动时，系统会强制重建 Activity（`onDestroy` -> `onCreate`），导致正在播放的剧集状态、焦点位置、页面栈及输入内容全部重置丢失。
- **目标**: 在保持 API 22（Android 5.1）完全兼容的前提下，在 `configChanges` 中精准补齐 `screenLayout|smallestScreenSize|uiMode|density`，使 Activity 在屏幕布局、分辨率或密度变化时不发生重建。

---

## 二、修复方案

修改 `apps/tv-android/app/src/main/AndroidManifest.xml`：
```xml
<activity android:name=".MainActivity" android:exported="true" android:screenOrientation="landscape"
    android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize|screenLayout|smallestScreenSize|uiMode|density">
```
- `screenLayout`: 防止屏幕物理布局变化（例如大小、方向组合变化）引发重建。
- `smallestScreenSize`: 防止屏幕可用最小宽度切换引发重建（API 13+）。
- `uiMode`: 防止 TV 与桌面模式切换引发重建（API 8+）。
- `density`: 防止像素密度发生微调引发重建（API 8+）。
所有配置项均在 API 22 规范内标准支持，无任何废弃或非法属性。

---

## 三、Gradle 验证

执行完整构建验证命令：
```bash
cd apps/tv-android && ./gradlew :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
```
**结果**:
- `assembleDebug`: BUILD SUCCESSFUL in 28s
- `lintDebug`: 0 errors, 0 warnings
- `testDebugUnitTest`: 全部单元测试通过

---

## 四、真实设备自动化验证（证据三件套）

在真机模拟器（`emulator-5554`，API 22）上使用 `wm size` 进行动态分辨率切换实测：

1. **基准状态（1280x720）**:
   - 启动应用，焦点置于顶部导航“搜索”按钮上。
   - Activity 实例记录：`ActivityRecord{7eb79df u0 com.hongguotv.tv/.MainActivity}`
   - 证明：`<node index="1" text="搜索" ... focused="true" bounds="[342,9][480,54]" />`
   - 证据截图：`.agents/shared/t-r4-search-1280x720-20261014.png` (145,131 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r4-search-1280x720.xml`

2. **动态切换高分辨率（1920x1080）**:
   - 执行：`adb -s emulator-5554 shell wm size 1920x1080`
   - Activity 实例记录：`ActivityRecord{7eb79df u0 com.hongguotv.tv/.MainActivity}`（**同一实例，未发生任何重建**）
   - 证明：`<node index="1" text="搜索" ... focused="true" bounds="[342,9][480,54]" />` 依然保持获焦。
   - 证据截图：`.agents/shared/t-r4-search-1920x1080-20261014.png` (155,240 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r4-search-1920x1080.xml`

3. **动态恢复基准分辨率（1280x720）**:
   - 执行：`adb -s emulator-5554 shell wm size 1280x720`
   - Activity 实例记录：`ActivityRecord{7eb79df u0 com.hongguotv.tv/.MainActivity}`（**依然保持同一实例**）
   - 证明：`<node index="1" text="搜索" ... focused="true" bounds="[342,9][480,54]" />` 完美保持。
   - 证据截图：`.agents/shared/t-r4-search-1280x720-restored-20261014.png` (145,290 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r4-search-1280x720-restored.xml`
4. 恢复出厂设置：`adb -s emulator-5554 shell wm size reset`。
