# R4 AndroidManifest 屏幕配置修复

**任务 ID**: `t-r4-manifest`
**负责人**: antigravity
**依赖**: `t-r3-drawer-focus`（R3）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 一、修复目标

修复 **D2-F5**（medium）：AndroidManifest 缺少屏幕自适应配置，导致分辨率/DPI 变动时 Activity 异常重建丢失页面状态。

**详见**：`.agents/shared/t-d2-tv-ui-discovery-antigravity.md`

---

## 二、问题

**位置**：`apps/tv-android/app/src/main/AndroidManifest.xml:9-10`

**现状**（已核实）：

```xml
<activity android:name=".MainActivity" android:exported="true"
  android:screenOrientation="landscape"
  android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize">
```

**问题**：`configChanges` 缺少影响布局的配置项，分辨率/密度变化时 Activity 会被重建，丢失页面状态（当前页、焦点、播放位置等）。

---

## 三、修复方向

在 `configChanges` 中补充（按实际需要）：

```
screenLayout|smallestScreenSize|uiMode|density
```

**注意**：不要盲目全加，需评估每项对现有状态管理的影响。TV 端常见组合：

```xml
android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenSize|screenLayout|smallestScreenSize|uiMode"
```

---

## 四、硬性约束

1. **只改 `AndroidManifest.xml`**
2. 不要改 Kotlin 源码（R2/R3 已定稿）
3. **不要回退**工作区其他改动
4. 保持 API 22 兼容（`minSdk = 22`）
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. 分辨率切换（`adb shell wm size`）后 **Activity 不重建**，页面状态保留
   - 验证方式：切分辨率前后对比 dump，确认当前页/焦点未丢失
2. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过
3. 报告写入 `.agents/shared/t-r4-manifest-antigravity.md`

---

## 六、证据要求

**修复前后对比**：用 `wm size` 切换分辨率，对比 dump 中的页面状态。

```powershell
adb -s emulator-5554 shell wm size 1920x1080
# 截图 + dump
adb -s emulator-5554 shell wm size 1280x720
# 截图 + dump，对比状态是否保留
```

证据三件套（截图两步法 + dump 落盘 + 命令原文）。

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r4-manifest antigravity "结论及报告路径"
```
