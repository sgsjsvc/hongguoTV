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
import crypto from "node:crypto";
import * as bus from "./bus.mjs";
import adapters from "./adapters.mjs";
import { DIRS } from "./bus.mjs";

const [cmd, ...args] = process.argv.slice(2);

// MuMu device management
if (cmd === "mumu") {
  const devices = [
    { id: "mumu-d1", host: "127.0.0.1", port: 16384, api: 32 },
    { id: "mumu-d2", host: "127.0.0.1", port: 16416, api: 35 },
    { id: "mumu-d3", host: "127.0.0.1", port: 16448, api: 32 },
    { id: "mumu-r", host: "192.168.1.120", port: 5555, api: 22 },
  ];

  if (args[0] === "list") {
    console.log("=== Mumu 设备状态 ===");
    for (const d of devices) {
      const lockFile = path.join(DIRS.state, `${d.id}.lock.json`);
      let occupied = false;
      let info = "";
      try {
        const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
        occupied = true;
        const exp = lock.expiresAt ? ` 到期 ${new Date(lock.expiresAt).toLocaleString()}` : "";
        info = `✓ 占用中 by '${lock.claimedBy}' [${new Date(lock.claimedAt).toLocaleString()}]${exp}`;
        if (lock.purpose) info += `\n         用途: ${lock.purpose}`;
      } catch {}
      console.log(`${d.id.padEnd(8)} ${d.host}:${d.port} (API ${d.api})  ${occupied ? info : "✗ 空闲"}`);
    }
    process.exit(0);
  }

  if (args[0] === "declare") {
    if (args.length < 2) throw new Error("用法：mumu declare <设备> <身份> [用途]  (用途也可用环境变量 MUMU_PURPOSE 传，避免 PS 中文乱码)");
    const deviceId = args[1];
    const agent = args[2] || process.env.MUMU_AGENT;
    if (!agent) throw new Error("必须指定身份：mumu declare <设备> <身份> [用途]");
    const purpose = args.slice(3).join(" ") || process.env.MUMU_PURPOSE || "(未说明)";
    const device = devices.find((d) => d.id === deviceId);
    if (!device) throw new Error(`未知设备 ${deviceId}，可选：${devices.map((x) => x.id).join(", ")}`);
    const lockFile = path.join(DIRS.state, `${device.id}.lock.json`);
    if (fs.existsSync(lockFile)) {
      const cur = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      throw new Error(
        `${device.id} 已被 '${cur.claimedBy}' 占用（${new Date(cur.claimedAt).toLocaleString()}，用途：${cur.purpose}）\n` +
        `  请等对方释放，或确认对方已完成后由 DSH 协调`
      );
    }
    const lock = {
      type: "mumu-lock",
      version: "1.0",
      id: crypto.randomUUID(),
      device: device.id,
      host: device.host,
      port: device.port,
      apiLevel: device.api,
      claimedBy: String(agent).toLowerCase(),
      claimedAt: new Date().toISOString(),
      expiresAt: process.env.MUMU_EXPIRES || null,
      purpose,
      metadata: { claimedVia: "cli", relatedTask: process.env.MUMU_TASK || null },
    };
    fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + "\n", "utf8");
    console.log(`✓ ${device.id} 已声明占用：${lock.claimedBy}`);
    console.log(`  用途: ${purpose}`);
    console.log(`  地址: ${device.host}:${device.port} (API ${device.api})`);
    console.log(`\n  ⚠ 用完后必须释放：node .agents/cli.mjs mumu release ${device.id}`);
    process.exit(0);
  }

  if (args[0] === "release") {
    const deviceId = args[1];
    const who = args[2];
    if (!deviceId) throw new Error("用法：mumu release <设备> [身份]");
    const device = devices.find((d) => d.id === deviceId);
    if (!device) throw new Error(`未知设备 ${deviceId}`);
    const lockFile = path.join(DIRS.state, `${device.id}.lock.json`);
    if (!fs.existsSync(lockFile)) {
      console.log(`• ${device.id} 本来就是空闲的，无需释放`);
      process.exit(0);
    }
    const cur = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (who && cur.claimedBy !== String(who).toLowerCase()) {
      throw new Error(`${device.id} 由 '${cur.claimedBy}' 占用，'${who}' 无权释放（需 DSH 协调）`);
    }
    fs.unlinkSync(lockFile);
    console.log(`✓ ${device.id} 已释放，现在空闲`);
    console.log(`  原占用者: ${cur.claimedBy}  用途: ${cur.purpose}`);
    process.exit(0);
  }

  if (args[0] === "who") {
    const lockFile = path.join(DIRS.state, `${args[1]}.lock.json`);
    if (!fs.existsSync(lockFile)) { console.log("free"); process.exit(0); }
    console.log(JSON.parse(fs.readFileSync(lockFile, "utf8")).claimedBy);
    process.exit(0);
  }

  throw new Error("用法：mumu list | mumu declare <设备> <身份> [用途] | mumu release <设备> [身份] | mumu who <设备>");
}

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

    // ---------- 团队花名册 ----------
    case "team": {
      const { TEAM } = await import("./team.mjs");
      const byBackend = {};
      for (const r of TEAM) (byBackend[r.backend] ??= []).push(r);
      print(`团队岗位共 ${TEAM.length} 个，物理后端 ${Object.keys(byBackend).length} 个\n`);
      for (const [be, rows] of Object.entries(byBackend)) {
        console.log(`\n【${be}】(${rows.length} 岗位)`);
        for (const r of rows) {
          console.log(`  ${r.id.padEnd(13)} ${r.title.padEnd(14)} 波次${r.waves}  ${r.duties}`);
          console.log(`  ${"".padEnd(13)} 允许改: ${r.fileScope.join("  ")}`);
        }
      }
      break;
    }

    case "route": {
      const { routeFiles, clashWith } = await import("./dispatch.mjs");
      const r = routeFiles(args);
      if (!r.primary) {
        print("未找到归属岗位（fileScope 未覆盖这些路径）");
        print({ unmatched: r.unmatched });
        break;
      }
      console.log(`主责岗位: ${r.primary.id} — ${r.primary.title}`);
      console.log(`后端:     ${r.primary.backend}（把它粘给 ${r.primary.backend} 的窗口）`);
      if (r.all.length > 1) console.log(`共同涉及: ${r.all.slice(1).map((x) => `${x.id}(${x.title})`).join(", ")}`);
      if (r.reviews.length) console.log(`应评审:   ${r.reviews.map((x) => `${x.id}(${x.title})`).join(", ")}`);
      const clash = clashWith(args);
      if (clash.length) {
        console.log(`\n⚠ 与未完成任务冲突:`);
        for (const c of clash) console.log(`   ${c.id}  ${c.assignee}  [${c.status}]  ${c.title}`);
      } else {
        console.log("\n✓ 无未完成任务冲突，可并行派发");
      }
      break;
    }

    case "board": {
      const { board } = await import("./dispatch.mjs");
      const rows = board();
      print(table(rows, ["岗位", "名称", "后端", "波次", "进行中", "待办", "已完成", "在途"]));
      const total = rows.reduce((a, b) => a + b.在途, 0);
      console.log(`\n在途任务合计 ${total}，并发上限 3（物理后端数）`);
      break;
    }

    case "plan": {
      const { plan } = await import("./dispatch.mjs");
      const p = plan();
      for (const [w, rows] of Object.entries(p.并行波次)) {
        console.log(`\n── 波次 ${w} (${rows.length} 个) ──`);
        for (const r of rows) console.log(`  ${r.后端.padEnd(12)} ${r.岗位.padEnd(13)} [${r.状态}] ${r.标题}`);
      }
      if (p.冲突对.length) {
        console.log("\n⚠ 冲突对（同文件）:");
        for (const [a, b] of p.冲突对) console.log(`   ${a} × ${b}`);
      } else {
        console.log("\n✓ 无文件冲突");
      }
      console.log(`\n并发上限: ${p.并发上限}`);
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
          "  node .agents/bus.mjs team                查看团队花名册（岗位/职责/文件范围）",
          "  node .agents/bus.mjs route <文件...>     找主责岗位并检测冲突",
          "  node .agents/bus.mjs board               岗位负载一览",
          "  node .agents/bus.mjs plan                待办的并行执行计划",
          "  node .agents/bus.mjs mumu list           查看 Mumu 设备占用状态",
          "  node .agents/bus.mjs mumu declare <设备> <身份> <用途>   声明占用 Mumu",
        ].join("\n")
      );
  }
}

main().catch((e) => {
  console.error("错误: " + e.message);
  process.exitCode = 1;
});
