# W7 Web 与 Windows 端 Release 打包发布

**任务 ID**: `t-w7-release-package`
**负责人**: **codex**
**依赖**: 无
**协调者**: dsh
**范围**: Web 端（多平台）与 Windows 桌面端的 release 打包

---

## 一、任务目标

把**当前最新代码**打包为可发布的 release 产物，覆盖 Web 端与 Windows 端。

**当前产物已过期**：

| 产物 | 时间 | 落后于 |
| --- | --- | --- |
| `release/web/hongguotv-web-win-x64.zip` | 20:43 | `hongguo.js`（20:49） |
| `release/windows/红果短剧-1.0.0-x64-setup.exe` | **19:02** | `hongguo.js`（20:49）、`App.tsx`（19:59）等 |

**Windows 包落后约 2 小时**，未包含以下已完成的修复：

| 提交 | 内容 |
| --- | --- |
| `3a752c0` | 修复全部端无法播放（device_id 封禁） |
| `cb0e16a` | 设备标识防回归 + 诊断脚本 |
| `023fd99` | 四层防护（结构/观测/门禁/测试） |
| `e2957b2` | 修复 TV 端 crypto.randomBytes 兼容 |
| `2836803` | 全屏快捷键、推荐流全屏头部 |

---

## 二、⚠️ 前置：必须先跑发布门禁

**这是硬性要求**，上一轮刚建立：

```powershell
npm run release:check    # test + typecheck + smoke
```

**必须全部通过才能打包**。若冒烟测试失败，**不要打包**，先报告问题。

**理由**：`2026-10-15` 的事故中，代码与测试全绿但三端都播不了 —— 因为没有环节真去上游取过流。门禁就是防这个。

---

## 三、要产出的东西

### 3.1 Web 端（多平台）

`scripts/build-bundles.mjs` 支持这些平台：

| 平台标识 | 产物 |
| --- | --- |
| `win-x64` / `win-arm64` | `.zip` |
| `darwin-x64` / `darwin-arm64` | `.tar.gz` |
| `linux-x64` / `linux-arm64` | `.tar.gz` |

**要求**：

```powershell
node scripts/build-bundles.mjs --platforms=win-x64,win-arm64,darwin-x64,darwin-arm64,linux-x64,linux-arm64
```

**每个产物必须包含**：

- `custom-server/`（含最新引擎）
- `shared/`（含 `content-core/hongguo.js`、`listen-port.mjs`）
- `apps/web-pc/dist/`（前端构建产物）
- `runtime/node`（对应平台的 Node 运行时）
- `README.txt`（启动说明）

**注意**：`build-bundles.mjs` 会从 `shared/content-core/hongguo.js` 复制引擎，
**必须确认复制的是最新版本**（历史上曾出现某架构目录未更新的问题）。

### 3.2 Windows 桌面端

**两个架构 × 两种形态**：

| 形态 | x64 | arm64 | 通用 |
| --- | --- | --- | --- |
| NSIS 安装包 | ✓ | ✓ | ✓（可选） |
| Portable | ✓ | ✓ | ✓（可选） |

**打包命令**：

```powershell
cd apps/web-pc
# ⚠️ 不要设置 HG_ELECTRON_DIST，否则会强制使用 x64 的 Electron
Remove-Item env:HG_ELECTRON_DIST -ErrorAction SilentlyContinue
$env:electron_builder_binaries_mirror = 'https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --x64 --arm64 --publish=never
```

**关键注意**：

1. **不要设置 `HG_ELECTRON_DIST`** —— 上一轮我设了它指向 x64 的 Electron，
   导致 arm64 打包被 `afterPack` 钩子正确拦截（报「产物架构错误」）。
   去掉后 electron-builder 会自动从缓存选对架构
   （缓存中有 `electron-v40.0.0-win32-arm64.zip`）。

2. **必须用 `--platforms=win-x64,win-arm64` 生成 bundle** ——
   历史上 `build:desktop` 只写了 `win-x64`，导致 `outputs/bundles/hongguotv-web-win-arm64`
   目录里是旧引擎，arm64 包内的引擎缺少播放修复。

3. **签名**：通过 `HG_CODESIGN_PFX` / `HG_CODESIGN_PASSWORD` 环境变量配置。
   若凭据缺失，构建仍可完成（只是未签名），需在报告中说明。

---

## 四、验证要求

### 4.1 产物完整性

**必须验证每个产物内含最新代码**，不能只看构建成功。

**建议写一个校验脚本**，检查：

| 检查项 | 方法 |
| --- | --- |
| 引擎含修复 | 产物内 `hongguo.js` 含 `deviceEntropy`、含 `typeof crypto.randomBytes` 探测 |
| 引擎无旧代码 | 不含 `1905892595378490` |
| 引擎与源码一致 | 与 `shared/content-core/hongguo.js` 逐字节比对 |
| 前端含全屏按钮 | `dist/assets/*.js` 含 `退出全屏` |
| 前端含推荐流 | 含 `滚轮`（推荐流独有文案） |
| **PE 架构正确** | 读 exe 的 PE 头 Machine 字段（x64=0x8664 / arm64=0xAA64） |
| `listen-port.mjs` 存在 | Web 包与桌面包内均需有（W1 的端口递增依赖它） |
| `preload.cjs` 存在 | 桌面包内需有（全屏桥接依赖它） |

### 4.2 功能验证

**Web 端**（至少一个平台）：

```powershell
# 解压后启动
cd <解压目录>
./runtime/node custom-server/index.mjs
# 访问 http://127.0.0.1:8788
```

验证：

- 服务能启动（含端口递增）
- `/health` 返回 `playback` 段
- 页面能加载
- **能播放视频**（这是核心）

**Windows 端**：

```powershell
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "outputs\windows\win-unpacked\红果短剧.exe" --remote-debugging-port=9222
```

用 CDP（`http://127.0.0.1:9222/json/list`）验证：

- 页面加载成功
- `window.hongguotvDesktop` 桥接存在
- **推荐流右上角有全屏按钮**（`aria-label` 含「全屏」）
- **能播放视频**（`video.readyState === 4`、`paused === false`）
- 全屏是**屏幕级**（`window.innerWidth === screen.width`）

### 4.3 收集到 release/

用 `scripts/collect-release.mjs`（若可用）或手动复制：

```
release/
  web/        ← 各平台 Web 包
  windows/    ← 安装包与便携版
  SHA256SUMS.txt
  manifest.json
```

**注意**：`collect-release.mjs` 只重建子目录，**保留 `release/README.md`**。

---

## 五、硬性约束

1. **可改文件**：
   - `scripts/build-bundles.mjs`（如需修正）
   - `scripts/collect-release.mjs`（如需修正）
   - `apps/web-pc/electron-builder.config.cjs`（如需修正）
   - 新增打包校验脚本（建议放 `scripts/`）
2. **不要改** `apps/web-pc/src/`、`apps/tv-android/`、`shared/content-core/hongguo.js`
3. **不要回退**任何已完成改动
4. **不要设置 `HG_ELECTRON_DIST`**
5. 当前 shell 是 **Windows PowerShell 5.1**（不支持 `&&`，用 `;` 或分行）

---

## 六、验收标准

| # | 项 | 判定 |
| --- | --- | --- |
| 1 | `npm run release:check` 通过 | test + typecheck + smoke 全绿 |
| 2 | Web 包覆盖 6 个平台 | win/darwin/linux × x64/arm64 |
| 3 | Windows 包覆盖 2 架构 × 2 形态 | setup + portable |
| 4 | 每个产物引擎含修复 | 含 `deviceEntropy`、无旧 `device_id` |
| 5 | 每个产物引擎与源码一致 | 逐字节比对 |
| 6 | 前端含全屏按钮与推荐流 | 字符串检查 |
| 7 | exe 架构正确 | PE 头校验 |
| 8 | `listen-port.mjs` 与 `preload.cjs` 存在 | 文件检查 |
| 9 | Web 端实测能播放 | 解压启动 + 取流 |
| 10 | Windows 端实测能播放 | CDP 验证 video 状态 |
| 11 | 产物收集到 `release/` | 含 SHA256SUMS |
| 12 | 报告写入 `.agents/shared/t-w7-release-package-codex.md` | |

---

## 七、证据要求

**必须提供**：

1. `release:check` 的完整输出（含冒烟测试结果）
2. **产物校验脚本的输出**（逐项列出检查结果）
3. 各平台产物的大小与 SHA256
4. **Web 端实测**：服务启动日志 + `/health` 输出 + 播放验证
5. **Windows 端实测**：CDP 返回的 video 状态与全屏几何数据
6. 若某平台无法在当前机器验证，**明确说明**（如 darwin/linux 无法在 Windows 上运行）

---

## 八、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| **`HG_ELECTRON_DIST`** | 设置它会强制用 x64 Electron，导致 arm64 打包失败 |
| **`--platforms` 不全** | 只写 `win-x64` 会让 arm64 bundle 目录保留旧引擎 |
| **PowerShell 5.1** | 不支持 `&&`；`node --check` 后用 `$LASTEXITCODE` |
| `ELECTRON_RUN_AS_NODE` | 若设置，Electron 退化为纯 Node 模式（无窗口） |
| 端口占用 | 已支持自动递增（W1），但测试时注意清理残留进程 |
| 产物过期 | 打包后**必须校验内容**，不能只看构建成功 |
| 中文路径 | `红果短剧-1.0.0-x64-setup.exe` 含中文，脚本中注意引号 |

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-w7-release-package codex "结论及报告路径"
```
