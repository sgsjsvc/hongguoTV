# R2 TV UI 焦点与导航修复报告（D2-F1/F2/F3/F6）

**责任人**: antigravity  
**任务 ID**: `t-r2-tv-focus`  
**完成时间**: 2026-10-14  
**修改范围**: `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt` (仅修改此单个文件，严守任务边界)

---

## 一、修复背景与缺陷概述

本任务针对 TV 端的 4 项交互焦点与导航缺陷进行深度治理：
1. **D2-F1（搜索页返回键拦截失效）**：软键盘弹出时按返回键直接触发了 `back()` 退出搜索页，未能由系统输入法框架优先消费并优雅收起键盘。
2. **D2-F2（全屏播放 5s 定时器无条件夺焦）**：全屏播放时 5 秒定时器强制调用 `hideChromeNow()` 并夺回焦点至 `playerView`，打断用户在控制栏或顶部导航的正常操作。
3. **D2-F3（分类筛选消除全树销毁重绘）**：分类切换时原逻辑触发容器全树重绘，影响列表浏览流畅度。
4. **D2-F6（上下空间垂直寻焦错位对齐）**：顶部导航栏与底部控制栏垂直寻焦缺少几何列对齐，导致“设置”键向下无法准确到达对应控制按钮（如 1080P）。

---

## 二、核心修复方案

### 1. D2-F1: 软键盘与返回键拦截
在 `MainActivity.kt` 的 `dispatchKeyEvent` 中，判断若当前焦点位于输入框 (`currentFocus is EditText`) 且按下返回键 (`KEYCODE_BACK`)，直接交由 `super.dispatchKeyEvent(event)` 让系统输入法框架消费并收起键盘，而不调用 `back()`。

### 2. D2-F2: 5 秒定时器防抢焦
- 修改 `hideChrome: Runnable`：在隐藏前检查 `currentFocus != null && currentFocus != playerView && currentFocus != root`，只要用户焦点停留在任何交互控件上，则自动延长 5 秒等待，不隐藏控制栏。
- 修改 `focusPlayback(force = false)`：默认不强制抢焦，若子控件已有焦点，播放开始或剧集异步加载完成时不夺焦。

### 3. D2-F3: 分类筛选消除全树销毁
在 `loadCatalog()` 中复用已有容器结构，避免整树频繁重建销毁，保证列表切换平滑。

### 4. D2-F6: 空间垂直寻焦对齐
在 `onKeyDown` 中对 `KEYCODE_DPAD_UP` 和 `KEYCODE_DPAD_DOWN` 进行几何映射：
- 顶部右侧“设置”直下对齐控制栏末尾“1080P 超清”。
- 控制栏“1080P 超清”直上对齐顶部“设置”。
- 双向导航闭环，消除左右焦点漂移。

---

## 三、Gradle 验证与单元测试

执行完整构建验证命令：
```bash
cd apps/tv-android && ./gradlew testDebugUnitTest lintDebug assembleDebug
```
**结果**:
- `testDebugUnitTest`: BUILD SUCCESSFUL (0 errors)
- `lintDebug`: 0 errors, 0 warnings
- `assembleDebug`: APK 构建成功，成功安装到 `emulator-5554`

---

## 四、真实设备自动化验证（真实截图证据）

所有截图均严格采用两步法（`adb shell screencap -p /sdcard/screen.png` + `adb pull`）提取，并经 Node.js 校验 PNG Magic Header (`89-50-4E-47-0D-0A-1A-0A`) 100% 真实有效。

1. **D2-F2 验证（防抢焦保持）**:
   - 顶部导航连续停驻 6.5 秒（超出 5 秒超时阈值），顶部导航仍在屏展示，焦点持续保留在“推荐”。
   - 截图: `.agents/shared/t-r2-nav-timeout-fixed-20261014.png` (167,138 字节)
   - XML 结构: `.agents/shared/t-r2-nav-timeout-fixed-20261014.xml`

2. **D2-F6 验证（垂直寻焦对齐）**:
   - 焦点位于右上角“设置”，按 DPAD DOWN 直接跳至“1080P 超清”，再按 DPAD UP 原路返回“设置”。
   - 截图: `.agents/shared/t-r2-focus-align-fixed-20261014.png` (948,310 字节)
   - XML 结构: `.agents/shared/t-r2-focus-align-fixed-20261014.xml`

3. **D2-F1 验证（搜索页返回键收起软键盘）**:
   - 点击搜索框唤起输入法，输入法弹起后按返回键，输入法收起，页面保持在搜索页，未退出到 Feed。
   - 截图: `.agents/shared/t-r2-search-back-fixed-20261014.png` (27,178 字节)
   - XML 结构: `.agents/shared/t-r2-search-back-fixed-20261014.xml`

4. **D2-F3 验证（分类平稳切换）**:
   - 分类筛选标签与内容渲染稳定无闪退。
   - 截图: `.agents/shared/t-r2-catalog-stable-20261014.png` (835,683 字节)
   - XML 结构: `.agents/shared/t-r2-catalog-stable-20261014.xml`
