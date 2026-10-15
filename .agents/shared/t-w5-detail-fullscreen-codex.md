# W5 详情页全屏验证与补齐

日期：2026-10-15（Asia/Shanghai）；执行方：codex；任务：t-w5-detail-fullscreen。

## 结论与唯一业务改动

发现并修复实际布局问题：Electron 窗口已为 2304×1536 全屏，播放器仍为 1104×621，computed position=relative。PlayerModal 同时具有 relative/fixed、普通模式 aspect/max-height 和全屏样式，Tailwind 的规则顺序导致普通约束覆盖全屏。

本轮仅改 apps/web-pc/src/components/PlayerModal.tsx 的播放器容器 className：普通布局与全屏布局改为互斥分支。全屏只使用 fixed inset-0 z-50 w-screen h-screen；普通模式保留原比例、边框、圆角及高度限制。未改 usePlayback、App、RecommendStream、Electron、TV、后端或 shared；工作区中这些文件的已有差异均保留。未提交或推送。

先由实际 GUI 测试复现尺寸断言失败，再修改并重建验证。修复后 Web 和 Electron 的 player / viewport / screen 全部为 2304×1536，播放器原点为 (0,0)，两端均真实播放至 ended 后自动进入下一集并保持全屏。

## 测试方式与边界

使用实际 App 前端、真实 HTMLVideoElement、Chrome 浏览器以及重新打包的 Electron 应用；视频为 ffmpeg 生成的本地 12 秒 H.264 测试片，数据接口是隔离的本地 fixture。第一集 seek 至距结尾 0.4 秒后继续真实播放，由浏览器产生 ended 事件，并非手动 dispatch ended。验证 UI 和播放状态流转，不将此结果当作官方内容获取、官方 1080P 解码或音画同步验收。

测试片实际 640×360；界面“1080P”来自 fixture 画质选项，用于核对徽标布局，不代表测试片的实际分辨率。图片中的彩条为测试片画面，不是官方剧集。

浏览器通过本地 HTTP 随机端口加载 dist；未重启用户的 :3000。桌面通过独立目录 outputs/w5-desktop/win-unpacked 的真正 packaged Electron 启动，采用独立 userData。仅在该测试进程运行时将 hongguotv 协议的数据来源临时指向 fixture，未修改主进程源文件或共享服务。原生全屏桥接、preload 和 React 逻辑均为产品实际实现。

初次浏览器尺寸异常由 Playwright 的焦点模拟抑制原生窗口全屏造成：document.fullscreenElement=true 但仍保持普通窗口高度。依据 [Playwright 官方问题记录 #19720](https://github.com/microsoft/playwright/issues/19720)，在本次辅助脚本进程内禁用原始 CDP session 的 focus emulation 后，真实 DOM Fullscreen API 验证通过；没有为测试工具行为修改产品代码，也没有调用 Browser.setWindowBounds/F11 来伪造浏览器全屏。

## 逐项结果

| 验收项 | Web | Electron |
| --- | --- | --- |
| 全屏方式 | DOM Fullscreen，document.fullscreenElement=true | 原生窗口桥接，DOM Fullscreen=false |
| 屏幕／视口／播放器 | 2304×1536 / 2304×1536 / 2304×1536 | 同左 |
| React 状态同步 | fullscreen 分支生效，退出全屏标签正确 | 同左 |
| 自动下一集 | ended 计数=1，1001→1002，保留 fullscreen=true | 同左 |
| Escape | 退出全屏，video 数量仍为 1，详情未关闭 | 同左 |
| 失败提示 | 主动令 DOM API 拒绝，出现“全屏失败，请先点击播放窗口再试” | 主动令测试进程 toggle IPC 拒绝，出现“切换桌面全屏失败，请先点击窗口激活” |
| 控件自动隐藏／唤醒 | 空闲后 top opacity=0，鼠标移动恢复控制栏与已有全屏入口 | 同左 |
| 截图与图二结构 | 左上返回／标题／集数／画质，中心暂停按钮，底部进度／前后集／速度／画质／连播／音量／全屏 | 相同结构与占屏范围 |

关于“常驻按钮”条目：W5 brief 引用早期 W2 的新增浮动按钮要求，但 fullscreen-requirement-correction.md 已明确用户认为详情页本来有按钮、不应新增；当前其他代理已移除冗余顶部按钮。本轮遵循更正，保留现有底部全屏入口，验证控件隐藏后能通过鼠标移动唤醒，不重新加回被用户否定的按钮。

Electron 失焦相关：W3 的独立真实窗口失焦切换及 10 次切换证据保留在 t-w3-fullscreen-results.json。本轮测试也以自有空白窗口切走焦点后点击播放器入口，实际桥接全屏通过；未将 Playwright 的 document.hasFocus() 当作原生窗口失焦的唯一证据。

## 证据文件

- t-w5-web-fullscreen.png、t-w5-desktop-fullscreen.png：两端对照截图，已人工打开检查布局。
- t-w5-web-idle.png、t-w5-desktop-idle.png：续播第二集后的控制状态截图。
- t-w5-web-results.json、t-w5-desktop-results.json：屏幕尺寸、真实 ended、第二集 URL、状态和提示测试结果及 fixture 请求日志。
- t-w5-web-geometry.json、t-w5-desktop-geometry.json：最终几何数据。
- outputs/w5-tests/desktop-before.log：修前 Electron 的 1104×621 / relative 实际证据。
- outputs/w5-tests/web-final.log、desktop-final.log：最终两端均 passed=true、exit 0。
- .agents/shared/w5-detail-check.cjs：可复现的测试辅助程序；只写测试产物并关闭自有进程。

## 验证命令与结果

```powershell
npm run typecheck
npm run build
npm test
node .agents/shared/w5-detail-check.cjs
node .agents/shared/w5-detail-check.cjs --desktop
```

typecheck、build 均 exit 0。最终 npm test：119 tests、119 pass、0 fail；日志 outputs/w5-tests/typecheck.log、build-final.log、regression.log。本轮不增加镜像实现的静态字符串测试，使用能捕获真实 CSS 规则覆盖问题的 GUI 断言。

打包命令（apps/web-pc 下）：

```powershell
$env:HG_ELECTRON_DIST=(Resolve-Path '.\node_modules\electron\dist').Path
node node_modules/electron-builder/cli.js --config electron-builder.config.cjs --win --x64 --dir --config.directories.output=F:/Project/hongguoTV/outputs/w5-desktop --publish=never
```

exit 0；日志 outputs/w5-tests/desktop-build-final.log。本轮生成独立的 unpacked 验收包，未覆盖或更新 outputs/windows 的 NSIS／portable 分发文件；W4/W5 整合后应由 DSH 统一重新封装发布。测试程序未操作其他代理的模拟器，未留下自有 GUI 或后端常驻。

独立只读审查已通过，无阻断项；审查仅覆盖本轮互斥布局改动，没有将其他代理的工作区修改算入本任务。
