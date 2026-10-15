// 引擎健康自检：区分「上游静默降级」与「真实故障」
//
// 背景（2026-10-15 事故）：
//   上游对硬编码 device_id 返回 HTTP 200 + 空响应体，导致三端全部无法播放。
//   从 HTTP 状态码看是成功的，只有解析响应体才发现是空的。
//   现有探针只检查 HTTP 状态与字节数，无法区分「空体」与「网络故障」。
//
// 本模块提供分层诊断：
//   1. 直连上游（绕过本服务）-> 判断是上游问题还是我方问题
//   2. 用不同 device_id 对比 -> 判断是否设备被封
//   3. 端到端取流 -> 判断整条链路是否可用
//
// 用法:
//   node scripts/diagnose-playback.mjs                  # 自动起服务并诊断
//   node scripts/diagnose-playback.mjs --no-spawn       # 只诊断已运行的服务
//   BRIDGE_URL=http://127.0.0.1:8789 node scripts/...   # 指定服务地址

import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const noSpawn = args.includes("--no-spawn");
const base = process.env.BRIDGE_URL || "http://127.0.0.1:8788";

const report = {
  at: new Date().toISOString(),
  base,
  stages: [],
  verdict: null,
  suggestions: [],
};

function stage(name, ok, detail) {
  report.stages.push({ name, ok, ...detail });
  const mark = ok === true ? "✓" : ok === false ? "✗" : "•";
  const extra = detail?.note ? `  ${detail.note}` : "";
  console.log(`  ${mark} ${name}${extra}`);
}

// ---------- 加载引擎（与 custom-server 相同的方式）----------

function loadEngine() {
  const enginePath = path.join(root, "shared", "content-core", "hongguo.js");
  const fallback = path.join(root, "custom-server", "vendor", "hongguo.cjs");
  const file = fs.existsSync(enginePath) ? enginePath : fallback;
  if (!fs.existsSync(file)) throw new Error("引擎文件不存在");
  const source = fs.readFileSync(file, "utf8");
  const context = vm.createContext({
    require: (name) => {
      if (name === "node:crypto") return crypto;
      throw new Error("Unsupported module: " + name);
    },
    Buffer, URL, URLSearchParams,
    // 直连上游需要真实 axios
    axios: (globalThis.__axios || null),
  });
  vm.runInContext(
    source + "\nthis.api = { fetchVideoInfo, DEVICE, freshDevice, signedVideoRequest, randomDeviceId };",
    context,
    { timeout: 5000 }
  );
  return { api: context.api, file };
}

// ---------- HTTP 助手 ----------

async function getJson(url, timeout = 60000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* 保留原始文本 */ }
  return { status: res.status, body, text };
}

// ---------- 诊断主流程 ----------

async function main() {
  console.log("=== 播放链路诊断 ===\n");
  console.log(`  目标服务: ${base}`);
  console.log(`  时间: ${report.at}\n`);

  // 阶段 0：引擎静态检查
  console.log("  --- 阶段 0：引擎静态检查 ---");
  let engine = null;
  try {
    const axiosMod = await import("axios");
    globalThis.__axios = axiosMod.default;
    engine = loadEngine();
    const dev = engine.api.DEVICE;
    const src = fs.readFileSync(engine.file, "utf8");
    // 硬编码 device_id 是事故根因，必须不存在
    const hardcoded = /device_id:\s*'\d{10,}'/.test(src) || src.includes("1905892595378490");
    stage("引擎可加载", true, { note: engine.file.replace(root, ".") });
    stage("无硬编码 device_id", !hardcoded, {
      note: hardcoded ? "⚠ 发现硬编码，上游封禁后会导致全线不可播" : "已随机化",
    });
    stage("设备 ID 可重复生成", typeof engine.api.freshDevice === "function", {
      note: typeof engine.api.freshDevice === "function" ? "freshDevice 可用" : "缺少 freshDevice",
    });
    if (typeof engine.api.freshDevice === "function") {
      const a = engine.api.freshDevice().device_id;
      const b = engine.api.freshDevice().device_id;
      stage("每次生成不同 ID", a !== b, { note: a !== b ? "✓ 一次性消耗已适配" : "⚠ 两次相同" });
    }
    console.log("");
  } catch (e) {
    stage("引擎可加载", false, { error: e.message });
    report.verdict = "engine_broken";
    return finish();
  }

  // 阶段 1：服务健康
  console.log("  --- 阶段 1：服务健康 ---");
  let serviceOk = false;
  try {
    const h = await getJson(base + "/health", 15000);
    serviceOk = h.status === 200 && h.body?.ok === true;
    stage("服务健康检查", serviceOk, { note: serviceOk ? h.body.service : `HTTP ${h.status}` });
  } catch (e) {
    stage("服务健康检查", false, { error: e.message.slice(0, 80) });
  }
  console.log("");

  // 阶段 2：直连上游（关键：区分上游 vs 我方）
  console.log("  --- 阶段 2：直连上游（绕过本服务）---");
  const upstreamResult = { empty: 0, ok: 0, error: 0, codes: [] };
  try {
    const axiosMod = (await import("axios")).default;
    const testVid = await pickEpisodeId(base);
    if (!testVid) {
      stage("直连上游", null, { note: "无法取得测试剧集" });
    } else {
      for (let i = 0; i < 3; i += 1) {
        const payload = JSON.stringify({
          biz_param: {
            detail_page_version: 0, device_level: 3, disable_digg_stat: false,
            need_all_video_definition: true, need_mp4_align: false, use_os_player: false,
            use_server_dns: false, video_platform: 1024,
          },
          video_id: testVid,
        });
        const signed = engine.api.signedVideoRequest(payload, engine.api.freshDevice());
        try {
          const r = await axiosMod.post(signed.url, signed.body, {
            headers: signed.headers, timeout: 25000,
            responseType: "text", validateStatus: () => true,
          });
          const len = (r.data || "").length;
          if (len === 0) { upstreamResult.empty += 1; upstreamResult.codes.push("EMPTY"); }
          else {
            const j = JSON.parse(r.data);
            const code = j.Code ?? j.code ?? "?";
            upstreamResult.codes.push(String(code));
            if (Number(code) === 0) upstreamResult.ok += 1; else upstreamResult.error += 1;
          }
        } catch (e) {
          upstreamResult.error += 1;
          upstreamResult.codes.push("ERR:" + e.message.slice(0, 20));
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      const allEmpty = upstreamResult.empty === 3;
      const allOk = upstreamResult.ok === 3;
      stage("直连上游 3 次", allOk ? true : allEmpty ? false : null, {
        note: `空体=${upstreamResult.empty} 正常=${upstreamResult.ok} 错误=${upstreamResult.error}  [${upstreamResult.codes.join(",")}]`,
      });
      if (allEmpty) {
        report.suggestions.push(
          "上游全部返回空体：device_id 可能已被封禁。检查引擎是否每次请求都生成新设备（freshDevice）。"
        );
      }
    }
  } catch (e) {
    stage("直连上游", false, { error: e.message.slice(0, 80) });
  }
  console.log("");

  // 阶段 3：端到端接口
  console.log("  --- 阶段 3：端到端接口 ---");
  if (!serviceOk) {
    stage("qualities 接口", null, { note: "服务未运行，跳过" });
    stage("stream 接口", null, { note: "服务未运行，跳过" });
  } else {
    const probe = await probeEndToEnd(base);
    stage("推荐接口", probe.recommend.ok, { note: probe.recommend.note });
    stage("详情接口", probe.detail.ok, { note: probe.detail.note });
    stage("qualities 接口", probe.qualities.ok, { note: probe.qualities.note });
    stage("stream 接口", probe.stream.ok, { note: probe.stream.note });

    // 判定
    if (probe.qualities.ok && probe.stream.ok) {
      report.verdict = "healthy";
    } else if (upstreamResult.empty === 3) {
      report.verdict = "upstream_device_blocked";
      report.suggestions.push("确认引擎 requestVideoModel 每次调用 freshDevice()。");
    } else if (!probe.qualities.ok && upstreamResult.ok > 0) {
      report.verdict = "service_layer_broken";
      report.suggestions.push("上游正常但服务失败：检查 custom-server 的 qualities 处理与引擎加载。");
    } else {
      report.verdict = "unknown";
    }
  }

  return finish();
}

async function pickEpisodeId(base) {
  try {
    const rec = await getJson(base + "/api/recommend?page=1", 40000);
    const item = (rec.body?.items || [])[0];
    if (!item) return null;
    const det = await getJson(base + "/api/series/" + item.id, 40000);
    return (det.body?.episodes || [])[0]?.id || null;
  } catch {
    return null;
  }
}

async function probeEndToEnd(base) {
  const out = {
    recommend: { ok: false, note: "" },
    detail: { ok: false, note: "" },
    qualities: { ok: false, note: "" },
    stream: { ok: false, note: "" },
  };
  let item = null, ep = null;
  try {
    const rec = await getJson(base + "/api/recommend?page=1", 40000);
    const items = rec.body?.items || [];
    item = items[0];
    out.recommend = { ok: items.length > 0, note: `${items.length} 条` };
  } catch (e) {
    out.recommend = { ok: false, note: e.message.slice(0, 50) };
    return out;
  }
  if (!item) return out;

  try {
    const det = await getJson(base + "/api/series/" + item.id, 40000);
    const eps = det.body?.episodes || [];
    ep = eps[0];
    out.detail = { ok: eps.length > 0, note: `${eps.length} 集` };
  } catch (e) {
    out.detail = { ok: false, note: e.message.slice(0, 50) };
    return out;
  }
  if (!ep) return out;

  try {
    const q = await getJson(`${base}/api/episodes/${ep.id}/qualities?seriesId=${item.id}`, 60000);
    const n = (q.body?.qualities || []).length;
    out.qualities = {
      ok: n > 0,
      note: n > 0 ? `${n} 个（默认 ${q.body.defaultQuality}）` : `${q.body?.code || "HTTP " + q.status} ${q.body?.error || ""}`,
    };
  } catch (e) {
    out.qualities = { ok: false, note: e.message.slice(0, 50) };
    return out;
  }

  try {
    const res = await fetch(
      `${base}/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`,
      { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(90000) }
    );
    const buf = Buffer.from(await res.arrayBuffer());
    out.stream = {
      ok: res.status === 206 && buf.length === 1024,
      note: `HTTP ${res.status} / ${buf.length}B`,
    };
  } catch (e) {
    out.stream = { ok: false, note: e.message.slice(0, 50) };
  }
  return out;
}

async function finish() {
  console.log("\n  === 判定 ===");
  const verdictText = {
    healthy: "✓ 播放链路正常",
    upstream_device_blocked: "✗ 上游对设备返回空体（device_id 封禁或未随机化）",
    service_layer_broken: "✗ 上游正常但服务层失败",
    engine_broken: "✗ 引擎无法加载",
    unknown: "? 无法确定",
  }[report.verdict] || "? 未判定";
  console.log(`  ${verdictText}`);
  if (report.suggestions.length) {
    console.log("\n  建议:");
    for (const s of report.suggestions) console.log(`    - ${s}`);
  }
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "outputs", "playback-diagnosis.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(`\n  报告: outputs/playback-diagnosis.json`);
  if (report.verdict !== "healthy") process.exitCode = 1;
}

main().catch((e) => {
  console.error("诊断失败:", e.message);
  process.exitCode = 1;
});
