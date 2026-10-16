// 模拟真实切剧流程：用户操作时实际会发起哪些请求、总耗时多少
// 关键：区分「已缓存剧集」与「未缓存剧集」
import http from "node:http";

const BASE = "http://127.0.0.1:8788";
const get = (p) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => { let b = null; try { b = JSON.parse(d); } catch { b = d; } res({ ms: Date.now() - t0, body: b }); });
  }).on("error", rej);
});
const range = (p) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, { headers: { Range: "bytes=0-65535" } }, (r) => {
    const ch = [];
    r.on("data", (c) => ch.push(c));
    r.on("end", () => res({ ms: Date.now() - t0, status: r.statusCode, bytes: Buffer.concat(ch).length }));
  }).on("error", rej);
});

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

console.log("=== 真实切剧流程测量 ===\n");

// 获取推荐列表（模拟用户看到的推荐流）
const rec = await get("/api/recommend?page=1");
const items = (rec.body.items || []).slice(0, 6);
console.log(`  推荐列表: ${items.length} 部\n`);

// 场景 A：自动切到「已看过的」下一部（详情已缓存）
console.log("  --- 场景 A：切到已缓存的剧 ---");
const cachedDrama = items[0];
// 先预热
await get(`/api/series/${cachedDrama.id}`);
const a1 = await get(`/api/series/${cachedDrama.id}`);
const detA = a1.body;
const epA = (detA.episodes || [])[0];
const a2 = await get(`/api/episodes/${epA.id}/qualities?seriesId=${cachedDrama.id}`);
const a3 = await range(`/api/episodes/${epA.id}/stream?quality=720P&seriesId=${cachedDrama.id}`);
const totalA = a1.ms + a2.ms + a3.ms;
console.log(`    详情 ${a1.ms} + 清晰度 ${a2.ms} + 取流 ${a3.ms} = ${totalA} ms`);

// 场景 B：切到「没看过的」剧（详情未缓存）
console.log("\n  --- 场景 B：切到未缓存的剧 ---");
const results = [];
for (const it of items.slice(1)) {
  const d = await get(`/api/series/${it.id}`);
  if (d.ms < 100) continue; // 已缓存，跳过
  const ep = (d.body.episodes || [])[0];
  const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
  const s = await range(`/api/episodes/${ep.id}/stream?quality=720P&seriesId=${it.id}`);
  const total = d.ms + q.ms + s.ms;
  results.push({ title: (it.title || "").slice(0, 14), detail: d.ms, qual: q.ms, stream: s.ms, total });
  console.log(`    ${String(it.title || "").slice(0, 14).padEnd(16)} 详情 ${String(d.ms).padStart(4)} + 清晰度 ${String(q.ms).padStart(3)} + 取流 ${String(s.ms).padStart(3)} = ${total} ms`);
  if (results.length >= 4) break;
}

console.log("\n  === 汇总 ===");
console.log(`  场景 A（已缓存）: ${totalA} ms`);
if (results.length) {
  const avgB = sum(results.map((r) => r.total)) / results.length;
  console.log(`  场景 B（未缓存）: ${avgB.toFixed(0)} ms  (${results.length} 部平均)`);
  console.log(`    其中详情占: ${(sum(results.map((r) => r.detail)) / results.length).toFixed(0)} ms`);
}

console.log("\n  === 关键结论 ===");
console.log("  详情接口有 pageCache（TTL 180s），所以：");
console.log("    - 同一剧集 180 秒内重复访问 -> 快（1 ms）");
console.log("    - 首次访问 / 超过 180 秒 -> 慢（1-2.5 秒）");
console.log("");
console.log("  → 真正的优化点不是「加缓存」，而是「提前预取」");
console.log("     在用户看到列表时就后台预取下一部剧的详情");
