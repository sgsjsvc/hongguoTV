// 文件总线：多 agent 协作的共享收件箱。
// 约定：
//   .agents/inbox/<id>.json    待办任务（主控写入）
//   .agents/outbox/<id>.json   完成结果（执行方写入）
//   .agents/state/*.json       心跳与占用锁
//   .agents/logs/*.jsonl       追加式事件日志
//
// 任务 JSON 结构：
//   { id, createdAt, assignee, title, brief, context[], acceptance[], status, blockedBy[], result }
//
// status: pending -> claimed -> done | failed
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIRS = {
  inbox: path.join(ROOT, "inbox"),
  outbox: path.join(ROOT, "outbox"),
  state: path.join(ROOT, "state"),
  logs: path.join(ROOT, "logs"),
  shared: path.join(ROOT, "shared"),
  archive: path.join(ROOT, "archive"),
};

for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });

const now = () => new Date().toISOString();
const taskPath = (id) => path.join(DIRS.inbox, `${id}.json`);

export function logEvent(kind, detail) {
  const line = JSON.stringify({ at: now(), kind, ...detail }) + "\n";
  const file = path.join(DIRS.logs, `${now().slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, line, "utf8");
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

// ---------- 任务 ----------

export function createTask({
  assignee,
  title,
  brief,
  context = [],
  acceptance = [],
  blockedBy = [],
  priority = "normal",
  id = null,
}) {
  const taskId = id ?? `t-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const task = {
    id: taskId,
    createdAt: now(),
    updatedAt: now(),
    assignee,
    title,
    brief,
    context,
    acceptance,
    blockedBy,
    priority,
    status: "pending",
    claimedBy: null,
    claimedAt: null,
    result: null,
    history: [{ at: now(), status: "pending", by: "orchestrator" }],
  };
  writeJson(taskPath(taskId), task);
  logEvent("task-created", { id: taskId, assignee, title });
  return task;
}

export function listTasks({ status = null, assignee = null } = {}) {
  const files = fs.existsSync(DIRS.inbox) ? fs.readdirSync(DIRS.inbox).filter((f) => f.endsWith(".json")) : [];
  const tasks = files.map((f) => readJson(path.join(DIRS.inbox, f))).filter(Boolean);
  return tasks
    .filter((t) => (status ? t.status === status : true))
    .filter((t) => (assignee ? t.assignee === assignee : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function getTask(id) {
  return readJson(taskPath(id));
}

export function updateTask(id, patch, { by = "orchestrator", note = "" } = {}) {
  const task = getTask(id);
  if (!task) throw new Error(`task not found: ${id}`);
  const next = { ...task, ...patch, updatedAt: now() };
  if (patch.status && patch.status !== task.status) {
    next.history = [...(task.history ?? []), { at: now(), status: patch.status, by, note }];
  }
  writeJson(taskPath(id), next);
  logEvent("task-updated", { id, by, status: next.status, note });
  return next;
}

// 认领任务：写入占用锁，避免多个 agent 重复做同一件事。
export function claimTask(id, agent) {
  const lockFile = path.join(DIRS.state, `${id}.lock.json`);
  const existing = readJson(lockFile);
  if (existing && existing.agent !== agent && Date.now() - Date.parse(existing.at) < 30 * 60 * 1000) {
    throw new Error(`task ${id} already claimed by ${existing.agent}`);
  }
  writeJson(lockFile, { agent, at: now() });
  return updateTask(id, { status: "claimed", claimedBy: agent, claimedAt: now() }, { by: agent, note: "claimed" });
}

export function releaseTask(id, agent, { status = "pending", result = null, note = "" } = {}) {
  const lockFile = path.join(DIRS.state, `${id}.lock.json`);
  const lock = readJson(lockFile);
  if (lock && lock.agent !== agent) throw new Error(`task ${id} is locked by ${lock.agent}`);
  if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

  const task = updateTask(id, { status, result }, { by: agent, note });

  if (status === "done" || status === "failed") {
    // 结果同时落到 outbox，便于外部 agent 只读 outbox 就能拿到结论。
    writeJson(path.join(DIRS.outbox, `${id}.json`), {
      id,
      agent,
      status,
      finishedAt: now(),
      title: task.title,
      result,
    });
  }
  return task;
}

// ---------- 阻塞依赖 ----------

export function readyTasks() {
  const all = listTasks();
  const done = new Set(all.filter((t) => t.status === "done").map((t) => t.id));
  return all.filter(
    (t) => (t.status === "pending" || t.status === "blocked") && (t.blockedBy ?? []).every((d) => done.has(d))
  );
}

// ---------- 心跳 ----------

export function heartbeat(agent, detail = {}) {
  writeJson(path.join(DIRS.state, `${agent}.heartbeat.json`), { agent, at: now(), ...detail });
}

export function heartbeats() {
  const files = fs.existsSync(DIRS.state) ? fs.readdirSync(DIRS.state).filter((f) => f.endsWith(".heartbeat.json")) : [];
  return files.map((f) => readJson(path.join(DIRS.state, f))).filter(Boolean);
}

export const paths = { ROOT, ...DIRS };
