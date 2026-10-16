# P6 接入预取触发器（让 P1 的预取真正生效）

**任务 ID**: `t-p6-prefetch-wire`
**负责人**: **antigravity**
**依赖**: **P1 已完成**（接口就绪）
**协调者**: dsh
**范围**: Web / Windows 客户端接入预取

---

## 一、问题：预取接口就绪，但无人调用

**P1（codex）已完成预取基础设施**：

| 接口 | 说明 |
| --- | --- |
| `POST /api/prefetch` | 提交预取批次 |
| `GET /api/prefetch/:id` | 查询状态 |
| `DELETE /api/prefetch/:id` | 取消 |

**实测效果**（协调者已验收）：

| 指标 | 优化前 | 预取后 |
| --- | --- | --- |
| 详情 | 1453 ms | **1.7 ms** |
| 清晰度 | 254 ms | 0.6 ms |

### ⚠️ 但接口尚未被调用

**codex 明确说明**：

> 预取接口尚未自动接到任何客户端触发器，**需要客户端维护方按需接入**。

**协调者核实**：

```powershell
Select-String -Path 'apps/web-pc/src/**/*.ts*' -Pattern 'prefetch'
# 无输出 —— 客户端未接入
```

**所以「切剧等 1.4 秒」目前还没有真正改善。**

**本任务就是补上这一环。**

---

## 二、任务目标

在 Web / Windows 客户端**接入预取触发器**，让用户切剧前数据已在缓存中。

### 2.1 接口契约（P1 提供）

```javascript
// 提交预取
POST /api/prefetch
{
  "targets": [
    { "kind": "detail",    "id": "<剧集ID>" },
    { "kind": "qualities", "id": "<分集ID>", "seriesId": "<剧集ID>" }
  ]
}
// 返回 202，含 { id, state, targets }

// 查询状态
GET /api/prefetch/:id
// state: pending / complete / cancelled
// 各目标 state: queued / running / done / failed / cancelled

// 取消
DELETE /api/prefetch/:id
```

**特性**（P1 已实现）：

| 特性 | 说明 |
| --- | --- |
| 后台 1 并发 | 不挤占前台请求 |
| 队列/批次容量限制 | 防止堆积 |
| 错误静默隔离 | 预取失败不影响主流程 |
| 前台请求进行时不启动新预取 | 避免争用 |
| `HG_PREFETCH_ENABLED=0` | 可关闭 |

### 2.2 建议的触发时机

**codex 的建议**：

> 当前项详情加载后预取同页后一部，离开/切换时 DELETE 旧批次；
> 不预取推荐分页以免改变服务端会话顺序。

**协调者补充**（基于 `perf-drama-switch-analysis.md`）：

| 时机 | 预取内容 | 收益 |
| --- | --- | --- |
| **详情加载后** | 推荐流中**下一部**的 detail | 切剧 1453 ms → 1.7 ms |
| **播放到当前集 80%** | 下一集的 qualities | 自动下一集更快 |
| 用户**滚动推荐列表** | 视野内剧集的 detail | 浏览更流畅 |
| 离开/切换时 | DELETE 旧批次 | 避免浪费 |

**优先级**：

1. **必须**：详情加载后预取下一部（收益最大）
2. **建议**：播放到 80% 时预取下一集 qualities
3. 可选：滚动列表时预取视野内

### 2.3 ⚠️ 重要限制

**不要预取推荐分页**：

`recommendation-service.mjs:28` 有硬性约束：

```javascript
if (page !== state.pages.size + 1) throw new RecommendationError(409, '请按顺序加载推荐分页');
```

**推荐分页必须按顺序加载**，预取未来页会**破坏会话顺序**。

**所以只预取 `detail` 与 `qualities`。**

---

## 三、实现要求

### 3.1 接入位置

| 文件 | 改动 |
| --- | --- |
| `apps/web-pc/src/hooks/useStreamFeed.ts` | 详情加载后触发预取 |
| `apps/web-pc/src/api.ts` | 封装预取调用（可复用 P5 的改动） |
| `apps/web-pc/src/App.tsx` | 可能需要串联 |

**由你判断具体位置**，在报告中说明理由。

### 3.2 关键要求

| # | 要求 |
| --- | --- |
| 1 | **不阻塞主流程** —— 预取是后台行为，不能 `await` |
| 2 | **失败静默** —— 预取失败不影响播放/切剧 |
| 3 | **可取消** —— 离开页面/切换剧集时 DELETE |
| 4 | **不重复预取** —— 同一剧集已在预取则不重复提交 |
| 5 | **尊重开关** —— 若 `enabled=false` 则不提交 |
| 6 | **不预取推荐分页** —— 避免破坏会话顺序 |

### 3.3 必须验证的行为

| # | 场景 | 期望 |
| --- | --- | --- |
| 1 | 进入推荐流并加载详情 | 自动提交预取下一部 |
| 2 | 切到下一部剧 | **详情立即返回**（< 50 ms） |
| 3 | 预取失败（如断网） | **不影响**播放与切剧 |
| 4 | 快速连续切剧 | 不产生大量重复预取 |
| 5 | 离开播放页 | 旧批次被取消 |
| 6 | `HG_PREFETCH_ENABLED=0` | 不提交预取 |
| 7 | 网络面板 | 无推荐分页预取请求 |

---

## 四、硬性约束

1. **可改文件**：
   - `apps/web-pc/src/hooks/useStreamFeed.ts`
   - `apps/web-pc/src/api.ts`
   - `apps/web-pc/src/App.tsx`
2. **不要改** `server/provider.mjs`、`custom-server/`（P1 的成果，已验收）
3. **不要改** `apps/tv-android/`（P3/P4 的职责）
4. **不要改** `shared/content-core/hongguo.js`
5. 保持 `npm run typecheck` 通过
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 客户端调用 `/api/prefetch` | 网络面板可见 |
| 2 | **切剧时详情 < 50 ms** | 实测（当前 1453 ms） |
| 3 | 预取失败不影响主流程 | 构造失败场景 |
| 4 | 离开时取消旧批次 | 网络面板可见 DELETE |
| 5 | 无重复预取 | 同一剧集只提交一次 |
| 6 | 无推荐分页预取 | 网络面板核实 |
| 7 | `typecheck` 通过 | |
| 8 | 报告写入 `.agents/shared/t-p6-prefetch-wire-antigravity.md` | |

---

## 六、验证方法

### 环境

```powershell
node custom-server/index.mjs   # 后端 8788
npm run dev                     # Vite 3000
```

**用 Chrome DevTools 或 CDP 验证**：

```javascript
// 1. 观察是否提交预取
// Network 面板筛选 "prefetch"

// 2. 验证切剧时详情耗时
// 用 performance API 或 Network 面板的 timing
```

**协调者提供的验证脚本**（可参考）：

```powershell
node scripts/perf/verify-p2-final.mjs      # 挑可用剧集的逻辑
node scripts/perf/verify-p5-polling.mjs    # CDP 请求计数方法
```

### 关键测量

**必须给出切剧时的详情接口耗时**（优化前 1453 ms，目标 < 50 ms）。

---

## 七、证据要求

1. **网络面板截图**：显示 `/api/prefetch` 请求
2. **切剧耗时对比**：预取生效前后的详情接口耗时
3. **失败隔离验证**：预取失败时主流程正常
4. **取消验证**：离开时 DELETE 请求
5. **无推荐分页预取**的证据
6. `typecheck` 输出

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **预取推荐分页会破坏会话** | `recommendation-service.mjs:28` 有顺序约束 |
| **阻塞主流程** | 预取必须后台，不能 `await` |
| **重复预取** | 需去重（同一剧集已在预取则跳过） |
| **忘记取消** | 用户快速切剧会产生大量废弃批次 |
| **预取失败影响主流程** | 必须静默隔离 |
| 三端共享引擎 | 本任务只改 Web 端，不动引擎 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-p6-prefetch-wire antigravity "结论及报告路径"
```
