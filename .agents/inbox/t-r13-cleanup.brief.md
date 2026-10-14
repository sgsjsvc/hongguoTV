# R13 收尾清理：调试日志与测试纳管

**任务 ID**: `t-r13-cleanup`
**负责人**: codex
**依赖**: `t-r7-web-refactor`（R7）**必须先完成** —— 避免与 antigravity 并行改文件
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 一、任务目标

清理第五轮修复过程中遗留的两项技术债：

| # | 内容 | 来源 |
| --- | --- | --- |
| **1** | 清理 R2 遗留的 3 处调试日志 | 协调者中期检查发现 |
| **2** | 将 R1 的 10 项回归测试纳入正式测试目录 | R1 报告建议 |

---

## 二、任务 1：清理调试日志

### 位置

`apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`

R2 新增了 3 处 `android.util.Log.d("TvFocus", ...)`：

| 行 | 内容 | 影响 |
| --- | --- | --- |
| 627 | `hideChrome check: isNavFocused=...` | 每次定时器触发 |
| **1335** | `onKeyDown: keyCode=...` | **每次按键都打**，污染 logcat |
| 1379 | `collectionButton.requestFocus returned ...` | 每次请求焦点 |

### 要求

**删除这 3 处日志**。

> **注意**：删除前先确认它们**不是**被其他逻辑依赖（如日志中计算了后续要用的变量）。若某条日志同时承担了副作用（如调用 `findFocus()`），需保留副作用、仅删除日志输出。

### 验证

- `grep -n 'Log\.d("TvFocus"' MainActivity.kt` 应无输出
- `./gradlew :app:assembleDebug`、`:app:lintDebug` 通过

---

## 三、任务 2：R1 回归测试纳管

### 现状

R1 的回归测试位于 `.agents/shared/t-r1-playback-p0.test.mjs`（10 项），**`npm test` 不会自动运行**。

R1 报告已说明：

> 新增测试独立放在协作目录，以遵守业务修改仅四个指定文件的任务边界；`npm test` 当前只运行已有 tests 目录的 75 项，**不会自动包含这 10 项新增测试**。

### 要求

1. 把该测试**移入 `tests/`** 目录，命名符合现有约定（参考 `tests/*.test.mjs`）
2. 确保 `npm test` **自动包含**并全部通过
3. **不要削弱断言** —— 10 项必须全部保留且有意义

### 理由

R1 修复的是 **P0 级并发回归**（协调者引入的 D1-F1）。若回归测试不入正式测试集，将来极可能重新引入。

### 验证

```powershell
npm test   # 应从 75 项增至 85 项，且全绿
```

---

## 四、硬性约束

1. **只改这些文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`（仅删日志）
   - `tests/` 下新增测试文件
   - 删除 `.agents/shared/t-r1-playback-p0.test.mjs`（移动后）
2. **不要改动其他业务逻辑**
3. **不要回退**第五轮任何修复（R1–R12 的成果必须保留）
4. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. `MainActivity.kt` 中无 `Log.d("TvFocus"` 残留
2. `npm test` 从 **75 项增至 85 项**，全绿
3. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 通过
4. 报告写入 `.agents/shared/t-r13-cleanup-codex.md`

---

## 六、证据要求

- **删除前后** `grep` 对比
- `npm test` 的**完整输出**（显示测试数变化）
- 证据三件套

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r13-cleanup codex "结论及报告路径"
```
