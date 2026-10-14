# U3 独立复核第二轮修复

**任务 ID**: `t-u3-verify`
**负责人**: workbuddy
**依赖**: `t-u2-progress-bar`（U2）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 背景

你此前完成的 T4 复核**质量很高**，发现了协调者漏检的 P1（`SeriesAdapter.kt` 3 处 `TvUi.dp(context, N)` 字面量残留）—— 协调者的扫描模式 `dp(数字)` 匹配不到该形式。本轮复核沿用同样的严格标准。

---

## 复核对象

| 任务 | 内容 |
| --- | --- |
| `t-u1-fix-layout` | 修收藏页按钮拉伸 + SeriesAdapter 尺寸资源化 |
| `t-u2-progress-bar` | 修历史页卡片进度条可见性 |

---

## 要核查的四件事

### 1. 收藏页按钮是否真的修好

**不能只看代码，要看实际渲染结果。**

- 检查 `ui/CatalogScreenView.kt` 中 `addView(returnBtn)` 是否传了 LayoutParams
- **更强证据**：执行方应提供截图或 UI dump。若只有代码证据，指出这一点
- 用 UI dump 的 `bounds` 验证按钮宽度**不等于**屏幕宽度

### 2. 双模式扫描是否真归零

协调者此前的盲区是只扫 `dp(数字)`。本轮必须**两种模式都扫**：

```powershell
# 模式 1：dp(数字)
Select-String -Path <kt files> -Pattern 'dp\(\d+\)'

# 模式 2：TvUi.dp(context, 数字)
Select-String -Path <kt files> -Pattern 'TvUi\.dp\([^)]*,\s*\d+\)'
```

**两种都必须为 0**（`MainActivity.kt` 的 helper 定义行除外，那是合理的）。

### 3. 新增 dimens 键是否三档齐全且有梯度

- 检查 U1 新增的键（`series_card_title_pad_*` 等）在 `values` / `values-sw600dp` / `values-w1280dp` **三档都存在**
- 检查数值**不是三档相同**（相同等于没做自适应）

### 4. 进度条修复的根因是否真实

- 执行方报告是否**明确说明诊断出的根因**？还是直接改了数值？
- 若只说「调大了高度」，追问：如何证明是高度问题而非数据问题？
- 检查是否引入回归（无进度的卡片是否仍隐藏进度条）

---

## 硬性约束

1. **只读复核，不修改任何代码**
2. 不执行 `git checkout`、`git reset`、`git clean` 等破坏性命令
3. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`

---

## 验收标准

1. 报告明确列出：**已核实事实 / 无法核实项 / 发现的问题 / 改进建议**
2. 对「收藏页按钮是否修好」「双模式是否归零」给出**明确判断与依据**
3. 每条结论附**证据**（命令输出、文件行号、UI dump bounds）
4. 无证据的判断标为「推测」
5. 报告写入 `.agents/shared/t-u3-verify-workbuddy.md`

---

## 提交方式

```powershell
node .agents/cli.mjs done t-u3-verify workbuddy "结论及报告路径"
```
