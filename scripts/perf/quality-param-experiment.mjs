// 决定性实验：能否通过请求参数让上游返回 bytevc1（可播）而非 bytevc2？
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import axios from "axios";

console.log("=== 上游 codec 参数实验 ===\n");

// 加载引擎（拿到内部的 freshDevice / signedVideoRequest 等）
const source = fs.readFileSync("shared/content-core/hongguo.js", "utf8");
const context = vm.createContext({
  require: (n) => { if (n === "node:crypto") return crypto; throw new Error("unsupported " + n); },
  Buffer, URL, URLSearchParams,
  axios: axios.create({ maxContentLength: 16 * 1024 * 1024, maxBodyLength: 1024 * 1024 }),
  console,
});
// 额外导出内部函数用于实验
vm.runInContext(
  source + "\nthis.api = {fetchVideoInfo, qualityNumber, modelForVideo, parseFallback, jsonBody, getText, freshDevice, signedVideoRequest};",
  context,
  { timeout: 10000 }
);
const api = context.api;

// 拿一个「只有 1080P」的集
const http = await import("node:http");
const BASE = process.env.BASE || "http://127.0.0.1:8790";
const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } }); }).on("error", rej);
});

const rec = await get(`${BASE}/api/recommend?page=1`);
const items = rec.items || [];

// 找一个 1 档的集
let target = null;
for (const it of items.slice(0, 6)) {
  const det = await get(`${BASE}/api/series/${it.id}`);
  for (const ep of (det.episodes || []).slice(0, 3)) {
    const q = await get(`${BASE}/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
    if ((q.qualities || []).length === 1) { target = { it, ep, det }; break; }
  }
  if (target) break;
}

if (!target) { console.log("  未找到 1 档的集"); process.exit(0); }
console.log(`  目标: ${target.it.title.slice(0, 20)} 第1集 id=${target.ep.id}\n`);

// 直接向上游请求，尝试不同的 biz_param
const variants = [
  ["基线（当前实现）", { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 }],
  ["need_all_video_definition=false", { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: false, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 }],
  ["device_level=1", { detail_page_version: 0, device_level: 1, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 }],
  ["device_level=5", { detail_page_version: 0, device_level: 5, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 1024 }],
  ["use_os_player=true", { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: true, use_server_dns: false, video_platform: 1024 }],
  ["video_platform=2", { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 2 }],
  ["video_platform=0", { detail_page_version: 0, device_level: 3, disable_digg_stat: false, need_all_video_definition: true, need_mp4_align: false, use_os_player: false, use_server_dns: false, video_platform: 0 }],
];

console.log("  变体                               可播档位(bytevc1)  总档位  低档codec");
for (const [name, biz] of variants) {
  try {
    const payload = JSON.stringify({ biz_param: biz, video_id: String(target.ep.id) });
    const signed = api.signedVideoRequest(payload, api.freshDevice());
    const resp = await axios.post(signed.url, signed.body, { headers: signed.headers, timeout: 20000, responseType: "text" });
    const data = api.jsonBody(resp.data);
    if (!data) { console.log(`  ${name.padEnd(34)} (空响应体)`); continue; }
    const model = api.modelForVideo(data, target.ep.id);
    const fallback = api.parseFallback(model.fallback_api);
    if (!fallback) { console.log(`  ${name.padEnd(34)} (fallback 为空)`); continue; }
    const outer = api.jsonBody(await api.getText(fallback));
    const info = outer?.video_info?.data || {};
    const vl = info.video_list || {};
    const entries = Object.entries(vl);
    const playable = entries.filter(([, v]) => v?.codec_type === "bytevc1");
    const codecs = entries.map(([k, v]) => `${k}:${(v?.codec_type || "?").replace("bytevc", "v")}`).join(" ");
    console.log(`  ${name.padEnd(34)} ${String(playable.length).padStart(2)}                ${String(entries.length).padStart(2)}     ${codecs}`);
    await new Promise((r) => setTimeout(r, 800));
  } catch (e) {
    console.log(`  ${name.padEnd(34)} 错误: ${e.message.slice(0, 45)}`);
  }
}

console.log("\n  === 判定 ===");
console.log("  若所有变体都只返回 1 个 bytevc1，则这是上游对该集的固定策略，");
console.log("  无法通过参数改变 -> 只能接受「该集只有 1080P」");
console.log("  若某个变体返回更多 bytevc1，则可改用它修复此问题");
