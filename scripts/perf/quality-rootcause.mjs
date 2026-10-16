// 根因定位：dump 上游原始 video_list，对比 1 档与 5 档的差异
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

console.log("=== 上游原始响应对比 ===\n");

// 通过 vm 加载引擎（与 custom-server 相同方式）
import vm from "node:vm";
import crypto from "node:crypto";
import axios from "axios";

const source = fs.readFileSync("shared/content-core/hongguo.js", "utf8");
const context = vm.createContext({
  require: (name) => { if (name === "node:crypto") return crypto; throw new Error("Unsupported: " + name); },
  Buffer, URL, URLSearchParams,
  axios: axios.create({ maxContentLength: 16 * 1024 * 1024, maxBodyLength: 1024 * 1024 }),
  console,
});
vm.runInContext(source + "\nthis.api = {fetchVideoInfo, resolveStream, qualityLabel, qualityNumber, prepareHeader, remoteRange, decryptPartial, rankData, upstreamStats};", context, { timeout: 10000 });
const api = context.api;
console.log(`  引擎导出: ${Object.keys(api).join(", ")}\n`);

// 取推荐流
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

// 需要一个服务来取剧集列表；直接用引擎的 rankData 或手动请求
// 简化：用已有服务
const BASE = process.env.BASE || "http://127.0.0.1:8788";
let rec;
try {
  rec = await get(`${BASE}/api/recommend?page=1`);
} catch (e) {
  console.log("  需要先启动服务（node custom-server/index.mjs）");
  console.log("  " + e.message);
  process.exit(0);
}

const items = (rec.items || []).slice(0, 4);
console.log(`  测试 ${items.length} 部剧\n`);

for (const it of items) {
  const det = await get(`${BASE}/api/series/${it.id}`);
  const eps = det.episodes || [];
  console.log(`  === ${(it.title || "").slice(0, 24)} (${eps.length} 集) ===`);

  // 找 1 档和 5 档的集各一个
  const buckets = { one: null, five: null };
  for (let i = 0; i < Math.min(8, eps.length); i += 1) {
    const q = await get(`${BASE}/api/episodes/${eps[i].id}/qualities?seriesId=${it.id}`);
    const n = (q.qualities || []).length;
    if (n === 1 && !buckets.one) buckets.one = { i, ep: eps[i], q };
    if (n >= 4 && !buckets.five) buckets.five = { i, ep: eps[i], q };
    if (buckets.one && buckets.five) break;
  }

  for (const [label, b] of [["1档", buckets.one], ["5档", buckets.five]]) {
    if (!b) { console.log(`    ${label}: 未找到`); continue; }
    console.log(`    ${label} (第 ${b.i + 1} 集, id=${b.ep.id}):`);
    for (const q of b.q.qualities || []) {
      console.log(`      ${q.key.padEnd(8)} ${String(q.codec).padEnd(8)} rawKey=${q.rawKey} num=${q.qualityNum}`);
    }
    // 直接问引擎要原始 rows
    try {
      const info = await api.fetchVideoInfo(b.ep.id);
      console.log(`      引擎 rows 数: ${(info.rows || []).length}`);
      const vl = info.info?.video_list || {};
      console.log(`      上游 video_list 键: ${Object.keys(vl).join(", ") || "(空)"}`);
      for (const [k, v] of Object.entries(vl)) {
        const hasMain = !!(v && v.main_url);
        const hasBackup = !!(v && v.backup_url);
        console.log(`        ${k.padEnd(10)} main_url=${hasMain ? "✓" : "✗"} backup_url=${hasBackup ? "✓" : "✗"} vheight=${v?.vheight} codec=${v?.codec_type}`);
      }
    } catch (e) {
      console.log(`      引擎调用失败: ${e.message.slice(0, 60)}`);
    }
  }
  console.log("");
}

console.log("  === 判定 ===");
console.log("  若 1 档集的 video_list 只有 1 个键（或有 main_url 的只有 1 个），");
console.log("  则上游确实对该集只提供 1 档 -> 非我们的缺陷");
console.log("  若 1 档集的 video_list 有 5 个键但只有 1 个有 main_url，");
console.log("  则可能是解析或设备标识问题");
