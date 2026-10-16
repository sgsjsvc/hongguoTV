// 决定性测试：同一集的清晰度档位数是否稳定？
// 若上游间歇性只返回 1080P，则缓存会"记住"这个残缺结果
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/quality-stability");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data"), HG_PREFETCH_ENABLED: "0" },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log); child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
const get = async (url) => {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

console.log(`=== 清晰度档位稳定性测试 (${BASE}) ===\n`);

// 直接调引擎，绕过服务端缓存
const engine = await import(path.resolve("shared/content-core/hongguo.js"));
console.log("  已直接加载引擎（绕过服务端缓存）\n");

// 取几个剧集
const rec = await get("/api/recommend?page=1");
const items = (rec.body.items || []).slice(0, 6);

// 对每部剧的第 1 集，重复调引擎 5 次（引擎内部有 300s 缓存，需绕过）
console.log("  === 每集重复 5 次（引擎级，绕过 HTTP 缓存）===");
console.log("  剧名                     集    1  2  3  4  5   是否稳定");

const unstable = [];
for (const it of items) {
  const det = await get(`/api/series/${it.id}`);
  const ep = (det.body?.episodes || [])[0];
  if (!ep) continue;

  const counts = [];
  const keysets = [];
  for (let i = 0; i < 5; i += 1) {
    try {
      // 关键：每次先清掉引擎缓存，强制真实请求上游
      if (typeof engine.clearVideoInfoCache === "function") engine.clearVideoInfoCache();
      else if (engine.videoInfoCache?.clear) engine.videoInfoCache.clear();

      const info = await engine.fetchVideoInfo(ep.id);
      const rows = info.rows || [];
      counts.push(rows.length);
      keysets.push(rows.map((r) => r.key).join("|"));
    } catch (e) {
      counts.push(-1);
      keysets.push("ERR:" + e.message.slice(0, 20));
    }
    await sleep(400);
  }

  const stable = new Set(counts).size === 1;
  if (!stable) unstable.push({ title: it.title, ep: ep.id, counts, keysets });
  console.log(
    `  ${(it.title || "").slice(0, 22).padEnd(24)} ${String(1).padStart(2)}   ` +
      `${counts.map((c) => String(c).padStart(2)).join(" ")}   ${stable ? "✓ 稳定" : "✗ 不稳定"}`
  );
}

// 汇总
console.log("\n  === 汇总 ===");
console.log(`  测试 ${items.length} 部剧，${unstable.length} 部档位数不稳定`);

if (unstable.length) {
  console.log("\n  === 不稳定详情 ===");
  for (const u of unstable) {
    console.log(`  ${u.title.slice(0, 24)}`);
    console.log(`    档位数序列: ${u.counts.join(", ")}`);
    for (const ks of [...new Set(u.keysets)]) {
      console.log(`      出现: ${ks}`);
    }
  }
}

console.log("\n  === 判定 ===");
if (unstable.length > 0) {
  console.log("  ⚠ 上游对同一集的返回不稳定（有时只给 1080P）");
  console.log("    引擎的 videoInfoCache（TTL 300s）会缓存这个残缺结果");
  console.log("    → 用户看到「只有 1080P」，直到缓存过期");
  console.log("    → 这解释了「推荐页只有 1080P，播放页却有全部清晰度」");
  console.log("       （两个页面在不同时间点命中不同的缓存状态）");
} else {
  console.log("  ✓ 上游对同一集返回稳定");
  console.log("    → 档位差异是「剧集本身差异」，非缓存缺陷");
  console.log("    → 用户报告的「推荐页 vs 播放页不同」需要另找原因");
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();
