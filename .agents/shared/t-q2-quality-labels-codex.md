# Q2 清晰度标签及碰撞丢档修复

执行方：codex；日期：2026-10-16；状态：执行验证完成，交 DSH 最终验收。

## 改动与范围

认领前已重读 RESPONSIBILITIES.md、检查现有差异及任务 brief。保留其他成员与此前 B1/Q1 的未提交改动。本次业务改动仅为 `shared/content-core/hongguo.js` 的 qualityRows：在原回退链首增加 `item.definition ||`，并注明竖屏尺寸、496px 重名导致丢档的原因；完整同步两个 vendor 副本。无 definition 时原回退链保持不变。

保持 Q1 的 device_level=5、bytevc2 过滤及所有调用方不变；未修改 Web/TV 业务、content-api.js、custom-server/index.mjs 或 Kotlin。新增 tests/quality-labels.test.mjs 和本任务验证辅助脚本 .agents/shared/q2-quality-live-check.mjs。

三个引擎逐字节一致，SHA256：`eb4bd3e635a50ca2a73d661672ed5355f03efca4615fa99981c66a078903e5cd`。

## 回归与实际结果

- `node --test tests/quality-labels.test.mjs`：改动前 11 项中失败 8、通过 3；改动后 11/11 通过。覆盖三个副本 definition 优先、完整旧回退链、标准数字映射、同高度多档位，以及实际未修改 Web 和 TV 消费逻辑。
- `npm test`：189/189 通过，0 失败、0 跳过。
- 独立复核者只读检查并运行 quality-labels、quality-tiers、vendor-fallback：25/25 通过，无阻断问题。
- JDK17 执行 `:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest --console=plain`：BUILD SUCCESSFUL。读取 8 份当前 XML，32 项 Android 单元测试，0 失败/错误/跳过。
- 读取 Debug APK 内 assets/hongguo.js，与当前共享引擎逐字节一致。只在 Codex 的 D2（ADB server 15037、127.0.0.1:16416、API35）安装主 APK/测试 APK。
- `StandaloneEngineTest#nativeRuntimeSupportsSigningPrimitivesAndPromises` 和 `#bundledEngineFetchesDirectContentWithoutLocalBackend`：实际 JNI QuickJS 测试 OK (2 tests)。覆盖签名/Promise、直连内容与画质及解密 Range 数据 ftyp；不是所有档位完整音画解码验收。

## 实网对照

使用独立临时端口、独立数据目录启动当前后端，不重启用户正在使用的服务。辅助脚本调用协调者的 quality-label-scan.mjs、quality-derive-compare.mjs，完成后关闭自己启动的进程。

| 检查 | 实际结果 |
| --- | --- |
| 修复前标签扫描 | 30 部，2 部非标准；出现 544P、1924P/1282P/962P/642P 等 |
| 修复后标签扫描 | 30 部，0 部非标准、0 部单档；30 部均为 1080P/720P/540P/480P/360P |
| 修复后 derive 脚本 | 实际检查 24 部，非标准 0，碰撞 0 |

前后推荐样本不是严格同一批，不冒充配对试验。derive 脚本现有实现会读已经修复的 row.quality，其“vheight”标题不能证明旧原始链的结果。因此另外对真实碰撞剧保存原始元数据，用完整旧回退链重新计算，并与当前实际 HTTP 接口比较。

《公路求生榜一说她要走到公路尽头》：seriesId `7691938290202577944`，episodeId `7691941013878754329`。实际 video_4、video_3 均为 vheight=496、vwidth=864，但 definition 分别为 720p、540p。

- 同次原始数据按旧链去重：1080P/496P/480P/360P（4 档）。
- 当前 HTTP qualities：1080P/720P/540P/480P/360P（5 档），碰撞丢档修复。

首次辅助验证搜索误用 keyword，接口实际接收 q，导致找不到碰撞剧而退出失败。只修复本任务辅助脚本为 q 后，以 --collision-only 重测通过；未改业务搜索或删除失败日志。标签扫描和 derive 在首次退出前已经独立完成，之后另行断言实测数量与档位分布通过。

## 证据位置与剩余事项

证据位于 outputs/testing/q2-quality/：red.log、green.log、tests.log、before-quality-label-scan.log、after-quality-label-scan.log、after-quality-derive-compare.log、collision-results.json、android-build.log、quickjs-device.log；外围保留 outputs/testing/q2-after-live.log（首次搜索失败）及 q2-collision-live.log（修正后成功）。

本次未提交/推送、未发布或替换 release 包，也未重启正常服务。当前运行的旧后端需由 DSH 安排重启，其他客户端需重建/更新包后生效。未操作其他成员设备或实体电视；Android5.1.1 实机及所有档位逐档音画测试仍需后续验收。本次结论限定于所记录样本，不保证将来缺失 definition 的上游数据一定有标准标签，缺失时按要求保留旧回退。
