# A3 实机对照验证报告（协调者 dsh）

**执行方**: dsh
**设备**: **实机电视** `192.168.1.120:5555`
**日期**: 2026-10-15
**性质**: 只读诊断，未修改代码

---

## 一、实机环境（已核实）

| 项 | 值 |
| --- | --- |
| 地址 | `192.168.1.120:5555` |
| 系统 | **Android 5.1.1（API 22）** |
| CPU | armeabi-v7a |
| 类型 | tv |
| 分辨率 | 1280×720 @160dpi |
| 已装 | `com.hongguotv.tv` |

**连接方式**：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
adb connect 192.168.1.120:5555
```

---

## 二、核心发现：实机复现 HEVC 问题

### 与 MuMu 相同的根因

```
D/MediaCodecInfo: NoSupport [codec.profileLevel, hvc1.1.6.L186, video/hevc]
  [OMX.amlogic.hevc.decoder.awesome]
```

**Amlogic 硬解器也拒绝 Level 6.2** —— 与 MuMu 的 Qualcomm 表现一致。

**结论**：HEVC Level 6.2 的问题是**跨平台的**，不是模拟器特有。

### 但实机的故障表现不同

| 设备 | 解码器 | 表现 |
| --- | --- | --- |
| MuMu | Qualcomm | 回退 `SoftwareRenderer` 软解 → 掉帧 |
| **实机** | Amlogic | 解码器**反复创建/销毁**，画面卡住 |

**实机日志特征**：

```
I/OmxComponent: STATE_SET:   OMX_StateExecuting => OMX_StateIdle
I/OmxComponent: STATE_TRANS: OMX_StateExecuting => OMX_StateIdle
I/OmxComponent: STATE_DONE:  OMX_StateExecuting => OMX_StateIdle
I/OmxComponent: STATE_SET:   OMX_StateIdle => OMX_StateLoaded
...
D/OmxComponentManagerImpl: DecreaseEntryNumByName pEntry->mNum=1
D/MediaCodecInfo: NoSupport [hvc1.1.6.L186]
```

**这是解码失败后重建解码器**的循环 —— 导致画面**完全卡住**（截图证据：静止标题画面）。

---

## 三、额外发现：实机音频硬件异常（独立问题）

### 采样率不匹配

```
I/SoftAAC2:  Reconfiguring decoder: 0->44100 Hz, 0->2 channels
I/AudioTrack: set(): sampleRate 44100, channelMask 0x3, frameCount 15052
D/audio_hw_primary: channels=8---format=1---period_count4---period_size1024---rate=48000---
```

| 层 | 采样率 |
| --- | --- |
| 内容音频（AAC） | **44100 Hz** |
| AudioTrack 配置 | 44100 Hz |
| **硬件输出** | **48000 Hz** |

→ 需要**重采样**，可能引入延迟。

### HDMI 输出节点打开失败

```
D/audio_hw_primary: open hdmi-tx node:
  /sys/class/amhdmitx/amhdmitx0/aud_output_chs failed!
```

**这是实机的音频硬件/驱动问题**，与我们的应用无关。

### 影响评估

这两个音频问题**可能**是「声音慢于画面」的实机特有原因，与 HEVC 问题**叠加**。

**但无法确定主次** —— 需进一步实验：

- 播放**音频正常但视频卡住**的内容，看声音是否滞后
- 或播放 **AVC 内容**（若存在），排除 HEVC 因素

---

## 四、画面渲染分析

截图显示：

- 画面**卡在标题图**（静止）
- 中间有**黑色竖条**
- 左右留黑（正常，因内容是 9:16 竖版，屏幕是 16:9）

**黑竖条成因未明**，可能是：

- Amlogic 视频层的缩放/定位异常（日志有 `amvideo_utils_set_virtual_position`）
- 或内容本身的画面构图

**未深入验证**，如实记录。

---

## 五、与 MuMu 的对比总结

| 项 | MuMu 模拟器 | 实机电视 |
| --- | --- | --- |
| 系统 | Android 12 (API 32) | **Android 5.1.1 (API 22)** |
| 解码器 | Qualcomm | **Amlogic** |
| HEVC NoSupport | ✅ 复现 | ✅ **复现** |
| 回退路径 | `SoftwareRenderer` 软解 | 解码器重建循环 |
| 播放表现 | 掉帧 | **完全卡住** |
| 音频采样率 | 未观察到异常 | **44100 vs 48000 不匹配** |
| HDMI 输出 | — | **节点打开失败** |

**共同点**：HEVC Level 6.2 导致硬解拒绝。

**差异点**：实机多两个音频硬件问题。

---

## 六、对修复方案的影响

### 方案 A（改写 level_idc）

**两个设备都值得测**：

- MuMu：验证是否从软解切回硬解
- **实机：验证是否停止解码器重建循环**（更有说服力，因为实机完全卡住）

**实机验证更有价值** —— 若改写后实机能正常播放，说明方案 A 有效。

### 方案 B（强制硬解）

**在实机上风险更高** —— 实机当前是「解码器重建循环」，强制硬解可能直接报错。

### 额外考虑

实机的**音频硬件问题**可能**独立于 HEVC 问题**存在。
即使 HEVC 修复，声音滞后可能仍存在。

**建议**：修复 HEVC 后**重新评估**实机的音画同步。

---

## 七、环境说明（如实记录）

1. **adb 端口限制**：本机 DSH 沙箱拒绝绑定 6300 以下 loopback 端口，
   `adb` 必须设 `ANDROID_ADB_SERVER_PORT=15037`
2. **实机与 MuMu 可同时连接**，互不干扰
3. **未逐帧测量音画偏移**，第三节的「可能」均为推测

---

## 八、证据文件

| 文件 | 说明 |
| --- | --- |
| `outputs/debug/a3-baseline-logcat.txt` | 实机完整日志（1211 行） |
| `outputs/debug/a3-baseline.png` | 实机卡住画面 |
| `outputs/debug/tv-real-play.png` | 实机播放状态（早期采样） |

---

## 九、下一步

1. **等待 A1**（antigravity 在 MuMu 验证改写 level_idc）
2. **A1 完成后，我在实机复测** —— 验证是否解决卡住问题
3. **A2**（codex 抽样统计）提供普遍性数据
4. **A4**（workbuddy）独立复核

**A3 的实机基线已建立**，可作为后续对比的参照。
