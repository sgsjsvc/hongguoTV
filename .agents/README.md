# 多 Agent 协作规范

六方通过**文件总线**协作。文件交接可持久、可审计，不依赖各工具私有 IPC。2026-10-16 用户新增 Qoder、OpenCode 并要求重新分工；最新职责与交接规则以 [RESPONSIBILITIES.md](RESPONSIBILITIES.md) 为准。

## 参与方（用户最新分工）

| Agent | 主责 |
| --- | --- |
| DSH / dsh | 统筹协调、最终验收与发布安排 |
| Antigravity / antigravity | Web/电脑端，包含Electron与远程管理界面 |
| Qoder / qoder | TV端 |
| WorkBuddy / workbuddy | 手机端 |
| Codex / codex | 短剧后端服务与远程共享服务 |
| OpenCode / opencode | 打包与测试、产物校验、发布门禁 |

所有Agent将重新打开新会话。先读 [START_HERE.md](START_HERE.md)，按 [QUICKSTART.md](QUICKSTART.md) 对应身份恢复。旧会话、旧ready和旧路由不代表当前能力。职责唯一依据是 [RESPONSIBILITIES.md](RESPONSIBILITIES.md)。

## 目录约定

```
.agents/
├── inbox/     待办任务（主控写入，执行方认领）
├── outbox/    完成结果（执行方写入，主控验收）
├── state/     心跳与占用锁
├── logs/      追加式事件日志（*.jsonl）
├── shared/    共享上下文（项目事实、术语表）
└── archive/   已归档任务
```

**`.agents/` 不加入 .gitignore** —— 协作记录必须入库才可追溯。

## 任务生命周期

```
pending ──claim──> claimed ──> done
                          └──> failed
```

任务 JSON：

```json
{
  "id": "t-xxx",
  "assignee": "codex",
  "title": "一句话标题",
  "brief": "要做什么",
  "context": ["相关文件路径", "已知事实"],
  "acceptance": ["可验证的验收标准"],
  "blockedBy": ["前置任务 id"],
  "status": "pending",
  "result": null
}
```

## 常用命令

```powershell
node .agents/cli.mjs doctor                        # 探测各 agent 可用性
node .agents/cli.mjs status                        # 全局状态
node .agents/cli.mjs add codex "标题" "具体要求"    # 建任务
node .agents/cli.mjs list [status]                 # 列任务
node .agents/cli.mjs ready                         # 列出依赖已满足的任务
node .agents/cli.mjs show <id>                     # 任务详情
node .agents/cli.mjs run <id>                      # 自动执行
node .agents/cli.mjs done <id> <agent> "摘要"       # 手工标记完成
node .agents/cli.mjs fail <id> <agent> "原因"       # 手工标记失败
```

## 各 agent 接入要点

### Codex

`codex exec` 会**从 stdin 读补充输入**，不关闭 stdin 会一直等到超时。适配器已处理（`closeStdin: true`）。

### Antigravity

三个参数都是**动态**的，重启后变化，必须运行时发现：

| 变量 | 来源 |
| --- | --- |
| `ANTIGRAVITY_LS_ADDRESS` | `language_server.exe` 的监听端口（gRPC 端口，**不是** HTTPS 端口） |
| `ANTIGRAVITY_CSRF_TOKEN` | 同进程命令行的 `--csrf_token` |
| `ANTIGRAVITY_PROJECT_ID` | `%APPDATA%\Antigravity\app_storage.json` 的 `lastCreatedProjectId` |

端口**不能靠大小猜**：2729 是 HTTPS（对 gRPC 报 `server preface`），2730 是 gRPC。适配器用实测探活决定。

`new-conversation` 是**异步**的，只返回 `conversationId`。回复不在 `get-conversation-metadata` 里，而在：

```
~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl
```

取 `source=MODEL` 且带 `content` 的最后一行。用 `readReply(id, { waitMs })` 轮询。

### WorkBuddy

闭源 Electron 应用，IPC 是私有协议（命名管道 + 动态 ticket），**不逆向**。走文件总线：

```powershell
node .agents/cli.mjs run <id>   # 生成 .agents/inbox/<id>.workbuddy-prompt.md
```

然后在其窗口里让它读取该文件，结果按约定写入 `.agents/outbox/<id>.json`。

## 防冲突

- **占用锁**：`claim` 写入 `state/<id>.lock.json`，30 分钟内其他 agent 无法重复认领。
- **依赖阻塞**：`blockedBy` 未全部 `done` 的任务不会出现在 `ready` 里。
- **单写者**：同一时刻一个任务只允许一个 agent 持有。

## 分工边界

职责以 [RESPONSIBILITIES.md](RESPONSIBILITIES.md) 为准，具体文件授权以任务brief为准。

| 区域 | 归属 |
| --- | --- |
| 任务协调、最终验收、发布安排 | DSH |
| apps/web-pc/（含electron）、apps/sync-server/public/ | Antigravity |
| apps/tv-android/ | Qoder |
| 手机专属客户端目录（尚未建立） | WorkBuddy |
| shared/、server/、custom-server/、同步服务后端 | Codex |
| 跨端打包、测试、性能与产物校验工具 | OpenCode |

开发者负责所属功能自测，OpenCode负责独立验证与统一打包。同一文件同一时间只有一个写者；已领取任务由原负责人完成或经DSH交接，不自动转移。各方维护模块文档，DSH汇总交接。

## 已知限制

1. **Antigravity 会自主使用工具**。实测让它"只回复 BUS_OK"，它仍去执行了 `dir`。任务描述里若要它只回答不执行，需要显式约束。
2. 各工具的文件、命令与网络权限以其实际会话为准，不能根据产品名称假定；接入报告必须明确验证。
3. **WorkBuddy 无法自动触发**，必须人工在其窗口操作。
4. **Antigravity 会话不可复用**，每次 `new-conversation` 都是新会话，上下文不延续。
5. Qoder / OpenCode 尚未验证自动适配器；使用人工打开项目、读取指令和 `claim/done` 文件交接，不对它们调用 `run`。现有 team/route/plan 旧岗位映射需 DSH 同步，暂不作为六方分配依据。
