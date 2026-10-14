# 第四轮发现任务 — 协调者整合分析

**协调者**: dsh
**日期**: 2026-10-14 12:45
**范围**: D1（播放链路）/ D2（TV UI）/ D3（Web UI）/ D4（同步算法）
**性质**: 只读发现，未修改任何代码

---

## 一、总览

| 任务 | 负责人 | 发现数 | high | medium | low/info | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| **D1** | codex | 10 | 2 | 5 | 3 | 可复现探针脚本 |
| **D2** | antigravity | 6 | 1 | 4 | 1 | 14 组截图+dump |
| **D3** | antigravity | 5 | 1 | 3 | 1 | 8 张多视口截图 + 网络抓包 |
| **D4** | workbuddy | 9 | 0 | 2 | 7 | 31 场景实跑 + 4 端到端 |
| **合计** | | **30** | **4** | **14** | **12** | |

**四个 agent 均按 brief 要求使用运行时验证**（非只读代码），符合「避免同源盲区」的设计意图。

---

## 二、High 级发现（4 条）

### H1. D1-F1 — 并发备用 CDN 切换会清空共享主地址 🔴 **协调者引入**

**位置**：`shared/content-core/hongguo.js:711`

```javascript
stream.url = stream.backupUrl; stream.backupUrl = '';
```

**根因**：这是我在此前播放修复中新增 `backupUrl` 重试时**未考虑并发**。

两个并发 Range 请求共享同一 `stream` 对象：
1. 都读到 `backupUrl` 有值
2. 先完成者写 `url=backup`、`backupUrl=''`
3. 后完成者读到**已清空的 `backupUrl`**，把 `url` 写成了**空字符串**

**探针复现**：

```
targets=["main","main","backup","backup",""]  →  finalUrl=""  →  下次请求 "empty URL"
```

**影响**：seek 或分片在并发下可能拿到空 URL。

**影响面确认**（协调者核实）：该 bug 存在于**三份引擎副本**：

```
shared/content-core/hongguo.js:711     ← 存在
custom-server/vendor/hongguo.cjs:711   ← 存在
server/vendor/hongguo.cjs:711          ← 存在
```

**来源确认**（`git show HEAD` 对比）：HEAD 版本**没有 `backupUrl`**，确认是本轮播放修复新增的代码。

**我的责任**：此 bug 由我的改动引入，**必须记录并优先修复**。

**修复方向**（D1 建议）：把本次备用目标保存在**局部不可变变量**，并发成功后的状态切换使用稳定目标。

---

### H2. D1-F2 — 媒体响应已开始后失败，后端不终止连接

**位置**：`custom-server/index.mjs:791-818`（流循环）、`custom-server/index.mjs:464-465`（json 在 headersSent 时直接返回）

**探针证据**：

| 实现 | 结果 |
|---|---|
| 当前 custom-server | `{status:206, bytes:1048576, hung:true}` |
| `server/http.mjs` 对照 | `{status:206, bytes:1048576, aborted:true}` |

**根因**：分片失败后 `catch` 调 `json(res, ...)`，但 `headersSent` 时 `json` 直接 return，**没有 `res.end` / `res.destroy`**。

**影响**：播放器持续缓冲，连接与客户端资源不能及时释放。

**注意**：`server/http.mjs` 的正确实现**已经存在**，custom-server 未采用。

---

### H3. D2-F1 — 全局 BACK 键拦截导致软键盘激活时退出整页

**位置**：`MainActivity.kt:1428-1433`

**证据**：`t-d2-search-focused-*.png` → `t-d2-search-back-exit-*.png`

**根因**：`dispatchKeyEvent` 无条件拦截 BACK 的 `ACTION_UP` 并执行 `back()`，**不判断软键盘是否显示**。

**影响**：用户在搜索页输入时按返回（本意收键盘）→ 整个页面销毁、输入丢失。

---

### H4. D3-F1 — App.tsx 4053 行单文件巨石组件

**位置**：`apps/web-pc/src/App.tsx:1-4053`

**证据**：源码审查（100+ useState、24 useEffect、20+ useRef）+ 浏览器 DevTools

**影响**：秒级播放进度更新迫使 4053 行虚拟 DOM 树频繁重渲染，CPU/GC 压力，且极易引入闭包陈旧值与状态竞态。

**这是明确的技术债**，D3 报告第五节给了拆分方案。

---

## 三、Medium 级发现（14 条）

### D1（5 条）

| ID | 标题 | 位置 |
| --- | --- | --- |
| D1-F3 | 取流失败时画质接口仍虚构 1080P | `custom-server/index.mjs:720-745` |
| D1-F4 | 206 响应只检查长度，不检查字节偏移 | `shared/content-core/hongguo.js:690-703` |
| D1-F6 | CENC 轨道解析借用后续轨道的辅助加密表 | `hongguo.js:554-562, 571-578` |
| D1-F7 | 主后端引擎缓存无容量上限 | `custom-server/index.mjs:86-110` 等 |
| D1-F8 | 相同视频元数据并发请求未合并 | `hongguo.js:488-498, 677-687` |

**D1-F4 值得注意**：探针 `range-offset-not-validated` 显示请求 `bytes=10-13` 而服务端返回 `bytes 0-3/100`，**仍被接受**。若 CDN 返回等长错误偏移，会导致视频损坏。

### D2（4 条）

| ID | 标题 | 位置 |
| --- | --- | --- |
| D2-F2 | 5 秒定时器强制隐藏 chrome 并夺焦 | `MainActivity.kt:587-601` |
| D2-F3 | 分类筛选重载销毁视图树造成白屏闪烁 | `MainActivity.kt:943` |
| D2-F4 | 选集抽屉分组 Tab 点击后焦点被抢占 | `EpisodeDrawerView.kt:118-123` |
| D2-F5 | Manifest 缺屏幕自适应配置致重建丢状态 | `AndroidManifest.xml:9-10` |

> **D2-F2 解开了我的困惑**：我在 U6 验收时遇到的「焦点丢失、RIGHT 变 seek」，**根因就是它** —— 不是我的操作问题，是 5 秒定时器强行夺焦。此前记为技术债 D3，现已有精确定位。

### D3（3 条）

| ID | 标题 | 位置 |
| --- | --- | --- |
| D3-F2 | useEffect 依赖混乱导致 API 重复请求 2~4 次 | `App.tsx:300-342` |
| D3-F3 | PC 播放弹窗缺 Escape 退出 | `App.tsx:1080-1202` |
| D3-F4 | 搜索防抖缺请求代际控制，有竞态覆盖风险 | `App.tsx:641-692` |

**D3-F2 有硬证据**（DevTools 抓包）：

```
reqid=23 GET /api/category/tags?type=real-drama [200]
reqid=25 GET /api/category/tags?type=real-drama [200]  <-- 重复
reqid=28 GET /api/category/tags?type=real-drama [200]  <-- 第3次
reqid=30 GET /api/category/tags?type=real-drama [200]  <-- 第4次
```

### D4（2 条）

| ID | 标题 | 位置 |
| --- | --- | --- |
| D4-F1 | importLegacy 水位线判断无视时间，清空后新数据被丢弃 | `history-store.mjs:150` |
| D4-F2 | 导入桥接循环内逐条 `snapshot()`，大库下阻塞事件循环 | `custom-server/index.mjs:80` |

**D4-F2 量化**：`snapshot()` 单价 ~7.9ms@3000 条；最多 10000 条目 → 万次级全表扫描，**估算分钟级阻塞**。

---

## 四、Low / Info 级（12 条）

| 来源 | 数量 | 代表 |
| --- | --- | --- |
| D1 | 3 | F5 Range 解析接受多段、F9 解密线性扫描、F10 codec 统一 hvc1（**推测**） |
| D2 | 1 | F6 硬编码上下寻焦映射（**静态推断**） |
| D3 | 1 | F5 静态资源 404 |
| D4 | 7 | F3~F9（无外层事务、ack 无界增长、热路径全量计算等） |

---

## 五、发现质量评估

### 优秀之处

1. **D1 提供了可复现探针脚本**（`t-d1-playback-discovery-probes.mjs`），我已独立运行验证，**10 组探针全部复现**
2. **D4 跑了 31 个场景 + 4 个端到端**，并**主动排除了一个错误假设**：
   > 「pending() 上限 256，>256 积压可分批排空（**排除「推 256+ 死锁」假设**）」
3. **D2/D3 证据文件命名规范**，PNG 签名均校验通过
4. **三者都明确列出了「已排查未发现问题」与「无法覆盖」的区域**

### 诚实性

- D1-F10 明确标注 `verified: false`（静态推断，未取得真实 AVC 加密样本）
- D2-F6 同样标注 `verified: false`
- D1 报告注明「构造场景 verified=true 表示条件下可复现，**不代表全部真实视频已发生同一故障**」

**这符合规范要求** —— 区分「已核实」与「推测」。

---

## 六、交叉印证

两条独立发现指向同一机制：

| 来源 | 描述 |
| --- | --- |
| 协调者（U6 验收时） | 「焦点丢失，RIGHT 变 seek」 |
| D2-F2 | 「5 秒定时器强行隐藏 chrome 并夺焦」 |

**D2-F2 解释了协调者的观察**，证明这不是操作失误。此前记录的技术债 D3 可升级为「已定位的 medium bug」。

---

## 七、给用户的处置建议

### 优先级排序（按 影响 × 修复成本）

| 优先级 | 项 | 理由 | 成本 |
| --- | --- | --- | --- |
| **P0** | **D1-F1**（并发清空 URL） | **协调者引入的回归**，影响播放 | small |
| **P0** | **D1-F2**（中途失败不终止） | 连接泄漏，已有正确实现可参考 | small |
| **P1** | D2-F1（BACK 退出整页） | 用户可感知，输入丢失 | small |
| **P1** | D4-F1 + D4-F2 | 数据丢失观感 + 服务卡死 | small |
| **P1** | D3-F2（API 重复 4 次） | 后端无谓负载 | small |
| **P2** | D2-F2（夺焦） | 体验受损，已定位 | small |
| **P2** | D1-F3 / D1-F4 | 误导性数据 / 潜在损坏 | small |
| **P3** | D1-F6 / D1-F7 / D1-F8 | 结构性改进 | medium |
| **P4** | **D3-F1**（App.tsx 拆分） | 最大技术债，但成本 large | large |

### 建议

1. **立即修 P0 两项** —— D1-F1 是我的回归，D1-F2 有现成正确实现
2. **P1 一批修** —— 都是 small 成本、用户可感知
3. **D3-F1 单独立项** —— 4053 行拆分是工程量大、收益长期的工作

---

## 八、产出物

| 文件 | 说明 |
| --- | --- |
| `t-d1-playback-discovery-codex.md` | D1 报告（226 行） |
| `t-d1-playback-discovery-probes.mjs` | **可复现探针脚本**（协调者已独立运行验证） |
| `t-d1-playback-discovery-evidence.json` | 探针原始结果 + 文件 SHA-256 |
| `t-d2-tv-ui-discovery-antigravity.md` | D2 报告（236 行）+ 14 组截图/dump |
| `t-d3-web-ui-discovery-antigravity.md` | D3 报告（212 行）+ 8 张截图 |
| `t-d4-sync-discovery-workbuddy.md` | D4 报告（241 行）+ 31 场景 |
| `discovery-spec.md` | 本轮统一规范 |

---

## 九、状态

**D1–D4 全部完成。** 本轮为**发现类任务，未修改任何业务代码**。

**待用户决定**：是否派发修复任务，以及优先级。
