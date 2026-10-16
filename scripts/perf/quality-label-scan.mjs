// 广泛扫描：device_level=5 后有多少剧出现非标准档位标签
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

const STANDARD = new Set(["2160P", "1440P", "1080P", "720P", "576P", "540P", "480P", "360P"]);

console.log("=== 非标准档位标签扫描 ===\n");

// 收集大量剧集：推荐流多页 + 榜单
const dramas = new Map();
for (const page of [1, 2, 3]) {
  try {
    const r = await get(`${BASE}/api/recommend?page=${page}`);
    for (const it of r.items || []) dramas.set(it.id, it.title);
  } catch {}
}
// 榜单补充
try {
  const ranks = await get(`${BASE}/api/ranks`);
  for (const r of ranks.ranks || []) {
    for (const it of r.items || r.series || []) if (it.id) dramas.set(it.id, it.title);
  }
} catch {}

console.log(`  候选剧集: ${dramas.size} 部\n`);

let checked = 0, oddCount = 0, oneCount = 0, fiveCount = 0;
const oddSamples = [];
const distribution = new Map();

for (const [id, title] of [...dramas].slice(0, 30)) {
  try {
    const det = await get(`${BASE}/api/series/${id}`);
    const ep = (det.episodes || [])[0];
    if (!ep) continue;
    const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${id}`.length ? `${BASE}/api/episodes/${ep.id}/qualities?seriesId=${id}` : "");
    const keys = (q.qualities || []).map((x) => x.key);
    checked += 1;
    const keyStr = keys.join("/");
    distribution.set(keyStr, (distribution.get(keyStr) || 0) + 1);

    if (keys.length === 1) oneCount += 1;
    if (keys.length >= 4) fiveCount += 1;
    const odd = keys.filter((k) => !STANDARD.has(k));
    if (odd.length) {
      oddCount += 1;
      if (oddSamples.length < 8) oddSamples.push({ title, keys: keyStr });
    }
  } catch {}
}

console.log(`  检查 ${checked} 部`);
console.log(`  仅 1 档:      ${oneCount} 部`);
console.log(`  >=4 档:       ${fiveCount} 部`);
console.log(`  含非标准标签: ${oddCount} 部\n`);

if (oddSamples.length) {
  console.log("  === 非标准标签样本 ===");
  for (const s of oddSamples) console.log(`    ${String(s.title).slice(0, 22).padEnd(24)} ${s.keys}`);
}

console.log("\n  === 档位组合分布 ===");
for (const [k, v] of [...distribution].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`    ${String(v).padStart(3)} 部  ${k}`);
}

console.log("\n  === 判定 ===");
if (oddCount > 0) {
  console.log(`  ⚠ ${oddCount}/${checked} 部出现非标准档位标签（如 1924P）`);
  console.log("    → Q1 修复让档位齐全了，但部分剧的标签不是标准值");
  console.log("    → 需在 qualityNumber 增加「就近归一到标准档位」的逻辑");
} else {
  console.log("  ✓ 全部为标准档位标签");
}