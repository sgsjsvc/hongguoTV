# MuMu 设备使用规则（动态声明制）

**生效**: 2026-10-16
**适用范围**: dsh / codex / antigravity / workbuddy / opencode / qoder
**目的**: 让 4 台设备**谁要谁用**，但必须**先声明、后使用、用完释放**，避免多 agent 抢同一台导致 adb 冲突

---

## 一、设备清单（已实测核对）

| 设备 ID | 地址 | **实际 API** | 型号 | 当前状态 |
| --- | --- | --- | --- | --- |
| `mumu-d1` | `127.0.0.1:16384` | **32** | 23113RKC6C | ✅ 在线 |
| `mumu-d2` | `127.0.0.1:16416` | **35** | V2203A | ✅ 在线 |
| `mumu-d3` | `127.0.0.1:16448` | **32** | 22041211A | ✅ 在线 |
| `mumu-r` | `192.168.1.120:5555` | 22 | 真机 | ⚠️ **offline** |

**注意**：

- **没有 API 22 的模拟器在线**。Android 5.1.1(API 22) 的兼容性验证只能等真机 `mumu-r` 恢复，
  或由 DSH 另起一台低版本模拟器。**不要声称在模拟器上验证了 API 22。**
- `mumu-r`（真机）当前 `offline`，使用前先确认能连上。

**adb 端口**：本项目统一用 `ANDROID_ADB_SERVER_PORT=15037`

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$env:ANDROID_ADB_SERVER_PORT = "15037"
& $adb devices
```

---

## 二、使用流程（三步）

### 1. 查空闲

```powershell
node .agents/cli.mjs mumu list
```

输出示例：

```
=== Mumu 设备状态 ===
mumu-d1  127.0.0.1:16384 (API 32)  ✗ 空闲
mumu-d2  127.0.0.1:16416 (API 35)  ✓ 占用中 by 'codex' [2026/10/16 21:05:14]
         用途: B5 性能测量 + TV 构建验证
mumu-d3  127.0.0.1:16448 (API 32)  ✗ 空闲
mumu-r   192.168.1.120:5555 (API 22)  ✗ 空闲
```

### 2. 声明占用

```powershell
# 用途含中文时，用环境变量传，避免 PowerShell 5.1 的 argv 乱码
$env:MUMU_PURPOSE = "TV 播放器切集验证"
node .agents/cli.mjs mumu declare mumu-d2 codex
Remove-Item Env:MUMU_PURPOSE

# 纯英文用途可直接写在参数里
node .agents/cli.mjs mumu declare mumu-d2 codex "tv-build-verify"
```

**可选环境变量**：

| 变量 | 作用 |
| --- | --- |
| `MUMU_PURPOSE` | 用途说明（推荐放中文） |
| `MUMU_AGENT` | 身份（也可作为第 3 个参数） |
| `MUMU_EXPIRES` | 预计结束时间（ISO 时间戳），到时其他人可协商接管 |
| `MUMU_TASK` | 关联任务 ID，便于追溯 |

### 3. 用完释放（**必须**）

```powershell
node .agents/cli.mjs mumu release mumu-d2 codex
```

**释放是硬性要求** —— 不释放会让其他人以为设备仍在占用。

---

## 三、完整命令参考

| 命令 | 作用 |
| --- | --- |
| `mumu list` | 查看 4 台设备的占用状态 |
| `mumu declare <设备> <身份> [用途]` | 声明占用 |
| `mumu release <设备> [身份]` | 释放（带身份时校验权限） |
| `mumu who <设备>` | 只输出占用者身份（`free` 表示空闲），供脚本判断 |

**设备 ID**：`mumu-d1` / `mumu-d2` / `mumu-d3` / `mumu-r`

---

## 四、冲突与仲裁

### 已被占用时

```
Error: mumu-d2 已被 'codex' 占用（2026/10/16 21:05:14，用途：B5 性能测量 + TV 构建验证）
  请等对方释放，或确认对方已完成后由 DSH 协调
```

**处理方式**：

1. 换一台空闲设备（优先）
2. 等对方释放
3. 确认对方**确实已完成**后，由 **DSH** 决定是否强制释放

### 越权释放会被拒

```
Error: mumu-d2 由 'codex' 占用，'antigravity' 无权释放（需 DSH 协调）
```

**这是有意的保护** —— 防止误释放导致他人测试中断。

### 超期接管

若 `expiresAt` 已过且对方无响应，可请 DSH 协调释放。
**不要自行删除他人的 `.lock.json`。**

---

## 五、锁文件格式

位置：`.agents/state/<设备ID>.lock.json`

```json
{
  "type": "mumu-lock",
  "version": "1.0",
  "id": "<uuid>",
  "device": "mumu-d2",
  "host": "127.0.0.1",
  "port": 16416,
  "apiLevel": 35,
  "claimedBy": "codex",
  "claimedAt": "2026-10-16T13:05:14.000Z",
  "expiresAt": null,
  "purpose": "B5 性能测量 + TV 构建验证",
  "metadata": { "claimedVia": "cli", "relatedTask": "t-b5-perf-measurement" }
}
```

**建议提交入库**，让所有人可见：

```bash
git add .agents/state/mumu-d2.lock.json
git commit -m "chore(agents): codex 声明占用 mumu-d2 — B5 性能测量"
```

---

## 六、规则要点（与 RESPONSIBILITIES.md 第 11 条对应）

1. ✅ **用前声明** —— 不允许直接 `adb connect` 就开始跑测试
2. ✅ **用完释放** —— 硬性要求
3. ✅ **细粒度描述用途** —— 写「TV 切集验证」而不是「测试」
4. ✅ **优先换空闲设备**，而不是抢
5. ❌ **不自行删除他人锁文件**
6. ❌ **不声称在 API 22 上验证过**（当前无 API 22 模拟器在线）
7. ⚠️ **构建互斥仍然有效** —— 同一时间只允许一次 Android Gradle 构建
   （见 RESPONSIBILITIES.md 边界规则第 6 条），这与设备声明是**两件独立的事**

---

## 七、与旧文件的关系

本文件**取代** `shared/device-allocation.md` 的静态分配（D1→antigravity、D2→codex、D3→workbuddy、REAL→dsh）。

**旧文件保留仅作历史参考**，不再具有约束力 —— 从今起是「谁要谁声明」。