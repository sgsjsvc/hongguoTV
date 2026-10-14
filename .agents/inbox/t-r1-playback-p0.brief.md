# R1 播放链路 P0 修复

**任务 ID**: `t-r1-playback-p0`
**负责人**: codex
**依赖**: 无（最高优先级）
**协调者**: dsh

---

## 一、修复目标

修复第四轮发现的两个 **high** 级播放链路缺陷：

| 发现 | 标题 |
| --- | --- |
| **D1-F1** | 并发备用 CDN 切换会清空共享主地址 |
| **D1-F2** | 媒体响应已开始后失败，当前后端不终止连接 |

**详见**：`.agents/shared/t-d1-playback-discovery-codex.md`

---

## 二、D1-F1 修复

### 问题

`shared/content-core/hongguo.js:711`：

```javascript
stream.url = stream.backupUrl; stream.backupUrl = '';
```

**根因**（协调者已复现确认）：两个并发 Range 请求共享同一 `stream` 对象时：
1. 都读到 `backupUrl` 有值
2. 先完成者写 `url=backup`、`backupUrl=''`
3. 后完成者读到**已清空的 `backupUrl`**，把 `url` 写成**空字符串**

**探针证据**（`t-d1-playback-discovery-probes.mjs`）：

```
concurrent-backup-clears-primary:
  targets=["main","main","backup","backup",""]
  finalUrl=""  →  下次请求 "empty URL"
```

### 来源说明

此 bug 由**协调者**在播放接口适配时新增 `backupUrl` 重试引入（`git show HEAD` 确认 HEAD 版本无 `backupUrl`）。

### 影响面

**三份引擎副本均存在**：

```
shared/content-core/hongguo.js:711
custom-server/vendor/hongguo.cjs:711
server/vendor/hongguo.cjs:711
```

### 修复方向（D1 建议）

- 把本次备用目标保存在**局部不可变变量**
- 并发成功后的状态切换使用**稳定目标**
- 考虑按 stream 合并故障切换

### 必须新增回归测试

用 D1 的探针场景（两请求均 main 失败、backup 成功）验证修复后 `finalUrl` 非空。

---

## 三、D1-F2 修复

### 问题

`custom-server/index.mjs:791-818`（流循环）+ `custom-server/index.mjs:464-465`（`json` 在 `headersSent` 时直接 return）

**探针证据**：

| 实现 | 结果 |
| --- | --- |
| 当前 custom-server | `{status:206, bytes:1048576, hung:true}` |
| `server/http.mjs` 对照 | `{status:206, bytes:1048576, aborted:true}` |

**根因**：分片失败后 `catch` 调 `json(res, ...)`，但 `headersSent` 时 `json` 直接 return，**没有 `res.end` / `res.destroy`**。

### 修复方向（D1 建议）

- **成功头之前**验证首分片
- 已发送响应后发生错误时**销毁响应**（`res.destroy()`）
- 未发送头时返回失败 JSON
- 检查断开时取消仍在运行的上游下载

### 重要参考

**`server/http.mjs` 已有正确实现**（`aborted: true`），请对照其做法。

---

## 四、硬性约束

1. **只改这些文件**：
   - `shared/content-core/hongguo.js`
   - `custom-server/vendor/hongguo.cjs`（同步）
   - `server/vendor/hongguo.cjs`（同步）
   - `custom-server/index.mjs`
2. **三方引擎副本必须同步** —— 但注意三方**并非字节相同**（第 138 行 `category_$` 兼容分支不同），**不能直接覆盖**
3. **不要回退**工作区其他改动
4. 保持 API 22 兼容（TV 端打包使用）
5. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`

---

## 五、验收标准

1. **D1-F1 回归测试**：并发场景下 `finalUrl` 非空（用 D1 探针场景）
2. **D1-F2 验证**：中途失败时连接被终止（对照 `server/http.mjs` 的 `aborted` 行为）
3. 三方引擎副本改动**一致**（用 `git diff` 核对）
4. `npm test` 全绿（当前 75 项）
5. `./gradlew :app:assembleDebug` 通过（TV 端打包共享引擎）
6. 报告写入 `.agents/shared/t-r1-playback-p0-codex.md`

---

## 六、报告要求

- **修复前的失败证据**（引用 D1-F1/F2 探针输出）
- **修复后的通过证据**（同一场景复测）
- 三方副本一致性核对（`git diff --stat`）
- 剩余风险

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r1-playback-p0 codex "结论及报告路径"
```
