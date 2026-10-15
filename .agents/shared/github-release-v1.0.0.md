# 红果短剧 v1.0.0

非官方多端短剧客户端，提供 **Web / Windows 桌面 / Android TV** 三端。

> 本项目为非官方客户端，与内容平台无关联。请遵守当地法律法规与内容平台服务条款。

---

## 下载选择

### Windows 桌面端

| 你的设备 | 下载 |
| --- | --- |
| 常见 Intel / AMD 电脑 | **`红果短剧-1.0.0-x64-setup.exe`** |
| 骁龙 X 系列 / Surface Pro X 等 ARM 设备 | **`红果短剧-1.0.0-arm64-setup.exe`** |
| 不确定架构，或想要一个通用包 | **`红果短剧-1.0.0-setup.exe`**（含双架构，体积较大） |
| 不想安装，直接运行 | 对应架构的 `-portable.exe` |

安装包支持自选目录、创建快捷方式、可正常卸载。

**首次运行提示**：若 Windows SmartScreen 拦截，点击「更多信息」→「仍要运行」。程序已签名，但证书为自签名，系统仍会提示。

### Android TV / 电视盒子

| 文件 | 说明 |
| --- | --- |
| **`hongguotv-android5.1-release-signed.apk`** | **推荐**。Android 5.1+，四种 CPU 架构通用 |
| `hongguotv-android5.1-debug.apk` | 调试版，仅用于问题排查 |

安装方式：U 盘拷入后通过文件管理器安装，或使用 `adb install`。

### Web 服务端

解压后运行 `start.cmd`（Windows）或 `./start.sh`（Linux/macOS），**无需预装 Node.js**（产物内置运行时）。

| 平台 | 文件 |
| --- | --- |
| Windows x64 / arm64 | `hongguotv-web-win-x64.zip` / `hongguotv-web-win-arm64.zip` |
| Linux x64 / arm64 | `hongguotv-web-linux-x64.tar.gz` / `hongguotv-web-linux-arm64.tar.gz` |
| macOS x64 / arm64 | `hongguotv-web-darwin-x64.tar.gz` / `hongguotv-web-darwin-arm64.tar.gz` |

另有 `hongguotv-sync-linux-*.tar.gz` —— 家庭共享服务端，用于多设备同步，非必需。

---

## 本次更新

### 播放链路

- **修复三端全部无法播放**：上游对固定设备标识静默封禁（返回 HTTP 200 但响应体为空），现改为每次请求生成独立设备标识
- **修复 TV 端播放失败**：TV 的 QuickJS 环境不提供 `crypto.randomBytes`，随机源改为按环境能力降级

### 全屏

- **推荐流新增全屏按钮**（右上角，与倍速/画质并列）
- **详情页全屏修复**：修正全屏样式被普通布局约束覆盖的问题
- **真·屏幕全屏**：覆盖任务栏区域，非窗口最大化
- **全屏下保留自动下一集**

### 分页

- 分类与排行榜改为**自动分页**，移除「加载更多」按钮
- 修复分页后的选中状态、焦点位置与滚动位置
- 修复榜单条目重复追加（显示 120 条，实际 100 条）

### 稳定性

- **端口被占用时自动递增**（8788→8789…），不再启动失败
- 新增播放链路诊断工具与发布前冒烟门禁

### 界面

- TV 端分类页改为左侧双列布局（类型 + 题材）
- TV 端卡片改内容驱动高度，消除底部空白

---

## 平台要求

| 端 | 要求 |
| --- | --- |
| Web / Windows | Windows 10+ / Linux / macOS（产物内置运行时） |
| Android TV | **Android 5.1（API 22）以上**，支持 armeabi-v7a / arm64-v8a / x86 / x86_64 |

---

## 数据与同步

- 各端本地保存收藏、历史、搜索与偏好
- 填写**同一远程地址与家庭密钥**即可多端同步；未配置时正常本地使用
- 数据位于用户资料目录，**更新程序不会覆盖数据**

---

## 校验下载

每个产物均提供 SHA256，见附件 `SHA256SUMS.txt`。

```powershell
# Windows
Get-FileHash .\红果短剧-1.0.0-x64-setup.exe -Algorithm SHA256
```

```bash
# Linux / macOS
sha256sum hongguotv-web-linux-x64.tar.gz
```

---

## 质量保障

| 项 | 结果 |
| --- | --- |
| Node 测试 | **144 项通过** |
| TV 单元测试 | **32 项通过** |
| 类型检查 | 通过 |
| 播放冒烟门禁 | 通过（真实上游取流验证） |
| 设备实测 | 4 台（含 Android 5.1 真机） |

---

## 完整产物清单

### Windows 桌面端

| 文件 | 大小 |
| --- | --- |
| `红果短剧-1.0.0-x64-setup.exe` | 112.1 MB |
| `红果短剧-1.0.0-x64-portable.exe` | 111.8 MB |
| `红果短剧-1.0.0-arm64-setup.exe` | 103.6 MB |
| `红果短剧-1.0.0-arm64-portable.exe` | 103.4 MB |
| `红果短剧-1.0.0-setup.exe` | 215.1 MB（双架构） |
| `红果短剧-1.0.0-portable.exe` | 214.8 MB（双架构） |

### Android TV

| 文件 | 大小 |
| --- | --- |
| `hongguotv-android5.1-release-signed.apk` | 6.6 MB |
| `hongguotv-android5.1-debug.apk` | 8.2 MB |

### Web 服务端

| 文件 | 大小 |
| --- | --- |
| `hongguotv-web-win-x64.zip` | 32.6 MB |
| `hongguotv-web-win-arm64.zip` | 28.3 MB |
| `hongguotv-web-linux-x64.tar.gz` | 42.6 MB |
| `hongguotv-web-linux-arm64.tar.gz` | 42.4 MB |
| `hongguotv-web-darwin-x64.tar.gz` | 37.2 MB |
| `hongguotv-web-darwin-arm64.tar.gz` | 36.0 MB |

### 家庭共享服务端

| 文件 | 大小 |
| --- | --- |
| `hongguotv-sync-linux-x64.tar.gz` | 41.4 MB |
| `hongguotv-sync-linux-arm64.tar.gz` | 41.2 MB |

---

## 源码构建

需要 **Node.js 22.13+**。

```powershell
npm ci
npm --prefix apps/web-pc ci

npm run server      # 本地内容服务，默认 8788
npm run dev         # Web 开发页，默认 3000
npm test            # 144 项测试
npm run typecheck   # TypeScript 类型检查
```

Android TV 另需 JDK 17、Android SDK 35、NDK 28.2。

完整说明见仓库 [README](https://github.com/sgsjsvc/hongguoTV#readme)。

---

## 许可证

[GPL-3.0](https://github.com/sgsjsvc/hongguoTV/blob/main/LICENSE)
