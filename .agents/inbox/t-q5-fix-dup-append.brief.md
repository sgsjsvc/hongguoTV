# Q5 修复分页重复追加

**任务 ID**: `t-q5-fix-dup-append`
**负责人**: antigravity
**设备**: **D1** `127.0.0.1:16384`
**依赖**: 无
**协调者**: dsh
**范围**: 仅 TV 端分类页与排行榜

---

## 一、问题来源

**Q4 独立复核判定 Q3 不通过**，原因是 Q3 引入了**严重新缺陷**：

> 榜单页显示 `Top 1..120`，真实仅 **100** 条 → **多 20 条重复**

**6 个原缺陷中 5 个已修复**，但引入 1 个新缺陷。

---

## 二、根因（Q4 已精确定位，含代码推导）

### 2.1 引用共享

**`CatalogScreenView.kt:301`**：

```kotlin
val adapter = SeriesAdapter(currentRows, artwork, ...)
//                            ↑ adapter.rows 与 currentRows 是【同一个对象】
```

**`CatalogScreenView.kt:355-358`**：

```kotlin
fun appendRows(newRows: List<Series>) {
    currentRows.addAll(newRows)          // ① 原地修改共享列表
    seriesAdapter?.appendRows(newRows)   // ② adapter 内部再追加一次
}
```

**`SeriesAdapter.kt:17 / 108-113`**：

```kotlin
private var rows: List<Series>           // 初值 === currentRows（同一对象）

fun appendRows(newRows: List<Series>) {
    if (newRows.isEmpty()) return
    val oldSize = rows.size              // ← 此时 rows 已被 ① 改成 old+new
    rows = rows + newRows                // ← 新列表 = old + 2*new
    notifyItemRangeInserted(oldSize, newRows.size)   // ← oldSize 已虚高
}
```

### 2.2 推导结果

**首次追加后 `rows` 指向新对象，共享关系断开**，故**仅首轮分页重复一次**：

| 阶段 | `adapter.rows` | 条目数 | 应为 |
| --- | --- | --- | --- |
| 第 1 页 | `P1` | 20 | 20 |
| **第 2 页** | `P1 + P2 + P2` | **60** | 40 |
| 第 3 页 | `P1 + P2 + P2 + P3` | 80 | 60 |
| 第 4 页 | `… + P4` | 100 | 80 |
| 第 5 页 | `… + P5` | **120** | 100 |

### 2.3 连带问题

`notifyItemRangeInserted(40, 20)` 被调用时 RecyclerView **只有 20 条** —— 插入位置 40 **越界** → **RecyclerView 位置映射被破坏（布局错乱）**。

---

## 三、修复要求

### 3.1 核心要求

**`currentRows` 与 `adapter.rows` 不得共享可变对象。**

**可选方案**（择一，说明理由）：

| 方案 | 做法 |
| --- | --- |
| **A** | `appendRows` **只调 adapter**，不碰 `currentRows`；或只碰 `currentRows`，adapter 从它读 |
| **B** | `SeriesAdapter` 持有**不可变列表**（`List`），每次追加生成新对象 |
| **C** | 让 adapter 直接读 `currentRows`（同一数据源），用 `notifyItemRangeInserted` 通知 |

**推荐 A 或 C** —— 明确单一数据源，避免双重维护。

**关键**：`notifyItemRangeInserted(startPosition, itemCount)` 的参数必须与**实际变化**一致。

### 3.2 必须验证不引入新问题

| # | 项 |
| --- | --- |
| 1 | 无重复卡片 |
| 2 | 条目总数 == API 实际返回数 |
| 3 | `Top N` 序号与真实排名一致 |
| 4 | 布局无错乱 |
| 5 | 分页后左栏滚动位置仍保持（Q3 的成果） |
| 6 | 焦点行为不变（Q3 的成果） |

### 3.3 不得回退 Q3 的成果

Q3 已修复且 Q4 验证通过的项：

| # | 项 | Q4 判定 |
| --- | --- | --- |
| 1 | 分页后左栏滚动位置 | ✅ 已修复 |
| 3 | 分页后焦点不退回网格 | ✅ 已修复 |
| 4 | 切换筛选后焦点留按钮 | ✅ 已修复 |
| 5 | 分页加载指示 | ✅ 已修复 |
| 6 | 死代码清理 | ✅ 已修复 |
| C1–C7 | 7 条分页约束 | ✅ 全部通过 |

**修 bug 时不要破坏这些。**

---

## 四、Q4 提供的验证基线（可直接复用）

### API 真实数据量

| 接口 | 实际返回 |
| --- | --- |
| 榜单 `/api/rank/list?type=rank_hot&page=N` | **5 页 × 20 = 100 条**（page 6 返回 0） |
| 分类 `/api/category/list?type=real-drama&page=N` | 每页 24 条 |
| 分类 `tag=disaster` | 24+24+10 = **58 条** |
| 分类 `tag=fantasy` | 每页 24 条 |

### 榜单 `Top N` 可作为位置探针

`SeriesAdapter.kt:132`：`rankBadge.text = "Top ${position + 1}"`

→ **徽标 = RecyclerView 位置索引 + 1**，可直接暴露 adapter 的真实条目数。

**用法**：滚到榜单末页，dump 中最大的 `Top N` 应等于**总条目数**（100），而非 120。

### 请求计数探针

`.agents/shared/q4_probe.sh`（Q4 编写）：

```sh
# 设备侧高频采样，统计首次 ESTAB 的客户端端口数 = 请求数
while true; do ss -tan | grep ":$PORT " | grep -v LISTEN; sleep 0.01; done
```

**Q4 的基线**：60 次慢速 + 40 次连打下**仅 4 次请求**，并发恒 1。

**你的修复不得使请求数增加。**

---

## 五、硬性约束

1. **只改这些文件**：
   - `ui/CatalogScreenView.kt`
   - `SeriesAdapter.kt`
   - `MainActivity.kt`（如需）
2. **不要改** `shared/content-core/hongguo.js`、`custom-server/`
3. **不要改** `apps/web-pc/`（其他 agent 在做全屏）
4. **不要回退** Q3 的成果（见 §3.3）
5. 保持 API 22 兼容
6. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

| # | 项 | 判定方式 |
| --- | --- | --- |
| 1 | **榜单总条目 == 100** | 滚到末页，dump 最大 `Top N` 应为 100 |
| 2 | **分类条目 == API 实际数** | `tag=disaster` 应为 58 条 |
| 3 | 无重复卡片 | dump 中标题无重复 |
| 4 | `Top N` 序号与真实排名一致 | 对比 API |
| 5 | 布局无错乱 | 截图 |
| 6 | Q3 成果未回退 | 逐项复测 §3.3 |
| 7 | 7 条约束仍满足 | 请求计数 |
| 8 | 构建通过 | `assembleDebug`、`lintDebug`、`testDebugUnitTest` |
| 9 | 报告写入 `.agents/shared/t-q5-fix-dup-append-antigravity.md` | |

---

## 七、证据要求

### 环境

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16384
$d = "127.0.0.1:16384"
```

**你的设备是 D1**，**不要操作其他设备**。

### 必须提供

1. **修复前证据**：滚到榜单末页，dump 显示最大 `Top N` = **120**（复现缺陷）
2. **修复后证据**：同一操作，最大 `Top N` = **100**
3. **分类页条目数**：`tag=disaster` 的实际条目数
4. **Q3 成果复测**：左栏滚动位置、焦点、加载指示
5. **请求计数**：确认未增加

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| 设备 | **只用 D1**，始终 `-s` 指定 |
| dump 中文乱码 | PowerShell 按 GBK 解码；用 Node 读文件可正确解析 |
| **静态截图不足** | 必须验证**条目数**（用 `Top N` 或 API 对比） |
| `notifyItemRangeInserted` 参数 | 必须与实际变化一致，否则越界 |
| 共享可变对象 | 本次缺陷的根因，务必消除 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-q5-fix-dup-append antigravity "结论及报告路径"
```
