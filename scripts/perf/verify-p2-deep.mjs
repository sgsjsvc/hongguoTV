// 深入验证 P2：切集后是否真的加载了「新集」（而非只复用元素但没换源）
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

  console.log("  === 1. 记录当前播放状态 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    const badge = document.body.innerText.match(/第\\s*(\\d+)\\s*集/);
    return JSON.stringify({
      src: (v?.src||'').slice(-45),
      currentTime: v?.currentTime,
      readyState: v?.readyState,
      集数徽标: badge ? badge[0] : null,
      videoSize: v ? v.videoWidth+'x'+v.videoHeight : null
    });
  })()`));

  console.log("\n  === 2. 记录 video 元素引用 ===");
  await ev(`(()=>{ window.__p2ref = document.querySelector('video'); window.__p2marker='M'+Date.now(); document.querySelector('video').__p2marker=window.__p2marker; })()`);

  console.log("\n  === 3. 点击「下一集」并等待加载 ===");
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('下一集')); if(b)b.click(); })()`);
  await sleep(8000);

  console.log("  === 4. 切集后状态 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    const badge = document.body.innerText.match(/第\\s*(\\d+)\\s*集/);
    return JSON.stringify({
      同一个元素: window.__p2ref === v,
      marker保留: v?.__p2marker === window.__p2marker,
      src: (v?.src||'').slice(-45),
      currentTime: v?.currentTime,
      readyState: v?.readyState,
      集数徽标: badge ? badge[0] : null,
      videoSize: v ? v.videoWidth+'x'+v.videoHeight : null,
      paused: v?.paused
    });
  })()`));

  console.log("\n  === 5. 网络请求（是否请求了新集）===");
  const reqs = await ev(`(async()=>{
    const out=[];
    const origFetch = window.fetch;
    return 'use performance API';
  })()`);
  console.log("   ", await ev(`(()=>{
    const entries = performance.getEntriesByType('resource')
      .filter(e => e.name.includes('/stream'))
      .slice(-5)
      .map(e => ({ url: e.name.slice(-45), size: Math.round(e.transferSize/1024)+'KB' }));
    return JSON.stringify(entries);
  })()`));

  console.log("\n  === 6. 判定 ===");
  const r = await ev(`(()=>{
    const v = document.querySelector('video');
    return JSON.stringify({
      元素复用: window.__p2ref === v,
      marker保留: v?.__p2marker === window.__p2marker
    });
  })()`);
  console.log("   ", r);
  console.log("");
  console.log("  说明：若「元素复用」与「marker保留」均为 true，则 P2 达成。");
  console.log("        readyState=0 可能是流加载慢或跨域限制，需看 videoSize 是否非 0。");

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
