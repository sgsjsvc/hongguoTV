# O4 TV 端首帧与切集延迟实测

- **任务ID**: `t-opt-tv-first-frame`
- **assignee**: `qoder`（apps/tv-android 主责）
- **依赖**: 无（但**建议**在 `t-opt-stream-latency` 修复前后各测一次，以验证共享引擎收益）
- **上游依据**: `.agents/shared/dsh-optimization-proposals-20261017.md`

---

## 一、背景：TV 与其它端共用同一内容引擎

TV 端经 **QuickJS JNI** 执行 `shared/content-core/hongguo.js`（与 Web/手机同一份）。
DSH 本轮实测该引擎的**取流首块**存在**间歇性 ~12 秒**（顺序回退 primary→backup 所致），
`t-opt-stream-latency`（codex）正在修复。

**因此本任务有两件事**：
1. **测量 TV 端真实首帧/切集延迟**（此前**从未测量过**）
2. 在引擎修复落地后**复测**，验证 TV 是否同样受益

## 二、必须实测的指标

### 2.1 起播与切换（每个场景至少 3 次取样，给出 min/avg/max）

| # | 场景 | 测量口径 |
| --- | --- | --- |
| 1 | **App 冷启动** | `am start` 到首个页面可交互 |
| 2 | **详情页打开** | 点击卡片到详情渲染完成（选集列表可见） |
| 3 | **首帧时间（起播）** | 点击播放到**首帧画面出现**（`ExoPlayer` 状态变为 `READY` 或有渲染输出） |
| 4 | **切集时间** | 切换分集到新集首帧 |
| 5 | **切剧时间** | 切换剧目到新剧首帧 |
| 6 | **清晰度切换时间** | 切换档位到恢复播放 |
| 7 | **自动连播间隔** | 一集结束到下一集首帧 |

### 2.2 区分"等待来源"（关键）

必须区分并分别计时，**不能只给一个总数字**：

- **(a) 共享引擎准备耗时**（`prepareHeader`：取流首块 + moov 解析 + CENC 索引）
- **(b) ExoPlayer 缓冲与解码首帧耗时**
- **(c) 网络下载耗时**（后续分片）
- **(d) UI/焦点恢复耗时**

**建议手段**：Android `Log` + `ExoPlayer` 事件监听（`onPlaybackStateChanged`/`onRenderedFirstFrame`）、
`adb shell dumpsys media.metrics`、必要时临时插桩（**插桩代码不得留在交付里**）。

### 2.3 若实测发现 TV 侧可优化项

- **仅限 TV 端代码**（`apps/tv-android/**`）才能改
- 若根因在共享引擎 → **不要改引擎**（codex 唯一写者），**报告交 DSH 并附证据**
- 已知既有优化：P3（切集不重建 UI 树）、P4（列表渲染、`enqueue`、并发限制 4）**已完成**，
  **不要重复提议**已做过的事

## 三、设备纪律（严格）

- **先 `node .agents/cli.mjs mumu declare <设备> qoder "t-opt-tv-first-frame"`，用完 `mumu release`**
- **去重规则**（用户 2026-10-17）：**相同系统不重复测试** —— 只测 **API 32 一台 + API 35 一台**
- **无 API 22 设备**：`mumu-r`（电视 192.168.1.112）**ADB 不可达**（网络通、端口未开）
  → **API 22 兼容性无法验证，必须如实标注，禁止用 API 32/35 结果代替**
- **构建互斥**：同一副本一次只允许一次 Android Gradle 构建；开工前查 `java.exe`/daemon，
  写占用记录，**用完释放**

## 四、唯一写者范围

**允许改**：`apps/tv-android/**`、`tests/**`（如需新增 TV 回归）、报告与 outbox
**禁止改**：
- ❌ `shared/content-core/hongguo.js` 与 vendor（**codex 唯一写者**）
- ❌ `custom-server/**`、`server/**`（codex）
- ❌ `apps/web-pc/**`（antigravity）、`apps/mobile/**`（workbuddy）

## 五、验收标准

1. **2.1 表中 7 个场景各有实测 min/avg/max**（每场景 ≥3 次），含设备型号/API
2. **等待来源已区分**（2.2 的 a/b/c/d 四类），不是只给总数
3. 若 TV 侧做了修改：改动文件清单 + 前后对比数据 + 回归测试
4. 若根因在共享引擎：**证据明确指出**该由 codex 修，不自改
5. **API 22 如实标注未验证**（电视 ADB 不可达）
6. 设备已释放；构建占用记录已释放
7. 报告：`.agents/shared/t-opt-tv-first-frame-qoder.md`；结果：`.agents/outbox/t-opt-tv-first-frame.json`

## 六、明确不做

- ❌ 不改共享引擎与 vendor
- ❌ 不改后端/Web/手机端
- ❌ 不重复实现已完成的 P3/P4 优化
- ❌ 不用高版本模拟器冒充 API 22 实机结论
- ❌ 不提交、不推送、不发布