// 确认候选问题：播放未推进 & 收藏未变化
const CDP = process.env.CDP || "http://127.0.0.1:9224";

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

  console.log("=== 候选问题确认 ===\n");

  console.log("  --- A. 播放未推进：是自动播放策略还是 bug？---");
  const state = await ev(`(()=>{
    const v = document.querySelector('video');
    return JSON.stringify({
      paused: v?.paused,
      readyState: v?.readyState,
      networkState: v?.networkState,
      error: v?.error ? {code:v.error.code, msg:v.error.message} : null,
      src: (v?.src||'').slice(-40),
      autoplay: v?.autoplay,
      muted: v?.muted,
      volume: v?.volume
    });
  })()`);
  console.log(`     状态: ${state}`);

  const s = JSON.parse(state);
  console.log("\n     诊断：");
  if (s.paused) {
    console.log(`     ⚠ video 处于 paused 状态`);
    console.log(`       autoplay 属性: ${s.autoplay}`);
    console.log(`       muted: ${s.muted}`);
    console.log("");
    console.log("     可能原因：");
    console.log("       1. 浏览器自动播放策略（未静音时禁止自动播放）");
    console.log("       2. 代码未调用 play()");
    console.log("       3. 需要用户手势");
  }

  // 尝试手动播放
  console.log("\n  --- 尝试手动 play() ---");
  const playResult = await ev(`(async()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video';
    try {
      await v.play();
      await new Promise(r=>setTimeout(r,3000));
      return JSON.stringify({ok:true, paused:v.paused, t:v.currentTime});
    } catch(e) {
      return JSON.stringify({ok:false, err:e.name+': '+e.message});
    }
  })()`, true);
  console.log(`     ${playResult}`);

  console.log("\n  --- B. 收藏未变化：是按钮定位问题还是 bug？---");
  const favState = await ev(`(()=>{
    const btns = [...document.querySelectorAll('button')];
    const fav = btns.filter(b => (b.textContent||'').includes('追剧'));
    return JSON.stringify(fav.map(b => ({
      text: b.textContent.trim().slice(0,20),
      aria: b.getAttribute('aria-label'),
      cls: (b.className||'').slice(0,60),
      visible: b.offsetParent !== null
    })));
  })()`);
  console.log(`     找到 ${JSON.parse(favState).length} 个含「追剧」的按钮:`);
  for (const b of JSON.parse(favState)) {
    console.log(`       text="${b.text}" aria="${b.aria}" visible=${b.visible}`);
  }

  console.log("\n  --- 尝试点击收藏按钮并观察 ---");
  const favClick = await ev(`(async()=>{
    const btns = [...document.querySelectorAll('button')];
    // 找最可能是收藏按钮的（aria 或 text 精确匹配）
    const fav = btns.find(b => (b.getAttribute('aria-label')||'').includes('追剧')) ||
                btns.find(b => (b.textContent||'').trim() === '追剧');
    if(!fav) return 'no fav button';
    const before = { text: fav.textContent.trim(), aria: fav.getAttribute('aria-label'), cls: fav.className.slice(0,80) };
    fav.click();
    await new Promise(r=>setTimeout(r,3000));
    const after = btns.find(b => (b.getAttribute('aria-label')||'').includes('追剧')) ||
                  btns.find(b => (b.textContent||'').trim() === '追剧');
    return JSON.stringify({
      before,
      after: after ? { text: after.textContent.trim(), aria: after.getAttribute('aria-label'), cls: after.className.slice(0,80) } : null,
      changed: after ? (before.text !== after.textContent.trim() || before.aria !== after.getAttribute('aria-label')) : false
    });
  })()`, true);
  console.log(`     ${favClick}`);

  console.log("\n  === 判定 ===");
  const fr = JSON.parse(favClick);
  console.log(`  播放: ${JSON.parse(playResult).ok ? "手动 play() 成功 -> 是自动播放策略限制，非代码 bug" : "手动 play() 也失败 -> 可能是代码 bug"}`);
  console.log(`  收藏: ${fr.changed ? "状态有变化 -> 之前是按钮定位问题" : "状态未变 -> 需进一步排查"}`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
