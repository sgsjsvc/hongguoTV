# 播放接口上游变更修复方案

**日期：** 2026-10-13
**状态：** 待实施（本次仅诊断与方案，未改动任何代码）

**Goal:** 恢复 Web / Windows / Android TV 三端的视频播放。上游把 App 端播放接口换掉了，共享内容引擎需要跟着换。

**Architecture:** 只改共享引擎 `shared/content-core/hongguo.js` 的取流层（端点 + 响应解析），下游的 CENC 索引解析、AES-128-CTR 分段解密、Range 分发、TV 原生解密全部不动。

---

## 1. 根因

播放链路有两条独立分支，**同时**被上游改动打断。

### 1.1 主分支：`multi_video_model` 已被服务端拒绝

`requestVideoModel` 调用的端点现在对全部剧集返回业务错误：

```
POST https://api5-normal-sinfonlineb.fqnovel.com/novel/player/multi_video_model/v1/
→ HTTP 200  { "Code": 110001, "Message": "未知异常" }
```

抽样 4 部剧 × 12 集，`fetchVideoInfo` **12/12 全失败**。排除过程：

| 验证 | 结果 | 结论 |
| --- | --- | --- |
| 不带任何签名头 | 同样 `110001` | 不是签名被拒 |
| 换不存在的路径 | `404 Page not found` | 网关存活、路由存在 |
| 换 `video_model/v1` | `invalid param: video_id invalid` | 已进 handler，业务层拒绝 |
| 同签名函数打其他 fqnovel 接口 | 行为不变 | 签名层未失效 |
| 换 host / 换 v2 | 均 `110001` | 非单节点故障 |

### 1.2 兜底分支：官网 SSR 已不再下发直链

`custom-server/index.mjs` 的 `getOfficialWeb720pStream` 依赖 `video_player_info.main_url`，该字段已消失：

```
protectedPlayback: true
videoList: {}                 ← 空
video_player_info: null       ← 兜底读的就是它
```

官网前端已改为 `POST /api/video/protected/play-info`。两条分支同时失效，所以统一落到 `custom-server/index.mjs:961` 的 502。

### 1.3 症状映射

```
/api/episodes/:id/play       → 200   仅拼 URL，不代表可播
/api/episodes/:id/qualities  → 200   返回兜底假数据（1080P HEVC）
/api/episodes/:id/stream     → 502   ← 真正断点
```

首页 / 分类 / 搜索 / 详情 / 榜单全部 200，因此表现为「能刷剧、点开放不了」。三端共用同一份引擎源文件，故三端同时受影响。

---

## 2. 修复方案

`video_model/v1`（注意：**不是** `multi_video_model`）仍然可用，只是换了请求字段与响应结构。

### 2.1 请求：`video_id` 取代 `mixed_video_id_map`

`shared/content-core/hongguo.js:24` 常量改为：

```js
const VIDEO_API = 'https://api5-normal-sinfonlineb.fqnovel.com/novel/player/video_model/v1/';
```

`requestVideoModel`（`hongguo.js:439`）载荷改为：

```js
const payload = JSON.stringify({
  biz_param: { /* 保持现有 biz_param 不变 */ },
  video_id: str(vid),        // 纯字符串，不是数组、不是 map
});
```

实测 `video_id` 为字符串时返回 `BaseResp.StatusCode: 0`。传数组会报 `expected string, actual value: [...]`，传 map 会报 `video_id invalid`。

### 2.2 响应：读取新的 `video_model`

`modelForVideo`（`hongguo.js:451`）现在按 per-video map 取条目，新响应是**扁平对象**，会抛 `video_model 没有对应视频`。改为：

```js
function modelForVideo(data) {
  const raw = data?.data?.video_model;
  if (!raw) throw new Error('video_model 内容为空');
  const model = typeof raw === 'string' ? jsonBody(raw) : raw;
  if (!model || !Array.isArray(model.video_list)) throw new Error('video_model 缺少 video_list');
  return model;
}
```

注意 `data.video_model` 是 **JSON 字符串**，需要二次解析。

### 2.3 两条下游路线，推荐 A

新响应同时提供 `video_list`（明文 `https://` 直链）和 `fallback_api`（需 spade 解密的密文链）。

**路线 A（推荐，最小改动）**：`fetchVideoInfo` 保持走 `fallback_api`。新模型的 `fallback_api` 仍返回 `key_seed`，`video_list` 仍带 `spade_a`，与现有 `resolveStream` 完全兼容 —— 下游一行不用改。

**路线 B（省一次网络往返）**：直接读 `model.video_list`。但必须注意：这些 URL 是**明文**的，而 `resolveStream`（`hongguo.js:680-681`）在 `key_seed` 存在时会无条件调用 `decryptSpadeUrl`，对明文 URL 会抛 `spade URL header format error` 且**未被捕获**。选 B 就必须同时去掉 key_seed 解密，或加明文判断。

两条路线均已端到端验证，各 5/5 通过。建议先做 A 恢复可用，B 作为后续优化。

### 2.4 附带修复：`qualityNumber(960)` 映射错误

`qualityNumber`（`hongguo.js:466`）的分辨率映射表缺 `960`，导致 540P 选档失败：

```
qualityNumber("540p") = 540   ✓
qualityNumber(960)    = 960   ✗  应为 540（540p 即 960x540）
```

`qualityRows` 用 `vheight`（960）填 `quality` 字段，`resolveStream` 据此匹配，因此**选 540P 会静默回退到 rows[0]（1080P）**。修复：在映射表补 `'960': 540`。

### 2.5 附带修复：CDN 主机偶发 DNS 失败

实测同一剧集在不同时间被分配到不同 CDN 主机，其中部分主机出现瞬时 `ENOTFOUND`（同一主机稍后 20/20 恢复）：

```
v95-bjb-mc-reading-video.qznovelvod.com   → 曾 0/5 失败，后 20/20 恢复
v5-se2-bjtc-reading-video-a.qznovelvod.com → 5/5
```

`video_list` 每档同时给出 `main_url` 与 `backup_url`（指向不同主机），但 `remoteRange`（`hongguo.js:686`）只用 `stream.url`。建议在 `prepareHeader` / `remoteRange` 失败时重试 `backup_url`。加了该重试后 8/8 通过。

### 2.6 需要同步的副本

`shared/content-core/hongguo.js` 是唯一维护源，但存在两份独立副本需要同样改动，否则独立包会带着旧引擎发布：

- `custom-server/vendor/hongguo.cjs`
- `server/vendor/hongguo.cjs`

两者与共享源**并非字节相同**（`hongguo.cjs:138` 的 `category_$` 兼容分支缺失），因此不能直接覆盖，需手工同步同一处改动。运行时优先加载 `shared/`（见 `custom-server/index.mjs:88-90` 与 `server/provider.mjs:9`），所以开发环境只需改共享源即可验证。

Android TV 由 Gradle `preBuild` 复制共享源进 APK（`apps/tv-android/app/build.gradle.kts:27-33`），无需单独改代码，重新构建即可。

### 2.7 可清理的死代码

修复后以下分支永远走不到，建议一并删除以免误导：

- `custom-server/index.mjs:195-232` `getOfficialWeb720pStream`（`video_player_info` 已不存在）
- `custom-server/index.mjs:828-875` 720P Web 优先分支
- `custom-server/index.mjs:930-959` 引擎不可用时的 Web 兜底
- `hongguo.js:423` `videoModelUrl`（未被引用）

---

## 3. 验证

### 3.1 快速回归（引擎层，秒级）

```powershell
node -e "…加载 shared/content-core/hongguo.js，对真实 vid 调 fetchVideoInfo + resolveStream + prepareHeader + decryptPartial…"
```

判据：`prepareHeader` 得到 `samples > 0`，`decryptPartial` 首样本长度前缀合法（`0 < prefix <= sampleSize`）。

### 3.2 端到端（服务层）

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:8788/api/episodes/7503780574541122622/stream?quality=720P&seriesId=7503745441910017049" -H "Range: bytes=0-1023"
```

判据：`206`（当前为 `502`），且响应体前 8 字节含 `ftyp`。

### 3.3 抽样覆盖

跨 ≥5 部真实剧、每剧 ≥2 集、全部 5 档画质（360P/480P/540P/720P/1080P）。本轮实测：路线 A 5/5、路线 B 5/5；扩大抽样 14/20 通过，6 例失败全部为 CDN 瞬时 DNS（2.5 的重试可消除）。

### 3.4 既有测试

```powershell
npm test          # Node 43 项
npm run typecheck
npm run build
```

注意 `tests/tv-content-api.test.mjs` 与 `apps/tv-android/.../StandaloneEngineTest.kt:86` 直接调用 `fetchVideoInfo`/`resolveStream`/`prepareHeader`，会真实访问上游 —— 修复后应保持通过；若因上游波动而红，属于网络而非逻辑回归。

---

## 4. 交付影响

修复后需要重新出包，因为引擎源文件被打进所有产物：

```powershell
npm run build:bundles
```

涉及 `outputs/bundles` 五平台 Web 包、Windows 桌面 ZIP、Linux x64/arm64 远程包，以及 TV APK（`apps/tv-android` 重新 `assembleDebug`）。

---

## 5. 风险

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| 上游再次变更 | 本轮已是同一端点第二次改版，App 端签名接口随时可能再变 | 把 2.1/2.2 的端点与字段集中在 `hongguo.js` 顶部常量，便于单点修改 |
| 明文直链方案（路线 B） | `video_list` 是明文 URL，可能被上游加签 | 优先采用路线 A（走 `fallback_api` + spade） |
| CDN 主机分配漂移 | 不同请求分配到不同主机，个别主机 DNS 不稳 | 落实 2.5 的 `backup_url` 重试 |
| 540P 静默回退 | 2.4 未修则用户选 540P 实际播 1080P，流量与体验都不符 | 一并修复并加断言 |
| 独立包与源码不同步 | vendor 副本未同步会发布旧引擎 | 2.6 纳入验收清单 |
