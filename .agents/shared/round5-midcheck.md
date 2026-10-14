# 第五轮中期检查报告

**协调者**: dsh
**时间**: 2026-10-14 16:20
**状态**: 9/12 完成，R7 进行中，R11/R12 待办

---

## 一、进度

| # | 任务 | 负责人 | 状态 |
| --- | --- | --- | --- |
| R1 | 播放链路 P0 | codex | ✅ `done` |
| R2 | TV 焦点与导航 | antigravity | ✅ `done` |
| R3 | 抽屉 Tab 抢焦 | antigravity | ✅ `done` |
| R4 | Manifest 屏幕配置 | antigravity | ✅ `done` |
| R5 | Web 交互缺陷 | antigravity | ✅ `done` |
| R6 | Web 静态资源 | antigravity | ✅ `done` |
| **R7** | **拆分 App.tsx** | antigravity | 🔄 `claimed`（进行中） |
| R8 | 历史存储时序 | workbuddy | ✅ `done` |
| R9 | 导入性能与事务 | workbuddy | ✅ `done` |
| R10 | 资料库性能 | workbuddy | ✅ `done` |
| R11 | 播放接口正确性 | codex | ⏳ 就绪待认领 |
| R12 | 引擎结构优化 | codex | ⛔ 阻塞于 R11 |

---

## 二、协调者独立验证

### 2.1 R1 的 P0 修复（协调者引入的回归）

**D1-F1 已修复**，实现正确：

```javascript
// shared/content-core/hongguo.js:689-718
async function remoteRange(stream, start, end, signal) {
    // Capture targets before awaiting: another Range request can switch this shared stream.
    const primaryUrl = stream.url; const backupUrl = stream.backupUrl;   // ← 局部快照
    ...
    if (stream.url === primaryUrl) {                                      // ← 条件写回
        stream.url = backupUrl;
        if (stream.backupUrl === backupUrl) stream.backupUrl = '';
    }
```

**D1-F2 已修复**：

```javascript
// custom-server/index.mjs
768: const controller = new AbortController();
769: const cancel = () => controller.abort();
829: if (res.headersSent) {
830:     res.destroy();          // ← D1 建议的「已发送头后销毁响应」
836: controller.abort();        // ← 取消上游下载
```

### 2.2 证据链验证（协调者实跑）

| 项 | 结果 |
| --- | --- |
| 修复前基线（`t-r1-playback-p0-before.log`） | `pass 1 / fail 9` |
| 修复后（协调者独立运行） | **`pass 10 / fail 0`** |

**R1 提供了新增回归测试**（`t-r1-playback-p0.test.mjs`，10 项），已独立运行验证通过。

### 2.3 TV 端修复核实

| 发现 | 实现 | 判定 |
| --- | --- | --- |
| D2-F1 | `dispatchKeyEvent` 中 `currentFocus is EditText` → 交还系统 | ✅ 正确 |
| D2-F2 | `hideChrome` 检查 `isNavFocused`，有焦点则延长 5 秒 | ✅ 正确 |
| D2-F2 配套 | `focusPlayback(force = false)` 有用户焦点则不夺焦 | ✅ 正确 |
| D2-F5 | `configChanges` 补 `screenLayout\|smallestScreenSize\|uiMode\|density` | ✅ 完整 |

### 2.4 R10 量化成果（workbuddy 报告）

| 指标 | 修复前 | 修复后 | 变化 |
| --- | --- | --- | --- |
| `pending()` @1500 条 | 0.566–0.605 ms | **0.019–0.022 ms** | **约 28×** |
| `library_ack` 行数 | 1500 | **0** | 有界 |
| `snapshot()` @3000 条 | 5.79–6.53 ms | **3.29–3.67 ms** | 约 1.8× |
| F6 `lastTime` 回退 | 回退到 500 | **保持 1000** | 修复 |

---

## 三、协调者发现的问题

### P1（需清理）R2 遗留 3 处调试日志

`MainActivity.kt` 中新增了 3 处 `android.util.Log.d("TvFocus", ...)`：

| 行 | 内容 | 影响 |
| --- | --- | --- |
| 627 | `hideChrome check: isNavFocused=...` | 每次定时器触发都打 |
| **1335** | `onKeyDown: keyCode=...` | **每次按键都打**，污染 logcat |
| 1379 | `collectionButton.requestFocus returned ...` | 每次请求焦点都打 |

**判定**：调试遗留物，应在收尾任务中清理。第 1335 行尤其影响性能与日志可读性。

### P2（已处置）临时脚本散落在仓库根目录

antigravity 的 7 个验证脚本（`verify-r4.mjs` 等）散落在**仓库根目录**，且**未被 `.gitignore` 覆盖**，会被误提交。

**已处置**：协调者移入 `.agents/shared/scripts/`（保留可追溯性，不污染仓库根）。

```
generate-favicons.mjs   test-drawer-dpad.mjs   test-open-drawer.mjs
verify-r3-full.mjs      verify-r3-open.mjs     verify-r4-search.mjs
verify-r4.mjs
```

### P3（观察）R7 进度

`App.tsx` 从 **4053 → 3858 行**，已拆出 9 个文件（共 2171 行）：

| 文件 | 行数 |
| --- | --- |
| `components/RecommendStream.tsx` | 604 |
| `components/SearchPanel.tsx` | 349 |
| `components/LibraryPanel.tsx` | 291 |
| `components/RankPanel.tsx` | 205 |
| `components/CategoryPanel.tsx` | 201 |
| `components/SettingsPanel.tsx` | 191 |
| `components/HomePanel.tsx` | 178 |
| `components/Header.tsx` | 146 |
| `utils/format.ts` | 6 |

**进展合理但未完成**（目标 `< 800` 行）。锁创建于 16:10，尚在进行中。

### P4（提示）R1 新增测试未纳入正式测试目录

R1 的 10 项回归测试放在 `.agents/shared/`，**`npm test` 不会自动运行**。

R1 报告已如实说明，并建议协调者授权后纳入 `tests/`。

**建议**：R1 是 P0 修复，其回归测试应纳入正式测试集，防止将来回归。

---

## 四、待办

| 项 | 说明 |
| --- | --- |
| R7 | 进行中，等待完成 |
| R11 | 就绪，待 codex 认领 |
| R12 | 阻塞于 R11 |
| **收尾任务** | 清理 R2 调试日志 + 纳入 R1 测试（见第五节） |

---

## 五、建议新增收尾任务

| ID | 内容 | 负责人 |
| --- | --- | --- |
| **R13** | 清理 R2 遗留调试日志 + 将 R1 回归测试纳入 `tests/` | antigravity 或 codex |

**理由**：

- 调试日志会污染生产日志，第 1335 行每次按键都打
- R1 的 P0 回归测试不纳入正式测试集，将来可能重新引入 D1-F1

---

## 六、状态

工作区有大量未提交改动（第五轮 9 项修复）。**待 R7/R11/R12 完成后再统一入库。**
