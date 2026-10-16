# Q2 修复清晰度档位推导（用 definition 而非 vheight）

**任务 ID**: `t-q2-quality-labels`
**负责人**: **codex**
**依赖**: Q1 已完成（`device_level=5`）
**协调者**: dsh
**范围**: 引擎的档位推导 + 三端同步

---

## 一、Bug 描述（Q1 暴露的既有缺陷）

### 现象

Q1 让档位齐全了，**但部分剧的档位名不是标准值**：

| 剧 | 当前显示档位 | 问题 |
| --- | --- | --- |
| 离婚后才知她是神明第二季 | `1924P/1282P/962P/642P/480P` | 标签非标准 |
| 开局系统逼我败家 | `1080P/544P/540P/480P/360P` | 544P 与 540P 重复感 |
| 公路求生榜一说她要走到公路尽头 | `1080P/496P/480P/360P` | **只有 4 档（丢了一档）** |

**实测比例**：24 部中 **2 部（8%）** 出现非标准标签。

### 根因：用变化的 `vheight` 而非权威的 `definition`

**上游每档都有 `definition` 字段，值是标准档位**，但代码用的是 `vheight`：

| key | vheight（代码在用） | vwidth | **definition（权威）** | codec |
| --- | --- | --- | --- | --- |
| video_5 | **1924** | 1080 | **"1080p"** | bytevc1 |
| video_4 | **1282** | 720 | **"720p"** | bytevc1 |
| video_3 | **962** | 540 | **"540p"** | bytevc1 |
| video_2 | 854 | 480 | "480p" | bytevc1 |
| video_1 | **642** | 360 | **"360p"** | bytevc1 |

### 致命案例：档位碰撞导致丢档

**公路求生**：

| key | vheight | vwidth | definition |
| --- | --- | --- | --- |
| video_3 | **496** | 864 | **"540p"** |
| video_4 | **496** | 864 | **"720p"** |

**两行 `vheight` 完全相同（496）** → 推导出的 key 都是 `496P`
→ 被 `seenKeys` 去重**丢掉一档** → 用户只看到 4 档。

### 为什么 Q1 之后才显现

Q1 之前这些档位是 `bytevc2`（被过滤），**问题不可见**。
Q1 让它们变成 `bytevc1` 可播，**问题随之暴露**。

**底层缺陷是既有的，Q1 只是把它暴露出来。**

---

## 二、🎯 修复方案：改引擎的 `qualityRows`

### 关键洞察

**Web（custom-server）与 TV（content-api.js）都从 `row.quality` 推导档位**：

```javascript
// custom-server/index.mjs:710
const qNum = hgEngine.qualityNumber(row.quality || row.item?.vheight || row.key);

// apps/tv-android/.../content-api.js:80
key: qualityNumber(row.quality) ? `${qualityNumber(row.quality)}P` : row.key.toUpperCase()
```

**而 `row.quality` 来自引擎的 `qualityRows`**：

```javascript
// shared/content-core/hongguo.js（qualityRows 内）
const quality = str(item.quality_desc || item.height || item.vheight || item.quality || key);
```

**`definition` 根本不在这个链里** —— 所以 `row.quality` 实际取到了 `vheight`。

**因此：只要在引擎里把 `definition` 加到链首，Web 与 TV 同时修好。**

### 修改点

**位置**：`shared/content-core/hongguo.js` 的 `qualityRows` 函数

```javascript
// 修改前
const quality = str(item.quality_desc || item.height || item.vheight || item.quality || key);

// 修改后（优先用权威的标准档位）
const quality = str(item.definition || item.quality_desc || item.height || item.vheight || item.quality || key);
```

**必须加注释**：

```javascript
// definition 是上游给出的标准档位标签（"1080p"/"720p"/...），
// vheight 则会因编码变体出现 1924/1282/962/642/496 等非标准值，
// 既导致档位名不规范，也会让不同的档位（如 540p 与 720p）算出同一个 key 而被去重丢档。
```

### 为什么这是单点修复

| 端 | 是否受益 | 原因 |
| --- | --- | --- |
| **Web / Windows** | ✅ | custom-server 用 `row.quality` |
| **TV** | ✅ | content-api.js 用 `row.quality`；且 Gradle `preBuild` 从 shared 复制引擎 |

**TV 无需手改** —— 协调者已核实 `build.gradle.kts:59-65` 会自动同步。

---

## 三、同步 vendor 副本

**引擎有 3 份**，都要改（与 Q1 相同）：

| 文件 | 说明 |
| --- | --- |
| `shared/content-core/hongguo.js` | 权威来源 |
| `custom-server/vendor/hongguo.cjs` | Web 回退副本 |
| `server/vendor/hongguo.cjs` | Bridge 回退副本 |

**B1 刚为 vendor 加了符号完整性测试，改动后要确保它仍通过。**

---

## 四、验证方法（协调者已提供脚本）

### 修复前后对比

```powershell
node custom-server/index.mjs   # 启动（端口可能递增，从日志读）
$env:BASE = "http://127.0.0.1:<端口>"

node scripts/perf/quality-derive-compare.mjs   # ★ 核心对比
node scripts/perf/quality-label-scan.mjs       # ★ 非标准标签比例
node scripts/perf/quality-odd-dump.mjs         # dump 原始字段
node scripts/perf/quality-diff.mjs             # 推荐流档位
```

### 验收标准

| 脚本 | 修复前 | 修复后 |
| --- | --- | --- |
| `quality-label-scan.mjs` | 2/30 部非标准 | **0 部** |
| `quality-derive-compare.mjs` | 8% 非标准 | **0%** |

**且必须确认**：公路求生那种「两行 vheight 相同」的剧**恢复为 5 档**。

### 单元级验证

**直接验证 `qualityRows` 的输出**：

```javascript
// 构造一行有 definition 的数据
const rows = qualityRows({
  video_5: { main_url: "x", vheight: 1924, definition: "1080p", codec_type: "bytevc1" }
});
// 修复前：rows[0].quality === "1924"
// 修复后：rows[0].quality === "1080p"
```

**并要求**：`qualityNumber(rows[0].quality) === 1080`。

---

## 五、加回归测试（必须）

**建议新建 `tests/quality-labels.test.mjs`**，覆盖：

| # | 检查项 |
| --- | --- |
| 1 | `qualityRows` 在有 `definition` 时优先使用它 |
| 2 | 无 `definition` 时回退到原链（`quality_desc`/`height`/`vheight`/`quality`/`key`） |
| 3 | **两个 vheight 相同但 definition 不同的行，推导出不同 key**（防丢档） |
| 4 | `qualityNumber("1080p") === 1080` 等映射正确 |
| 5 | 三个引擎副本的 `qualityRows` 一致 |

**测试应能捕获本 bug**（改回原链时应失败）。

---

## 六、硬性约束

1. **可改文件**：
   - `shared/content-core/hongguo.js`
   - `custom-server/vendor/hongguo.cjs`
   - `server/vendor/hongguo.cjs`
   - `tests/` 下新增测试
2. **不要改** `custom-server/index.mjs:710`（它用 `row.quality`，改引擎即可）
   —— 若你认为仍需改，请在报告中说明理由
3. **不要改** TV 的 `content-api.js`（引擎修好后它自动受益）
4. **不要改** `bytevc2` 过滤逻辑
5. **不要改** `device_level`（Q1 的成果，保持 5）
6. 保持 `npm test` 全绿（当前 178 项）
7. 当前 shell 是 **Windows PowerShell 5.1**

---

## 七、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `qualityRows` 优先用 `definition` | 代码核实 |
| 2 | 三处引擎副本一致 | 测试核实 |
| 3 | 有注释说明原因 | 代码核实 |
| 4 | **新增测试覆盖（且能捕获 bug）** | 测试通过 |
| 5 | **非标准标签降至 0** | `quality-label-scan.mjs` |
| 6 | **碰撞丢档修复**（同 vheight 不同 definition 不再丢档） | 测试 + 实测 |
| 7 | `device_level` 仍为 5 | 代码核实 |
| 8 | `npm test` 全绿 | |
| 9 | 报告写入 `.agents/shared/t-q2-quality-labels-codex.md` | |

---

## 八、证据要求

1. **代码改动对比**（3 个文件 + 注释）
2. **新增测试的先失败后通过证据**（TDD 风格）
3. **`quality-label-scan.mjs` 修复前后对比**（应 0 部非标准）
4. **碰撞丢档的修复证据**（同 vheight 不同 definition 的剧恢复 5 档）
5. **`device_level` 仍为 5** 的证据
6. `npm test` 输出

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **`definition` 可能缺失** | 必须保留原有回退链，不能只写 `item.definition` |
| **`definition` 带 "p"** | `"1080p"`，但 `qualityNumber` 正则能匹配数字，无需额外处理 |
| **三个副本都要改** | shared + 2 个 vendor |
| **不要破坏 Q1** | `device_level` 保持 5 |
| **B1 的 vendor 测试** | 改动后要确保符号完整性测试仍通过 |
| **服务端口递增** | 8788 占用时用 8789/8790，从启动日志读实际端口 |
| **TV 无需手改** | Gradle preBuild 自动同步 |
| PowerShell 编码 | 改含中文文件用 Node 或 edit 工具 |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-q2-quality-labels codex "结论及报告路径"
```