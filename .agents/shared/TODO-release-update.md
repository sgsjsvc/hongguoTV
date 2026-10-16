# 待办：下次打包后更新 GitHub Release

**记录日期**: 2026-10-16
**用户指示**: 「现在不更新，在下一次打包完成更新」

---

## 背景

2026-10-16 起，发布产物改为**扁平结构 + 统一命名**：

| 类型 | 新命名 |
| --- | --- |
| Windows 桌面端 | `hongguotv-desktop-win-<架构>-<形态>.exe` |
| Web 服务端 | `hongguotv-web-<平台>-<架构>.<zip\|tar.gz>` |
| 家庭共享服务端 | `hongguotv-sync-<平台>-<架构>.tar.gz` |
| Android TV | `hongguotv-tv-android5.1-<类型>.apk` |

`release/` 内的产物已按新规则重命名，但 **GitHub Release 页面尚未更新**。

---

## 待办项

### 1. 更新 GitHub Release 正文

**文件**: `.agents/shared/github-release-v1.0.0.md`

**需要替换的旧命名**（共 10+ 处）：

| 位置 | 旧 | 新 |
| --- | --- | --- |
| 行 15 | `红果短剧-1.0.0-x64-setup.exe` | `hongguotv-desktop-win-x64-setup.exe` |
| 行 16 | `红果短剧-1.0.0-arm64-setup.exe` | `hongguotv-desktop-win-arm64-setup.exe` |
| 行 17 | `红果短剧-1.0.0-setup.exe` | `hongguotv-desktop-win-universal-setup.exe` |
| 行 28 | `hongguotv-android5.1-release-signed.apk` | `hongguotv-tv-android5.1-release.apk` |
| 行 102 | `Get-FileHash .\红果短剧-1.0.0-x64-setup.exe` | 同步更新 |
| 行 130-135 | Windows 产物清单表 | 全部改用新命名 |

**另需核对**：

- Web 包清单是否与 `release/` 实际文件一致
- 各文件大小是否与最新产物一致（见 `release/manifest.json`）
- 测试数（144 / 32）是否需要更新

### 2. 更新 Release 附件

**当前附件**（用户截图所示）只有 2 个：

- `hongguotv-1.0.0-arm64-portable.exe`（103.48 MB）
- `hongguotv-1.0.0-arm64-setup.exe`（103.74 MB）

**注意**：这两个文件名**既不是构建产物名也不是新命名**，是用户手工改过的。
下次上传时应统一使用 `release/` 内的新命名。

**应上传的完整清单**（16 个，见 `release/manifest.json`）：

| 类别 | 文件 |
| --- | --- |
| Windows（6） | `hongguotv-desktop-win-{x64,arm64,universal}-{setup,portable}.exe` |
| Web（6） | `hongguotv-web-{win,linux,darwin}-{x64,arm64}.{zip,tar.gz}` |
| Sync（2） | `hongguotv-sync-linux-{x64,arm64}.tar.gz` |
| TV（2） | `hongguotv-tv-android5.1-{release,debug}.apk` |
| 校验（1） | `SHA256SUMS.txt` |

**可选**：若不需要双架构通用版，可跳过两个 `universal` 包（省约 430 MB）。

### 3. 确认 Tag

`v1.0.0` 已存在，指向旧提交 `ecf7416`（不含本次修复）。

**建议下次发布时新建 tag**（如 `v1.0.1`），而不是复用 `v1.0.0`。

---

## 触发条件

**下次打包完成后**执行，不要提前。

---

## 检查清单

下次打包后：

- [ ] 运行 `node scripts/collect-release.mjs`（产物已扁平化并统一命名）
- [ ] 核对 `release/manifest.json` 与 `release/SHA256SUMS.txt`
- [ ] 更新 `.agents/shared/github-release-v1.0.0.md` 中的所有旧命名
- [ ] 核对正文中的文件大小与实际产物一致
- [ ] 决定 tag 版本号（建议新建而非复用 `v1.0.0`）
- [ ] 上传 16 个附件（或按需跳过 universal 版）
- [ ] 用 `release/README.md` 的命名规则表核对每个附件名
