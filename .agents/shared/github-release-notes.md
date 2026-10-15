# GitHub Release 填写内容

**协调者**: dsh
**日期**: 2026-10-15
**用途**: 直接复制粘贴到 GitHub「New release」页面

---

## 一、Tag

```
v1.0.0
```

**选择 `Create new tag: v1.0.0 on publish`**

**核实**：

- 远程仓库**无任何 tag**（`git ls-remote --tags origin` 为空）
- 本地 22 个 tag **全部是旧项目遗留**，均不在当前 `main` 历史中
- `v1.0.0` 未被占用，可安全使用

---

## 二、Target

```
main
```

当前 `main` = `67517c1`

---

## 三、Release title

```
v1.0.0 — 首个正式版
```

---

## 四、Release notes

````markdown
非官方多端短剧客户端，提供 **Web / Windows 桌面 / Android TV** 三端，均为**免环境部署**。

## 亮点

- **免环境**：三端产物内置运行环境，用户无需安装 Node.js 或任何依赖
- **全架构覆盖**：Windows x64/arm64、Web 六平台、Android TV 四种 CPU 架构
- **兼容 Android 5.1+**：TV 端最低支持 Android 5.1（API 22），v1 + v2 双签名
- **已签名**：Windows 产物与 Android APK 均已代码签名

## 下载选择

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows x64 | `红果短剧-1.0.0-x64-setup.exe` | 安装包（可选目录、建快捷方式、可卸载） |
| Windows x64 | `红果短剧-1.0.0-x64-portable.exe` | 便携版（免安装） |
| Windows arm64 | `红果短剧-1.0.0-arm64-setup.exe` | 骁龙 / Surface Pro X 等 ARM 设备 |
| Windows arm64 | `红果短剧-1.0.0-arm64-portable.exe` | ARM 便携版 |
| Android TV | `hongguotv-android5.1-release-signed.apk` | **推荐**，Android 5.1+，四架构通用 |
| Web (Win x64) | `hongguotv-web-win-x64.zip` | 解压后双击 `start.cmd` |
| Web (Linux x64) | `hongguotv-web-linux-x64.tar.gz` | `./start.sh` |
| Web (macOS) | `hongguotv-web-darwin-*.tar.gz` | Intel / Apple Silicon |
| 家庭共享服务 | `hongguotv-sync-linux-*.tar.gz` | 远程同步服务 |

其余架构（`win-arm64`、`linux-arm64`、`darwin-arm64`、`sync-linux-arm64`）见完整附件列表。

**不确定架构？** 按 `Win + R` → 输入 `msinfo32` → 查看「系统类型」。

## 功能

- 推荐流沉浸式播放，单集结束自动续播同剧下一集
- 分类、榜单（红果热播 / 真人剧 / 漫剧 / AI 剧）、搜索
- 收藏、历史、搜索记录本地保存
- 可选连接家庭共享服务，多端双向同步
- TV 端针对遥控器优化，切剧时仅显示轻量提示与加载动画

## 平台要求

| 端 | 要求 |
| --- | --- |
| Windows | Windows 10 及以上 |
| Web | Windows / Linux / macOS（产物内置运行时） |
| Android TV | **Android 5.1（API 22）以上** |

## 安装说明

**Windows**：运行安装包，按向导完成。若出现 SmartScreen 提示，点击「更多信息」→「仍要运行」；或先导入附件中的 `hongguotv-codesign.cer` 到「受信任的根证书颁发机构」以消除提示。

**Android TV**：

```bash
adb install hongguotv-android5.1-release-signed.apk
```

或拷贝到 U 盘，在电视上用文件管理器安装。

**Web**：解压后运行 `start.cmd`（Windows）或 `./start.sh`（Linux/macOS），默认端口 8788。

## 数据与同步

各端数据保存在用户资料目录，**更新程序不会覆盖数据**。填写同一远程地址与家庭密钥即可多端同步；未配置时正常本地使用。

## 校验

附件含 `SHA256SUMS.txt`：

```bash
sha256sum -c SHA256SUMS.txt
```

## 说明

- 本项目为非官方客户端，与内容平台无关联
- Windows 使用自签名证书，未导入证书的机器首次运行会有 SmartScreen 提示；彻底消除需购买 OV/EV 代码签名证书
- 许可证：[GPL-3.0](https://github.com/sgsjsvc/hongguoTV/blob/main/LICENSE)
````

---

## 五、附件（Assets）

**需要手动上传**（`release/` 不入版本库）。

### 建议上传的核心文件（11 个，约 700 MB）

| 文件 | 大小 |
| --- | --- |
| `红果短剧-1.0.0-x64-setup.exe` | 111.99 MB |
| `红果短剧-1.0.0-x64-portable.exe` | 111.73 MB |
| `红果短剧-1.0.0-arm64-setup.exe` | 103.57 MB |
| `红果短剧-1.0.0-arm64-portable.exe` | 103.31 MB |
| `hongguotv-android5.1-release-signed.apk` | 6.58 MB |
| `hongguotv-web-win-x64.zip` | 32.30 MB |
| `hongguotv-web-win-arm64.zip` | 28.12 MB |
| `hongguotv-web-linux-x64.tar.gz` | 42.34 MB |
| `hongguotv-web-linux-arm64.tar.gz` | 42.20 MB |
| `hongguotv-web-darwin-x64.tar.gz` | 36.95 MB |
| `hongguotv-web-darwin-arm64.tar.gz` | 35.79 MB |

### 可选（推荐一并上传）

| 文件 | 说明 |
| --- | --- |
| `hongguotv-sync-linux-x64.tar.gz` | 家庭共享服务 |
| `hongguotv-sync-linux-arm64.tar.gz` | 家庭共享服务 |
| `hongguotv-codesign.cer` | 证书公钥（消除 SmartScreen 用） |
| `SHA256SUMS.txt` | 校验值 |

### 不建议上传

| 文件 | 原因 |
| --- | --- |
| `hongguotv-android5.1-debug.apk` | 调试版，体积更大 |
| `hongguotv-android5.1.1-debug.apk` | 早期调试版 |
| `hongguotv-android5.1-release-unsigned.apk` | **未签名，无法安装** |

> **注意**：GitHub Release 单文件上限 **2 GB**，本批产物最大 112 MB，无问题。
> 全部附件合计约 760 MB。

---

## 六、操作步骤

1. **Tag**：选择 `Create new tag: v1.0.0 on publish`
2. **Target**：`main`
3. **Release title**：`v1.0.0 — 首个正式版`
4. **Describe this release**：粘贴第四节内容
5. **Attach binaries**：拖入 `release/` 下的文件（见第五节）
6. 勾选 **Set as the latest release**
7. 点击 **Publish release**

---

## 七、上传后建议

创建 tag 后，本地同步：

```powershell
git fetch --tags
```

若需本地也打 tag（便于后续对比）：

```powershell
git tag -a v1.0.0 -m "v1.0.0 首个正式版"
git push origin v1.0.0
```
