// 探查非标准档位的原始来源
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
  source + "\nthis.api = {modelForVideo, parseFallback, jsonBody, getText, freshDevice, signedVideoRequest, qualityNumber, qualityRows};",
  context, { timeout: 10000 }
);
const api = context.api;

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

console.log("=== 非标准档位来源探查 ===\n");

// 搜索目标剧
const targets = ["离婚后才知她是神明第二季", "开局系统逼我败家"];
for (const name of targets) {
  console.log(`  --- ${name} ---`);
  const s = await get(`${BASE}/api/search?keyword=${encodeURIComponent(name)}&page=1`);
  const items = s.items || s.series || [];
  const hit = items.find((x) => x.title && x.title.includes(name.slice(0, 6))) || items[0];
  if (!hit) { console.log("    未找到"); continue; }

  const det = await get(`${BASE}/api/series/${hit.id}`);
  const ep = (det.episodes || [])[0];
  if (!ep) { console.log("    无剧集"); continue; }

  const info = await api.fetchVideoInfo(ep.id);
  console.log(`    引擎 rows (${info.rows.length}):`);
  for (const row of info.rows) {
    const it = row.item || {};
    console.log(`      key=${String(row.key).padEnd(9)} quality=${String(row.quality).padEnd(8)} vheight=${String(it.vheight).padEnd(6)} vwidth=${String(it.vwidth).padEnd(6)} quality_desc=${JSON.stringify(it.quality_desc)} bitrate=${it.bitrate}`);
  }
  console.log(`    引擎 rows 推导的键: ${info.rows.map((r) => (api.qualityNumber(r.quality || r.item?.vheight || r.key) || "?") + "P").join("/")}`);
  console.log("");
}