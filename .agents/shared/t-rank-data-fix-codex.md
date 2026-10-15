# 榜单读取修复：给 DSH 的交接

日期：2026-10-15（Asia/Shanghai）。执行方 codex；用户直接授权「榜单为什么没有获取到数据，这是我直接给你的，修复后要反馈给dsh」。任务 t-rank-data-fix 已登记到协作总线。

## 原因与证据

官网榜单正常返回真实数据，失败发生在本项目的 HTML 数据流解析层：

1. 共享引擎只认双引号属性的旧式 data-fn-name="r"，漏掉 mergeLoaderData 的 content.routerDataFnArgs 嵌套数据。
2. 部分页先返回占位 content，然后在 HTML 文档结束后追加 r 数据块；其 data-fn-args 使用单引号，旧解析再次漏掉。官方输出会变化，不能只看一页单次请求。
3. TV 的 rule.一级 捕获异常后返回 []，因此页面显示无数据。Web／电脑后端的独立解析器也有同类遗漏，随后触发已有首页／分类兜底，可能展示非对应页真实排名。

本机 8788 检查时未监听，未将连接失败误当官网无数据。实网对照直接请求官网；HTTP 验证另启动独立数据目录和随机端口的自有后端并在完成后关闭，未重启用户服务。

## 改动与隔离

- shared/content-core/hongguo.js：仅修复 rankData，支持新旧格式、双／单引号、属性顺序变化、字符串／对象 content、跳过无效占位块，保留有效空列表并校验 isSuccess。
- custom-server/vendor/hongguo.cjs、server/vendor/hongguo.cjs：相同修复，避免 fallback 源分叉。
- custom-server/index.mjs：VM 导出 rankData；extractRankFromHtml 复用共享解析器，保留失败返回 null 的调用契约，移除重复解析逻辑。
- tests/rank-data.test.mjs：16 项覆盖三份源、旧式 r、嵌套数据、单引号延迟块、异常数据、分页／字符串 ID 与桥接调用。

开始时存在其他代理的 CatalogScreenView.kt、dimens.xml 与协作文件差异，均未修改、回退或清理。未改播放器、签名、解密、分类布局或任何安装配置。未执行 git commit/push。执行期间协调者更新过 HEAD，结束时 HEAD=53404d4240f9a2e45db6b9e3eee6413373d6e3e3；最终仍需协调者审阅工作区增量。

## 验证命令与实际结果

```powershell
node --test tests/rank-data.test.mjs
node .agents/shared/rank-live-check.mjs
node .agents/shared/rank-http-check.mjs
npm test
npm run build
```

apps/tv-android 下：

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:ANDROID_NDK_HOME=$null
.\gradlew.bat :app:assembleDebug :app:lintDebug :app:testDebugUnitTest --console=plain
```

- 测试先复现失败：初始 12 项中 9 项失败；补充单引号用例后 15 项中 3 项失败；桥接测试在后端修复前 16 项中 1 项失败。最终 16/16 全通过。
- 实网 TV API 适配路径：四个榜单 hot-drama／hot-real-drama／hot-comic-drama／hot-ai-drama，各 1–5 页，共 400 条，所有剧集 ID 与官网逐条一致，每榜 100 条无跨页重复。证据 t-rank-live-results.json。
- 独立后端真实 HTTP /api/rank/list：同样 20 页全部成功，每页 20 条，每页首条 ID 和排名与官网一致。证据 t-rank-http-results.json。服务正常关闭。
- npm test：109/109，0 fail。
- Web：构建成功，Vite 6.4.4，1667 modules。
- Android：BUILD SUCCESSFUL in 56s，60 actionable tasks: 21 executed, 39 up-to-date；Debug 构建、lint、单元测试成功。
- 独立只读审查：原修复 15/15；补充后端桥接审查 16/16，无阻断项。
- git diff --check 通过。

完整命令日志位于 outputs/rank-diagnosis：tests-before.log、single-quotes-before.log、bridge-before.log、tests-after.log、regression.log、web-build.log、android-build.log。raw 官网 HTML 仅留本地 outputs 用于诊断。

## APK 与待 DSH 执行事项

新包：outputs/tv-android/hongguotv-rank-fix-debug.apk。

SHA256：a596bbee61dbcb8a0b43683f8f6ca342030ac53feac66dd9c2023dbe70d5bd91。

已验证 APK 中 assets/hongguo.js 与修复后的共享引擎完全一致，包含四种 native ABI。这个包包含构建当时工作区的当前 TV UI，因此交接时需与 P1/P2 验收版本一起确认。

尚未安装新包，也未声称电视界面已经恢复。请 DSH 统一安排：安装此 Debug APK 到调试设备，实际进入四榜及翻页验收；如需分发 Windows/Web 自包含旧包，应重新打包以携带本次引擎／后端修复。现有运行服务需要在协调者安排重启后才能加载新后端代码。

现有后端在网络或格式均不可用时的首页／分类兜底策略未扩展调整；本次保证已核验的官方四榜 20 页走真实解析路径，不将分类数据作为本次成功证据。
