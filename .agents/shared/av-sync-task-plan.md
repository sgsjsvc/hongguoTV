# 音画不同步问题 — 诊断结论与任务规划

**协调者**: dsh
**日期**: 2026-10-15
**现象**: 用户反馈「声音慢于画面」，实机表现为画面卡住
**性质**: 诊断已完成，待派发修复任务

---

## 一、根因（已实测确认，两个设备均复现）

### 上游视频把 HEVC Level 标成了 6.2

**证据链**（dsh 独立获取，绕过自有服务）：

```
从 CDN 直接下载的原始数据（262144 字节）：
  含 hvc1: true        ← 视频轨 = HEVC (H.265)
  含 mp4a: true        ← 音频轨 = AAC
  HEVC profile_idc = 1 (Main)
  HEVC level_idc   = 186 → Level 6.2
```

**规格对照**：

| Level | 规格 |
| --- | --- |
| **4.0** | 1920×1080@30fps ← **1080P 正常值** |
| 5.1 | 4096×2160@30fps |
| **6.2** | **8192×4320@120fps** ← 实测值 |

### 两个设备均复现

| 设备 | 解码器 | 日志 |
| --- | --- | --- |
| **MuMu 模拟器** | `OMX.qcom.video.decoder.hevc`<br>`c2.android.hevc.decoder`<br>`c2.qti.hevc.decoder` | `NoSupport [hvc1.1.6.L186]` |
| **实机电视**（Amlogic，Android 5.1.1） | `OMX.amlogic.hevc.decoder.awesome` | `NoSupport [hvc1.1.6.L186]` |

**共同表现**：

```
MediaCodecRenderer: Format exceeds selected codec's capabilities
  [id=1, mimeType=video/hevc, container=video/mp4]
```

### 后果

- **MuMu**：回退 `SoftwareRenderer` 软解 → 视频掉帧滞后 → 音画错位
- **实机电视**：`ExoPlayerImplInternal` 报错堆栈 → **画面完全卡住**（截图证据：静止海报 + 黑色竖条）

### 关键约束

**所有画质档位都是 Level 6.2**（实测 360P/480P/540P/720P/1080P），
**连 360P 也是** → **用户无法通过降画质规避**。

### 排除项

| 项 | 结论 |
| --- | --- |
| 上游 vs 经我们引擎 | **都是 6.2** → 非我方引入 |
| ExoPlayer 配置 | 默认 LoadControl，正常 |
| 流服务背压 | `index.mjs:765` 有 `drain`，**正确** |
| 音频 underrun | 未发现 |
| `getLatency()` 被拒 | 日志为 `allowed`，非根因 |

---

## 二、设备分工（用户提议）

| 角色 | 设备 | 优势 |
| --- | --- | --- |
| **dsh（协调者）** | **实机电视** `192.168.1.120:5555` | 真实硬解能力（Amlogic）、API 22 老系统、可复现「完全卡住」 |
| **antigravity** | **MuMu 模拟器** `127.0.0.1:16384` | 可反复重启、软解回退路径、日志完整 |

**分工价值**：两个设备的解码器不同（Qualcomm vs Amlogic），且**故障表现不同**（掉帧 vs 卡死）—— 可交叉验证修复效果。

### 实机环境（已核实）

| 项 | 值 |
| --- | --- |
| 地址 | `192.168.1.120:5555` |
| 系统 | **Android 5.1.1（API 22）** |
| CPU | armeabi-v7a |
| 类型 | tv |
| 分辨率 | 1280×720 @160dpi |
| 已装 | `com.hongguotv.tv` |

### MuMu 环境（已核实）

| 项 | 值 |
| --- | --- |
| 地址 | `127.0.0.1:16384` |
| 系统 | Android 12（API 32） |
| CPU | x86_64 |
| 分辨率 | 需 `wm size 1280x720` 调横屏 |

### ⚠️ adb 端口限制（两个设备都受影响）

**本机 DSH 沙箱拒绝绑定 6300 以下的 loopback 端口**，adb 默认 5037 会失败：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
```

**实机连接**：`adb connect 192.168.1.120:5555`
**MuMu 连接**：`adb connect 127.0.0.1:16384`

---

## 三、候选修复方案

### 方案 A：改写 `hvcC` 的 `level_idc`（推荐优先验证）

**原理**：`level_idc` 是**声明值**，解码器通常按实际码流解码。
把 6.2 改为实际所需 Level（1080P → 4.0，720P → 3.1）后，硬解器可能接受。

**实现位置**：`custom-server/index.mjs` 流代理层，或 `shared/content-core/hongguo.js`

**关键要求**：
- 必须同时修改 **moov 中的 `hvcC` box**（在 `prepareHeader` 已解析的范围内）
- 需**同步修改三份引擎副本**
- 只改 `level_idc` 单字节，不改变其他 box 尺寸（**不破坏 MP4 结构**）

**风险**：
- 若视频实际编码复杂度超出目标 Level，硬解可能失败
- 影响三端

**验证方式**：改后观察 logcat 是否仍报 `NoSupport`，以及是否出现 `SoftwareRenderer`

### 方案 B：强制硬解，禁止软解回退

**原理**：ExoPlayer 默认允许软解回退。若强制硬解，失败时**报错而非静默卡顿**。

**实现**：自定义 `MediaCodecSelector` 过滤软解器，或设置 `DefaultRenderersFactory`

**风险**：部分内容**完全无法播放**（宁可报错不卡顿）

### 方案 C：向用户提示

在设置页或播放失败时提示「该内容编码规格超出设备能力」。

---

## 四、任务划分

| ID | 任务 | 负责人 | 设备 | 内容 |
| --- | --- | --- | --- | --- |
| **A1** | 验证方案 A 可行性 | **antigravity** | MuMu | 手动改写 level_idc，验证硬解是否恢复 |
| **A2** | 抽样统计 Level 分布 | **codex** | — | 抽样多部剧集，统计 Level 6.2 占比 |
| **A3** | 实机对照验证 | **dsh（协调者）** | 实机电视 | 用实机验证 A1 的结论是否一致 |
| **A4** | 独立复核 | **workbuddy** | 只读 | 复核 A1/A2 的证据与结论 |

**依赖**：A3 依赖 A1（需 A1 产出可测的改动或明确结论）

---

## 五、验收标准

### A1（验证方案 A）

1. **修复前证据**：logcat 中 `NoSupport [hvc1.1.6.L186]` + `SoftwareRenderer`
2. **修复后证据**：logcat 中**无** `NoSupport`，且**无** `SoftwareRenderer`
3. **播放验证**：截图显示视频正常播放（非静止画面）
4. **音画同步**：如能测量，给出偏移量；不能则说明
5. **不破坏 MP4**：改后仍能正常播放（不因结构损坏而失败）

### A2（抽样统计）

1. 抽样 **≥ 10 部**不同剧集
2. 统计各 Level 的分布
3. 明确 Level 6.2 是否普遍
4. 检查是否存在 AVC（H.264）内容

### A3（实机对照）

1. 用实机验证 A1 结论
2. 确认 Amlogic 解码器行为是否一致
3. **截图证据**（实机 1280×720）

### A4（复核）

1. 独立核查 A1/A2 证据
2. 确认结论可复现
3. 指出任何不成立的推断

---

## 六、关键提醒

1. **两个设备都要测** —— 解码器不同，结论可能不一致
2. **必须验证不破坏 MP4** —— 改 box 有风险
3. **三份引擎副本要同步** —— 否则三端行为不一致
4. **不要声称「已修复」除非有 logcat + 截图双重证据**
5. **adb 必须用 `ANDROID_ADB_SERVER_PORT=15037`**

---

## 七、状态

**待派发。**
