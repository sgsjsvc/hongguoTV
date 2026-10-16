// 测量榜单/分类数据解析性能（用户提到的「算法效率」另一处）
// 这些接口涉及 HTML 解析，可能是算法瓶颈
import http from "node:http";

const BASE = "http://127.0.0.1:8788";
const get = (p) => new Promise((res, rej) => {
  const t0 = Date.now();
  http.get(BASE + p, (r) => {
    let d = "";
    r.on("data", (c) => (d += c));
    r.on("end", () => { let b = null; try { b = JSON.parse(d); } catch { b = d; } res({ ms: Date.now() - t0, body: b, status: r.statusCode }); });
  }).on("error", rej);
});

console.log("=== 榜单/分类数据解析性能 ===\n");

// 1. 榜单类型列表
const types = await get("/api/rank/types");
console.log(`  榜单类型      ${String(types.ms).padStart(5)} ms  ${(types.body.types || types.body || []).length ?? "?"} 项`);

// 2. 榜单各页
console.log("\n  榜单分页（每页 20 条）:");
const rankSlug = (types.body.types || types.body || [])[0];
const slug = typeof rankSlug === "object" ? (rankSlug.slug || rankSlug.id || rankSlug.key) : rankSlug;
for (let p = 1; p <= 3; p += 1) {
  const r = await get(`/api/rank/list?type=${encodeURIComponent(slug)}&page=${p}`);
  const n = (r.body.items || r.body.list || []).length;
  console.log(`    p${p}: ${String(r.ms).padStart(5)} ms  ${n} 条`);
}

// 3. 分类类型与标签
const catTypes = await get("/api/category/types");
console.log(`\n  分类类型      ${String(catTypes.ms).padStart(5)} ms  ${(catTypes.body.types || catTypes.body || []).length ?? "?"} 项`);

const tags = await get("/api/category/tags?type=real-drama");
console.log(`  分类标签      ${String(tags.ms).padStart(5)} ms  ${(tags.body.tags || tags.body || []).length ?? "?"} 项`);

// 4. 分类分页
console.log("\n  分类分页（每页 24 条）:");
for (let p = 1; p <= 3; p += 1) {
  const r = await get(`/api/category/list?type=real-drama&page=${p}`);
  const n = (r.body.items || []).length;
  const total = r.body.totalPages ?? "?";
  console.log(`    p${p}: ${String(r.ms).padStart(5)} ms  ${n} 条  总页数=${total}`);
}

// 5. 对比：这些是否值得优化
console.log("\n  === 判定 ===");
const all = [types.ms, catTypes.ms, tags.ms];
const avg = all.reduce((a, b) => a + b, 0) / all.length;
console.log(`  元数据接口平均: ${avg.toFixed(0)} ms`);
console.log(`  对比详情接口:   1453 ms（未缓存）`);
console.log("");
if (avg < 200) {
  console.log("  ✓ 元数据接口很快，非瓶颈");
} else {
  console.log("  ⚠ 元数据接口偏慢，值得关注");
}
