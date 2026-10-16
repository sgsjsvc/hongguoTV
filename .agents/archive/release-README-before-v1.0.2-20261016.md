# 红果短剧 多端客户端 — 发布包

**版本**: 1.0.0
**生成时间**: 2026-10-16
**合计**: 16 个交付文件，1178.36 MB（详见 `manifest.json`）

> **目录结构自 2026-10-16 起改为扁平**：所有产物直接放在 `release/` 下，不再按平台建子目录。
> 命名规则见下方第一节。

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
  （如 Windows 构建产物仍叫 `红果短剧-1.0.0-x64-setup.exe`）

---

## 二、Windows 桌面端

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `hongguotv-desktop-win-x64-setup.exe` | 112.25 MB | **推荐**。x64 安装包（NSIS） |
| `hongguotv-desktop-win-x64-portable.exe` | 112.00 MB | x64 便携版（免安装） |
| `hongguotv-desktop-win-arm64-setup.exe` | 103.74 MB | ARM64 安装包 |
| `hongguotv-desktop-win-arm64-portable.exe` | 103.48 MB | ARM64 便携版 |
| `hongguotv-desktop-win-universal-setup.exe` | 215.36 MB | 双架构安装包（不确定架构时选这个） |
| `hongguotv-desktop-win-universal-portable.exe` | 215.10 MB | 双架构便携版 |

### 特点

- **免环境**：内置 Node 运行时（`runtime/node.exe`）与本地后端，**无需安装 Node.js**
- **安装包**：可选安装目录、创建桌面/开始菜单快捷方式、可从控制面板卸载
- **已签名**：使用自签名证书，v1 + v2 双签名

### 如何选择架构

| 你的设备 | 选择 |
| --- | --- |
| 普通 Intel/AMD 电脑 | **x64** |
| Surface Pro X、骁龙笔记本等 ARM 设备 | arm64 |
| 不确定 | universal（体积较大但一定可用） |

按 `Win + R` → 输入 `msinfo32` → 查看「系统类型」可确认。

### 关于 SmartScreen 警告

使用**自签名证书**，未导入证书的机器首次运行会有「未知发布者」提示。
点击「更多信息」→「仍要运行」即可。可用 `SHA256SUMS.txt` 校验文件完整性。

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

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `hongguotv-tv-android5.1-release.apk` | 6.58 MB | **推荐**。已签名发布版 |
| `hongguotv-tv-android5.1-debug.apk` | 8.16 MB | 调试版（含调试信息） |

### 兼容性

| 项 | 值 |
| --- | --- |
| 最低系统 | **Android 5.1（API 22）** |
| 目标系统 | Android 15（API 35） |
| CPU 架构 | **armeabi-v7a / arm64-v8a / x86 / x86_64**（四种全覆盖） |

**签名方案**：v1 + v2 双签名（**v1 为 Android 5.1/6.0 必需**）

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

```
Subject:     CN=HongguoTV, O=HongguoTV, C=CN
Thumbprint:  E973A5F64F3B1A966D2EF4471423F2AAAC3D5F62
有效期至:    2036-10-15
算法:        RSA 4096 / SHA-256
时间戳:      DigiCert（RFC 3161）
```

### Android 签名证书

```
DN:          CN=HongguoTV, OU=TV Client, O=HongguoTV, L=Unknown, ST=Unknown, C=CN
SHA-256:     c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151
算法:        RSA 4096
有效期:      10000 天
```

> ⚠️ **密钥备份**：两个签名密钥均需离线备份。丢失后无法为已安装用户推送更新。

---

## 八、已知限制

1. **Windows 使用自签名证书** —— 未装证书的机器首次运行会有 SmartScreen 提示
2. **Android APK 未上架应用商店** —— 需手动安装
3. **Linux / macOS Web 包仅在 Windows 上构建** —— 未在对应系统实机启动验证

---

## 九、重新生成

```powershell
npm run release:check        # 门禁：测试 + 类型检查 + 播放冒烟
npm run build                # 前端
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,darwin-x64,darwin-arm64,linux-x64,linux-arm64
# 桌面端与 TV 端打包（见仓库 README）
node scripts/collect-release.mjs   # 汇总到 release/ 并统一命名
```

> ⚠️ `collect-release.mjs` 是**搬运工，不负责构建**。
> 它会清空 `release/` 下的产物（保留 `*.md`），再从 `outputs/` 复制。
> **打包后必须先确认 `outputs/` 下的源目录是最新的**，否则会搬运旧产物。
