# A1 验证 HEVC level_idc 改写能否恢复硬解

**任务 ID**: `t-a1-hevc-level`
**负责人**: antigravity
**设备**: **MuMu 模拟器** `127.0.0.1:16384`
**依赖**: 无
**协调者**: dsh

---

## 一、背景（已实测确认）

### 现象

用户反馈「声音慢于画面」。实测发现上游视频把 **HEVC Level 标成了 6.2**（应为 4.0），导致所有硬解器拒绝，回退软解。

### 证据链

**dsh 直接从上 CDN 下载原始数据解析**：

```
样本 262144 字节：
  含 hvc1: true        ← 视频轨 = HEVC
  含 mp4a: true        ← 音频轨 = AAC
  HEVC profile_idc = 1 (Main)
  HEVC level_idc   = 186 → Level 6.2
```

**规格对照**：

| Level | 规格 |
| --- | --- |
| **4.0** | 1920×1080@30fps ← **1080P 正常值** |
| 6.2 | 8192×4320@120fps ← 实测值 |

**MuMu 日志**：

```
D/MediaCodecInfo: NoSupport [codec.profileLevel, hvc1.1.6.L186, video/hevc]
  [OMX.qcom.video.decoder.hevc]
  [c2.android.hevc.decoder]
  [c2.qti.hevc.decoder]
W/MediaCodecRenderer: Format exceeds selected codec's capabilities
D/SoftwareRenderer: setting dataspace on output surface    ← 回退软解
```

**所有画质档位都是 Level 6.2**（含 360P）→ 用户无法降画质规避。

---

## 二、任务目标

**验证方案 A**：改写 `hvcC` box 的 `level_idc`，看硬解器是否接受。

**这是可行性验证，不是最终修复。** 目标是明确回答：

1. 改 `level_idc` 后，`NoSupport` 是否消失？
2. 是否不再回退 `SoftwareRenderer`？
3. 视频是否正常播放（非静止/卡顿）？
4. MP4 结构是否仍有效（能正常解码）？

---

## 三、技术要点

### 3.1 定位 `hvcC` box

`hvcC` 位于 moov → trak → mdia → minf → stbl → stsd → hvc1 → hvcC

**dsh 实测的偏移**（该样本）：

```
hvc1 box @ offset 457
hvcC box @ offset 543
```

**`level_idc` 的位置**（相对 `hvcC` box 起点）：

```
hvcC 结构：
  size(4) + type(4) = "hvcC"
  version(1)                    ← offset 8
  profile_space/tier/profile_idc(1)  ← offset 9
  profile_compatibility_flags(4)     ← offset 10-13
  constraint_indicator_flags(6)      ← offset 14-19
  level_idc(1)                       ← offset 20   ★ 要改的就是这个字节
```

**实测验证**：`b[hvcC_offset + 4 + 12] = 186`（dsh 用此公式成功读出 Level 6.2）。

> 注意：dsh 的公式是 `hvcC_offset + 4 + 12`，其中 `+4` 跳过 size 字段，
> 从 type 字段开始算 `version(1) + byte1(1) + compat(4) + constraint(6) = 12`。
> 请自行核实偏移，不要盲信。

### 3.2 改写方式

**关键约束**：**只改这 1 个字节**，不改任何 box 尺寸 → **MP4 结构不变**。

```javascript
// 伪代码
const idx = buffer.indexOf('hvcC');           // 需在 moov 范围内查找
const levelPos = idx + 4 + 12;                 // 核实偏移
buffer[levelPos] = 120;                        // Level 4.0 = 120
```

**Level 值对照**：

| 分辨率 | 建议 Level | level_idc |
| --- | --- | --- |
| 720P | 3.1 | 93 |
| 1080P | 4.0 | **120** |
| 4K | 5.1 | 153 |

### 3.3 实施位置（任选，说明选择理由）

| 位置 | 说明 |
| --- | --- |
| `custom-server/index.mjs` 流代理层 | 在 `prepareHeader` 后、发送前改写 |
| `shared/content-core/hongguo.js` | 引擎层统一处理（**影响三端**） |

**建议先在 `custom-server` 验证**（影响面小），验证成功后再考虑下沉到引擎。

---

## 四、硬性约束

1. **仅用于验证** —— 明确标注为实验性改动，不要声称已修复
2. **三份引擎副本若改动必须同步**（`shared/` + 两份 `vendor/`）
3. **不要改** `MainActivity.kt`（播放器逻辑不在本次范围）
4. **不要提交 git**（由协调者统一处理）
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、⚠️ 环境准备（必读）

### adb 端口限制

**本机 DSH 沙箱拒绝绑定 6300 以下的 loopback 端口**，adb 默认 5037 会失败：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server      # 应显示 daemon started successfully
```

### 连接 MuMu

```powershell
& $adb connect 127.0.0.1:16384
& $adb -s 127.0.0.1:16384 shell wm size 1280x720   # 调为横屏
```

### 获取测试样本

```powershell
# 启动后端
node custom-server/index.mjs

# 取 256KB 样本
curl.exe -s -H "Range: bytes=0-262143" `
  "http://127.0.0.1:8788/api/episodes/7503780574541122622/stream?quality=720P&seriesId=7503745441910017049" `
  --max-time 60 -o "$env:TEMP\sample.bin"
```

### 解析 Level（dsh 已验证的脚本）

```javascript
const fs = require('fs');
const b = fs.readFileSync(process.env.TEMP + '/sample.bin');
const j = b.toString('latin1').indexOf('hvcC');
const lv = b[j + 4 + 12];
console.log('level_idc=' + lv + ' → Level ' + (lv / 30).toFixed(1));
```

---

## 六、验收标准

1. **修复前基线**：logcat 中有 `NoSupport [hvc1.1.6.L186]` + `SoftwareRenderer`
2. **改写后解析**：用上述脚本确认 `level_idc` 已变为目标值
3. **改写后 logcat**：
   - **无** `NoSupport [hvc1.1.6.L186]`
   - **无** `SoftwareRenderer`
   - 出现硬解器创建日志（如 `OMX.qcom.video.decoder.hevc` + 成功状态）
4. **播放验证**：截图显示**视频正常播放**（非静止画面/非黑屏）
5. **结构完整性**：MP4 仍能解码（不因 box 损坏而失败）
6. **音画同步**：如能测量则给出偏移；不能则**如实说明**
7. 报告写入 `.agents/shared/t-a1-hevc-level-antigravity.md`

---

## 七、证据要求（三件套）

```powershell
$d = "127.0.0.1:16384"

# 清日志 → 启动 → 观察
& $adb -s $d logcat -c
& $adb -s $d shell am force-stop com.hongguotv.tv
& $adb -s $d shell am start -n com.hongguotv.tv/.MainActivity
Start-Sleep -Seconds 30
& $adb -s $d logcat -d > .agents/shared/t-a1-logcat.txt

# 截图两步法
& $adb -s $d shell screencap -p /sdcard/s.png
& $adb -s $d pull /sdcard/s.png .agents/shared/t-a1-play.png
& $adb -s $d shell rm /sdcard/s.png
```

**校验 PNG 签名**必须为 `89-50-4E-47-0D-0A-1A-0A`。

**必须提供**：

1. 改写前的 `hvcC` 解析输出
2. 改写后的 `hvcC` 解析输出
3. 改写前的 logcat 关键行
4. 改写后的 logcat 关键行
5. 播放截图

---

## 八、如果验证失败

**如实报告**，不要强行声称成功。可能的失败原因：

- 硬解器按实际码流判断，改声明无效
- Level 改小后解码器仍拒绝
- MP4 结构被破坏

**失败也是有价值的结论** —— 它能排除方案 A，让我们转向方案 B（强制硬解）或 C（用户提示）。

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| MuMu 端口 | **16384**（非 5554） |
| 分辨率 | MuMu 默认竖屏，需 `wm size 1280x720` |
| `input tap` 无效 | 播放页会吞掉触摸，用 DPAD |
| dump 大小可判断页面 | 4430=播放页，15700=chrome，20800=分类页 |
| codex 已改引擎 | 榜单解析逻辑有未提交改动，**不要回退** |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-a1-hevc-level antigravity "结论及报告路径"
# 或
node .agents/cli.mjs fail t-a1-hevc-level antigravity "失败原因与已尝试措施"
```
