# R8 历史存储时序缺陷修复

**任务 ID**: `t-r8-history-time`
**负责人**: workbuddy
**依赖**: 无（可并行）
**协调者**: dsh

---

## 一、修复目标

修复 D4 发现的 2 项历史存储时序缺陷：

| 发现 | 严重度 | 标题 |
| --- | --- | --- |
| **D4-F1** | medium | importLegacy 水位线判断无视时间，清空后新数据被丢弃 |
| **D4-F7** | low | registerSession 接受最多 +5 分钟未来 startedAt，可重建已删除剧集 |

**详见**：`.agents/shared/t-d4-sync-discovery-workbuddy.md`

---

## 二、逐项修复

### D4-F1 水位线无视时间

**位置**：`custom-server/history-store.mjs:150`

**证据**（D4 场景 I1 实跑）：

```
clear('tv') 生成水位线后
importLegacy 导入 updatedAt = 水位线之后 60s 的条目
→ list('tv').length === 0（被丢弃）
对照 registerSession 用 startedAt = now+1 注册同剧集 → 成功入库
```

**两个入口对同一状态给出相反答案。**

**建议**（D4）：`importLegacy` 增加时间比较 —— `updatedAt > 水位线 deleted_at` 才允许入库（与 `registerSession:75-76` 同构）。

---

### D4-F7 未来时间戳通过删除检查

**位置**：`custom-server/history-store.mjs:24`（timestamp 钳制）、`74-76`（tombstone/watermark 比较）

**证据**（D4 场景 I2 实跑）：

```
remove('S-x','tv') 生成墓碑后
registerSession(startedAt = now+290000) 成功注册且 saveProgress 被接受
```

**问题**：`timestamp()` 的 `Math.min(v, now+300000)` 是为时钟偏移容灾，但**删除检查采信客户端声称时间**。

**建议**（D4）：删除判定改用**服务端接收时刻**，或把未来容差收紧到秒级。

---

## 三、硬性约束

1. **只改 `custom-server/history-store.mjs`**
2. 不要改 `custom-server/index.mjs`（R9 负责）、`shared/library-store.mjs`（R10 负责）
3. **不要回退**工作区其他改动
4. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、验收标准

1. **D4-F1**：构造 I1 场景 → 清空后更新的数据**能入库**（与 registerSession 行为一致）
2. **D4-F7**：构造 I2 场景 → 未来 startedAt **不能**绕过删除标记
3. `npm test` 全绿（当前 75 项）
4. 报告写入 `.agents/shared/t-r8-history-time-workbuddy.md`

---

## 五、验证要求

**必须构造测试场景实际运行**（不能只读代码）：

```javascript
// 用 :memory: 或临时目录，不污染真实数据
```

D4 的 harness（`%TEMP%\d4-harness.mjs`）可作参考，但**未入库**，需自行重建场景。

---

## 六、证据要求

- **修复前后对比**：同一场景的运行输出
- 证据三件套（输出落盘 + 命令原文）
- 不污染真实数据库（用临时路径）

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r8-history-time workbuddy "结论及报告路径"
```
