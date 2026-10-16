# Q1 清晰度档位缺失修复

日期：2026-10-16，执行方 codex。领取 `t-q1-device-level` 后完成，未领取其他负责人的任务。

## 改动

`shared/content-core/hongguo.js` 的 requestVideoModel.biz_param.device_level 从3改为5；新增注释说明这是上游编码兼容性选择：部分低档位在level3下仅返回私有bytevc2，过滤后只剩一个档位，level5可返回bytevc1。保持其他payload字段、签名、重试和bytevc2过滤逻辑不变。

完整同步至 custom-server/vendor/hongguo.cjs 与 server/vendor/hongguo.cjs，保留B1已完成的副本一致性。三份SHA256均为 `B4F8E8AC213945A405070E87363E548F2EB147F1C1313CCAB8645EBD70FE49BD`。未改前端、qualities路由、TV Kotlin或TV手写assets。

## 回归测试

新增 `tests/quality-tiers.test.mjs`：

- 拦截三份真实引擎通过 signedVideoRequest 发送的body，断言device_level=5、need_all_video_definition=true、超大分集ID仍为字符串。
- 不提供randomBytes的TV-like crypto宿主仍能生成同样payload。
- 执行生产HTTP qualities handler，确认bytevc2仍被排除、bytevc1仍作为HEVC保留，不靠重写过滤函数模拟。

RED：5项中4失败/1通过（旧level3触发四个payload失败，过滤本来就正确）。GREEN：5/5通过。完整 `npm test`：**178/178通过**，含B1副本守卫。独立只读审查运行Q1+B1测试14/14，核实改动范围与三份一致性，无阻断发现。

证据：`outputs/testing/q1-quality/red.log`、`green.log`、`tests.log`。

## 实网验证

使用独立本地后端、HG_PORT=0、独立数据目录、禁用预取，未重启用户既有服务；辅助 `.agents/shared/q1-quality-live-check.mjs` 启动真实后端并设置BASE供协调者脚本使用。脚本会严格核对18样本、90/90、1080码率/size数值与12/12，而非只看退出码。

| 验证 | 结果 |
| --- | --- |
| `quality-device-level.mjs` | 6部×3集，共18样本；L3 **38/90**，L5 **90/90**；13/18样本增加档位。不同于先前66/90是本轮推荐样本变化，未照抄旧数字 |
| `quality-diff.mjs` 修复前 | 前8部4部≥4档，3部仅1080P，另1部也是单档但标签不是1080P |
| `quality-diff.mjs` 修复后 | 前8部 **8/8≥4档，0部仅1080P**；两次请求及有/无seriesId一致；前三部前3集均5档 |
| `quality-side-effects.mjs` | 1080P样本L3/L5均bitrate=612721、size=14694803；12次L5请求成功12、空体0、错误0 |
| 额外固定会话4集1080P对比 | 4/4的分辨率、码率、size完全相同：1080×1920，码率394121/317396/456671/434919，size7188755/6139955/9173592/9118413 |

对应日志：`quality-device-level.log`、`diff-before.log`、`diff-after.log`、`quality-side-effects.log`、`quality-resolution.log`、`live-check.log`、`resolution-check.log`。前后quality-diff各自使用新推荐会话，不冒充同一8部配对；严格配对证据是device-level脚本的同18分集L3/L5对比，以及固定会话4集元数据对比。

### 验证脚本局限与保留观察

协调者side-effects脚本第一节把l3.info传给读取`.vl`的pick函数，产生4条脚本错误；其后码率、size和12次稳定性部分正常，不能把第一节当作验证通过。辅助脚本仅在内存中的验证副本修正pick参数，并添加严格的4字段数值比较，未改协调者原脚本。

补充探索的首轮随机4集原始video_5元数据比较曾有1项不一致（未记录当时分集及具体差异，不能确认原因），保留 `quality-resolution-extra-first.log` / `resolution-check-extra-first.log`；未删除失败或声称所有内容的1080P绝对不变。随后固定会话、完整记录分集ID及字段的4集对比通过。视频duration字段在所取列表项中缺失，未将“-”相同当作时长验证通过。结论限于上述明确记录的样本。

90/90表示该批上游返回的HEVC档位数量，不等同于所有档位已在所有硬件上完成解码/音画测试。原来非标准分辨率档位标签仍按既有映射展示，本任务未修改标签逻辑。

## TV 原生验证

JDK17运行 `:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest` 成功，Android单元 **32/32**；Gradle通过preBuild自动复制shared，直接读Debug APK确认 `assets/hongguo.js` 与权威源码逐字节相同。没有手写TV资产或修改Kotlin。

仅安装并测试codex的D2（ADB server15037，127.0.0.1:16416，API35），未操作其他模拟器或实体电视。运行现有 `StandaloneEngineTest#nativeRuntimeSupportsSigningPrimitivesAndPromises` 和 `#bundledEngineFetchesDirectContentWithoutLocalBackend`：**OK (2 tests)**。这是实际QuickJS JNI签名/Promise和直连内容、画质、解密Range数据ftyp验证，不只是Node VM模拟。日志 `android-build.log`、`quickjs-device.log`。

实体Android5.1.1硬件、所有清晰度逐档解码未重验。APK只用于D2验证，未替换release产物；当前已运行的旧后端需要协调者重启、其他端需要重打/更新包后才获得新引擎，未擅自重启用户服务或发布。

## 交付

Q1代码、回归、18样本90/90与记录样本1080P对比通过；剩余观察及验证边界已完整保留，交DSH验收。未提交或推送Git。
