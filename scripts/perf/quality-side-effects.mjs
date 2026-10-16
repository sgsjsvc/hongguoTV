// device_level=5 的副作用评估
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
  source + "\nthis.api = {modelForVideo, parseFallback, jsonBody, getText, freshDevice, signedVideoRequest};",
  context, { timeout: 10000 }
);
const api = context.api;

const http = await import("node:http");
const BASE = process.env.BASE || "http://127.0.0.1:8790";
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

const baseParam = { detail_page_version: 0, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 };

async function fetchInfo(vid, deviceLevel) {
  const biz = { ...baseParam, device_level: deviceLevel };
  const payload = JSON.stringify({ biz_param: biz, video_id: String(vid) });
  const signed = api.signedVideoRequest(payload, api.freshDevice());
  const resp = await axios.post(signed.url, signed.body, { headers: signed.headers, timeout: 20000, responseType: "text" });
  const data = api.jsonBody(resp.data);
  if (!data) return null;
  const model = api.modelForVideo(data, vid);
  const fallback = api.parseFallback(model.fallback_api);
  if (!fallback) return null;
  const outer = api.jsonBody(await api.getText(fallback));
  return { vl: outer?.video_info?.data?.video_list || {}, info: outer?.video_info?.data || {} };
}

const rec = await get(`${BASE}/api/recommend?page=1`);
const items = (rec.body?.items || rec.items || []).slice(0, 3);
const det = await get(`${BASE}/api/series/${items[0].id}`);
const eps = (det.episodes || det.body?.episodes || []).slice(0, 4);

console.log("=== device_level=5 副作用评估 ===\n");

console.log("  --- 1. 视频时长是否变化（质量是否降级）---");
console.log("  集   L3时长     L5时长     L3 1080分辨率        L5 1080分辨率");
for (let i = 0; i < eps.length; i += 1) {
  try {
    const l3 = await fetchInfo(eps[i].id, 3);
    await new Promise((r) => setTimeout(r, 600));
    const l5 = await fetchInfo(eps[i].id, 5);
    await new Promise((r) => setTimeout(r, 600));
    if (!l3 || !l5) continue;

    const pick = (info, key) => {
      const v = info.vl[key];
      if (!v) return "-";
      return `${v.vheight || "?"}p/${v.vwidth || "?"}x${v.vheight || "?"}`;
    };
    // 用 video_5（1080）对比
    const l3v5 = l3.vl.video_5, l5v5 = l5.vl.video_5;
    console.log(
      `  ${i + 1}   ${String(l3v5?.duration || "-").padEnd(9)} ${String(l5v5?.duration || "-").padEnd(9)} ` +
        `${pick(l3.info, "video_5").padEnd(20)} ${pick(l5.info, "video_5")}`
    );
  } catch (e) {
    console.log(`  ${i + 1}   错误: ${e.message.slice(0, 50)}`);
  }
}

console.log("\n  --- 2. 各档位 bitrate 对比（1080P）---");
{
  const l3 = await fetchInfo(eps[0].id, 3);
  await new Promise((r) => setTimeout(r, 700));
  const l5 = await fetchInfo(eps[0].id, 5);
  const v3 = l3?.vl?.video_5, v5 = l5?.vl?.video_5;
  console.log(`     L3: bitrate=${v3?.bitrate} vheight=${v3?.vheight} size=${v3?.size} codec=${v3?.codec_type}`);
  console.log(`     L5: bitrate=${v5?.bitrate} vheight=${v5?.vheight} size=${v5?.size} codec=${v5?.codec_type}`);
  const same = v3?.bitrate === v5?.bitrate && v3?.size === v5?.size;
  console.log(`     ${same ? "✓ 1080P 完全一致（未降级）" : "⚠️ 有差异，需注意"}`);
}

console.log("\n  --- 3. 连续请求是否触发风控（稳定性）---");
{
  let ok = 0, empty = 0, err = 0;
  for (let i = 0; i < 12; i += 1) {
    try {
      const r = await fetchInfo(eps[0].id, 5);
      if (r) ok += 1; else empty += 1;
    } catch { err += 1; }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`     12 次连续请求: 成功 ${ok}, 空响应 ${empty}, 错误 ${err}`);
  console.log(`     ${ok >= 10 ? "✓ 稳定，未见风控" : "⚠️ 可能触发风控"}`);
}

console.log("\n  --- 4. 档位 label 是否正常映射 ---");
{
  const l5 = await fetchInfo(eps[0].id, 5);
  console.log("     video_list 全部键与 codec：");
  for (const [k, v] of Object.entries(l5?.vl || {})) {
    console.log(`       ${k.padEnd(10)} vheight=${String(v.vheight).padEnd(6)} codec=${v.codec_type}`);
  }
}

console.log("\n  === 结论 ===");
console.log("  若 1080P 参数一致且请求稳定，则 device_level=5 是安全的修复方案");
