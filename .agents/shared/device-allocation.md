# 调试设备分配规范

> ## ⚠️ 本文件已失效（历史参考）— 2026-10-16 起
>
> 本文件的**静态分配**（D1→antigravity、D2→codex、D3→workbuddy、REAL→dsh）**已被
> [mumu-device-allocation.md](../mumu-device-allocation.md) 的动态声明制取代**：
> 「谁要谁声明，先声明后用，用完释放」。**派发与使用一律以新文件为准，不得按本文件固定归属。**
>
> **本文件保留仅为历史参考**，不删除（协同记录须可追溯）。
>
> **配套旧锁文件去向**：`state/device-d1.lock.json`、`state/device-d2.lock.json`、
> `state/device-d3.lock.json` 三个 2026-10-15 旧制静态锁，已由 DSH 于 2026-10-16 裁决
> **原样归档**（保留设备ID、agent、地址、授权与备注全文，见文件内 `supersededBy` 字段），
> 不在 `state/` 中继续冒充现行登记。**现行登记唯一来源为 `state/mumu-<设备>.lock.json`**
> （`mumu list` / `mumu declare` / `mumu release` 只读写该格式）。
> 归档副本：`.agents/archive/device-locks-before-dynamic-20261016/`。

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

> ⚠️ **本节已于 2026-10-15 勘误**。原版按「可用宽度」判断档位，**结论有误**。
> 勘误依据：workbuddy 的实测（`.agents/shared/device-dimens-bucket-correction.md`）
> 与协调者在真机的 `am get-config` 复核。

| 特性 | D1 | D2 | D3 | REAL |
| --- | --- | --- | --- | --- |
| Android 版本 | 12 | **15** | 12 | **5.1.1** |
| 物理分辨率 | 720p | 1080p | 1080p | 720p |
| density | 240 | 280 | 280 | **160** |
| **最小宽度（sw）** | **480dp** | **617dp**（原生）<br>411dp（调 720p 后） | 同 D2 | **720dp** |
| **命中的 dimens 档** | **`values`** | `values` / `sw600dp`（看配置） | 同 D2 | **`sw600dp`** |

### 🔴 关键更正：档位由「最小宽度」决定，不是「可用宽度」

**判定口径**：

```powershell
adb shell am get-config
# 看输出中的 sw<N>dp 字段，例如：
#   sw480dp  → 命中 values
#   sw720dp  → 命中 values-sw600dp
```

**资源匹配规则**（Android 官方）：

1. 先淘汰不满足限定符的目录
2. 按限定符类型的**优先级顺序**逐个比较
3. **`smallestWidth`(sw) 的优先级高于 `available width`(w)**

**推论（重要）**：

> 只要设备的最小宽度 ≥ 600dp，`values-w1280dp` 就**永远不会生效** ——
> 它被 `values-sw600dp` **遮蔽**（因为 `values-w1280dp` 未声明 sw，在 sw 比较阶段被判为更泛化）。

### 各设备实测档位

| 设备与配置 | 逻辑尺寸 | 最小宽度 | **实际命中档** | 依据 |
| --- | --- | --- | --- | --- |
| D1 `1280x720` @240dpi | 853×480dp | 480dp | **`values`** | 实测（leftRail 156px ÷1.5 = 104dp = `values` 值） |
| D2/D3 `1280x720` @280dpi | 731×411dp | 411dp | **`values`** | D3 实测 |
| D2/D3 原生 `1080x1920` @280dpi | 617×1097dp | **617dp** | **`values-sw600dp`** | 推导 |
| D3 `1280x720` @**192dpi** | 1066×600dp | **600dp** | **`values-sw600dp`** | 实测（leftRail 142px = 118.3dp） |
| **REAL `1280x720` @160dpi** | 1280×720dp | **720dp** | **`values-sw600dp`** | `am get-config` 确认 `sw720dp` |
| D1 `1280x720` @90dpi | 2275×1280dp | 1280dp | **`values-sw600dp`** | 实测（**非** w1280dp，遮蔽实证） |

### 让模拟器落在 sw600dp 档（TV 目标档）

**仅改 `wm size` 不够**，还需降 density：

```powershell
# 720p 要达 sw600dp，需 density ≤ 192（720/600 = 1.2）
& $adb -s 127.0.0.1:16416 shell wm size 1280x720
& $adb -s 127.0.0.1:16416 shell wm density 192
```

**验证**：`am get-config` 应显示 `sw600dp`。

### ⚠️ `values-w1280dp` 形同虚设

由于上述遮蔽效应，**`values-w1280dp` 目录在 sw≥600dp 的设备上永不生效**。

**建议**（已记录，待统筹）：将目录改名为 **`values-sw1280dp`**（与 sw600dp 同族，优先级可比）。
该改动涉及全部 dimens 键，宜单独立项。

---

## 六之二、分辨率调整注意（已更正）

`wm size 1280x720` **只改物理像素，不改 density**：

| 设备 | 调整后逻辑尺寸 | 最小宽度 | 命中档 |
| --- | --- | --- | --- |
| D1 (240dpi) | 853×480dp | 480dp | `values` |
| D2/D3 (280dpi) | 731×411dp | 411dp | `values` |

**要命中 `sw600dp`**，需 `wm density 192`（见上）。

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
