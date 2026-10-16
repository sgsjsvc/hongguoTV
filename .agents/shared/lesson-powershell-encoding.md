# 教训：PowerShell 写文件会破坏 UTF-8 中文

**记录方**: dsh
**日期**: 2026-10-16
**影响**: 7 个文件被破坏，其中 5 个已提交入库

---

## 一、事故经过

在提交 `ddf0ad5`（把测量脚本从 `outputs/debug/` 移到 `scripts/perf/`）时，
我用 PowerShell 批量替换文档中的路径：

```powershell
$c = Get-Content $f -Raw
$c = $c -replace 'outputs/debug/', 'scripts/perf/'
Set-Content -Path $f -Value $c -Encoding UTF8 -NoNewline
```

**结果：文件中的中文全部变成乱码。**

### 被破坏的文件（7 个）

| 文件 | 乱码数 |
| --- | --- |
| `.agents/shared/codex-ready.md` | 61 |
| `.agents/shared/workbuddy-ready.md` | 59 |
| `.agents/shared/antigravity-ready.md` | 54 |
| `.agents/shared/perf-baseline.md` | 21 |
| `.agents/shared/perf-algorithm-verdict.md` | 13 |
| `.agents/inbox/t-p1-detail-cache.brief.md` | 7 |
| `.agents/inbox/t-p4-tv-render.brief.md` | 9 |

**典型乱码**：

```
## 鈿狅笍 閲嶈锛氫换鍔＄洰鏍囧凡淇
## 涓€銆佸疄娴嬫暟鎹紙鍗忚皟鑰呮彁渚涳級
```

---

## 二、根因

**PowerShell 5.1 的 `Get-Content -Raw` 默认按系统 ANSI 代码页（GBK）读取文件**，
而不是 UTF-8。

所以：

1. `Get-Content -Raw` 把 UTF-8 中文**误解码为 GBK** → 内存中是乱码
2. `Set-Content -Encoding UTF8` 把乱码**写回为 UTF-8**
3. 结果：文件被**双重编码**，中文永久损坏

**关键**：`-Encoding UTF8` 只控制**写入**编码，不控制**读取**编码。

---

## 三、正确做法

### ❌ 不要用

```powershell
$c = Get-Content $f -Raw          # 按 GBK 读取 UTF-8 -> 乱码
$c = $c -replace 'a', 'b'
Set-Content -Path $f -Value $c -Encoding UTF8
```

### ✅ 用 Node（推荐）

```javascript
import fs from "node:fs";
let c = fs.readFileSync(file, "utf8");     // 明确 UTF-8 读取
c = c.split("old").join("new");            // 或 c.replace(...)
fs.writeFileSync(file, c, "utf8");         // 明确 UTF-8 写入
```

### ✅ 或用 PowerShell 的正确写法

```powershell
# 显式指定读取编码
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c -replace 'a', 'b'
Set-Content -Path $f -Value $c -Encoding UTF8 -NoNewline
```

**但更推荐 Node** —— 避免 PowerShell 的编码默认值陷阱。

### ✅ 或直接用 edit 工具

**本轮我后来改用 `edit` 工具修改文件，没有出现编码问题。**

**结论：修改含中文的文本文件时，优先用 `edit` 或 Node，不要用 PowerShell 的
`Get-Content` + `Set-Content` 组合。**

---

## 四、为什么没及时发现

1. **PowerShell 显示乱码时我以为是终端问题** —— 实际文件真的坏了
2. **我用 Node 检查时用了错误的正则** —— 漏检了部分乱码字符
3. **提交前没有做编码校验** —— 直接把损坏的文件提交了

---

## 五、修复过程

**从 git 找最后一个干净版本恢复**：

| 文件 | 干净版本 |
| --- | --- |
| `perf-baseline.md` | `048560a` |
| `perf-algorithm-verdict.md` | `39cccae` |
| `codex-ready.md` | `545b32c` |
| `antigravity-ready.md` | `545b32c` |
| `workbuddy-ready.md` | `545b32c` |
| `t-p1-detail-cache.brief.md` | `39cccae` |
| `t-p4-tv-render.brief.md` | 无干净版本，**手工重写** |

**然后用 Node 重新应用路径修改**（不再用 PowerShell）。

---

## 六、预防措施

### 1. 编码校验脚本

**建议**：提交前运行

```javascript
// 检查文件是否有 UTF-8 解码失败的痕迹
const garbled = (c.match(/\uFFFD|鈿|涓€|浜屻|鍥涖|涓冦|馃|鐜|婊|鍐/g) || []).length;
if (garbled > 0) throw new Error(`${file} 有 ${garbled} 处乱码`);
```

### 2. 修改中文文件时

| 方式 | 安全性 |
| --- | --- |
| `edit` 工具 | ✅ 安全 |
| `write` 工具 | ✅ 安全 |
| **Node `fs`** | ✅ 安全 |
| **PowerShell `Get-Content` + `Set-Content`** | ❌ **危险** |

### 3. 检查乱码的常见字符

```
\uFFFD  替换字符
鈿 涓€ 浜屻 鍥涖 涓冦 馃 鐜 婊 鍐
```

**注意**：乱码字符集很广，单一正则容易漏检。
**更可靠的方法**：检查文件中是否含 `\uFFFD`，或对比 git 版本的字节。

---

## 七、本次事故的价值

**发现了一个会反复踩的坑**：

- 本项目的所有文档都是中文
- PowerShell 是当前 shell
- 用 PS 批量改文档是自然选择
- **但会静默破坏编码**

**现在记录在案，后续应避免。**

**同时暴露了一个流程缺陷**：提交前没有编码校验。
建议在 `npm run release:check` 或提交前检查中加入该步骤。
