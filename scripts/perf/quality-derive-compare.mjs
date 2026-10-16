// 量化：用 vheight 推导 vs 用 definition 推导，档位数差异
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
  source + "\nthis.api = {fetchVideoInfo, qualityNumber};",
  context, { timeout: 10000 }
);
const api = context.api;

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const http = await import("node:http");
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

const STANDARD = new Set(["2160P", "1440P", "1080P", "720P", "576P", "540P", "480P", "360P"]);

console.log("=== 档位推导方式对比（vheight vs definition）===\n");

// 模拟服务端的两种推导
function deriveFromVheight(rows) {
  const keys = new Set();
  for (const row of rows) {
    if (row.item?.codec_type === "bytevc2") continue;
    const qNum = api.qualityNumber(row.quality || row.item?.vheight || row.key);
    keys.add(qNum ? `${qNum}P` : String(row.key).toUpperCase());
  }
  return [...keys];
}
function deriveFromDefinition(rows) {
  const keys = new Set();
  for (const row of rows) {
    if (row.item?.codec_type === "bytevc2") continue;
    const qNum = api.qualityNumber(row.item?.definition) || api.qualityNumber(row.quality || row.item?.vheight || row.key);
    keys.add(qNum ? `${qNum}P` : String(row.key).toUpperCase());
  }
  return [...keys];
}

const seen = new Set();
let checked = 0, vhLosesTier = 0, vhNonStandard = 0;
const samples = [];

for (const page of [1, 2, 3]) {
  let rec;
  try { rec = await get(`${BASE}/api/recommend?page=${page}`); } catch { continue; }
  for (const it of rec.items || []) {
    if (seen.has(it.id) || checked >= 25) continue;
    seen.add(it.id);
    try {
      const det = await get(`${BASE}/api/series/${it.id}`);
      const ep = (det.episodes || [])[0];
      if (!ep) continue;
      const info = await api.fetchVideoInfo(ep.id);
      const playable = (info.rows || []).filter((r) => r.item?.codec_type !== "bytevc2");
      if (playable.length < 4) continue;

      checked += 1;
      const a = deriveFromVheight(info.rows);
      const b = deriveFromDefinition(info.rows);
      const aOdd = a.filter((k) => !STANDARD.has(k));
      const lostTier = b.length > a.length;

      if (aOdd.length) vhNonStandard += 1;
      if (lostTier) {
        vhLosesTier += 1;
        if (samples.length < 6) samples.push({ title: it.title, vh: a.join("/"), def: b.join("/") });
      }
    } catch {}
  }
}

console.log(`  检查 ${checked} 部（含 >=4 可播档位）\n`);
console.log(`  用 vheight 推导出现非标准标签: ${vhNonStandard} 部 (${((vhNonStandard / checked) * 100).toFixed(0)}%)`);
console.log(`  用 vheight 推导丢失档位（去重碰撞）: ${vhLosesTier} 部 (${((vhLosesTier / checked) * 100).toFixed(0)}%)`);

if (samples.length) {
  console.log("\n  === 丢失档位的样本 ===");
  console.log("  剧名                    vheight 推导          definition 推导");
  for (const s of samples) {
    console.log(`  ${String(s.title).slice(0, 20).padEnd(22)} ${s.vh.padEnd(22)} ${s.def}`);
  }
}

console.log("\n  === 判定 ===");
if (vhLosesTier > 0 || vhNonStandard > 0) {
  console.log(`  ⚠ 用 vheight 推导有缺陷：`);
  if (vhLosesTier > 0) console.log(`     ${vhLosesTier}/${checked} 部因档位值碰撞被去重，实际少给档位`);
  if (vhNonStandard > 0) console.log(`     ${vhNonStandard}/${checked} 部出现非标准标签（如 1924P/496P）`);
  console.log("");
  console.log("  修复：优先使用上游的 definition 字段（标准值 1080p/720p/540p/480p/360p）");
  console.log("    位置 custom-server/index.mjs:710");
  console.log("    改 qualityNumber(row.quality || row.item?.vheight || row.key)");
  console.log("    为 qualityNumber(row.item?.definition || row.quality || row.item?.vheight || row.key)");
} else {
  console.log("  ✓ vheight 推导无问题");
}