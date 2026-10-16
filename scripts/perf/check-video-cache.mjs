// 实证：视频字节是否被浏览器缓存？
// 方法：用 CDP 播放视频，观察网络请求是否命中缓存（fromDiskCache / fromMemoryCache）
const CDP = process.env.CDP || "http://127.0.0.1:9222";

async function main() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) { console.log("  无页面"); return; }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const requests = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });

  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    // 记录网络事件
    if (m.method === "Network.requestWillBeSent") {
      const url = m.params.request.url;
      if (url.includes("/stream") || url.includes("/api/episodes")) {
        requests.set(m.params.requestId, { url, fromCache: null, status: null, type: m.params.type });
      }
    }
    if (m.method === "Network.responseReceived") {
      const r = requests.get(m.params.requestId);
      if (r) {
        r.status = m.params.response.status;
        r.fromCache = m.params.response.fromDiskCache ? "disk"
          : m.params.response.fromPrefetchCache ? "prefetch"
          : m.params.response.fromServiceWorker ? "sw" : "network";
        r.cacheHeaders = {
          "cache-control": m.params.response.headers["cache-control"],
          "content-length": m.params.response.headers["content-length"],
        };
      }
    }
    if (m.method === "Network.loadingFinished") {
      const r = requests.get(m.params.requestId);
      if (r) r.encodedDataLength = m.params.encodedDataLength;
    }
  };

  await send("Network.enable");
  await send("Runtime.enable");
  const ev = async (x, a = false) => {
    const r = await send("Runtime.evaluate", { expression: x, awaitPromise: a, returnByValue: true });
    return r?.result?.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log("=== 视频缓存实证（CDP 网络观测）===\n");

  // 进入推荐流
  console.log("  1. 进入推荐流并播放");
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='推荐');if(b)b.click()})()`);
  await sleep(12000);

  // 强制播放（绕过自动播放策略）
  await ev(`(async()=>{const v=document.querySelector('video');if(v){v.muted=true;try{await v.play()}catch(e){}}})()`, true);
  await sleep(10000);

  const st = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({rs:v?.readyState,t:v?.currentTime,paused:v?.paused,src:(v?.src||'').slice(-40)})})()`);
  console.log(`     播放状态: ${st}`);

  // 2. 观察网络请求
  console.log("\n  2. 视频流请求（是否命中缓存）");
  const streamReqs = [...requests.values()].filter((r) => r.url.includes("/stream"));
  console.log(`     /stream 请求数: ${streamReqs.length}`);
  for (const r of streamReqs.slice(0, 6)) {
    console.log(`       ${r.url.slice(-45)}`);
    console.log(`         status=${r.status}  from=${r.fromCache}  cache-control=${r.cacheHeaders?.["cache-control"]}  bytes=${r.encodedDataLength ?? "?"}`);
  }

  // 3. 关键测试：切集后回到原集，看是否重新下载
  console.log("\n  3. 关键测试：切集 → 切回原集，观察是否重新下载");
  requests.clear();

  const before = await ev(`(document.body.innerText.match(/第\\s*(\\d+)\\s*集/)||[])[0]`);
  console.log(`     当前: ${before}`);

  // 切到下一集
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('下一集'));if(b)b.click()})()`);
  await sleep(10000);
  const after = await ev(`(document.body.innerText.match(/第\\s*(\\d+)\\s*集/)||[])[0]`);
  console.log(`     切集后: ${after}`);

  const nextReqs = [...requests.values()].filter((r) => r.url.includes("/stream"));
  console.log(`     切集产生的 /stream 请求: ${nextReqs.length}`);
  for (const r of nextReqs.slice(0, 4)) {
    console.log(`       status=${r.status}  from=${r.fromCache}  bytes=${r.encodedDataLength ?? "?"}`);
  }

  // 4. 检查浏览器缓存存储
  console.log("\n  4. 浏览器缓存存储量");
  const cacheInfo = await ev(`(async()=>{
    try {
      const names = await caches.keys();
      const out = [];
      for (const n of names) {
        const c = await caches.open(n);
        const keys = await c.keys();
        out.push({ name: n, entries: keys.length });
      }
      return JSON.stringify({ cacheStorage: out, quota: navigator.storage ? 'available' : 'n/a' });
    } catch(e) { return JSON.stringify({ error: e.message }); }
  })()`, true);
  console.log(`     ${cacheInfo}`);

  // 5. 判定
  console.log("\n  === 判定 ===");
  const anyDiskCache = streamReqs.some((r) => r.fromCache === "disk");
  const allNoStore = streamReqs.every((r) => r.cacheHeaders?.["cache-control"] === "no-store");
  console.log(`  /stream 响应带 Cache-Control: no-store: ${allNoStore ? "✓ 是" : "✗ 否"}`);
  console.log(`  观察到磁盘缓存命中: ${anyDiskCache ? "⚠ 是" : "✓ 否"}`);
  console.log("");
  if (allNoStore && !anyDiskCache) {
    console.log("  → 视频字节不被浏览器缓存（每次播放都重新下载）");
  } else {
    console.log("  → 部分视频字节被缓存");
  }

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
