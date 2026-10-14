# D2 TV 端 UI Bug 发现

**任务 ID**: `t-d2-tv-ui-discovery`
**负责人**: antigravity
**依赖**: 无（可并行）
**协调者**: dsh
**性质**: **只读发现，禁止修改任何业务代码**

---

## 一、任务目标

在 **TV 端**发现 UI bug。**必须用 ADB 实测，不能只读代码。**

---

## 二、审查范围

`apps/tv-android/app/src/main/java/com/hongguotv/tv/`（24 文件，3534 行）

重点文件：

| 文件 | 行数 | 说明 |
| --- | --- | --- |
| `MainActivity.kt` | 1338 | 主界面、遥控器、状态机 |
| `ui/PlayerOverlay.kt` | 259 | 播放控制栏 |
| `ui/EpisodeDrawerView.kt` | 156 | 选集抽屉 |
| `ui/DetailScreenView.kt` | 168 | 详情页 |
| `ui/CatalogScreenView.kt` | ~130 | 目录/榜单 |
| `ui/AppHeaderView.kt` | 121 | 顶部导航 |
| `ui/CenterHudBuilder.kt` | 107 | Seek HUD |
| `ui/SettingsScreenView.kt` | 94 | 设置页 |
| `ui/SearchScreenView.kt` | 70 | 搜索页 |
| `SeriesAdapter.kt` | 128 | 卡片列表 |
| `CategoryTagLayout.kt` | 40 | 流式标签布局 |

---

## 三、已知问题（协调者实测，可作起点但需独立验证）

### K1（中）播放页遥控器焦点易丢失

协调者复现：

| 操作 | 结果 |
| --- | --- |
| MENU 唤出 chrome | ✅ 操作栏「合集」获焦 |
| 按 RIGHT ×2 | ❌ chrome 已隐藏，RIGHT 被解释为 **seek 快进**（`▶▶ +20s`） |
| 连续 `DOWN`+`RIGHT`×4 | ❌ 焦点丢失，无高亮框 |
| `input tap` 点导航 | ❌ 被播放器吞掉 |

**待你验证并补充**：这是设计如此，还是缺陷？其他页面是否同样问题？

### K2（低）历史页卡片日期文字曾被裁切

已在 U2 修复（卡片加高），**请验证是否真正解决**，或是否引入新问题。

---

## 四、强制方法要求

> 本项目已验证教训：**只看代码会漏**。T1 验收时协调者用单模式扫描漏掉了残留。

**你必须用 ADB 实际运行 App 观察，不能只读代码。**

### 可用手段

1. **冷启动 + 唤出 chrome**（协调者实测有效的唯一方式）：
   ```powershell
   adb -s emulator-5554 shell am force-stop com.hongguotv.tv
   adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
   Start-Sleep -Seconds 20
   adb -s emulator-5554 shell input keyevent 20   # ← DOWN 唤出 chrome（不要用 MENU）
   ```

2. **UI dump 取坐标**：
   ```powershell
   adb -s emulator-5554 shell uiautomator dump /sdcard/u.xml
   adb -s emulator-5554 pull /sdcard/u.xml .agents/shared/<命名>.xml
   ```

3. **多分辨率实测**（模拟器支持改分辨率）：
   ```powershell
   adb -s emulator-5554 shell wm size 1280x720    # 基准档
   adb -s emulator-5554 shell wm size 1920x1080   # sw600dp 档
   adb -s emulator-5554 shell wm size 3840x2160   # w1280dp 档
   ```

4. **截图（两步法，禁止 shell 重定向）**：
   ```powershell
   adb -s emulator-5554 shell screencap -p /sdcard/s.png
   adb -s emulator-5554 pull /sdcard/s.png .agents/shared/<命名>.png
   adb -s emulator-5554 shell rm /sdcard/s.png
   ```
   **校验 PNG 签名**必须为 `89 50 4E 47 0D 0A 0D 0A`（实际为 `89-50-4E-47-0D-0A-1A-0A`）

### 已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `input tap` **无效** | 触摸被播放器吞掉，须用 DPAD |
| 播放页 dump 不可读 | 元素在 SurfaceView 上，仅返回根节点 |
| chrome 会自动隐藏 | 隐藏后 DPAD 语义切换 |

---

## 五、重点排查方向

1. **遥控器**：所有按键在各页面是否都有合理行为？有无吞键/丢焦点？
2. **焦点流转**：跨区域（导航 ↔ 操作栏 ↔ 抽屉 ↔ 网格）是否连贯？
3. **多分辨率**：三档下是否有重叠、截断、溢出？
4. **空态/错误态**：无数据、加载失败、网络异常时的表现
5. **返回键**：各页面的 BACK 行为是否一致合理？
6. **状态恢复**：旋转/后台/进程重建后状态是否正确？
7. **长文本**：超长剧名的截断与换行

---

## 六、交付格式

写入 `.agents/shared/t-d2-tv-ui-discovery-antigravity.md`。

每条发现：

```json
{
  "id": "D2-F1",
  "severity": "high | medium | low",
  "category": "ui-bug",
  "title": "一句话",
  "location": "文件:行号",
  "evidence": "复现步骤 + 截图/dump 文件名",
  "verified": true,
  "impact": "...",
  "suggestion": "...",
  "effort": "small | medium | large"
}
```

**必须包含**：

1. **发现汇总表**（按 severity 排序）
2. 每条发现的**复现步骤**与证据文件
3. **已排查未发现问题的页面/场景**
4. **无法覆盖的区域**

---

## 七、硬性约束

1. **禁止修改任何业务代码**
2. 不执行 `git checkout` / `git reset` / `git clean`
3. 证据文件命名：`<任务ID>-<页面>-<状态>-<时间戳>.<ext>`
4. 截图必须两步法，**校验 PNG 签名并写入报告**
5. **区分「已核实」与「推测」**
6. 设备 API 以 `adb shell getprop ro.build.version.sdk` 实测为准
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 八、验收标准

1. 报告含**发现汇总表**，每条有精确 `文件:行号`
2. **至少 3 条 `verified: true`**（有截图或 dump 证据）
3. 证据文件落盘 `.agents/shared/`，PNG 签名校验通过
4. 明确列出「已排查未发现问题」与「无法覆盖」的区域
5. 报告写入 `.agents/shared/t-d2-tv-ui-discovery-antigravity.md`

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-d2-tv-ui-discovery antigravity "结论及报告路径"
```
