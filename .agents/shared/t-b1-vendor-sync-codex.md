# B1 vendor 回退副本修复

负责人 codex，日期 2026-10-16。任务 `t-b1-vendor-sync`。

## 根因与改动

`custom-server/index.mjs` 的 VM 导出新增了 upstreamStats，但两份 vendor 落后于 shared，未定义该变量，导致共享文件缺失时回退引擎无法加载。`bughunt-vendor2.mjs` 修复前实际输出 `upstreamStats is not defined`。

采用方案 A：将权威 `shared/content-core/hongguo.js` 的完整字节复制到 `custom-server/vendor/hongguo.cjs` 与 `server/vendor/hongguo.cjs`。不单独补一个变量，避免遗漏统计、空体重试、签名设备守卫和删除死代码等其他差异。**权威源码未修改**，未修改 Web / TV / 后端选择逻辑或其他任务文件。

新增 `tests/vendor-fallback.test.mjs` 共 9 项：

- 与权威文件完整 SHA256 一致，防止以后只改 shared 而漏同步 vendor。
- 动态读取 custom-server/index.mjs 与 server/provider.mjs 的实际 this.api 导出对象，分别执行两份 vendor 的 VM 加载并验证没有 undefined 符号，未来新增导出自动覆盖。
- 两份 vendor 分别验证：首次空体后使用新 device_id 重试成功、upstreamStats 正确记录，以及连续五次空体后有界失败、五个设备互不相同。

不引入自动改写源文件的构建步骤；由 npm test 的完整副本一致性守卫明确阻止副本过期，避免静默覆盖维护者差异。

## 测试与复测

全部证据位于 `outputs/testing/b1-vendor/`。

| 命令 / 阶段 | 实际结果 |
| --- | --- |
| bughunt-vendor2.mjs，修复前 | 明确缺少 upstreamStats，VM 回退失败，vendor-before.log |
| 新增测试 RED | 9项，7失败/2通过；已有 provider 导出可加载，但主后端导出及新行为失败；red.log |
| 同步后新增测试 | 9/9通过，green.log |
| 初次 npm test | 170/170通过，tests.log |
| 最终 npm test | **173/173通过**，tests-final.log；包含并行 B2 新增的测试 |
| bughunt-vendor2.mjs，修复后 | 符号完整、VM可加载，vendor-after.log |
| bughunt-engine-sync.mjs | shared独有0行、vendor独有0行，sync-after.log |
| build-bundles --platforms=win-x64 --web-only | 成功，bundle-build.log；仅重建当前 Windows x64 Web 验证包 |
| bughunt-bundle-vendor.mjs | 包内含统计和随机源，动态导出VM加载成功，bundle-after.log |
| 实际包进程回退 | 独立解压ZIP，移走测试副本的shared文件，以包内Node启动真实custom-server及provider，health 200 / engineLoaded=true；fallback-process-results.json / fallback-server.log |

协调者的 bughunt 脚本本身失败时也可能返回退出码0，且有旧结论说明文字；本轮核对的是实际输出和断言结果，不把退出码0或尾部静态说明当作成功。新回归测试和实际进程检查均有严格断言。

三文件 MD5 均为 **9C2179BAAEB47341D8E181E052702584**（shared 与两份 vendor 完全相同）。

独立只读审查者也运行9项测试并核对MD5，未发现阻断问题；未改文件。主执行方运行完整测试并验证压缩包，不依赖审查者口头结论。

## 打包回退验证的隔离方式

辅助脚本 `.agents/shared/b1-fallback-process-check.mjs` 真正解压新 ZIP，在 `outputs/testing/b1-vendor/fallback-extracted/` 校验三份引擎字节相同，再仅将解压副本的共享引擎改名为 `.disabled-for-fallback-test`。使用该包 runtime/node.exe、随机端口和独立数据目录启动实际后端；只有两个 vendor 可用。健康接口统计对象存在、引擎加载成功，说明 custom-server 和 provider 的实际导入/VM初始化均成功。测试结束关闭自有进程并恢复解压副本文件名；未移动工作区 shared、未停用户服务。

## 并行门禁及交付边界

初次全量测试170通过后，额外 release:check 尝试遇到 B2 新增精确字符串测试不适配 api.ts 的 CRLF 行尾，临时173项中1失败，记录在 release-check.log。已经通过 `.agents/shared/b1-b2-release-gate-note-codex.md` 告知，未越权修改 B2 文件；B2 修正后最终173项全部通过。本轮产物只用于 B1 回退验证，未更新 release/、未正式发布多平台包，也未将该次不完整的 release:check 宣称为全绿。

现有选择器使用 fs.existsSync：本轮验证并修复的是 **shared 缺失时** vendor 可用；shared 存在但内容损坏时是否自动切换属于选择器行为，当前不自动回退，本任务允许范围不含修改该逻辑，不宣称已覆盖该恢复场景。没有重新验证真实上游播放/实体电视，本次空体重试采用确定性HTTP桩。

未提交或推送Git。B1代码、回归测试及包回退验证完成，交DSH最终验收。
