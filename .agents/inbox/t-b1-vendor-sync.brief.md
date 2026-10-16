# B1 修复 vendor 回退副本（缺 upstreamStats 导致崩溃）

**任务 ID**: `t-b1-vendor-sync`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: 引擎副本同步 + 回退路径测试

---

## 一、Bug 描述（协调者已复现）

**`custom-server/index.mjs:91-92` 的回退逻辑**：

```javascript
const sharedEngine = new URL("../shared/content-core/hongguo.js", import.meta.url);
const cjsPath = fs.existsSync(sharedEngine) ? sharedEngine : new URL("./vendor/hongguo.cjs", ...);
```

**第 114 行的导出**：

```javascript
source + "\nthis.api = {fetchVideoInfo, resolveStream, ..., rankData, upstreamStats};"
//                                                               ^^^^^^^^^^^^^^ vendor 未定义
```

### 实测证据

```
✗ vendor 加载失败: upstreamStats is not defined
```

**已在打包产物中复现**：`outputs/bundles/hongguotv-web-win-x64`

### 影响

| 场景 | 结果 |
| --- | --- |
| 正常（shared 存在） | ✅ 不受影响 |
| **回退（shared 缺失/损坏）** | ❌ **崩溃** |

**即：回退保险在最需要它的时候不可用。**

---

## 二、vendor 与 shared 的差异（实测）

| 项 | shared | vendor |
| --- | --- | --- |
| 行数 | 1054 | 1015 |
| 字符数 | 76089 | 74609 |
| `deviceEntropy` | ✅ | ✅ |
| `freshDevice` | ✅ | ✅ |
| `upstreamStats` | ✅ | ❌ **缺失** |
| `requestVideoModel` 空体重试 | ✅ | ❌ **缺失** |
| 死代码 `videoModelUrl` | ✅ 已删 | ❌ **仍在** |
| `signedVideoRequest` 设备守卫 | ✅ 有 | ❌ **无** |

**vendor 独有行 8 条**（含 `videoModelUrl` 死代码、旧版 `signedVideoRequest`）。

---

## 三、任务目标

### 3.1 同步 vendor 副本

**要求**：让 `custom-server/vendor/hongguo.cjs` 与 `server/vendor/hongguo.cjs`
**具备与 shared 相同的功能**。

**方式由你判断**，可选：

| 方案 | 说明 |
| --- | --- |
| A | 直接复制 shared 内容（保持 `.cjs` 扩展名） |
| B | 用构建脚本生成（`scripts/build-bundles.mjs` 已有复制逻辑） |
| C | 添加自动同步机制 |

**注意**：vendor 的扩展名是 `.cjs`，但内容结构与 shared 相同（都是 CommonJS 风格）。

**在报告中说明你选的方式与理由。**

### 3.2 加回归测试（必须）

**当前无测试覆盖回退路径** —— 这是本 bug 未被发现的原因。

**要求**：新增测试，验证：

| # | 检查项 |
| --- | --- |
| 1 | vendor 定义了 `custom-server/index.mjs` 导出的**所有符号** |
| 2 | vendor 可用 `vm.runInContext` 成功加载（复现回退路径） |
| 3 | vendor 与 shared 的关键功能一致（`deviceEntropy`、`upstreamStats`、空体重试） |
| 4 | 两个 vendor 副本内容一致 |

**建议**：扩展现有的 `tests/device-identity.test.mjs`，
或新建 `tests/vendor-fallback.test.mjs`。

**关键**：测试应**从 `custom-server/index.mjs` 动态提取导出符号**，
这样以后新增导出时测试会自动覆盖。

### 3.3 防止复发（可选但推荐）

**考虑**：vendor 是手工维护的副本，容易再次过期。

**可选措施**：

| 方案 | 说明 |
| --- | --- |
| 构建时校验 | `build-bundles.mjs` 复制 vendor 后校验符号 |
| 测试守卫 | 上面的测试已能覆盖 |
| 自动生成 | 让 vendor 成为构建产物而非手工维护 |

---

## 四、硬性约束

1. **可改文件**：
   - `custom-server/vendor/hongguo.cjs`
   - `server/vendor/hongguo.cjs`
   - `tests/` 下新增或扩展测试
   - `scripts/build-bundles.mjs`（如需加校验）
2. **不要改** `shared/content-core/hongguo.js`（它是权威来源，已正确）
3. **不要改** `apps/web-pc/src/`（B2 的职责）
4. **不要改** `apps/tv-android/`（其他任务）
5. 保持 `npm test` 全绿（当前 161 项）
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | vendor 含 `upstreamStats` | 代码核实 |
| 2 | vendor 可成功加载（复现回退） | `vm.runInContext` 不抛错 |
| 3 | 两个 vendor 副本一致 | MD5 相同 |
| 4 | **新增测试覆盖回退路径** | 测试通过 |
| 5 | 测试能捕获本 bug（先失败后通过） | 提供证据 |
| 6 | `npm test` 全绿 | |
| 7 | 报告写入 `.agents/shared/t-b1-vendor-sync-codex.md` | |

---

## 六、验证方法

**协调者提供的排查脚本**：

```powershell
node scripts/perf/bughunt-vendor2.mjs          # vendor 符号检查
node scripts/perf/bughunt-bundle-vendor.mjs    # 打包产物验证
node scripts/perf/bughunt-engine-sync.mjs      # shared vs vendor 差异
```

**验收时必须用这些脚本复测**。

---

## 七、证据要求

1. **修复前后的 vendor 加载结果**（`bughunt-vendor2.mjs` 输出）
2. **新增测试的先失败后通过证据**（TDD 风格）
3. **两个 vendor 副本的 MD5**
4. `npm test` 输出
5. **打包产物验证**（重新打包后 `bughunt-bundle-vendor.mjs` 通过）

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **vendor 是手工副本** | 容易被遗忘，需测试守卫 |
| **`.cjs` 扩展名** | 内容结构与 shared 相同，不要被扩展名误导 |
| **导出符号动态提取** | 测试应从 index.mjs 读取，而非硬编码列表 |
| **两个副本都要改** | `custom-server/vendor` 与 `server/vendor` |
| PowerShell 编码 | 修改含中文的文件时用 Node 或 edit 工具，不要用 `Get-Content`+`Set-Content` |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-b1-vendor-sync codex "结论及报告路径"
```
