# R7 拆分 App.tsx 单文件巨石组件

**任务 ID**: `t-r7-web-refactor`
**负责人**: antigravity
**依赖**: `t-r5-web-interaction`（R5）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

R5 会改 `App.tsx`（修 D3-F2/F3/F4）。**必须等 R5 定稿**，否则拆分时会与修复冲突。

---

## 一、目标

修复 **D3-F1**（high）：`apps/web-pc/src/App.tsx` **4053 行**单文件巨石组件。

**详见**：`.agents/shared/t-d3-web-ui-discovery-antigravity.md`

---

## 二、问题规模（已核实）

| 指标 | 数值 |
| --- | --- |
| 文件行数 | **4053** |
| `useState` | 100+ |
| `useEffect` | 24 |
| `useRef` | 20+ |

**影响**：秒级播放进度更新迫使 4053 行虚拟 DOM 树频繁重渲染，CPU/GC 压力，且极易引入闭包陈旧值与状态竞态。

**D3 报告第五节已给出拆分方案**，请以其为基础。

---

## 三、拆分原则

### 3.1 按功能域拆分

建议方向（可调整，但需说明理由）：

```
src/
├── App.tsx                    （编排层，尽量薄）
├── hooks/                     （自定义 Hook 抽离状态逻辑）
│   ├── useLibrary.ts          资料库（收藏/历史/搜索）
│   ├── usePlayback.ts         播放状态与进度
│   ├── useCatalog.ts          分类/榜单/推荐
│   └── useSync.ts             同步状态
├── components/
│   ├── Header.tsx             顶部导航
│   ├── PlayerModal.tsx        播放弹窗
│   ├── SeriesGrid.tsx         剧集网格
│   ├── DetailPanel.tsx        详情
│   ├── SearchPanel.tsx        搜索
│   └── SettingsPanel.tsx      设置
└── ...
```

### 3.2 关键要求

1. **纯结构重组，不改变任何可见行为**
2. **播放进度更新不应触发全树重渲染** —— 用 `useMemo` / `React.memo` / 状态下沉隔离高频状态
3. **保持现有 API 调用时机不变**（R5 刚修复过重复请求，不要引入新的）
4. 每个新文件职责单一、可独立阅读

---

## 四、硬性约束

1. **可改 `apps/web-pc/src/` 下的文件**（含新建）
2. **不要改 `index.html` / `public/`**（R6 负责）
3. **不要回退** R5 的修复（D3-F2/F3/F4 必须保持已修状态）
4. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. `App.tsx` 行数**显著下降**（目标 < 800 行，以编排为主）
2. 拆出的模块职责清晰，无循环依赖
3. **功能无回归**：
   - 首页 / 分类 / 榜单 / 推荐 / 搜索 / 详情 / 设置全部正常
   - 播放、进度记录、收藏、历史正常
   - R5 修复的 3 项保持有效（重复请求仍为 1 次、Escape 可退出、搜索无竞态）
4. `npm run typecheck`、`npm run build`、`npm test` 全绿
5. 报告写入 `.agents/shared/t-r7-web-refactor-antigravity.md`

---

## 六、证据要求

- **拆分前后 `App.tsx` 行数对比**
- **功能回归验证**：至少覆盖 6 个主要页面的截图
- **R5 修复有效性复测**（网络请求次数）
- **性能对比**（可选但推荐）：播放时的重渲染次数对比

证据三件套（截图 + 落盘 + 命令原文）。

---

## 七、风险提示

这是**本批任务中成本最高**的一项（`effort: large`）。建议：

- **分步进行**，每步都保持可构建、可运行
- 不要一次性大改后才发现回归
- 若发现无法在合理范围内完成，**如实报告进度与阻塞**，不要留下半成品

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-r7-web-refactor antigravity "结论及报告路径"
# 或（若无法完成）
node .agents/cli.mjs fail t-r7-web-refactor antigravity "已完成部分与阻塞原因"
```
