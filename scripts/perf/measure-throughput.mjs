// 测量播放流畅度关键指标：代理吞吐量、分块延迟、缓冲健康度
// 视频经本地代理解密，代理性能直接决定播放流畅度
import http from "node:http";

const BASE = "http://127.0.0.1:8788";

const rangeReq = (path, start, end) =>
  new Promise((res, rej) => {
    const t0 = Date.now();
    const req = http.get(BASE + path, { headers: { Range: `bytes=${start}-${end}` } }, (r) => {
      let firstByteAt = null;
      const chunks = [];
      r.on("data", (c) => {
        if (firstByteAt === null) firstByteAt = Date.now() - t0;
        chunks.push(c);
      });
      r.on("end", () => {
        const buf = Buffer.concat(chunks);
        res({
          status: r.statusCode,
          bytes: buf.length,
          totalMs: Date.now() - t0,
          ttfb: firstByteAt ?? Date.now() - t0,
          contentRange: r.headers["content-range"],
        });
      });
    });
    req.on("error", rej);
  });

const get = (p) => new Promise((res, rej) => {
  http.get(BASE + p, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d))); }).on("error", rej);
});

console.log("=== 播放流畅度关键指标 ===\n");

const rec = await get("/api/recommend?page=1");
const item = (rec.items || [])[0];
const det = await get(`/api/series/${item.id}`);
const ep = (det.episodes || [])[0];
const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${item.id}`);
const quality = q.qualities?.[0]?.key || "720P";

console.log(`  剧集: ${(item.title || "").slice(0, 16)}`);
console.log(`  清晰度: ${quality}\n`);

const path = `/api/episodes/${ep.id}/stream?quality=${encodeURIComponent(quality)}&seriesId=${item.id}`;

// 1. 首块延迟（用户点播放到出画面）
console.log("  --- 1. 首块延迟（点播放到有数据）---");
const first = await rangeReq(path, 0, 65535);
console.log(`     TTFB ${first.ttfb} ms  总耗时 ${first.totalMs} ms  ${first.bytes}B`);
console.log(`     Content-Range: ${first.contentRange}`);

// 2. 连续分块吞吐（模拟播放器顺序读取）
console.log("\n  --- 2. 连续分块（模拟顺序播放）---");
const CHUNK = 512 * 1024; // 512KB
let totalBytes = 0;
let totalMs = 0;
const blocks = [];
for (let i = 0; i < 5; i += 1) {
  const start = i * CHUNK;
  const r = await rangeReq(path, start, start + CHUNK - 1);
  blocks.push(r);
  totalBytes += r.bytes;
  totalMs += r.totalMs;
  const mbps = ((r.bytes * 8) / (r.totalMs / 1000) / 1e6).toFixed(1);
  console.log(`     块${i + 1}: ${String(r.totalMs).padStart(5)} ms  ${(r.bytes / 1024).toFixed(0)}KB  ${mbps} Mbps  TTFB ${r.ttfb} ms`);
}

const avgMbps = ((totalBytes * 8) / (totalMs / 1000) / 1e6).toFixed(1);
console.log(`\n     平均吞吐: ${avgMbps} Mbps`);
console.log(`     总耗时: ${totalMs} ms  总字节: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

// 3. 并发分块（模拟播放器预读）
console.log("\n  --- 3. 并发分块（模拟预读）---");
const t0 = Date.now();
const concurrent = await Promise.all([
  rangeReq(path, 5 * CHUNK, 6 * CHUNK - 1),
  rangeReq(path, 6 * CHUNK, 7 * CHUNK - 1),
  rangeReq(path, 7 * CHUNK, 8 * CHUNK - 1),
]);
const concMs = Date.now() - t0;
console.log(`     3 并发: ${concMs} ms  (单个 ${concurrent.map((c) => c.totalMs).join("/")} ms)`);
const concMbps = ((concurrent.reduce((a, c) => a + c.bytes, 0) * 8) / (concMs / 1000) / 1e6).toFixed(1);
console.log(`     并发吞吐: ${concMbps} Mbps`);

// 4. 判定：是否满足流畅播放
console.log("\n  === 判定：能否流畅播放 ===\n");
const bitrateAssumption = { "1080P": 3.0, "720P": 1.5, "540P": 1.0, "480P": 0.7, "360P": 0.5 };
const needed = bitrateAssumption[quality] || 2.0;
console.log(`  ${quality} 典型码率: ~${needed} Mbps`);
console.log(`  实测吞吐:     ${avgMbps} Mbps`);
console.log(`  余量:         ${(avgMbps / needed).toFixed(1)}x`);
console.log("");
if (Number(avgMbps) > needed * 2) {
  console.log("  ✓ 吞吐充足（>2x 码率），播放应流畅");
} else if (Number(avgMbps) > needed) {
  console.log("  ⚠ 吞吐勉强够用（1-2x 码率），高峰期可能卡顿");
} else {
  console.log("  ✗ 吞吐不足，会频繁缓冲");
}

console.log("\n  === 关注点 ===");
console.log(`  首块 TTFB: ${first.ttfb} ms  ${first.ttfb < 500 ? "✓ 可接受" : "⚠ 偏慢，用户点播放到出画面会有延迟"}`);
console.log(`  单块 TTFB: ${blocks.map((b) => b.ttfb).join("/")} ms`);
