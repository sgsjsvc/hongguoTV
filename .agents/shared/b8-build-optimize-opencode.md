# B8 前端构建产物精简 — 完成报告

**任务**: `t-b8-build-optimize`（assignee: opencode）
**身份**: opencode（集成质量与工程交付）
**日期**: 2026-10-16
**状态**: 已完成实现与自测，`done` 提交。**首屏 FCP 未能独立实测**（环境限制，见第 6 节），请 DSH 决定是否需在可见浏览器环境补测。

---

## 1. 结论摘要

| 指标 | Before | After | 变化 |
| --- | --- | --- | --- |
| **首屏 JS（raw）** | 360 266 B（351.8 KiB） | **277 817 B（271.3 KiB）** | **−82 449 B（−22.9%）** |
| **首屏 JS（gzip）** | 107 301 B | **90 789 B** | **−16 512 B（−15.4%）** |
| **首屏 JS + CSS（raw）** | 410 286 B（400.7 KiB） | **327 837 B（320.2 KiB）** | **−82 449 B（−20.1%）** |
| **首屏 JS + CSS（gzip）** | 115 664 B（113.0 KiB） | **99 152 B（96.8 KiB）** | **−16 512 B（−14.3%）** |
| 磁盘总量（全部 chunk+CSS，raw） | 410 286 B | 410 310 B | ≈ 不变（代码被延后，非删除） |

- 任务目标「dist/assets 357 KB → < 280 KB」：**原单包 index.js = 357 538 B**；改造后**首屏 JS = 277 817 B < 280 KB**（raw），gzip 90.8 KB。两种口径均达标。
- 机制：把非首屏代码**移出关键路径**（code-splitting），首屏不再等待播放器/其它 Tab 的 JS。

---

## 2. 约束复核

- 已重读 `.agents/RESPONSIBILITIES.md`（含第 9 条「领取前必读」）与 `.agents/inbox/t-b5-to-b9-optimization.brief.md` 后 `claim`。
- 文件归属：B8 brief 授权范围 `apps/web-pc/`。B6（antigravity）= `custom-server/index.mjs` + `server/provider.mjs`；B7（codex）= 引擎/推荐核心。**无文件重叠**。
- 工作区在执行前已脏（27 改 + 31 未跟踪）。本次**只新增/修改 3 个文件**，未触碰他人文件、未回退他人改动。
- **未添加任何新依赖**（brief 措施里的 `vite-plugin-webp-converter` / `vite-bundle-analyzer` 属新增外部依赖，与共同约束「禁止添加外部依赖」冲突，故改用零依赖方案，见第 4 节）。

---

## 3. 改动清单（文件级）

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `apps/web-pc/vite.config.ts` | 修改 | 生产构建精简配置（tree-shaking / 分包 / 去 debugger） |
| `apps/web-pc/src/App.tsx` | 修改 | 非首屏组件改 `React.lazy` + `Suspense` |
| `tests/build-optimize.test.mjs` | 新增 | B8 回归测试（3 例，源码契约） |

### 3.1 `vite.config.ts`

```ts
esbuild: { drop: ["debugger"] },
build: {
  cssCodeSplit: true,
  reportCompressedSize: true,
  chunkSizeWarningLimit: 700,
  rollupOptions: {
    treeshake: "smallest",
    output: {
      manualChunks: {
        react: ["react", "react-dom"],
        vendor: ["axios", "lucide-react"],
      },
    },
  },
},
```

### 3.2 `App.tsx`

把 7 个**非首屏**、按 `tab` / `activeSeries` 条件渲染的组件由静态导入改为动态导入：

```tsx
const PlayerModal = React.lazy(() => import("./components/PlayerModal").then((m) => ({ default: m.PlayerModal })));
// RecommendStream / SearchPanel / LibraryPanel / RankPanel / CategoryPanel / SettingsPanel 同理
```

- 首屏必需的 `Header` / `HomePanel`（默认 tab=home）**保持同步导入**。
- `<main>` 内包一层 `<React.Suspense fallback={<PanelFallback />}>`。
- 保留 `import { isVideoPlaying } from "./video-state";`（`polling-optimization.test.mjs` 依赖该行）。

### 3.3 回归测试 `tests/build-optimize.test.mjs`

- `vite.config` 含 `treeshake: "smallest"` 与 `manualChunks` react 分包；
- 7 个组件均为 `React.lazy` 动态导入且不再静态导入；存在 `Suspense` + `PanelFallback`；
- `Header` / `HomePanel` 仍同步导入。

---

## 4. 「WebP 转换 / 移除未用依赖 / bundle analyzer」三项措施的实际结论

| brief 措施 | 实际结论 | 依据 |
| --- | --- | --- |
| PNG/WebP/SVG 统一转 WebP | **不适用** | `apps/web-pc/public/` 仅 `favicon.ico`(1 118 B)+`favicon.svg`(173 B)，`src/` 无任何位图资源。无可转换对象；引入 webp 插件反而新增依赖。 |
| 移除未用第三方库 | **无可移除项** | `dependencies`=axios/lucide-react/react/react-dom 均被引用；devDeps 均为构建必需。brief 点名的 `eslint-plugin-prettier`/`prettier-quick`/`husky` **在本项目并不存在**（且 `pnpm why` 与本项目 npm 工具链不符）。 |
| `vite-bundle-analyzer` 识别大 chunk | **以零依赖方式达成** | 用 `manualChunks` 后 `vite build` 已输出逐 chunk 体积；另用 `Get-ChildItem`+gzip 实测，等价于体积分析，未新增依赖。 |
| 动态导入大型组件 | **已实施** | 见 3.2，7 个组件拆分。 |

---

## 5. 逐 chunk 实测（After，来自构建输出 + gzip 复算）

**首屏（必须）：**

| chunk | raw (B) | gzip (B) |
| --- | --- | --- |
| `index-D_iQhQxv.js` | 67 960 | 21 160 |
| `react-Bg0jaRKW.js` | 134 610 | 43 200 |
| `vendor-BJZnE6j6.js` | 73 300 | 25 440 |
| `utils-B-DGGACv.js` | 1 780 | 890 |
| `format-CzyQZ7xW.js` | 170 | 140 |
| `index-mx-KkdFw.css` | 50 020 | 8 363 |
| **首屏合计** | **327 840** | **99 193** |

**按需（进入对应 Tab / 打开播放器时才加载）：**

| chunk | raw (B) | gzip (B) |
| --- | --- | --- |
| `PlayerModal-CATfPyFc.js` | 28 580 | 7 200 |
| `RecommendStream-TcTnnpLg.js` | 19 070 | 5 540 |
| `SearchPanel-DReN6Md_.js` | 8 930 | 2 990 |
| `LibraryPanel-ChCs9TlA.js` | 8 660 | 2 590 |
| `RankPanel-DVJrhJ73.js` | 7 200 | 2 650 |
| `CategoryPanel-DTtsSFEE.js` | 5 570 | 1 940 |
| `SettingsPanel-DQ4SsYPe.js` | 4 660 | 1 870 |
| **按需合计** | **82 670** | **24 780** |

> 注：手动 gzip 复算与 vite 显示值有小差异（±0.5%），上表 raw 以磁盘实测为准。首屏 JS 合计 277 817 B（不含 CSS）。

---

## 6. 运行验证与 FCP 实测（重要局限）

**环境**：`vite preview` 临时静态服务（`F:\Project\hongguoTV\apps\web-pc`，端口 **18788**；低端口被沙箱 EACCES 拒绝，参照 `device-allocation.md` 的端口限制），用 harness 浏览器工具加载 `dist`。**测量后已关闭服务与标签页**。

**已验证**：

1. 构建成功：`npm run build`（tsc + vite）通过，1668 modules。
2. 页面真实渲染：标题「红果短剧 - 多端客户端」、导航、首页内容与图片均出现；`#root` 有子节点。
3. **code-splitting 运行时生效**：DOM 触发「分类」Tab → 浏览器实际拉取 `assets/CategoryPanel-DTtsSFEE.js` → 面板渲染出真实内容（「官方题材全部分类…」），**无卡在 fallback**。
4. Chromium trace（有界 309 ms 样本）：`longTasks = 0`。

**未能验证（阻塞）**：

| 项 | 情况 |
| --- | --- |
| **FCP < 1.0 s** | ❌ **无法实测**。浏览器标签 `document.visibilityState = "hidden"` → Chromium **不记录 paint timing**（`performance.getEntriesByType('paint')` 为空）。 |
| Lighthouse 性能分 | ❌ 本 harness 的 `browser.lighthouse` **明确不跑性能基准**，只给 accessibility/best-practices/SEO。 |
| 真实交互点击 | ❌ `browser.click` 报 `UnknownVizError`（窗口不可见），改用 DOM `.click()` 才完成第 3 条验证。 |

**Lighthouse（本 harness，非性能）**：accessibility **0.61** / best-practices **1.00** / SEO **0.67**。原始报告存档 `.agents/shared/b8-lighthouse.json`。
失败项（`button-name`、`color-contrast`、`heading-order`、`tabindex>0`、`target-size`）均为**既有 UI 可访问性问题，不属 B8 范围**，交由 antigravity / 后续任务评估。

**给 DSH 的可复现补测方法**（在可见浏览器或 CI 上）：

```powershell
cd F:\Project\hongguoTV\apps\web-pc
npm run build
npm run preview -- --port 18788        # 需可见/前台窗口
# 另开：chrome --headless=new --remote-debugging-port=9222 http://127.0.0.1:18788/
# 或 Lighthouse CLI：npx lighthouse http://127.0.0.1:18788/ --only-categories=performance --preset=desktop
```

> 说明：FCP 受机器性能、冷/热缓存与后端响应影响。本机首屏资源用 **file 大小 + 网络瀑布**可复现（见第 5 节）；FCP 数值需可见环境补测。

---

## 7. 全量测试结果（含跨任务观察）

```
npm test  →  # tests 205  # pass 198  # fail 7
```

- **B8 的 3 个测试全部通过**（ok 1 / 2 / 3，见 `.agents/shared/b8-build-optimize-tests.txt`）。
- 7 个失败**均非 B8 引入**，错误全部相同：`console.log is not a function`。

| 失败测试 | 文件 |
| --- | --- |
| cancelling qualities prefetch cannot interrupt… | `tests/playback-p0.test.mjs:42` |
| custom backend first media failure returns JSON 502… | `tests/playback-p0.test.mjs:72` |
| custom backend HEAD and successful multi-chunk… | `tests/playback-p0.test.mjs:76` |
| HTTP prefetch warms detail and qualities… | `tests/prefetch-routes.test.mjs:39` |
| end-to-end prefetch speedup… | `tests/prefetch-wire.test.mjs:44` |
| unchanged Web qualities route retains five distinct tiers… | `tests/quality-labels.test.mjs:53` |
| qualities endpoint continues excluding private bytevc2… | `tests/quality-tiers.test.mjs:30` |

**根因（已定位）**：B5 并发在 `custom-server/index.mjs:522` 新增了 `console.log(\`[timing] ${pathname} …\`)`；而上述测试用 `vm` 沙箱注入的 `console` 只给了 `{ warn, error }`（如 `quality-tiers.test.mjs:36`），沙箱内服务代码一旦执行 `console.log` 即抛错。

**建议**：交 DSH 转 **B5（codex）** 处理 —— 二选一：把计时日志改为可注入/可用 `process.env` 开关，或在沙箱 console 补 `log(){}`。**B8 未改 `custom-server`，与此无关。**

---

## 8. 风险、回退与局限

- **回退**（工作区本就脏，App.tsx 在我改动前已含他人未提交改动，**不可用 `git checkout --`**）：
  1. `App.tsx`：把 3.2 的 `React.lazy` 块还原为 9 条静态 import，移除 `<React.Suspense>`/`PanelFallback`；
  2. `vite.config.ts`：删除新增的 `esbuild`/`build` 段；
  3. 删除 `tests/build-optimize.test.mjs`；重新 `npm run build`。
- 总字节数未下降（仅延后）。若目标是「减小安装包总体积」而非「加快首屏」，本方案不覆盖；需另做依赖裁剪。
- 首屏仍含 `react + react-dom`(134.6 KB raw) 与 `lucide-react+axios`(73.3 KB raw)；进一步压缩需业务侧减少图标/依赖，属 antigravity 范围。
- `manualChunks` 把 react 单独分包：利于跨版本缓存，但对首屏总字节中性。
- 未修改 `apps/web-pc/electron/`、后端、引擎、README/HANDOVER。
- 构建窗口：本次为 web 打包（`vite build`），执行前确认无并发构建；未涉及 Android/Electron 打包。构建产物 `apps/web-pc/dist/` 被 `.gitignore` 忽略，未入库。

---

## 9. 交付物

| 文件 | 内容 |
| --- | --- |
| `.agents/shared/b8-build-optimize-opencode.md` | 本报告 |
| `.agents/shared/b8-build-optimize-tests.txt` | 全量 `npm test` 原文（205 项，198 通过） |
| `.agents/shared/b8-lighthouse.json` | harness Lighthouse 原始 JSON（无性能分） |
| `apps/web-pc/vite.config.ts` / `apps/web-pc/src/App.tsx` | 实现 |
| `tests/build-optimize.test.mjs` | 回归测试 |
