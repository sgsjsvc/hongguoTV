# R11 播放接口正确性修复

**任务 ID**: `t-r11-playback-correctness`
**负责人**: codex
**依赖**: `t-r9-import-perf`（R9）**必须先完成** —— 同改 `custom-server/index.mjs`
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

R1 与 R9 都会改 `custom-server/index.mjs`，本任务也改它。**必须串行**。

---

## 一、修复目标

| 发现 | 严重度 | 标题 | 位置 |
| --- | --- | --- | --- |
| **D1-F3** | medium | 取流失败时画质接口仍虚构 1080P | `custom-server/index.mjs:720-745` |
| **D1-F4** | medium | 206 响应只检查长度，不检查字节偏移 | `shared/content-core/hongguo.js:690-703` |

**详见**：`.agents/shared/t-d1-playback-discovery-codex.md`

---

## 二、D1-F3 修复

### 问题

**位置**：`custom-server/index.mjs:720-745`

**探针证据**：

```
qualities-fabricate-1080-on-error:
  status: 200
  body: {defaultQuality:"1080P", qualities:[{key:"1080P", codec:"HEVC"}]}
```

真实本机 `GET /api/episodes/0/qualities` 同样返回 `defaultQuality=1080P`。

**影响**：不可用分集或内容源失败被呈现成**可选超清**，前端无法区分真实可用档位与错误。

### 建议（D1）

实际档位为空或获取失败时，返回**明确失败/不可播放状态**，保留错误分类，**不生成不存在的档位**。

> **注意**：这是兜底逻辑（`list.length === 0` 时补 1080P）。修复需考虑前端如何消费该响应 —— 检查 `apps/web-pc/src/App.tsx` 与 TV 端 `content-api.js` 的处理。

---

## 三、D1-F4 修复

### 问题

**位置**：`shared/content-core/hongguo.js:690-703`

**探针证据**：

```
range-offset-not-validated:
  requested: "bytes=10-13"
  returned:  "bytes 0-3/100"
  accepted:  true
  data:      "ABCD"
```

`remoteRange` **只检查长度，不校验实际字节偏移**。

**影响**：CDN 或缓存返回等长但错误偏移时，数据会按请求偏移解密分发，**可能引起视频损坏**。

### 建议（D1）

严格解析 206 的 `Content-Range` 并比对 `start/end/total`；不合法时走备用源或失败。跨源切换时同时核验总长度及媒体身份。

---

## 四、硬性约束

1. **只改这些文件**：
   - `custom-server/index.mjs`
   - `shared/content-core/hongguo.js`
   - `custom-server/vendor/hongguo.cjs`（同步）
   - `server/vendor/hongguo.cjs`（同步）
2. **三方引擎副本必须同步** —— 但**不能直接覆盖**（第 138 行有已知差异）
3. **不要回退 R1 的修复**（D1-F1 并发、D1-F2 中途失败）
4. **不要回退 R9 的修复**
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. **D1-F3**：取流失败时 qualities 接口**返回明确失败状态**，不再虚构 1080P
   - **回归检查**：前端（Web + TV）能否正确处理该响应？若不能，需一并说明
2. **D1-F4**：偏移不符时 `remoteRange` **拒绝**该响应（探针场景复测）
3. 三方引擎副本改动一致（`git diff` 核对）
4. `npm test` 全绿
5. `./gradlew :app:assembleDebug` 通过
6. 报告写入 `.agents/shared/t-r11-playback-correctness-codex.md`

---

## 六、D1-F4 的连带影响（重要）

`remoteRange` 被 `prepareHeader` 与流循环调用。**加严校验可能影响正常路径**，请：

- 用真实视频验证修复后**播放仍正常**（`curl` 取 206 + `ftyp`）
- 确认官方 CDN 返回的 `Content-Range` 格式符合预期
- 若发现官方 CDN 有合法但非常规的格式，**不要误杀**

---

## 七、证据要求

- **D1-F3**：修复前后 qualities 接口响应对比
- **D1-F4**：探针 `range-offset-not-validated` 复测 + 真实视频播放验证
- 三方副本一致性核对
- 证据三件套

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-r11-playback-correctness codex "结论及报告路径"
```
