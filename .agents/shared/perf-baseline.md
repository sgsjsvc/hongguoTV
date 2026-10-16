# 性能基线报告（三端）

**测量方**: dsh
**日期**: 2026-10-16
**方法**: 直接测量服务端 API 耗时 + 代码路径审查

---

## 一、实测基线

### 服务端接口耗时

| 接口 | 冷（首次） | 热（缓存） | 判定 |
| --- | --- | --- | --- |
| **推荐 `/api/recommend`** | **2514 ms** | **2 ms** | ⚠️ 首次拉数据池慢 |
| **详情 `/api/series/:id`** | **1086–2035 ms** | **无缓存** | 🔴 **每次都慢** |
| 清晰度 `/api/episodes/:id/qualities` | 495 ms | **0–1 ms** | ✅ |
| 取流 `/api/episodes/:id/stream` | 230–37 ms | **32 ms** | ✅ |

### 详情接口按集数（6 部剧实测）

| 集数 | 耗时 |
| --- | --- |
| 61 集 | 1467 ms |
| 66 集 | 1084 ms |
| 77 集 | 1170 ms |
| 121 集 | 2035 ms |
| 158 集 | 1086 ms |
| 639 集 | 1374 ms |

**平均 1369 ms**，与集数无明显相关（受上游响应波动影响）。

### 并发能力

| 场景 | 耗时 |
| --- | --- |
| 3 个不同集并发取流 | 992 ms（均成功） |
| 同一集重复取流 | 37 → 32 → 33 ms |

---

## 二、根因定位（按影响排序）

### 🔴 问题 1：详情接口无缓存

**位置**：`server/provider.mjs:90`

```javascript
async detail(id) {
  const data = await api.routerData(`${SITE}/detail?series_id=${id}`);  // 每次都请求上游
  ...
}
```

**影响**：**每次切剧等 1–2 秒**。这是最大的用户可感知延迟。

**对比**：其他接口都有缓存（`streamCache`、`videoInfoCache`、`pageCache`、`categoryCache`），
**唯独 `detail` 没有**。

### 🔴 问题 2：Web 端切集重建 `<video>` 元素

**位置**：`apps/web-pc/src/components/RecommendStream.tsx:300`

```tsx
<video key={`${currentItem.id}-${streamCurrentEpisode?.id || 0}`} ... />
```

**`key` 变化导致 React 销毁并重建整个 `<video>`**：

| 方式 | 代价 |
| --- | --- |
| 改 `src` | 复用解码器，快 |
| **改 `key`（重建）** | **销毁解码器 + 重建 pipeline + 重新缓冲** |

**影响**：切集/切剧时的**画面黑屏与解码重启延迟**。

**对比**：TV 端做得对 —— 用 `setMediaItem()` + `prepare()` 复用 ExoPlayer（`MainActivity.kt:843`）。

### 🟡 问题 3：TV 端切集重建 UI 树

**位置**：`apps/tv-android/.../MainActivity.kt:819`

```kotlin
navigation.removeAllViews()   // 每次切集销毁整个视图树
```

**影响**：切集时 UI 重建，焦点恢复与布局重算有额外开销。

**说明**：TV 的播放器复用是对的，但 UI 树仍被重建。

### 🟡 问题 4：无任何预加载

**三端均无预加载机制**（grep `preload`/`prefetch`/`preheat` 无结果）。

**影响**：

| 场景 | 当前等待 |
| --- | --- |
| 自动下一集（同剧） | 38 ms（清晰度 + 取流） |
| **自动切下一部剧** | **1407 ms**（详情 1369 + 其余） |
| 首次进入推荐流 | 2514 ms |

**若在播放到 80%/90% 时后台预取，这些等待可降至接近 0。**

### 🟢 问题 5：推荐首屏慢（但有缓解）

**位置**：`custom-server/recommendation-service.mjs:12`

首次进入需 `loadRound` 拉数据池（2514 ms），之后翻页仅 2 ms。

**缓解**：可在应用启动时后台预热。

---

## 三、优化收益量化

| 优化项 | 收益 | 风险 | 影响范围 |
| --- | --- | --- | --- |
| **详情接口加缓存** | **省 1367 ms**（切剧） | 低 | 服务端（三端共享） |
| **预加载下一部剧** | **省 1407 ms** | 中 | 三端各自实现 |
| **Web 切集不重建 video** | 消除黑屏与解码重启 | 低 | Web 端 |
| **TV 切集不重建 UI 树** | 减少 UI 开销 | 中 | TV 端 |
| 预加载下一集 | 省 38 ms | 低 | 三端 |
| 推荐池预热 | 省 2514 ms（首屏） | 低 | 服务端 + 客户端 |

---

## 四、任务拆分（可并行）

### 依赖关系

```
P1 详情缓存（服务端）────────┐
                            ├─→ P4 预加载（三端，依赖缓存层）
P2 Web video 复用 ──────────┤
                            │
P3 TV UI 树复用 ────────────┘
```

**P1/P2/P3 三者文件不重叠，可完全并行。**

---

## 五、分配建议（均匀，减少等待）

| 任务 | 负责方 | 文件 | 可并行 |
| --- | --- | --- | --- |
| **P1** 详情接口缓存 | **codex** | `server/provider.mjs` | ✅ 独立 |
| **P2** Web 切集不重建 video | **antigravity** | `RecommendStream.tsx` 等 | ✅ 独立 |
| **P3** TV 切集不重建 UI 树 | **codex** | `MainActivity.kt` | ⚠️ 与 P1 不同文件，可并行 |
| **P4** 三端预加载 | **待定** | 依赖 P1-P3 结论 | 需 P1 完成 |

**注意**：codex 同时领 P1 与 P3 —— 两者文件不重叠，但同一 agent 需串行。
若想更快，可让 workbuddy 领 P3（但它是复核角色）。

**更均匀的分法**：

| 任务 | 负责方 |
| --- | --- |
| P1 详情缓存 | codex |
| P2 Web video 复用 | antigravity |
| P3 TV UI 树复用 | antigravity（与 P2 不同端，可串行快） |
| P4 预加载 | 待 P1 完成后派 |

---

## 六、测量方法（供执行方复现）

```powershell
# 启动服务
node custom-server/index.mjs

# 测量脚本
node outputs/debug/measure-playback.mjs   # 基础链路
node outputs/debug/measure-deep.mjs       # 冷热对比与并发
```

**验收时必须用同一脚本复测**，对比优化前后数据。

---

## 七、注意事项

1. **详情缓存需处理失效**：用户可能希望看到最新集数。建议 TTL 5 分钟 + 手动刷新接口
2. **Web video 复用需验证**：改 `key` 后要确认切集仍能正确加载新集（避免复用导致不更新）
3. **TV UI 树复用风险较高**：`removeAllViews` 是当前渲染策略，改动需谨慎
4. **预加载需考虑流量**：移动端或流量受限场景应可关闭
5. **三端共享引擎**：若改动 `shared/content-core/hongguo.js`，必须两端环境都验证
