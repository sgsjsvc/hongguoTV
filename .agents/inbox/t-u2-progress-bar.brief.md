# U2 修复历史页卡片进度条可见性

**任务 ID**: `t-u2-progress-bar`
**负责人**: antigravity
**依赖**: `t-u1-fix-layout`（U1）**必须先完成** —— 两者都改 `SeriesAdapter.kt`
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

U1 会改 `SeriesAdapter.kt`，本任务也会改同一个文件，**必须串行**。

---

## 问题：历史页卡片进度条不可见

### 现象

「观看历史」页面中，正在观看的剧集卡片底部应有进度条，但截图中**未见明显着色**。部分卡片显示了「第 3 集 · 00:50」文字，说明进度数据存在，但进度条本身不显眼或不可见。

### 已核实的信息

- `MainActivity.kt:1015` 有 `onProgressProvider` 回调，**逻辑存在**
- `SeriesAdapter.kt:84-85` 创建了 `ProgressBar`，高度取自 `R.dimen.series_card_progress_height`
- `SeriesAdapter.kt:95-96` 设置可见性与进度值

### 待你排查的方向

1. **高度过小** —— `series_card_progress_height` 在基准档可能只有 1-2dp，视觉上不可见
2. **配色对比不足** —— ProgressBar 的 tint 可能与卡片背景色接近
3. **可见性逻辑** —— 确认 `progress(series)` 返回值是否真的非 null

---

## 要做的事

1. **先诊断**：确认是「高度不足」「配色问题」还是「数据未到达」。用日志或临时 dump 找出真实原因，**不要凭猜修改**。
2. **再修复**：按诊断结果调整。若为高度问题，提高 `series_card_progress_height` 的三档值；若为配色，设置明确的 `progressTintList` / `progressBackgroundTintList`。
3. **保持不变量**：进度百分比计算逻辑不变，无进度的卡片仍隐藏进度条。

---

## 硬性约束

1. **只改这些文件**：
   - `SeriesAdapter.kt`
   - `res/values*/dimens.xml`（三档，若需调整尺寸）
   - `MainActivity.kt`（**仅当**诊断证明问题在 provider 侧时才改，并在报告中说明理由）
2. **不要修改** `ui/` 下的文件（U1 已定稿）
3. **绝对不要修改** `shared/content-core/hongguo.js`
4. **不要回退或清理**工作区已有的未提交改动
5. 保持 API 22 兼容
6. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`

---

## 验收标准

1. 报告中**明确说明诊断出的根因**（附证据：日志、dimen 值、或代码行号）
2. 历史页中正在观看的剧集卡片**进度条清晰可见**
3. 无进度的卡片仍不显示进度条（不引入回归）
4. `./gradlew :app:assembleDebug`、`:app:lintDebug`、`:app:testDebugUnitTest` 均通过
5. 报告写入 `.agents/shared/t-u2-progress-bar-antigravity.md`

---

## 报告要求

- **诊断过程与结论**（这是本任务的核心，不要跳过）
- 实际改动、验证命令原文、**真实输出**
- **必须提供历史页截图**，证明进度条可见
- 截图需对应到明确的 APK 构建时间
- 无法确认的标「未验证」

---

## 提交方式

```powershell
node .agents/cli.mjs done t-u2-progress-bar antigravity "结论及报告路径"
```
