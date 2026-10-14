# T2 布局结构重组与页面风格统一

**任务 ID**: `t-mv6o7lhx-95ac7b`
**负责人**: antigravity
**依赖**: `t-mv6o7lhu-ec5f1b`（T1 尺寸资源化）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 本任务改的 `MainActivity.kt` 与 T1 是同一个文件，必须等 T1 完成并验收后再动。

先执行 `node .agents/cli.mjs ready` 确认本任务已出现在就绪列表。

---

## 背景

`MainActivity.kt` 现有 **1835 行**，UI 构建代码与业务逻辑（播放控制、同步、资料库）混杂在一起。用户已确认要重组。

同时，各页面布局风格不统一：

| 页面 | 现状问题 |
| --- | --- |
| 首页 Feed | 自有内边距与标题层级 |
| 目录 Catalog | 与首页不一致 |
| 详情 Detail | 又一套边距与按钮尺寸 |
| 设置 Settings | 独立风格 |
| 搜索 Search | 独立风格 |

---

## 要做的事

### 1. 拆分 UI 构建代码

把 UI 构建代码从 `MainActivity.kt` 迁到 `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/` 下的独立文件。建议按屏幕划分（你可调整）：

```
ui/HomeScreen.kt        首页 Feed
ui/CatalogScreen.kt     目录/榜单
ui/DetailScreen.kt      详情页
ui/SettingsScreen.kt    设置页
ui/SearchScreen.kt      搜索页
ui/PlayerOverlay.kt     播放叠加层（抽屉、Seek HUD、暂停指示）
```

要求：每个文件职责单一、可独立阅读。

### 2. 统一各页面风格

统一以下四项，全部取自 T1 建立的 dimens：

- 外边距（`content_padding_h` / `content_padding_v`）
- 标题层级（字号与字重）
- 按钮尺寸（`action_button_height` / `pill_button_height`）
- 焦点样式（统一走 `TvUi.focusBackground` / `pillBackground`）

### 3. 抽出重复代码

把重复的布局构建片段抽成共用函数。

---

## 硬性约束

1. **纯结构重组，不改变任何可见行为**。以下必须与 T1 完成后完全一致：
   - 底部选集抽屉（`episodeDrawer`）的开合逻辑与内容
   - 居中 Seek HUD（`seekHud`）的显示与数值
   - 集数分组 Tab（`episodeDrawerGroupRow`）的切换
   - 播放控制、焦点流转顺序
2. **绝对不要修改 `shared/content-core/hongguo.js`**。
3. **不要回退或清理工作区已有的未提交改动**。
4. 保持 **API 22 兼容**（`minSdk = 22`）。
5. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&` 等语法。

---

## 验收标准

1. `MainActivity.kt` 行数显著下降，UI 构建代码已迁至 `ui/` 下多个文件
2. 各页面外边距、标题层级、按钮尺寸、焦点样式统一
3. `./gradlew :app:assembleDebug` 与 `./gradlew :app:lintDebug` 均通过
4. **现有功能无回归**：抽屉、Seek HUD、分组 Tab、播放控制行为与 T1 前一致
5. 报告写入 `.agents/shared/t-mv6o7lhx-95ac7b-antigravity.md`

---

## 报告要求

同 T1：目标、实际改动、验证环境与命令、**真实输出**、剩余风险、待协调者回答的问题。

**重点说明回归验证方式**：你如何确认抽屉 / Seek HUD / 分组 Tab 行为未变？若只是「代码看起来一样」，请明确标注为「未实测」。

---

## 提交方式

```powershell
node .agents/cli.mjs done t-mv6o7lhx-95ac7b antigravity "结论及报告路径"
```
