# 红果短剧

非官方多端短剧客户端。提供 **Web / Windows 桌面 / Android TV** 三端，各端内置内容获取与播放处理，本地保存收藏、历史、搜索与偏好，可选连接家庭共享服务双向同步。

源码仓库：<https://github.com/sgsjsvc/hongguoTV> · 许可证：[GPL-3.0](LICENSE)

> 本项目为非官方客户端，与内容平台无关联。请遵守当地法律法规与内容平台服务条款。

---

## 快速开始

### 普通用户（免环境）

获取发布产物（由 `node scripts/collect-release.mjs` 汇总生成，**不入版本库**），**无需安装 Node.js 或任何运行环境**。

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows x64 | `红果短剧-1.0.0-x64-setup.exe` | 安装包，可选目录、建快捷方式、可卸载 |
| Windows arm64 | `红果短剧-1.0.0-arm64-setup.exe` | 骁龙/Surface Pro X 等 ARM 设备 |
| Android TV | `hongguotv-android5.1-release-signed.apk` | Android 5.1+，四种 CPU 架构通用 |
| Web 服务 | `hongguotv-web-<平台>.zip` / `.tar.gz` | 解压后运行 `start.cmd` / `./start.sh` |

若尚无现成产物，按下方[构建与打包](#构建与打包)自行生成。

### 开发者

需要 **Node.js 22.13+**。

```powershell
npm ci
npm --prefix apps/web-pc ci

npm run server      # 本地内容服务，默认 8788
npm run dev         # Web 开发页，默认 3000
npm test            # 93 项测试
npm run typecheck   # TypeScript 类型检查
```

---

## 项目结构

```
apps/
  web-pc/           React + TypeScript + Vite 前端，Electron 桌面壳
  tv-android/       Kotlin + Android Views + Media3，内含 QuickJS JNI
  sync-server/      家庭资料远程共享服务
custom-server/      本地内容服务（播放代理、解密流、资料库）
server/             内容适配器与兼容入口
shared/             三端共用代码
  content-core/     内容引擎（签名、解密、取流），打包进三端
  library-store.mjs 资料库（事件溯源 + SQLite）
scripts/            构建、打包、校验工具
tests/              Node 测试（93 项）
docs/               架构、API、部署与验收记录
release/            发布产物汇总（构建生成，不入库）
.agents/            多 agent 协作总线与任务记录
```

### 三端共享同一内容引擎

`shared/content-core/hongguo.js` 是唯一的内容引擎实现，通过不同方式打入三端：

| 端 | 打包方式 |
| --- | --- |
| Web / Windows | `scripts/build-bundles.mjs` 复制进产物 |
| Android TV | Gradle `preBuild` 任务复制到 `assets/` |

**修改该文件会影响三端**，需同时验证。

---

## 构建与打包

### Web 包（六平台）

```powershell
npm run build:bundles                                   # 全部平台
node scripts/build-bundles.mjs --platforms=win-x64      # 单平台
node scripts/build-bundles.mjs --web-only               # 跳过桌面版
```

覆盖 Windows / Linux / macOS 各 x64 与 arm64，每包内置 Node 运行时。

### Windows 桌面端

```powershell
# 1. 先生成 Windows Web 包（作为后端来源）
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64

# 2. 打包安装包与便携版
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never
npx electron-builder --config electron-builder.config.cjs --win --arm64 --publish=never
```

**代码签名**（可选）通过环境变量传入，凭据不写入配置文件：

```powershell
$env:HG_CODESIGN_PFX      = "C:\path\to\cert.pfx"
$env:HG_CODESIGN_PASSWORD = "<密码>"
```

未提供时跳过签名，构建仍成功。

### Android TV

```powershell
cd apps/tv-android
.\gradlew.bat :app:assembleDebug      # 调试版
.\gradlew.bat :app:assembleRelease    # 发布版（需签名配置）
```

**发布签名**：复制 `keystore.properties.example` 为 `keystore.properties` 并填入凭据（该文件已被 `.gitignore` 排除）。缺失时不影响 debug 构建。

### 汇总产物

```powershell
node scripts/collect-release.mjs      # 三端产物汇总到 release/
```

---

## 平台要求

| 端 | 要求 |
| --- | --- |
| Web / Windows | Windows 10+ / Linux / macOS（产物内置运行时） |
| Android TV | **Android 5.1（API 22）以上**，支持 armeabi-v7a / arm64-v8a / x86 / x86_64 |
| 构建环境 | Node.js 22.13+；Android 构建另需 JDK 17、Android SDK 35、NDK 28.2 |

---

## 数据与同步

- 各端本地保存收藏、历史、搜索与偏好
- 填写**同一远程地址与家庭密钥**即可多端同步；未配置时正常本地使用
- 历史统一为海报网格，不分来源端；**TV 端仅支持查看与续播**
- 数据位于用户资料目录，**更新程序不会覆盖数据**

服务默认端口：本地内容服务 **8788**，家庭共享服务 **8791**。
可用 `HG_PORT` 覆盖端口、`HG_DATA_DIR` 指定数据目录。

详见 [本地服务与远程同步](docs/LOCAL_REMOTE_SERVICES.md)。

---

## 文档

| 文档 | 内容 |
| --- | --- |
| [架构](docs/ARCHITECTURE.md) | 整体设计 |
| [API](docs/API.md) | 接口定义 |
| [本地服务与远程同步](docs/LOCAL_REMOTE_SERVICES.md) | 部署、数据路径、迁移 |
| [TV 工程](apps/tv-android/README.md) | 遥控器操作、构建细节 |
| [项目状态](docs/PROJECT_STATUS.md) | 当前进度与已知问题 |
| [推送说明](docs/PUSH_GUIDE.md) | 仓库与发布流程 |

> 构建产物的详细说明（架构选择、SmartScreen 处理、签名信息、校验方式）
> 见 `release/README.md`，该文件随 `scripts/collect-release.mjs` 生成。

---

## 质量保障

| 项 | 现状 |
| --- | --- |
| Node 测试 | **93 项**（`npm test`） |
| TV 单元测试 | **30 项**（`:app:testDebugUnitTest`） |
| 类型检查 | `npm run typecheck` |
| Lint | `:app:lintDebug`（`abortOnError = true`） |

---

## 许可证

[GPL-3.0](LICENSE)

第三方组件许可见产物内 `THIRD_PARTY_NOTICES.txt`。
