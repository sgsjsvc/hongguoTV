// 独立验证：样本 3（...7470312473）的 11614ms 取流是否为稳定现象
import http from "node:http";

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const ID = process.argv[2] || "7691647607470312473";
const ROUNDS = Number(process.argv[3] || 3);

const get = (p) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, (r) => {
    let d = ""; r.on("data", (c) => (d += c));
    r.on("end", () => { let b = null; try { b = JSON.parse(d); } catch { b = d; } res({ ms: Date.now() - t0, body: b, status: r.statusCode }); });
  }).on("error", rej);
});
const range = (p, bytes = 65536) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, { headers: { Range: `bytes=0-${bytes - 1}` } }, (r) => {
    let ttfb = null; const ch = [];
    r.on("data", (c) => { if (ttfb === null) ttfb = Date.now() - t0; ch.push(c); });
    r.on("end", () => res({ status: r.statusCode, bytes: Buffer.concat(ch).length, totalMs: Date.now() - t0, ttfb }));
  }).on("error", rej);
});

console.log(`=== 异常样本独立验证 ===\n`);
console.log(`  剧集 ID: ${ID}`);
console.log(`  ${ROUNDS} 轮测量\n`);

for (let i = 1; i <= ROUNDS; i += 1) {
  const det = await get(`/api/series/${ID}`);
  const ep = (det.body.episodes || [])[0];
  if (!ep) { console.log(`  第 ${i} 轮: 无剧集`); continue; }

  const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${ID}`);
  const quality = q.body.qualities?.[0]?.key || "720P";

  const s = await range(`/api/episodes/${ep.id}/stream?quality=${encodeURIComponent(quality)}&seriesId=${ID}`);
  console.log(`  第 ${i} 轮: 详情 ${det.ms}ms  清晰度 ${q.ms}ms  取流 ${s.totalMs}ms (TTFB ${s.ttfb}ms, ${(s.bytes / 1024).toFixed(0)}KB)`);

  await new Promise((r) => setTimeout(r, 1000));
}

console.log("\n  === 判定 ===");
console.log("  若多轮均慢 -> 该剧集本身问题（大文件/上游限流）");
console.log("  若多轮均快 -> 之前是瞬时抖动（网络/上游）");
