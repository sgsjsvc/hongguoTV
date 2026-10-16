# B9 清理无用历史打包文件 — 调查与阻塞报告

**任务 ID**: `t-b9-clean-up`（已 claim）
**执行人**: workbuddy
**日期**: 2026-10-16
**依据 brief**: `.agents/inbox/t-b5-to-b9-optimization.brief.md` §B9
**⚠️ 状态**: **未执行任何删除**。调查发现 3 个阻塞点，需 DSH 裁决后再动手。

---

## 一、结论速览

| # | 阻塞点 | 严重度 | 说明 |
| --- | --- | --- | --- |
| 1 | **验收阈值客观不可达** | 🔴 高 | brief 要求保留的 `bundles/`+`runtime-cache/` 本身 **2.24 GB**，已超「outputs/ < 2 GB」验收线 |
| 2 | **清空会破坏已完成任务的证据链** | 🔴 高 | ≥10 份 `.agents/shared/` 报告引用 `outputs/` 下文件；被清目录与「保留校验和清单」的精神冲突 |
| 3 | **brief 体积估算偏差 2.4 倍** | 🟡 中 | brief 称「当前 ~5 GB」，实测 **≈ 11.9 GB** |
| 4 | `.gradle/caches` 位于用户主目录 | 🟡 中 | 实测 **6.4 GB**，在 `C:\Users\AnLin\.gradle\caches`（非项目目录），清理属个人目录操作且会影响其他项目 |
| 5 | B5–B8 并发执行中 | 🟡 中 | 5 个后端同时跑，`outputs/` 可能正被写入 |

**已释放空间**：0（未删任何文件，可完全回退）

---

## 二、实测清单

### 2.1 `outputs/` 全量（实测，brief 估 ~5 GB，实际 ≈ 11.9 GB）

**A. brief 要求保留（合计 2,244.6 MB）**

| 目录 | 大小 | 文件数 | 最后修改 | 内容 |
| --- | --- | --- | --- | --- |
| `bundles/` | 1,163.7 MB | 2,559 | 10/15–10/16 | 8 个平台子目录 + 9 个 web/sync 各平台包（28–42 MB/个） |
| `runtime-cache/` | 1,080.9 MB | 24,769 | 10/12–10/14 + **2025/9/24** | 7 个运行时文件（24–34 MB/个）+ **5 个 2025 年的子目录**（疑似历史死数据） |

> 注：`runtime-cache/` 内含 5 个 2025/9/24 的子目录，若确认无用可再省空间，但按 brief 归入保留项。

**B. brief 要求清空、但**被报告引用**的证据目录（合计 ≈ 6.0 GB）**

| 目录 | 大小 | 被引用情况 |
| --- | --- | --- |
| `testing/` | 3,138.7 MB | 引用 ≥8 次（`testing/w7-release`、`testing/q2-quality`、`testing/p1-prefetch/results.json`、`testing/tv-episode-*.log` 等） |
| `windows/` | 1,825.3 MB | 引用 6 次（含 `win-unpacked` ×3、`SHA256SUMS.txt`） |
| `w7-release/` | 1,689.5 MB | 引用 5 次 |
| `version-snapshots/` | 1,255.3 MB | 未在 shared/ 报告中被引用 |
| `build-archives/` | 1,224.6 MB | 未在 shared/ 报告中被引用 |
| `w5-desktop/` | 416.2 MB | 引用 2 次（`win-unpacked`） |
| `w6-tests/` | 13.4 MB | 引用 2 次（`fixture-vertical.mp4`，**我的 W6 复核证据**） |
| `w5-tests/` | 22.3 MB | 引用 ≥4 次（`web-final.log`、`typecheck.log` 等） |
| `tv-android/` | 15.9 MB | 引用 2 次（APK） |
| `debug/` | 27.2 MB | 引用 7 次（`measure-playback.mjs`、`u1-fav.xml`、`mumu-category-final.png` 等） |
| `packaging-tests/` `p4-device-evidence/` `hevc-survey/` `rank-diagnosis/` `w3-profile/` `w1-tests/` `b3-tests/` `admin/` `logs/` 等 | ≈ 60 MB | 部分被引用（`p4-*`、`hevc-survey`、`b3-tests` 等） |
| `github-source-20261013-143651/`、`layout-backup-*` | ≈ 6.7 MB | 备份性质，未被引用 |

**C. 根目录散文件（8.5 MB）**

约 60 个 `.log` / `.json` / `.apk` / `.txt`（`p4-*.log`、`w-regression*.log`、`smoke-playback.json`、`playback-diagnosis.json`、`source-files-to-push.txt` 等），其中多个被报告引用（如 `outputs/w-regression-final.log`）。

### 2.2 `release/`（1.3 GB）

| 类别 | 文件 | 处置 |
| --- | --- | --- |
| Windows EXE ×6 | arm64/x64/universal × portable/setup | **保留**（brief 要求） |
| Windows ZIP ×2 | `hongguotv-web-win-arm64.zip`、`hongguotv-web-win-x64.zip` | **保留** |
| Windows ZIP 目录 ×1 | `hongguotv-web-win-x64/` | 需 DSH 确认是否保留（内容未核） |
| **非 Windows 包 ×6** | `hongguotv-sync-linux-{arm64,x64}.tar.gz`、`hongguotv-web-darwin-{arm64,x64}.tar.gz`、`hongguotv-web-linux-{arm64,x64}.tar.gz`（合计 ≈ 251 MB） | brief 要求清掉 |
| Android APK ×2 | `hongguotv-tv-android5.1-{debug,release}.apk`（15.5 MB） | brief 说「仅保留最新版 2 个 ABI」，但现有两个是 **debug/release 而非 2 ABI**，需 DSH 确认保留哪个 |
| 校验链 | `README.md`、`SHA256SUMS.txt`、`manifest.json` | **必须保留**（验收要求校验链完整） |

### 2.3 构建缓存

| 路径 | 大小 | 说明 |
| --- | --- | --- |
| `node_modules/.cache/` | 不存在 | 无需处理 |
| `F:\Project\hongguoTV\.gradle\caches` | 不存在 | 无需处理 |
| **`C:\Users\AnLin\.gradle\caches`** | **6,395.1 MB** | ⚠️ 在**用户主目录**，非项目范围；清理会影响本机其他 Gradle 项目，且属个人目录操作 |

---

## 三、阻塞点详述

### 阻塞 1：验收阈值不可达（数学上）

brief 保留项 = `bundles/` (1,163.7 MB) + `runtime-cache/` (1,080.9 MB) = **2,244.6 MB ≈ 2.19 GB**。
即使把 brief 要求清空的 ≈ 9.7 GB 全部删除，`outputs/` 仍为 **2.19 GB > 2 GB** 验收线。

**结论**：「outputs/ < 2 GB」这一验收标准在「保留 bundles + runtime-cache」的前提下**无法满足**，需 DSH 二选一：放宽阈值，或明确允许清理这两个目录（或其一部分）。

### 阻塞 2：证据链会被破坏

`.agents/shared/` 中至少 10 份报告把 `outputs/` 下的文件当作证据引用（W4/W5/W6/W7、P4、A2、Q1/Q2、TV 修复等）。brief 同时要求「保留校验和清单」「release/ 校验链完整可回滚」，说明其意图是**保全可验证性**；但「清空 outputs/ 除两目录外全部」与该意图**直接冲突**——删除后这些报告将失去可复现的证据附件。

这与 `RESPONSILITIES.md` 边界规则第 10 条「不得删除他人写入 `.agents/shared/` 的报告」精神一致：报告的证据附件同样不应被无告知清除。

### 阻塞 3：体积估算偏差

brief 称「当前 ~5 GB」，实测 **≈ 11.9 GB**（偏差 2.4 倍）。说明派单时未实际测量，其余验收数字（如「节省空间量」）也需以实测为准。

### 阻塞 4：`.gradle/caches` 越界

实测 Gradle 缓存在 `C:\Users\AnLin\.gradle\caches`（6.4 GB），**不在项目目录内**。清理它属于用户主目录操作，会影响本机其他项目，且 brief 的「保留 latest 版本」需要额外判断。**建议 DSH 明确排除此项**（workbuddy 不擅自清理项目外目录）。

### 阻塞 5：并发冲突

B5（codex）/ B6（antigravity）/ B7（codex）/ B8（opencode）正在并发执行。虽然它们的主要产物不在 `outputs/`，但 `outputs/` 是历史共享产物区，且边界规则第 6 条要求「同一时间只允许一次写同一目录的打包」，清空前应在 `.agents/shared/` 写占用记录。

---

## 四、三个可选方案（请 DSH 裁决）

| 方案 | 做法 | 释放空间 | 阈值达标 | 证据链 | 风险 |
| --- | --- | --- | --- | --- | --- |
| **A 严格按 brief** | 清空 `outputs/` 除 bundles/runtime-cache 外全部 + 清 release/ 非 Windows 包 | ≈ 9.7 GB | ❌ 2.19 GB | ❌ 断裂 | 高：破坏证据 |
| **B 保全证据（推荐）** | ① 清空**未被引用**的大目录（`version-snapshots/` 1.25 GB、`build-archives/` 1.22 GB、`testing/` 3.14 GB、`windows/` 1.83 GB、`w7-release/` 1.69 GB 中未被引用的部分）；② 被引用证据**移入 `.agents/archive/outputs-evidence/`**（并在原位置留去向说明，符合边界规则第 10 条）；③ 保留 bundles/runtime-cache；④ release/ 仅清 6 个 Linux/darwin 包 | ≈ 9.5 GB | ❌ 2.19 GB | ✅ 保全 | 低 |
| **C 最小保守** | 仅清 `version-snapshots/` + `build-archives/`（2.48 GB，零引用）+ release/ 6 个非 Windows 包 | ≈ 2.7 GB | ❌ 2.19 GB | ✅ 保全 | 最低 |

> 三个方案都无法让 `outputs/` 降到 2 GB 以下（保留项已 2.19 GB）。**核心问题在阈值，不在清理力度。**

---

## 五、workbuddy 的建议

1. **采纳方案 B**：既释放绝大部分空间，又保全证据链（移入 `.agents/archive/` 而非删除，符合边界规则第 10 条）。
2. **验收阈值改为 `outputs/ < 2.3 GB`**（或明确允许清理 `bundles/` / `runtime-cache/` 的一部分 —— 建议优先复查 `runtime-cache/` 内 5 个 2025 年子目录，若确认为死数据可再省约 1 GB）。
3. **`.gradle/caches` 排除在 B9 范围外**（用户主目录，非项目产物）。
4. **release/ APK 处置请 DSH 明确**：现有 2 个 APK 是 debug/release 而非「2 ABI」，建议保留 `release` 版 + `debug` 版各一（现状），或按 DSH 意图调整。
5. **执行前在 `.agents/shared/` 写占用记录**（符合边界规则第 6 条），并确认 B5–B8 未在写 `outputs/`。

---

## 六、可回退性声明

**本任务至今未执行任何删除、移动或修改操作**，全部结论来自只读统计。因此「所有改动可回退」当前状态为**完全可回退（无改动）**。
若采用方案 B 执行，将先输出完整清理前清单（路径+大小+时间+是否被引用）至本报告，作为回退依据。

---

## 七、待 DSH 裁决项（汇总）

1. 验收阈值：`outputs/ < 2 GB` 是否调整为 `< 2.3 GB`，或授权清理 `bundles/` / `runtime-cache/`？
2. 清理方案：A / B / C 选哪个？
3. `runtime-cache/` 内 5 个 2025/9/24 子目录是否为死数据，可清？
4. `C:\Users\AnLin\.gradle\caches`（6.4 GB）是否排除在 B9 范围外？
5. `release/` 现有 2 个 APK（debug/release）如何处置？
6. 是否授权 workbuddy 在执行前于 `.agents/shared/` 写占用记录？

---

## 八、证据清单

本报告全部数字来自本次实测（PowerShell `Get-ChildItem -Recurse` + `Measure-Object`，Git Bash `ls/du`），测量时间 2026-10-16 20:2x。被引用关系来自对 `.agents/shared/*.md` 的 `grep -ohE "outputs/..."` 统计。
