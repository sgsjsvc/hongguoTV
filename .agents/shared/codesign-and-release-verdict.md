# Windows 代码签名与产物汇总 — 验收报告

**协调者**: dsh
**时间**: 2026-10-15 03:00
**结论**: ✅ **完成**，并**发现并修复一个致命缺陷**

---

## 一、交付内容

### 1. Windows 代码签名

| 项 | 位置 |
| --- | --- |
| 签名配置 | `apps/web-pc/electron-builder.config.cjs` |
| 证书（含私钥） | `%USERPROFILE%\.hongguotv\hongguotv-codesign.pfx`（项目外） |
| 证书公钥 | `%USERPROFILE%\.hongguotv\hongguotv-codesign.cer` |
| 信任安装 | 已装入 `Cert:\CurrentUser\Root` 与 `TrustedPublisher` |

**证书规格**：

```
Subject:     CN=HongguoTV, O=HongguoTV, C=CN
Thumbprint:  E973A5F64F3B1A966D2EF4471423F2AAAC3D5F62
有效期至:    2036-10-15（10 年）
算法:        RSA 4096 / SHA-256
时间戳:      DigiCert RFC 3161
```

**安全设计**：

- 证书与密码**不写入配置文件**，通过环境变量传入（`HG_CODESIGN_PFX` / `HG_CODESIGN_PASSWORD`）
- 证书缺失时**跳过签名但不阻塞构建**，便于 CI 与新克隆
- 提供了证书却无法签名时**明确警告**（而非静默跳过）

### 2. 产物汇总

**位置**：仓库根目录 `release/`（已加入 `.gitignore`）

```
release/
├── README.md          发布说明（含安装指引、SmartScreen 处理、签名信息）
├── SHA256SUMS.txt     16 个产物的 SHA-256
├── manifest.json      产物清单（JSON）
├── windows/           5 个（4 个 exe + 证书公钥）
├── web/               8 个（6 平台 web + 2 sync）
└── tv/                4 个 APK
```

**合计 16 个文件，760.70 MB**

**汇总脚本**：`scripts/collect-release.mjs`（可重复执行，幂等）

---

## 二、🔴 发现并修复的致命缺陷

### 现象

Windows **便携版**启动后立即退出。错误日志：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'axios'
imported from C:\...\Temp\<随机>\resources\hongguotv\custom-server\index.mjs
```

### 根因

`electron-builder` 的 `extraResources` 对**根级 `node_modules` 目录有硬编码排除**。

协调者阅读了 electron-builder 源码（`app-builder-lib/out/util/filter.js`）：

```javascript
function createFilter(src, patterns, excludePatterns) {
    const srcWithEndSlash = ensureEndSlash(src);
    return (file, stat) => {
        if (src === file) return true;
        let relative = getRelativePath(file, srcWithEndSlash, stat);
        // filter the root node_modules, but not a subnode_modules
        if (relative === "node_modules") {
            return false;        // ← 在应用自定义 patterns 之前就返回
        }
        ...
```

**关键**：该判断**在应用用户自定义 `filter` 之前**执行，因此：

```javascript
filter: ["**/*"]                    // ❌ 无效
filter: ["**/*", "!node_modules/**/*"]  // ❌ 也无效
```

**均无法覆盖**。

### 影响

`custom-server/index.mjs` 第 7 行 `import axios from "axios"`，而 `node_modules` 未被装入 → **后端无法启动 → 应用完全不可用**。

### 修复

改用 **`extraFiles`**（该配置项无此限制）：

```javascript
extraResources: [
  {
    from: webBundle,
    to: "hongguotv",
    filter: ["**/*", "!node_modules/**/*", "!**/*.log", "!**/*.map"],
  },
],
extraFiles: [
  {
    from: path.join(webBundle, "node_modules"),
    to: "resources/hongguotv/node_modules",
    filter: ["**/*"],
  },
],
```

### 验证

| 项 | 结果 |
| --- | --- |
| `win-unpacked/resources/hongguotv/node_modules` | ✅ 23 个包，含 `axios` |
| 便携版启动（无 Node 环境） | ✅ 窗口标题 `红果短剧 - 多端客户端` |
| 后端子进程 | ✅ 使用包内 `runtime/node.exe` |
| 错误日志 | ✅ 无 |

### 为什么之前的验证没发现

协调者此前测试的是 `win-unpacked`，**那次测试成功是因为当时的目录来自更早的构建**。本次重新打包后才暴露出问题。

**教训**：重新打包后必须**重新做端到端验证**，不能沿用旧结论。

---

## 三、验证结果

### 3.1 签名验证

```
✓ 红果短剧-1.0.0-x64-setup.exe
✓ 红果短剧-1.0.0-x64-portable.exe
✓ 红果短剧-1.0.0-arm64-setup.exe
✓ 红果短剧-1.0.0-arm64-portable.exe
```

`signtool verify /pa` 全部通过（严格策略）。时间戳由 DigiCert 签发。

### 3.2 APK 签名

```
✓ 已签名  hongguotv-android5.1-release-signed.apk
✓ 已签名  hongguotv-android5.1-debug.apk
✓ 已签名  hongguotv-android5.1.1-debug.apk
— 未签名  hongguotv-android5.1-release-unsigned.apk（预期）
```

### 3.3 完整性校验

用 Node 校验 `SHA256SUMS.txt` 全部 16 条：**全部通过**。

> 注：PowerShell 读取该文件会显示中文乱码（GBK 解码 UTF-8 所致），**文件本身是正确的 UTF-8**。

### 3.4 免环境验证（决定性）

**便携版**（之前失败的场景）在 **PATH 无 Node** 的情况下：

| 检查 | 结果 |
| --- | --- |
| 进程存活 | ✅ |
| 窗口标题 | ✅ `红果短剧 - 多端客户端` |
| 后端进程 | ✅ `Temp\<随机>\resources\hongguotv\runtime\node.exe` |
| 错误日志 | ✅ 无 |
| 界面渲染 | ✅ 首页、轮播、榜单、剧集卡片正常（截图存证） |

---

## 四、自签名证书的局限（如实说明）

自签名证书**不能消除**其他机器的 SmartScreen 警告：

```
SignTool Error: A certificate chain processed, but terminated in a root
certificate which is not trusted by the trust provider.
```

**本机已通过装入受信任根解决**，但：

- 用户机器需**手动导入** `hongguotv-codesign.cer` 才能消除警告
- 要**彻底消除**需购买 OV/EV 代码签名证书（约 1000-4000 元/年）

已在 `release/README.md` 中说明处理方式。

---

## 五、遗留事项

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | **密钥备份** | 两个签名密钥（Android `.jks` + Windows `.pfx`）均需离线备份 |
| 2 | **密码文件** | `.storepass` / `.certpass` 明文存于 `%USERPROFILE%\.hongguotv\`，建议移入密码管理器后删除 |
| 3 | 正式证书 | 如需消除 SmartScreen，购买 OV/EV 证书 |
| 4 | 自动化 | `collect-release.mjs` 可接入 CI |

---

## 六、结论

| 需求 | 状态 |
| --- | --- |
| 配置 Windows 代码签名 | ✅ 四个产物全部签名并验证 |
| 所有产物放在一个文件夹 | ✅ `release/`（16 个文件，760.70 MB） |
| 免环境运行 | ✅ 便携版在无 Node 环境实测通过 |
| 兼容所有 CPU 架构 | ✅ Windows x64/arm64、Web 6 平台、TV 4 ABI |

**同时发现并修复了一个会导致 Windows 包完全无法启动的缺陷。**
