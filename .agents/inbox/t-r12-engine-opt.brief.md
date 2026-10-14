# R12 引擎结构优化与 D1-F10 验证

**任务 ID**: `t-r12-engine-opt`
**负责人**: codex
**依赖**: `t-r11-playback-correctness`（R11）**必须先完成** —— 同改引擎三副本
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

R11 改 `hongguo.js` 三副本，本任务也改。**必须串行**。

---

## 一、任务目标

| 发现 | 严重度 | 类别 | 标题 |
| --- | --- | --- | --- |
| **D1-F6** | medium | bug | CENC 轨道解析借用后续轨道的辅助加密表 |
| **D1-F7** | medium | algorithm | 主后端引擎缓存无容量上限 |
| **D1-F8** | medium | algorithm | 相同视频元数据并发请求未合并 |
| **D1-F9** | low | algorithm | 分段解密从头线性扫描样本索引 |
| **D1-F5** | low | bug | 共享引擎 Range 解析接受多段及尾随垃圾 |
| **D1-F10** | low | bug | 加密样本统一改 hvc1，未按原 codec 恢复 |

**详见**：`.agents/shared/t-d1-playback-discovery-codex.md`

---

## 二、D1-F10 必须先验证（重要）

**该发现 `verified: false`**（静态推断）。D1 报告明确：

> 未取得真实加密 H.264 样本作解码验证

**修复前必须**：

1. 取得**真实 AVC（H.264）加密样本**验证是否真的出错
2. 若无法取得样本，**如实报告并跳过该项**，不要凭推断修改

**当前实测的 HEVC 档位不证明此分支已经出错。**

---

## 三、逐项修复

### D1-F6（medium）CENC 跨轨道借用

**位置**：`hongguo.js:554-562`（`findBox`/`boxBody`）、`571-578`（`parseTrack`）

**探针证据**：

```
cenc-parser-crosses-track-boundary:
  clearTrackHasSaiz: false
  aloneReturnedNull: true
  withFollowingEncryptedTrackParsedAsEncrypted: true
  borrowedAuxSizes: [8]
```

**根因**：`findBox`/`boxBody` 搜索到整个 moov buffer 末尾，**不限制在当前 trak/stbl 内**。

**建议**：按 MP4 容器层级及边界遍历，不进行无界逐字节寻找；区分明文轨道与索引不支持的加密轨道，解析失败明确报错。

---

### D1-F7（medium）缓存无容量上限

**位置**：`custom-server/index.mjs:86-110`、`hongguo.js:488-498, 677-687`、`server/provider.mjs:128-138`

**探针证据**：

```
cache-capacity-and-request-coalescing:
  after150Distinct: { videoCache: 151, streamCache: 150 }
```

**根因**：`custom-server` 与 `provider` **分别创建 VM**，`provider` 的 100 条定时清理**不作用于 `hgEngine` 的 Map**。

**建议**：为两个 VM 分别设容量/内存预算与 TTL 清理；明确 LRU 访问更新及正在使用的 stream 引用生命周期。

---

### D1-F8（medium）请求未合并

**探针证据**：

```
parallel: { posts: 12, gets: 12, cacheEntries: 1 }
```

12 个并发 `fetchVideoInfo(same)` → **12 次模型 POST + 12 次 fallback GET**。

**建议**：按视频 ID 引入 pending Promise 合并；成功后缓存，失败后 `finally` 清理；按视频和最终档位合并 `resolveStream`。

---

### D1-F9（low）解密线性扫描

**位置**：`hongguo.js:658-670`

**探针证据**：10000 个样本，读取末尾 16 字节触发 **10001 次** `end` 访问。

**建议**：在有序且不重叠的索引上**二分查找**第一个重叠样本；用真实样本规模 benchmark 后再决定优先级。

---

### D1-F5（low）Range 解析宽松

**位置**：`hongguo.js:738-746`

**探针证据**：

```
range-parser-mismatch:
  "bytes=0-1,5-6"  → engine [0,1], http null
  "bytes=0-1junk"  → engine [0,1], http null
```

**注意**：D1 明确「当前 Node 主后端使用严格 `byteRange`，**不能把此发现说成其 HTTP Range 同样失效**」。

**建议**：共享解析正则完整匹配，明确拒绝多段与尾随字符。

---

## 四、硬性约束

1. **只改这些文件**：
   - `shared/content-core/hongguo.js`
   - `custom-server/vendor/hongguo.cjs`（同步）
   - `server/vendor/hongguo.cjs`（同步）
   - `custom-server/index.mjs`（仅 D1-F7 相关）
   - `server/provider.mjs`（仅 D1-F7 相关）
2. **三方引擎副本必须同步** —— 但**不能直接覆盖**（第 138 行有已知差异）
3. **不要回退 R1 / R11 的修复**
4. **不要回退 R9 的修复**
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. **D1-F6**：跨轨道借用场景**不再误判**（探针复测）
2. **D1-F7**：两个 VM 的缓存**都有容量上限**（构造 150+ 不同视频验证）
3. **D1-F8**：并发请求**合并**（探针复测，posts/gets 降至 1）
4. **D1-F9**：线性扫描改为二分（给出前后访问次数对比）
5. **D1-F5**：非法 Range 被拒（探针复测）
6. **D1-F10**：**先验证** —— 有真实 AVC 样本则修，无则如实报告跳过
7. 三方副本改动一致
8. `npm test` 全绿
9. `./gradlew :app:assembleDebug` 通过
10. 报告写入 `.agents/shared/t-r12-engine-opt-codex.md`

---

## 六、重要：共享引擎影响三端

改动 `hongguo.js` 会**同时影响 Web / Windows / TV**。

**必须验证**：

- 修复后**真实视频仍能播放**（`curl` 取 206 + `ftyp`）
- **TV 端构建通过**（`assembleDebug`）
- 若条件允许，在 TV 模拟器上实测播放

---

## 七、建议实施顺序

按**风险从低到高**：

1. D1-F5（Range 解析，隔离性好）
2. D1-F8（请求合并，纯优化）
3. D1-F7（缓存上限，纯优化）
4. D1-F9（二分查找，纯优化）
5. D1-F6（CENC 解析，涉及解密正确性，**风险最高**）
6. D1-F10（**先验证**）

**每步保持可构建、可运行**，不要一次性大改。

---

## 八、证据要求

- 每项：**修复前后探针输出对比**
- **真实视频播放验证**（不能只跑探针）
- 三方副本一致性核对
- 证据三件套

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-r12-engine-opt codex "结论及报告路径"
```
