// 深入测量：区分「首次冷启动」与「稳态」耗时，定位真正的优化空间
import http from "node:http";

const BASE = "http://127.0.0.1:8788";

const get = (path) =>
  new Promise((res, rej) => {
    const t0 = Date.now();
    http.get(BASE + path, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        let body = null;
        try { body = JSON.parse(d); } catch { body = d; }
        res({ status: r.statusCode, body, ms: Date.now() - t0 });
      });
    }).on("error", rej);
  });

const rangeGet = (path, bytes = 65536) =>
  new Promise((res, rej) => {
    const t0 = Date.now();
    http.get(BASE + path, { headers: { Range: `bytes=0-${bytes - 1}` } }, (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => res({ status: r.statusCode, bytes: Buffer.concat(chunks).length, ms: Date.now() - t0 }));
    }).on("error", rej);
  });

console.log("=== 冷/热对比与并发能力 ===\n");

// 1. 推荐接口：同一 session 的翻页（第 2 页应更快，因为数据池已加载）
const session = "perf-test-" + Date.now();
const p1 = await get(`/api/recommend?page=1&session=${session}`);
console.log(`  推荐 p1（冷，拉数据池）  ${p1.ms} ms`);
const p2 = await get(`/api/recommend?page=2&session=${session}`);
console.log(`  推荐 p2（热，池内取）    ${p2.ms} ms`);
const p3 = await get(`/api/recommend?page=3&session=${session}`);
console.log(`  推荐 p3（热）            ${p3.ms} ms`);

// 2. 详情接口：不同集数的剧
const rec = await get("/api/recommend?page=1");
const items = (rec.body.items || []).slice(0, 6);
console.log("\n  详情接口（按集数）");
for (const it of items) {
  const d = await get(`/api/series/${it.id}`);
  const n = (d.body.episodes || []).length;
  console.log(`    ${String(n).padStart(3)} 集  ${String(d.ms).padStart(5)} ms  ${String(it.title || "").slice(0, 14)}`);
}

// 3. 取流并发能力（切集时可能有多个请求）
console.log("\n  取流并发（同时请求 3 个不同集）");
const det = await get(`/api/series/${items[0].id}`);
const eps = (det.body.episodes || []).slice(0, 3);
const t0 = Date.now();
const results = await Promise.all(
  eps.map((e) => rangeGet(`/api/episodes/${e.id}/stream?quality=720P&seriesId=${items[0].id}`, 65536))
);
const concurrent = Date.now() - t0;
console.log(`    3 个并发: ${concurrent} ms  (状态 ${results.map((r) => r.status).join(",")})`);

// 4. 同一集重复请求（缓存命中）
console.log("\n  同一集重复请求（缓存效果）");
const e0 = eps[0];
for (let i = 1; i <= 3; i += 1) {
  const r = await rangeGet(`/api/episodes/${e0.id}/stream?quality=720P&seriesId=${items[0].id}`, 65536);
  console.log(`    第 ${i} 次: ${String(r.ms).padStart(4)} ms`);
}

// 5. 清晰度接口（切集时必调）
console.log("\n  清晰度接口（切集时必调）");
for (let i = 0; i < 3; i += 1) {
  const e = eps[i];
  const q = await get(`/api/episodes/${e.id}/qualities?seriesId=${items[0].id}`);
  console.log(`    第 ${i + 1} 集: ${String(q.ms).padStart(4)} ms  ${(q.body.qualities || []).length} 档`);
}
