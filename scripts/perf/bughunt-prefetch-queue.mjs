// 深挖：预取队列容量耗尽后是否能恢复？
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt2");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data") },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log);
child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
const api = async (method, url, body) => {
  const r = await fetch(BASE + url, {
    method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

console.log(`=== 预取队列恢复能力测试 (${BASE}) ===\n`);

const rec = await api("GET", "/api/recommend?page=1");
const items = rec.body.items || [];

// 步骤 1：逐步提交，观察何时 429
console.log("  --- 1. 逐步提交，观察容量边界 ---");
let first429At = null;
const submitted = [];
for (let i = 0; i < 12; i += 1) {
  const r = await api("POST", "/api/prefetch", {
    targets: [{ kind: "detail", id: items[i % items.length].id }],
  });
  if (r.status === 429) { first429At = i; console.log(`     第 ${i + 1} 次提交 -> 429`); break; }
  submitted.push(r.body.id);
  console.log(`     第 ${i + 1} 次提交 -> 202 (id=${r.body.id.slice(0, 8)})`);
  await sleep(200);
}

// 步骤 2：等待所有批次完成
console.log("\n  --- 2. 等待所有批次完成 ---");
await sleep(15000);
let completed = 0;
for (const id of submitted) {
  const s = await api("GET", `/api/prefetch/${id}`);
  if (s.body?.state === "complete") completed += 1;
}
console.log(`     ${completed}/${submitted.length} 批已完成`);

// 步骤 3：完成后能否再次提交？
console.log("\n  --- 3. 批次完成后能否再次提交（关键）---");
const retry = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: items[0].id }] });
console.log(`     再次提交 -> HTTP ${retry.status}${retry.status === 429 ? "  ⚠ 仍被拒" : ""}`);
if (retry.status === 429) {
  console.log("     ⚠ 批次已完成，但仍返回 429 —— 可能是任务未从 tasks 中清理");
}

// 步骤 4：诊断 tasks 是否泄漏
console.log("\n  --- 4. 诊断：已完成任务是否残留 ---");
console.log("     说明：tasks 在 finally 中删除（provider.mjs:63）");
console.log("           但 batches 保留 60 秒（provider.mjs:98）");
console.log("           容量检查同时看 tasks.size 与 batches.size（provider.mjs:101）");
console.log("");
console.log("     batches 上限 64，tasks 上限 32");
console.log("     每批 1 个目标 -> tasks 增长慢，batches 增长快");
console.log("     -> batches 先达到 64，导致 429");

// 步骤 5：等待 60 秒后重试
console.log("\n  --- 5. 等待 60 秒（batches 清理窗口）后重试 ---");
console.log("     这需要 60 秒，先测 20 秒");
await sleep(20000);
const retry2 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: items[0].id }] });
console.log(`     20 秒后提交 -> HTTP ${retry2.status}`);

// 汇总
console.log("\n  === 诊断结论 ===");
console.log(`  首次 429 出现在第 ${first429At === null ? "未触发" : first429At + 1} 次提交`);
console.log(`  完成 ${completed} 批后再次提交 -> HTTP ${retry.status}`);
if (retry.status === 429) {
  console.log("");
  console.log("  ⚠ 疑似缺陷：批次已完成但队列仍拒绝新提交");
  console.log("     可能原因：batches 的 60 秒保留期 + 容量检查包含已完成批次");
  console.log("     影响：用户连续浏览多部剧后，预取会停止工作约 1 分钟");
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();
