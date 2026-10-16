// 验证 device_level=5 的普适性：多剧多集对比
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

async function probe(vid, deviceLevel) {
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
  const vl = outer?.video_info?.data?.video_list || {};
  const entries = Object.entries(vl);
  return {
    total: entries.length,
    playable: entries.filter(([, v]) => v?.codec_type === "bytevc1").length,
  };
}

console.log("=== device_level 对比实验（多剧多集）===\n");

const rec = await get(`${BASE}/api/recommend?page=1`);
const items = (rec.body?.items || rec.items || []).slice(0, 6);

console.log("  剧名                     集   L3(当前)      L5(候选)      改善");
console.log("  " + "-".repeat(72));

let l3Total = 0, l5Total = 0, l3Playable = 0, l5Playable = 0, cases = 0;
let improved = 0;

for (const it of items) {
  const det = await get(`${BASE}/api/series/${it.id}`);
  const eps = (det.episodes || det.body?.episodes || []).slice(0, 3);

  for (let i = 0; i < eps.length; i += 1) {
    const ep = eps[i];
    try {
      const l3 = await probe(ep.id, 3);
      await new Promise((r) => setTimeout(r, 500));
      const l5 = await probe(ep.id, 5);
      await new Promise((r) => setTimeout(r, 500));
      if (!l3 || !l5) continue;

      cases += 1;
      l3Total += l3.total; l5Total += l5.total;
      l3Playable += l3.playable; l5Playable += l5.playable;
      if (l5.playable > l3.playable) improved += 1;

      const mark = l5.playable > l3.playable ? "  ✅ +" + (l5.playable - l3.playable) : (l5.playable < l3.playable ? "  ⚠️ -" + (l3.playable - l5.playable) : "  =");
      console.log(
        `  ${(it.title || "").slice(0, 22).padEnd(24)} ${String(i + 1).padStart(2)}   ` +
          `${String(l3.playable)}/${l3.total}          ${String(l5.playable)}/${l5.total}         ${mark}`
      );
    } catch (e) {
      // 静默跳过失败样本
    }
  }
}

console.log("\n  === 汇总（" + cases + " 个样本）===");
console.log(`  device_level=3（当前）: 可播档位合计 ${l3Playable} / 总档位 ${l3Total}`);
console.log(`  device_level=5（候选）: 可播档位合计 ${l5Playable} / 总档位 ${l5Total}`);
console.log(`  改善的样本: ${improved} / ${cases}`);
console.log("");
if (l5Playable > l3Playable) {
  console.log(`  ✅ device_level=5 平均多提供 ${((l5Playable - l3Playable) / cases).toFixed(1)} 个可播档位/集`);
  console.log("     → 可作为修复方案，但需评估副作用");
} else {
  console.log("  ⚠️ device_level=5 无改善，需另找方案");
}
