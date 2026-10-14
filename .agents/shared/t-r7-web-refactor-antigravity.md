# R7 拆分 App.tsx 单文件巨石组件 验收报告

**任务 ID**: `t-r7-web-refactor`  
**执行人**: antigravity  
**状态**: 完成并通过全绿验收  
**对应问题**: D3-F1（high）：`apps/web-pc/src/App.tsx` 4,112 行单文件巨石组件  

---

## 一、重构概览与行数对比

### 1.1 核心行数变化
- **重构前 `App.tsx` 行数**: **4,112 行**（包含 100+ useState、24 useEffect、20+ useRef）
- **重构后 `App.tsx` 行数**: **682 行**（削减 **3,430 行**，缩减幅度达 **83.4%**，远低于 < 800 行的目标上限）
- **定位转型**: 从混杂所有网络请求、UI渲染、播放器逻辑、流式推荐、快捷键的“全知巨石”，转变为职责清晰的**顶层编排与路由调度层**。

### 1.2 模块化架构拆分清单

#### 自定义 Hooks（抽离状态与业务逻辑）
1. `apps/web-pc/src/hooks/useLibrary.ts` (59 行): 收藏、播放历史与搜索历史的状态管理、本地存储与持久化通知。
2. `apps/web-pc/src/hooks/useCatalog.ts` (178 行): 首页 Banners / Sections、全量题材分类与榜单拉取，**保留 D3-F2 单例防重复请求与在途 Promise 缓存保护**。
3. `apps/web-pc/src/hooks/useSync.ts` (39 行): 偏好设置、同步开关与远程凭据状态。
4. `apps/web-pc/src/hooks/useSearch.ts` (128 行): 搜索防抖与联想、**严格保留 D3-F4 递增代际序号与过期请求抛弃逻辑**。
5. `apps/web-pc/src/hooks/usePlayback.ts` (362 行): 弹窗播放核心控制、清晰度/倍速切换、推荐池轮换与片尾倒计时。
6. `apps/web-pc/src/hooks/useStreamFeed.ts` (223 行): 沉浸式刷剧流分页、滚轮切换防抖、推荐信号曝光统计与剧集详情加载。
7. `apps/web-pc/src/hooks/useKeyboardShortcuts.ts` (138 行): 全局键盘监听，**严格保留 D3-F3 Escape 优先关闭片尾弹窗/全屏/退出播放弹窗的阶梯式退出**。

#### 功能域组件（抽离 UI 渲染与高频渲染边界）
1. `apps/web-pc/src/components/Header.tsx` (146 行): 顶部品牌 Logo、主导航标签与右上角设置入口。
2. `apps/web-pc/src/components/HomePanel.tsx` (178 行): 首页轮播 Banner 与热门分区剧集瀑布流卡片。
3. `apps/web-pc/src/components/RecommendStream.tsx` (604 行): 9:16 竖屏沉浸式刷剧流容器与右侧悬浮互动交互栏。
4. `apps/web-pc/src/components/CategoryPanel.tsx` (201 行): 题材分类标签切换与分页剧集卡片列表。
5. `apps/web-pc/src/components/RankPanel.tsx` (205 行): 官方排行榜（热播榜/飙升榜/新剧榜）切换与排名徽章展示。
6. `apps/web-pc/src/components/SearchPanel.tsx` (349 行): 搜索框、实时联想下拉、历史搜索标签与结果网格。
7. `apps/web-pc/src/components/LibraryPanel.tsx` (291 行): 追剧与历史双 Tab、历史观看进度条、一键清空与续播。
8. `apps/web-pc/src/components/SettingsPanel.tsx` (191 行): 推荐类型偏好、远程家庭账号同步配置。
9. `apps/web-pc/src/components/PlayerModal.tsx` (908 行): 全功能弹窗播放器、选集器分集标签、清晰度、推荐换一批与片尾弹窗。
10. `apps/web-pc/src/utils/format.ts` (6 行): 公共 `formatTime` 辅助函数。

---

## 二、R5 交互修复有效性复测（零回归保护）

| 缺陷编号 | 修复项 | 重构后所在位置 | 验证结果 |
| --- | --- | --- | --- |
| **D3-F2** | 首页挂载重复请求 `/api/category/tags` | `useCatalog.ts` (inFlightPromise 缓存) | **通过**：页面挂载仅发出 1 次网络请求 (`tagRequestsCount: 1`)，无重复请求。 |
| **D3-F3** | 按 `Escape` 键无法退出弹窗播放器 | `useKeyboardShortcuts.ts` | **通过**：DevTools 发送 Escape 按键，成功关闭播放弹窗，DOM 节点立即销毁。 |
| **D3-F4** | 搜索输入竞争导致陈旧联想词覆盖新结果 | `useSearch.ts` (suggestGenerationRef / searchGenerationRef) | **通过**：输入防抖与代际递增保持生效，实时联想无跳变闪烁。 |

---

## 三、构建与测试验证证据

### 3.1 前端应用类型检查与生产构建
```powershell
npm --prefix apps/web-pc run build
```
输出：
```
> hongguotv-web-pc@1.0.0 build
> tsc && vite build

vite v6.4.4 building for production...
transforming...
✓ 1667 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.62 kB │ gzip:   0.41 kB
dist/assets/index-CxzP6uf4.css   49.39 kB │ gzip:   8.23 kB
dist/assets/utils-6M1rlj0l.js     2.73 kB │ gzip:   1.34 kB
dist/assets/index-fQxYak3V.js   348.68 kB │ gzip: 103.48 kB
✓ built in 2.77s
```

### 3.2 全局自动化测试套件
```powershell
npm test
```
输出：
```
1..83
# tests 83
# suites 0
# pass 83
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1007.6856
```
83 项单元与集成测试全绿通过。

---

## 四、主要页面功能与截图证据

所有主要功能页面均在真实无头/可视化浏览器环境渲染并截图存档于 `.agents/shared/`：

1. **首页 (`tab = home`)**: `.agents/shared/t-r7-home.png`
2. **沉浸式推荐流 (`tab = recommend`)**: `.agents/shared/t-r7-recommend.png`
3. **题材分类 (`tab = category`)**: `.agents/shared/t-r7-category.png`
4. **官方榜单 (`tab = rank`)**: `.agents/shared/t-r7-rank.png`
5. **追剧与历史 (`tab = library`)**: `.agents/shared/t-r7-library.png`
6. **偏好与同步设置 (`tab = settings`)**: `.agents/shared/t-r7-settings.png`
7. **全功能播放器弹窗**: `.agents/shared/t-r7-player.png`

---

## 五、结论

`apps/web-pc/src/App.tsx` 4,112 行单文件巨石组件成功按领域拆分为 9 个轻量组件、7 个专用 Hook 和 1 个公共工具，`App.tsx` 主体降至 682 行，无循环依赖，高频播放状态被局部化隔离，R5 全部修复得到 100% 完整继承，全项目构建与测试全绿通过。
