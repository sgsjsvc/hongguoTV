// P2 验收：进入推荐流后验证 video 元素复用
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

  console.log("  === 1. 点击「推荐」进入推荐流 ===");
  console.log("   ", await ev(`(()=>{
    const btns = [...document.querySelectorAll('button')];
    const rec = btns.find(b => (b.textContent||'').trim() === '推荐');
    if(!rec) return 'no 推荐 button';
    rec.click();
    return 'clicked 推荐';
  })()`));
  await sleep(8000);

  console.log("\n  === 2. 检查 video 是否出现 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    return JSON.stringify({
      hasVideo: !!v,
      src: v ? (v.src||'').slice(-60) : null,
      readyState: v?.readyState,
      paused: v?.paused
    });
  })()`));

  const hasVideo = await ev(`!!document.querySelector('video')`);
  if (!hasVideo) {
    console.log("\n  ⚠ 推荐流未出现 video，可能仍在加载或需要点击播放");
    // 尝试点击剧集卡片
    console.log("  尝试点击第一个卡片…");
    await ev(`(()=>{
      const cards = [...document.querySelectorAll('[class*="cursor-pointer"], button, img')];
      for(const c of cards){ if(c.closest('[class*="grid"]') || c.tagName==='IMG'){ c.click(); return 'clicked card'; } }
      return 'no card';
    })()`);
    await sleep(8000);
    console.log("   ", await ev(`JSON.stringify({hasVideo: !!document.querySelector('video')})`));
  }

  console.log("\n  === 3. 标记 video 元素 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video';
    v.__p2marker = 'M' + Date.now();
    window.__p2ref = v;
    return JSON.stringify({ marker: v.__p2marker, src: (v.src||'').slice(-50), readyState: v.readyState });
  })()`));

  console.log("\n  === 4. 切集（找「下一集」按钮）===");
  console.log("   ", await ev(`(()=>{
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => (b.textContent||'').includes('下一集'));
    if(!next) return 'no 下一集; buttons=' + btns.map(b=>(b.textContent||'').trim().slice(0,6)).filter(Boolean).join('|');
    next.click();
    return 'clicked 下一集';
  })()`));
  await sleep(4000);

  console.log("\n  === 5. 切集后：元素是否复用 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video after';
    return JSON.stringify({
      同一个元素: window.__p2ref === v,
      marker: v.__p2marker || null,
      newSrc: (v.src||'').slice(-50),
      readyState: v.readyState,
      paused: v.paused,
      currentTime: v.currentTime
    });
  })()`));

  console.log("\n  === 6. 再切一次 ===");
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('下一集')); if(b)b.click(); })()`);
  await sleep(4000);
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    return JSON.stringify({
      仍是同一元素: window.__p2ref === v,
      src: (v.src||'').slice(-50),
      readyState: v.readyState
    });
  })()`));

  console.log("\n  === 判定 ===");
  const reused = await ev(`window.__p2ref === document.querySelector('video')`);
  console.log(`  ${reused ? "✓ P2 达成：video 元素未重建" : "✗ 元素仍被重建"}`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
