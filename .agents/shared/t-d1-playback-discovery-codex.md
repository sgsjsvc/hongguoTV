# D1 播放链路与内容引擎发现报告

负责人：codex。日期：2026-10-14（Asia/Shanghai）。任务：t-d1-playback-discovery。

本轮仅发现与建议，未修改业务代码，未提交、推送、重启既有服务或操作 TV。对当前已有播放修复进行审查，不使用历史 baseline 的错误替代现状。

## 发现汇总

共 10 项：9 项有运行证据，1 项为静态推测；high 2 项、medium 5 项、low 3 项。构造场景中的 verified=true 表示条件下可复现，不代表全部真实视频已发生同一故障。

| ID | 严重度 | 类别 | 状态 | 发现 |
| --- | --- | --- | --- | --- |
| D1-F1 | high | bug | 已核实 | 并发备用 CDN 切换会清空共享主地址 |
| D1-F2 | high | bug | 已核实 | 媒体响应已开始后失败，当前后端不终止连接 |
| D1-F3 | medium | bug | 已核实 | 取流失败时画质接口仍虚构 1080P |
| D1-F4 | medium | bug | 已核实 | 206 媒体响应只检查长度，不检查实际字节偏移 |
| D1-F6 | medium | bug | 已核实 | CENC 轨道解析会借用后续轨道的辅助加密表 |
| D1-F7 | medium | algorithm | 已核实 | 当前主后端自己的引擎缓存未设置容量或主动清理 |
| D1-F8 | medium | algorithm | 已核实 | 相同视频元数据并发请求未合并 |
| D1-F5 | low | bug | 已核实 | 共享引擎 Range 解析接受多段及尾随垃圾前缀 |
| D1-F9 | low | algorithm | 已核实 | 分段解密从头线性扫描样本索引 |
| D1-F10 | low | bug | 推测 | 加密视频样本入口统一改为 hvc1，未按原始 codec 恢复 |

## 详细发现

### D1-F1

```json
{
  "id": "D1-F1",
  "severity": "high",
  "category": "bug",
  "title": "并发备用 CDN 切换会清空共享主地址",
  "location": "shared/content-core/hongguo.js:706-712",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → concurrent-backup-clears-primary：两请求均先 main 失败、backup 成功；targets=[main,main,backup,backup,空字符串]，finalUrl=空字符串，下一请求报 empty URL。使用可控网络适配器运行未修改的 remoteRange。",
  "verified": true,
  "impact": "相同缓存 stream 被两个 Range 请求共享时，先完成者清空 backupUrl，后完成者从已清空字段写回 url，后续 seek/分片可能不可用。已核实构造场景中的状态竞争，未声称本轮真实 CDN 发生过此故障。",
  "suggestion": "将本次备用目标保存在局部不可变变量；并发成功后的状态切换使用稳定目标，考虑按 stream 合并故障切换。建议单独添加双请求故障回归。",
  "effort": "small"
}
```

### D1-F2

```json
{
  "id": "D1-F2",
  "severity": "high",
  "category": "bug",
  "title": "媒体响应已开始后失败，当前后端不终止连接",
  "location": "custom-server/index.mjs:791-818；custom-server/index.mjs:464-465",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → backend-midstream-failure-hangs：通过提取当前真实 HTTP handler 在随机本地端口运行，注入第二个分片失败；返回 206 后只发送 1048576/2097152 字节，800ms 观察窗内无 end/abort，客户端主动中止才结束。server/http.mjs 对照实现产生 aborted=true。",
  "verified": true,
  "impact": "中途网络失败后 catch 调用 json，而 json 在 headersSent 时直接返回；没有 res.end/res.destroy。播放器可能持续缓冲，连接和客户端资源不能及时释放。800ms 证明 handler 返回后响应未终止，不代表已测得无限等待时长。",
  "suggestion": "成功头之前验证首分片；已发送响应后发生错误时销毁响应，未发送头时返回失败 JSON；检查断开时取消仍在运行的上游下载。",
  "effort": "small"
}
```

### D1-F3

```json
{
  "id": "D1-F3",
  "severity": "medium",
  "category": "bug",
  "title": "取流失败时画质接口仍虚构 1080P",
  "location": "custom-server/index.mjs:720-745",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → qualities-fabricate-1080-on-error：真实 handler 在 fetchVideoInfo 抛错时返回 HTTP 200 和唯一 1080P HEVC。真实本机 GET /api/episodes/0/qualities 同样返回 defaultQuality=1080P；见 live-evidence.json。",
  "verified": true,
  "impact": "不可用分集或内容源失败被呈现成可选超清，前端无法区分真实可用档位与错误，误导用户及诊断。",
  "suggestion": "实际档位为空或获取失败时返回明确失败/不可播放状态，保留错误分类，不生成不存在的档位。",
  "effort": "small"
}
```

### D1-F4

```json
{
  "id": "D1-F4",
  "severity": "medium",
  "category": "bug",
  "title": "206 媒体响应只检查长度，不检查实际字节偏移",
  "location": "shared/content-core/hongguo.js:690-703",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → range-offset-not-validated：本地 HTTP fixture 对请求 bytes=10-13 返回 bytes 0-3/100 和 ABCD；使用真实 axios 调用 remoteRange 仍成功接受 ABCD。",
  "verified": true,
  "impact": "CDN 或缓存返回等长但错误偏移时，数据会按请求偏移进行解密和分发，可能引起视频损坏；本次没有观察到实际官方 CDN 的这种错包。",
  "suggestion": "严格解析 206 的 Content-Range 并比对 start/end/total；不合法时走备用源或失败。跨源切换时同时核验总长度及媒体身份，避免复用不匹配的 prepared 索引。",
  "effort": "small"
}
```

### D1-F6

```json
{
  "id": "D1-F6",
  "severity": "medium",
  "category": "bug",
  "title": "CENC 轨道解析会借用后续轨道的辅助加密表",
  "location": "shared/content-core/hongguo.js:554-562；shared/content-core/hongguo.js:571-578",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → cenc-parser-crosses-track-boundary：含 stsz/stsc/stco 的无 saiz 轨道单独解析返回 null；在后面追加有 saiz/saio 的轨道后，原轨道被解析成加密轨道，borrowedAuxSizes=[8]。parseTrack/findBox 使用当前源实现。",
  "verified": true,
  "impact": "findBox/boxBody 搜索到整个 moov buffer 末尾，不限制在当前 trak/stbl 内。混合明文/加密轨道或不支持的轨道形状可能被误建索引，导致对错误区段解密。已验证结构级构造输入，不代表现有官方样本均受影响。",
  "suggestion": "按 MP4 容器层级及边界遍历，不进行无界逐字节寻找；区分明文轨道和索引不支持的加密轨道，并对加密轨道解析失败明确报错。",
  "effort": "medium"
}
```

### D1-F7

```json
{
  "id": "D1-F7",
  "severity": "medium",
  "category": "algorithm",
  "title": "当前主后端自己的引擎缓存未设置容量或主动清理",
  "location": "custom-server/index.mjs:86-110；shared/content-core/hongguo.js:488-498；shared/content-core/hongguo.js:677-687；server/provider.mjs:128-138",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → cache-capacity-and-request-coalescing：150 个不同视频后 videoInfoCache=151、streamCache=150，无容量淘汰。主后端与 provider 分别创建 VM；provider 的 100 条定时清理不作用于 hgEngine 的 Map。",
  "verified": true,
  "impact": "不同剧集/画质缓存持续保留，prepared 中还可能持有 MP4 头及大量样本索引；TTL 只限制读取复用，不能等同于主动删除。容量行为已核实，长期真实内存占用和 OOM 尚未测量。",
  "suggestion": "为两个 VM 分别设容量/内存预算与 TTL 清理，适当共享元数据层；明确 LRU 访问更新及正在使用的 stream 的引用生命周期。",
  "effort": "medium"
}
```

### D1-F8

```json
{
  "id": "D1-F8",
  "severity": "medium",
  "category": "algorithm",
  "title": "相同视频元数据并发请求未合并",
  "location": "shared/content-core/hongguo.js:488-498；shared/content-core/hongguo.js:677-687",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → cache-capacity-and-request-coalescing：12 个并发 fetchVideoInfo(same) 产生 12 次模型 POST、12 次 fallback GET，最终只缓存 1 项。",
  "verified": true,
  "impact": "画质查询与媒体初始化同时发生时，可能重复签名、取模型和取档位，放大延迟及上游请求量，也可能生成不同 stream 对象而无法享受同对象 preparePromise 合并。本次未测量真实上游限流或延迟收益。",
  "suggestion": "按视频 ID 引入 pending Promise 合并；成功后缓存，失败后 finally 清理；按视频和最终档位合并 resolveStream，并确保 fresh 能明确绕过或替换旧请求。",
  "effort": "medium"
}
```

### D1-F5

```json
{
  "id": "D1-F5",
  "severity": "low",
  "category": "bug",
  "title": "共享引擎 Range 解析接受多段及尾随垃圾前缀",
  "location": "shared/content-core/hongguo.js:738-746；server/http.mjs:4-23",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → range-parser-mismatch：bytes=0-1,5-6、bytes=0-1junk 均得到 [0,1]；server/http 的严格 byteRange 对同值返回 null。换行示例仅为函数输入，不声称可通过 Node HTTP 头直接注入。",
  "verified": true,
  "impact": "共享 proxy/使用该解析函数的调用端将非法或多段 Range 当作单段处理；当前 Node 主后端使用严格 byteRange，因此不能把此发现说成其 HTTP Range 同样失效。",
  "suggestion": "共享解析正则完整匹配，明确拒绝多段与尾随字符；统一返回契约或通过适配器映射，保留非法和未提供 Range 的区别。",
  "effort": "small"
}
```

### D1-F9

```json
{
  "id": "D1-F9",
  "severity": "low",
  "category": "algorithm",
  "title": "分段解密从头线性扫描样本索引",
  "location": "shared/content-core/hongguo.js:658-670",
  "evidence": "node .agents/shared/t-d1-playback-discovery-probes.mjs → decrypt-slice-correctness-and-scan-cost：10000 个样本，读取末尾 16 字节时触发 10001 次 end 访问，表明每片从样本 0 开始找重叠区段。",
  "verified": true,
  "impact": "尾部 seek 或长剧集分片需反复扫描不相关样本；此处证明操作次数，没有测得用户可感知的卡顿或瓶颈，也不声称逐样本 cipher 本身是主要耗时。",
  "suggestion": "在有序且不重叠的索引上二分查找第一个重叠样本，随后顺序解密；若允许轨道样本交叠，先定义索引不变量。用真实样本规模 benchmark 后再决定优化优先级。",
  "effort": "small"
}
```

### D1-F10

```json
{
  "id": "D1-F10",
  "severity": "low",
  "category": "bug",
  "title": "加密视频样本入口统一改为 hvc1，未按原始 codec 恢复",
  "location": "shared/content-core/hongguo.js:640-650",
  "evidence": "静态推断：prepareCencHeader 对所有 encv 使用 replaceFourcc(header, encv, hvc1)，未读取原始 frma 决定输出 codec。未取得真实加密 H.264 样本作解码验证，verified=false。",
  "verified": false,
  "impact": "若后续内容源返回原始格式为 AVC 的 CENC 视频，统一标记 HEVC 可能造成解码失败。当前实测 HEVC 档位不证明此分支已经出错。",
  "suggestion": "按样本入口中的原始格式恢复 fourcc，并通过真实 AVC/HEVC 加密样本分别验证；拒绝未知 codec，避免对整个 header 进行字符串级全局替换。",
  "effort": "medium"
}
```

## 方法与可复现证据

- 可重复探针：`node .agents/shared/t-d1-playback-discovery-probes.mjs`。运行约 2 秒，退出码 0；10 个 probe group 均完成并通过对观测值的断言。**这些断言包含已知缺陷的观测值，不表示缺陷已修复。**
- 探针运行未修改的共享引擎；主后端 handler 从当前文件提取执行，只注入网络/资料接口测试依赖，不启动真实资料数据库。HTTP fixture 仅监听 127.0.0.1 随机端口，结束后关闭。
- 原始结果：`t-d1-playback-discovery-evidence.json`，包含六份范围文件的 SHA-256，以及运行前后哈希一致证明。
- 本机真实服务结果：`t-d1-playback-discovery-live-evidence.json`。真实 GET /health 为 200；非法分集 0 的画质接口仍返回假 1080P；分集 7503780574541122622 返回五档 HEVC。
- 对该真实分集抽查 360P、540P、720P、1080P 的 bytes=0-1023，均 HTTP 206、1024 字节、有效 ftyp 和对应 Content-Range。**这里只验证取流头，未验证完整视频解码、音频或播放持续性；未实测该分集 480P 媒体。**
- 运行 `node --test tests/server.test.mjs tests/tv-content-api.test.mjs`：6 项通过、0 项失败。前者验证 legacy HTTP 层，不能代替当前 custom-server 的故障路径测试；后者为模拟分类测试，不是上游视频验收。

## 已排查但未发现问题的区域

1. 严格 byteRange：bytes=-0、偏移达到文件末尾、倒置范围均被拒；超出末尾 end 和大于总长的 suffix 会正确截断。两层正常单段范围结果一致。
2. AES-128-CTR 分段对照：用 Node 加密已知明文，验证 6 种跨块/非对齐/末尾切片结果；IV 为全 FF，覆盖计数器回绕。没有在这些条件下发现 skip、相对样本偏移或 addCounter 错误。此为合成样本验证，不覆盖所有 CENC scheme。
3. 同一个 stream 的 prepareHeader：12 请求只取一次头，返回相同 prepared 对象；失败后 preparePromise 被清理，再尝试可成功。不能据此推断 fetchVideoInfo 或不同 stream 对象也实现了合并。
4. 当前 960 → 540 映射及 1080/540 排序对照通过；该历史问题在当前工作区已修复，未重复登记为缺陷。
5. 两份 vendor 与 shared 归一化行尾比较，仅第 138 行 category_$ 兼容分支不同，播放相关代码当前一致。这里是已知兼容差异，不算新的取流缺陷；所报告引擎问题也存在于对应 vendor 同行实现。
6. legacy server/http 中途失败会 res.destroy，流槽在 finally 释放；已有鉴权、请求校验、首片失败和 Range 回归通过。

## 无法覆盖及剩余问题

- 未启动浏览器或 Windows 桌面播放器，未做硬件解码、HEVC 支持、bytevc2 可播放性和声音验收；这些不能由 ftyp/首样本推定。
- 未操作 TV，也未验证其 Kotlin 原生 CDN 重试。当前任务仅聚焦列出的播放/内容引擎文件；不会认领其他 agent 的 UI 任务。
- 未做长期真实内存监控、逐 cipher 耗时 profiling 或 1MB/更小分片的性能比较，因此没有主张改变分片尺寸或 cipher 生命周期。
- 未覆盖全部官方剧集/每个画质，也未制造真实上游 DNS 故障。备用切换和错 Range 采用可控 fixture 保证复现，不通过重复请求干扰官方服务。
- CENC 的 fragmented MP4、subsample encryption、auxiliary flags/16-byte IV、完整轨道语义与未知 codec 支持没有完整验收。本报告的跨轨道问题有结构级实测；F10 仍是推测。
- 合成 crypto 对照证明切片处理局部正确，不是完整 CENC 文件格式正确性证明。
- 现有内容源仍依赖第三方兼容实现，接口、签名和 CDN 响应可能变化；本轮不修改算法、会话或访问凭据。

## 建议协调顺序

先单独派修复任务处理 F1/F2 并保留本轮场景为回归，再处理 F3/F4/F6，最后按真实负载评估 F7/F8/F9。F5 可与统一 Range 契约一起处理。F10 需先获得合法的真实编码样本验证。所有建议尚未实施；修复任务应明确文件负责人及 Web/Windows/TV 的共享引擎影响。
