# A4 音画不同步诊断 — 独立复核

**任务 ID**: `t-a4-verify-av`
**负责人**: workbuddy
**依赖**: `t-a1-hevc-level`（A1）、`t-a2-hevc-survey`（A2）**都完成后**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 一、复核对象

针对「声音慢于画面」问题，已有三方工作：

| 来源 | 内容 |
| --- | --- |
| **dsh**（协调者） | 初步诊断：上游 HEVC Level 6.2 导致硬解拒绝、回退软解 |
| **A1**（antigravity） | 验证改写 `level_idc` 能否恢复硬解 |
| **A2**（codex） | 抽样统计 Level 分布 |

**你的任务**：独立核查这些结论是否成立。

---

## 二、要核查的核心命题

### 2.1 dsh 的诊断是否成立

**命题**：「上游视频把 HEVC Level 标成了 6.2，导致硬解器拒绝，回退软解，进而音画不同步」

**核查方式**：

1. **独立获取样本**：自行从 CDN 下载原始数据（**不要复用 dsh 的样本文件**）
2. **独立解析 Level**：用你自己的方法确认 `level_idc`
3. **确认非我方引入**：对比上游原始数据 vs 经我们服务的数据
4. **核查日志证据**：`NoSupport` + `SoftwareRenderer` 是否真实存在

**特别要求**：**不要盲信 dsh 给的偏移公式**（`hvcC_offset + 4 + 12`），
请自行核实 `hvcC` box 结构并验证偏移正确。

### 2.2 A1 的验证结论是否可信

**核查方式**：

1. A1 声称的「改写后无 `NoSupport`」是否有**真实 logcat 证据**？
2. A1 的截图是否**真的对应改写后的播放状态**？（防止误存其他页面）
3. A1 是否**验证了 MP4 结构未被破坏**？
4. 若 A1 声称成功，**能否复现**？（你可自行重跑）
5. 若 A1 失败，其失败原因是否合理？

### 2.3 A2 的抽样统计是否可靠

**核查方式**：

1. 抽样规模是否 ≥ 20 部？
2. 是否有**原始数据**可复核？
3. 结论是否有数据支撑（而非推测）？
4. **抽查 2-3 部**，独立验证其 Level 值是否与 A2 报告一致

### 2.4 「声音慢于画面」的机制是否成立

dsh 在诊断报告中**明确标注该机制为推测**（未逐帧测量）。

**核查要求**：

- 确认该标注是否诚实（有无把推测写成已核实）
- 若有条件，尝试**量化音画偏移**（抓音频时间戳与视频 PTS）
- 若无法量化，**如实说明**

---

## 三、独立验证手段

### 3.1 两个设备都可用

| 设备 | 地址 | 特点 |
| --- | --- | --- |
| **MuMu 模拟器** | `127.0.0.1:16384` | Android 12，Qualcomm 解码器 |
| **实机电视** | `192.168.1.120:5555` | Android 5.1.1，Amlogic 解码器 |

**建议两个都测** —— 解码器不同，结论可能不一致。

### 3.2 ⚠️ adb 端口限制

**本机 DSH 沙箱拒绝绑定 6300 以下 loopback 端口**：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384      # MuMu
& $adb connect 192.168.1.120:5555   # 实机
```

### 3.3 独立解析 Level 的方法

**不要直接用 A1/A2 的脚本**。建议：

```javascript
// 自行定位 hvcC，并打印其前后 32 字节，人工确认结构
const b = fs.readFileSync(file);
const j = b.toString('latin1').indexOf('hvcC');
console.log('hvcC @', j);
console.log('前后字节:', b.subarray(j, j + 32).toString('hex'));
// 然后根据 HEVC 规范自行判断 level_idc 位置
```

**HEVC `hvcC` 结构参考**（ISO/IEC 14496-15）：

```
size(4) type(4)="hvcC"
configurationVersion(1)
general_profile_space(2) general_tier_flag(1) general_profile_idc(5)   ← 1 字节
general_profile_compatibility_flags(4)
general_constraint_indicator_flags(6)
general_level_idc(1)                                                   ← 目标字节
```

---

## 四、硬性约束

1. **只读复核，不修改任何代码**
2. 不执行 `git checkout` / `git reset` / `git clean`
3. **区分「已核实」与「推测」** —— 实测的才是已核实
4. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. 报告明确列出：**已核实事实 / 无法核实项 / 发现的问题 / 改进建议**
2. 对 **dsh 的诊断**给出明确判断（成立 / 不成立 / 部分成立）及依据
3. 对 **A1 的结论**给出明确判断，并说明是否可复现
4. 对 **A2 的统计**抽查验证，给出对比结果
5. **独立解析至少 1 个样本的 Level**，并给出你的方法与结果
6. 明确指出是否有**把推测写成已核实**的情况
7. 每条结论附**证据**（文件 / 命令输出 / 代码行号）
8. 报告写入 `.agents/shared/t-a4-verify-av-workbuddy.md`

---

## 六、证据要求

- 截图命名：`<任务ID>-<场景>-<状态>-<时间戳>.<ext>`
- **校验 PNG 签名**（`89-50-4E-47-0D-0A-1A-0A`）
- 落盘 `.agents/shared/`

### 已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| `input tap` 无效 | 播放页吞掉触摸，用 DPAD |
| chrome 自动隐藏 | 5 秒后隐藏 |
| dump 大小 | 4430=播放页，15700=chrome，20800=分类页 |

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-a4-verify-av workbuddy "结论及报告路径"
```
