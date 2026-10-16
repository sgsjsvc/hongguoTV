# P1 详情接口缓存（消除切剧 1.4 秒等待）

**任务 ID**: `t-p1-detail-cache`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: 服务端详情接口缓存

---

## 一、问题（协调者实测）

**详情接口无任何缓存**，每次切剧都要等 **1086–2035 ms**。

| 集数 | 耗时 |
| --- | --- |
| 61 集 | 1467 ms |
| 121 集 | 2035 ms |
| 639 集 | 1374 ms |

**平均 1369 ms。**

### 根因

**`server/provider.mjs:90`**：

```javascript
async detail(id) {
  const data = await api.routerData(`${SITE}/detail?series_id=${id}`);  // 每次都请求上游
  ...
}
```

**对比**：其他接口都有缓存，唯独 `detail` 没有：

| 缓存 | 位置 | TTL |
| --- | --- | --- |
| `streamCache` | 引擎 | 300 s |
| `videoInfoCache` | 引擎 | 300 s |
| `pageCache` | 引擎 | 180 s |
| `categoryCache` | custom-server | 600 s |
| `rankPageCache` | custom-server | — |
| **详情** | **无** | — |

### 用户影响

**每次自动切下一部剧，用户要等约 1.4 秒**（详情 1369 + 清晰度 + 取流）。

---

## 二、要求

### 2.1 加缓存

在 `server/provider.mjs` 的 `detail()` 中加缓存。

**建议**：

- **TTL 5 分钟**（300 s）—— 与引擎其他缓存一致
- **容量上限**：如 100 条（参考 `BoundedCache` 的实现）
- **并发去重**：同一 `id` 的并发请求应共享同一个 promise（避免缓存击穿）

**可参考引擎的 `BoundedCache`**（`shared/content-core/hongguo.js:117`）：

```javascript
class BoundedCache extends Map {
  // 有 TTL 与容量上限，以及驱逐回调
}
```

**注意**：`provider.mjs` 是独立模块，**不能直接 import 引擎的类**（引擎跑在 vm 沙箱里）。
需要自己实现一个等价的轻量缓存。

### 2.2 提供失效手段

缓存必须可绕过，否则用户看不到新更新的集数。

**建议加查询参数**：

```
GET /api/series/:id?fresh=1
```

`fresh=1` 时跳过缓存并刷新。

**参考**：现有 `stream` 接口已有 `fresh` 参数（`provider.mjs:107`）。

### 2.3 暴露缓存命中情况（便于验证）

在响应头或响应体中加入缓存标识，便于测量脚本判断命中：

```
X-Cache: HIT | MISS
```

或响应体加 `cached: true/false`。

**注意**：不要破坏现有响应结构（前端依赖 `episodes`、`series` 等字段）。

---

## 三、硬性约束

1. **可改文件**：
   - `server/provider.mjs`
   - `custom-server/index.mjs`（若需透传 `fresh` 参数）
2. **不要改** `shared/content-core/hongguo.js`（三端共享，风险高）
3. **不要改** `apps/web-pc/src/`、`apps/tv-android/`（其他 agent 的职责）
4. **不要回退**任何已完成改动
5. 保持 `npm test` 全绿
6. 当前 shell 是 **Windows PowerShell 5.1**（不支持 `&&`）

---

## 四、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | 详情接口二次请求显著变快 | **< 50 ms**（当前 1369 ms） |
| 2 | `fresh=1` 能绕过缓存 | 返回最新数据 |
| 3 | 并发去重 | 同一 id 并发 3 次，上游只被调用 1 次 |
| 4 | 缓存容量有上限 | 不会无限增长 |
| 5 | TTL 生效 | 过期后重新请求上游 |
| 6 | 响应结构未变 | 前端无需改动 |
| 7 | `npm test` 全绿 | 144 项 |
| 8 | 报告写入 `.agents/shared/t-p1-detail-cache-codex.md` | |

---

## 五、测量方法

**协调者提供的测量脚本**（可直接复用）：

```powershell
# 启动服务
node custom-server/index.mjs

# 基础链路测量
node outputs/debug/measure-playback.mjs

# 冷热对比与并发
node outputs/debug/measure-deep.mjs
```

**验收时必须用同一脚本复测**，对比优化前后：

| 指标 | 优化前 |
| --- | --- |
| 详情（6 部剧平均） | 1369 ms |
| 切剧合计 | 1791 ms |

**目标**：详情二次请求 < 50 ms，切剧合计 < 100 ms。

---

## 六、证据要求

1. **优化前后对比**：同一脚本的输出（6 部剧的详情耗时）
2. **缓存命中验证**：连续请求同一剧集，第 2 次起应 < 50 ms
3. **`fresh=1` 验证**：绕过缓存后耗时回到 1 秒级
4. **并发去重验证**：3 个并发请求，上游调用次数
5. `npm test` 输出

---

## 七、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **缓存击穿** | 同一 id 并发请求需共享 promise，否则缓存失效瞬间会打爆上游 |
| **无限增长** | 必须有容量上限，长期运行不能吃光内存 |
| **数据陈旧** | 剧集更新后需能刷新（`fresh=1`） |
| **`provider.mjs` 环境** | 它是普通 Node 模块，**不是** vm 沙箱，不能用引擎内部类 |
| 三端共享 | 该接口被 Web/Windows/TV 共用，改动影响三端 |

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-p1-detail-cache codex "结论及报告路径"
```
