// 基准测试：推荐算法 append() 的 CPU 成本
// 目的：确认算法是否成为瓶颈（还是被网络 IO 掩盖）
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../../shared/recommendation-core.cjs");
const { RecommendationSession, TYPES } = core;

function makeRows(n) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      id: String(1000000000000000000n + BigInt(i)),
      title: "测试剧集" + i,
      tags: "短剧/爱情/都市",
      contentType: TYPES[i % TYPES.length],
      source: ["hot", "discovery", "latest", "topic"][i % 4],
      badge: "全" + (50 + i) + "集",
      cover: "https://example.com/" + i + ".jpg",
    });
  }
  return rows;
}

console.log("=== 推荐算法 append() 基准 ===\n");
console.log(`  内容类型: ${TYPES.join(", ")}\n`);

for (const poolSize of [24, 128, 512]) {
  const rows = makeRows(poolSize);
  const session = new RecommendationSession({ seed: "bench-" + poolSize, now: Date.now(), mode: "mixed", profile: {} });

  // 预热
  session.append(rows, 24);

  const session2 = new RecommendationSession({ seed: "bench2-" + poolSize, now: Date.now(), mode: "mixed", profile: {} });
  const t0 = process.hrtime.bigint();
  const N = 100;
  for (let i = 0; i < N; i += 1) {
    const s = new RecommendationSession({ seed: "s" + i, now: Date.now(), mode: "mixed", profile: {} });
    s.append(rows, 24);
  }
  const t1 = process.hrtime.bigint();
  const perCall = Number(t1 - t0) / 1e6 / N;
  console.log(`  池 ${String(poolSize).padStart(3)} 条  ->  ${perCall.toFixed(2)} ms/次  (${N} 次平均)`);
}

console.log("\n=== 对比：网络耗时 ===\n");
console.log("  推荐首屏（含网络拉池）  2514 ms");
console.log("  推荐翻页（池内取）      2 ms");

console.log("\n=== 判定 ===");
console.log("  若 append 单次 < 5 ms，则算法不是瓶颈，瓶颈在网络 IO");
console.log("  若 append 单次 > 20 ms，则算法值得优化");
