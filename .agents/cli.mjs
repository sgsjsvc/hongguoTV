#!/usr/bin/env node
// 协作总线 CLI。四个 agent 都用这一条命令读写共享状态。
//
//   node .agents/bus.mjs status              查看全局状态
//   node .agents/bus.mjs doctor              探测各 agent 可用性
//   node .agents/bus.mjs add <assignee> <title> [brief]   新建任务
//   node .agents/bus.mjs list [status]       列出任务
//   node .agents/bus.mjs show <id>           查看任务详情
//   node .agents/bus.mjs claim <id> <agent>  认领任务
//   node .agents/bus.mjs done <id> <agent> [summary]     标记完成
//   node .agents/bus.mjs fail <id> <agent> [reason]      标记失败
//   node .agents/bus.mjs run <id>            用任务指派的 agent 自动执行
//   node .agents/bus.mjs ready               列出可执行（依赖已满足）的任务
import fs from "node:fs";
import path from "node:path";
import * as bus from "./bus.mjs";
import adapters from "./adapters.mjs";

const [cmd, ...args] = process.argv.slice(2);

function print(value) {
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

const table = (rows, cols) => {
  if (!rows.length) return "(空)";
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (cells) => cells.map((v, i) => String(v ?? "").padEnd(width[i])).join("  ");
  return [line(cols), width.map((w) => "-".repeat(w)).join("  "), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\n");
};

async function main() {
  switch (cmd) {
    case "status": {
      const all = bus.listTasks();
      const by = {};
      for (const t of all) {
        by[t.status] ??= {};
        by[t.status][t.assignee] = (by[t.status][t.assignee] ?? 0) + 1;
      }
      print({ at: new Date().toISOString(), total: all.length, byStatus: by, heartbeats: bus.heartbeats() });
      break;
    }

    case "doctor": {
      const out = {};
      for (const [name, a] of Object.entries(adapters)) {
        try {
          out[name] = await a.available();
        } catch (e) {
          out[name] = { ok: false, reason: e.message };
        }
      }
      print(out);
      break;
    }

    case "add": {
      const [assignee, title, brief = ""] = args;
      if (!assignee || !title) throw new Error("用法: add <assignee> <title> [brief]");
      const t = bus.createTask({ assignee, title, brief });
      print({ created: t.id, assignee: t.assignee, title: t.title });
      break;
    }

    case "list": {
      const rows = bus.listTasks({ status: args[0] || null }).map((t) => ({
        id: t.id,
        assignee: t.assignee,
        status: t.status,
        title: t.title,
      }));
      print(table(rows, ["id", "assignee", "status", "title"]));
      break;
    }

    case "ready": {
      const rows = bus.readyTasks().map((t) => ({ id: t.id, assignee: t.assignee, title: t.title }));
      print(table(rows, ["id", "assignee", "title"]));
      break;
    }

    case "show": {
      const t = bus.getTask(args[0]);
      if (!t) throw new Error("任务不存在: " + args[0]);
      print(t);
      break;
    }

    case "claim": {
      const [id, agent] = args;
      print(bus.claimTask(id, agent));
      break;
    }

    case "done": {
      const [id, agent, summary = ""] = args;
      print(bus.releaseTask(id, agent, { status: "done", result: { summary } }));
      break;
    }

    case "fail": {
      const [id, agent, reason = ""] = args;
      print(bus.releaseTask(id, agent, { status: "failed", result: { error: reason } }));
      break;
    }

    case "run": {
      const id = args[0];
      const task = bus.getTask(id);
      if (!task) throw new Error("任务不存在: " + id);
      const a = adapters[task.assignee];
      if (!a) throw new Error("未知 agent: " + task.assignee);

      if (task.assignee === "workbuddy") {
        // WorkBuddy 走文件总线：生成一个投递文件，由人在其窗口里让它读取。
        const drop = path.join(bus.paths.inbox, `${id}.workbuddy-prompt.md`);
        fs.writeFileSync(
          drop,
          [
            `# 任务 ${task.id}`,
            ``,
            `**标题**: ${task.title}`,
            ``,
            `**要求**: ${task.brief}`,
            ``,
            task.context.length ? `**上下文**:\n${task.context.map((c) => `- ${c}`).join("\n")}\n` : "",
            task.acceptance.length ? `**验收标准**:\n${task.acceptance.map((c) => `- [ ] ${c}`).join("\n")}\n` : "",
            `完成后请把结果写入: .agents/outbox/${task.id}.json`,
            `格式: {"id":"${task.id}","agent":"workbuddy","status":"done","result":{"summary":"...","files":[]}}`,
          ].join("\n"),
          "utf8"
        );
        bus.updateTask(id, { status: "claimed", claimedBy: "workbuddy" }, { by: "orchestrator", note: "file-bus dispatch" });
        print({ dispatched: "file-bus", prompt: drop, note: "请在 WorkBuddy 窗口中让它读取该文件" });
        break;
      }

      bus.claimTask(id, task.assignee);
      const prompt = [
        task.title,
        "",
        task.brief,
        task.context.length ? "\n上下文:\n" + task.context.map((c) => "- " + c).join("\n") : "",
        task.acceptance.length ? "\n验收标准:\n" + task.acceptance.map((c) => "- " + c).join("\n") : "",
        "",
        `完成后把结论写入文件: .agents/outbox/${id}.json`,
      ].join("\n");

      const started = Date.now();
      const r = await a.exec
        ? await a.exec(prompt)
        : await a.start(prompt, { title: task.title });
      const ms = Date.now() - started;

      bus.releaseTask(id, task.assignee, {
        status: r.ok ? "done" : "failed",
        result: { ms, text: r.text ?? r.raw ?? "", conversationId: r.conversationId ?? null },
        note: r.ok ? "auto-run ok" : "auto-run failed",
      });
      print({ id, agent: task.assignee, ok: r.ok, ms, output: (r.text ?? r.raw ?? "").slice(0, 800) });
      break;
    }

    default:
      print(
        [
          "用法:",
          "  node .agents/bus.mjs doctor",
          "  node .agents/bus.mjs status",
          "  node .agents/bus.mjs add <assignee> <title> [brief]",
          "  node .agents/bus.mjs list [status]",
          "  node .agents/bus.mjs ready",
          "  node .agents/bus.mjs show <id>",
          "  node .agents/bus.mjs claim <id> <agent>",
          "  node .agents/bus.mjs done <id> <agent> [summary]",
          "  node .agents/bus.mjs fail <id> <agent> [reason]",
          "  node .agents/bus.mjs run <id>",
        ].join("\n")
      );
  }
}

main().catch((e) => {
  console.error("错误: " + e.message);
  process.exitCode = 1;
});
