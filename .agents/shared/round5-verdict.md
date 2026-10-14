# 第五轮验收报告（协调者 dsh）

**范围**: R1–R13 修复任务
**验收方**: dsh
**时间**: 2026-10-14 17:00
**结论**: ✅ **13/13 全部通过**

---

## 一、总览

| # | 任务 | 负责人 | 状态 | 验收 |
| --- | --- | --- | --- | --- |
| R1 | 播放链路 P0 | codex | `done` | ✅ |
| R2 | TV 焦点与导航 | antigravity | `done` | ✅ |
| R3 | 抽屉 Tab 抢焦 | antigravity | `done` | ✅ |
| R4 | Manifest 屏幕配置 | antigravity | `done` | ✅ |
| R5 | Web 交互缺陷 | antigravity | `done` | ✅ |
| R6 | Web 静态资源 | antigravity | `done` | ✅ |
| R7 | 拆分 App.tsx | antigravity | `done` | ✅ |
| R8 | 历史存储时序 | workbuddy | `done` | ✅ |
| R9 | 导入性能与事务 | workbuddy | `done` | ✅ |
| R10 | 资料库性能 | workbuddy | `done` | ✅ |
| R11 | 播放接口正确性 | codex | `done` | ✅ |
| R12 | 引擎结构优化 | codex | `done` | ✅ |
| R13 | 收尾清理 | codex | `done` | ✅ |

---

## 二、协调者独立验证

### 2.1 测试（亲自运行）

| 套件 | 结果 |
| --- | --- |
| `npm test`（正式集） | **93 项通过，0 失败** |
| R11+R12 独立测试 | **47 项通过，0 失败** |
| TV 单元测试 | **30 项通过，0 失败** |

**测试数演进**：19（基线）→ 30（T3）→ 75（第三轮）→ **93**（第五轮）

### 2.2 构建（亲自运行）

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run build` | 成功（1667 模块，348 KB） |
| `:app:assembleDebug` | BUILD SUCCESSFUL |
| `:app:lintDebug` | BUILD SUCCESSFUL |
| `:app:testDebugUnitTest` | 30 项通过 |

### 2.3 端到端播放（亲自运行）

引擎层直测真实视频 `7503780574541122622`：

```
resolveStream  ok, quality=720P key=16B
prepareHeader  total=11291532 samples=15479
decrypt        sample[0] lenPrefix=29 → PASS
```

**修复后真实视频仍能正常取流、建索引、解密。**

---

## 三、关键修复核实

### R1：协调者引入的 P0 回归

**D1-F1 修复**（局部快照 + 条件写回）：

```javascript
const primaryUrl = stream.url; const backupUrl = stream.backupUrl;
if (stream.url === primaryUrl) { stream.url = backupUrl; ... }
```

**D1-F2 修复**（销毁响应 + 取消上游）：

```javascript
if (res.headersSent) { res.destroy(); }
controller.abort();
```

**证据链**（协调者实跑）：

| | 结果 |
| --- | --- |
| 修复前基线 | `pass 1 / fail 9` |
| 修复后 | **`pass 10 / fail 0`** |

### R11：D1-F3 + D1-F4

**D1-F3**：`list.length === 0` 时返回 `defaultQuality: null, qualities: []`（不再虚构 1080P）

**D1-F4**：新增严格校验（超出 D1 建议）：

```javascript
const range = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(str(resp.headers['content-range']));
if (!range || Number(range[1]) !== start || Number(range[2]) !== end) throw new Error('媒体 Range 偏移不符');
const knownTotal = stream.prepared?.total || stream.rangeTotal;
if (!Number.isFinite(total) || total <= end || (knownTotal && knownTotal !== total)) throw new Error('媒体 Range 总长度不符');
```

**额外收益**：加了总长度一致性校验，防止跨源切换后复用不匹配的索引。

### R12：引擎优化（量化成果）

| 发现 | 修改 | 效果 |
| --- | --- | --- |
| F5 | Range 完整匹配，拒绝多段/尾随 | 非法前缀被拒 |
| **F8** | 视频 ID pending Promise 合并 | **12 并发 → 1 POST/1 GET** |
| **F7** | BoundedCache（metadata ≤100，stream ≤24） | 有界 |
| **F9** | 样本 end 二分定位 | **10001 → 14 次访问（约 714×）** |
| F6 | 按 box 尺寸与容器层级遍历 | 不再跨轨道借用 |

**证据文件** `t-r12-final-evidence.json`：

```json
{
  "replicasConsistent": true,
  "categoryCompatibilityPreserved": true,
  "endReadsBefore": 10001,
  "endReadsAfter": 14,
  "apkAssetMatchesSource": true
}
```

### R7：App.tsx 拆分

| | 行数 |
| --- | --- |
| 拆分前 | 4053 |
| **拆分后** | **682**（达成 `< 800` 目标） |

拆出 **17 个模块**：8 组件 + 8 hooks + 1 utils。

### R10：资料库优化（量化）

| 指标 | 修复前 | 修复后 | 变化 |
| --- | --- | --- | --- |
| `pending()` @1500 | 0.566–0.605 ms | **0.019–0.022 ms** | **约 28×** |
| `library_ack` 行数 | 1500 | **0** | 有界 |
| `snapshot()` @3000 | 5.79–6.53 ms | **3.29–3.67 ms** | 约 1.8× |

### R13：收尾清理

| 项 | 结果 |
| --- | --- |
| `Log.d("TvFocus")` 调试日志 | ✅ 已清理（0 处） |
| R1 测试纳入 `tests/playback-p0.test.mjs` | ✅ 已纳管 |
| `npm test` 测试数 | 75 → **93** |

---

## 四、R12 对 D1-F10 的诚实处理（值得记录）

**D1-F10 标注 `verified: false`**（静态推断），brief 要求「修复前必须先取得真实 AVC 加密样本验证」。

**R12 的处理**：

1. 做**实网验证**（`t-r12-real-media.json`），抽样真实分集
2. 确认 10 个档位**全是 `bytevc1`/`bytevc2`**，**无 AVC 加密样本**
3. **按 brief 允许的分支如实跳过**，未凭推测改 codec 恢复逻辑
4. 报告明确声明：

> F10 是允许跳过的未验证项，需要真实 AVC 加密样本再分派验证；**不是「所有编码已修复」**。

**这完全符合「区分已核实与推测」的纪律。** 协调者予以认可。

---

## 五、发现的问题

### P1（重要）运行中的服务未加载新代码

| 项 | 时间 |
| --- | --- |
| 8788 服务进程启动 | **10:33:10** |
| `hongguo.js` 修改 | 16:41:05 |
| `custom-server/index.mjs` 修改 | 16:25:06 |

**实测确认**：运行中的服务仍返回旧行为

```
GET /api/episodes/0/qualities
→ {"defaultQuality":"1080P", "qualities":[{key:"1080P", ...}]}   ← 旧代码
```

而源码已修复（含 `defaultQuality: null`）。

**原因**：R1/R11/R12 报告均声明「未重启服务，由 DSH 统一部署」—— 这是正确的边界遵守。

**处置**：需要重启 8788 服务使修复生效。

### P2（提示）R11/R12 测试未纳入正式集

R12 报告说明：

> R11/R12 新增测试目前仍需上述独立命令，未超出 R13 授权将它们额外搬入 tests。

**当前状态**：

- 正式集 `npm test`：93 项
- 独立命令（R11+R12）：47 项

**建议**：后续可将 R11/R12 测试也纳入 `tests/`，统一由 `npm test` 覆盖。

---

## 六、验收决定

**R1–R13 全部通过。**

**待处置**：

1. 重启 8788 服务（使第五轮修复生效）
2. 提交第五轮改动
3. （可选）将 R11/R12 测试纳入正式集

---

## 七、第四轮 30 项发现的修复覆盖

| 来源 | 发现数 | 已修复 | 说明 |
| --- | --- | --- | --- |
| D1 | 10 | 9 | **F10 跳过**（无 AVC 样本，如实报告） |
| D2 | 6 | 6 | 全部 |
| D3 | 5 | 5 | 全部 |
| D4 | 9 | 9 | 全部（F8/F9 文档化，符合 D4 建议） |
| **合计** | **30** | **29** | 1 项待样本 |

**修复率 29/30（96.7%）**，剩余 1 项因缺少验证样本而诚实跳过。
