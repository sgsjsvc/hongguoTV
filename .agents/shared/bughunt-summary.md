# Bug 排查总结（六轮完整排查）

**排查方**: dsh
**日期**: 2026-10-16
**方法**: 静态分析 + 边界测试 + 契约验证 + 真实设备/浏览器实测

---

## 一、确认的 Bug 汇总（7 个，其中 3 个待修）

| # | Bug | 严重性 | 状态 |
| --- | --- | --- | --- |
| **#1** | vendor 回退副本缺 `upstreamStats`，回退路径崩溃 | **中** | 已派发 **B1** (codex) |
| **#2** | `visibilitychange`/`online` 绕过 `isVideoPlaying` | 低-中 | 已派发 **B2** (antigravity) |
| **#3** | `App.tsx` 追剧页缺 `isVideoPlaying` | 低 | 已派发 **B2** (antigravity) |
| **#4** | sync-server `import` 即启动（顶层副作用） | 低 | 待评估 |
| **#5** | **Electron 后端崩溃无处理（用户只见白屏）** | **中** | 已派发 **B3** (workbuddy) |
| **#6** | 无单实例锁 | 低 | 已派发 **B3** |
| **#7** | 后端日志无轮转 | 极低 | 建议性 |

**修复任务负载**：codex 1 个 / antigravity 1 个 / workbuddy 1 个（**均衡**）

---

## 二、Bug 详情

### Bug #1（中）：vendor 回退副本缺 `upstreamStats`

**位置**：`custom-server/vendor/hongguo.cjs`、`server/vendor/hongguo.cjs`

**证据**：

```
✗ vendor 加载失败: upstreamStats is not defined
```

`custom-server/index.mjs:114` 导出 `upstreamStats`，但 vendor 未定义。
**已在打包产物中复现**。

**影响**：`shared` 缺失时回退会崩溃 —— **回退保险在最需要时不可用**。

### Bug #5（中）：Electron 后端崩溃无处理

**位置**：`apps/web-pc/electron/main.cjs`

`backend.once('exit')` 共 3 处，**全是 `once`**，启动完成后无存活的崩溃监听器。

**后果**：后端死亡 → 主进程无感知 → 请求全部 `ECONNREFUSED` →
**用户看到白屏，无提示，只能重启**。

### Bug #2/#3（低-中）：轮询绕过播放检查

`api.ts` 的 `visibilitychange`/`online` 与 `App.tsx` 的追剧页轮询
**未检查 `isVideoPlaying`**，与 `scheduleNextPoll` 内部逻辑不一致。

---

## 三、排除的候选（11 个）

**重要**：排查过程中发现 11 个「疑似 bug」，经独立验证后**全部排除**。

| # | 候选 | 排除理由 |
| --- | --- | --- |
| 1 | 预取队列 429 不恢复 | 我的测试脚本缺陷（提交 48 目标超上限 32） |
| 2 | 无效 ID 卡住队列 | 实测 4.1 秒正常失败并释放 |
| 3 | `operations` 空数组返回 400 | 前端**从不发送数组** |
| 4 | 片尾倒计时无清理 | 代码**实际有** `return () => clearInterval` |
| 5 | 播放未推进 | **浏览器自动播放策略** |
| 6 | 收藏状态未变化 | 我点的是**顶部导航**而非收藏按钮 |
| 7 | `SharedKey(undefined)` 抛错 | ES6 类不能直接调用（正常） |
| 8 | 打包漏 5 个依赖 | **我的正则误报**（动态复制未匹配） |
| 9 | 全新安装迁移失败 | `/api/library/import` **接受空数组（200）** |
| 10 | 同步无退避逻辑 | **实际有**（`library-sync.mjs:39` 指数退避） |
| 11 | Range 解析错误 | **我的复现逻辑有误**；真实函数 20/20 正确 |

**教训**：**验证前必须确认测试方法正确**，否则会把测试缺陷误报为产品缺陷。

---

## 四、已验证正确的部分

| 区域 | 验证方式 | 结果 |
| --- | --- | --- |
| 编码 | 669 文件扫 U+FFFD | ✅ 0 乱码 |
| 语法 | 148 JS 文件 `node --check` | ✅ 0 错误 |
| **PlaybackPolicy** | 28 项边界测试 | ✅ 全部正确 |
| **byteRange** | 20 项边界测试（真实函数） | ✅ 全部正确 |
| **library-store** | 13 项边界测试 | ✅ 输入校验严谨 |
| **同步冲突** | 幂等/256上限/seq冲突/时钟偏移 | ✅ 全部正确 |
| 服务端异常路径 | 非法 ID/Range/并发/中断 | ✅ 健壮 |
| API 契约 | 9 接口结构核对 | ✅ 字段齐全 |
| 预取接口 | 15 项边界 + P6 触发 | ✅ 0 缺陷 |
| 前端运行时 | CDP 6 页面 + 压力测试 | ✅ 0 异常 |
| TV 运行时 | 崩溃/ANR/内存/前后台 | ✅ 无问题 |
| TV Kotlin 静态 | 危险模式扫描 | ✅ 无 `runBlocking`/`GlobalScope` |
| HTTP 层 | `timingSafeEqual`/体积限制 | ✅ 安全 |
| Electron 安全 | `contextIsolation`/IPC 白名单 | ✅ 安全 |
| 打包产物 | 文件完整性 | ✅ 齐全 |

---

## 五、性能优化成果（前期）

| 优化 | 前 | 后 | 提升 |
| --- | --- | --- | --- |
| **详情接口**（预取后） | 1453 ms | **1 ms** | **~1450 倍** |
| **轮询流量/天** | 1201 MB | **122 MB** | 降 90% |
| **后台轮询** | 每秒 | **0** | 完全休眠 |
| **video 元素** | 切集重建 | **复用** | 消除黑屏 |
| **TV 列表** | 无 `onViewRecycled` | **已修** | 消除错位 |

---

## 六、排查覆盖率

| 区域 | 覆盖 |
| --- | --- |
| 编码 / 语法 | ✅ 100% |
| 服务端（API/HTTP/存储/同步） | ✅ |
| Web 前端（运行时/契约/逻辑） | ✅ |
| TV Android（静态/运行时/Kotlin） | ✅ |
| Electron 桌面端 | ✅ |
| 打包产物 | ✅ |
| 性能路径（预取/轮询/渲染） | ✅ |

**未覆盖**（客观限制）：
- 真实电视（API 22，当前 `offline`）
- 长时间稳定性（>1 小时连续运行）
- 多设备并发同步的端到端验证

---

## 七、排查脚本清单（28 个）

```
bughunt-prefetch.mjs              预取接口 15 项边界
bughunt-prefetch-queue.mjs        队列恢复能力
bughunt-invalid-id.mjs            无效 ID 影响
bughunt-p5-visibility.mjs         P5 事件路径分析
bughunt-engine-sync.mjs           引擎副本差异
bughunt-vendor2.mjs               vendor 回退可用性
bughunt-vendor-fallback.mjs       vendor 符号检查
bughunt-bundle-vendor.mjs         打包产物 vendor
bughunt-server.mjs                服务端异常路径
bughunt-frontend.mjs              前端控制台错误
bughunt-logic.mjs                 前端功能逻辑
bughunt-confirm.mjs               候选问题确认
bughunt-playback-policy.mjs       PlaybackPolicy 28 项
bughunt-polling-consistency.mjs   轮询一致性
bughunt-countdown.mjs             倒计时清理
bughunt-contract.mjs              API 契约 9 接口
bughunt-library-store.mjs         library-store 13 项
bughunt-close-idempotent.mjs      close 幂等性
bughunt-p6-prefetch.mjs           P6 预取触发
bughunt-tv-runtime.mjs            TV 运行时 8 项
bughunt-sync-and-bundle.mjs       同步服务与打包
bughunt-verify-bundle.mjs         打包覆盖核实
bughunt-electron-migration.mjs    全新安装迁移
bughunt-electron-main.mjs         主进程 8 项
bughunt-electron-crash.mjs        后端崩溃分析
bughunt-sync-conflict2.mjs        同步冲突边界
bughunt-http-layer.mjs            HTTP 层安全
bughunt-byterange.mjs             byteRange 20 项
bughunt-tv-kotlin.mjs             TV Kotlin 静态
```

---

## 八、结论

**六轮排查覆盖了全部主要代码路径。**

**确认 7 个 bug**（3 个已派发修复任务，负载均衡 1/1/1），
**排除 11 个误报**。

**核心模块（PlaybackPolicy、byteRange、library-store、同步逻辑）
经边界测试验证全部正确。**

**剩余未覆盖项受客观条件限制**（真机 offline、需长时间运行），
**非代码缺陷**。
