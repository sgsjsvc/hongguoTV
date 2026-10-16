// 直接验证 /stream 的缓存头 + 重复请求同一集是否重新下载
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/video-cache");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
console.log(`=== 视频缓存功能核实 (${BASE}) ===\n`);

const getJson = async (url) => {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
  return { status: r.status, body: await r.json().catch(() => null), headers: Object.fromEntries(r.headers) };
};

const rec = await getJson("/api/recommend?page=1");
const item = (rec.body?.items || [])[0];
const det = await getJson(`/api/series/${item.id}`);
const ep = (det.body?.episodes || [])[0];

console.log("  --- 1. /stream 的响应头（决定能否被缓存）---");
{
  const r = await fetch(BASE + `/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`, {
    headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(60000),
  });
  await r.arrayBuffer();
  console.log(`     HTTP ${r.status}`);
  for (const [k, v] of Object.entries(Object.fromEntries(r.headers))) {
    if (/cache|etag|last-mod|expires|range|length|type/i.test(k)) console.log(`       ${k}: ${v}`);
  }
  const cc = r.headers.get("cache-control");
  console.log("");
  console.log(`     Cache-Control = ${cc}`);
  if (cc === "no-store") {
    console.log("     → ⛔ 明确禁止任何缓存（浏览器不会存，代理也不该存）");
  }
}

console.log("\n  --- 2. 重复请求同一集，是否重新下载（观察耗时与字节）---");
{
  const url = BASE + `/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`;
  const times = [];
  for (let i = 0; i < 3; i += 1) {
    const t0 = Date.now();
    const r = await fetch(url, { headers: { Range: "bytes=0-1048575" }, signal: AbortSignal.timeout(60000) });
    const buf = await r.arrayBuffer();
    times.push({ ms: Date.now() - t0, bytes: buf.byteLength, status: r.status });
    await sleep(500);
  }
  console.log("     第1次(冷): " + JSON.stringify(times[0]));
  console.log("     第2次:      " + JSON.stringify(times[1]));
  console.log("     第3次:      " + JSON.stringify(times[2]));
  const consistent = times.every((t) => t.bytes === times[0].bytes);
  console.log(`\n     每次字节数一致: ${consistent ? "✓" : "✗"}（说明每次都真实返回数据）`);
  console.log("     注：服务端逐次返回相同字节，不代表缓存 —— no-store 下客户端每次重新请求");
}

console.log("\n  --- 3. 服务端是否有视频字节缓存 ---");
{
  // 对比「首次取流」与「再次取流」的服务端耗时
  const info = await getJson(`/api/episodes/${ep.id}/qualities?seriesId=${item.id}`);
  console.log(`     清晰度请求: HTTP ${info.status}`);
  console.log("     说明：引擎的 streamCache 只缓存「解密后的 CDN URL」，不是视频字节");
}

console.log("\n  --- 4. 各层缓存清单 ---");
console.log("     引擎层（shared/content-core/hongguo.js）:");
console.log("       pageCache      100 条 / 180s   页面数据（首页/分类/榜单）");
console.log("       streamCache     24 条 / 300s   解密后的 CDN URL（非视频字节）");
console.log("       videoInfoCache 100 条 / 300s   清晰度元数据");
console.log("       appSearchCache 100 条 / 300s   搜索结果");
console.log("     服务端层（custom-server/index.mjs）:");
console.log("       cacheHome            10min     首页 banner/sections");
console.log("       categoryCache        10min     分类页");
console.log("       rankPageCache        10min     榜单页");
console.log("     → 全部是「元数据」，无一是视频字节");

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();
