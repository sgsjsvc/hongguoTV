# R3 选集抽屉 Tab 抢焦修复

**任务 ID**: `t-r3-drawer-focus`
**负责人**: antigravity
**依赖**: `t-r2-tv-focus`（R2）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

R2 改 `MainActivity.kt`（含焦点逻辑），本任务改 `ui/EpisodeDrawerView.kt`。**必须等 R2 定稿**，避免焦点行为冲突。

---

## 一、修复目标

修复 **D2-F4**（medium）：选集抽屉分组 Tab 点击确认后焦点被硬编码强行抢占至下方选集按钮。

**详见**：`.agents/shared/t-d2-tv-ui-discovery-antigravity.md`

---

## 二、问题

**位置**：`ui/EpisodeDrawerView.kt:118-123`

**问题**：分组 Tab 点击后，焦点被硬编码强行转移到下方选集按钮，而非停留在 Tab 上或按空间逻辑移动。

**影响**：用户切换分组后想继续切下一个分组，却被迫先跳出选集网格。

---

## 三、修复方向

- 移除硬编码焦点抢占，让 Tab 点击后**焦点留在 Tab**（符合其他页面的 Tab 行为）
- 或按空间逻辑让用户用 DOWN 主动进入选集网格
- **参照**：`ui/DetailScreenView.kt` 的分组 Tab 行为（保持一致）

---

## 四、硬性约束

1. **只改 `ui/EpisodeDrawerView.kt`**
2. 不要改 `MainActivity.kt`（R2 已定稿）
3. **不要回退**工作区其他改动
4. 保持 API 22 兼容
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. 抽屉分组 Tab 点击确认后，**焦点停留在 Tab 上**（dump 的 `focused="true"` 证明）
2. 用 DOWN 可主动进入选集网格
3. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过
4. 报告写入 `.agents/shared/t-r3-drawer-focus-antigravity.md`

---

## 六、证据要求

**修复前后对比**：dump 中 Tab 与选集按钮的 `focused` 属性变化。

证据三件套（截图两步法 + dump 落盘 + 命令原文）。

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r3-drawer-focus antigravity "结论及报告路径"
```
