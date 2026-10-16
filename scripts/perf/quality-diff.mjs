// 复现用户报告：推荐页 vs 播放页的清晰度差异
// 用户观察：推荐页第 1 部有全部清晰度，第 2 部起只有 1080P；但播放页有全部清晰度
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/quality-diff");
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
console.log(`=== 清晰度差异复现 (${BASE}) ===`);
console.log("    注意：本实例禁用预取（HG_PREFETCH_ENABLED=0），排除预取干扰\n");

const get = async (url) => {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

// 1. 取推荐流
const rec = await get("/api/recommend?page=1");
const items = rec.body.items || [];
console.log(`  推荐流 ${items.length} 部\n`);

// 2. 逐部查询清晰度
console.log("  === 推荐流前 8 部的清晰度 ===");
console.log("  #  剧名                        集数  清晰度档位                              codec 分布");

const results = [];
for (let i = 0; i < Math.min(8, items.length); i += 1) {
  const it = items[i];
  const det = await get(`/api/series/${it.id}`);
  const ep = (det.body?.episodes || [])[0];
  if (!ep) { console.log(`  ${i + 1}  ${(it.title || "").slice(0, 24).padEnd(26)} 无剧集`); continue; }

  const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
  const qualities = q.body?.qualities || [];
  const keys = qualities.map((x) => x.key).join("/");
  const codecs = [...new Set(qualities.map((x) => x.codec))].join(",");

  results.push({ idx: i + 1, id: it.id, title: it.title, epId: ep.id, count: qualities.length, keys, codecs });

  const flag = qualities.length <= 1 ? "  ⚠ 仅 1 档" : "";
  console.log(
    `  ${String(i + 1).padStart(2)}  ${(it.title || "").slice(0, 24).padEnd(26)} ` +
      `${String((det.body?.episodes || []).length).padStart(4)}  ${keys.padEnd(38)} ${codecs}${flag}`
  );
}

// 3. 统计
console.log("\n  === 统计 ===");
const full = results.filter((r) => r.count >= 4);
const only1080 = results.filter((r) => r.count === 1 && r.keys === "1080P");
console.log(`  全部清晰度（>=4 档）: ${full.length} 部`);
console.log(`  仅 1080P:            ${only1080.length} 部`);
if (only1080.length) console.log(`     ${only1080.map((r) => r.title.slice(0, 14)).join(", ")}`);

// 4. 关键验证：同一部剧在「推荐页」与「播放页」的清晰度是否不同
console.log("\n  === 关键验证：同一部剧、同一集，两次请求是否一致 ===");
for (const r of results.slice(0, 4)) {
  const a = await get(`/api/episodes/${r.epId}/qualities?seriesId=${r.id}`);
  const b = await get(`/api/episodes/${r.epId}/qualities?seriesId=${r.id}`);
  const ka = (a.body?.qualities || []).map((x) => x.key).join("/");
  const kb = (b.body?.qualities || []).map((x) => x.key).join("/");
  console.log(`  ${r.title.slice(0, 16).padEnd(18)} 第1次=${ka.padEnd(30)} 第2次=${kb.padEnd(30)} ${ka === kb ? "✓ 一致" : "✗ 不一致"}`);
}

// 5. 不带 seriesId 的请求（播放页可能这样调）
console.log("\n  === 对照：不带 seriesId 参数 ===");
for (const r of results.slice(0, 3)) {
  const a = await get(`/api/episodes/${r.epId}/qualities`);
  const ka = (a.body?.qualities || []).map((x) => x.key).join("/");
  console.log(`  ${r.title.slice(0, 16).padEnd(18)} 带 seriesId=${r.keys.padEnd(28)} 不带=${ka}`);
}

// 6. 换一集试试（用户说第 1 集，但也许后续集不同）
console.log("\n  === 检查第 2、3 集的清晰度（同剧不同集）===");
for (const r of results.slice(0, 3)) {
  const det = await get(`/api/series/${r.id}`);
  const eps = (det.body?.episodes || []).slice(0, 3);
  const line = [];
  for (const ep of eps) {
    const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${r.id}`);
    line.push(`${(q.body?.qualities || []).length}档`);
  }
  console.log(`  ${r.title.slice(0, 16).padEnd(18)} 第1/2/3集: ${line.join(" / ")}`);
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();

console.log("\n  === 判定 ===");
if (only1080.length > 0 && full.length > 0) {
  console.log("  推荐流中确实存在「仅 1080P」的剧集，与「全部清晰度」的剧集并存");
  console.log("  → 需要确认这是「剧集本身差异」还是「客户端行为差异」");
}
