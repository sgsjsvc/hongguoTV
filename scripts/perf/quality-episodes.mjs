// 决定性测试：同一部剧的不同集，清晰度档位数是否不同？
// 假设：推荐页播第 1 集（可能只有 1080P），播放页从历史续播到别的集（有全部档位）
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/quality-episodes");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data"), HG_PREFETCH_ENABLED: "0" },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log); child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
const get = async (url) => {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

console.log(`=== 同剧不同集的清晰度档位 (${BASE}) ===\n`);

const rec = await get("/api/recommend?page=1");
const items = (rec.body.items || []).slice(0, 5);

for (const it of items) {
  const det = await get(`/api/series/${it.id}`);
  const eps = det.body?.episodes || [];
  if (!eps.length) continue;

  // 采样：第 1、2、3、5、10、20 集
  const sampleIdx = [0, 1, 2, 4, 9, 19].filter((i) => i < eps.length);
  const line = [];
  for (const i of sampleIdx) {
    const q = await get(`/api/episodes/${eps[i].id}/qualities?seriesId=${it.id}`);
    const n = (q.body?.qualities || []).length;
    line.push(`ep${i + 1}=${n}`);
  }

  const nums = line.map((x) => Number(x.split("=")[1]));
  const varies = new Set(nums).size > 1;
  console.log(`  ${(it.title || "").slice(0, 22).padEnd(24)} ${line.join("  ")}  ${varies ? "⚠ 集间不同" : "✓ 一致"}`);
}

console.log("\n  === 再验证：同一集连续请求是否稳定 ===");
{
  const it = items[0];
  const det = await get(`/api/series/${it.id}`);
  const ep = (det.body?.episodes || [])[0];
  const seq = [];
  for (let i = 0; i < 6; i += 1) {
    const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
    seq.push((q.body?.qualities || []).length);
    await sleep(500);
  }
  console.log(`  ${it.title.slice(0, 20)} ep1 连续 6 次: ${seq.join(", ")}  ${new Set(seq).size === 1 ? "✓ 稳定" : "✗ 不稳定"}`);
}

console.log("\n  === 换新实例（清空所有缓存）后再测同一集 ===");
child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();

// 用全新数据目录重启（彻底清缓存）
const out2 = path.resolve("outputs/testing/quality-episodes-fresh");
fs.mkdirSync(out2, { recursive: true });
const log2 = fs.createWriteStream(path.join(out2, "server.log"));
const child2 = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out2, "data"), HG_PREFETCH_ENABLED: "0" },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child2.stdout.pipe(log2); child2.stderr.pipe(log2);
const port2 = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child2.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child2.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE2 = `http://127.0.0.1:${port2}`;
const get2 = async (url) => {
  const r = await fetch(BASE2 + url, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

// 用同样的剧集列表（推荐流可能不同，但取前几部）
const rec2 = await get2("/api/recommend?page=1");
const items2 = (rec2.body.items || []).slice(0, 3);
for (const it of items2) {
  const det = await get2(`/api/series/${it.id}`);
  const ep = (det.body?.episodes || [])[0];
  if (!ep) continue;
  const q = await get2(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
  const n = (q.body?.qualities || []).length;
  console.log(`  ${(it.title || "").slice(0, 22).padEnd(24)} ep1 全新实例=${n} 档`);
}

child2.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child2.once("exit", r)), sleep(6000)]);
if (child2.exitCode === null) child2.kill();
log2.end();
