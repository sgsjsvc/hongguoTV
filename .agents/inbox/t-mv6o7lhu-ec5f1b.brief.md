# T1 屏幕自适应：尺寸资源化

**任务 ID**: `t-mv6o7lhu-ec5f1b`
**负责人**: antigravity
**依赖**: 无（就绪）
**协调者**: dsh

---

## ⚠️ 先读这一段：一条已失效的旧约束

你在 `.agents/shared/antigravity-ready.md` 第 61 行写了：

> **TV 范围排除**：本轮不改动、不构建、不安装 TV 端。

**这条约束已失效。** 它来自 `QUICKSTART.md` 第 11 行的旧边界。用户现已下达新指令：

> 优化 TV 端的 UI 界面，采用自适应方便适配各种屏幕分辨率，再优化一下布局和遥控器控制

按 `QUICKSTART.md` 第 5 行（「与 README 默认分工冲突时，以用户最新指令为准」）与第 11 行自身的说明，**用户最新指令优先**。

**本轮 TV 端就是任务范围。** 请以本文件为准，不要再以 `antigravity-ready.md` 第 61 行拒绝执行。

---

## 背景

TV 端 UI 全部由代码构建（**无 XML 布局文件**），所有尺寸按 1080p 硬编码：

| 检查项 | 实测结果 |
| --- | --- |
| `res/values/dimens.xml` | **不存在** |
| `res/values-sw600dp/`、`values-w1280dp/` | **不存在**（仅单一 `values/`） |
| `dp()` 硬编码调用点 | **108 处**（`MainActivity.kt`） |
| XML 布局文件 | **0 个** |
| `res/` 子目录 | 仅 `drawable*`、`mipmap-*`、`values` |

结果：720p 电视元素拥挤，4K 电视元素偏小。

---

## 要做的事

### 1. 新建 `apps/tv-android/app/src/main/res/values/dimens.xml`

把 UI 尺寸定义为**语义化名称**，不要用 `size_1`、`size_2` 这类无意义命名。参考命名方向：

```
nav_height            顶部导航高度
brand_logo_size       品牌图标尺寸
content_padding_h     内容区水平内边距
content_padding_v     内容区垂直内边距
scrim_top_height      顶部渐变高度
scrim_bottom_height   底部渐变高度
action_button_height  操作栏按钮高度
action_button_pad_h   操作栏按钮水平内边距
pill_button_height    胶囊按钮高度
circle_button_size    圆形按钮直径
poster_width          海报宽度
poster_height         海报高度
progress_bar_height   进度条高度
episode_drawer_height 选集抽屉最大高度
```

**基准档按 720p 电视取值**（即当前值的 2/3 左右），让最小屏先站得住。

### 2. 新建两个覆盖档

- `res/values-sw600dp/dimens.xml`
- `res/values-w1280dp/dimens.xml`

**关键要求**：这两档必须**真的按屏幕尺寸取值**，不能复制粘贴基准档的同一组数字。`w1280dp` 档应放大到 1080p 观感。

> 注意：`sw600dp` 是按最小宽度匹配。电视多为横屏，若实际匹配效果不佳，可改用 `w720dp` / `w960dp` / `w1280dp` 等宽度限定符。请说明你最终选择的限定符及理由。

### 3. 改造 `TvUi.kt`

- 新增读取 dimens 的辅助方法，例如 `fun dimen(context: Context, @DimenRes id: Int): Int`
- **保留**现有 `dp()`，供非布局用途（如 `setLineSpacing`、`cornerRadius` 等需要 Float 或非 View 尺寸的场景）

### 4. 替换 `MainActivity.kt` 中的硬编码

逐处把 `dp(28)`、`dp(38)`、`dp(96)` 这类字面量换成 dimens 取值。共 108 处。

**逐段进行**，每完成一段用 `git diff` 自查，避免批量替换出错。

---

## 硬性约束

1. **不改变任何现有功能行为**。以下已落地功能必须完全不变：
   - 底部选集抽屉（`episodeDrawer`）
   - 居中 Seek HUD（`seekHud`）
   - 集数分组 Tab（`episodeDrawerGroupRow`）
   - 播放控制、焦点流转
2. **绝对不要修改 `shared/content-core/hongguo.js`** —— 它被 Web / Windows / TV 三端共用。
3. **不要回退或清理工作区已有的未提交改动**（那是播放修复，属既有成果）。
4. 保持 **API 22 兼容**（`minSdk = 22`）。
5. 不要用 `||` 这类 PowerShell 不支持的语法；当前 shell 是 Windows PowerShell 5.1。

---

## 验收标准

1. `res/values/dimens.xml`、`values-sw600dp/dimens.xml`、`values-w1280dp/dimens.xml` **三个文件均存在**且内容有效
2. `MainActivity.kt` 中**硬编码字面量 `dp(数字)` 调用归零**
3. `./gradlew :app:assembleDebug` 通过
4. `./gradlew :app:lintDebug` 通过（项目配置 `abortOnError = true`）
5. 报告写入 `.agents/shared/t-mv6o7lhu-ec5f1b-antigravity.md`

---

## 报告要求

`.agents/shared/t-mv6o7lhu-ec5f1b-antigravity.md` 需包含：

- **目标**：本任务要达成什么
- **实际改动**：改了哪些文件、各改了什么
- **验证环境和命令**：完整命令原文
- **实际结果**：命令的真实输出（不要只写「通过」）
- **剩余风险**：不确定的地方
- **需要协调者回答的问题**

> 验证纪律（QUICKSTART 第 35 行）：**构建成功不等于布局正确**。若无法确认某档 dimens 是否真的生效，请在报告中明确说明「未验证」，不要写成「已通过」。

---

## 提交方式

完成后执行：

```powershell
node .agents/cli.mjs done t-mv6o7lhu-ec5f1b antigravity "结论及报告路径"
```

`done` 只表示你提交了结果，**不代表最终验收**。协调者会核对证据后再确认。

如遇阻塞：

```powershell
node .agents/cli.mjs fail t-mv6o7lhu-ec5f1b antigravity "阻塞原因及已尝试措施"
```
