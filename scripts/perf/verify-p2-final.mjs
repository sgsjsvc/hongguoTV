// P2 深度验证 v2：用可用的剧集测试，确认切集后真正加载新集
const CDP = "http://127.0.0.1:9222";

async function main() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  const ev = async (x, a = false) => {
    const r = await send("Runtime.evaluate", { expression: x, awaitPromise: a, returnByValue: true });
    return r?.result?.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. 从服务端挑一个流可用的剧集
  console.log("  === 1. 挑选流可用的剧集 ===");
  const picked = await ev(`(async()=>{
    const rec = await fetch('/api/recommend?page=1').then(r=>r.json());
    for (const it of (rec.items||[]).slice(0,6)) {
      try {
        const det = await fetch('/api/series/'+it.id).then(r=>r.json());
        const ep = (det.episodes||[])[0];
        if(!ep) continue;
        const resp = await fetch('/api/episodes/'+ep.id+'/stream?quality=720P&seriesId='+it.id, {headers:{Range:'bytes=0-1023'}});
        if (resp.status === 206) return JSON.stringify({ id: it.id, title: (it.title||'').slice(0,14), ep: ep.id, ok: true });
      } catch(e){}
    }
    return JSON.stringify({ ok: false });
  })()`, true);
  console.log("   ", picked);

  const info = JSON.parse(picked);
  if (!info.ok) { console.log("  ✗ 无可用剧集"); ws.close(); return; }

  // 2. 刷新页面并进入推荐流
  console.log("\n  === 2. 刷新页面 ===");
  await send("Page.reload", { ignoreCache: true });
  await sleep(10000);
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='推荐'); if(b)b.click(); })()`);
  await sleep(10000);

  // 3. 标记 video
  console.log("  === 3. 标记 video 元素 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video';
    v.__p2m = 'M'+Date.now();
    window.__p2ref = v; window.__p2marker = v.__p2m;
    return JSON.stringify({ marker: v.__p2m, src: (v.src||'').slice(-40), readyState: v.readyState, size: v.videoWidth+'x'+v.videoHeight });
  })()`));

  // 4. 等待当前集加载
  console.log("\n  === 4. 等待当前集加载 ===");
  for (let i = 0; i < 10; i += 1) {
    await sleep(2000);
    const st = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({rs:v?.readyState,size:v?v.videoWidth+'x'+v.videoHeight:null,t:v?.currentTime})})()`);
    const s = JSON.parse(st);
    if (s.rs >= 2 && s.size !== "0x0") { console.log(`     ${i * 2}s: readyState=${s.rs} size=${s.size} t=${s.t}  ✓ 已加载`); break; }
    if (i === 9) console.log(`     最终: ${st}`);
  }

  const before = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({src:(v?.src||'').slice(-40),size:v?v.videoWidth+'x'+v.videoHeight:null,badge:(document.body.innerText.match(/第\\s*(\\d+)\\s*集/)||[])[0]})})()`);
  console.log(`     切集前: ${before}`);

  // 5. 切集
  console.log("\n  === 5. 切集 ===");
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('下一集')); if(b)b.click(); })()`);

  for (let i = 0; i < 10; i += 1) {
    await sleep(2000);
    const st = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({rs:v?.readyState,size:v?v.videoWidth+'x'+v.videoHeight:null,t:v?.currentTime,same:window.__p2ref===v,marker:v?.__p2m===window.__p2marker})})()`);
    const s = JSON.parse(st);
    if (s.rs >= 2 && s.size !== "0x0") { console.log(`     ${i * 2}s: readyState=${s.rs} size=${s.size} same=${s.same} marker=${s.marker}  ✓`); break; }
    if (i === 9) console.log(`     最终: ${st}`);
  }

  const after = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({
    同一个元素: window.__p2ref === v,
    marker保留: v?.__p2m === window.__p2marker,
    src: (v?.src||'').slice(-40),
    size: v?v.videoWidth+'x'+v.videoHeight:null,
    readyState: v?.readyState,
    集数: (document.body.innerText.match(/第\\s*(\\d+)\\s*集/)||[])[0]
  })})()`);
  console.log(`     切集后: ${after}`);

  console.log("\n  === 判定 ===");
  const r = JSON.parse(after);
  console.log(`  ${r.同一个元素 ? "✓" : "✗"} 元素复用`);
  console.log(`  ${r.marker保留 ? "✓" : "✗"} marker 保留`);
  console.log(`  ${r.readyState >= 2 ? "✓" : "⚠"} 新集已加载（readyState=${r.readyState}）`);
  console.log(`  ${r.size !== "0x0" ? "✓" : "⚠"} 视频尺寸正常（${r.size}）`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
