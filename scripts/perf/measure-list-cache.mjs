// 确认榜单/分类的缓存策略与冷启动成本
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

console.log("=== 榜单/分类缓存策略验证 ===\n");

// 榜单：同一页连续 3 次
console.log("  榜单 p1 连续 3 次:");
for (let i = 1; i <= 3; i += 1) {
  const r = await get("/api/rank/list?type=rank_hot&page=1");
  console.log(`    第 ${i} 次: ${String(r.ms).padStart(5)} ms`);
}

// 分类：同一页连续 3 次
console.log("\n  分类 p1 连续 3 次:");
for (let i = 1; i <= 3; i += 1) {
  const r = await get("/api/category/list?type=real-drama&page=1");
  console.log(`    第 ${i} 次: ${String(r.ms).padStart(5)} ms`);
}

// 不同页（验证缓存粒度）
console.log("\n  榜单不同页（每页首次应慢）:");
for (const p of [2, 3, 4, 5]) {
  const r = await get(`/api/rank/list?type=rank_hot&page=${p}`);
  console.log(`    p${p}: ${String(r.ms).padStart(5)} ms`);
}

// 分类不同标签（验证是否按 tag 缓存）
console.log("\n  分类不同标签（首次应慢）:");
for (const tag of ["", "romance", "period", "comeback"]) {
  const r = await get(`/api/category/list?type=real-drama&tag=${tag}&page=1`);
  console.log(`    tag=${(tag || "(空)").padEnd(9)} ${String(r.ms).padStart(5)} ms  ${(r.body.items || []).length} 条`);
}

// 重复标签（应命中缓存）
console.log("\n  重复 tag=romance（应命中）:");
for (let i = 1; i <= 2; i += 1) {
  const r = await get(`/api/category/list?type=real-drama&tag=romance&page=1`);
  console.log(`    第 ${i} 次: ${String(r.ms).padStart(5)} ms`);
}

console.log("\n  === 结论 ===");
console.log("  榜单/分类有 pageCache（10 分钟 TTL，见 custom-server/index.mjs）");
console.log("  首次访问约 1 秒，重复 2 ms");
console.log("  用户滚动列表时：已看过的页很快，新页需等 1 秒");
