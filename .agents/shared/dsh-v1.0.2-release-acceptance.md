# DSH 最终验收：v1.0.2 发布（2026-10-17）

- **验收人**：dsh（最终验收与发布安排）
- **指令**：用户 2026-10-17「执行发布」
- **结论**：**通过，已执行发布**
- **代码基线**：`3d7b0de`（业务代码等价于冻结基线 `a623f8a`）

---

## 一、四项任务交付与验收

| 任务 | assignee | 状态 | DSH 独立复核 |
| --- | --- | --- | --- |
| `t-v102-version-web` | antigravity | done | ✅ 三处版本一致 1.0.2；根 package.json 保持 0.1.1；依赖树未动（仅 3 行） |
| `t-v102-version-tv` | qoder | done | ✅ `git diff --numstat` = 2/2 仅两行；versionCode 3 / versionName 1.0.2；minSdk22/targetSdk35/四ABI 未变 |
| `t-v102-rebuild` | opencode | done | ✅ 见下（不采信其结论，全部自测） |
| `t-v102-mobile-port` | workbuddy | done | ✅ 第一段可行性已验证，第二段待放行；**不属本次发布** |

---

## 二、T3（重建）的独立验收 —— 全部由 DSH 自行实测

### 2.1 产物校验和（`release/` SHA256SUMS.txt）

| 项 | 结果 |
| --- | --- |
| 逐文件重算比对 | **16/16 全部一致，0 缺失/0 不符** |
| `manifest.json.totalFiles` vs 目录实际 | **16 == 16** |

### 2.2 🔴 关键不变量（P1 验收条件）—— 独立解包重算

**期望入口** `b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333`
**期望引擎** `cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2`

| 产物 | 实测 SHA256 | 判定 |
| --- | --- | --- |
| `hongguotv-web-win-x64.zip` | `b2dbaea0…` | ✅ |
| `hongguotv-web-win-arm64.zip` | `b2dbaea0…` | ✅ |
| `hongguotv-web-linux-x64.tar.gz` | `b2dbaea0…` | ✅ |
| `hongguotv-web-linux-arm64.tar.gz` | `b2dbaea0…` | ✅ |
| `hongguotv-web-darwin-x64.tar.gz` | `b2dbaea0…` | ✅ |
| `hongguotv-web-darwin-arm64.tar.gz` | `b2dbaea0…` | ✅ |
| 桌面 staging `win-unpacked/…/custom-server/index.mjs` | `b2dbaea0…` | ✅ |
| 桌面 staging `win-arm64-unpacked/…/custom-server/index.mjs` | `b2dbaea0…` | ✅ |
| `hongguotv-tv-android5.1-debug.apk` → `assets/hongguo.js` | `cf3d685c…` | ✅ |
| `hongguotv-tv-android5.1-release.apk` → `assets/hongguo.js` | `cf3d685c…` | ✅ |
| 桌面 staging 引擎 `shared/content-core/hongguo.js` | `cf3d685c…` | ✅ |

**结论：全部产物均为已验收的接线版入口 —— P1（旧产物为接线前 `d593a775…`）已彻底消除。**

### 2.3 TV APK badging（DSH 用 aapt 独立复核）

```
package: name='com.hongguotv.tv' versionCode='3' versionName='1.0.2' compileSdkVersion='35'
sdkVersion:'22'
targetSdkVersion:'35'
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'
```

✅ 与 T2 设定一致（versionCode 3 / versionName 1.0.2 / minSdk 22 / 四 ABI）。

### 2.4 APK 签名（DSH 用 apksigner 独立复核）

```
Signer #1 certificate DN: CN=HongguoTV, OU=TV Client, O=HongguoTV, L=Unknown, ST=Unknown, C=CN
Signer #1 certificate SHA-256 digest: c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151
```

✅ 与历史签名一致。

### 2.5 桌面签名（DSH 独立复核 —— 发现并更正一处文档问题）

| 项 | 实测 |
| --- | --- |
| `Get-AuthenticodeSignature release\hongguotv-desktop-win-x64-setup.exe` | **`NotSigned`**，SignerCertificate = (none) |
| `HG_CODESIGN_PFX` / `HG_CODESIGN_PASSWORD` | 环境均未设置 |

⚠️ **发现**：归档的旧 `release/README.md` 声称桌面包「已签名（自签名证书，v1+v2 双签名）」。
**本次实际未签名**。DSH 已重写 `release/README.md`，**明确标注本次为 NotSigned 并解释原因**，
同时保留旧证书信息备查。**不沿用旧文档的失效声明。**

### 2.6 发布门禁（DSH 复跑）

| 门禁 | 结果 |
| --- | --- |
| `npm test` | **214/214 通过、0 失败、0 跳过** |
| `npm run typecheck` | **退出 0** |
| `npm run smoke` | 通过（3/3 清晰度 + 3/3 取流，HTTP 206/65536B/ftyp） |
| `python scripts/verify-release-packages.py` | web 6/6 + 桌面 2/2 全绿 |

### 2.7 桌面运行时验证（T3 报告「通过」，DSH 采信并标注其口径）

证据 `outputs/testing/v102-rebuild/12-desktop-runtime-cdp.json`：

```json
{"isDesktop":true,"before":false,"during":true,"after":false,
 "rootChildren":1,"href":"hongguotv://app/","api":{"status":200}}
```

✅ 可见窗口（PID 31180，1725×1075）、单实例生效（二次启动已退出）、
IPC 全屏 `false→true→false`、内置后端 `/api/sections` 200、`hongguotv://app/` 渲染正常。

**DSH 采信理由**：有原始 JSON 证据 + 复现命令，且与 T3 报告一致；属**运行时实测**而非构建推断。

---

## 三、T3 报告的偏离项（DSH 审阅并接受，均不改变结论）

| # | 偏离 | DSH 判定 |
| --- | --- | --- |
| 1 | 步骤 3 用 `--web-only` | **接受**：`dist-win` 被清空至只剩被锁的 `default_app.asar`，全量模式会产坏包；桌面由 electron-builder 单独产出 |
| 2 | 桌面改道 `%TEMP%` + 用 README 的 `--x64 --arm64` | **接受**：brief 字面脚本只出宿主架构会缺 arm64/universal；且 `outputs/windows` 首次失败于 `EPERM`（锁定进程 `Qoder CN` PID 39584、`WorkBuddy AI` PID 43064，**未杀**） |
| 3 | `outputs/w7-release` 用目录联接通过校验脚本 | **接受**：脚本硬编码该路径（已被 DSH 清理）；**未改脚本、未放宽断言**，验证后已移除联接 |
| 4 | 桌面 EXE 未签名 | **接受并在 README 明示**（见 2.5） |
| 5 | 未占用设备、API22 未验证 | **接受**：沿用既有局限，已在 README 第四节警示 |

**DSH 复核偏离 3 的诚实性**：联接已移除（实测 `outputs/w7-release` 不存在）；`verify-release-packages.py` 未被我方或 opencode 修改（`git diff` 该文件无差异）。

---

## 四、发布执行记录

| 步骤 | 结果 |
| --- | --- |
| 代码版本 | `3d7b0de`（HEAD，业务代码 == `a623f8a`） |
| git tag | 见提交记录 |
| 推送 `origin` | 见提交记录 |
| GitHub Release | v1.0.2，上传 16 个产物 + `SHA256SUMS.txt` |
| 发布说明 | 含命名变更对照、API22 未验证、桌面未签名等如实标注 |

---

## 五、发布后仍未验证项（如实留档，不因发布而消失）

1. 🔴 **API 22（Android 5.1）实机未验证** —— `mumu-r` offline，APK 仅配置层满足 minSdk 22
2. 🟠 **Linux / macOS Web 包未在对应宿主启动** —— 仅在 Windows 构建
3. 🟠 **sync 家庭共享服务未单独实测**
4. 🟠 **桌面端未签名**，且未在干净机器上做安装/卸载实测
5. 🟡 **手机端不包含在本次发布**，其第二段实施仍待 DSH 放行

---

*本文件为 DSH 的最终验收与发布记录；所有"实测"来自 2026-10-17 本会话真实命令。*
