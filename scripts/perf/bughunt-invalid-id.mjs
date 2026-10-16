// 验证：不存在的 ID 是否会导致预取任务卡住（真正的 bug 候选）
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt3");
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
    signal: AbortSignal.timeout(60000),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

console.log(`=== 无效 ID 对预取队列的影响 (${BASE}) ===\n`);

// 1. 提交一个不存在的剧集 ID
console.log("  --- 1. 提交不存在的剧集 ID ---");
const bogusId = "9999999999999999999";
const t0 = Date.now();
const r1 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: bogusId }] });
console.log(`     提交 -> HTTP ${r1.status}  id=${r1.body?.id?.slice(0, 8)}`);

// 2. 轮询其状态
console.log("\n  --- 2. 跟踪状态（最多 60 秒）---");
let final = null;
for (let i = 0; i < 60; i += 1) {
  const s = await api("GET", `/api/prefetch/${r1.body.id}`);
  final = s.body;
  if (i % 5 === 0 || final?.state === "complete") {
    const states = (final?.targets || []).map((t) => t.state).join(",");
    console.log(`     ${i}s: state=${final?.state}  targets=[${states}]`);
  }
  if (final?.state === "complete") break;
  await sleep(1000);
}
const elapsed = Date.now() - t0;
console.log(`\n     最终: state=${final?.state}  targets=[${(final?.targets || []).map((t) => t.state).join(",")}]`);
console.log(`     耗时: ${(elapsed / 1000).toFixed(1)} 秒`);

// 3. 该任务是否阻塞队列？
console.log("\n  --- 3. 阻塞检查：能否继续提交新预取 ---");
const rec = await api("GET", "/api/recommend?page=1");
const good = (rec.body.items || [])[0];
const r2 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: good.id }] });
console.log(`     提交有效 ID -> HTTP ${r2.status}${r2.status === 429 ? "  ⚠ 被阻塞" : ""}`);

// 4. 连续提交无效 ID，看是否耗尽队列
console.log("\n  --- 4. 连续提交 10 个无效 ID ---");
let ok = 0, blocked = 0;
for (let i = 0; i < 10; i += 1) {
  const r = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: String(9999999999999990000n + BigInt(i)) }] });
  if (r.status === 202) ok += 1;
  else if (r.status === 429) { blocked += 1; break; }
}
console.log(`     成功 ${ok} 个，${blocked ? "第 " + (ok + 1) + " 个被 429 拒绝" : "未触发 429"}`);

// 5. 有效请求是否受影响
console.log("\n  --- 5. 无效 ID 堆积后，有效请求是否受影响 ---");
const t2 = Date.now();
const d = await api("GET", `/api/series/${good.id}`);
console.log(`     详情请求 -> HTTP ${d.status}  ${Date.now() - t2}ms`);

// 6. 汇总
console.log("\n  === 诊断结论 ===");
const stuck = final?.state !== "complete";
console.log(`  无效 ID 的批次最终状态: ${final?.state}`);
console.log(`  ${stuck ? "⚠ 未在 60 秒内完成 —— 可能卡住队列" : "✓ 正常完成（失败也算完成）"}`);
console.log(`  无效 ID 堆积后有效请求: HTTP ${d.status}  ${Date.now() - t2}ms`);
console.log("");
if (stuck) {
  console.log("  ⚠ 疑似缺陷：无效 ID 的预取任务长时间占用队列");
  console.log("     影响：用户浏览到失效剧集时，预取队列可能被占满");
} else {
  console.log("  ✓ 无效 ID 会正常失败并释放队列，无缺陷");
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();
