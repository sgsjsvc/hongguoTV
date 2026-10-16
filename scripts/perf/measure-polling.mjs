// 测量 refreshLibrary 的每秒轮询开销
// 发现：api.ts:72 有 setInterval(refreshLibrary, 1000)
import http from "node:http";

const BASE = "http://127.0.0.1:8788";
const get = (p) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => res({ ms: Date.now() - t0, bytes: Buffer.byteLength(d), status: r.statusCode }));
  }).on("error", rej);
});

console.log("=== refreshLibrary 轮询开销测量 ===\n");
console.log("  来源：apps/web-pc/src/api.ts:72");
console.log('  setInterval(() => void refreshLibrary().catch(() => {}), 1000);\n');

// /api/library 的实际耗时
console.log("  /api/library 连续 10 次：");
const times = [];
const sizes = [];
for (let i = 0; i < 10; i += 1) {
  const r = await get("/api/library");
  times.push(r.ms);
  sizes.push(r.bytes);
  await new Promise((res) => setTimeout(res, 200));
}
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const max = Math.max(...times);
const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

console.log(`    平均 ${avg.toFixed(0)} ms  最大 ${max} ms  平均响应 ${(avgSize / 1024).toFixed(1)} KB`);

console.log("\n  === 每秒轮询的影响 ===");
console.log(`    单次请求: ${avg.toFixed(0)} ms`);
console.log(`    频率:     1 次/秒`);
console.log(`    每秒带宽: ${(avgSize / 1024).toFixed(1)} KB/s = ${((avgSize * 8) / 1e6).toFixed(2)} Mbps`);
console.log(`    每小时:   ${((avgSize * 3600) / 1024 / 1024).toFixed(1)} MB`);
console.log(`    每天:     ${((avgSize * 86400) / 1024 / 1024).toFixed(0)} MB`);

console.log("\n  === 潜在问题 ===");
console.log("    1. 即使无数据变化也每秒请求一次");
console.log("    2. 播放视频时，这个轮询与视频流争用连接");
console.log("    3. 响应体包含完整 library（收藏+历史+偏好），随数据增长而变大");
console.log("    4. 移动端/流量受限场景会持续消耗流量");

console.log("\n  === 对比：视频播放的实际需求 ===");
console.log("    1080P 码率约 3 Mbps");
console.log(`    轮询占用    ${((avgSize * 8) / 1e6).toFixed(2)} Mbps`);
console.log(`    占比        ${(((avgSize * 8) / 1e6 / 3) * 100).toFixed(1)}%`);
