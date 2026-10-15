# workbuddy 模拟器领取记录

2026-10-15（Asia/Shanghai），按用户「领取分配的模拟器」指令及 `.agents/shared/device-allocation.md` 规范，登记领取并配置 **D3**。

- **设备 ID**: `D3`
- **分配 Agent**: `workbuddy`（独立复核方）
- **ADB 地址**: `127.0.0.1:16448`，显式使用 server 端口 **15037**（`adb -P 15037 -s 127.0.0.1:16448`）
- **设备状态**: `device` 在线（实测）
- **系统版本**: Android 12（API 32）
- **屏幕配置**: Physical 1080×1920 / 物理密度 280 → **Override size 1280×720（横屏）+ Override density 192**
- **逻辑尺寸 / 命中档**: `sw600dp-w1066dp-h565dp-192dpi` → **`values-sw600dp`**（TV 目标档）
- **应用状态**: `com.hongguotv.tv` 已安装（`app-debug.apk`，MD5 `52fa7c8c16776a8b9f454c744d5b9493`，含 P1 分类页左栏改造），启动 + 分类页冒烟通过
- **锁定文件**: `.agents/state/device-d3.lock.json`
- **隔离说明**: 仅操作分配的 D3，未触碰 D1（antigravity）/ D2（codex）/ 真机 REAL（dsh）

## 与文档默认准备态的一处**有意偏离**

文档 §四 建议 D3 仅执行 `wm size 1280x720`。但实测该配置（保持 280dpi）得到 `sw411dp-w731dp` → 最小宽度 411dp < 600dp → **命中 `values`（默认档）**，并非文档 §六 所述 sw600dp。

为使 D3 成为**长期可用的 sw600dp 档复核设备**，我额外将密度降为 192（1066×600dp）。**实测验证**：分类页左栏 `leftRail [36,24][178,696] = 142px ÷ 1.2 = 118.3dp`，与 `values-sw600dp` 的 `catalog_rail_width = 118dp` 一致（若为默认档应为 125px）。

**复原方法**：`wm density reset`（回 280dpi，此时为 `values` 档）；`wm size reset`（回 1080×1920 原生，617×1097dp，原生即 sw600dp）。

> 同时发现 `device-allocation.md` §六「dimens 档位差异」表有多处与实测不符（含 REAL 是否真命中 w1280dp 的存疑结论）。已单列勘误文件：**`.agents/shared/device-dimens-bucket-correction.md`**，建议协调者据此修订。

## 证据

| 文件 | 内容 |
| --- | --- |
| `.agents/shared/d3-prep-category.png` | D3 分类页（左栏两列 + 网格，leftRail 142px） |
| `.agents/shared/d3-prep-category.xml` | 同帧 UI dump（坐标证据） |

设备已就绪，等待分配具体复核任务。
