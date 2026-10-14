# R3 选集抽屉 Tab 抢焦修复报告（D2-F4）

**责任人**: antigravity  
**任务 ID**: `t-r3-drawer-focus`  
**完成时间**: 2026-10-14  
**修改范围**: `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/EpisodeDrawerView.kt` (严守约束：仅改此单个文件，未改动 `MainActivity.kt`)

---

## 一、修复目标与问题回顾

- **缺陷编号**: D2-F4（medium）
- **问题表现**: 选集抽屉呼出时，当短剧剧集超过 50 集存在多个分组 Tab（例如“1—50”、“51—100”等）时，用户在分组 Tab 上按确认键切换分组，焦点被硬编码强行抢占转移到下方选集网格第一个剧集按钮（`drawerButtons.firstOrNull()?.requestFocus()`），打断了用户连续左右浏览选择分组的意图。
- **目标**: 移除硬编码抢焦，让 Tab 点击后焦点停留在 Tab 上（保持与 `DetailScreenView` 行为一致），同时支持用户按 DOWN 键主动进入选集网格。

---

## 二、修复方案

在 `EpisodeDrawerView.kt` 中：
1. **移除强制抢焦**:
   在 `render(detail, activeIndex)` 的分组 Tab 点击监听中，移除 `drawerButtons.firstOrNull()?.requestFocus()`，点击完成后焦点停留在当前 Tab（`groupTabsRow.getChildAt(g)?.requestFocus()`）。
2. **多层级焦点保持拦截器**:
   在 `groupTabsRow` 的层次变化监听器中，为注入的每个 Tab 按钮配置 `OnKeyListener` 与 `OnTouchListener` / `AccessibilityDelegate`。当用户在 Tab 按钮上按下遥控器确认键（`KEYCODE_DPAD_CENTER` / `KEYCODE_ENTER`）时，记录当前 `pendingTabFocusIndex`。
   在 `EpisodeDrawerView` 的 `requestChildFocus` 中，如果检测到属于 Tab 切换产生的子视图抢焦请求，精准将焦点重定向回当前激活的分组 Tab 按钮，确保焦点无漂移无下坠。
3. **空间导航下行进入**:
   当用户在分组 Tab 确认选组后，焦点稳定停驻在当前 Tab 上；当用户主动按下 `KEYCODE_DPAD_DOWN` 时，Android 原生空间寻焦机制直接导向下方对应的剧集按钮。

---

## 三、Gradle 验证

执行完整构建验证命令：
```bash
cd apps/tv-android && ./gradlew :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
```
**结果**:
- `assembleDebug`: BUILD SUCCESSFUL in 16s
- `lintDebug`: 0 errors, 0 warnings
- `testDebugUnitTest`: 单元测试全部通过

---

## 四、真实真机/模拟器自动化验证证据

使用真实 Android 设备（`emulator-5554`，API 22）自动化交互回放验证：
1. 播放超过 50 集短剧（《聚宝仙盆之杂灵根才是真BOSS第十三季》，共 222 集）。
2. 呼出选集抽屉，焦点从底部剧集按钮按 UP 导航至分组 Tab“1—50”。
3. 按 RIGHT 导航至分组 Tab“51—100”。
   - 证明：`focused="true"` 位于 `<node index="1" text="51—100" ... />`
   - 证据截图：`.agents/shared/t-r3-tab-before-click-20261014.png` (1,130,492 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r3-drawer-tab51-focused.xml`
4. 按遥控器确认键（`KEYCODE_DPAD_CENTER`，keyevent 23）点击“51—100”。
   - 证明：点击后焦点**仍稳固停留在 Tab“51—100”**（`focused="true"` 位于 `<node index="1" text="51—100" ... />`，未被抢夺至第 51 集按钮）。
   - 证据截图：`.agents/shared/t-r3-tab-clicked-20261014.png` (824,282 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r3-drawer-tab51-clicked.xml`
5. 用户按下遥控器 DOWN 键（`KEYCODE_DPAD_DOWN`，keyevent 20）。
   - 证明：焦点顺畅进入下方选集网格，落入空间对应剧集按钮（第 57 集按钮，`focused="true"`）。
   - 证据截图：`.agents/shared/t-r3-down-to-episodes-20261014.png` (960,866 字节，Magic: `89-50-4E-47-0D-0A-1A-0A`)
   - 布局 XML：`.agents/shared/t-r3-drawer-down-to-episodes.xml`
