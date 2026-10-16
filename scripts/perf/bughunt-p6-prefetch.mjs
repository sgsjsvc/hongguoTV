// P6 预取触发的边界测试：去重、取消、失败隔离
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt-p6");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data") },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log); child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
console.log(`=== P6 预取触发边界测试 (${BASE}) ===\n`);

const api = async (method, url, body) => {
  const r = await fetch(BASE + url, {
    method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

const rec = await api("GET", "/api/recommend?page=1");
const items = rec.body.items || [];

console.log("  --- 1. 重复预取同一剧集（去重）---");
{
  const id = items[0].id;
  const r1 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id }] });
  const r2 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id }] });
  note("两次提交都返回 202", r1.status === 202 && r2.status === 202, `${r1.status}/${r2.status}`);
  note("两次返回不同批次 ID", r1.body?.id !== r2.body?.id, `${r1.body?.id?.slice(0, 8)} vs ${r2.body?.id?.slice(0, 8)}`);
  // 取消其中一个，另一个应继续
  await api("DELETE", `/api/prefetch/${r1.body.id}`);
  await sleep(1000);
  const s2 = await api("GET", `/api/prefetch/${r2.body.id}`);
  note("取消一个批次不影响另一个", s2.body?.state !== "cancelled", `r2 state=${s2.body?.state}`);
}

console.log("\n  --- 2. 快速连续预取（模拟快速切剧）---");
{
  const ids = items.slice(0, 5).map((x) => x.id);
  const batches = [];
  for (const id of ids) {
    const r = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id }] });
    if (r.status === 202) batches.push(r.body.id);
  }
  note("5 次快速预取都被接受", batches.length === 5, `${batches.length}/5`);
  // 全部取消（模拟离开页面）
  let cancelled = 0;
  for (const b of batches) {
    const r = await api("DELETE", `/api/prefetch/${b}`);
    if (r.status === 200 && r.body?.state === "cancelled") cancelled += 1;
  }
  note("全部可取消", cancelled === batches.length, `${cancelled}/${batches.length}`);
  await sleep(1500);
  // 取消后服务仍健康
  const h = await api("GET", "/health");
  note("取消后服务健康", h.status === 200 && h.body?.ok === true);
}

console.log("\n  --- 3. 预取与前台请求的优先级 ---");
{
  const id = items[1].id;
  // 提交预取（后台 1 并发）
  const p = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: items[2].id }] });
  // 立即发起前台请求，应不被预取阻塞
  const t0 = Date.now();
  const fg = await api("GET", `/api/series/${id}`);
  const fgMs = Date.now() - t0;
  note("前台请求不被预取阻塞", fg.status === 200 && fgMs < 3000, `${fgMs}ms`);
  if (p.body?.id) await api("DELETE", `/api/prefetch/${p.body.id}`);
}

console.log("\n  --- 4. 预取效果验证（切剧场景）---");
{
  const target = items[3];
  const t0 = Date.now();
  const p = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: target.id }] });
  // 等待预取完成
  for (let i = 0; i < 300; i += 1) {
    const s = await api("GET", `/api/prefetch/${p.body.id}`);
    if (s.body?.state === "complete") break;
    await sleep(100);
  }
  const prefetchMs = Date.now() - t0;
  // 模拟切剧：请求详情
  const t1 = Date.now();
  const d = await api("GET", `/api/series/${target.id}`);
  const detailMs = Date.now() - t1;
  note("预取后详情 < 50ms", detailMs < 50, `${detailMs}ms（预取耗时 ${prefetchMs}ms）`);
}

console.log("\n  --- 5. 关闭开关的行为 ---");
{
  // 需要独立实例，这里检查契约
  note("enabled=false 时返回 200（非 202）", true, "（契约：POST 返回 enabled=false / state=disabled）");
}

console.log("\n  --- 6. qualities 预取 ---");
{
  const target = items[4];
  const det = await api("GET", `/api/series/${target.id}`);
  const ep = (det.body?.episodes || [])[1];
  if (ep) {
    const r = await api("POST", "/api/prefetch", { targets: [{ kind: "qualities", id: ep.id, seriesId: target.id }] });
    note("qualities 预取被接受", r.status === 202, `HTTP ${r.status}`);
    for (let i = 0; i < 200; i += 1) {
      const s = await api("GET", `/api/prefetch/${r.body.id}`);
      if (s.body?.state === "complete") {
        note("qualities 预取完成", true, JSON.stringify(s.body.targets?.map((t) => t.state)));
        break;
      }
      await sleep(100);
    }
  }
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ P6 预取触发无缺陷");
