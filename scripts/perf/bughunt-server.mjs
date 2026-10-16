// 实测 bug 排查：服务端异常路径与边界
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt-server");
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
console.log(`=== 服务端异常路径排查 (${BASE}) ===\n`);

const req = async (method, url, opts = {}) => {
  try {
    const r = await fetch(BASE + url, { method, ...opts, signal: AbortSignal.timeout(60000) });
    let j = null; try { j = await r.json(); } catch { j = null; }
    return { status: r.status, body: j, headers: Object.fromEntries(r.headers) };
  } catch (e) {
    return { status: -1, error: e.message };
  }
};

console.log("  --- 1. 参数校验 ---");
{
  const r = await req("GET", "/api/series/notanumber");
  note("非法剧集 ID 不崩溃", r.status >= 400 && r.status < 600, `HTTP ${r.status}`);
}
{
  const r = await req("GET", "/api/series/999999999999999999999");
  note("超长 ID 不崩溃", r.status >= 400 && r.status < 600, `HTTP ${r.status}`);
}
{
  const r = await req("GET", "/api/episodes/1/qualities?seriesId=2");
  note("无效分集 ID 不崩溃", r.status >= 400 && r.status < 600, `HTTP ${r.status}`);
}
{
  const r = await req("GET", "/api/recommend?page=0");
  note("page=0 被拒", r.status >= 400, `HTTP ${r.status}`);
}
{
  const r = await req("GET", "/api/recommend?page=99999");
  note("超大 page 被拒或空结果", r.status >= 400 || (r.body?.items || []).length === 0, `HTTP ${r.status}`);
}

console.log("\n  --- 2. Range 请求边界 ---");
{
  const rec = await req("GET", "/api/recommend?page=1");
  const item = (rec.body?.items || [])[0];
  const det = await req("GET", `/api/series/${item.id}`);
  const ep = (det.body?.episodes || [])[0];

  const cases = [
    ["bytes=0-0", 206, "单字节"],
    ["bytes=0-1023", 206, "正常范围"],
    ["bytes=-1024", 206, "后缀范围"],
    ["bytes=999999999999-", 416, "越界起点"],
    ["bytes=100-50", 416, "起点大于终点"],
    ["garbage", 200, "非法格式（应忽略或 416）"],
  ];
  for (const [range, expect, desc] of cases) {
    const r = await fetch(BASE + `/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`, {
      headers: { Range: range }, signal: AbortSignal.timeout(60000),
    });
    const ok = r.status === expect || (expect === 200 && r.status === 206);
    const bytes = (await r.arrayBuffer()).byteLength;
    note(`Range "${range}" (${desc})`, ok, `HTTP ${r.status} ${bytes}B`);
  }
}

console.log("\n  --- 3. 并发与资源 ---");
{
  const rec = await req("GET", "/api/recommend?page=1");
  const items = rec.body?.items || [];
  // 并发请求 5 个不同剧集详情
  const t0 = Date.now();
  const results = await Promise.all(items.slice(0, 5).map((it) => req("GET", `/api/series/${it.id}`)));
  const okCount = results.filter((r) => r.status === 200).length;
  note("5 个并发详情全部成功", okCount === 5, `${okCount}/5，耗时 ${Date.now() - t0}ms`);
}
{
  // 并发取流
  const rec = await req("GET", "/api/recommend?page=1");
  const item = (rec.body?.items || [])[0];
  const det = await req("GET", `/api/series/${item.id}`);
  const eps = (det.body?.episodes || []).slice(0, 3);
  const t0 = Date.now();
  const results = await Promise.all(eps.map((e) =>
    fetch(BASE + `/api/episodes/${e.id}/stream?quality=720P&seriesId=${item.id}`, {
      headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(60000),
    }).then((r) => r.status).catch(() => -1)
  ));
  const okCount = results.filter((s) => s === 206).length;
  note("3 个并发取流成功", okCount >= 2, `${okCount}/3，耗时 ${Date.now() - t0}ms`);
}

console.log("\n  --- 4. 客户端断开（资源泄漏检查）---");
{
  const rec = await req("GET", "/api/recommend?page=1");
  const item = (rec.body?.items || [])[0];
  const det = await req("GET", `/api/series/${item.id}`);
  const ep = (det.body?.episodes || [])[0];
  // 发起请求后立即中断
  for (let i = 0; i < 3; i += 1) {
    const ac = new AbortController();
    const p = fetch(BASE + `/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`, {
      headers: { Range: "bytes=0-1048575" }, signal: ac.signal,
    }).catch(() => {});
    setTimeout(() => ac.abort(), 50);
    await p;
  }
  await sleep(2000);
  // 服务应仍健康
  const h = await req("GET", "/health");
  note("客户端中断后服务仍健康", h.status === 200 && h.body?.ok === true, `HTTP ${h.status}`);
}

console.log("\n  --- 5. 健康检查语义 ---");
{
  const h = await req("GET", "/health");
  note("ok 表示进程存活", h.body?.ok === true);
  note("有 playback 段", !!h.body?.playback, JSON.stringify(h.body?.playback?.stats));
  note("有 upstreamHealthy 字段", typeof h.body?.playback?.upstreamHealthy === "boolean", String(h.body?.playback?.upstreamHealthy));
}

console.log("\n  --- 6. 静态资源与 404 ---");
{
  const r = await req("GET", "/nonexistent-page");
  note("未知路径返回 HTML 或 404（不崩溃）", r.status === 200 || r.status === 404, `HTTP ${r.status}`);
}
{
  const r = await req("GET", "/api/nonexistent");
  note("未知 API 返回 404", r.status === 404, `HTTP ${r.status}`);
}

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
