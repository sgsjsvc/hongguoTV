# R2 TV UI 焦点与导航修复

**任务 ID**: `t-r2-tv-focus`
**负责人**: antigravity
**依赖**: 无（但 R3/R4 依赖本任务定稿）
**协调者**: dsh

---

## 一、修复目标

修复第四轮 D2 发现的 4 项 TV UI 缺陷，**全部集中在 `MainActivity.kt`**：

| 发现 | 严重度 | 标题 |
| --- | --- | --- |
| **D2-F1** | **high** | BACK 键拦截致软键盘激活时退出整页 |
| **D2-F2** | medium | 5 秒定时器强制隐藏 chrome 并夺焦 |
| **D2-F3** | medium | 分类筛选重载销毁视图树造成白屏闪烁 |
| **D2-F6** | low | 硬编码上下寻焦映射打破空间一致性 |

**详见**：`.agents/shared/t-d2-tv-ui-discovery-antigravity.md`

---

## 二、逐项修复

### D2-F1（high）BACK 键拦截

**位置**：`MainActivity.kt:1428-1433`

**问题**：`dispatchKeyEvent` 无条件拦截 BACK 的 `ACTION_UP` 并执行 `back()`，**不判断软键盘是否显示**。

**证据**：`t-d2-search-focused-*.png` → `t-d2-search-back-exit-*.png`

**建议**：判断 `InputMethodManager` 是否正在显示；或让根 View / EditText 优先消费系统返回键隐藏软键盘；或用 `onBackPressedDispatcher` 正常回调。

---

### D2-F2（medium）5 秒定时器夺焦

**位置**：`MainActivity.kt:587-601`

**问题**：`hideChrome` 定时器**不判断当前子控件获焦状态**，5 秒后强行 `hideChromeNow()` 并 `focusPlayback()` 夺焦。

**证据**：`t-d2-nav-focused-*.png` → `t-d2-nav-timeout-*.png`

**建议**：定时任务中判断 `currentFocus` 是否属于 `topHeader` / `feedOverlay`；若有控件获焦则不隐藏。

> **协调者备注**：此项曾导致协调者在 U6 验收时误判为「操作失误」。修复后请复测该场景。

---

### D2-F3（medium）白屏闪烁

**位置**：`MainActivity.kt:943`

**问题**：分类筛选重载时无保护地销毁整个视图树。

**证据**：`t-d2-category-flashing-*.png` / `t-d2-category-ready-*.png`

**建议**：改为增量更新或保留容器，避免全树销毁重建。

---

### D2-F6（low）硬编码寻焦映射

**位置**：`MainActivity.kt:339-342`

**问题**：顶部导航与操作栏的上下寻焦用硬编码 ID 映射，打破空间一致性。

**注意**：D2 报告标注 `verified: false`（静态推断）—— **修复前请先实测确认**，若无法复现则报告说明。

---

## 三、硬性约束

1. **只改 `MainActivity.kt`**
2. 不要改 `ui/` 下文件（R3 负责）、`AndroidManifest.xml`（R4 负责）
3. **不要回退**工作区其他改动
4. 保持 API 22 兼容
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

1. **D2-F1**：搜索页输入时按 BACK → 软键盘收起，**页面不退出**（截图证明）
2. **D2-F2**：chrome 获焦后静止 5.5 秒 → **不被隐藏**（截图证明）
3. **D2-F3**：分类筛选切换 → 无白屏闪烁（截图或录屏）
4. **D2-F6**：实测确认或说明无法复现
5. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过
6. 报告写入 `.agents/shared/t-r2-tv-focus-antigravity.md`

---

## 五、证据要求

**证据三件套**（截图两步法 + dump 落盘 + 命令原文）：

```powershell
# 冷启动 + 唤出 chrome（协调者实测有效）
adb -s emulator-5554 shell am force-stop com.hongguotv.tv
adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
Start-Sleep -Seconds 20
adb -s emulator-5554 shell input keyevent 20

# 截图两步法（禁止 shell 重定向）
adb -s emulator-5554 shell screencap -p /sdcard/s.png
adb -s emulator-5554 pull /sdcard/s.png .agents/shared/<命名>.png
```

**每项修复都要有「修复前 / 修复后」对比**。

---

## 六、提交方式

```powershell
node .agents/cli.mjs done t-r2-tv-focus antigravity "结论及报告路径"
```
