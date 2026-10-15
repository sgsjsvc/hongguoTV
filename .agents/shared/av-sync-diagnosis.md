# 音画不同步问题诊断报告

**发现方**: dsh（协调者）
**日期**: 2026-10-15
**设备**: MuMu 模拟器（`127.0.0.1:16384`，Android 12 / API 32）
**现象**: 用户反馈「声音慢于画面」
**性质**: 只读诊断，未修改任何代码

---

## 一、根因（已实测确认）

### 上游视频把 HEVC Level 标成了 6.2（应为 4.0）

实测从上游直接下载的原始数据：

```
样本大小: 262144 字节
ftyp: ✓
含 hvc1: true      ← 视频轨 = HEVC (H.265)
含 mp4a: true      ← 音频轨 = AAC
HEVC profile_idc=1  level_idc=186
→ Main Profile, Level 6.2
```

**规格对照**：

| Level | 规格支持 |
| --- | --- |
| **4.0** | 1920×1080@30fps ← **1080P 的正常值** |
| 5.1 | 4096×2160@30fps |
| **6.2** | **8192×4320@120fps** ← **实测值，严重超配** |

1080P 视频标 Level 6.2，超出所有设备解码器的声明能力。

### 后果链条（logcat 实测）

```
1. MediaCodecInfo: NoSupport [codec.profileLevel, hvc1.1.6.L186, video/hevc]
     × OMX.qcom.video.decoder.hevc
     × c2.android.hevc.decoder
     × c2.qti.hevc.decoder          ← 三个解码器全部拒绝

2. MediaCodecRenderer: Format exceeds selected codec's capabilities

3. OMXStore: makeComponentInstance(OMX.qcom.video.decoder.hevc)  ← 仍尝试硬解

4. SoftwareRenderer: setting dataspace on output surface         ← 最终回退软解
```

**软解 1080P HEVC 性能不足** → 视频渲染掉帧滞后 → **画面与音频错位**。

---

## 二、关键验证：不是我们的问题

### 对比上游原始数据 vs 经我们引擎的数据

| 来源 | HEVC Level |
| --- | --- |
| **上游原始流**（直接请求 CDN） | **6.2**（`level_idc=186`） |
| 经我们引擎解密后 | **6.2**（相同） |

**结论**：Level 6.2 是**上游内容本身的编码参数**，不是我们的解密/代理引入的。

### 所有画质档位都是 6.2（降画质无效）

| 画质 | 编码 | Level |
| --- | --- | --- |
| 360P | HEVC | **6.2** |
| 480P | HEVC | **6.2** |
| 540P | HEVC | **6.2** |
| 720P | HEVC | **6.2** |
| 1080P | HEVC | **6.2** |

**360P 也标 Level 6.2** —— 更加不合理。**用户无法通过降低画质规避。**

---

## 三、为什么表现是「声音慢于画面」

> 用户描述：声音慢于画面

**推测机制**（未逐帧实测，标注为推测）：

ExoPlayer 的音画同步以**音频为主时钟**（默认 `audio` 同步源）：

- 音频正常解码播放（AAC 解码开销小，软解无压力）
- 视频软解掉帧，渲染滞后
- ExoPlayer 检测到视频落后，**丢帧追赶**
- 用户感知：画面在跳/不流畅，而音频连续 → **听感上「声音滞后」**

**另一种可能**：若软解导致音频缓冲被拉长，音频输出延迟增大，则表现为**声音确实慢于画面**。

**两种机制都指向同一根因**：软解性能不足。

> **需实机确认**：用可播放该内容且支持硬解的设备对比，或抓取 `AudioTrack` 时间戳与视频帧 PTS 差值。

---

## 四、其他排查结论（已排除）

| 项 | 结论 |
| --- | --- |
| ExoPlayer 配置 | 使用默认 `LoadControl`，无异常 |
| 音频属性 | `setAudioAttributes(DEFAULT, true)`，标准配置 |
| 流服务背压 | `custom-server/index.mjs:765` 有 `drain` 处理，**正确** |
| 分块大小 | 1MB，合理 |
| 音频 underrun | **未发现**（说明音频供给正常） |
| `getLatency()` 被拒 | 日志显示 `allowed`（走反射但仍可调用），**非根因** |

---

## 五、可选解决方向

### 方向 A：强制使用硬解（推荐优先验证）

ExoPlayer 默认允许回退软解。若强制硬解失败则报错而非静默软解，用户可感知问题而非看到卡顿画面：

```kotlin
val renderersFactory = DefaultRenderersFactory(this)
    .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF)
// 或在 MediaCodecSelector 中过滤掉软解器
```

**注意**：这会**导致部分内容无法播放**（宁可报错不卡顿）。需权衡。

### 方向 B：修正 HEVC Level（治本，但有风险）

在流代理层**改写 `hvcC` 的 `level_idc`**，把 6.2 降为实际需要的 Level（1080P → 4.0）。

**优点**：设备硬解可用，性能问题消失。

**风险**：
- 需精确修改 MP4 box，且要重新计算 box 校验（HEVC 无 CRC，风险相对可控）
- 若视频实际编码复杂度确实超出 Level 4.0 限制，硬解可能失败
- 涉及三端共享引擎，影响面大

**可行性**：`level_idc` 仅是**声明值**，解码器通常按实际码流解码。把它改小往往能让解码器接受该流。

### 方向 C：偏好 AVC 内容（规避）

若上游部分内容提供 AVC（H.264）版本，优先选择。但实测当前内容的**所有档位都是 HEVC**，此路暂时不通。

### 方向 D：向用户说明（诚实方案）

在设置页或首次播放时提示：该内容使用高规格 HEVC 编码，部分设备可能软解导致卡顿。

---

## 六、建议的验证步骤

1. **确认影响范围**：抽样多部剧集，统计 HEVC Level 6.2 的占比
2. **对比设备**：在支持 HEVC Level 6.2 的高端设备上验证是否正常
3. **验证方向 B**：手动改写 `level_idc` 后测试硬解是否可用
4. **量化音画偏移**：抓取音频时间戳与视频 PTS，确认偏移方向与幅度

---

## 七、当前环境限制（如实说明）

1. **诊断期间 codex 正在修改引擎文件**（`hongguo.js` 等，10:53 修改），
   导致部分实时查询返回 `video_model failed: 服务异常`。
   本报告的关键结论基于**已保存的上游原始样本**，不依赖当前引擎状态。

2. **未逐帧测量音画偏移量**，第四节所述机制为**推测**。

3. **未验证方向 B 的实际效果**（需改动代码）。

---

## 八、证据

| 项 | 来源 |
| --- | --- |
| 上游样本 | `%TEMP%\upstream.bin`（262144 字节，直接取自 CDN） |
| 各画质样本 | `%TEMP%\s-360P.bin` … `s-1080P.bin` |
| 解码器日志 | `adb logcat`（`NoSupport` / `Format exceeds` / `SoftwareRenderer`） |
| 引擎解析 | `shared/content-core/hongguo.js` 的 `resolveStream` |
