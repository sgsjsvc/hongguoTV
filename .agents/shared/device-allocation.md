# 调试设备分配规范

**协调者**: dsh
**日期**: 2026-10-15
**目的**: 固定设备分配，避免多个 agent 抢用同一模拟器

---

## 一、设备矩阵

| 设备 ID | adb 地址 | Android | 分辨率 | 密度 | 逻辑尺寸 | 特点 |
| --- | --- | --- | --- | --- | --- | --- |
| **D1** | `127.0.0.1:16384` | 12 (API 32) | 720×1280<br>（可调 1280×720） | 240 | 853×480dp | 已装 App；**唯一可横屏的** |
| **D2** | `127.0.0.1:16416` | **15 (API 35)** | 1080×1920 | 280 | 617×1097dp | **最新系统**，未装 App |
| **D3** | `127.0.0.1:16448` | 12 (API 32) | 1080×1920 | 280 | 617×1097dp | 1080p，未装 App |
| **REAL** | `192.168.1.120:5555` | **5.1.1 (API 22)** | 1280×720 | 160 | 1280×720dp | **真实 Amlogic 硬解** |

**覆盖**：API 22 / 32 / 35，720p / 1080p，模拟器 + 真机。

---

## 二、分配方案

| Agent | 设备 | 说明 |
| --- | --- | --- |
| **antigravity** | **D1** `127.0.0.1:16384` | 主 UI 执行方；该设备已装 App 且可横屏 |
| **codex** | **D2** `127.0.0.1:16416` | API 35，用于验证新系统兼容性 |
| **workbuddy** | **D3** `127.0.0.1:16448` | 独立复核用，与 antigravity 物理隔离 |
| **dsh（协调者）** | **REAL** `192.168.1.120:5555` | 真实设备，硬解验证 |

**分配原则**：

1. **一个 agent 一个设备** —— 避免互相干扰（安装/卸载/分辨率改动会互相影响）
2. **复核方与执行方用不同设备** —— workbuddy 用 D3，antigravity 用 D1
3. **协调者用真机** —— 真机不可复制，由 dsh 独占
4. **D2（API 35）轮转** —— 谁需要验证新系统兼容性谁用

---

## 三、⚠️ 必读：adb 环境配置

### 端口限制（本机 DSH 沙箱）

**DSH 沙箱拒绝绑定 6300 以下的 loopback 端口**，adb 默认 5037 会失败：

```
127.0.0.1:5037  ✗ EACCES: permission denied
127.0.0.1:6300  ✓ 可绑定
```

**必须**改用高位端口：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server      # 应显示 daemon started successfully
```

### 连接设备

```powershell
& $adb connect 127.0.0.1:16384   # D1（antigravity）
& $adb connect 127.0.0.1:16416   # D2（codex）
& $adb connect 127.0.0.1:16448   # D3（workbuddy）
& $adb connect 192.168.1.120:5555 # REAL（dsh）
```

**所有 agent 共用同一个 adb server**（端口 15037），这是正常的 —— adb 支持多设备并发。

---

## 四、设备准备（各 agent 自行处理）

### D1（antigravity）

**已就绪**：

- 已装 `com.hongguotv.tv`
- 已调横屏：`wm size 1280x720`

**注意**：`wm size` 的覆盖设置**重启后会重置**，需重新设置。

### D2（codex）

**未准备**，需自行：

```powershell
& $adb -s 127.0.0.1:16416 shell wm size 1280x720    # 调横屏
& $adb -s 127.0.0.1:16416 install -r <apk路径>
```

### D3（workbuddy）

**未准备**，同上：

```powershell
& $adb -s 127.0.0.1:16448 shell wm size 1280x720
& $adb -s 127.0.0.1:16448 install -r <apk路径>
```

### REAL（dsh）

**已就绪**：已装 `com.hongguotv.tv`，原生横屏 1280×720。

---

## 五、⚠️ 设备使用规范

### 5.1 只用自己分配的设备

**不要**操作其他 agent 的设备。若需跨设备验证，**向协调者申请**。

### 5.2 不要改全局设置

| 允许 | 禁止 |
| --- | --- |
| 在自己设备上 `wm size` | 改其他设备的分辨率 |
| 在自己设备上安装/卸载 | 卸载其他设备的 App |
| 重启自己的设备 | 关闭其他设备 |

### 5.3 截图必须带设备标识

证据文件命名包含设备，避免混淆：

```
<任务ID>-<设备>-<场景>-<时间戳>.png
例：t-x1-d1-category-20261015.png
```

### 5.4 操作前确认设备

**每次操作前先确认当前设备列表**，避免因 transport_id 变化而操作错设备：

```powershell
& $adb devices -l
```

**始终用 `-s <地址>` 显式指定设备**，不要依赖默认设备。

---

## 六、设备特性差异（影响验证结论）

| 特性 | D1 | D2 | D3 | REAL |
| --- | --- | --- | --- | --- |
| Android 版本 | 12 | **15** | 12 | **5.1.1** |
| 分辨率 | 720p | 1080p | 1080p | 720p |
| 逻辑宽 | 853dp | 617dp | 617dp | 1280dp |
| **命中的 dimens 档** | **sw600dp** | **sw600dp** | **sw600dp** | **w1280dp** |
| 解码器 | Qualcomm | Qualcomm | Qualcomm | **Amlogic** |
| 硬解 HEVC | 部分 | 部分 | 部分 | 部分 |

### 关键：dimens 档位差异

| 档位 | 触发条件 | 命中设备 |
| --- | --- | --- |
| `values` | 最小宽度 < 600dp | 无 |
| `values-sw600dp` | 最小宽度 ≥ 600dp | D1、D2、D3 |
| `values-w1280dp` | **可用宽度 ≥ 1280dp** | **REAL** |

**REAL 是唯一命中 `w1280dp` 档的设备** —— 验证最高档 dimens 必须用它。

### 分辨率调整注意

D1/D2/D3 的 `wm size 1280x720` 只改**物理像素**，**不改 density**：

- D1：1280/1.5 = **853dp** 宽 → 命中 sw600dp
- D2/D3：1280/1.75 = **731dp** 宽 → 仍命中 sw600dp

**要让 D2/D3 命中 w1280dp**，需同时降 density：

```powershell
& $adb -s 127.0.0.1:16416 shell wm size 1280x720
& $adb -s 127.0.0.1:16416 shell wm density 160   # 使逻辑宽度达 1280dp
```

---

## 七、故障排查

### adb 无法启动

```
could not read ok from ADB Server
```

**检查**：是否设了 `ANDROID_ADB_SERVER_PORT`？

### 设备 offline

```powershell
& $adb disconnect 127.0.0.1:16384
& $adb connect 127.0.0.1:16384
```

### 模拟器未运行

MuMu 管理器里启动对应实例。**注意端口会随启动顺序变化**：

```powershell
# 重新扫描端口
foreach ($p in 16384,16416,16448) {
  netstat -ano | Select-String ":$p.*LISTENING"
}
```

### 操作错设备

**始终用 `-s` 指定**。若发现 transport_id 变化，重新 `adb devices -l` 确认。

---

## 八、变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-15 | 初始分配：antigravity→D1，codex→D2，workbuddy→D3，dsh→REAL |
