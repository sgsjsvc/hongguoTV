# B1 Windows 一体包交付报告

执行方 codex；日期 2026-10-14；任务 t-b1-windows-installer。

## 结果与实际改动

已产出 x64／ARM64 的 NSIS 安装包和便携版，共四个 EXE。唯一产品文件改动是 apps/web-pc/electron-builder.config.cjs，未改主进程、后端、共享引擎和 Android，也未提交或推送。

发现原配置固定带入 x64 Node、目标列表覆盖单架构 CLI 参数，以及外部普通 Node 后端无法读取 ASAR 中的前端。现在按 ${arch} 选择后端，打包前后检查 Electron／Node PE 架构，架构由 CLI 决定，关闭 ASAR 保证物理路径可读，并允许使用本地 Electron 分发包。配置测试先失败，修改后 3/3 通过；独立审查未发现阻断项。

## 构建命令与结果

先完成 B2 的 win-x64／win-arm64 包。在 apps/web-pc 中执行：

```powershell
$env:HG_ELECTRON_DIST=(Resolve-Path '.\node_modules\electron\dist').Path
$env:electron_builder_binaries_mirror='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --x64 --publish=never
$env:HG_ELECTRON_DIST=Join-Path $env:LOCALAPPDATA 'electron\Cache\electron-v40.0.0-win32-arm64.zip'
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --arm64 --publish=never
```

首次 x64 构建下载 NSIS 工具时连接中断，重试后两次构建均 exit 0，真实输出包含 building target=nsis、target=portable。日志 t-b1-x64-retry.log、t-b1-arm64.log。Electron 40.0.0、electron-builder 26.15.3、Node 22.20.0。

## 产物

outputs/windows 下产物：

| 文件 | 字节数 |
| --- | ---: |
| 红果短剧-1.0.0-x64-setup.exe | 116726562 |
| 红果短剧-1.0.0-x64-portable.exe | 116461052 |
| 红果短剧-1.0.0-arm64-setup.exe | 107891428 |
| 红果短剧-1.0.0-arm64-portable.exe | 107626400 |

逐文件 SHA256、大小和签名状态见 t-b1-artifacts.json；发布校验清单 outputs/windows/SHA256SUMS.txt。四个 EXE 的 Get-AuthenticodeSignature 均为 NotSigned，未引入证书或签名凭据。

## 验证

根目录执行以下命令，全部 exit 0：

```powershell
node --test .agents/shared/t-b1-config.test.cjs
node .agents/shared/t-b1-smoke.cjs
git diff --check
```

配置测试 3/3。实际启动 win-unpacked/红果短剧.exe，PATH 为空，使用 outputs/packaging-tests/desktop-no-node 独立资料目录：健康接口 200、首页 200 且为 HTML、渲染根节点有内容，测试启动的应用正常关闭。证据 t-b1-no-node-smoke.json。最初 Electron 主进程自动化调试连接超时，启动日志已进入主窗口；改用浏览器 CDP 通道完成验证，未改业务代码。

实际 PE 独立复核：x64 Electron／Node 均 0x8664，ARM64 均 0xaa64。两个包都存在 resources/app/dist/index.html、electron/main.cjs 和内置后端。NSIS 配置允许选择安装目录、创建桌面／开始菜单快捷方式，构建产出了卸载程序。

## 尚未验证

PATH 清空验证证明未依赖系统 Node，不等于干净 Windows 虚拟机测试。Windows ARM64 仅验证架构和文件，无执行设备。未实际安装／卸载，安装目录选择、快捷方式和控制面板卸载仍需协调者实际验收。没有重启原 Web 服务或启动常驻电脑端。
