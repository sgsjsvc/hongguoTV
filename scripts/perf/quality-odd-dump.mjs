// 扫描并 dump 非标准档位的原始上游字段
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import axios from "axios";

const source = fs.readFileSync("shared/content-core/hongguo.js", "utf8");
const context = vm.createContext({
  require: (n) => { if (n === "node:crypto") return crypto; throw new Error("unsupported " + n); },
  Buffer, URL, URLSearchParams,
  axios: axios.create({ maxContentLength: 16 * 1024 * 1024, maxBodyLength: 1024 * 1024 }),
  console,
});
vm.runInContext(
  source + "\nthis.api = {fetchVideoInfo, qualityNumber, modelForVideo, parseFallback, jsonBody, getText, freshDevice, signedVideoRequest};",
  context, { timeout: 10000 }
);
const api = context.api;

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

const STANDARD = new Set(["2160P", "1440P", "1080P", "720P", "576P", "540P", "480P", "360P"]);

console.log("=== 扫描并 dump 非标准档位 ===\n");

const seen = new Set();
let found = 0;
let normal = null;

for (const page of [1, 2, 3, 4, 5]) {
  if (found >= 2) break;
  let rec;
  try { rec = await get(`${BASE}/api/recommend?page=${page}`); } catch { continue; }
  for (const it of rec.items || []) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    if (found >= 2) break;

    try {
      const det = await get(`${BASE}/api/series/${it.id}`);
      const ep = (det.episodes || [])[0];
      if (!ep) continue;
      const q = await get(`${BASE}/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
      const keys = (q.qualities || []).map((x) => x.key);
      const odd = keys.filter((k) => !STANDARD.has(k));

      if (odd.length === 0) {
        if (!normal && keys.length >= 4) normal = { it, ep, keys };
        continue;
      }

      found += 1;
      console.log(`  [非标准] ${it.title}`);
      console.log(`    服务端档位: ${keys.join("/")}`);
      const info = await api.fetchVideoInfo(ep.id);
      console.log(`    引擎 rows (${info.rows.length}):`);
      for (const row of info.rows) {
        const r = row.item || {};
        console.log(`      key=${String(row.key).padEnd(9)} quality=${String(row.quality).padEnd(10)} vheight=${String(r.vheight).padEnd(6)} vwidth=${String(r.vwidth).padEnd(6)} quality_desc=${JSON.stringify(r.quality_desc)} definition=${JSON.stringify(r.definition)}`);
      }
      console.log("");
    } catch {}
  }
}

if (normal) {
  console.log(`  [对照-标准] ${normal.it.title}`);
  console.log(`    服务端档位: ${normal.keys.join("/")}`);
  try {
    const info = await api.fetchVideoInfo(normal.ep.id);
    for (const row of info.rows) {
      const r = row.item || {};
      console.log(`      key=${String(row.key).padEnd(9)} quality=${String(row.quality).padEnd(10)} vheight=${String(r.vheight).padEnd(6)} vwidth=${String(r.vwidth).padEnd(6)} quality_desc=${JSON.stringify(r.quality_desc)} definition=${JSON.stringify(r.definition)}`);
    }
  } catch {}
}

console.log(`\n  === 扫描结果 ===`);
console.log(`  检查 ${seen.size} 部，发现 ${found} 部非标准`);