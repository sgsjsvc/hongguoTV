# 红果短剧

非官方多端短剧客户端。提供 **Web / Windows 桌面 / Android TV** 三端，各端内置内容获取与播放处理，本地保存收藏、历史、搜索与偏好，可选连接家庭共享服务双向同步。

源码仓库：<https://github.com/sgsjsvc/hongguoTV> · 许可证：[GPL-3.0](LICENSE)

> 本项目为非官方客户端，与内容平台无关联。请遵守当地法律法规与内容平台服务条款。

---

## 快速开始

### 普通用户（免环境）

获取发布产物（由 `node scripts/collect-release.mjs` 汇总生成，**不入版本库**），**无需安装 Node.js 或任何运行环境**。

产物**全部平铺在 `release/` 下**，命名规则：

| 类型 | 格式 |
| --- | --- |
| Windows 桌面端 | `hongguotv-desktop-win-<架构>-<形态>.exe` |
| Web 服务端 | `hongguotv-web-<平台>-<架构>.<zip\|tar.gz>` |
| 家庭共享服务端 | `hongguotv-sync-<平台>-<架构>.tar.gz` |
| Android TV | `hongguotv-tv-android5.1-<类型>.apk` |

常用产物：

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows x64 | `hongguotv-desktop-win-x64-setup.exe` | 安装包，可选目录、建快捷方式、可卸载 |
| Windows arm64 | `hongguotv-desktop-win-arm64-setup.exe` | 骁龙/Surface Pro X 等 ARM 设备 |
| Windows 通用 | `hongguotv-desktop-win-universal-setup.exe` | 含双架构，不确定架构时选这个 |
| Android TV | `hongguotv-tv-android5.1-release.apk` | Android 5.1+，四种 CPU 架构通用 |
| Web 服务 | `hongguotv-web-<平台>-<架构>.zip` / `.tar.gz` | 解压后运行 `start.cmd` / `./start.sh` |

各平台的 `-portable.exe` 为免安装版，直接运行。

产物清单与校验值见 `release/README.md`、`release/manifest.json` 与 `release/SHA256SUMS.txt`。

若尚无现成产物，按下方[构建与打包](#构建与打包)自行生成。

### 开发者

需要 **Node.js 22.13+**。

```powershell
npm ci
npm --prefix apps/web-pc ci

npm run server      # 本地内容服务，默认 8788
npm run dev         # Web 开发页，默认 3000
npm test            # 144 项测试
npm run typecheck   # TypeScript 类型检查
```

### 发布前检查

```powershell
npm run release:check   # test + typecheck + 播放冒烟门禁
```

`smoke` 会启动临时服务并**真实向上游取流**，任一样本失败即退出码 1。
这是发布前的硬性门禁：代码与单元测试全绿并不代表能播放（见
[内容引擎说明](shared/content-core/README.md#device-identity-read-before-touching-randomdeviceid--freshdevice)）。

### 故障诊断

```powershell
npm run diagnose        # 分层定位：引擎 → 服务 → 上游 → 端到端
```

输出会直接判定问题在**上游**还是**我方**，并给出可操作建议。

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
  listen-port.mjs   端口自动递增（占用时依次尝试后续端口）
  library-store.mjs 资料库（事件溯源 + SQLite）
scripts/            构建、打包、校验、诊断工具
tests/              Node 测试（144 项）
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

> ⚠️ 引擎运行在两种不同的 JS 宿主中：Node（Web / Windows）与 **QuickJS（TV）**。
> 后者**只提供** `createHash` 与 `createDecipheriv`，没有 `randomBytes` 等 API。
> 改动引擎时**必须在两种环境下都验证** —— 详见
> [内容引擎说明](shared/content-core/README.md)。

---

## 构建与打包

### Web 包（六平台）

```powershell
npm run build:bundles                                   # 全部平台
node scripts/build-bundles.mjs --platforms=win-x64      # 单平台
node scripts/build-bundles.mjs --web-only               # 跳过桌面版
```

覆盖 Windows / Linux / macOS 各 x64 与 arm64，每包内置 Node 运行时。

> ⚠️ 桌面端打包依赖 `outputs/bundles/hongguotv-web-win-<arch>` 目录。
> **两个架构都要生成**（`--platforms=win-x64,win-arm64`），否则对应架构的
> bundle 目录会保留旧引擎，被打进安装包。

### Windows 桌面端

```powershell
# 1. 先生成两个架构的 Web 包（作为后端来源）
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64

# 2. 打包安装包与便携版
cd apps/web-pc
npx electron-builder --config electron-builder.config.cjs --win --x64 --arm64 --publish=never
```

> ⚠️ **不要设置 `HG_ELECTRON_DIST`**。它会强制使用指定架构的 Electron，
> 导致另一架构的产物被 `afterPack` 钩子判为「产物架构错误」而失败。
> 不设置时 electron-builder 会按目标架构自动选择。

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
node scripts/collect-release.mjs      # 三端产物汇总到 release/（扁平结构）
```

**行为**：

- 清空 `release/` 下的产物（**保留 `*.md` 说明文档**）与旧子目录
- 从 `outputs/windows`、`outputs/bundles`、`outputs/tv-android` 复制现成文件
- **按统一规则重命名**（重命名只发生在 `release/` 内，构建产物保持原名）
- 生成 `SHA256SUMS.txt` 与 `manifest.json`

> ⚠️ 该脚本是**搬运工，不负责构建**。
> **打包后必须先确认 `outputs/` 下的源目录是最新的**，否则会搬运旧产物。
> 收集后建议抽查：产物内引擎应与 `shared/content-core/hongguo.js` 逐字节一致。

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

**端口被占用时自动递增**（8788 → 8789 → …，最多尝试 11 次），并在日志中打印实际端口，
无需手动处理。也可用 `HG_PORT` 指定固定端口（此时不递增，占用即报错），
`HG_DATA_DIR` 指定数据目录。

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

> 构建产物的详细说明（命名规则、架构选择、SmartScreen 处理、签名信息、校验方式）
> 见 `release/README.md`。该文件为手工维护，`scripts/collect-release.mjs`
> 收集产物时会**保留它**（不随产物清空）。

---

## 质量保障

| 项 | 现状 |
| --- | --- |
| Node 测试 | **144 项**（`npm test`） |
| TV 单元测试 | **32 项**（`:app:testDebugUnitTest`） |
| 类型检查 | `npm run typecheck` |
| Lint | `:app:lintDebug`（`abortOnError = true`） |
| 播放冒烟门禁 | `npm run smoke`（真实取流，失败阻止发布） |
| 链路诊断 | `npm run diagnose`（分层定位上游/服务问题） |
| 设备实测 | 4 台（含 Android 5.1 / API 22 真机） |

### 发布流程建议

```powershell
npm run release:check                    # 1. 门禁：测试 + 类型 + 真实播放
npm run build                            # 2. 前端
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,darwin-x64,darwin-arm64,linux-x64,linux-arm64
# 3. 桌面端（见上）
# 4. Android TV（见上）
# 5. 确认 outputs/ 下的源目录已更新，再收集
node scripts/collect-release.mjs
```

**关键**：第 1 步的冒烟测试不可跳过。代码与单元测试全绿并不能保证能播放 ——
外部接口变更会让「成功」变成「HTTP 200 + 空响应体」，只有真实取流才能发现。

**收集后**：产物已扁平化并统一命名，可直接用于分发。
若需同步到 GitHub Release，注意正文中的文件名也要一并更新
（见 `.agents/shared/TODO-release-update.md`）。

---

## 开发人员

### 维护者

| 角色 | 人员 |
| --- | --- |
| 项目发起与维护 | **sgsjsvc**（[GitHub](https://github.com/sgsjsvc)） |

### 多 Agent 协作团队

本项目的三端实现、缺陷修复与验证由多个人工智能 agent 通过**文件总线**协作完成，
协作记录完整保留在 [`.agents/`](.agents/README.md) 中（任务、验收报告、实测证据）。

| Agent | 职责 |
| --- | --- |
| **DSH** | 主控、调度、验收、跨端联调 |
| **Codex** | 后端、算法、批量重构 |
| **Antigravity** | UI、浏览器验证、多模态 |
| **WorkBuddy** | 独立复核、记忆沉淀、文档 |

**为什么用文件总线**：它是四个 agent 唯一的共同能力，且天然持久、可审计、可 diff、可进 git。
任务从 `inbox/` 认领、结果写入 `outbox/`、证据留在 `shared/`，全过程可追溯。

> 每个 agent 的产出都需**独立复核**（如 Q3 由 Antigravity 修复、Q4 由 WorkBuddy 复核并发现新缺陷），
> 详见 `.agents/shared/` 下的验收报告。

### 参与贡献

欢迎提交 Issue 与 Pull Request。

**提交前请确保**：

```powershell
npm run release:check   # 测试 + 类型检查 + 播放冒烟门禁
```

**修改共享引擎时的额外要求**：`shared/content-core/hongguo.js` 同时运行在
**Node（Web / Windows）** 与 **QuickJS（TV）** 两种宿主中，后者只提供
`createHash` 与 `createDecipheriv`。改动必须在两种环境下都验证 ——
详见[内容引擎说明](shared/content-core/README.md#device-identity-read-before-touching-randomdeviceid--freshdevice)。

---

## 许可证

[GPL-3.0](LICENSE)

第三方组件许可见产物内 `THIRD_PARTY_NOTICES.txt`。
