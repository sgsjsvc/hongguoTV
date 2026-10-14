# U4 补齐 CategoryTagLayout 尺寸资源化

**任务 ID**: `t-u4-tag-layout`
**负责人**: antigravity
**依赖**: `t-u2-progress-bar`（U2）**必须先完成** —— 避免与 U2 并行改 dimens 文件
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 背景：这是协调者的规划疏漏，不是你的问题

U1 修复了 `SeriesAdapter.kt` 的 3 处硬编码，但**我划定的 U1 范围遗漏了 `CategoryTagLayout.kt`**。该文件不在 U1 的授权改动列表内，所以你当时没有改它是正确的。

现在补上这一处。

---

## 问题

```kotlin
// apps/tv-android/app/src/main/java/com/hongguotv/tv/CategoryTagLayout.kt:9
private val gap = TvUi.dp(context, 8)
```

这个 `gap` 控制分类页题材标签的**水平与垂直间距**（`onMeasure` 与 `onLayout` 中各用一次）。硬编码 8dp 意味着它在不同分辨率下**不会缩放**。

### 影响面

分类页的题材标签换行布局（用户截图 3 中可见的「真人剧/漫剧/AI剧」与 24 个题材标签）。间距不随屏幕缩放会导致大屏下标签显得拥挤。

---

## 要做的事

1. 新增语义化 dimens 键，命名建议 `category_tag_gap`，**三档都要加**：
   - `values/dimens.xml`：基准档，约 5-6dp
   - `values-sw600dp/dimens.xml`：约 7dp
   - `values-w1280dp/dimens.xml`：8dp（恢复原值）
2. 把 `CategoryTagLayout.kt:9` 改为读取该 dimens 键
3. **注意**：`gap` 是 `private val` 在类初始化时求值，改用时确保 `context` 可用（构造函数参数已有）

---

## 硬性约束

1. **只改这两个文件**：
   - `CategoryTagLayout.kt`
   - `res/values*/dimens.xml`（三档）
2. **不要修改** `SeriesAdapter.kt`、`ui/` 下文件、`MainActivity.kt`、`TvUi.kt`
3. **绝对不要修改** `shared/content-core/hongguo.js`
4. **不要回退或清理**工作区已有的未提交改动
5. 保持 API 22 兼容
6. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`

---

## 验收标准

1. `CategoryTagLayout.kt` 中 `TvUi.dp(context, 数字)` **归零**
2. 新增 `category_tag_gap` 键在**三档都存在**且数值有梯度
3. **全项目双模式扫描归零**（除 `MainActivity.kt:156` 的 helper 定义）：
   ```powershell
   # 两种模式都必须为 0（helper 定义行除外）
   Select-String -Path <所有 kt 文件> -Pattern 'dp\(\d+\)'
   Select-String -Path <所有 kt 文件> -Pattern 'TvUi\.dp\([^)]*,\s*\d+\)'
   ```
4. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过
5. 报告写入 `.agents/shared/t-u4-tag-layout-antigravity.md`

---

## 报告要求

- 实际改动、验证命令原文、**真实输出**
- **必须提供分类页截图**，证明标签间距随分辨率生效
- 无法确认的标「未验证」

### ⚠️ 截图方式（重要）

**不要用 `adb exec-out ... > file.png`** —— PowerShell 重定向会破坏二进制，U1 的截图就因此损坏（UTF-16 编码，不可读）。

**正确方式**（两步法）：

```powershell
adb -s emulator-5554 shell screencap -p /sdcard/shot.png
adb -s emulator-5554 pull /sdcard/shot.png <目标路径>.png
adb -s emulator-5554 shell rm /sdcard/shot.png
```

---

## 提交方式

```powershell
node .agents/cli.mjs done t-u4-tag-layout antigravity "结论及报告路径"
```
