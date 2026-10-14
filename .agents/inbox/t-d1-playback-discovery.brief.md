# D1 播放链路与内容引擎 — Bug 发现 + 算法优化建议

**任务 ID**: `t-d1-playback-discovery`
**负责人**: codex
**依赖**: 无（可并行）
**协调者**: dsh
**性质**: **只读发现，禁止修改任何业务代码**

---

## 一、任务目标

发现播放链路与内容引擎中的 **bug** 与 **算法优化机会**。

---

## 二、审查范围

| 文件 | 行数 | 说明 |
| --- | --- | --- |
| `custom-server/index.mjs` | 770 | 本地后端，含播放代理、解密流、Range 分发 |
| `server/provider.mjs` | 139 | 内容 provider 封装 |
| `server/http.mjs` | ~200 | HTTP 层与 Range 处理 |
| `shared/content-core/hongguo.js` | 832 | **共享内容引擎**（签名/解密/CENC） |
| `custom-server/vendor/hongguo.cjs` | 832 | 同上（副本，与 shared 有细微差异） |
| `server/vendor/hongguo.cjs` | 832 | 同上 |

**注意**：`shared/content-core/hongguo.js` 与两份 vendor 副本**并非字节相同**（存在已知差异，如 `category_$` 兼容分支）。三方对比本身可能有发现。

---

## 三、重点方向（建议，不限于此）

### Bug 发现

1. **播放链路**：`resolveStream` → `prepareHeader` → `remoteRange` → `decryptPartial` 的错误处理
   - 失败时是否有资源泄漏（stream 未释放、连接未关闭）？
   - 上游返回异常格式时是否崩溃？
2. **Range 处理**：`byteRange` / `parseRangeHeader` 的边界条件
   - 多段 Range、超大偏移、负数、`bytes=-0` 等
3. **缓存**：`streamCache` / `videoInfoCache` / `webStreamCache` 的失效与内存增长
   - 是否有无界增长？TTL 是否合理？
4. **CENC 解密**：`prepareCencHeader` / `buildSamples` / `decryptPartial`
   - 边界样本、跨块解密、IV 计算是否有误？
5. **并发**：多个 Range 请求同时到达时的状态竞争

### 算法优化建议

1. **解密性能**：逐样本 `createDecipheriv` 的开销（每样本新建 cipher）
2. **Range 分块**：1MB 分块是否最优
3. **缓存策略**：TTL、容量上限、LRU 与否
4. **重复请求**：同一视频的并发请求是否可合并

---

## 四、强制方法要求

> 本项目已验证教训：**只读代码会漏掉问题**（协调者曾用单模式扫描漏掉 `TvUi.dp(context, N)`）。

**你必须实际运行代码，不能只做静态阅读。**

### 可用手段

1. **直接调用引擎**（推荐）：
   ```javascript
   // 用 vm 加载引擎，直接调函数
   const ctx = vm.createContext({ require, Buffer, URL, URLSearchParams, axios });
   vm.runInContext(src + "\nthis.api = {fetchVideoInfo, resolveStream, prepareHeader, remoteRange, decryptPartial, byteRange};", ctx);
   ```

2. **HTTP 实测**：本地服务在 `http://127.0.0.1:8788`
   ```powershell
   curl.exe -s -D - -o NUL -H "Range: bytes=0-1023" "http://127.0.0.1:8788/api/episodes/<id>/stream?quality=720P&seriesId=<sid>"
   ```

3. **构造边界输入**：直接调 `byteRange("bytes=-0", 100)` 等，对比预期

4. **真实数据**：`curl http://127.0.0.1:8788/api/series/7503745441910017049` 取真实 episode id

---

## 五、交付格式

写入 `.agents/shared/t-d1-playback-discovery-codex.md`。

每条发现用统一结构：

```json
{
  "id": "D1-F1",
  "severity": "high | medium | low",
  "category": "bug | algorithm",
  "title": "一句话",
  "location": "文件:行号",
  "evidence": "复现命令与输出 / 代码片段",
  "verified": true,
  "impact": "...",
  "suggestion": "...",
  "effort": "small | medium | large"
}
```

**必须包含**：

1. **发现汇总表**（按 severity 排序）
2. 每条发现的详细说明
3. **已排查但未发现问题的区域**（同样有价值）
4. **无法覆盖的区域**（如实说明）

---

## 六、硬性约束

1. **禁止修改任何业务代码** —— 本轮是发现
2. 不执行 `git checkout` / `git reset` / `git clean`
3. `suggestion` 只写建议，不实施
4. **区分「已核实」与「推测」**：仅静态推断的必须 `verified: false` 并注明
5. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`
6. 设备/环境信息以实测为准（如 `getprop`），不要凭记忆

---

## 七、验收标准

1. 报告含**发现汇总表**，每条有精确 `文件:行号`
2. **至少 3 条 `verified: true`** 的发现（有实际运行证据）
3. 明确列出「已排查未发现问题」的区域
4. 明确列出「无法覆盖」的区域
5. 报告写入 `.agents/shared/t-d1-playback-discovery-codex.md`

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-d1-playback-discovery codex "结论及报告路径"
```
