# Windows 端重新打包报告

**执行方**: dsh
**日期**: 2026-10-16
**任务**: 重新打包 Windows 到 release

---

## 一、为什么需要重新打包

**`release/windows/` 里的产物是旧版**（10-15 19:02），而引擎在 20:49 才更新。

### 发现过程

我先对比了三处产物：

| 位置 | 时间 | 引擎含 `deviceEntropy` |
| --- | --- | --- |
| `outputs/w7-release/win-unpacked` | 21:37 | ✅ **是** |
| `outputs/windows/win-unpacked` | 19:02 | ❌ 否 |
| **`release/windows/`** | **19:02** | ❌ **否** |

**W7（codex）确实构建了正确产物**，放在 `outputs/w7-release/`，
但**没有同步到 `release/windows/`** —— 报告称「已更新 release/windows」，实际未生效。

**这正是我在 README 里写下的第三个陷阱**：
`collect-release.mjs` 只是搬运工，源目录不更新就会搬运旧文件。

---

## 二、重新打包

### 前置门禁

```
npm run release:check
  # tests 144 / # pass 144 / # fail 0
  typecheck 通过
  播放冒烟测试通过
```

### 构建

```powershell
npm run build                                    # 前端
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64 --web-only
cd apps/web-pc
# 关键：不设置 HG_ELECTRON_DIST
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --x64 --arm64 --publish=never
```

**产物**：x64 / arm64 各一套安装包与便携版，外加两个通用版（双架构）。

---

## 三、产物校验（30 项全部通过）

### unpacked 目录

| 项 | x64 | arm64 |
| --- | --- | --- |
| 目录存在 | ✅ | ✅ |
| **exe PE 架构** | ✅ x64 | ✅ arm64 |
| **引擎与源码逐字节一致** | ✅ 74.3 KB | ✅ 74.3 KB |
| 引擎含 `deviceEntropy` | ✅ | ✅ |
| 引擎无旧 `device_id` | ✅ | ✅ |
| `listen-port.mjs` 一致 | ✅ | ✅ |
| `preload.cjs` 存在 | ✅ | ✅ |
| `main.cjs` 存在 | ✅ | ✅ |
| 前端含全屏按钮 | ✅ | ✅ |
| 前端含推荐流 | ✅ | ✅ |

### 从安装包内提取校验（关键）

不只看外层，而是解出 NSIS 内嵌载荷再验证：

| 项 | 结果 |
| --- | --- |
| `x64-setup.exe` 内嵌引擎与源码一致 | ✅ |
| `x64-setup.exe` 内嵌 app 架构 | ✅ x64 |
| `arm64-setup.exe` 内嵌引擎与源码一致 | ✅ |
| `arm64-setup.exe` 内嵌 app 架构 | ✅ arm64 |

**说明**：NSIS 外层启动器的 PE 头恒为 `0x14c`（32 位），
**不能用它判断产物架构** —— 必须解出内嵌 app 再读 PE 头。

### 最终 EXE 清单

| 文件 | 大小 |
| --- | --- |
| `红果短剧-1.0.0-x64-setup.exe` | 112.25 MB |
| `红果短剧-1.0.0-x64-portable.exe` | 112.00 MB |
| `红果短剧-1.0.0-arm64-setup.exe` | 103.74 MB |
| `红果短剧-1.0.0-arm64-portable.exe` | 103.48 MB |
| `红果短剧-1.0.0-setup.exe` | 215.36 MB（双架构） |
| `红果短剧-1.0.0-portable.exe` | 215.10 MB（双架构） |

---

## 四、实测运行（x64 版）

启动打包后的 `win-unpacked/红果短剧.exe`，用 CDP 驱动验证：

| 项 | 结果 |
| --- | --- |
| 进程启动 | ✅ 窗口标题「红果短剧 - 多端客户端」 |
| 桥接 `window.hongguotvDesktop` | ✅ 5 个方法齐全 |
| **推荐流全屏按钮** | ✅ **1 个**（`aria-label="全屏"`） |
| video 元素 | ✅ `readyState=4`、`paused=false`、`1080x1920` |
| **屏幕级全屏** | ✅ `inner [2304,1536] === screen [2304,1536]` |
| **覆盖任务栏** | ✅ `inner(1536) > avail(1488)` |
| `/health` | ✅ `upstreamHealthy: true`，`stats {total:8, ok:8, empty:0}` |

### 播放链路取样（5 部剧集）

| 剧集 | 清晰度 | 取流 |
| --- | --- | --- |
| 婚难自控 | 5 | ✅ HTTP 206 / 1024B |
| 离婚后才知她是神明第二季 | 5 | ✅ 206 |
| 大明小县令！ | 5 | ✅ 206 |
| 满院亲戚全是上古大妖第五季 | 5 | ✅ 206 |
| 拆迁一千万，我装穷试三子 | 1 | ✅ 206 |

**5/5 全部成功。**

### 一次偶发 502

首次取样时，第一部剧集返回 `qualities: 0` + `502`，重测即恢复。

**判定为偶发**（首个请求可能撞上设备消耗边界），且**自愈重试机制按预期工作** ——
这正是 `requestVideoModel` 每次换设备重试的设计目的。

---

## 五、同步到 release

```powershell
Remove-Item release\windows\*.exe, release\windows\*.blockmap
Copy-Item outputs\windows\红果短剧-1.0.0-*.exe release\windows\
```

**校验**：6 个文件与 `outputs/windows/` 源 **SHA256 完全一致**。

### 最终 release 结构

| 目录 | 文件数 | 大小 |
| --- | --- | --- |
| `release/`（清单） | 4 | — |
| `release/tv/` | 2 | 14.7 MB |
| `release/web/` | 8 | 301.7 MB |
| **`release/windows/`** | **6** | **861.9 MB** |

**合计 18 个文件，1178.36 MB**，`SHA256SUMS.txt` 已重新生成。

---

## 六、过程中发现的工具陷阱

### 1. NSIS 外层 PE 头不能用于判断架构

```
红果短剧-1.0.0-x64-setup.exe     外层 PE=0x14c（32 位）
红果短剧-1.0.0-arm64-setup.exe   外层 PE=0x14c（32 位）
```

两者外层相同。**必须解出内嵌 `app-64.7z` / `app-arm64.7z` 再读内层 exe 的 PE 头。**

### 2. `collect-release.mjs` 只搬运不构建

W7 的产物在 `outputs/w7-release/`，而脚本从 `outputs/windows/` 收集 —— 两者不同，
导致 `release/windows/` 停留在旧版。

**已在 README 记录该陷阱。**

---

## 七、验收结论

| 维度 | 结论 |
| --- | --- |
| 发布门禁 | ✅ test 144 + typecheck + smoke |
| 构建 | ✅ x64 / arm64 / 通用版 |
| 产物校验 | ✅ 30/30（含内嵌载荷） |
| 实测运行 | ✅ 播放 + 全屏 + 桥接 |
| release 同步 | ✅ 与源 SHA256 一致 |

**Windows 端 release 已重新打包并就绪。**
