# Bug 排查报告（第三轮：深度与未覆盖区域）

**排查方**: dsh
**日期**: 2026-10-16
**范围**: library-store、PlaybackPolicy、P6 预取、TV 运行时、同步服务、打包产物

---

## 一、本轮确认的问题（1 个）

### 🟡 Bug #4：sync-server 模块 import 即启动服务（顶层副作用）

**严重性**: 低
**位置**: `apps/sync-server/index.mjs`（及 `server.mjs`、`admin.mjs`）

**证据**（意外发现）:

排查脚本仅 `import` 该模块，就**自动启动了 8791 端口的服务**：

```
家庭共享密钥已生成，文件：...\apps\sync-server\data\shared-key.txt
共享服务已启动：http://localhost:8791
```

**影响**:

| 场景 | 结果 |
| --- | --- |
| 生产运行（`node index.mjs`） | ✅ 正常 |
| **单元测试导入** | ❌ **副作用：启动服务** |
| 工具脚本导入 | ❌ 意外启动 |

**即：无法在不启动服务的情况下导入该模块**，测试与隔离困难。

**建议**：导出 `start()` 函数，仅在直接运行时启动：

```javascript
export function start() { /* 启动逻辑 */ }

// 仅当直接运行时
if (import.meta.url === pathToFileURL(process.argv[1]).href) start();
```

---

## 二、本轮排除的候选（2 个）

| # | 候选 | 排除理由 |
| --- | --- | --- |
| 1 | `SharedKey(undefined)` 抛错 | ES6 类不能直接调用（须 `new`），**正常行为** |
| 2 | 打包漏了 5 个依赖 | **我的正则误报** —— `build-bundles.mjs` 用 `readdirSync` 动态复制所有 `.mjs`，实际全部打包 |

**核实**：5 个依赖在打包产物中**全部存在**：

```
✓ custom-server/history-store.mjs
✓ custom-server/history-routes.mjs
✓ custom-server/library-sync.mjs
✓ custom-server/library-routes.mjs
✓ custom-server/recommendation-service.mjs
```

---

## 三、已验证正确的部分（本轮新增）

### library-store（13KB，边界测试）

| 检查项 | 结果 |
| --- | --- |
| 合法事件写入 | ✅ |
| null / 非对象 / 缺 kind / 非法 kind / 非法 op | ✅ 全部被拒 |
| clear 非 `*` key | ✅ 被拒 |
| 保留 key `*` | ✅ 被拒 |
| preference delete | ✅ 被拒 |
| favorite id/key 不一致 | ✅ 被拒 |
| 同 id 重复写入（幂等） | ✅ |
| 时间戳 0 / 负数 / 超大 / undefined | ✅ 不崩溃 |
| NaN 时间戳 | ✅ 被拒（有意校验） |
| 10 万字符标题 | ✅ 被拒（有意校验） |
| 多实例打开同一文件 | ✅ |
| **重复 close** | ⚠️ 抛错（见下） |

### PlaybackPolicy（28 项边界）

全部正确：`remoteEpisodeIndex`、`seek`（含溢出保护）、`mergeUnique`、
`restoredIndex`、`resumeIndex`。

### P6 预取触发（实测）

| 检查项 | 结果 |
| --- | --- |
| 重复预取同一剧集 | ✅ 返回不同批次，可独立取消 |
| 快速连续预取 5 次 | ✅ 全部接受 |
| 全部可取消 | ✅ 5/5 |
| 前台请求不被预取阻塞 | ✅ 1381 ms |
| **预取后详情** | ✅ **1 ms**（优化前 1453 ms） |
| qualities 预取 | ✅ 完成 |

### TV 端运行时（真机 D2）

| 检查项 | 结果 |
| --- | --- |
| 应用启动 | ✅ |
| **崩溃日志** | ✅ **无**（按包名过滤） |
| ANR | ✅ 无 |
| 内存 | ✅ 147.6 MB |
| 前后台切换 | ✅ 不崩溃 |
| 分辨率变化 | ✅ 不崩溃 |

**注意**：logcat 中有 SIGSEGV，但 `Cmdline: uiautomator` —— 是
**`uiautomator dump` 工具自身**在模拟器上的崩溃，**与应用无关**。

### 打包产物

| 检查项 | 结果 |
| --- | --- |
| 必需文件齐全 | ✅ |
| `package.json` 存在 | ✅ |
| `axios` 已打包 | ✅ |
| `node_modules` 24 个包 | ✅ |
| **vendor 回退** | ❌ **崩溃**（Bug #1，已派发 B1） |

---

## 四、重复 close 的评估（未升级为 bug）

**现象**：`LibraryStore.close()` 不幂等，第二次调用抛 `database is not open`。

**为何不升级**：

| 理由 | 说明 |
| --- | --- |
| 生产代码有守卫 | `custom-server/index.mjs` 有 `shuttingDown` 标志 |
| 仅影响手动重复调用 | 正常路径不会触发 |
| 自限性 | 不会导致数据损坏 |

**建议**：作为**防御性改进**（`if (this.closed) return;`），非紧急。

---

## 五、累计 Bug 清单

| # | Bug | 严重性 | 状态 |
| --- | --- | --- | --- |
| **#1** | vendor 回退副本缺 `upstreamStats` | 中 | 已派发 **B1** (codex) |
| **#2** | `visibilitychange`/`online` 绕过 `isVideoPlaying` | 低-中 | 已派发 **B2** (antigravity) |
| **#3** | `App.tsx` 追剧页缺 `isVideoPlaying` | 低 | 已派发 **B2** (antigravity) |
| **#4** | sync-server import 即启动（顶层副作用） | 低 | 待派发 |
| #5 | `LibraryStore.close()` 不幂等 | 极低 | 建议性（不派发） |

---

## 六、排查覆盖率

| 区域 | 方法 | 覆盖 |
| --- | --- | --- |
| 编码 | 669 文件扫 U+FFFD | ✅ |
| 语法 | 148 JS 文件 `node --check` | ✅ |
| 服务端 API | 9 接口契约 + 异常路径 | ✅ |
| 预取接口 | 15 项边界 + 队列 + P6 触发 | ✅ |
| library-store | 13 项边界 | ✅ |
| PlaybackPolicy | 28 项边界 | ✅ |
| 前端运行时 | CDP 控制台 + 6 页面 + 压力 | ✅ |
| TV 运行时 | 崩溃/ANR/内存/前后台/分辨率 | ✅ |
| 打包产物 | 文件完整性 + vendor 回退 | ✅ |
| 同步服务 | 模块加载 | ⚠️ 部分（副作用干扰） |

**尚未覆盖**：Electron 桌面端运行时、真实电视（API 22，当前 offline）、
长时间稳定性（>1 小时）。

---

## 七、排查脚本（本轮新增）

```
scripts/perf/bughunt-library-store.mjs        library-store 13 项边界
scripts/perf/bughunt-close-idempotent.mjs     close 幂等性分析
scripts/perf/bughunt-p6-prefetch.mjs          P6 预取触发 6 项
scripts/perf/bughunt-tv-runtime.mjs           TV 运行时 8 项
scripts/perf/bughunt-sync-and-bundle.mjs      同步服务与打包
scripts/perf/bughunt-verify-bundle.mjs        打包覆盖核实
```
