# Qoder 接入状态 —— DSH 侧核实记录（非 ready 报告）

**记录方**: DSH（协调者）
**时间**: 2026-10-16
**性质**: ⚠️ **这不是 `qoder-ready.md`，不能替代它。**
本文件是协调者对自己**亲眼核实过的证据**的留档，防止随上下文丢失。
按 `RESPONSIBILITIES.md` 规则 4，ready 报告**必须由 Qoder 自身实际验证后写**，他人不代写、不代称已接入。

---

## 一、事实经过

| 时刻 | 事件 |
| --- | --- |
| 早前 | `.agents/shared/qoder-ready.md` 存在（99 行，UTF-8 健康） |
| 同期 | DSH **读取全文并独立抽查 5 条关键声明，全部属实**（见第三节） |
| 之后 | **该文件从 `.agents/shared/` 消失**，且**从未进入 git 历史**（`git log --all` 无记录），也未被 `.gitignore` 忽略 → 判定为**被删除** |
| 现在 | 用户告知「qoder 已接入完毕」。DSH 复查：全仓库**无任何 qoder 命名文件**、`.agents/logs` 258 行中**含 qoder 的记录为 0**、**无 `assignee=qoder` 的任务**、git **未跟踪**任何 qoder 文件 |

---

## 二、当前可独立验证的客观事实

**Qoder 应用确实在本机运行**（DSH 实测，非推断）：

| 项 | 值 |
| --- | --- |
| 进程 | `Qoder CN.exe` **12 个进程** |
| 路径 | `D:\softeare\Qoder CN\Qoder CN.exe` |
| 启动参数 | `--qoder-initial-language=zh` |
| 数据目录 | `%LOCALAPPDATA%\Qoder CN`、`%APPDATA%\com.qodercn.app.stable`、`~\.qoder`、`~\.qoder-cn` |

**但「应用在运行」≠「已接入本项目文件总线」**，二者不可混同
（此区分已写入 `RESPONSIBILITIES.md` 第四节对 OpenCode 的同类判定）。

---

## 三、DSH 曾核实为真的 5 条声明（原报告内容，留档）

| # | Qoder 声明 | DSH 独立核实 |
| --- | --- | --- |
| 1 | `C:\Program Files\Java\jdk-17` 存在 | ✅ 属实 |
| 2 | Android SDK 在 `%LOCALAPPDATA%\Android\Sdk`；NDK `28.2.13676358` 在 **G 盘已挂载**且存在 | ✅ 属实 |
| 3 | `keystore.properties` 已被 `.gitignore` 忽略 | ✅ 属实 |
| 4 | shell 内 Node 实际为 **v22.20.0**（与环境声明的 v24.18.0 不同，以 v22 为准） | ✅ 属实 |
| 5 | `bus.mjs` 的 `claimTask` **无 assignee 白名单**，`qoder` 可直接 claim | ✅ 属实（源码 `claimTask` 仅检查锁的归属与 30 分钟时效） |

**原报告中另外记录的两项重要信息**（DSH 未复现，但形式合理）：

- **`./gradlew`（bash 脚本）在 Git Bash 下不可用**，报
  `ClassNotFoundException: org.gradle.wrapper.GradleWrapperMain`；
  绕过方式：`cmd.exe //c "set JAVA_HOME=C:\Program Files\Java\jdk-17&& gradlew.bat <task>"`
- **Gradle 8.11.1 发行包已离线缓存**，无需联网下载

**原报告自述的三项阻塞**：

1. 无 `assignee=qoder` 的任务 → 待命
2. 无设备：D1→antigravity、D2→codex、D3→workbuddy、REAL→dsh 已占满，三个锁仍在
3. 4 个原生文件（`MainActivity.kt`、`SeriesAdapter.kt`、`ArtworkLoader.kt`、`electron/main.cjs`）的当前唯一写者待 DSH 明确

---

## 四、为什么仍然不能直接派发

**规则 4 的目的不是形式审查，而是防止两类真实事故**：

| 风险 | 说明 |
| --- | --- |
| **凭据缺失** | 其他 agent 无法查阅 qoder 的能力边界与阻塞，容易派出不匹配的活 |
| **状态过期** | 报告写于文件消失之前；期间的分工变更（WorkBuddy 转复核）、设备占用变化未反映 |

**OpenCode 是反例对照**：它的 `opencode-ready.md` **在仓库里、可被任何方查阅、且已提交入库**，
所以 DSH 判定其「已接入」是有据的。

---

## 五、解除阻塞只需一步

**请 Qoder 自身重新写出 `.agents/shared/qoder-ready.md`**，内容需实际验证：

1. 读 `README.md`、`QUICKSTART.md`、`RESPONSIBILITIES.md`（**含本轮四条规则**）
2. 探测并记录：可访问目录、Node/Gradle/JDK/SDK/NDK/adb 实际版本、
   `cli.mjs` 的 `status/ready/list/show/claim/done` 是否可用
3. 记录**当前**阻塞：设备占用现状、原生文件写者归属
4. 写明**不改动他人在途工作**（当前工作区有 27 个已修改 + 33 个未跟踪文件）

**报告落地后即可派发**，无需其他手续。

**建议同时提交入库**，避免再次丢失：

```bash
git add .agents/shared/qoder-ready.md
git commit -m "docs(agents): Qoder ready 报告入库"
```

---

## 六、若用户明确要求豁免规则 4

**用户是最终决定者。** 若明确指示「不必等报告，直接给 qoder 派活」，
DSH 会按指示执行并在本文件追加记录豁免的时间与范围，
**但仍会在任务 brief 中写明「能力边界未经 ready 报告确认」**，
以免后续复核时被误认为已验证。

---

## 七、DSH 待办（与 Qoder 相关）

| # | 事项 | 状态 |
| --- | --- | --- |
| 1 | 明确 4 个原生文件的当前唯一写者 | ⏳ 待 DSH 决定（本文件第四节） |
| 2 | 是否为 qoder 分配设备或借用窗口 | ⏳ 待决定；**新增成员不等于新增模拟器** |
| 3 | `adapters.mjs` 是否加入 qoder 适配器 | ⏳ Qoder 为桌面 GUI 应用，无 CLI，预期走文件总线人工交接（同 workbuddy 模式） |
| 4 | 调查 3 个文件消失的原因 | ❌ **未查明**（已排除 git 操作，非 DSH 所为） |

---

## 八、用户决定（2026-10-16，DSH 已记录）

| 问题 | 决定 |
| --- | --- |
| 接入认定 | **由 Qoder 重写 `qoder-ready.md` 并提交入库**（不豁免规则 4） |
| 派发范围 | **先待命，等自然产生任务** —— 不为填人而造活 |

**因此当前不新建任何 qoder 任务，也不改派既有任务。**
`RESPONSIBILITIES.md` 规则 4 对 qoder 继续生效，直至其报告落地入库。

---

## 九、给 Qoder 的接入指令（一步即可解除）

**请 Qoder 自身完成以下动作，无需其他手续：**

1. **读四份文件**（含本轮新增内容）：
   `.agents/README.md`、`.agents/QUICKSTART.md`、`.agents/RESPONSIBILITIES.md`、
   本文件（第五节列出需覆盖的项）

2. **实际探测并写入 `.agents/shared/qoder-ready.md`**，至少覆盖：
   - 可访问目录（读写分别标注）
   - Node / Gradle / JDK / Android SDK / NDK / adb 的**当前实际版本**
   - `node .agents/cli.mjs status / ready / list / show / claim / done` 是否可用
   - **当前**阻塞（不要照抄旧版）：
     - 设备占用现状 —— D1→antigravity、D2→codex、D3→workbuddy、REAL→dsh，
       `state/device-d{1,2,3}.lock.json` 三个锁**是否仍在**
     - 4 个原生文件的写者归属（见第八节，待明确）
   - 明确声明**不改动他人在途工作**
     （当前工作区有 27 个已修改 + 33 个未跟踪文件）

3. **提交入库**（关键 —— 上次就是因为未入库而丢失）：

   ```bash
   git add .agents/shared/qoder-ready.md
   git commit -m "docs(agents): Qoder ready 报告"
   git push origin HEAD:refs/heads/main
   ```

4. 完成后告知用户 / DSH，即可按 `RESPONSIBILITIES.md` 职责表领取任务。

**可复用的历史核实结果**（本文件第三节，DSH 曾逐条验证为真）：
JDK17 存在、NDK `28.2.13676358` 在 G 盘、keystore 已 gitignore、
shell 内 Node 实为 `v22.20.0`、`claimTask` 无 assignee 白名单。
**但版本与设备占用会变化，请重新实测，不要直接抄录。**

**`./gradlew` 在 Git Bash 下不可用的问题**（旧版报告记录，值得重验）：
报 `ClassNotFoundException: GradleWrapperMain`，
绕过方式为 `cmd.exe //c "set JAVA_HOME=C:\Program Files\Java\jdk-17&& gradlew.bat <task>"`。
