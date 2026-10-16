// 契约验证：逐个调用前端使用的 API，确认响应结构符合前端期望
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt-contract");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data") },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log); child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
console.log(`=== API 契约验证 (${BASE}) ===\n`);

const get = async (url) => {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};

// 1. /api/banners
console.log("  --- /api/banners ---");
{
  const r = await get("/api/banners");
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 banners 数组", Array.isArray(r.body?.banners), `类型 ${typeof r.body?.banners}`);
  if (Array.isArray(r.body?.banners) && r.body.banners.length) {
    const b = r.body.banners[0];
    note("banner 含必要字段", !!(b.id || b.title || b.cover), JSON.stringify(Object.keys(b).slice(0, 6)));
  }
}

// 2. /api/sections
console.log("\n  --- /api/sections ---");
{
  const r = await get("/api/sections");
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 sections 数组", Array.isArray(r.body?.sections), `类型 ${typeof r.body?.sections}`);
  if (Array.isArray(r.body?.sections) && r.body.sections.length) {
    const s = r.body.sections[0];
    note("section 含 items", Array.isArray(s.items), `items 类型 ${typeof s.items}`);
  }
}

// 3. /api/recommend
console.log("\n  --- /api/recommend ---");
{
  const r = await get("/api/recommend?page=1");
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 items 数组", Array.isArray(r.body?.items), `${(r.body?.items || []).length} 条`);
  note("含 session", typeof r.body?.session === "string", (r.body?.session || "").slice(0, 16));
  if ((r.body?.items || []).length) {
    const it = r.body.items[0];
    const required = ["id", "title", "cover", "badge", "tags"];
    const missing = required.filter((k) => it[k] === undefined);
    note("item 含前端所需字段", missing.length === 0, missing.length ? `缺 ${missing.join(",")}` : `id/title/cover/badge/tags 齐全`);
  }
}

// 4. /api/series/:id
console.log("\n  --- /api/series/:id ---");
let seriesId = null;
{
  const rec = await get("/api/recommend?page=1");
  seriesId = (rec.body?.items || [])[0]?.id;
  const r = await get(`/api/series/${seriesId}`);
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  const required = ["id", "title", "cover", "episodes"];
  const missing = required.filter((k) => r.body?.[k] === undefined);
  note("含前端所需字段", missing.length === 0, missing.length ? `缺 ${missing.join(",")}` : "id/title/cover/episodes 齐全");
  note("episodes 是非空数组", Array.isArray(r.body?.episodes) && r.body.episodes.length > 0, `${(r.body?.episodes || []).length} 集`);
  if ((r.body?.episodes || []).length) {
    const ep = r.body.episodes[0];
    note("episode 含 id/title/number", ep.id !== undefined && ep.title !== undefined && ep.number !== undefined, JSON.stringify(Object.keys(ep)));
  }
}

// 5. /api/episodes/:id/qualities
console.log("\n  --- /api/episodes/:id/qualities ---");
let episodeId = null;
{
  const det = await get(`/api/series/${seriesId}`);
  episodeId = (det.body?.episodes || [])[0]?.id;
  const r = await get(`/api/episodes/${episodeId}/qualities?seriesId=${seriesId}`);
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 qualities 数组", Array.isArray(r.body?.qualities), `${(r.body?.qualities || []).length} 档`);
  note("含 defaultQuality", r.body?.defaultQuality !== undefined, String(r.body?.defaultQuality));
  if ((r.body?.qualities || []).length) {
    const q = r.body.qualities[0];
    const required = ["key", "label", "qualityNum", "codec"];
    const missing = required.filter((k) => q[k] === undefined);
    note("quality 含前端所需字段", missing.length === 0, missing.length ? `缺 ${missing.join(",")}` : JSON.stringify(q));
  }
}

// 6. /api/rank/types 与 /api/ranks
console.log("\n  --- /api/rank/types 与 /api/ranks ---");
{
  const r = await get("/api/rank/types");
  note("rank/types 返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 types 数组", Array.isArray(r.body?.types), `${(r.body?.types || []).length} 项`);
}
{
  const r = await get("/api/ranks");
  note("ranks 返回 200", r.status === 200, `HTTP ${r.status}`);
  const isArr = Array.isArray(r.body) || Array.isArray(r.body?.items) || Array.isArray(r.body?.ranks);
  note("ranks 返回数组或含数组字段", isArr, `keys=${Object.keys(r.body || {}).slice(0, 6).join(",")}`);
}

// 7. /api/category/tags
console.log("\n  --- /api/category/tags ---");
{
  const r = await get("/api/category/tags?type=real-drama");
  note("返回 200", r.status === 200, `HTTP ${r.status}`);
  note("含 tags 数组", Array.isArray(r.body?.tags), `${(r.body?.tags || []).length} 项`);
}

// 8. /api/library 与 operations
console.log("\n  --- /api/library 与 operations ---");
{
  const r = await get("/api/library");
  note("library 返回 200", r.status === 200, `HTTP ${r.status}`);
  const required = ["favorites", "history", "preferences", "serverTime"];
  const missing = required.filter((k) => r.body?.[k] === undefined);
  note("含前端所需字段", missing.length === 0, missing.length ? `缺 ${missing.join(",")}` : "favorites/history/preferences/serverTime 齐全");
}
{
  const r = await fetch(BASE + "/api/library/operations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [] }), signal: AbortSignal.timeout(30000),
  });
  note("operations 空数组不报错", r.status === 200 || r.status === 204, `HTTP ${r.status}`);
}
{
  const r = await fetch(BASE + "/api/library/operations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [{ bogus: true }] }), signal: AbortSignal.timeout(30000),
  });
  note("operations 非法内容被拒（不崩溃）", r.status >= 400 && r.status < 600, `HTTP ${r.status}`);
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个契约问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
