# 本轮发现：清晰度标签非标准 + Electron 启动阻塞

**记录方**: dsh
**日期**: 2026-10-16

---

## 一、已启动并验证

| 端 | 状态 | 地址 | Bundle |
| --- | --- | --- | --- |
| **Web** | ✅ 运行中 | `http://localhost:8788` | `index-DffVcIVz.js` |
| **桌面** | ✅ 运行中 | 窗口「红果短剧 - 多端客户端」 | `index-DffVcIVz.js` |

**两者都运行最新构建**（17:05 构建），引擎为 **`device_level=5`**（Q1 已生效）。

**桌面端启动阶段日志**（全部成功）：

```
starting-backend → backend-ready → migration-module-loaded →
migration-page-loaded → legacy-storage-read → legacy-migration-finished →
creating-main-window
```

**无启动错误。** 桌面端后端独立监听 5274。

**Q1 修复已在运行中的桌面端验证**：6/6 部剧都是 5 档清晰度。

---

## 二、🔴 重要发现：`ELECTRON_RUN_AS_NODE=1` 会阻塞所有 Electron 启动

### 现象

启动 Electron 时**立即退出**，无窗口，stderr：

```
TypeError: Cannot read properties of undefined (reading 'requestSingleInstanceLock')
    at Object.<anonymous> (main.cjs:7:30)
```

### 根因

**当前 shell 环境中有 `ELECTRON_RUN_AS_NODE=1`**（由外部环境注入，非机器/用户级变量）。

设了该变量后，**`electron.exe` 会以「纯 Node」模式运行**：

| | 正常模式 | `ELECTRON_RUN_AS_NODE=1` |
| --- | --- | --- |
| `require('electron')` | 返回 Electron API | 返回**二进制路径字符串** |
| `app` | 对象 | **`undefined`** |
| 结果 | 窗口打开 | **崩溃退出** |

**这解释了为什么桌面端「启动即退出」** —— 代码本身没问题。

### 修复方式

**启动前清除该变量**：

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run desktop:dev
```

**已验证**：清除后 Electron 正常启动（4 个进程：main/gpu/utility/renderer），窗口标题正确。

### ⚠️ 对 agent 的影响

**B3（workbuddy）正在做 Electron 验证** —— 若不处理该变量，
它的验证会**全部失败并误判为代码缺陷**。

**Q1/B1/B2 执行方未受影响**（它们不启动 Electron）。

**必须在 B3 的 brief 中补充此说明。**

---

## 三、🟡 新发现：清晰度标签非标准（Q1 的副作用）

### 现象

Q1 修复让档位齐全了，但**部分剧的档位名不是标准值**：

| 剧 | 修复后档位 |
| --- | --- |
| 离婚后才知她是神明第二季 | `1924P/1282P/962P/642P/480P` |
| 开局系统逼我败家 | `1080P/544P/540P/480P/360P` |
| 公路求生榜一说她要走到公路尽头 | `1080P/496P/480P/360P`（**只有 4 档**） |

**实测比例**：24 部中 **2 部（8%）** 出现非标准标签。

### 根因

**上游每一档都有一个权威的 `definition` 字段，值是标准档位**，
但代码用的是**变化的 `vheight`**：

| key | vheight（代码在用） | vwidth | **definition（权威）** | codec |
| --- | --- | --- | --- | --- |
| video_5 | **1924** | 1080 | **"1080p"** | bytevc1 |
| video_4 | **1282** | 720 | **"720p"** | bytevc1 |
| video_3 | **962** | 540 | **"540p"** | bytevc1 |
| video_2 | 854 | 480 | "480p" | bytevc1 |
| video_1 | **642** | 360 | **"360p"** | bytevc1 |

**致命案例**（公路求生）：

| key | vheight | vwidth | definition |
| --- | --- | --- | --- |
| video_3 | **496** | 864 | **"540p"** |
| video_4 | **496** | 864 | **"720p"** |

**两行的 `vheight` 完全相同（496）** → 推导出的 key 都是 `496P`
→ 被 `seenKeys` 去重**丢掉一档** → 用户只看到 4 档。

### 为什么 Q1 之后才显现

Q1 之前这些档位是 `bytevc2`（被过滤），**所以问题不可见**。
Q1 让它们变成 `bytevc1` 可播，**问题随之暴露**。

**底层缺陷（用 vheight 而非 definition）是既有的，Q1 只是把它暴露出来。**

### 修复方案

**位置**：`custom-server/index.mjs:710`

```javascript
// 修改前
const qNum = hgEngine.qualityNumber(row.quality || row.item?.vheight || row.key);

// 修改后（优先用权威的 definition）
const qNum = hgEngine.qualityNumber(row.item?.definition || row.quality || row.item?.vheight || row.key);
```

**验证修复有效**：

| 输入 | `qualityNumber` 返回 |
| --- | --- |
| `"1080p"` | **1080** ✅ |
| `"540p"` | **540** ✅ |
| `"1924"` | 1924 ❌（当前问题） |

**修复后效果**：

| 剧 | 修复前 | 修复后 |
| --- | --- | --- |
| 离婚后才知她是神明 | `1924P/1282P/962P/642P/480P` | `1080P/720P/540P/480P/360P` |
| 公路求生 | `1080P/496P/480P/360P`（4 档） | `1080P/720P/540P/480P/360P`（5 档）✅ |

**同时解决标签不规范 + 档位丢失两个问题。**

### 需同步

`custom-server/index.mjs` 的 qualities 路由是**唯一**做该推导的地方。
**引擎与 vendor 不需要改**（它们返回原始 rows，不做标签推导）。

**但需确认 TV 端**：TV 是否也用 vheight 推导？

**待核实**：`apps/tv-android` 与 `custom-server` 是否共用这段逻辑。
TV 走 `LocalContentService` + `StandaloneEngine`，可能自有一份 —— 需检查。

---

## 四、测量脚本（已入库）

```
scripts/perf/quality-label-diagnose.mjs   定位非标准档位
scripts/perf/quality-label-scan.mjs       广泛扫描非标准标签比例
scripts/perf/quality-odd-source.mjs       查原始来源
scripts/perf/quality-odd-dump.mjs         dump 非标准档位的原始字段
scripts/perf/quality-derive-compare.mjs   vheight vs definition 推导对比
scripts/perf/check-video-cache.mjs        视频缓存实证（CDP）
scripts/perf/check-video-cache2.mjs       视频缓存响应头核实
```

---

## 五、待办

| # | 项 | 优先级 |
| --- | --- | --- |
| 1 | 派发 Q2 修复档位标签推导（`custom-server:710`） | 高 |
| 2 | 核实 TV 端是否也有同样的 vheight 推导问题 | 中 |
| 3 | **在 B3 brief 中补充 `ELECTRON_RUN_AS_NODE` 说明** | **高**（否则 B3 验证必失败） |