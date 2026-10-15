# Web / Windows 全屏上下键切集

2026-10-15，用户直接任务。TV 文件未修改；工作区已有 TV 改动归其他执行方。

业务改动：`apps/web-pc/src/hooks/useKeyboardShortcuts.ts` 全屏普通播放中 ↑ 上一集、↓ 下一集，首尾不循环并提示，忽略长按 repeat，使用原有选集状态。非全屏音量、推荐切剧、输入框和片尾弹窗保持原有行为。`PlayerModal.tsx` 更新快捷键说明。

验证：新增 `tests/episode-shortcuts.test.mjs`，先运行得到 2 失败 / 1 通过，修改后 3 / 3 通过。`npm test` 140 / 140 通过，`npm run build` 通过。

实际交互：`node .agents/shared/w5-detail-check.cjs --episode-shortcuts` 通过；追加 `--desktop` 并设置 HG_DESKTOP_TEST_EXECUTABLE 指向已交付 Windows 应用，原生全屏交互通过。验证上下切集、首尾边界、切集保持全屏及退出后音量行为。使用本地媒体夹具，未重新验证上游。

桌面夹具最初通过自定义协议转发时页面为空，未到达按键步骤；改为测试窗口直接加载本地 HTTP 夹具，保留真实 Electron preload / 原生全屏后通过。桌面测试运行最新前端构建，现有安装包尚未重打。

证据：`.agents/shared/episode-shortcuts-web-results.json`、`.agents/shared/episode-shortcuts-desktop-results.json`；完整测试日志 `outputs/testing/episode-shortcuts-tests.log`。
