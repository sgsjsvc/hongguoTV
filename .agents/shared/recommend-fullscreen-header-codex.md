# 推荐全屏隐藏顶部导航

日期：2026-10-15；执行方 codex；用户直派：「推荐页面全屏时不要显示图二的内容」。图二为 Logo、首页／推荐／分类／榜单等顶部通用导航。

唯一业务改动：apps/web-pc/src/App.tsx，推荐页且未进入详情、全屏状态生效时不渲染 Header。退出全屏后恢复。使用已有 DOM／Electron 原生全屏状态监听，不新增状态或改推荐播放器，不影响详情页及其他页面。

验证先复现：推荐页全屏时 Header 数量为 1，断言失败；修改后浏览器及重新打包的 Electron 均验证 Header 数量为 0。Esc 和退出全屏按钮两种路径均恢复 Header，video 保留。

命令：

```powershell
npm run typecheck
npm run build
node .agents/shared/w5-detail-check.cjs --recommend-header
node .agents/shared/w5-detail-check.cjs --recommend-header --desktop
```

Electron 使用隔离的 outputs/w5-desktop/win-unpacked 包，electron-builder --win --x64 --dir 构建通过，未操作用户常驻桌面应用。测试使用本地受控视频及模拟内容数据，只验证导航显示、全屏进出和播放器保留，不作为官方内容播放验证。

证据：recommend-header-web-results.json、recommend-header-desktop-results.json；截图 recommend-header-web-fullscreen.png、recommend-header-desktop-fullscreen.png。构建／测试日志位于 outputs/w5-tests/header-*.log。辅助测试对既有 W5 harness 增加推荐页分支，原详情验收流程保留。

未修改 scripts/probe.mjs、scripts/diagnose-playback.mjs、tests/device-identity.test.mjs 等其他工作区改动，未提交／推送。请 DSH 整合 App.tsx 的两行改动，统一重建分发包；本轮只刷新共享前端 dist 并生成隔离桌面验收包，没有覆盖 outputs/windows 安装器。
