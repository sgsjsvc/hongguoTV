# P1 分类页左侧双列筛选栏改造

**任务 ID**: `t-p1-catalog-rail`
**负责人**: antigravity
**依赖**: 无
**协调者**: dsh
**范围**: **仅 TV 端**，**仅分类页**

---

## 一、用户需求

> 将分类列表改造为**左侧**列表方式显示，**两列**：一列显示剧的分类，一列显示题材分类。
> **不可折叠**，占有左侧宽度**尽可能的小**。
> **排行榜不动**（保留现有顶部平铺）。
> 该方案**只针对 TV 端**。

---

## 二、要解决的问题（实测证据）

### 实测数据（`emulator-5554`，1280×720）

来源：`outputs/debug/official-tv-category.xml` 与截图 `.agents/shared/u4-category.png`

| 区域 | y 范围 | 高度 |
| --- | --- | --- |
| 标题「分类」 | 24–64 | 40px |
| 一级类型（真人剧/漫剧/AI剧） | 64–120 | 56px |
| **题材标签（25 个）** | **120–232** | **112px** |
| 网格卡片 | 240–585 | 345px |

**筛选区占 232px**，网格可用高度仅 **488px** —— 只能显示 **1 行完整卡片**。

### 截图确认

- 题材标签占 **3 行**，第三行只有「剧情」**一个孤立标签**
- 网格只露出 **1 行**，底部被裁切

### 根因

`CategoryTagLayout.kt:7` 的设计意图：

```kotlin
/** All filters stay visible; wrap to the available TV width without horizontal scrolling. */
```

「所有筛选保持可见」在 **24 个题材标签**时，**直接挤占内容展示空间**。

---

## 三、目标布局

```
┌────────┬────────┬───────────────────────┐
│ 类型   │ 题材   │ 分类                  │
│        │        │ ┌────┐┌────┐┌────┐    │
│▸真人剧 │ 全部题材│ │卡片││卡片││卡片│    │
│ 漫剧   │ 爱情   │ └────┘└────┘└────┘    │
│ AI剧   │ 年代   │ ┌────┐┌────┐┌────┐    │
│        │ 逆袭   │ │卡片││卡片││卡片│    │
│        │ 传奇   │ └────┘└────┘└────┘    │
│        │ 成长   │ ┌────┐┌────┐┌────┐    │
│        │ 家庭   │ │卡片││卡片││卡片│    │
│        │ ...    │ └────┘└────┘└────┘    │
│        │ (滚动) │      [加载更多]       │
└────────┴────────┴───────────────────────┘
```

**收益**：筛选区垂直占用 232px → **0**，网格可用高度 488px → **720px**。

---

## 四、规格（已与用户确认）

### 4.1 左栏尺寸

| 项 | 值 |
| --- | --- |
| **左栏总宽** | **118dp**（sw600dp 档） |
| 占屏比 | **约 12%** |
| 外层 padding | 各 5dp |
| 列间隙 | 5dp |
| 每列宽 | 51.5dp |
| 按钮文字 | **11sp** |
| 按钮高 | 32dp |

### 4.2 三档 dimens（新增键）

| 键 | values | sw600dp | w1280dp |
| --- | --- | --- | --- |
| `catalog_rail_width` | 104dp | **118dp** | 142dp |
| `catalog_rail_pad` | 4dp | 5dp | 6dp |
| `catalog_rail_gap` | 4dp | 5dp | 6dp |
| `catalog_rail_btn_height` | 28dp | 32dp | 38dp |
| `catalog_rail_btn_text` | 10sp | **11sp** | 13sp |
| `catalog_rail_label_text` | 9sp | 10sp | 12sp |

### 4.3 列宽精算（sw600dp）

```
左栏 118dp − padding 10dp − 间隙 5dp = 103dp
每列 = 51.5dp

最长标签「动作冒险」4 字 @ 11sp：
  文字宽 4 × 11 = 44dp
  padding 各 3dp = 6dp
  合计 50dp ≤ 51.5dp  ✓ 放下
```

> ⚠️ **余量仅 1.5dp**。若实测发现「动作冒险」换行或截断，按以下顺序处理：
>
> 1. 该按钮 padding 减到各 2dp
> 2. `catalog_rail_width` 增至 124dp（占屏 13%）
> 3. 允许单行省略号（`ellipsize = END`, `maxLines = 1`）
>
> **不要**把字号降到 11sp 以下（TV 远距离可读性）。

### 4.4 题材列滚动

| 项 | 值 |
| --- | --- |
| 题材标签数 | **25 个**（全部题材 + 24） |
| 单按钮高 + 间隙 | 32 + 5 = 37dp |
| 左栏可用高 | 541 − 40(标题) − 10(padding) ≈ 490dp |
| 可见数量 | ≈ **13 个** |
| 实现 | `ScrollView`（垂直） |

**类型列不滚动**（仅 3 个）。

### 4.5 网格

`GridLayoutManager(context, 5)` **保持不变**（`CatalogScreenView.kt:135`）。

| 项 | 改造前 | 改造后 |
| --- | --- | --- |
| 网格可用宽 | 902dp | 784dp |
| 每列宽 | 180dp | 157dp |

缩小 13%，可接受。

---

## 五、结构改造

### 5.1 布局层级

```
LinearLayout(VERTICAL)                    ← 根（保持）
└── LinearLayout(HORIZONTAL)              ← 新增：左右分栏
    ├── 左栏（固定 118dp，仅 category 显示）
    │   ├── 类型列（3 按钮，竖向，不滚动）
    │   └── 题材列（ScrollView + 25 按钮，竖向滚动）
    └── 右区（weight=1f）
        ├── 标题「分类」
        ├── RecyclerView 网格
        └── 加载更多按钮
```

**注意**：标题移到右区（原在顶部整行），避免左栏上方留空。

### 5.2 视觉分组

两列顶部各加小标题（`catalog_rail_label_text`）：

```
┌────────┬────────┐
│ 类型   │ 题材   │   ← 小标题，约 20dp 高
├────────┼────────┤
│▸真人剧 │ 全部题材│
│ 漫剧   │ 爱情   │
│ AI剧   │ ...    │
└────────┴────────┘
```

### 5.3 仅 category 显示左栏

```kotlin
if (source == "category") { /* 构建左栏 */ }
```

| source | 左栏 |
| --- | --- |
| `category` | ✅ 显示 |
| `rank` | ❌ **保持 U6 顶部平铺** |
| `favorites` / `history` / `search` | ❌ 无筛选 |

---

## 六、焦点要求（最高风险）

现状（`MainActivity.kt:1177`）：

```kotlin
filter?.requestFocus() ?: rankBtn?.requestFocus() ?: tool?.requestFocus()
    ?: (manager.findViewByPosition(index)?.requestFocus() ?: grid.requestFocus())
```

**必须保证**：

1. 左栏按 **RIGHT** → 进入网格
2. 网格按 **LEFT** → 回到左栏
3. **类型列 ↔ 题材列**按 LEFT/RIGHT 正确流转
4. 切换筛选后焦点**留在原按钮**（便于连续切换）
5. 首次进入页面焦点落点合理
6. 题材列滚动时，获焦项**自动可见**

**建议**：显式设置 `nextFocusLeftId` / `nextFocusRightId`（参考 `PlayerOverlay.kt:224-233`）。

---

## 七、硬性约束

1. **只改这些文件**：
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/ui/CatalogScreenView.kt`
   - `apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt`（仅焦点恢复逻辑，如需）
   - `apps/tv-android/app/src/main/res/values/dimens.xml`
   - `apps/tv-android/app/src/main/res/values-sw600dp/dimens.xml`
   - `apps/tv-android/app/src/main/res/values-w1280dp/dimens.xml`
2. **不要改** `CategoryTagLayout.kt`（排行榜仍可能用到；且改动会波及）
3. **不要改** `SeriesAdapter.kt`（除非必要）
4. **排行榜行为必须保持不变**
5. **favorites / history / search 页面必须无变化**
6. 不要回退第五、六轮修复
7. 保持 API 22 兼容
8. 当前 shell 是 **Windows PowerShell 5.1**

---

## 八、验收标准

1. **左栏双列**：类型列 + 题材列，竖向排列，顶部各带小标题
2. **宽度 ≤ 125dp**（sw600dp 档），占屏 ≤ 14%
3. **不可折叠**：常驻显示
4. **题材列可滚动**：25 个标签可完整访问，获焦项自动可见
5. **网格高度**：从 488px 增至 ≥ 650px，可见 **≥ 2 行**卡片
6. **焦点**：LEFT/RIGHT 在左栏与网格间正确流转；两列间流转正确
7. **切换筛选**：焦点留在按钮，列表正常刷新
8. **排行榜无变化**（附对比截图证明）
9. **其他页面无变化**
10. **三档分辨率**布局正确
11. `assembleDebug`、`lintDebug`、`testDebugUnitTest` 通过
12. 报告写入 `.agents/shared/t-p1-catalog-rail-antigravity.md`

---

## 九、证据要求（三件套）

**必须提供**：

1. **分类页改造后截图**（720p，显示左栏 + 网格 ≥2 行）
2. **排行榜截图**（证明未变）
3. **UI dump**（验证左栏坐标与宽度）
4. **焦点流转验证**（LEFT/RIGHT 的 dump 前后对比）

```powershell
# 冷启动 + 唤出 chrome
adb -s emulator-5554 shell am force-stop com.hongguotv.tv
adb -s emulator-5554 shell am start -n com.hongguotv.tv/.MainActivity
Start-Sleep -Seconds 20
adb -s emulator-5554 shell input keyevent 20

# 截图两步法（禁止 shell 重定向）
adb -s emulator-5554 shell screencap -p /sdcard/s.png
adb -s emulator-5554 pull /sdcard/s.png .agents/shared/<命名>.png

# dump
adb -s emulator-5554 shell uiautomator dump /sdcard/u.xml
adb -s emulator-5554 pull /sdcard/u.xml .agents/shared/<命名>.xml
```

**校验 PNG 签名**必须为 `89-50-4E-47-0D-0A-1A-0A`。

---

## 十、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| `input tap` 无效 | 触摸被播放器吞掉，须用 DPAD |
| 冷启动唤 chrome | 按一次 DOWN（不要用 MENU） |
| chrome 自动隐藏 | 隐藏后 DPAD 语义切换 |
| **本机 adb 端口冲突** | **5037 被 `xray` 进程占用**，`adb` daemon 可能无法启动。若遇到，需先释放端口或用其他设备 |

---

## 十一、提交方式

```powershell
node .agents/cli.mjs done t-p1-catalog-rail antigravity "结论及报告路径"
```
