# Q4 分页与选中状态修复 — 独立复核

**任务 ID**: `t-q4-verify-paging`
**负责人**: workbuddy
**设备**: **D3** `127.0.0.1:16448`
**依赖**: `t-q3-paging-fix`（Q3）**必须先完成**
**协调者**: dsh

---

## 前置条件

**不要现在开始。** 先执行 `node .agents/cli.mjs ready` 确认本任务已就绪。

---

## 一、复核对象

Q3 修复了 Q1 自动分页引入的**焦点/选中状态**问题。

**协调者已定位 6 个缺陷**：

| # | 严重度 | 缺陷 |
| --- | --- | --- |
| 1 | 严重 | 分页后整树重建，左栏题材列滚动位置丢失 |
| 2 | 严重 | `Top N` 徽标序号在分页后失效（`position < 10` 恒 false） |
| 3 | 中 | `catalogScroll` 与 `index` 互斥导致焦点漂移 |
| 4 | 中 | `categoryFilterFocus` 用完即清空，分页后焦点不回筛选按钮 |
| 5 | 低 | 分页无加载指示 |
| 6 | 低 | 死代码残留（`addLoadMoreButton`、`series_card_width`） |

---

## 二、要核查的事项

### 2.1 逐个验证 6 个缺陷是否真被修复（重点）

**不能只看代码，要实测。**

| # | 验证方法 |
| --- | --- |
| 1 | 分页前后 dump 对比题材列可见项 |
| 2 | 分页后 dump 中是否有 `Top \d+` 文本 |
| 3 | 分页后 `focused="true"` 的节点是什么 |
| 4 | 切换筛选后 `focused="true"` 是否是该筛选按钮 |
| 5 | 分页时是否有加载指示（截图/dump） |
| 6 | grep 确认死代码已移除 |

### 2.2 🔴 关键：7 条约束是否仍满足（回归验证）

Q3 改的是焦点逻辑，**极易破坏 Q1 的分页约束**。

**必须复测**：

| # | 约束 |
| --- | --- |
| C1 | 仅当接近底部时触发 |
| C2 | 同一时刻只允许一个请求 |
| C3 | 已到末页不再请求 |
| C4 | 快速滚动不重复触发 |
| C5 | 切换筛选/榜单后重置状态 |
| C6 | 加载失败不无限重试 |
| C7 | 加载中不阻塞焦点 |

**推荐方法**：复用你在 Q2 用过的 **TCP 连接计数探针**（见 `.agents/shared/t-q2-verify-card-workbuddy.md` §2.2）。

**必须给出**：快速连续滚动时的请求数，确认**无重复请求**。

### 2.3 是否引入新问题

Q3 可能采用「不重建整树」的方案（`notifyItemRangeInserted`）。若是，需检查：

- 新数据是否正确显示
- 是否出现**重复卡片**
- 是否出现**数据错位**（卡片与标题不匹配）
- `Top N` 序号是否与真实排名一致

### 2.4 边界情况

| 场景 | 期望 |
| --- | --- |
| 分页后立即切换榜单 | 状态正确重置 |
| 分页到末页 | 不再请求 |
| 分页中途切换筛选 | 无数据混淆 |
| 分页后返回详情再回来 | 焦点合理 |

### 2.5 越界改动

Q3 授权文件：

- `ui/CatalogScreenView.kt`
- `SeriesAdapter.kt`
- `MainActivity.kt`
- `res/values*/dimens.xml`

**检查是否有其他文件被改动**。

### 2.6 调试日志残留

检查是否有 `Log.d` 等调试日志（R13、Q1 都清理过）。

---

## 三、硬性约束

1. **只读复核，不修改任何代码**
2. **只用 D3**（`127.0.0.1:16448`）
3. 不执行 `git checkout` / `git reset` / `git clean`
4. **区分「已核实」与「推测」**
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 四、环境准备

```powershell
$env:ANDROID_ADB_SERVER_PORT = "15037"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb start-server
& $adb connect 127.0.0.1:16448
& $adb -s 127.0.0.1:16448 shell wm size 1280x720
& $adb -s 127.0.0.1:16448 shell wm density 192   # 使最小宽度达 600dp
& $adb -s 127.0.0.1:16448 install -r <apk路径>
```

**D3 当前配置**：`sw600dp-w1066dp-h565dp-192dpi` → 命中 `values-sw600dp` 档。

---

## 五、验收标准

1. 报告明确列出：**已核实事实 / 无法核实项 / 发现的问题 / 改进建议**
2. **6 个缺陷逐个给出结论**（已修复 / 未修复 / 部分修复）
3. **7 条约束给出明确复测结果**（含请求数）
4. **新问题**：明确说明是否引入
5. **越界改动**：明确说明
6. **调试日志残留**：明确说明
7. 每条结论附**证据**（dump / 日志 / 代码行号）
8. 报告写入 `.agents/shared/t-q4-verify-paging-workbuddy.md`

---

## 六、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **adb 端口** | **必须设 `ANDROID_ADB_SERVER_PORT=15037`** |
| 设备 | **只用 D3** |
| dump 中文乱码 | PowerShell 按 GBK 解码；用 Node 读文件可正确解析 |
| **静态截图不足** | 必须验证**状态推进** |
| 播放页 dump 受限 | 先暂停或导航后 dump |
| `input tap` 无效 | 用 DPAD |

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-q4-verify-paging workbuddy "结论及报告路径"
```
