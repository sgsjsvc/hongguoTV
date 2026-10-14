# R5 Web/PC 交互缺陷修复

**任务 ID**: `t-r5-web-interaction`
**负责人**: antigravity
**依赖**: 无（可并行）
**协调者**: dsh

---

## 一、修复目标

修复 D3 发现的 3 项 Web/PC 交互缺陷，**全部集中在 `App.tsx`**：

| 发现 | 严重度 | 标题 |
| --- | --- | --- |
| **D3-F2** | medium | useEffect 依赖混乱导致 API 重复并发请求 2~4 次 |
| **D3-F3** | medium | PC 播放弹窗缺 Escape 键盘退出 |
| **D3-F4** | medium | 搜索防抖缺请求代际控制，有竞态覆盖风险 |

**详见**：`.agents/shared/t-d3-web-ui-discovery-antigravity.md`

---

## 二、逐项修复

### D3-F2 重复请求

**位置**：`App.tsx:300-342`

**硬证据**（DevTools 抓包）：

```
reqid=23 GET /api/category/tags?type=real-drama [200]
reqid=25 GET /api/category/tags?type=real-drama [200]  <-- 重复
reqid=28 GET /api/category/tags?type=real-drama [200]  <-- 第3次
reqid=30 GET /api/category/tags?type=real-drama [200]  <-- 第4次
```

**根因**：挂载时 `loadCategoryTags()`（:302）与监听 `selectedCatType` 的 useEffect（:363）重复触发；`refreshLibrary()`（:340）在多依赖变动时反复触发。

**建议**：规范数据拉取时机，消除冗余 useEffect；对全量同步请求引入防抖或单例 Promise 缓存。

---

### D3-F3 缺 Escape 退出

**位置**：`App.tsx:1080-1202`（播放弹窗）

**建议**：为播放弹窗添加 `Escape` 键关闭支持。

---

### D3-F4 搜索竞态

**位置**：`App.tsx:641-692`

**问题**：防抖联想与最终搜索缺请求代际控制，慢响应可能覆盖新结果。

**建议**：引入请求序号（generation）或 `AbortController`，丢弃过期响应。

---

## 三、硬性约束

1. **只改 `apps/web-pc/src/App.tsx`**
2. **不要改 `index.html` / `public/`**（R6 负责）
3. **不要开始拆分文件**（R7 负责）
4. **不要回退**工作区其他改动
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

1. **D3-F2**：冷启动后 `/api/category/tags` 等接口**请求次数降至 1 次**（DevTools 抓包证明）
2. **D3-F3**：播放弹窗按 `Escape` 可关闭（浏览器实测）
3. **D3-F4**：快速输入时**无过期响应覆盖**（构造慢响应验证）
4. `npm run typecheck`、`npm run build` 通过
5. `npm test` 通过
6. 报告写入 `.agents/shared/t-r5-web-interaction-antigravity.md`

---

## 五、验证环境

| 服务 | 地址 |
| --- | --- |
| Vite 开发页 | `http://127.0.0.1:3000` |
| 本地后端 | `http://127.0.0.1:8788` |

**必须用浏览器实测**（chrome-devtools-mcp），不能只读代码。

**关键**：`list_network_requests` 是验证 D3-F2 的决定性工具。

---

## 六、证据要求

- **D3-F2**：修复前后的网络请求列表对比
- **D3-F3/F4**：浏览器实测截图或 console 输出
- 证据三件套（截图 + 输出落盘 + 命令原文）

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r5-web-interaction antigravity "结论及报告路径"
```
