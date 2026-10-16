# WorkBuddy 就绪报告

- 身份：workbuddy（文档整理及独立复核方）
- 时间：2026-10-13 20:30（GMT+8）
- 依据：.agents/README.md、.agents/QUICKSTART.md
- 本轮范围：仅接入与报告；不修改业务代码，不自动派发或认领任务

## 一、可访问目录

已验证（本会话实际读取/写入）：

| 路径 | 能力 | 说明 |
| --- | --- | --- |
| `F:\Project\hongguoTV` | 读 | 项目根；已通读 README.md、HANDOVER.md、package.json、docs/ 关键文档 |
| `.agents/` | 读 | README / QUICKSTART / cli.mjs / bus.mjs / adapters.mjs 均已读；inbox / outbox / state / logs 当前均为空 |
| `.agents/shared/` | 读写 | 本报告即写入此处；按约定只写就绪报告与 `<任务ID>-workbuddy.md` 详细报告 |
| `docs/` | 读 | 我的归属区域（README 分工表）；含 RECOMMENDATIONS / LOCAL_REMOTE_SERVICES / TV_ANDROID_VERIFICATION 等设计与验证文档 |
| `shared/`（源码） | 读 | 归 Codex，我只读不改；注意勿与 `.agents/shared/` 混淆 |
| `custom-server/` `server/` `apps/` `tests/` `scripts/` | 读 | 同上，按分工只读 |
| `.workbuddy-ai/memory/` | 读写 | 我的记忆目录；敏感信息不得写入 |

未验证/不可及：

- 其他 agent（codex / antigravity / dsh）的会话内部状态，只能通过文件总线观察。
- `node .agents/cli.mjs run <id>` 自动投递链路未验证；QUICKSTART 明确未验证适配器前不使用 `run`。

## 二、可用工具

已验证可用：

- 文件读写与检索：可直接读、写、搜索工作区文件（本报告即产物）。
- 本地 Shell（Windows Git Bash）+ Node v22.22.2：本会话实测 `node .agents/cli.mjs status` / `ready` 只读命令正常返回。
- 只读 Git：`git status` 可用（结果见下节）。

受限/约定（未经协调者授权不主动使用）：

- 任务状态命令（claim / done / fail / add）：按本次接入指令与 QUICKSTART，我的任务状态由协调者（dsh）代记，我以报告文件提交结论与证据；不由我自行改写任务状态文件。
- 不运行 `run` 自动调度；不执行构建、安装、推送、服务启停（归协调者统一安排）。
- 不调用其他 agent 的适配器。

## 三、工作区状态快照（只读，未做任何改动）

- `git status`：4 个已跟踪文件被修改——`custom-server/index.mjs`、`custom-server/vendor/hongguo.cjs`、`server/vendor/hongguo.cjs`、`shared/content-core/hongguo.js`；未跟踪 `.agents/`、`docs/plans/2026-10-13-playback-upstream-fix.md`、`scripts/tv-verify.ps1`。与 QUICKSTART「已有其他工具的未提交修改」一致；我不覆盖、不回退、不清理。
- 当前分支：`codex/first-github-push-20261013`。
- `.agents` 总线：0 个任务、无心跳，inbox / outbox / shared / state / logs 为空——暂无分派或可认领任务。

## 四、阻塞项

1. **文件总线暂无任务**：`cli.mjs status` 返回 total 0。等待协调者写入带明确边界的任务后，我按 `assignee=workbuddy` 且依赖全部完成才能认领。
2. **WorkBuddy 无法被自动触发**：任务入口依赖人工在其窗口粘贴 prompt（README/QUICKSTART 已述）。因此我的 claim / done / fail 需协调者代记，或经人工转达；我不会主动改任务状态文件。
3. **播放修复处于暂停**：QUICKSTART 记录用户已停止播放修复；后续若恢复，范围仅 Web / Windows，TV 不改动、不构建、不安装。`docs/plans/` 下已有未提交的修复计划，获得任务后可独立复核其文档与测试证据，但不改动代码。

## 五、工作约定（对齐 README / QUICKSTART）

- 只认领 `assignee=workbuddy` 且 `blockedBy` 全部 `done` 的任务；动手前先读任务 JSON 的 context / acceptance。
- 报告区分【已验证事实】与【推测】；测试证据以实际运行的命令、版本、退出码和输出为准，不把 HTTP 成功当作实际播放成功。
- 任务完成后，详细报告写 `.agents/shared/<任务ID>-workbuddy.md`（目标、实际改动、验证环境与命令、结果、剩余风险、需其他方回答的问题），并按任务约定写 `.agents/outbox/<id>.json`；状态由协调者代记。
- 任何协作文件不写 Cookie、访问密钥、签名凭据、未脱敏抓包。
- 修改范围仅限 `docs/`、`.agents/` 报告与 `.workbuddy-ai/memory/`；业务代码不动，确需改动时先取得协调者明确授权并确认无其他修改者。

---

## 六、调试设备（2026-10-15 分配）

**你的固定设备：D3**

| 项 | 值 |
| --- | --- |
| adb 地址 | **`127.0.0.1:16448`** |
| Android | 12（API 32） |
| 分辨率 | 1080×1920（竖屏，需自行调横屏） |
| 密度 | 280 |
| 已装 App | ❌ 需自行安装 |

**分配理由**：与 antigravity 的 D1 **物理隔离**，避免复核时互相干扰。

### 准备步骤（若需设备验证）

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16448
& $adb -s 127.0.0.1:16448 shell wm size 1280x720
& $adb -s 127.0.0.1:16448 install -r <apk路径>
```

### 设备使用规范

1. **只用 D3**（`127.0.0.1:16448`）—— 不要操作其他 agent 的设备
2. **始终用 `-s 127.0.0.1:16448`** 显式指定
3. 截图命名带设备标识：`<任务ID>-d3-<场景>-<时间戳>.png`
4. **验证准则**：静态截图不能证明"卡住"或"正常"，必须验证**状态是否推进**（如播放位置时间戳变化）

**完整设备矩阵见** `.agents/shared/device-allocation.md`

---

## 待办复核任务（2026-10-15）

| 任务 ID | 标题 | 复核对象 |
| --- | --- | --- |
| `t-w6-verify-fullscreen` | W6 W4/W5 全屏成果独立复核 | W4（推荐流全屏）、W5（详情页全屏） |

### 复核理由

1. W4/W5 是本轮**唯一未经独立复核**的任务
2. **W2 曾因协调者的错误 brief 做错方向** —— 该区域易出错
3. **W5 发现了真实缺陷**（全屏样式被 Tailwind 覆盖）—— 该区域确有问题
4. 全屏是用户最关心的功能，涉及 Web + Electron 双环境

### ⚠️ 复核时必须注意

**两个不同的页面**：

| 页面 | 组件 | 全屏按钮 |
| --- | --- | --- |
| 推荐流 | `RecommendStream.tsx` | W4 新增（右上角） |
| 详情页/播放弹窗 | `PlayerModal.tsx` | 本就有（底部栏） |

**协调者此前就是混淆了这两个页面，导致 W2 做错方向。复核时务必先确认页面。**

**两条用户核心要求需独立验证**：

1. **全屏后保留自动下一集**（W5 声称用真实 `ended` 事件验证，非手动 dispatch）
2. **整个屏幕全屏**（判据 `innerWidth === screen.width`，非窗口最大化）

### 认领方式

```powershell
node .agents/cli.mjs claim t-w6-verify-fullscreen workbuddy
```

---

## 性能优化任务（2026-10-16）

协调者已实测建立基线，见 `.agents/shared/perf-baseline.md`。

### 实测数据

| 环节 | 耗时 |
| --- | --- |
| **详情接口** | **1086–2035 ms（平均 1369，无缓存）** |
| 推荐首屏 | 2514 ms（冷）/ 2 ms（热） |
| 清晰度 | 0–1 ms（已缓存） |
| 取流 | 32–37 ms（已缓存） |
| 自动下一集（同剧） | 38 ms |
| **自动切下一部剧** | **1407 ms** |

### 任务分配（三方各一个，完全并行）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `apps/tv-android/` |

### 测量脚本（验收需用同一脚本复测）

```powershell
node outputs/debug/measure-playback.mjs    # 基础链路
node outputs/debug/measure-deep.mjs        # 冷热对比与并发
```

### 认领方式

```powershell
node .agents/cli.mjs claim <任务ID> <你的身份>
```

---

## 性能优化任务补充（2026-10-16 第二批）

### 新增 P4：TV 端列表渲染与滚动流畅度

**协调者静态审查发现 4 个问题**（见 `.agents/shared/perf-baseline-render.md`）：

| # | 问题 | 影响 |
| --- | --- | --- |
| A | `SeriesAdapter` 无 `onViewRecycled` | 快速滚动图片错位 |
| B | `ArtworkLoader.load()` 无条件清空图片 | 滚动闪烁 |
| C | `GradientDrawable` 每次 bind 都新建 | 榜单滚动对象分配 |
| D | OkHttp 无并发限制 | 快速滚动请求风暴 |

### 最终分工（负载 2/2/1）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| `t-p1-detail-cache` | **codex** | `server/provider.mjs` |
| `t-p4-tv-render` | **codex** | `SeriesAdapter.kt`、`ArtworkLoader.kt` |
| `t-p2-web-video-reuse` | **antigravity** | `apps/web-pc/src/` |
| `t-p3-tv-ui-reuse` | **workbuddy** | `MainActivity.kt` |

**注意**：codex 领了 P1 与 P4 —— 两者**文件不重叠**（服务端 vs TV 端），可自由安排顺序。

### ⚠️ 设备当前离线

MuMu 模拟器已关闭，真机 `192.168.1.120:5555` 显示 `offline`。

**涉及 TV 的任务（P3、P4）需先启动模拟器或连真机**：

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" start-server
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect 127.0.0.1:16384
```

若设备不可用，可先做代码改动，**在报告中标注「未实测」**。

---

## ⚠️ P1 任务目标已修正（2026-10-16）

### 我先前的诊断不完整

**原判断**：「详情接口无缓存」—— **不完整**。

**实测发现**：`detail()` 自身无缓存，但它调用的 `routerData()` **有 `pageCache`（TTL 180 秒）**。

| 情况 | 详情耗时 |
| --- | --- |
| 180 秒内访问过 | **1 ms** |
| **首次访问** | **1453 ms** |
| **超过 180 秒** | **1453 ms** |

### 真正的瓶颈

**不是「缺缓存」，而是「没有预取」。**

真实切剧实测：

| 场景 | 合计 |
| --- | --- |
| 切到已缓存剧 | 805 ms |
| **切到未缓存剧** | **1981 ms**（详情占 1453 ms） |

**首次切到某部剧，无论如何都要等一次上游请求** —— 加缓存解决不了。

### 修正后的 P1 目标

| 原 | 新 |
| --- | --- |
| ~~详情接口加缓存~~ | **实现预取机制** |

**要求**：提供可复用的预取能力，让客户端在用户切换**之前**后台加载。

**关键设计**：并发控制、可取消、去重、低优先级（失败不影响主流程）、可关闭。

**详细要求见 `.agents/inbox/t-p1-detail-cache.brief.md`。**

### 我的失误与教训

我基于代码审查断言「无缓存」，但没做「重启服务 + 首次请求」的对照测试。
先前测量时服务已运行，`pageCache` 有数据，看到 1ms 时我以为是别的机制，
而写基线时又根据代码断言「无缓存」——**两者都没错，但我没把它们联系起来**。

**教训**：判断「有无缓存」必须清空缓存后测首次请求。

完整修正说明见 `.agents/shared/perf-baseline-correction.md`。

---

## ⚠️ 并行注意事项（TV 端任务）

P3（workbuddy）与 P4（codex）**都修改 TV 端代码**：

| 任务 | 文件 |
| --- | --- |
| P3 | `MainActivity.kt` |
| P4 | `SeriesAdapter.kt`、`ArtworkLoader.kt` |

**文件不重叠，可同时改代码。**

**但构建时会争用同一个 Gradle build 目录**：

- 同时执行 `assembleDebug` 可能导致 Gradle 守护进程冲突
- 症状：构建失败、产物不完整、或 `Unable to delete directory`

**建议**：

1. **改代码可并行**，但**构建前互相确认**（或错开时间）
2. 若构建失败且原因不明，先检查是否有另一个 Gradle 进程在跑
3. 构建后可验证产物时间戳，确认是自己那次构建

```powershell
# 检查是否有其他 Gradle 进程
Get-Process -Name java -ErrorAction SilentlyContinue | Select-Object Id, StartTime
```

## 播放流畅度测量结论（新增）

**吞吐已排除**：实测代理吞吐 **108–189 Mbps**，是 1080P 码率的 **36–63 倍**。

**真正的瓶颈是 HEVC 解码** —— 上游所有清晰度均为 HEVC（`bytevc1`），
无硬件解码的设备会软解掉帧。

详见 `.agents/shared/perf-throughput-verdict.md`。

**这意味着**：

- ❌ 不需要优化网络/代理（已足够快）
- ✅ 应关注：切集重建（P2）、UI 树重建（P3）、列表渲染（P4）、播放器参数


---

## 性能优化任务（2026-10-16）

协调者已实测建立基线，见 `.agents/shared/perf-baseline.md`。

### 实测数据

| 环节 | 耗时 |
| --- | --- |
| **详情接口（首次）** | **1453 ms**（重复 1 ms，有 pageCache） |
| 推荐首屏 | 2514 ms（冷）/ 2 ms（热） |
| 榜单新页 | 1456–2079 ms |
| 分类新标签 | 854–938 ms |
| 清晰度 | 0–1 ms（已缓存） |
| 取流 | 32–37 ms（已缓存） |
| **切到未缓存剧** | **1981 ms**（详情占 73%） |
| 代理吞吐 | 108–189 Mbps（是码率的 36–63 倍，非瓶颈） |
| **每秒轮询 /api/library** | **每天 1.2 GB** |

### 任务分配（三方各 2 个，负载均衡）

| 任务 | 负责方 | 文件 |
| --- | --- | --- |
| P1 播放预取机制 | **codex** | `server/provider.mjs` |
| P4 TV 列表渲染 | **codex** | `SeriesAdapter.kt`、`ArtworkLoader.kt` |
| P2 Web video 复用 | **antigravity** | `apps/web-pc/src/` |
| P5 Web 轮询优化 | **antigravity** | `apps/web-pc/src/api.ts` |
| P3 TV UI 树复用 | **workbuddy** | `MainActivity.kt` |

### 测量脚本（已入库）

```powershell
node scripts/perf/measure-playback.mjs      # 基础链路
node scripts/perf/measure-deep.mjs          # 冷热对比与并发
node scripts/perf/measure-real-switch.mjs   # 真实切剧流程
node scripts/perf/measure-throughput.mjs    # 播放吞吐量
node scripts/perf/measure-polling-live.mjs  # 轮询频率与流量
```

### ⚠️ 关键结论

1. **吞吐不是瓶颈**：108–189 Mbps，是 1080P 码率的 36–63 倍
2. **算法不是瓶颈**：推荐 `append()` 最坏 2.57 ms（池 512）
3. **瓶颈在「未预取」**：详情/榜单/分类首次都要 0.9–2 秒
4. **渲染层重建**：Web 的 video `key`、TV 的 `removeAllViews`

### 认领方式

```powershell
node .agents/cli.mjs claim <任务ID> <你的身份>
```
