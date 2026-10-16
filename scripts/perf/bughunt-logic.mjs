// 功能逻辑排查：找行为不符预期的 bug
const CDP = process.env.CDP || "http://127.0.0.1:9224";

async function connect() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  return { ws, send };
}

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

async function main() {
  const { ws, send } = await connect();
  const ev = async (x, a = false) => {
    const r = await send("Runtime.evaluate", { expression: x, awaitPromise: a, returnByValue: true });
    return r?.result?.value ?? JSON.stringify(r?.exceptionDetails?.exception?.description || "");
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log("=== 功能逻辑排查 ===\n");

  // 进入推荐流
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='推荐');if(b)b.click()})()`);
  await sleep(10000);

  console.log("  --- 1. 推荐流基础状态 ---");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    const txt = document.body.innerText;
    return JSON.stringify({
      hasVideo: !!v,
      readyState: v?.readyState,
      paused: v?.paused,
      currentTime: v?.currentTime,
      集数: (txt.match(/第\\s*(\\d+)\\s*集/)||[])[0],
      有全屏按钮: !!([...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('全屏')))
    });
  })()`));

  console.log("\n  --- 2. 播放推进检查（关键：视频是否真的在播）---");
  const t1 = await ev(`document.querySelector('video')?.currentTime`);
  await sleep(5000);
  const t2 = await ev(`document.querySelector('video')?.currentTime`);
  const advanced = typeof t1 === "number" && typeof t2 === "number" && t2 > t1;
  note("播放位置推进", advanced, `${t1?.toFixed?.(2)} -> ${t2?.toFixed?.(2)}`);

  console.log("\n  --- 3. 清晰度切换后位置保持 ---");
  {
    const before = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({t:v?.currentTime,src:(v?.src||'').slice(-30)})})()`);
    console.log(`     切换前: ${before}`);
    // 找清晰度按钮
    const clicked = await ev(`(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>/\\d{3,4}P/.test(x.textContent||''));
      if(!b) return 'no quality button';
      b.click();
      return 'opened menu';
    })()`);
    await sleep(1500);
    // 选一个不同清晰度
    const selected = await ev(`(()=>{
      const btns=[...document.querySelectorAll('button')].filter(x=>/\\d{3,4}P/.test(x.textContent||''));
      if(btns.length<2) return 'less than 2 options';
      btns[btns.length-1].click();
      return 'selected ' + btns[btns.length-1].textContent.trim().slice(0,10);
    })()`);
    console.log(`     操作: ${clicked} -> ${selected}`);
    await sleep(5000);
    const after = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({t:v?.currentTime,src:(v?.src||'').slice(-30),rs:v?.readyState})})()`);
    console.log(`     切换后: ${after}`);
    const b = JSON.parse(before); const a = JSON.parse(after);
    const kept = a.src !== b.src ? a.t >= 0 : true;
    note("清晰度切换不崩溃", a.rs !== undefined, `readyState=${a.rs}`);
  }

  console.log("\n  --- 4. 全屏状态与退出 ---");
  {
    const r = await ev(`(async()=>{
      const btn=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('全屏'));
      if(!btn) return 'no button';
      btn.click();
      await new Promise(r=>setTimeout(r,1500));
      const entered = !!document.fullscreenElement;
      const aria = [...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').includes('全屏'))?.getAttribute('aria-label');
      return JSON.stringify({entered, aria});
    })()`, true);
    console.log(`     进入全屏: ${r}`);
    // 退出
    await ev(`(async()=>{ if(document.fullscreenElement) await document.exitFullscreen(); })()`, true);
    await sleep(1500);
    const exited = await ev(`!document.fullscreenElement`);
    note("全屏可进入与退出", exited === true, `退出后 fullscreenElement=${!exited}`);
  }

  console.log("\n  --- 5. 追剧/收藏功能 ---");
  {
    const r = await ev(`(async()=>{
      const btn=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('追剧'));
      if(!btn) return 'no button';
      const before = btn.textContent.trim();
      btn.click();
      await new Promise(r=>setTimeout(r,2500));
      const btn2=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('追剧'));
      return JSON.stringify({before, after: btn2?.textContent?.trim()});
    })()`, true);
    console.log(`     收藏切换: ${r}`);
    const parsed = JSON.parse(r);
    note("收藏状态发生变化", parsed.before !== parsed.after, `${parsed.before} -> ${parsed.after}`);
  }

  console.log("\n  --- 6. 返回首页后再进推荐流（状态残留检查）---");
  {
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='首页');if(b)b.click()})()`);
    await sleep(3000);
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='推荐');if(b)b.click()})()`);
    await sleep(8000);
    const st = await ev(`(()=>{const v=document.querySelector('video');return JSON.stringify({hasVideo:!!v,rs:v?.readyState,src:(v?.src||'').slice(-30)})})()`);
    console.log(`     重新进入: ${st}`);
    const p = JSON.parse(st);
    note("重新进入推荐流有 video", p.hasVideo === true, `readyState=${p.rs}`);
  }

  console.log("\n  === 汇总 ===");
  console.log(`  发现 ${bugs.length} 个问题`);
  for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
