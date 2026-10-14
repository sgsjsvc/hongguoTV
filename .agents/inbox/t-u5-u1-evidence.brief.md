# U5 补齐 U1 收藏页渲染证据闭环

**任务 ID**: `t-u5-u1-evidence`
**负责人**: antigravity
**依赖**: 无（就绪）
**协调者**: dsh

---

## 背景

U3 独立复核判定 **U1 的代码修复成立**（`addView(returnBtn, LayoutParams(-2, -2))`，WRAP_CONTENT 后不可能再拉伸），但**渲染证据链断裂**：

- 执行方提供的 `u1-empty-favorites.png` 被 **UTF-16 编码损坏**（PowerShell 重定向所致），图像不可读
- 协调者尝试补证时导航失败，误存了播放页内容为「收藏页」证据（已删除）
- 现存的宽度证据只有：代码 + 执行方报告内嵌的 dump 文本 `[36,130][168,202]`

**本任务只补证据，不修改任何代码。**

---

## 已有信息（协调者实测，可直接复用）

### 可靠的 chrome 唤出方法

```powershell
adb -s emulator-5554 shell am force-stop com.hongguotv.tv
adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
# 等推荐流加载完（约 20 秒）
Start-Sleep -Seconds 20
adb -s emulator-5554 shell input keyevent 20     # ← DOWN 唤出 chrome（不要用 MENU）
```

### 顶部导航坐标（实测，1280×720）

```
推荐 [207,9][339,54]      搜索 [345,9][477,54]
分类 [483,9][615,54]      榜单 [621,9][753,54]
追剧 [759,9][891,54]      历史 [897,9][1029,54]
设置 [1121,9][1253,54]
```

### ⚠️ 已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `input tap` **无效** | 触摸事件被播放器吞掉（仅切换播放/暂停），必须用 DPAD |
| chrome 会自动隐藏 | 隐藏后 RIGHT/LEFT 变成 seek 快进而非焦点移动 |
| 播放页 dump 不可读 | 元素在 SurfaceView 上，`uiautomator dump` 仅返回根节点 |

**建议策略**：先**暂停播放**（按 DOWN 唤出 chrome 后，焦点在操作栏，按确认可暂停），再导航到「追剧」。或尝试在 chrome 显示状态下用 DPAD 从操作栏 UP 到顶部导航。

---

## 要做的事

1. 导航到「我的收藏」**空态**页面（无收藏数据时显示「暂时没有内容」+「返回推荐」）
2. 采集**证据三件套**：
   - **截图**（两步法）
   - **UI dump**（落盘，非 `outputs/debug/`）
   - **命令原文**写入报告
3. 从 dump 中提取「返回推荐」按钮的 `bounds`，**计算宽度并证明其不等于屏幕宽度**

---

## 交付要求（证据三件套，自本任务起强制）

### 1. 截图 —— 必须用两步法

```powershell
# ✅ 正确
adb -s emulator-5554 shell screencap -p /sdcard/shot.png
adb -s emulator-5554 pull /sdcard/shot.png .agents/shared/<命名>.png
adb -s emulator-5554 shell rm /sdcard/shot.png

# ❌ 禁止（PowerShell 重定向会破坏二进制）
adb -s emulator-5554 exec-out screencap -p > file.png
```

**校验**：截图文件的 PNG 签名必须是 `89 50 4E 47 0D 0A 1A 0A`。请在报告中贴出签名验证结果。

### 2. dump 文件 —— 落盘到 `.agents/shared/`

不要放在 `outputs/debug/`（那是临时目录）。

### 3. 命名规范

`<任务ID>-<页面>-<状态>-<时间戳>.<ext>`

示例：
```
t-u5-u1-evidence-favorites-empty-001437.png
t-u5-u1-evidence-favorites-empty-001437.xml
```

---

## 硬性约束

1. **本任务不修改任何业务代码** —— 只采集证据
2. 不执行 `git checkout`、`git reset`、`git clean`
3. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`
4. 设备 API 级别**以 `adb shell getprop ro.build.version.sdk` 实测为准**，不要凭记忆写（U2 报告曾误写 API 33，实为 32）

---

## 验收标准

1. `.agents/shared/` 下有**有效 PNG**（签名正确）显示收藏页空态
2. 同目录下有对应 UI dump 文件
3. 报告从 dump 中提取「返回推荐」按钮 bounds，**计算宽度**并证明 ≠ 屏幕宽度
4. 报告含命令原文与设备 `getprop` 实测输出
5. 报告写入 `.agents/shared/t-u5-u1-evidence-antigravity.md`

---

## 若无法完成

若导航确实无法到达收藏页空态，**如实报告 `fail`**，说明已尝试的方法与观察到的现象。这本身是有价值的结论（证明 UI 导航存在可用性问题，将记为技术债 D3）。

**不要**用其他页面的截图冒充。

---

## 提交方式

```powershell
node .agents/cli.mjs done t-u5-u1-evidence antigravity "结论及报告路径"
# 或
node .agents/cli.mjs fail t-u5-u1-evidence antigravity "阻塞原因及已尝试措施"
```
