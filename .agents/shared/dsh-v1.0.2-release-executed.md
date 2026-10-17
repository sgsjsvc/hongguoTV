# v1.0.2 发布执行记录（DSH）

- **发布人**：dsh（发布安排与执行）
- **指令**：用户 2026-10-17「执行发布」
- **发布状态**：**已发布**
- **发布时间**：2026-10-17T02:33:32Z（GitHub `publishedAt`）

---

## 一、发布结果

| 项 | 值 |
| --- | --- |
| GitHub Release | https://github.com/sgsjsvc/hongguoTV/releases/tag/v1.0.2 |
| 标题 | `v1.0.2 — Web / 桌面 / TV 三端（不含手机端）` |
| tag | `v1.0.2`（annotated，远端对象 `d78561b…`） |
| draft / prerelease | **false / false** |
| **GitHub 标记** | **Latest** ✅ |
| 资产数 | **17**（16 产物 + `SHA256SUMS.txt`） |
| 代码版本 | tag 指向 `1625b14`（业务代码 == 冻结基线 `a623f8a`） |

### 已上传资产（17/17）

| 资产 | 字节 |
| --- | --- |
| `hongguotv-desktop-win-arm64-portable.exe` | 108,357,526 |
| `hongguotv-desktop-win-arm64-setup.exe` | 108,622,544 |
| `hongguotv-desktop-win-universal-portable.exe` | 225,152,451 |
| `hongguotv-desktop-win-universal-setup.exe` | 225,417,699 |
| `hongguotv-desktop-win-x64-portable.exe` | 117,192,251 |
| `hongguotv-desktop-win-x64-setup.exe` | 117,457,799 |
| `hongguotv-sync-linux-arm64.tar.gz` | 43,220,815 |
| `hongguotv-sync-linux-x64.tar.gz` | 43,369,946 |
| `hongguotv-tv-android5.1-debug.apk` | 8,564,589 |
| `hongguotv-tv-android5.1-release.apk` | 6,905,308 |
| `hongguotv-web-darwin-arm64.tar.gz` | 37,560,037 |
| `hongguotv-web-darwin-x64.tar.gz` | 38,769,624 |
| `hongguotv-web-linux-arm64.tar.gz` | 44,275,538 |
| `hongguotv-web-linux-x64.tar.gz` | 44,418,765 |
| `hongguotv-web-win-arm64.zip` | 29,513,170 |
| `hongguotv-web-win-x64.zip` | 33,902,338 |
| `SHA256SUMS.txt` | 1,617 |

---

## 二、发布步骤与结果

| # | 步骤 | 结果 |
| --- | --- | --- |
| 1 | 前置条件核实 | T1/T2/T3/T4 全部 done；`release/` 16 产物已由 T3 重建 |
| 2 | DSH 独立验收 | 见 `dsh-v1.0.2-release-acceptance.md`（全部自测，不采信执行方结论） |
| 3 | 恢复 `release/README.md` | 从归档备份恢复并**更新为 v1.0.2 事实**（含未签名、API22 未验证警示） |
| 4 | 归档新 README | `.agents/archive/release-README-v1.0.2.md`（因 `release/` 被 gitignore，须留档） |
| 5 | 提交验收记录 | `29c1534`、`1625b14` |
| 6 | 密钥/凭据扫描 | 152 个变更文件扫描：**0 处真实密钥**（4 处为文档提及文件名）；无 `keystore.properties`/`shared-key.txt` 入库 |
| 7 | **推送** `origin/main` | `8f66d2f..1625b14  HEAD -> main`；远端 `refs/heads/main` = `1625b14` ✅ |
| 8 | **打 tag 并推送** | `v1.0.2`（annotated）；远端 `refs/tags/v1.0.2` = `d78561b…` ✅ |
| 9 | **创建 GitHub Release** | 上传 17 资产，`--notes-file` 使用如实标注的发布说明 ✅ |
| 10 | 发布后验证 | `gh release view`：draft=false、prerelease=false、assets=17、**Latest** ✅ |

**推送前核对**：`origin/main..HEAD` 共 13 个提交、152 个变更文件，**全部为业务代码 + `.agents/` 协同记录**，
无本地凭据、无用户数据库、无签名密钥。

---

## 三、发布说明中已如实标注的内容

1. **本次不包含手机端**（用户明确要求排除）
2. **桌面端未签名（NotSigned）** —— 构建环境无证书；与 v1.0.1 的已签名包不同，已提醒 SmartScreen 提示
3. **API 22（Android 5.1）实机未验证** —— 仅 API 32/35 模拟器通过；不声称 Android 5.1 已验证
4. **Linux / macOS Web 包未在对应宿主启动验证**
5. **sync 家庭共享服务未单独实测**
6. **命名变更对照表**（v1.0.1 → v1.0.2）

---

## 四、发布后仍需跟进（不因发布而消除）

| # | 事项 | 归属 |
| --- | --- | --- |
| 1 | API 22 实机验证（`mumu-r` 恢复后） | DSH 协调 + qoder |
| 2 | 手机端第二段实施放行（可行性已验证，建议 minSdk 24 + Capacitor） | **待 DSH/用户决策** |
| 3 | 桌面端签名证书补偿（下次发布前） | DSH + opencode |
| 4 | Linux/macOS Web 包宿主实测 | opencode |
| 5 | `outputs/runtime-cache` 已重建（本次联网重下 Node 运行时），后续重建可复用 | — |
| 6 | `dist-win` 仍残留 1 个被 `WorkBuddyAI.exe` 锁定的 107KB 文件 | 需用户在 WorkBuddy 窗口退出 |

---

*本文件为 DSH 的发布执行记录；所有"实测"来自 2026-10-17 本会话真实命令。*
