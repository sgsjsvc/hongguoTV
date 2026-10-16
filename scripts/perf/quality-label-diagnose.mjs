// 诊断：device_level=5 后出现的非标准档位（1924P/1282P/962P/642P/480P）
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
  source + "\nthis.api = {modelForVideo, parseFallback, jsonBody, getText, freshDevice, signedVideoRequest, qualityNumber, qualityLabel, qualityRows};",
  context, { timeout: 10000 }
);
const api = context.api;

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

console.log("=== 非标准档位诊断 ===\n");

// 1. 找那个出现非标准档位的剧
const rec = await get(`${BASE}/api/recommend?page=1`);
let target = null;
for (const it of (rec.items || []).slice(0, 8)) {
  const det = await get(`${BASE}/api/series/${it.id}`);
  const ep = (det.episodes || [])[0];
  if (!ep) continue;
  const q = await get(`${BASE}/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
  const keys = (q.qualities || []).map((x) => x.key);
  const odd = keys.some((k) => !["2160P", "1440P", "1080P", "720P", "576P", "540P", "480P", "360P"].includes(k));
  if (odd) { target = { it, ep, keys, road: q.qualities }; break; }
}

if (!target) { console.log("  未找到非标准档位的剧"); process.exit(0); }
console.log(`  目标: ${target.it.title}`);
console.log(`  服务端返回档位: ${target.keys.join("/")}\n`);

// 2. 看服务端返回的完整对象
console.log("  --- 服务端返回的 qualities 详情 ---");
for (const q of target.road) {
  console.log(`    key=${String(q.key).padEnd(10)} label=${String(q.label).padEnd(14)} qualityNum=${String(q.qualityNum).padEnd(6)} rawKey=${q.rawKey} codec=${q.codec}`);
}

// 3. 直接问引擎要原始 rows
console.log("\n  --- 引擎原始 rows ---");
const info = await api.fetchVideoInfo(target.ep.id);
for (const row of info.rows) {
  console.log(`    key=${String(row.key).padEnd(10)} quality=${String(row.quality).padEnd(12)} vheight=${String(row.item?.vheight).padEnd(6)} vwidth=${String(row.item?.vwidth).padEnd(6)} quality_desc=${row.item?.quality_desc}`);
}

// 4. 检查 qualityNumber 对各值的解析
console.log("\n  --- qualityNumber 解析检查（关键）---");
const values = info.rows.map((r) => r.quality || r.item?.vheight || r.key);
for (const v of values) {
  const n = api.qualityNumber(v);
  console.log(`    qualityNumber("${v}") = ${n}`);
}

console.log("\n  --- 标准档位对照 ---");
for (const v of ["2160", "1440", "1080", "720", "576", "540", "480", "360", "1920", "1280", "960", "640", "1924", "1282", "962", "642"]) {
  console.log(`    "${v}" -> ${api.qualityNumber(v)}`);
}

console.log("\n  === 判定 ===");
console.log("  若 qualityNumber 对非标准值返回原值（如 1924），则标签会显示 1924P");
console.log("  根因：device_level=5 时上游返回的 quality_desc/vheight 不是标准档位值");