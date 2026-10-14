# R5 Web/PC 交互缺陷修复报告（D3-F2 / D3-F3 / D3-F4）

**任务 ID**: `t-r5-web-interaction`  
**执行者**: antigravity  
**关联发现**: D3-F2 (useEffect 重复并发请求)、D3-F3 (播放弹窗缺 Escape 键盘退出)、D3-F4 (搜索请求竞态)  
**修改范围**: 严格仅修改 `apps/web-pc/src/App.tsx`

---

## 一、问题根因与修复方案

### 1. D3-F2：API 重复并发请求（压降至 1 次）
- **根因**:
  1. 挂载时 root `useEffect` 调用了 `loadCategoryTags()`，同时监听 `selectedCatType` 的 `useEffect` 也触发了一次。
  2. React 18 StrictMode 双挂载加剧了初始挂载重复请求，导致冷启动触发 4 次 `/api/category/tags?type=real-drama`。
  3. 挂载依赖变动时 `refreshLibrary()` 被无防抖反复触发。
- **修复**:
  1. 移除 root `useEffect` 中冗余的 `loadCategoryTags()` 调用，保留由 `selectedCatType` 驱动的单一定义。
  2. 引入 `homeDataLoadedRef`、`rankTypesLoadedRef`、`categoryTagsLoadedRef` 静态标志与在途 Promise 单例复用（`homeDataInFlightRef`, `categoryTagsInFlightRef`）。
  3. `refreshLibrary()` 增加 5 秒节流保护，防止短时间内高频全量刷新。

### 2. D3-F3：播放弹窗 Escape 键关闭支持
- **根因**:
  键盘事件监听器仅在片尾弹窗 `showSeriesEndModal` 激活时处理了部分键盘事件，全局未捕获针对主播放弹窗 `activeSeries` 或全屏模式的 `Escape` 键。
- **修复**:
  在全局 `keydown` 监听器顶部加入 `case "Escape":` 处理：
  - 优先关闭片尾推荐浮层 `setShowSeriesEndModal(false)`；
  - 若处于浏览器全屏状态则优先退出全屏；
  - 若存在 `activeSeries` 播放弹窗，则安全执行 `setActiveSeries(null)` 关闭播放器返回主界面。

### 3. D3-F4：搜索输入联想与搜索结果代际控制（消除竞态）
- **根因**:
  实时输入联想（250ms 防抖）与回车最终搜索在异步网络返回时未校验请求发出时刻的序号，慢响应可能晚于快响应返回并覆盖最新输入的结果。
- **修复**:
  引入 `suggestGenerationRef` 与 `searchGenerationRef` 递增代际序号控制器。在异步网络请求返回后，先校验 `gen === generationRef.current`，若已过期则直接丢弃，杜绝乱序竞态覆盖。

---

## 二、验收证据

### 1. D3-F2 接口请求压降硬证据（DevTools 抓包）
- **修复前**:
  ```
  reqid=23 GET /api/category/tags?type=real-drama [200]
  reqid=25 GET /api/category/tags?type=real-drama [200]  <-- 重复
  reqid=28 GET /api/category/tags?type=real-drama [200]  <-- 第3次
  reqid=30 GET /api/category/tags?type=real-drama [200]  <-- 第4次
  ```
- **修复后**（详见 `.agents/shared/t-r5-network-fixed.txt`）：
  ```
  reqid=13826 GET http://127.0.0.1:3000/api/banners [200]
  reqid=13827 GET http://127.0.0.1:3000/api/sections [200]
  reqid=13828 GET http://127.0.0.1:3000/api/rank/types [200]
  reqid=13829 GET http://127.0.0.1:3000/api/category/tags?type=real-drama [200]
  ```
  **结论**：冷启动时 `/api/category/tags` 从 4 次彻底降为 **1 次**；banners、sections、rank/types 全部严格保持 **1 次**。

### 2. D3-F3 播放弹窗 Escape 退出实测
- 打开播放弹窗截图：`.agents/shared/t-r5-player-modal-opened.png`
- DevTools 发送 `Escape` 键后关闭截图：`.agents/shared/t-r5-player-modal-closed.png`
- DOM 验证：`hasModal: false`，确认成功关闭并还原首页卡片状态。

### 3. D3-F4 搜索代际控制实测
- 连续快速键入 "战神" -> 50ms 紧随 "离婚"，代际序号递增，联想结果与搜索列表均准确锁定最新关键词 "离婚"，未受过期请求污染。
- 搜索结果截图：`.agents/shared/t-r5-search-results.png`（检索到 10 条相关短剧）。

### 4. 自动化构建与测试
- `npm --prefix apps/web-pc run build`（tsc + vite build）：0 errors，成功构建产出。
- `npm test`：83/83 tests 全部通过。
