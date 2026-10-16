# P6 接入预取触发器（让 P1 的预取真正生效）交付报告

- **任务 ID**: `t-p6-prefetch-wire`
- **负责人**: `antigravity`
- **状态**: `done`
- **完成时间**: 2026-10-16

---

## 1. 目标与背景

将 P1（基础设施）已实现的 `/api/prefetch` 接入 Web / Windows 客户端，消除用户在刷剧与切集过程中的等待耗时：
- **切剧耗时**: 从无缓存时的 ~1453ms 降至 < 50ms（P1 预取热缓存基准为 1.7ms）。
- **切集耗时**: 播放到 80% 时预取下一集清晰度，消除自动下一集及切集的等待。
- **取消机制**: 用户离开或快速滑动切剧时自动取消（DELETE `/api/prefetch/:id`）旧批次，避免占用带宽与服务端并发资源。
- **边界约束与红线**: 严禁预取推荐分页（`recommendation-service.mjs:28` 要求严格按序加载，跨页或预取未来页会触发 409 破坏服务端推荐会话），仅对同页已有的下一部短剧详情（及首集清晰度）和下一集清晰度发起预取。

---

## 2. 核心实现改动

### 2.1 客户端 API 封装 (`apps/web-pc/src/api.ts`)
- 新增 `api.prefetch(targets)`：提交详情与清晰度预取任务（`targets: [{ kind: 'detail', id }, { kind: 'qualities', id, seriesId }]`），返回 `202 Accepted` 或在全局禁用时返回 `enabled: false`。
- 新增 `api.cancelPrefetch(id)`：发送 `DELETE /api/prefetch/:id` 取消未执行的任务批次。
- 新增 `api.getPrefetchStatus(id)`：查询指定批次状态。

### 2.2 推荐流短剧详情预取与批次取消 (`apps/web-pc/src/hooks/useStreamFeed.ts`)
- 引入 `prefetchBatchIdRef`、`prefetchedSeriesIdsRef` 与 `prefetchDisabledRef`。
- **触发时机 1（详情加载后）**: `loadStreamDetail` 成功后，自动读取当前推荐流中同页下一部短剧，发起 `api.prefetch([{ kind: 'detail', id: nextId }])`。服务端 P1 实现会自动连带预热首集清晰度。
- **取消时机**: 在切剧 `loadStreamDetail`、刷新推荐 `loadStreamData` 及组件卸载 `useEffect cleanup` 时，自动调用 `api.cancelPrefetch` 取消未完成的前一任务批次。
- **防重与降级**: 维护 `prefetchedSeriesIdsRef` 避免频繁提交相同短剧；若服务端返回 `enabled: false`（如设置了 `HG_PREFETCH_ENABLED=0`），自动置位 `prefetchDisabledRef` 静默跳过后续请求。

### 2.3 80% 播放进度下一集清晰度预取 (`apps/web-pc/src/components/RecommendStream.tsx` & `apps/web-pc/src/hooks/usePlayback.ts`)
- **触发时机 2（播放进度达到 80%）**: 在 `onTimeUpdate` 与 `handleTimeUpdate` 监听中，当 `video.duration > 0 && cur / dur >= 0.8` 时，检测是否存在下一集。
- 若存在且未预取过，触发 `api.prefetch([{ kind: 'qualities', id: nextEp.id, seriesId: currentItem.id }])`。
- 在切集、切剧或组件卸载时，自动清理预取状态并取消未完成批次。

---

## 3. 测试与验证结果

### 3.1 自动化测试 (`npm test` & `tests/prefetch-wire.test.mjs`)
- 新增针对性集成测试套件 `tests/prefetch-wire.test.mjs`，覆盖 5 项严苛断言：
  1. `web-pc api.ts exports prefetch client methods` (ok)
  2. `useStreamFeed wires prefetch for next drama detail and cancels on change/unmount` (ok)
  3. `RecommendStream wires 80% next episode qualities prefetch and cancels batch on switch` (ok)
  4. `usePlayback wires 80% next episode qualities prefetch and cancels batch on switch` (ok)
  5. `end-to-end prefetch speedup: prefetch warms cache from cold delay down to < 50ms` (ok)
- 全局测试套件 `npm test` 共 161 项测试全部通过（161 passed, 0 failed）。
- TypeScript 类型检查 `npm run typecheck` 0 错误通过。

### 3.2 真实浏览器实测（Chrome DevTools 捕获网络流）
在真实浏览器页面（`http://localhost:3000/`）中切换至「推荐流」并向下切剧：
1. **进入第 1 部短剧**:
   - 请求当前详情：`GET /api/series/7687932879988329496 [200]`
   - 客户端立即自动触发预取：`POST /api/prefetch {"targets":[{"kind":"detail","id":"7694896136963755032"}]} [202]`
   - 返回批次 ID：`5a0deff7-f09a-412d-8479-433d7a09003e`
2. **键盘 ↓ 键切换至下一部短剧**:
   - 客户端自动清理旧任务：`DELETE /api/prefetch/5a0deff7-f09a-412d-8479-433d7a09003e [200]`
   - 加载下一部详情：`GET /api/series/7694896136963755032 [200]`，响应头明确命中热缓存：**`X-Cache: HIT`**，耗时显著远低于 50ms！
   - 紧接着再次自动预取下下部短剧：`POST /api/prefetch [202]`。
3. 截图凭证保存于：`.agents/shared/t-p6-prefetch-stream.png`。

---

## 4. 结论

`t-p6-prefetch-wire` 预取触发器接入全部按规范完成，切剧与切集体验达到秒开无感知状态，完全遵守推荐流按序不跨页红线。
