# Bug 排查报告（第二轮系统性排查）

**排查方**: dsh
**日期**: 2026-10-16
**范围**: 全仓库（静态 + 边界 + 契约 + 实测）
**方法**: 自动化脚本 + 真实浏览器/设备实测

---

## 一、确认的 Bug（3 个）

### 🔴 Bug #1：vendor 回退副本缺 `upstreamStats`，回退路径崩溃

**严重性**: 中
**位置**:
- `custom-server/vendor/hongguo.cjs`
- `server/vendor/hongguo.cjs`

**证据**（可复现）:

```javascript
// custom-server/index.mjs:91-92 的回退逻辑
const sharedEngine = new URL("../shared/content-core/hongguo.js", import.meta.url);
const cjsPath = fs.existsSync(sharedEngine) ? sharedEngine : new URL("./vendor/hongguo.cjs", ...);

// 第 114 行导出
source + "\nthis.api = {fetchVideoInfo, ..., rankData, upstreamStats};"
//                                                              ^^^^^^^^^^^^^^ vendor 未定义
```

**实测**:

```
✗ vendor 加载失败: upstreamStats is not defined
```

**影响**:

| 场景 | 结果 |
| --- | --- |
| 正常（shared 存在） | ✅ 不受影响 |
| **回退（shared 缺失/损坏）** | ❌ **崩溃** |

**即：回退保险在最需要它的时候不可用。**

**已在打包产物中复现**（`outputs/bundles/hongguotv-web-win-x64`）。

**附加问题**：vendor 还缺 `requestVideoModel` 的空体重试逻辑，
且仍保留已删除的死代码 `videoModelUrl`。

---

### 🟡 Bug #2：`visibilitychange`/`online` 绕过 `isVideoPlaying` 检查

**严重性**: 低-中
**位置**: `apps/web-pc/src/api.ts:112-124`（visibilitychange）、`:126-129`（online）

**证据**:

```javascript
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    backoffMs = 10000;
    void refreshLibrary().catch(() => {});   // ← 未检查 isVideoPlaying
    scheduleNextPoll(10000);
  }
  ...
});
window.addEventListener("online", () => {
  backoffMs = 10000;
  void refreshLibrary().catch(warning);      // ← 同样未检查
  ...
});
```

**对比**：`scheduleNextPoll` 内部**有**检查（`:95-98`）：

```javascript
if (isVideoPlaying()) {
  scheduleNextPoll(10000);
  return;                                    // ← 播放时跳过
}
```

**影响**：用户切到其他窗口再切回时，若视频正在播放，
会**立即发起一次 `refreshLibrary`**，与视频流争用。

**与设计意图不符**（P5 的目标之一就是「播放时不争用」）。

---

### 🟡 Bug #3：`App.tsx` 追剧页轮询缺 `isVideoPlaying` 检查

**严重性**: 低
**位置**: `apps/web-pc/src/App.tsx:165-170`

**证据**:

```javascript
useEffect(() => {
  if (tab !== "favorites" || activeSeries) return;
  void library.refreshHistory();
  const timer = setInterval(() => {
    if (document.hidden) return;             // ← 有 hidden 检查
    void library.refreshHistory();           // ← 缺 isVideoPlaying 检查
  }, 10000);
  return () => { clearInterval(timer); };
}, [tab, activeSeries]);
```

**对比**：`api.ts` 的轮询**有** `isVideoPlaying` 检查。

**影响**：用户在追剧页播放视频时，每 10 秒仍会 `refreshHistory`。

**且两处实现不一致**，维护性差。

---

## 二、已排除的候选问题（非 bug）

排查过程中发现 6 个「疑似 bug」，经独立验证后**全部排除**：

| # | 候选 | 排除理由 |
| --- | --- | --- |
| 1 | 预取队列 429 不恢复 | **我的测试脚本缺陷**（提交 48 个目标超上限 32） |
| 2 | 无效 ID 卡住队列 | 实测 4.1 秒正常失败并释放 |
| 3 | `operations` 空数组返回 400 | 前端**从不发送数组**，400 是正确行为 |
| 4 | 片尾倒计时无清理 | 代码**实际有** `return () => clearInterval`，我的正则漏匹配 |
| 5 | 播放未推进 | **浏览器自动播放策略**（`NotAllowedError: user didn't interact`） |
| 6 | 收藏状态未变化 | **我点的是顶部导航**（`tv-nav-item`），不是播放器收藏按钮 |

**教训**：验证前必须确认测试方法正确，否则会把**测试缺陷误报为产品缺陷**。

---

## 三、已验证正确的部分

| 区域 | 验证方式 | 结果 |
| --- | --- | --- |
| 编码 | 全仓库 669 个文件扫 U+FFFD | ✅ 0 个乱码 |
| 语法 | 148 个 JS 文件 `node --check` | ✅ 0 个错误 |
| **PlaybackPolicy 边界** | 28 项边界测试 | ✅ **全部正确** |
| 服务端异常路径 | 非法 ID / Range / 并发 / 中断 | ✅ 健壮 |
| API 契约 | 9 个接口结构核对 | ✅ 字段齐全 |
| 前端运行时 | CDP 捕获控制台错误 + 6 页面导航 + 15 次快速切换 | ✅ 0 异常 |
| TV 资源管理 | `onDestroy` 清理核对 | ✅ `artwork.close()` + `localContent.close()` |
| 预取接口 | 15 项边界测试 | ✅ 输入校验、取消、容量、状态一致 |

**测试总数**: 161 项全部通过（从 144 增至 161）。

---

## 四、修复任务建议

| # | Bug | 负责方 | 工作量 |
| --- | --- | --- | --- |
| **B1** | vendor 回退副本同步 | **codex** | 小（同步 + 加测试） |
| **B2** | `visibilitychange`/`online` 加 `isVideoPlaying` | **antigravity** | 小 |
| **B3** | `App.tsx` 追剧页加 `isVideoPlaying` + 提取共享函数 | **antigravity** | 小 |

**B2 与 B3 可合并**（同一文件区域，且都需要提取 `isVideoPlaying` 为共享函数）。

---

## 五、预防措施建议

| # | 措施 | 理由 |
| --- | --- | --- |
| 1 | **加 vendor 同步测试** | 当前无测试覆盖回退路径 |
| 2 | **提取 `isVideoPlaying` 为共享工具** | 避免多处实现不一致 |
| 3 | **构建时校验 vendor 与 shared 符号一致** | 防止再次出现缺符号 |
| 4 | **轮询统一走单一实现** | 避免「改了 api.ts 忘了 App.tsx」 |

---

## 六、测量脚本清单

本轮新增的排查脚本（均入库，可复现）：

```
scripts/perf/bughunt-prefetch.mjs           预取接口 15 项边界
scripts/perf/bughunt-prefetch-queue.mjs     队列恢复能力
scripts/perf/bughunt-invalid-id.mjs         无效 ID 影响
scripts/perf/bughunt-p5-visibility.mjs      P5 事件路径分析
scripts/perf/bughunt-engine-sync.mjs        引擎副本差异
scripts/perf/bughunt-vendor2.mjs            vendor 回退可用性
scripts/perf/bughunt-server.mjs             服务端异常路径
scripts/perf/bughunt-frontend.mjs           前端控制台错误捕获
scripts/perf/bughunt-logic.mjs              前端功能逻辑
scripts/perf/bughunt-confirm.mjs            候选问题确认
scripts/perf/bughunt-playback-policy.mjs    PlaybackPolicy 28 项边界
scripts/perf/bughunt-polling-consistency.mjs 轮询一致性
scripts/perf/bughunt-contract.mjs           API 契约
scripts/perf/bughunt-bundle-vendor.mjs      打包产物 vendor
```
