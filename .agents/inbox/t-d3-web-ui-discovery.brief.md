# D3 Web / PC 端 UI Bug 发现

**任务 ID**: `t-d3-web-ui-discovery`
**负责人**: antigravity
**依赖**: 无（可并行）
**协调者**: dsh
**性质**: **只读发现，禁止修改任何业务代码**

---

## 一、任务目标

在 **Web / PC 端**发现 UI bug。**必须用浏览器实测（DevTools），不能只读代码。**

---

## 二、审查范围

`apps/web-pc/src/`（7 文件，4330 行）

| 文件 | 行数 | 说明 |
| --- | --- | --- |
| **`App.tsx`** | **3800** | **最大技术债** —— 单文件含 100 个 useState、24 个 useEffect |
| `api.ts` | 203 | API 封装与本地资料 |
| `types.ts` | ~150 | 类型定义 |
| `library-journal.mjs` | — | 本地事件日志 |
| `history-outbox.mjs` | — | 待同步队列 |
| `recommendation-session.mjs` | — | 推荐会话 |
| `index.css` | — | 样式 |

`shared/` 下的前端共用模块也在影响范围内（`utils.ts`、`types.ts`、`constants.ts`）。

---

## 三、可用环境

| 服务 | 地址 | 状态 |
| --- | --- | --- |
| Vite 开发页 | `http://127.0.0.1:3000` | 运行中（PID 12356） |
| 本地后端 | `http://127.0.0.1:8788` | 运行中 |

**开发页已配置代理**：`/api` → `localhost:8788`（见 `vite.config.ts`）

---

## 四、强制方法要求

> 本项目已验证教训：**只看代码会漏**。

**你必须用浏览器实际驱动界面并观察，不能只读代码。**

### 可用手段

1. **chrome-devtools-mcp**（你已具备）：
   - `navigate_page` → `http://127.0.0.1:3000`
   - `take_snapshot` / `take_screenshot` 观察 DOM 与渲染
   - `list_console_messages` 抓 console 错误
   - `list_network_requests` 抓网络异常
   - `evaluate_script` 检查状态、模拟交互
   - `click` / `fill` / `hover` 驱动交互

2. **响应式验证**：用 `resize_page` 测不同视口
   - 桌面：1920×1080
   - 平板：1024×768
   - 窄屏：768×1024
   - 手机：390×844

3. **控制台错误**：`list_console_messages` 是发现 bug 的高效入口

---

## 五、重点排查方向

### UI / 交互

1. **响应式布局**：不同视口下是否重叠、溢出、截断？
2. **播放器**：`<video>` 控件、全屏、seek、画质切换
3. **列表与网格**：滚动性能、图片加载、空态
4. **表单**：搜索框、设置项、密钥输入的校验与反馈
5. **加载态/错误态**：网络失败、超时、空数据的表现
6. **键盘操作**：Tab 顺序、Enter 提交、Esc 关闭

### 状态与数据

7. **`App.tsx` 的 100 个 useState**：是否有状态不一致、竞态？
8. **`useEffect` 依赖**：是否有缺失依赖导致的陈旧闭包？
9. **本地资料**：收藏/历史的乐观更新与回滚
10. **同步状态**：未配置/已配置/失败三态显示

### 技术债（可选，作为优化建议）

11. **`App.tsx` 3800 行**：拆分建议（这是最大技术债，值得给具体方案）

---

## 六、交付格式

写入 `.agents/shared/t-d3-web-ui-discovery-antigravity.md`。

每条发现：

```json
{
  "id": "D3-F1",
  "severity": "high | medium | low",
  "category": "ui-bug | algorithm",
  "title": "一句话",
  "location": "文件:行号",
  "evidence": "复现步骤 + 截图文件名 + console 输出",
  "verified": true,
  "impact": "...",
  "suggestion": "...",
  "effort": "small | medium | large"
}
```

**必须包含**：

1. **发现汇总表**（按 severity 排序）
2. 每条发现的**复现步骤**与证据（截图 + console/network 输出）
3. **已排查未发现问题的页面/场景**
4. **无法覆盖的区域**
5. **`App.tsx` 拆分建议**（这是明确的技术债，需给可执行方案）

---

## 七、硬性约束

1. **禁止修改任何业务代码**
2. 不执行 `git checkout` / `git reset` / `git clean`
3. 证据截图落盘 `.agents/shared/`，命名 `<任务ID>-<页面>-<状态>-<时间戳>.<ext>`
4. **区分「已核实」与「推测」**：浏览器实测的才是已核实
5. **不要把「HTTP 200」当作「功能正确」** —— 必须观察实际 DOM/渲染结果
6. 密钥、Cookie、token **不入报告**

---

## 八、验收标准

1. 报告含**发现汇总表**，每条有精确 `文件:行号`
2. **至少 3 条 `verified: true`**（有浏览器实测证据）
3. 至少覆盖 **2 种视口**的响应式验证
4. 明确列出「已排查未发现问题」与「无法覆盖」的区域
5. 含 `App.tsx` 拆分建议
6. 报告写入 `.agents/shared/t-d3-web-ui-discovery-antigravity.md`

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-d3-web-ui-discovery antigravity "结论及报告路径"
```
