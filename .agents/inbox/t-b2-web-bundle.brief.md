# B2 Web 端脚本启动包打包

**任务 ID**: `t-b2-web-bundle`
**负责人**: codex
**依赖**: 无（可与 B1 并行）
**协调者**: dsh

---

## 一、任务目标

产出 Web 端**脚本启动包**，覆盖多平台多架构，**免环境**（用户机器无需安装 Node/npm）。

**用户需求原文**：

> web使用脚本启动，兼容所有设备。
> 所有都要在没有环境的设备也能正常运行才行

---

## 二、当前状态

### 已就绪

| 项 | 状态 |
| --- | --- |
| `scripts/build-bundles.mjs` | ✅ 已支持 5 平台 |
| win-x64 Web 包 | ✅ `outputs/bundles/hongguotv-web-win-x64/`（含 Node 运行时 81.62 MB） |

### 待完成

| 项 | 说明 |
| --- | --- |
| linux-x64 / linux-arm64 | 未产出 |
| darwin-x64 / darwin-arm64 | 未产出 |
| **ZIP/TAR 归档** | win-x64 的 ZIP 打包上次**失败**（文件占用） |
| 远程同步服务包（sync） | 未产出 |

---

## 三、脚本能力（已存在，无需重写）

`scripts/build-bundles.mjs` 已实现：

- 下载并校验官方 Node 22.20.0 二进制（SHA256 校验）
- 生成 `start.cmd` / `stop.cmd`（Windows）与 `start.sh` / `stop.sh`（Linux/macOS）
- 打包后端（`custom-server` + `shared` + `server`）
- 生成 ZIP（Windows）或 TAR.GZ（Linux/macOS，保留 Unix 执行权限）

**默认平台**：

```
win-x64, linux-x64, linux-arm64, darwin-x64, darwin-arm64
```

**用法**：

```powershell
node scripts/build-bundles.mjs                          # 全部平台
node scripts/build-bundles.mjs --platforms=win-x64      # 单平台
node scripts/build-bundles.mjs --web-only               # 跳过桌面版
```

---

## 四、上次失败原因

win-x64 的 **Web 包本身构建成功**，仅最后 `Compress-Archive` 失败：

```
ZipArchiveHelper : The process cannot access the file
'...\dist-win\hongguoTV-win32-x64\resources\default_app.asar'
because it is being used by another process.
```

**根因**：`build-bundles.mjs` 在打完 Web 包后，会额外组装桌面版并压缩 `dist-win`，而 `dist-win` 中的文件**被运行中的程序占用**。

**建议**：B1 任务会取代 `dist-win` 的 ZIP 方案，可考虑在打包脚本中跳过旧桌面版压缩（`--web-only` 已支持）。

---

## 五、要做的事

### 5.1 产出全部平台 Web 包

```powershell
node scripts/build-bundles.mjs --platforms=win-x64,linux-x64,linux-arm64,darwin-x64,darwin-arm64
```

**注意**：首次会下载 5 个平台的 Node 运行时（约 500 MB），耗时较长。

### 5.2 产出远程同步服务包

```powershell
# sync 包（remote=true）由脚本自动为 linux-* 平台额外生成
```

### 5.3 校验产物

- 归档文件完整性
- **Linux/macOS 归档保留 Unix 执行权限**（`runtime/node` 与 `*.sh` 需 0755）
- 生成 `SHA256SUMS.txt`

---

## 六、验收标准

1. **产出 Web 包**（5 平台）：
   - `hongguotv-web-win-x64.zip`
   - `hongguotv-web-linux-x64.tar.gz`
   - `hongguotv-web-linux-arm64.tar.gz`
   - `hongguotv-web-darwin-x64.tar.gz`
   - `hongguotv-web-darwin-arm64.tar.gz`
2. **产出 sync 包**（Linux 两平台）
3. 每个包内**含 Node 运行时**（免环境的关键）
4. 每个包内含 `start.cmd`/`start.sh` 与 `stop.*`
5. Linux/macOS 归档的**执行权限正确**
6. `SHA256SUMS.txt` 生成
7. 报告写入 `.agents/shared/t-b2-web-bundle-codex.md`

---

## 七、免环境验证（重要）

**必须验证**：包内自带 Node 运行时，用户机器无需安装 Node。

验证方式（至少一种）：

- 确认 `runtime/node.exe`（Windows）或 `runtime/node`（Linux/macOS）存在且可执行
- 确认 `start.cmd` / `start.sh` **引用包内运行时**而非系统 `node`
- 若条件允许，解压后实际启动验证

**参考**（`scripts/build-bundles.mjs` 生成的 start.cmd）：

```batch
@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0scripts\service-launcher.mjs" start
pause
```

---

## 八、硬性约束

1. **可改文件**：`scripts/build-bundles.mjs`（如需修复）
2. **不要改** `apps/`、`custom-server/`、`shared/` 下的业务代码
3. 当前 shell 是 **Windows PowerShell 5.1**
4. 不要 `git commit` / `git push`

---

## 九、报告要求

- 命令原文与**真实输出**
- 各产物的**文件名、大小、SHA256**
- 免环境验证结果
- Linux/macOS 归档的权限校验结果
- 若某平台失败，如实报告

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-b2-web-bundle codex "结论及报告路径"
```
