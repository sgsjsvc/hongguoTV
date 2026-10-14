# T3 单元测试、lint 与构建验证

**任务 ID**: `t-mv6o7lhy-53c065`
**负责人**: antigravity
**依赖**: `t-mv6o7lhx-95ac7b`（T2 布局重组）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 背景

T1 与 T2 改动了尺寸资源与布局结构。本任务补齐测试并跑完整验证链，产出可安装的 APK。

现有 JVM 单元测试 **19 项**（`apps/tv-android/app/src/test/`）。

---

## 要做的事

### 1. 补单元测试

为 T1/T2 引入的逻辑补 JVM 测试，要求**离线可跑**（不依赖网络、不依赖设备）：

- 尺寸资源读取逻辑（若有）
- 布局辅助函数
- 页面间共用的构建逻辑

放在 `apps/tv-android/app/src/test/java/com/hongguotv/tv/`。

### 2. 跑测试

```powershell
cd apps/tv-android
.\gradlew.bat :app:testDebugUnitTest
```

**现有 19 项不得减少**。新增测试后总数应 ≥ 19。

### 3. 跑 lint

```powershell
.\gradlew.bat :app:lintDebug
```

项目配置 `lint { abortOnError = true }`，任何 lint 错误都会导致失败。

### 4. 构建 APK

```powershell
.\gradlew.bat :app:assembleDebug
```

产出：`apps/tv-android/app/build/outputs/apk/debug/app-debug.apk`

---

## 硬性约束

1. **不得为通过测试而删减或跳过既有测试**。若某项测试确实无法通过，报告原因，不要注释掉。
2. **绝对不要修改 `shared/content-core/hongguo.js`**。
3. **不要回退或清理工作区已有的未提交改动**。
4. 保持 **API 22 兼容**。
5. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`。

---

## 验收标准

1. `./gradlew :app:testDebugUnitTest` 通过，**测试数 ≥ 19**
2. `./gradlew :app:lintDebug` 通过
3. `./gradlew :app:assembleDebug` 通过，APK 实际存在
4. 报告含**完整命令原文与真实输出摘要**（不要只写「通过」）
5. 报告写入 `.agents/shared/t-mv6o7lhy-53c065-antigravity.md`

---

## 报告要求

必须包含：

- 三条命令的**原始输出关键行**（测试数、lint 结果、APK 路径与大小）
- APK 的**构建时间与 SHA256**（协调者要用它对应验证版本）
- 新增测试的清单与各自验证什么
- 剩余风险

> **重要**：若某条命令失败，如实报告并标 `fail`，不要标记 `done`。

---

## 提交方式

```powershell
node .agents/cli.mjs done t-mv6o7lhy-53c065 antigravity "结论及报告路径"
```
