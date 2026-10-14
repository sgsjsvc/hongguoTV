# B1 Windows 安装包与便携版打包

**任务 ID**: `t-b1-windows-installer`
**负责人**: codex
**依赖**: 无（可开始）
**协调者**: dsh

---

## 一、任务目标

为 Windows 桌面端产出 **NSIS 安装包 + 便携版**，覆盖 **x64 与 arm64** 两种架构，且**免环境**（用户机器无需安装 Node/Electron）。

**用户需求原文**：

> exe打包为安装包，所有都要在没有环境的设备也能正常运行才行
> 要兼容所有cpu架构

---

## 二、当前状态（协调者已完成的前置工作）

### 已就绪

| 项 | 状态 |
| --- | --- |
| `electron@40.0.0` + `electron-builder@26.15.3` | ✅ 已安装到 `apps/web-pc` |
| `apps/web-pc/electron-builder.config.cjs` | ✅ 已创建 |
| Web 包（含 Node 运行时 81.62 MB） | ✅ `outputs/bundles/hongguotv-web-win-x64/` |
| Web 前端 dist | ✅ `apps/web-pc/dist/` |
| **arm64 Electron 二进制** | ✅ 已缓存 `%LOCALAPPDATA%\electron\Cache\electron-v40.0.0-win32-arm64.zip`（131.31 MB） |
| x64 unpacked（412.73 MB） | ✅ `outputs/windows/win-unpacked/` |

### 待完成

| 项 | 说明 |
| --- | --- |
| **x64 NSIS 安装包** | 未产出 |
| **x64 便携版** | 未产出 |
| **arm64 NSIS 安装包** | 未产出 |
| **arm64 便携版** | 未产出 |

---

## 三、上次失败原因（协调者已诊断）

执行 `npx electron-builder --win --x64 --arm64` 时：

```
• packaging  platform=win32 arch=x64   → 成功，产出 win-unpacked
• packaging  platform=win32 arch=arm64 → 下载 Electron 超时
⨯ Timeout awaiting 'request' for 600000ms
```

**根因**：electron-builder 从默认源下载 Electron 二进制**超时**（600 秒上限）。

**关键**：x64 的 unpacked 已成功，说明**配置本身正确**，问题只在 arm64 的下载环节。

---

## 四、建议的解决路径

### 4.1 已预置 arm64 二进制

协调者已从国内镜像下载 arm64 二进制到：

```
%LOCALAPPDATA%\electron\Cache\electron-v40.0.0-win32-arm64.zip
```

**electron-builder 会优先使用缓存**，理论上不会再下载。请先直接重试。

### 4.2 若 x64 二进制也被要求下载

上次 x64 缓存已被 electron-builder 清理。若重试时 x64 也超时，用镜像手动预置：

```powershell
$cache = "$env:LOCALAPPDATA\electron\Cache"
Invoke-WebRequest -Uri "https://registry.npmmirror.com/-/binary/electron/v40.0.0/electron-v40.0.0-win32-x64.zip" -OutFile "$cache\electron-v40.0.0-win32-x64.zip" -TimeoutSec 900
```

### 4.3 设置镜像加速（推荐）

在 `apps/web-pc` 下创建 `.npmrc` 或设置环境变量：

```
ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
electron_builder_binaries_mirror=https://registry.npmmirror.com/-/binary/electron-builder-binaries/
```

### 4.4 分架构串行打包（避免一次失败全盘中断）

```powershell
# 先 x64
npx electron-builder --config electron-builder.config.cjs --win --x64 --publish=never
# 再 arm64
npx electron-builder --config electron-builder.config.cjs --win --arm64 --publish=never
```

**分两次执行**，任一次失败不影响另一次已产出的结果。

---

## 五、打包配置说明（已存在，请先审阅）

`apps/web-pc/electron-builder.config.cjs`：

```javascript
{
  appId: "com.hongguotv.desktop",
  productName: "红果短剧",
  directories: { output: "outputs/windows" },
  files: ["dist/**/*", "electron/**/*", "package.json"],
  extraResources: [{ from: "outputs/bundles/hongguotv-web-win-x64", to: "hongguotv" }],
  win: {
    target: [
      { target: "nsis", arch: ["x64", "arm64"] },
      { target: "portable", arch: ["x64", "arm64"] }
    ],
    icon: "assets/branding/hongguotv-icon-v2.png"
  },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, ... },
  portable: { ... },
  electronVersion: "40.0.0",
  npmRebuild: false,
  asar: true
}
```

**关键设计**（与 `electron/main.cjs` 一致）：

- `resources/app/` → Electron 代码（asar 打包）
- `resources/hongguotv/` → 本地后端（`custom-server` + `shared` + **`runtime/node.exe`**）

主进程通过 `process.resourcesPath/hongguotv` 定位后端，并优先用其中的 `runtime/node.exe`，**这就是免环境的关键**。

---

## 六、验收标准

1. **产出 4 个安装产物**：
   - `红果短剧-<version>-x64-setup.exe`（NSIS）
   - `红果短剧-<version>-x64-portable.exe`
   - `红果短剧-<version>-arm64-setup.exe`（NSIS）
   - `红果短剧-<version>-arm64-portable.exe`
2. 产物位于 `outputs/windows/`
3. **免环境验证**：解压/安装后，**在没有 Node.js 的环境下能启动**
   - 至少验证 `win-unpacked` 或便携版可启动
   - 确认 `resources/hongguotv/runtime/node.exe` 存在
4. NSIS 安装包支持：**选择安装目录、创建桌面快捷方式、可从控制面板卸载**
5. 报告写入 `.agents/shared/t-b1-windows-installer-codex.md`

---

## 七、硬性约束

1. **可改文件**：
   - `apps/web-pc/electron-builder.config.cjs`
   - `apps/web-pc/package.json`（如需调整 scripts）
   - `apps/web-pc/.npmrc`（如需镜像配置）
   - `scripts/` 下的打包辅助脚本
2. **不要改** `apps/web-pc/electron/main.cjs`（主进程逻辑）
3. **不要改** `apps/tv-android/`、`custom-server/`、`shared/`
4. 当前 shell 是 **Windows PowerShell 5.1**，不支持 `||`、`&&`
5. 不要 `git commit` / `git push`（由协调者统一处理）

---

## 八、报告要求

- **实际执行的命令原文**
- **真实输出**（含产物文件名与大小）
- 免环境验证方式与结果
- 若某项无法完成，**如实报告并说明已尝试的方法**
- 无法确认的标「未验证」

---

## 九、提交方式

```powershell
node .agents/cli.mjs done t-b1-windows-installer codex "结论及报告路径"
# 或
node .agents/cli.mjs fail t-b1-windows-installer codex "阻塞原因及已尝试措施"
```
