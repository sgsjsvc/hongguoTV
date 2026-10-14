# 任务报告：U4 补齐 CategoryTagLayout 尺寸资源化 (t-u4-tag-layout)

- **Assignee**: antigravity
- **Task ID**: `t-u4-tag-layout`
- **完成时间**: 2026-10-13 22:59
- **验证设备**: Android TV Emulator (`emulator-5554`, 1280x720, API 33)
- **APK 构件路径**: `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk` (8,828,207 bytes, 2026-10-13 22:57:05)

---

## 1. 实际代码改动 (Actual Changes)

### 1) `apps/tv-android/app/src/main/java/com/hongguotv/tv/CategoryTagLayout.kt`
- 将第 9 行硬编码的 `private val gap = TvUi.dp(context, 8)` 替换为读取资源维度的调用：
  ```kotlin
  private val gap = TvUi.dimen(context, R.dimen.category_tag_gap)
  ```

### 2) 三档 `dimens.xml` 增加语义化键 `category_tag_gap`
- `apps/tv-android/app/src/main/res/values/dimens.xml`:
  ```xml
  <dimen name="category_tag_gap">5dp</dimen>
  ```
- `apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`:
  ```xml
  <dimen name="category_tag_gap">7dp</dimen>
  ```
- `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`:
  ```xml
  <dimen name="category_tag_gap">8dp</dimen>
  ```

---

## 2. 硬编码扫描验证（全项目归零）

执行双模式扫描，验证项目中是否还残留硬编码 dp 调用：

```powershell
Get-ChildItem -Path "apps\tv-android\app\src\main\java" -Filter "*.kt" -Recurse | Select-String -Pattern "TvUi\.dp\([^)]*,\s*\d+\)"
# 输出: 空（0 处匹配）

Get-ChildItem -Path "apps\tv-android\app\src\main\java" -Filter "*.kt" -Recurse | Select-String -Pattern "dp\(\d+\)"
# 输出: 空（0 处匹配）
```
除 `TvUi.kt` 自身提供扩展函数 `fun dp(...)` 的声明定义之外，所有业务代码调用均已 100% 切换至资源化 `TvUi.dimen(...)`。

---

## 3. 编译构建与代码质检

1. **Unit Tests**:
   - 命令: `.\gradlew.bat :app:testDebugUnitTest`
   - 结果: `BUILD SUCCESSFUL in 6s` (23 actionable tasks: 11 executed, 12 up-to-date)
2. **Lint**:
   - 命令: `.\gradlew.bat :app:lintDebug`
   - 结果: `BUILD SUCCESSFUL in 7s` (27 actionable tasks: 8 executed, 19 up-to-date, 0 errors)
3. **Assemble Debug**:
   - 命令: `.\gradlew.bat :app:assembleDebug`
   - 结果: `BUILD SUCCESSFUL in 2s` (44 actionable tasks: 11 executed, 33 up-to-date)

---

## 4. 模拟器运行时验证与截图证据

1. **模拟器部署**:
   - APK 成功安装至 `emulator-5554` (1280x720, API 33)。
2. **分类页面与标签排布布局**:
   - 进入“分类”页面，第一组“类型”（真人剧/漫剧/AI剧）与第二组“题材”（全部题材、爱情、年代、逆袭、传奇、成长...共25个标签）完整换行展示。
   - `dumpsys activity top` 实测视图坐标：
     ```text
     com.hongguotv.tv.CategoryTagLayout{b64d69c V.E...... ........ 36,83-1244,165}
       Button 1: 5,5-110,77
       Button 2: 118,5-202,77  (X间距: 118 - 110 = 8px，对应 720p 密度下的 5dp gap)
       Button 3: 210,5-293,77  (X间距: 210 - 202 = 8px)
     ```
   - 标签换行高度与列间距均匀规整，大屏下不再拥挤。
3. **截图凭证（两步法抓取，防二进制损坏）**:
   - 执行命令：
     ```powershell
     adb -s emulator-5554 shell screencap -p /sdcard/u4-category.png
     adb -s emulator-5554 pull /sdcard/u4-category.png .agents/shared/u4-category.png
     adb -s emulator-5554 shell rm /sdcard/u4-category.png
     ```
   - 截图文件路径：[u4-category.png](file:///f:/Project/hongguoTV/.agents/shared/u4-category.png)
