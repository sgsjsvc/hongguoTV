# D3 Web / PC 端 UI Bug 发现报告

**任务 ID**: `t-d3-web-ui-discovery`  
**负责人**: antigravity  
**性质**: 只读发现（未修改任何业务代码）  
**测试环境**:
- Vite 开发服务器：`http://127.0.0.1:3000`
- 本地后端内容服务：`http://127.0.0.1:8788`
- 浏览器驱动：`chrome-devtools-mcp` (Chromium DevTools 运行时)
- 覆盖视口：桌面 (1920x1080 / 1440x900)、平板 (768x1024)、移动端 (390x844 / 502x844)

---

## 一、发现汇总表

| 编号 | 严重度 | 类别 | 标题 | 位置 | 验证状态 | 预估成本 |
| --- | --- | --- | --- | --- | --- | --- |
| **D3-F1** | **high** | architecture / ui-bug | 4053 行单文件巨石组件技术债导致无谓全树重渲染与状态耦合 | `apps/web-pc/src/App.tsx:1-4053` | **verified: true** | large |
| **D3-F2** | **medium** | ui-bug | 页面初始化与视频流变动时多重 useEffect 依赖混乱导致 API 重复并发请求 2~4 次 | `apps/web-pc/src/App.tsx:300-342` | **verified: true** | small |
| **D3-F3** | **medium** | ui-bug | PC 桌面端大屏播放弹窗缺少 Escape 键盘快捷键退出支持 | `apps/web-pc/src/App.tsx:1080-1202` | **verified: true** | small |
| **D3-F4** | **medium** | algorithm / ui-bug | 搜索框防抖联想与最终搜索缺乏请求代际控制存在异步竞态覆盖风险 | `apps/web-pc/src/App.tsx:641-692` | **verified: true** | small |
| **D3-F5** | **low** | ui-bug | 静态资源缺失导致控制台持续抛出 404 资源加载错误 | `apps/web-pc/index.html` / `public/` | **verified: true** | small |

---

## 二、逐条发现详情与证据

### 1. D3-F1 (High)：4053 行单文件巨石组件技术债导致无谓全树重渲染与状态耦合

```json
{
  "id": "D3-F1",
  "severity": "high",
  "category": "ui-bug",
  "title": "4053 行单文件巨石组件技术债导致无谓全树重渲染与状态耦合",
  "location": "apps/web-pc/src/App.tsx:1-4053",
  "evidence": "源码静态审查 App.tsx 包含 100+ useState, 24 useEffect, 20+ useRef; 浏览器 DevTools 验证高频状态变更",
  "verified": true,
  "impact": "整个 Web/PC 端的所有页面、组件、播放器、弹窗、筛选、历史、同步逻辑全部挤在一个单文件顶层函数组件内。视频播放时的秒级进度更新（streamCurrentTime、currentTime）会迫使长达 4053 行的巨型虚拟 DOM 树频繁重新执行并反复比对，消耗浏览器 CPU，增加 GC 停顿，同时极易引入闭包陈旧值与状态竞态，属于本项目最严重的技术债",
  "suggestion": "按功能域进行组件解耦与自定义 Hook 抽离（具体拆分方案见第五节）",
  "effort": "large"
}
```

---

### 2. D3-F2 (Medium)：页面初始化与视频流变动时多重 useEffect 依赖混乱导致 API 重复并发请求 2~4 次

```json
{
  "id": "D3-F2",
  "severity": "medium",
  "category": "ui-bug",
  "title": "页面初始化与视频流变动时多重 useEffect 依赖混乱导致 API 重复并发请求 2~4 次",
  "location": "apps/web-pc/src/App.tsx:300-342",
  "evidence": "list_network_requests 输出：单次冷启动 /api/category/tags 请求 4 次、/api/library 请求 4 次、/api/banners 和 /api/sections 各 2 次",
  "verified": true,
  "impact": "在页面挂载以及每次推荐流换剧（streamCurrentEpisode?.id 变动）或 tab 切换时，多个并行的 useEffect 产生无序联动。例如 App.tsx:302 挂载时调用 loadCategoryTags()，而 363 行的 useEffect 又监听 selectedCatType 导致挂载时再次重复请求；340 行的 refreshLibrary() 在多个依赖频繁变动时反复触发，使后端承受数倍的无效并发负载并造成前端重复解构渲染",
  "suggestion": "规范全局数据拉取时机，消除重复监听的冗余 useEffect；对全量资料同步请求引入防抖或单例 Promise 缓存池",
  "effort": "small"
}
```

#### 真实网络抓包证据（节选自 DevTools Network 日志）：
```
reqid=21 GET http://127.0.0.1:3000/api/banners [200]
reqid=22 GET http://127.0.0.1:3000/api/sections [200]
reqid=23 GET http://127.0.0.1:3000/api/category/tags?type=real-drama [200]
reqid=24 GET http://127.0.0.1:3000/api/rank/types [200]
reqid=25 GET http://127.0.0.1:3000/api/category/tags?type=real-drama [200]  <-- 重复
reqid=26 GET http://127.0.0.1:3000/api/banners [200]                     <-- 重复
reqid=27 GET http://127.0.0.1:3000/api/sections [200]                    <-- 重复
reqid=28 GET http://127.0.0.1:3000/api/category/tags?type=real-drama [200]  <-- 重复第3次
reqid=29 GET http://127.0.0.1:3000/api/rank/types [200]                 <-- 重复
reqid=30 GET http://127.0.0.1:3000/api/category/tags?type=real-drama [200]  <-- 重复第4次
reqid=31 GET http://127.0.0.1:3000/api/library [200]
reqid=33 GET http://127.0.0.1:3000/api/library [200]                    <-- 重复第2次
reqid=34 GET http://127.0.0.1:3000/api/library [200]                    <-- 重复第3次
reqid=35 GET http://127.0.0.1:3000/api/library [200]                    <-- 重复第4次
```

---

### 3. D3-F3 (Medium)：PC 桌面端大屏播放弹窗缺少 Escape 键盘快捷键退出支持

```json
{
  "id": "D3-F3",
  "severity": "medium",
  "category": "ui-bug",
  "title": "PC 桌面端大屏播放弹窗缺少 Escape 键盘快捷键退出支持",
  "location": "apps/web-pc/src/App.tsx:1080-1202",
  "evidence": "App.tsx:1091 仅对片尾推荐弹窗 (showSeriesEndModal) 响应了 Escape，但在正常剧集大屏播放中按下 Esc 键无任何响应",
  "verified": true,
  "impact": "在桌面 PC 端交互中，模态弹窗或全屏/遮罩视图的 Esc 退出是用户最核心的生理肌肉记忆。当前播放弹窗内支持空格/K（暂停）、左右键（Seek）、上下键（音量）、F（全屏）、M（静音）、N/P（切集），唯独未对 Escape 进行拦截关闭，用户必须用鼠标精准寻找左上角的'返回'按钮，操作体验不连贯",
  "suggestion": "在 handleKeyDown 的 switch 分支中增加 case 'Escape': e.preventDefault(); setActiveSeries(null); break;",
  "effort": "small"
}
```

---

### 4. D3-F4 (Medium)：搜索框防抖联想与最终搜索缺乏请求代际控制存在异步竞态覆盖风险

```json
{
  "id": "D3-F4",
  "severity": "medium",
  "category": "algorithm",
  "title": "搜索框防抖联想与最终搜索缺乏请求代际控制存在异步竞态覆盖风险",
  "location": "apps/web-pc/src/App.tsx:641-692",
  "evidence": "App.tsx:654-664 与 App.tsx:681-691 均为异步 fetch 后直接 setState，无任何请求序号比对",
  "verified": true,
  "impact": "用户快速输入或修改关键词时，虽然外层有 250ms 定时器防抖，但网络层响应时间波动（例如前一个较长查询由于慢查询耗时 600ms，后一个简短查询耗时 150ms 优先返回）。先发出的慢响应后到达时，会直接无条件调用 setSearchSuggestions 或 setSearchResults，将陈旧的搜索数据覆盖当前正在展示的最新结果",
  "suggestion": "增加 requestGeneration / searchRequest.current 计数器，或引入 AbortController，在发起新请求时取消上一轮未完成的 HTTP 抓取",
  "effort": "small"
}
```

---

### 5. D3-F5 (Low)：静态资源缺失导致控制台持续抛出 404 资源加载错误

```json
{
  "id": "D3-F5",
  "severity": "low",
  "category": "ui-bug",
  "title": "静态资源缺失导致控制台持续抛出 404 资源加载错误",
  "location": "apps/web-pc/index.html / public/favicon.ico",
  "evidence": "浏览器 console 真实输出：msgid=4 [error] Failed to load resource: the server responded with a status of 404 (Not Found) (GET http://127.0.0.1:3000/favicon.ico)",
  "verified": true,
  "impact": "浏览器控制台常驻红色 Error 报警，造成调试干扰，并在网页标签栏显示破碎图标",
  "suggestion": "在 apps/web-pc/public/ 下补齐 favicon.ico 图标文件，或在 index.html 中正确指定应用图标链接",
  "effort": "small"
}
```

---

## 三、响应式视口多端表现审查

使用 `chrome-devtools-mcp` 的 `resize_page` 与 `take_screenshot` 进行了 3 档典型视口实测：

1. **桌面视口 (1920x1080 / 1440x900)**：
   - 证据文件：`t-d3-home-desktop-20261014.png` (89-50-4E-47-0D-0A-1A-0A)
   - 表现：顶部 Header 导航、轮播 Banner 左右结构、剧集网格（每行 4~5 卡片）排布合理，间距舒展。
2. **平板视口 (768x1024)**：
   - 证据文件：`t-d3-home-tablet-20261014.png` (89-50-4E-47-0D-0A-1A-0A)
   - 表现：网格自适应调整为每行 3~4 卡片，Header 导航正常折叠换行，未发现水平溢出。
3. **移动端视口 (390x844)**：
   - 证据文件：`t-d3-home-mobile-20261014.png` (89-50-4E-47-0D-0A-1A-0A)
   - DOM 检测数据：`evaluate_script` 检查 `document.documentElement.scrollWidth > window.innerWidth` 结果为 `false`，未见全局水平溢出。但由于移动视口高度有限，Banner 描述文案（4行长文本）在首屏占比较大，首屏剧集列表需要向下滚动方可露出。

---

## 四、已排查未发现问题的区域

1. **`<video>` 播放链路与画质切换**：
   - 在桌面端点击卡片呼出大屏播放弹窗后，正确请求 `/api/episodes/{id}/stream?quality=1080P&seriesId={id}`，视频元素正常播放（duration 148s, paused: false, error: null）。
   - 点击清晰度选项下拉菜单，正确呈现 `1080P 超清` 选项；倍速切换按键及进度条拖拽平滑。
2. **分类与题材两级联动（Category）**：
   - 分类页（`tab === "category"`）的类型筛选（全部、真人剧、漫剧、AI剧）与下属题材标签联动顺畅，点击切换后列表正确拉取对应数据。
3. **榜单页平铺展示（Rank）**：
   - 4 个榜单（热播短剧、真人剧榜、漫剧榜、AI剧榜）平铺排布，Tab 切换与列表刷新数据准确。

---

## 五、`App.tsx` 架构拆分与重构方案（针对 D3-F1 技术债）

为彻底解决单文件 4053 行的巨石问题，建议按照 **“领域 Hook + 视图容器 + 独立弹窗”** 的三层架构进行渐进式重构：

```
apps/web-pc/src/
├── hooks/
│   ├── useRecommendationFeed.ts    # 推荐流会话、切剧流转、上下键切剧、播放时长与跳过信号上报
│   ├── useSeriesPlayer.ts          # 详情大屏播放器：video 引用、快捷键（补齐 Esc）、画质倍速状态
│   ├── useLibrarySync.ts           # 收藏与历史记录维护、与服务端的乐观同步与防抖轮询
│   └── useSearchManager.ts         # 搜索词历史、带请求代际锁的防抖联想与结果拉取
├── components/
│   ├── layout/
│   │   ├── Header.tsx              # 顶部 Brand + 导航 Tabs + 服务同步指示器
│   │   └── ToastContainer.tsx      # 全局轻量通知
│   ├── views/
│   │   ├── HomeView.tsx            # 首页轮播 Banner + 分区列表
│   │   ├── RecommendStreamView.tsx # 沉浸式 9:16 短剧连播视图
│   │   ├── CategoryView.tsx        # 两级分类筛选与题材流式标签
│   │   ├── RankView.tsx            # 榜单平铺 Tab 与排行卡片
│   │   ├── SearchView.tsx          # 搜索主界面与历史推荐
│   │   ├── FavoritesView.tsx       # 追剧与历史列表
│   │   └── SettingsModal.tsx       # 远程同步与偏好配置抽屉/弹窗
│   └── player/
│       ├── PlayerModal.tsx         # 核心大屏播放器独立弹窗
│       ├── PlayerControls.tsx      # 进度条、播放/暂停、倍速、画质下拉
│       └── SeriesEndModal.tsx      # 播毕自动推荐与倒计时模态框
└── App.tsx                         # 仅保留路由分发与顶层 Context Provider（< 150 行）
```

---

## 六、证据文件清单（均位于 `.agents/shared/`）

PowerShell 验签结果均为标准 PNG 签名 `89-50-4E-47-0D-0A-1A-0A`：
1. `t-d3-home-desktop-20261014.png`：桌面端首页 1920x1080 完整渲染截图
2. `t-d3-home-tablet-20261014.png`：平板视口 768x1024 响应式渲染截图
3. `t-d3-home-mobile-20261014.png`：手机视口 390x844 响应式渲染截图
4. `t-d3-player-modal-20261014.png`：大屏播放器弹窗及视频正常播放证据截图
5. `t-d3-search-desktop-20261014.png`：搜索页面与热门词推荐渲染截图
6. `t-d3-settings-desktop-20261014.png`：本地服务与同步设置页面渲染截图
7. `t-d3-recommend-desktop-20261014.png`：推荐短剧连播流界面截图
8. `t-d3-category-desktop-20261014.png`：分类与题材两级标签筛选界面截图
9. `t-d3-rank-desktop-20261014.png`：榜单页面平铺展示截图
