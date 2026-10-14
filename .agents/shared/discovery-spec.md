# 发现类任务规范（Bug / UI Bug / 算法优化）

**协调者**: dsh
**日期**: 2026-10-14
**性质**: **只读发现**。不修改任何业务代码。

---

## 一、为什么这样分派

用户需求：分派 **bug 发现**、**UI bug 发现**、**算法优化建议**。

分派依据三条：

### 1. 按端切分，避免范围重叠

| 端 | 代码量 | 归属任务 |
| --- | --- | --- |
| 播放链路与内容引擎 | `custom-server/index.mjs` 770 行 + `server/` 1168 行 + `shared/content-core/` 832 行 | **D1** |
| TV 端 | `apps/tv-android/app/src/main/java` 24 文件 3534 行 | **D2** |
| Web/PC 端 | `apps/web-pc/src` 7 文件 4330 行 | **D3** |
| 资料库与同步 | `shared/library-store.mjs` + `custom-server/library-sync.mjs` + `apps/sync-server/` | **D4** |

### 2. 按方法切分，避免同源盲区

**这是本项目已验证的教训**：

> T1 验收时协调者用 `dp(数字)` 单模式扫描，漏掉了 `TvUi.dp(context, N)` 形式。
> **T4 独立复核用不同方法才发现**。

因此本轮的强制要求：

| 任务 | 必须使用的方法 |
| --- | --- |
| D1 | **静态分析 + 实际运行代码**（不能只读代码） |
| D2 | **ADB 运行时验证**（截图/dump，不能只读代码） |
| D3 | **浏览器运行时验证**（DevTools，不能只读代码） |
| D4 | **场景推演 + 构造测试**（不能只看代码「像是对的」） |

### 3. 按 agent 能力匹配

| Agent | 定位 | 任务 |
| --- | --- | --- |
| **codex** | 后端/算法 | D1 |
| **antigravity** | UI/浏览器/设备验证 | D2、D3 |
| **workbuddy** | 独立分析/复核 | D4 |

---

## 二、统一交付格式

每个发现必须用以下结构，**缺字段视为不合格**：

```json
{
  "id": "D1-F1",
  "severity": "high | medium | low",
  "category": "bug | ui-bug | algorithm",
  "title": "一句话描述",
  "location": "文件路径:行号",
  "evidence": "复现步骤 / 命令输出 / 截图文件名",
  "verified": true,
  "impact": "对用户或系统的影响",
  "suggestion": "修复或优化建议（不要实施）",
  "effort": "small | medium | large"
}
```

**关键约束**：

- `location` 必须精确到**文件:行号**
- `verified: true` 必须有**可复现证据**；仅靠阅读代码推断的填 `false` 并在 `evidence` 注明「静态推断」
- `suggestion` **只写建议，不实施**（本轮是发现类任务）

---

## 三、严重度定义（统一口径）

| 级别 | 定义 |
| --- | --- |
| **high** | 功能不可用、数据丢失、崩溃、安全问题 |
| **medium** | 功能可用但明显错误、体验受损、性能问题可感知 |
| **low** | 代码质量、命名、冗余、潜在风险 |

---

## 四、必须区分的两类结论

| 类型 | 要求 |
| --- | --- |
| **已核实** | 有命令输出/截图/测试证据，`verified: true` |
| **推测** | 仅静态推断，`verified: false`，必须写明「未实测」 |

**禁止**把推测写成已核实。这是本项目已发生的教训（U2 报告曾误写设备 API 33，实为 32）。

---

## 五、输出文件

各任务写入 `.agents/shared/<任务ID>-<身份>.md`，并附：

- **发现汇总表**（按 severity 排序）
- **每条发现的详细说明**
- **已尝试但未发现问题的区域**（同样有价值，避免重复劳动）
- **无法覆盖的区域**（如实说明）

运行时证据（截图/dump）放 `.agents/shared/`，命名：

```
<任务ID>-<场景>-<状态>-<时间戳>.<ext>
```

---

## 六、禁止事项

1. **不修改任何业务代码** —— 本轮是发现，不是修复
2. 不执行 `git checkout` / `git reset` / `git clean`
3. 不提交、不推送
4. 密钥、Cookie、签名凭据不入报告
5. 不把「构建通过」当作「功能正确」

---

## 七、当前工作区状态（背景）

工作区有大量未提交改动（播放修复 + TV UI 三轮改造）。**这些是既成事实，不要回退**。

发现任务应针对**当前工作区状态**审查，即包含所有已完成的改动。

---

## 八、任务清单

| ID | 负责人 | 范围 | 重点 |
| --- | --- | --- | --- |
| **D1** | codex | `custom-server/index.mjs`、`server/`、`shared/content-core/hongguo.js` | 播放链路 bug + 解密/缓存算法优化 |
| **D2** | antigravity | `apps/tv-android/` | TV UI bug（ADB 实测） |
| **D3** | antigravity | `apps/web-pc/` | Web/PC UI bug（浏览器实测） |
| **D4** | workbuddy | `shared/library-store.mjs`、`custom-server/library-sync.mjs`、`apps/sync-server/` | 同步算法 bug + 优化建议 |

**四条任务可并行** —— 范围不重叠，且均为只读。
