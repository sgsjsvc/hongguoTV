# W3 Electron 窗口级全屏交付

日期 2026-10-15（Asia/Shanghai），执行方 codex；任务 t-w3-electron-fullscreen。

## 实际改动

产品改动仅在 apps/web-pc/electron/main.cjs、preload.cjs，未改 Web React／TV 代码。通过 contextBridge 暴露冻结的 hongguotvDesktop：isDesktop、setFullScreen、toggleFullScreen、isFullScreen、onFullScreenChanged；不暴露 ipcRenderer。三个 invoke handler 和 changed 通知严格使用约定通道。

主进程校验当前主窗口、webContents 和 mainFrame，拒绝其他窗口／子框架请求；检查窗口销毁。全屏切换串行执行，等待原生事件及实际状态收敛后返回，4 秒超时清理，窗口关闭清理计时器／监听器。全屏变化通知等待真实状态，返回取消订阅函数。支持 F11 切换、全屏时 Esc 退出，保持 contextIsolation=true、nodeIntegration=false。桌面 fork 显式清除继承的 HG_PORT，继续使用 PORT=0。

真实设备差异：本 Windows 实测 enter-full-screen 触发时 isFullScreen() 仍为 false，随后的 resize 才为 true。最初仅等事件的实现超时；将该顺序写入测试先复现失败，再实现事件后的短间隔状态确认，且通知同步修正，避免广播反状态。

必要打包配套：scripts/build-bundles.mjs 补复制共享 listen-port.mjs（W1 依赖），旧桌面 ZIP 路径补复制 preload.cjs。electron-builder 的 electron/**/* 已覆盖 preload，无需修改其配置。未重建旧 dist-win ZIP，最终交付为 electron-builder 的 x64 安装／便携包。

## 构建与测试命令

根目录：

```powershell
npm run build
node scripts/build-bundles.mjs --platforms=win-x64,linux-x64 --web-only
node --test tests/desktop-fullscreen.test.mjs tests/listen-port.test.mjs
npm test
```

apps/web-pc 下：

```powershell
$env:HG_ELECTRON_DIST=(Resolve-Path '.\node_modules\electron\dist').Path
$env:electron_builder_binaries_mirror='https://registry.npmmirror.com/-/binary/electron-builder-binaries/'
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --x64 --publish=never
```

最终实际包验证：

```powershell
node .agents/shared/w3-fullscreen-check.cjs
```

以上最终命令 exit 0；专项 6/6、回归 115/115。原生窗口操作从本机 Playwright CDP 和该测试进程自己的 Node inspector 驱动，未注入产品调试接口。初期测试辅助程序的 inspector require 上下文及失焦构造方式已修正；最终用另一个自有空白窗口夺焦，明确验证主窗口 focused=false，再调用桥接全屏。测试窗口、应用及所属后端均关闭。

构建日志 outputs/w3-desktop-build-verified.log，原始结果 .agents/shared/t-w3-fullscreen-results.json；测试脚本在启动前逐字节核对最终 unpacked 内 main/preload/后端/listen-port 与当前源码，避免验证旧包。最终重封装后再次复测，并非只测试手工更新的 staging 目录。

## 最终实际结果

- 桥接 typeof=object，四个方法和 isDesktop 正确。
- 主窗口 focusedBefore=false，setFullScreen(true) 返回 true。
- 全屏窗口 bounds=2048×1280，display bounds=2048×1280；渲染 innerWidth/Height 同为 2048×1280，与 screen 一致。
- 连续 10 轮 toggle 均返回 [true,false]，无失败。
- Esc 退出、状态通知与 unsubscribe 验证通过。
- contextIsolation=true、nodeIntegration=false。
- 父环境 HG_PORT=8899 不影响桌面，内置后端随机端口，健康接口 200。
- 自有测试应用已退出，不留下常驻电脑端。

## 交付

outputs/windows/红果短剧-1.0.0-x64-setup.exe 与 红果短剧-1.0.0-x64-portable.exe；具体字节数及 SHA256 见 .agents/shared/t-w3-artifacts.json，outputs/windows/SHA256SUMS.txt 已更新。

本轮没有执行安装器实际安装／卸载；实际测试的是最终构建的 win-unpacked 桌面应用。未重新构建 ARM64 包，未声称其他系统实机通过。W2 React 播放布局／按钮接入归 antigravity，本报告仅验证冻结桥接和原生窗口全屏，不代替 W2 的界面验收。独立只读审查无剩余阻断项；未修改他人 TV 差异、未提交或推送。
