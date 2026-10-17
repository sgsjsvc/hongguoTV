# 红果短剧 多端客户端 — 发布包 v1.0.2

**版本**: 1.0.2
**生成时间**: 2026-10-17
**代码基线**: `d23d64f`（业务代码等价于冻结基线 `a623f8a`；差异仅三个版本号文件）
**合计**: 16 个交付文件（详见 `manifest.json`）

> **目录结构自 2026-10-16 起为扁平**：所有产物直接放在 `release/` 下，不再按平台建子目录。
> 命名规则见第一节。**本次命名与 v1.0.1 不同**，对照见第十节。

---

## 一、命名规则

| 类型 | 格式 | 示例 |
| --- | --- | --- |
| Windows 桌面端 | `hongguotv-desktop-win-<架构>-<形态>.exe` | `hongguotv-desktop-win-x64-setup.exe` |
| Web 服务端 | `hongguotv-web-<平台>-<架构>.<zip\|tar.gz>` | `hongguotv-web-win-x64.zip` |
| 家庭共享服务端 | `hongguotv-sync-<平台>-<架构>.tar.gz` | `hongguotv-sync-linux-x64.tar.gz` |
| Android TV | `hongguotv-tv-android5.1-<类型>.apk` | `hongguotv-tv-android5.1-release.apk` |

**说明**：

- `<架构>`：`x64` / `arm64` / `universal`（双架构合一）
- `<形态>`：`setup`（安装包）/ `portable`（免安装）
- 重命名**只发生在 `release/` 内**，构建产物与源码保持原名
  （如 Windows 构建产物仍叫 `红果短剧-1.0.2-x64-setup.exe`）

---

## 二、Windows 桌面端

| 文件 | 说明 |
| --- | --- |
| `hongguotv-desktop-win-x64-setup.exe` | **推荐**。x64 安装包（NSIS） |
| `hongguotv-desktop-win-x64-portable.exe` | x64 便携版（免安装） |
| `hongguotv-desktop-win-arm64-setup.exe` | ARM64 安装包 |
| `hongguotv-desktop-win-arm64-portable.exe` | ARM64 便携版 |
| `hongguotv-desktop-win-universal-setup.exe` | 双架构安装包（不确定架构时选这个） |
| `hongguotv-desktop-win-universal-portable.exe` | 双架构便携版 |

### 特点

- **免环境**：内置 Node 运行时与本地后端，**无需安装 Node.js**
- **安装包**：可选安装目录、创建桌面/开始菜单快捷方式、可从控制面板卸载
- **本次运行验证通过**（见第八节）：启动 → 窗口出现 → 单实例 → IPC/全屏 → 内置后端可用

### 如何选择架构

| 你的设备 | 选择 |
| --- | --- |
| 普通 Intel/AMD 电脑 | **x64** |
| Surface Pro X、骁龙笔记本等 ARM 设备 | arm64 |
| 不确定 | universal（体积较大但一定可用） |

按 `Win + R` → 输入 `msinfo32` → 查看「系统类型」可确认。

### ⚠️ 关于签名（本次变更）

**本次 6 个桌面 EXE 均为「未签名」（NotSigned）** —— 构建环境未提供代码签名证书
（`HG_CODESIGN_PFX` / `HG_CODESIGN_PASSWORD` 未设置），按 electron-builder 配置跳过签名。

因此**首次运行会出现「未知发布者」SmartScreen 提示**，点击「更多信息」→「仍要运行」即可。
**这与 v1.0.1 及更早的已签名包不同**，请以 `SHA256SUMS.txt` 校验完整性。

---

## 三、Web 服务端

脚本启动，**无需安装任何环境**（包内自带 Node 运行时）。

| 文件 | 平台 |
| --- | --- |
| `hongguotv-web-win-x64.zip` | Windows x64 |
| `hongguotv-web-win-arm64.zip` | Windows ARM64 |
| `hongguotv-web-linux-x64.tar.gz` | Linux x64 |
| `hongguotv-web-linux-arm64.tar.gz` | Linux ARM64 |
| `hongguotv-web-darwin-x64.tar.gz` | macOS Intel |
| `hongguotv-web-darwin-arm64.tar.gz` | macOS Apple Silicon |
| `hongguotv-sync-linux-x64.tar.gz` | 家庭共享服务（Linux x64） |
| `hongguotv-sync-linux-arm64.tar.gz` | 家庭共享服务（Linux ARM64） |

### 启动方式

**Windows**：解压后双击 `start.cmd`

**Linux / macOS**：

```bash
tar -xzf hongguotv-web-linux-x64.tar.gz
cd hongguotv-web-linux-x64
./start.sh
```

### 说明

- `web` 包：独立本地服务，默认端口 **8788**
- `sync` 包：家庭资料远程共享服务，默认端口 **8791**
  - 首次启动生成 `shared-key.txt`，各端填写地址与密钥

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `HG_PORT` | 指定固定端口（不指定时端口占用会自动递增） |
| `HG_DATA_DIR` | 指定数据目录 |

数据默认位于用户资料目录，**更新程序不会覆盖数据**。

---

## 四、Android TV 客户端

| 文件 | 说明 |
| --- | --- |
| `hongguotv-tv-android5.1-release.apk` | **推荐**。已签名发布版 |
| `hongguotv-tv-android5.1-debug.apk` | 调试版（含调试信息） |

### 兼容性

| 项 | 值 |
| --- | --- |
| 最低系统 | **Android 5.1（API 22）** |
| 目标系统 | Android 15（API 35） |
| CPU 架构 | **armeabi-v7a / arm64-v8a / x86 / x86_64**（四种全覆盖） |
| 版本 | versionCode **3** / versionName **1.0.2** |

**签名方案**：v1 + v2 双签名（**v1 为 Android 5.1/6.0 必需**）。`apksigner verify` 实测有效，
证书 `CN=HongguoTV, OU=TV Client`，SHA-256 `c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151`。

### ⚠️ 兼容性验证范围（重要）

- ✅ **已通过**：API 32 / API 35 模拟器实测（启动、真实内容获取、真实播放、无崩溃）
- ❌ **未验证**：**API 22（Android 5.1）实机未验证** —— 唯一真机 `mumu-r`（192.168.1.120:5555）当时 **offline**，未能连接。
  APK 在**配置层**满足 `minSdk 22`，但**运行层无实机证据**。
- **不得**据模拟器结果声称 Android 5.1 兼容性已验证。

### 安装

```bash
adb install hongguotv-tv-android5.1-release.apk
```

或把 APK 拷到 U 盘，在电视上通过文件管理器安装。

### 说明

- **推荐使用 `release`**：已签名、体积最小
- `debug` 版与 `release` 版**包名相同但签名不同**，两者不能互相覆盖安装

---

## 五、校验完整性

```bash
# Linux / macOS
sha256sum -c SHA256SUMS.txt

# Windows（PowerShell）
Get-FileHash .\hongguotv-desktop-win-x64-setup.exe -Algorithm SHA256
```

也可参考 `manifest.json`（含每个文件的来源与大小）。

---

## 六、环境要求汇总

| 端 | 用户需安装的环境 |
| --- | --- |
| Windows 桌面端 | **无**（内置 Node 运行时） |
| Web 服务端 | **无**（内置 Node 运行时） |
| Android TV | **无**（原生 APK） |

**三端均为免环境部署。**

---

## 七、签名信息

### Windows 代码签名证书

**本次未使用**（产物为 NotSigned，见第二节）。此前版本的自签名证书信息保留备查：

```
Subject:     CN=HongguoTV, O=HongguoTV, C=CN
Thumbprint:  E973A5F64F3B1A966D2EF4471423F2AAAC3D5F62
有效期至:    2036-10-15
算法:        RSA 4096 / SHA-256
```

### Android 签名证书

```
DN:          CN=HongguoTV, OU=TV Client, O=HongguoTV, L=Unknown, ST=Unknown, C=CN
SHA-256:     c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151
算法:        RSA 4096
有效期:      10000 天
```

> ⚠️ **密钥备份**：签名密钥需离线备份。丢失后无法为已安装用户推送更新。

---

## 八、本次发布验证范围（如实标注）

| 端 | 构建 | 运行验证 | 结论 |
| --- | --- | --- | --- |
| Web（6 平台包） | ✅ | ✅ 源码模式 + 打包产物双通道真实内容 | **通过** |
| Windows 桌面（6 EXE） | ✅ | ✅ **可见窗口实测**（启动/单实例/IPC/全屏/内置后端 200） | **通过** |
| Android TV（API 32/35 模拟器） | ✅ | ✅ 3 台真实播放 | **通过** |
| Android TV（API 22 实机） | APK 支持 minSdk 22 | ❌ 真机 offline | **未验证** |
| Linux / macOS Web 包 | ✅ | ❌ 未在对应宿主启动 | **未验证** |
| 家庭共享服务（sync） | ✅ | 未单独实测 | **未验证** |
| **手机端（Android）** | — | — | **本次不包含** |

**门禁实测**：`npm test` 214/214 通过、`typecheck` 退出 0、`smoke` 清晰度 3/3 + 取流 3/3、
`verify-release-packages.py` web 6/6 与桌面 2/2 全绿、`SHA256SUMS.txt` 16/16 复校一致。

**关键不变量**（独立复核）：全部 Web 包与桌面 staging 内置入口
`custom-server/index.mjs` SHA256 = `b2dbaea0a915b13d44348f88cb2ed2f1f8e0338044c9b84d99e10722001a0333`（已验收接线版）；
共享引擎三副本 `cf3d685cc60d3045336805e41150d72340c052de1a600caab96b794d48042bf2`。

---

## 九、已知限制

1. **Windows 桌面端未签名** —— 本次无证书，首次运行有 SmartScreen 提示
2. **Android APK 未上架应用商店** —— 需手动安装
3. **API 22 兼容性未实机验证** —— 见第四节
4. **Linux / macOS Web 包仅在 Windows 上构建** —— 未在对应系统实机启动验证
5. **手机端不包含在本次发布** —— 平台已定仅 Android，实施方式为移植 Web 代码，仍在可行性验证阶段

---

## 十、与 v1.0.1 的命名变更对照

| v1.0.1 资产名 | v1.0.2 资产名 |
| --- | --- |
| `hongguotv-win-x64-setup.exe` | `hongguotv-desktop-win-x64-setup.exe` |
| `hongguotv-win-x64-portable.exe` | `hongguotv-desktop-win-x64-portable.exe` |
| `hongguotv-win-arm64-setup.exe` | `hongguotv-desktop-win-arm64-setup.exe` |
| `hongguotv-win-arm64-portable.exe` | `hongguotv-desktop-win-arm64-portable.exe` |
| `hongguotv-win-setup.exe` | `hongguotv-desktop-win-universal-setup.exe` |
| `hongguotv-win-portable.exe` | `hongguotv-desktop-win-universal-portable.exe` |
| `hongguotv-android5.1-release-signed.apk` | `hongguotv-tv-android5.1-release.apk` |
| `hongguotv-android5.1-debug.apk` | `hongguotv-tv-android5.1-debug.apk` |

Web 与 sync 包命名未变。

---

## 十一、重新生成

```powershell
npm run release:check        # 门禁：测试 + 类型检查 + 播放冒烟
npm run build                # 前端
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,darwin-x64,darwin-arm64,linux-x64,linux-arm64
# 桌面端用 electron-builder（--win --x64 --arm64），TV 端用 gradlew
node scripts/collect-release.mjs   # 汇总到 release/ 并统一命名
```

> ⚠️ `collect-release.mjs` 是**搬运工，不负责构建**。
> 它会清空 `release/` 下的产物（保留 `*.md`），再从 `outputs/` 复制。
> **打包后必须先确认 `outputs/` 下的源目录是最新的**，否则会搬运旧产物。
