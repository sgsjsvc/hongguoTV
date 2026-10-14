# R12 引擎结构优化与 F10 验证

负责人：codex。日期：2026-10-14。R11 完成并 ready 后认领。本轮实现已核实的 F5/F6/F7/F8/F9；F10 按任务允许的分支如实跳过，未凭推测更改 codec 恢复逻辑。

## 实现与证据

业务修改仅为三份引擎。主后端和 provider 均加载同一源定义，各自 VM 会得到独立的有界缓存，因此无需再修改两个入口的初始化代码。副本逐份应用相同局部改动，未直接覆盖。

| 发现 | 修改 | 运行结果 |
| --- | --- | --- |
| F5 | Range 完整匹配；缺失仍为 null，非法明确 invalid；拒绝多段和尾随内容 | 原非法前缀被接受；现在多段、junk、换行、负零和越界被拒，合法 suffix 保留 |
| F8 | 视频 ID 的 pending Promise 合并，失败 finally 清理；最终档位 key 的 stream 复用 | 同 ID 12 并发请求从 12 POST/12 GET 降至 1 POST/1 GET；auto/1080P 指向同一最终档位时共用 stream |
| F7 | BoundedCache：metadata/page/search 上限 100，stream 上限 24；TTL、LRU、删除元数据时失效相关流 | 每个独立 VM 构造 160 个不同视频，metadata <=100、stream <=24；过期删除和 fresh 失效通过 |
| F9 | 样本 end 二分定位；buildSamples 拒绝重叠样本，使索引 end 单调 | 10000 样本的末尾分片，end 访问从 10001 次降至 14 次 |
| F6 | 按 box 尺寸和已知容器层级遍历，限制 trak/stbl 边界；缺失/不完整加密辅助表不静默借用 | 明文轨道后接加密轨道，不再借用后者 saiz/saio；缺失一张加密表明确失败 |

额外核实并修复两项本轮引入风险：

1. fresh 新请求尚在执行、旧请求先结束时，不能把旧 stream 给新元数据复用。缓存带元数据对象身份，旧 generation 不写回，最终档位命中也核对 info 身份。该场景先 3 个副本测试失败，再通过。
2. 普通轨道的 free 载荷含 encv/enca 字符串，不能被当作加密样本入口。改为只读取 stsd 分录 type。该场景先 3 失败，再通过；真正加密入口无索引仍明确报错。没有修改 F10 的 fourcc 恢复。

在用的 stream 由请求保留引用，缓存淘汰不取消其他请求或使对象失效。单客户端正文取消继续使用 R1；R11 的 Content-Range 验证保留。

## 红绿过程

- 新测试 `.agents/shared/t-r12-engine-opt.test.mjs` 初始 15 项全部失败：t-r12-before.log。
- 请求合并/缓存/Range 第一阶段日志：t-r12-phase1.log；随后修复明确区分非法 Range 与缺失 Range。
- fresh 新旧请求隔离的追加 3 项先失败：t-r12-fresh-before.log。
- 普通 payload 文字误判的追加 3 项先失败：t-r12-box-before.log。
- 最终 R12 为 21 项通过，与 R11 16 项及正式 R1 10 项合跑 **47/47**：t-r12-after.log。

```powershell
node --test tests/playback-p0.test.mjs .agents/shared/t-r11-playback-correctness.test.mjs .agents/shared/t-r12-engine-opt.test.mjs
```

现有正式测试最终 `npm test` **93/93**（含 R13 移入的 R1）；见 t-r13-node.log。R12 自身验收时已有 83 项通过，见 t-r12-node.log。R11/R12 新增测试目前仍需上述独立命令，未超出 R13 授权将它们额外搬入 tests。

## 实网验证及 F10 跳过依据

见 t-r12-real-media.json：两个真实分集共 10 个档位分别为 bytevc1 / bytevc2，均带 spade_a，没有取得 AVC 加密样本。因此没有修改 prepareCencHeader 中统一 hvc1 的既有逻辑，也不将 F10 标记为已证实或已修复。该抽样不证明全部内容都没有 AVC。

当前源实际取得分集 7503780574541122622 的 360P/540P/720P/1080P，均有效 ftyp、15479 个样本，解密首样本的 NAL 长度前缀为 29 且小于样本长度。最后一处结构化入口改动后再次核实 1080P：t-r12-real-final.json，total=22421134、样本=15479、前缀=29、样本=7946 字节。这是取流及首样本解密验证，不等同于完整音视频解码验收。

## 构建与独立复核

- `:app:assembleDebug` 通过：t-r12-android.log。
- 最终与 R13 一起执行 `:app:assembleDebug :app:lintDebug :app:testDebugUnitTest`，BUILD SUCCESSFUL：t-r13-android-final.log。
- 三份引擎归一化后仅 category_$ 兼容表达式不同，其余全文相同；原始差异保留。
- APK 的 assets/hongguo.js 与共享源码哈希一致；t-r12-final-evidence.json 包含源码/APK SHA-256 和查找次数实测。
- 授权源 diff --check 通过。独立只读审查与最终 47 项回归通过，无阻断项。

## 剩余限制

- F10 是允许跳过的未验证项，需要真实 AVC 加密样本再分派验证；不是“所有编码已修复”。
- 没有实现完整 CENC scheme 支持：aux_info_type 标志、16 字节 IV、subsample/fragmented MP4 和完整 chunk 映射仍需专项验证。当前有界解析和错误检测不代表支持所有 MP4 变体。
- 缓存容量按条目而非实际字节计量，空闲期间 TTL 清理为惰性；in-flight Map 在网络请求结束时清理，没有额外实现全站并发准入控制。未做长期真实 heap/profiling。
- 限定容器递归深度为 16。二分依赖当前已排序、无重叠样本索引，未声称对任意外部不合法索引都成立。
- APK 未安装到实体 TV，未占用其他 agent 的 UI/设备会话；QuickJS 运行与实体播放未作本轮验收。源码不增加 Node 专属定时器，Buffer/Map 用现有运行时能力。
- 没有重启既有 8788 进程，没有提交或推送。由 DSH 统一部署再进行三端实际播放验证。
