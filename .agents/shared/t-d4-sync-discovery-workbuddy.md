# D4 发现报告：资料库与同步算法（Bug + 优化建议）

- **复核方**：workbuddy（只读发现，未修改任何业务代码）
- **时间**：2026-10-14 12:30（Asia/Shanghai）
- **方法**：按 brief 强制要求构造测试实际运行，非静态阅读。31 个场景全部通过：
  - 27 个 store/HistoryStore 场景（`:memory:` 库）
  - 4 个真实 HTTP 端到端场景（真实 sync-server + LibrarySync 双设备）
  - harness 位于系统临时目录（`%TEMP%\d4-harness.mjs`、`%TEMP%\d4-e2e.mjs`），**未入库、未污染仓库**，可复现
- **审查范围**：`shared/library-store.mjs`、`custom-server/library-sync.mjs`、`custom-server/library-routes.mjs`、`custom-server/history-store.mjs`、`custom-server/index.mjs`（历史桥接段）、`apps/sync-server/*`、`shared/legacy-migration.mjs`

---

## 一、发现汇总表（按 severity）

| id | severity | category | title | location |
| --- | --- | --- | --- | --- |
| D4-F1 | medium | bug | importLegacy 水位线判断无视时间：清空后更新的旧数据仍被丢弃 | custom-server/history-store.mjs:150 |
| D4-F2 | medium | bug | 历史导入桥接在循环内逐条调用 snapshot()，大库下阻塞事件循环 | custom-server/index.mjs:80 |
| D4-F3 | low | bug | 导入循环注释声称外层事务，实际不存在；中途失败留部分提交 | custom-server/library-routes.mjs:14-16 |
| D4-F4 | low | algorithm | library_ack 无清理路径，随确认次数无界增长 | shared/library-store.mjs:63,126 |
| D4-F5 | low | algorithm | snapshot()/pending() 全量计算位于热路径，随库容量线性变慢 | shared/library-store.mjs:115-125；custom-server/library-routes.mjs:6 |
| D4-F6 | low | algorithm | 客户端显式 at 可回退 lastTime，窄窗口内破坏时序单调 | shared/library-store.mjs:76 |
| D4-F7 | low | bug | registerSession 接受最多 +5 分钟的未来 startedAt，时钟偏移客户端可重建已删除剧集 | custom-server/history-store.mjs:24,74-76 |
| D4-F8 | info | algorithm | seedTarget 把外来事件翻成 is_local=1，首次配置产生一次性上传放大 | shared/library-store.mjs:128-134 |
| D4-F9 | info | algorithm | 跨设备同毫秒平局按 deviceId 裁决，确定性但语义任意 | shared/library-store.mjs:51 |

---

## 二、发现详情

### D4-F1（medium / bug）importLegacy 水位线判断无视时间

```json
{
  "id": "D4-F1",
  "severity": "medium",
  "category": "bug",
  "title": "importLegacy 水位线判断无视时间：clear 之后更新的旧版数据仍被整体丢弃",
  "location": "custom-server/history-store.mjs:150",
  "evidence": "场景 I1（harness 实跑）：clear('tv') 生成水位线后，importLegacy 导入 updatedAt=水位线之后 60s 的条目 -> list('tv').length===0（被丢弃）；对照 registerSession 用 startedAt=now+1 注册同剧集 -> 成功入库。两个入口对同一状态给出了相反答案。",
  "verified": true,
  "impact": "旧版客户端（localStorage 迁移路径）在清空历史后的导入数据，即使观测时间晚于清空也被静默丢弃；与实时会话的时序策略不一致，造成数据丢失观感。",
  "suggestion": "importLegacy 增加时间比较：updatedAt > 水位线 deleted_at 才允许入库（与 registerSession:75-76 同构）；tombstone 检查可保持按 (series_id,source) 命中即跳过（重新观看走新会话路径）。",
  "effort": "small"
}
```

### D4-F2（medium / bug）导入桥接循环内逐条全量快照

```json
{
  "id": "D4-F2",
  "severity": "medium",
  "category": "bug",
  "title": "legacy importLegacy 桥接在 for 循环内逐条调用 libraryStore.snapshot()，大库下阻塞事件循环",
  "location": "custom-server/index.mjs:80",
  "evidence": "代码实证：该行对 historyStore.list() 的每个条目执行 if(!libraryStore.snapshot().history.some(...))。实测 snapshot() 单价（G1）：3000 条记录 ~7.9ms/次。最多 10000 条目 -> 万次级全表扫描+排序，Node 单线程事件循环被长时间霸占（估算分钟级）。",
  "verified": true,
  "impact": "POST /api/history/import 处理期间整个服务无响应（含播放与同步）；条目越多越慢，且随库容增长恶化。",
  "suggestion": "把 snapshot() 提到循环外一次，构建 Set<seriesId> 后逐条比对；或直接写 SQL 查询 library_records 的 history 键集合。",
  "effort": "small"
}
```

### D4-F3（low / bug）导入循环「外层事务」不存在

```json
{
  "id": "D4-F3",
  "severity": "low",
  "category": "bug",
  "title": "import 路由注释声称外层事务包裹整个迁移，实际无外层事务；中途失败留下部分提交",
  "location": "custom-server/library-routes.mjs:14-16",
  "evidence": "场景 H1（harness 实跑）：3 条迁移操作第 3 条非法（key 不匹配）-> 前 2 条已提交（snapshot 有 2 条），migration 标记未设置，客户端收到 400。重试时确定性 id（migration:<id>:<i>）去重后可补齐，无数据损坏。",
  "verified": true,
  "impact": "进程在第 2 条之后崩溃会留下未标记的部分导入（重试可自愈）；注释误导后续维护者以为具备原子性。",
  "suggestion": "用 store.transaction() 包裹「循环 + 标记」（注释本意）；或修正注释并文档化「部分提交 + 幂等重试」语义。",
  "effort": "small"
}
```

### D4-F4（low / algorithm）library_ack 无界增长

```json
{
  "id": "D4-F4",
  "severity": "low",
  "category": "algorithm",
  "title": "library_ack 确认表无任何清理路径，随同步事件数无界增长",
  "location": "shared/library-store.mjs:63（建表）,126（只 INSERT）",
  "evidence": "grep 全仓库：library_ack 仅 CREATE/INSERT/SELECT，无 DELETE/TTL。pending() 以 id NOT IN(SELECT ... WHERE target=?) 反连接，实测 1500 条已确认时 pending() ~0.68ms/次（G2），随表增长线性恶化。",
  "verified": true,
  "impact": "长期运行设备确认表持续膨胀；pending()/view() 每次同步 tick 都为此付费；数据库文件只增不减。",
  "suggestion": "按 target 清理「早于最旧未确认事件 revision」的 ack 行；或改 LEFT JOIN ... WHERE ack.event_id IS NULL 走索引；定期 VACUUM。",
  "effort": "small"
}
```

### D4-F5（low / algorithm）热路径全量计算

```json
{
  "id": "D4-F5",
  "severity": "low",
  "category": "algorithm",
  "title": "snapshot()/pending() 全表扫描+排序位于每次 GET /api/library 的热路径",
  "location": "shared/library-store.mjs:115-125；custom-server/library-routes.mjs:6",
  "evidence": "实测：3000 条记录 snapshot() ~7.9ms/次（G1）；1500 条已确认 pending() ~0.68ms/次（G2）。GET /api/library 每次都触发 snapshot()+sync.view()（后者又跑一次 pending()）；LibrarySync.tick() 结尾也再跑一次 pending()。",
  "verified": true,
  "impact": "库容到万级后每次页面请求与每秒同步 tick 都可能产生数十毫秒级计算；TV 端轮询时叠加。",
  "suggestion": "snapshot 结果按 revision 缓存（事件写入时失效）；pending() 用覆盖索引；tick() 结尾复用已计算的 pending 结果。",
  "effort": "medium"
}
```

### D4-F6（low / algorithm）显式 at 可回退 lastTime

```json
{
  "id": "D4-F6",
  "severity": "low",
  "category": "algorithm",
  "title": "客户端显式 at 可把 lastTime 回退，窄窗口内破坏设备内时序单调",
  "location": "shared/library-store.mjs:76",
  "evidence": "场景 B2（实跑）：write(at=1000) -> write(at=500) 后 getMeta('lastTime')===500（回退成立）；下一次自动 at 在间隔 >5min 时用 clock 自愈（实测返回~当前时钟），但若 last 仅略小于 clock 则 auto at=last+1 可能早于同设备既有事件。",
  "verified": true,
  "impact": "同设备显式时间戳（迁移/管理操作/回传事件）之后的紧邻写入可能获得非单调 at；compareEvents 兜底物化顺序，不丢数据，但事件流时序失真。",
  "suggestion": "本地写入时把 input.at 钳制为 >= lastTime（或在文档中明确 at 语义契约）。",
  "effort": "small"
}
```

### D4-F7（low / bug）未来 startedAt 通过删除检查

```json
{
  "id": "D4-F7",
  "severity": "low",
  "category": "bug",
  "title": "registerSession 接受最多 +5 分钟的未来 startedAt，时钟偏移客户端可在删除后重建剧集",
  "location": "custom-server/history-store.mjs:24（timestamp 钳制）,74-76（tombstone/watermark 比较）",
  "evidence": "场景 I2（实跑）：remove('S-x','tv') 生成墓碑后，registerSession(startedAt=now+290000) 成功注册且 saveProgress 被接受。timestamp() 的 Math.min(v, now+300000) 为时钟偏移容灾，但删除检查采信客户端声称时间。",
  "verified": true,
  "impact": "时钟快 5 分钟以内的客户端删除历史后重新观看，会被判定为「删除后的新观看」而重建该剧集记录（与 D4-F1 的时间盲区互为镜像）。",
  "suggestion": "删除判定改用服务端接收时刻，或把会话注册的未来容差收紧到秒级；至少文档化该窗口。",
  "effort": "small"
}
```

### D4-F8（info / algorithm）seedTarget 外来事件转本地

```json
{
  "id": "D4-F8",
  "severity": "info",
  "category": "algorithm",
  "title": "seedTarget 把外来（已接收）事件的 is_local 翻成 1，首次配置产生一次性上传放大与语义混淆",
  "location": "shared/library-store.mjs:128-134",
  "evidence": "场景 E1/J1（实跑）：先 receive 外来事件（is_local=0），seedTarget('new') 后该事件出现在 pending('new')——即被推给新远程；且只翻「记录优胜事件」，落选事件保持 0；seedTarget 幂等（meta 防重）。",
  "verified": true,
  "impact": "首次对接新远程时把整个家庭资料库（含其他设备的优胜事件）整体重推；dedupe 安全，但 is_local 语义（本地产生 vs 中转）被混淆，pending 统计放大。",
  "suggestion": "为 seed 事件打独立标记（如 is_seed）并发送后即清理；或发送合成快照而非翻标志位。文档化「seed=全量重推」语义。",
  "effort": "medium"
}
```

### D4-F9（info / algorithm）跨设备同毫秒平局按 deviceId 裁决

```json
{
  "id": "D4-F9",
  "severity": "info",
  "category": "algorithm",
  "title": "跨设备同毫秒平局按 deviceId 字典序裁决，确定性但语义任意",
  "location": "shared/library-store.mjs:51（compareEvents）",
  "evidence": "D1 场景（实跑）：同设备同 at，高 seq（后签发）的 set 胜过 clear —— 符合签发意图；跨设备探针：deviceId 'a' 的 clear 与 'b' 的 set 同 at 时 set 胜出（b>a），与真实签发顺序无关。现有测试（library.test.mjs:8-15）已把该行为固定。",
  "verified": true,
  "impact": "两台设备在同一毫秒分别执行「清空」与「写入」时，结果由 deviceId 字典序决定而非意图顺序；概率极低但属于未文档化的平局规则。",
  "suggestion": "维持现状但在协议文档中写明平局规则；或在事件中引入逻辑时钟（lamport）消歧。",
  "effort": "medium"
}
```

---

## 三、已验证成立的不变量（31/31 场景通过）

| 不变量 | 场景 | 结果 |
| --- | --- | --- |
| write() 幂等：同 id 同载荷去重，不产生第二行 | A1 | PASS |
| write() 同 id 异 at / 异载荷 -> 409，重试不能盗用身份（deviceId/seq 被保存值覆盖） | A2/A3/A4 | PASS |
| write() 显式未来 at 后，自动 at 单调续增（last+1） | B1 | PASS |
| write() 显式 at 可回退 lastTime，但自动 at 在 >5min 间隔时用时钟自愈 | B2 | PASS |
| receive() 同 id 同载荷去重 | C1 | PASS |
| receive() 非规范重发（同 id 异 at）-> 409 | C2 | PASS |
| receive(canonical) 同 id 异 at -> 更新存储与物化记录 | C3 | PASS |
| receive(canonical) 同 id 异载荷 -> 409 身份哨兵 | C4 | PASS |
| receive(clampFuture) 把 +1h 钳制到 +5min 内 | C5 | PASS |
| receive() 257 条 -> 400；256 条正常 | C6 | PASS |
| 同设备同 at，后签发（高 seq）的 set 胜过 clear（意图顺序） | D1 | PASS |
| 晚于 clear 的 set 重新可见 | D2 | PASS |
| delete 后的迟到 set 不能复活 | D3 | PASS |
| 单 kind 的 clear 不影响其他 kind | D4 | PASS |
| seedTarget 幂等、只翻优胜事件、外来优胜事件被推给新远程 | E1/J1 | PASS |
| 游标按 target 隔离；ack 按 target 隔离 | F1 | PASS |
| changes() 分页 hasMore/cursor 边界正确（空页不误报 hasMore） | F2 | PASS |
| pending() 上限 256，>256 积压可分批排空（**排除「推 256+ 死锁」假设**） | F3/E2E-1 | PASS |
| library_ack 只增不减（确认表无清理） | G3 | PASS |
| snapshot() ~7.9ms@3000 条；pending() ~0.68ms@1500 已确认（热路径成本实测） | G1/G2 | 实测 |
| 导入循环中途失败：前序提交、标记未设置、确定性 id 重试去重可补齐 | H1 | PASS |
| importLegacy 水位线无视 updatedAt（与 registerSession 策略不一致） | I1 | PASS（问题） |
| registerSession 接受 +4.8min 未来 startedAt（时钟偏移窗口） | I2 | PASS（问题） |
| **E2E-1** >256 离线积压两个 tick 排干，远程收齐 300 条，无死锁 | E2E | PASS |
| **E2E-2** +1h 未来 at 被服务端钳制，canonical 回显把本地副本改写一致 | E2E | PASS |
| **E2E-3** 双设备双向收敛（搜索/偏好互见），数据保留 | E2E | PASS |
| **E2E-4** ack 丢失后重复推送被指纹去重，不 409 | E2E | PASS |

## 四、已排查未发现问题的区域

1. **事务嵌套**：`write()/receive()/acknowledge()/seedTarget()` 各自最多开一个 BEGIN IMMEDIATE；`insert()/materialize()` 从不开事务——无嵌套 BEGIN 路径（代码走查 + 31 场景实测无反指）。
2. **canonical 指纹与 JSON 键序**：validateEvent 产出键序稳定，`{...previous,at}` 重算指纹与 incoming 一致（C3/C4 通过）。
3. **UNIQUE(device_id,seq) 冲突**：清晰转为 409 `device sequence was reused`（harness 意外触发后确认语义）。
4. **重试退避**：`library-sync.mjs:39` 已是指数退避（1s→2→4→8→16→30s 封顶），无需改为新的。
5. **批次上限 256**：`pending()` 默认 256、pull 循环 16 批/tick、服务端 receive 上限 256——三处对齐，E2E-1 证明不会死锁；brief 问「256 是否合理」，结论：**合理，维持**。
6. **同步服务鉴权**：SharedKey 用 timingSafeEqual + 定长 sha256 摘要；admin 资产公开、其余全鉴权（现有测试覆盖，未重复）。
7. **clockOffset 握手**：`configure()` 用 (started+now)/2 做 RTT/2 补偿，pull 时持续校准（代码核实）。

## 五、无法覆盖的区域

1. **真实多进程并发写**：`:memory:` 单连接无法模拟多进程对同一 SQLite 文件的并发（busy_timeout=5000 下的锁竞争行为）。
2. **长时间运行的 WAL 增长 / checkpoint 行为**：需要真实文件库长时观测。
3. **公网/高延迟下的同步表现**：本地回环 RTT≈0，无法观测 offset 累积与 10s 超时边界。
4. **10000 条 import 的完整墙钟时长**：只测了 snapshot() 单价并外推，未跑完整导入（避免污染真实数据）。
5. **D3（Web/PC）与 D2（TV）范围的 UI 行为**：不在本任务范围。

## 六、给协调者的处置建议

1. **D4-F1 / D4-F2 建议尽快排期**（均 medium，改动量 small）：一个是数据丢失观感，一个是服务卡死风险，且都集中在 legacy 兼容层，修复面小。
2. D4-F3/F4/F6/F7 可并入下一轮 TV/服务端维护任务；D4-F5 视库容增长再排。
3. D4-F8/F9 建议写入协议文档而非改代码（行为已被现有测试锁定）。
4. 本轮 harness（31 场景）可演进为回归测试的候选清单，建议由执行方落盘到 `tests/` 时逐条转化。
