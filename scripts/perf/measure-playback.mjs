// 测量切集/切剧的关键路径耗时
// 目标：量化「自动下一集」与「切换短剧」各阶段的实际延迟
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
    const req = http.get(BASE + path, { headers: { Range: `bytes=0-${bytes - 1}` } }, (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        const buf = Buffer.concat(chunks);
        res({
          status: r.statusCode,
          bytes: buf.length,
          ftyp: buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp",
          ms: Date.now() - t0,
        });
      });
    });
    req.on("error", rej);
  });

const results = [];

console.log("=== 播放关键路径耗时测量 ===\n");

// 1. 推荐列表
const rec = await get("/api/recommend?page=1");
console.log(`  推荐接口          ${rec.ms} ms  (${(rec.body.items || []).length} 条)`);
results.push({ step: "推荐接口", ms: rec.ms });

const item = (rec.body.items || [])[0];
if (!item) { console.log("  无推荐数据"); process.exit(1); }

// 2. 详情（切剧时需要）
const det = await get(`/api/series/${item.id}`);
console.log(`  详情接口          ${det.ms} ms  (${(det.body.episodes || []).length} 集)`);
results.push({ step: "详情接口", ms: det.ms });

const eps = det.body.episodes || [];
const ep1 = eps[0];
const ep2 = eps[1];

// 3. 清晰度
const q1 = await get(`/api/episodes/${ep1.id}/qualities?seriesId=${item.id}`);
console.log(`  清晰度接口        ${q1.ms} ms  (${(q1.body.qualities || []).length} 档)`);
results.push({ step: "清晰度接口", ms: q1.ms });

// 4. 取流（首次，含解密索引）
const s1 = await rangeGet(`/api/episodes/${ep1.id}/stream?quality=720P&seriesId=${item.id}`);
console.log(`  取流（首次）      ${s1.ms} ms  HTTP ${s1.status} / ${s1.bytes}B / ftyp=${s1.ftyp}`);
results.push({ step: "取流首次", ms: s1.ms });

// 5. 取流（二次，走缓存）
const s2 = await rangeGet(`/api/episodes/${ep1.id}/stream?quality=720P&seriesId=${item.id}`);
console.log(`  取流（二次）      ${s2.ms} ms  HTTP ${s2.status} / ${s2.bytes}B`);
results.push({ step: "取流二次", ms: s2.ms });

// 6. 切到下一集：完整链路
console.log("\n  --- 切集链路（模拟自动下一集）---\n");

const t0 = Date.now();
const q2 = await get(`/api/episodes/${ep2.id}/qualities?seriesId=${item.id}`);
const tQualities = Date.now() - t0;
console.log(`  下一集清晰度      ${tQualities} ms  (${(q2.body.qualities || []).length} 档)`);

const t1 = Date.now();
const s3 = await rangeGet(`/api/episodes/${ep2.id}/stream?quality=720P&seriesId=${item.id}`);
const tStream = Date.now() - t1;
console.log(`  下一集取流        ${tStream} ms  HTTP ${s3.status} / ${s3.bytes}B / ftyp=${s3.ftyp}`);

const total = Date.now() - t0;
console.log(`  --- 切集合计: ${total} ms ---`);
results.push({ step: "切集合计", ms: total });

// 7. 切剧：推荐下一部
console.log("\n  --- 切剧链路（模拟自动切下一部）---\n");
const item2 = (rec.body.items || [])[1];
if (item2) {
  const t2 = Date.now();
  const det2 = await get(`/api/series/${item2.id}`);
  const tDet2 = Date.now() - t2;
  console.log(`  下一部详情        ${tDet2} ms  (${(det2.body.episodes || []).length} 集)`);

  const ep2b = (det2.body.episodes || [])[0];
  const t3 = Date.now();
  const q3 = await get(`/api/episodes/${ep2b.id}/qualities?seriesId=${item2.id}`);
  const tQ3 = Date.now() - t3;
  console.log(`  下一部清晰度      ${tQ3} ms  (${(q3.body.qualities || []).length} 档)`);

  const t4 = Date.now();
  const s4 = await rangeGet(`/api/episodes/${ep2b.id}/stream?quality=720P&seriesId=${item2.id}`);
  const tS4 = Date.now() - t4;
  console.log(`  下一部取流        ${tS4} ms  HTTP ${s4.status} / ${s4.bytes}B`);

  const totalSwitch = Date.now() - t2;
  console.log(`  --- 切剧合计: ${totalSwitch} ms ---`);
  results.push({ step: "切剧合计", ms: totalSwitch });
}

// 汇总
console.log("\n=== 耗时汇总 ===");
const sorted = [...results].sort((a, b) => b.ms - a.ms);
for (const r of sorted) {
  const bar = "█".repeat(Math.max(1, Math.round(r.ms / 100)));
  console.log(`  ${String(r.ms).padStart(6)} ms  ${r.step.padEnd(14)} ${bar}`);
}
