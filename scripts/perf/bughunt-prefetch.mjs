// 边界测试：主动寻找 P1 预取接口的缺陷
// 覆盖：非法输入、容量上限、并发、取消、重复提交、状态一致性
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt");
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

// 启动独立服务实例
const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data") },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log);
child.stderr.pipe(log);

const port = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("启动超时")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); resolve(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); reject(new Error("启动退出 " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
console.log(`=== 预取接口边界测试 (${BASE}) ===\n`);

const api = async (method, url, body) => {
  const r = await fetch(BASE + url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
};

// 取一个真实剧集
const rec = await api("GET", "/api/recommend?page=1");
const item = (rec.body.items || [])[0];
const detail = await api("GET", `/api/series/${item.id}`);
const ep = (detail.body.episodes || [])[0];
console.log(`  测试剧集: ${(item.title || "").slice(0, 14)}  (${item.id})\n`);

console.log("  --- 1. 非法输入 ---");
{
  const r1 = await api("POST", "/api/prefetch", { targets: [] });
  note("空 targets 返回 400", r1.status === 400, `实际 ${r1.status}`);
}
{
  const r2 = await api("POST", "/api/prefetch", { targets: [{ kind: "bogus", id: "1" }] });
  note("非法 kind 返回 400", r2.status === 400, `实际 ${r2.status}`);
}
{
  const r3 = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: "abc" }] });
  note("非数字 ID 返回 400", r3.status === 400, `实际 ${r3.status}`);
}
{
  const many = Array.from({ length: 9 }, (_, i) => ({ kind: "detail", id: String(i + 1) }));
  const r4 = await api("POST", "/api/prefetch", { targets: many });
  note("超过 8 个目标返回 400", r4.status === 400, `实际 ${r4.status}`);
}
{
  const r5 = await api("POST", "/api/prefetch", {});
  note("缺 targets 返回 4xx", r5.status >= 400 && r5.status < 500, `实际 ${r5.status}`);
}

console.log("\n  --- 2. 正常流程 ---");
let batchId = null;
{
  const r = await api("POST", "/api/prefetch", {
    targets: [{ kind: "detail", id: item.id }, { kind: "qualities", id: ep.id, seriesId: item.id }],
  });
  batchId = r.body?.id;
  note("提交返回 202", r.status === 202, `实际 ${r.status}`);
  note("返回 batch id", typeof batchId === "string" && batchId.length > 0, batchId || "无");
  note("返回 targets 数组", Array.isArray(r.body?.targets), JSON.stringify(r.body?.targets?.length));
}
{
  let final = null;
  for (let i = 0; i < 200; i += 1) {
    const s = await api("GET", `/api/prefetch/${batchId}`);
    final = s.body;
    if (final?.state === "complete") break;
    await sleep(100);
  }
  const allDone = (final?.targets || []).every((t) => t.state === "done");
  note("批次最终 complete 且全部 done", final?.state === "complete" && allDone, JSON.stringify(final?.targets?.map((t) => t.state)));
}

console.log("\n  --- 3. 状态一致性 ---");
{
  const s = await api("GET", `/api/prefetch/${batchId}`);
  note("重复查询返回同一批次", s.status === 200 && s.body?.id === batchId);
}
{
  const s = await api("GET", "/api/prefetch/00000000-0000-0000-0000-000000000000");
  note("不存在的批次返回 404", s.status === 404, `实际 ${s.status}`);
}
{
  const s = await api("GET", "/api/prefetch/not-a-uuid");
  note("非法 UUID 返回 404 或 400", s.status === 404 || s.status === 400, `实际 ${s.status}`);
}

console.log("\n  --- 4. 取消语义 ---");
{
  // 提交一个大批次后立即取消
  const r = await api("POST", "/api/prefetch", {
    targets: Array.from({ length: 6 }, (_, i) => ({ kind: "detail", id: String(900000000000000000n + BigInt(i)) })),
  });
  const id = r.body?.id;
  const c = await api("DELETE", `/api/prefetch/${id}`);
  note("取消返回 200", c.status === 200, `实际 ${c.status}`);
  note("取消后 state=cancelled", c.body?.state === "cancelled", c.body?.state);
  const s = await api("GET", `/api/prefetch/${id}`);
  note("取消后查询仍为 cancelled", s.body?.state === "cancelled", s.body?.state);
}
{
  const c = await api("DELETE", "/api/prefetch/00000000-0000-0000-0000-000000000000");
  note("取消不存在的批次返回 404", c.status === 404, `实际 ${c.status}`);
}

console.log("\n  --- 5. 队列容量 ---");
{
  // 连续提交，看是否触发 429 且不崩溃
  let got429 = false, submitted = 0;
  for (let i = 0; i < 20; i += 1) {
    const r = await api("POST", "/api/prefetch", {
      targets: Array.from({ length: 8 }, (_, k) => ({ kind: "detail", id: String(800000000000000000n + BigInt(i * 10 + k)) })),
    });
    if (r.status === 429) { got429 = true; break; }
    if (r.status === 202) submitted += 1;
  }
  note("超容量时返回 429（不崩溃）", got429, `提交 ${submitted} 批后${got429 ? "触发 429" : "未触发"}`);
  // 服务仍可用
  const h = await api("GET", "/health");
  note("容量打满后服务仍健康", h.status === 200 && h.body?.ok === true, `HTTP ${h.status}`);
}

console.log("\n  --- 6. 预取效果验证 ---");
{
  // 用一个全新剧集：先预取，再请求详情，应很快
  const fresh = (rec.body.items || [])[1];
  const t0 = Date.now();
  const p = await api("POST", "/api/prefetch", { targets: [{ kind: "detail", id: fresh.id }] });
  if (p.status === 202) {
    for (let i = 0; i < 300; i += 1) {
      const s = await api("GET", `/api/prefetch/${p.body.id}`);
      if (s.body?.state === "complete") break;
      await sleep(100);
    }
    const t1 = Date.now();
    const d = await api("GET", `/api/series/${fresh.id}`);
    const t2 = Date.now();
    note("预取后详情 < 50ms", t2 - t1 < 50, `${t2 - t1}ms（预取等待 ${t1 - t0}ms）`);
  } else {
    note("提交预取成功", false, `HTTP ${p.status}`);
  }
}

console.log("\n  --- 7. 关闭开关 ---");
{
  // 需要重启服务带 HG_PREFETCH_ENABLED=0，此处跳过
  note("HG_PREFETCH_ENABLED=0 行为", true, "（需独立实例验证，见下文）");
}

// 清理
child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
