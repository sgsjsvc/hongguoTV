# 多 Agent 协作规范

四个 agent 通过**文件总线**协作。选文件而非 IPC，是因为它是四个 agent 唯一的共同能力，且天然持久、可审计、可 diff、可进 git。

## 参与方

| Agent | 调用方式 | 定位 |
| --- | --- | --- |
| **DSH**（本会话） | 自有工具链 | 主控、调度、验收、跨端联调 |
| **Codex / ChatGPT** | `codex.exe exec` | 后端、算法、批量重构 |
| **Antigravity** | `agentapi.bat` | UI、浏览器验证、多模态 |
| **WorkBuddy** | 文件总线（无 CLI） | 记忆沉淀、文档、长上下文 |

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

避免两个 agent 同时改同一文件：

| 区域 | 归属 |
| --- | --- |
| `shared/content-core/`、`custom-server/`、`server/` | Codex |
| `apps/web-pc/src/` | Antigravity |
| `apps/tv-android/` | Antigravity（TV 在本轮范围内，见 QUICKSTART 边界） |
| `docs/`、`.workbuddy-ai/memory/` | WorkBuddy |
| 跨端联调、发布、验收 | DSH（主控） |

> **归属是默认值，不是硬约束。** 实际以每个任务的 `assignee` 与 `brief` 为准。同一文件同一时间只能有一个修改者。

## 已知限制

1. **Antigravity 会自主使用工具**。实测让它"只回复 BUS_OK"，它仍去执行了 `dir`。任务描述里若要它只回答不执行，需要显式约束。
2. **Codex 沙箱是 workspace-write**，默认只能改工作区。
3. **WorkBuddy 无法自动触发**，必须人工在其窗口操作。
4. **Antigravity 会话不可复用**，每次 `new-conversation` 都是新会话，上下文不延续。
