# Q1 修复清晰度档位缺失（device_level 3 → 5）

**任务 ID**: `t-q1-device-level`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: 引擎 `requestVideoModel` 的请求参数

---

## 一、Bug 描述（用户报告 + 协调者已定位根因）

**用户报告**：

> 推荐页第一个有全部清晰度，后面的却没有，播放页也有全部清晰度。
> 而推荐页第二个短剧开始就只有 1080P 清晰度。

### 根因：上游按「集」返回不同 codec

**引擎调上游 `video_model` 时传 `device_level: 3`**，
上游对部分集只给低档位 `bytevc2`（私有编码）。

**我们过滤 `bytevc2`**（会导致 `PIPELINE_ERROR_DECODE` 崩溃），
**所以那些集只剩 1080P**（唯一 `bytevc1`）。

### 实测证据（同一部剧的不同集）

**第 1 集**（用户看到「只有 1080P」）：

| 档位 | vheight | codec | 可播 |
| --- | --- | --- | --- |
| video_1 | 360 | **bytevc2** | ❌ |
| video_2 | 480 | **bytevc2** | ❌ |
| video_3 | 576 | **bytevc2** | ❌ |
| video_4 | 720 | **bytevc2** | ❌ |
| video_5 | 1080 | bytevc1 | ✅ |

**第 3 集**（用户看到「全部清晰度」）：5 档**全部是 `bytevc1`**。

**推荐流前 8 部中 3 部「仅 1080P」** → 约 **1/3** 的剧集命中。
**18 个样本中 6 个受影响（33%）**。

**同一集连续 6 次请求结果稳定** → 不是随机抖动，是上游按集固定返回。

---

## 二、🎯 解法：`device_level` 改为 5

### 实验证据（参数变体对比）

| 参数变体 | 可播档位 | 总档位 |
| --- | --- | --- |
| **`device_level=3`（当前）** | **1** | 5 |
| **`device_level=5`** | **5** ✅ | 5 |
| `device_level=1` | 1 | 5 |
| `use_os_player=true` | 1 | 5 |
| `need_all_video_definition=false` | 0 | 1 |
| `video_platform=0` | 1 | 5 |
| `video_platform=2` | 错误 | — |

### 多剧多集验证（18 样本）

| 指标 | `device_level=3` | `device_level=5` |
| --- | --- | --- |
| **可播档位合计** | **66 / 90** | **90 / 90** ✅ |
| 改善样本 | — | **6 / 18** |
| 平均增益 | — | **+1.3 档/集** |

### 副作用评估（全部通过）

| 检查项 | 结果 |
| --- | --- |
| **1080P 是否降级** | ✅ **完全一致**（bitrate `915311`、size `12186702` 相同） |
| **连续 12 次请求** | ✅ **12/12 成功**，0 空响应，0 错误 |
| **档位映射** | ✅ 5 档全部 `bytevc1` |
| 视频时长/分辨率 | ✅ 无变化 |

---

## 三、任务目标

### 3.1 主修复（必须）

**位置**：`shared/content-core/hongguo.js:544`（`requestVideoModel` 内）

```javascript
// 修改前
biz_param: { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 },

// 修改后
biz_param: { detail_page_version: 0, device_level: 5, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 },
```

**必须加注释说明原因**（这是反直觉的改动）：

```javascript
// device_level=5：上游按设备等级决定低档位的编码。
// 用 3 时部分剧集的 360P–720P 只给 bytevc2（私有编码，标准解码器崩溃），
// 过滤后只剩 1080P；用 5 时这些档位返回 bytevc1（HEVC），5 档全部可播。
// 实测 18 个样本：可播档位 66/90 → 90/90，且 1080P 的 bitrate/size 完全不变。
```

### 3.2 同步 vendor 副本（必须）

**同样的 `device_level: 3` 在 3 个文件中**：

| 文件 | 行 |
| --- | --- |
| `shared/content-core/hongguo.js` | 544 |
| `custom-server/vendor/hongguo.cjs` | 544 |
| `server/vendor/hongguo.cjs` | 544 |

**三个都要改**（vendor 是回退副本，B1 任务刚修好其完整性）。

### 3.3 加回归测试（必须）

**要求**：新增测试，验证：

| # | 检查项 |
| --- | --- |
| 1 | `requestVideoModel` 的 payload 中 `device_level === 5` |
| 2 | 三个引擎副本的 `device_level` 一致 |
| 3 | 过滤 `bytevc2` 的逻辑仍生效（不回归） |

**建议**：新建 `tests/quality-tiers.test.mjs`，
或扩展 `tests/device-identity.test.mjs`（已有引擎加载基础设施）。

**测试应能捕获本 bug**（即改回 3 时测试失败）。

### 3.4 端到端验证（必须）

**要求**：用协调者提供的脚本实测，确认：

```powershell
node custom-server/index.mjs   # 启动（注意端口可能递增）
$env:BASE = "http://127.0.0.1:<实际端口>"
node scripts/perf/quality-device-level.mjs    # 应显示 90/90
node scripts/perf/quality-diff.mjs            # 「仅 1080P」应消失或大幅减少
```

**验收标准**：`quality-device-level.mjs` 输出
**「device_level=5: 可播档位合计 90 / 总档位 90」**。

---

### 3.5 TV 端同步（已确认无需手改）

协调者已核实 `apps/tv-android/app/build.gradle.kts`：

```kotlin
// 行 59-65
val bundledContentCore by tasks.registering(Copy::class) {
    from(rootProject.file("../../shared/category-contract.cjs"))
    from(rootProject.file("../../shared/content-core/hongguo.js"))   // ← 从这里复制
    from(rootProject.file("../../shared/recommendation-core.cjs"))
    into(layout.buildDirectory.dir("generated/content-assets"))
}
tasks.named("preBuild") { dependsOn(bundledContentCore) }
```

**即：Gradle 在 `preBuild` 时自动从 `shared/content-core/hongguo.js` 复制到 TV assets。**

**所以只改 `shared` 即可，TV 端会自动同步 —— 不要手改 TV 的 assets 或 Kotlin。**

---

## 四、硬性约束

1. **可改文件**：
   - `shared/content-core/hongguo.js`
   - `custom-server/vendor/hongguo.cjs`
   - `server/vendor/hongguo.cjs`
   - `tests/` 下新增测试
2. **不要改** `apps/web-pc/src/`（前端无需改动）
3. **不要改** `apps/tv-android/` 的 Kotlin 代码
   （TV 通过 Gradle 从 `shared/content-core/` 同步引擎，改 shared 即可）
4. **不要改** 过滤 `bytevc2` 的逻辑（那是正确的保护）
5. **不要改** `custom-server/index.mjs` 的 qualities 路由
6. 保持 `npm test` 全绿（当前 161 项）
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `shared` 的 `device_level` 为 5 | 代码核实 |
| 2 | 两个 vendor 副本同步为 5 | 代码核实 |
| 3 | 三处值一致 | 测试核实 |
| 4 | 有注释说明原因 | 代码核实 |
| 5 | **新增测试覆盖（且能捕获 bug）** | 测试通过 |
| 6 | **实测可播档位 90/90** | `quality-device-level.mjs` |
| 7 | 1080P 未降级 | bitrate/size 不变 |
| 8 | `npm test` 全绿 | |
| 9 | 报告写入 `.agents/shared/t-q1-device-level-codex.md` | |

---

## 六、验证方法

### 环境

```powershell
node custom-server/index.mjs
# 注意：端口可能递增（8788 被占用时会用 8789/8790）
# 从启动日志读取实际端口，或用 service-address.json
```

### 关键测量脚本（协调者提供）

```powershell
$env:BASE = "http://127.0.0.1:<端口>"

node scripts/perf/quality-diff.mjs             # 推荐流前 8 部档位
node scripts/perf/quality-device-level.mjs     # ★ 核心：L3 vs L5 对比
node scripts/perf/quality-side-effects.mjs     # 副作用评估
node scripts/perf/quality-param-experiment.mjs # 参数变体（需改脚本内的 level）
```

**注意**：脚本内的 `device_level` 是硬编码的实验值，
它们**直接调上游**（绕过引擎），所以能对比 3 与 5。
**修复后**，`quality-diff.mjs`（走服务端 → 引擎）应显示更多档位。

### 修复前后对比

| 脚本 | 修复前 | 修复后 |
| --- | --- | --- |
| `quality-diff.mjs` | 3/8 部「仅 1080P」 | 应大幅减少或为 0 |
| `quality-device-level.mjs` | L3=66/90 | 应显示 90/90 |

---

## 七、证据要求

1. **代码改动对比**（3 个文件 + 注释）
2. **新增测试的先失败后通过证据**（TDD 风格）
3. **`quality-device-level.mjs` 的输出**（应 90/90）
4. **`quality-diff.mjs` 修复前后对比**
5. **1080P 未降级的证据**（bitrate/size）
6. `npm test` 输出

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **三个副本都要改** | shared + 2 个 vendor |
| **服务端口会递增** | 8788 被占用时用 8789/8790，从日志读实际端口 |
| **不要改 bytevc2 过滤** | 那是正确保护，去掉会崩溃 |
| **device_level 是反直觉的** | 值越大反而「质量更好」，需注释说明 |
| **vendor 同步测试** | B1 刚加了符号校验测试，本次要确保仍通过 |
| PowerShell 编码 | 改含中文文件用 Node 或 edit 工具 |
| **TV 端同步** | Gradle preBuild 会从 shared 复制，不要手改 TV 的 assets |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-q1-device-level codex "结论及报告路径"
```
