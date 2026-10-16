// P5 独立验证：确认轮询真的降频、后台真的不发请求
// 用 Chrome CDP 注入请求计数器，直接观测 /api/library 的调用
const CDP = process.env.CDP || "http://127.0.0.1:9222";

async function main() {
  let targets;
  try {
    targets = await (await fetch(`${CDP}/json/list`)).json();
  } catch (e) {
    console.log("  无 CDP 端点:", e.message);
    return;
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) { console.log("  无页面"); return; }
  console.log("  页面:", page.url);

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

  // 1. 注入请求计数器
  console.log("\n  === 1. 注入请求计数器 ===");
  console.log("   ", await ev(`(()=>{
    if (window.__libPoll) return 'already injected';
    window.__libPoll = [];
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      if (url.includes('/api/library')) {
        window.__libPoll.push({ t: Date.now(), hidden: document.hidden });
      }
      return origFetch.apply(this, args);
    };
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (String(url).includes('/api/library')) {
        window.__libPoll.push({ t: Date.now(), hidden: document.hidden, xhr: true });
      }
      return origOpen.call(this, method, url, ...rest);
    };
    return 'injected';
  })()`));

  // 2. 前台空闲 22 秒
  console.log("\n  === 2. 前台空闲观测（22 秒，应约 2 次）===");
  await ev(`window.__libPoll = []`);
  await sleep(22000);
  const front = await ev(`JSON.stringify({ count: window.__libPoll.length, times: window.__libPoll.map(p=>p.t) })`);
  console.log("   ", front);
  const f = JSON.parse(front);
  if (f.count >= 2) {
    const gaps = [];
    for (let i = 1; i < f.times.length; i += 1) gaps.push(f.times[i] - f.times[i - 1]);
    console.log(`     请求间隔: ${gaps.join(", ")} ms`);
    console.log(`     平均间隔: ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(0)} ms`);
  }

  // 3. 模拟后台隐藏
  console.log("\n  === 3. 后台隐藏观测（12 秒，应为 0 次）===");
  await ev(`window.__libPoll = []`);
  // 用 CDP 模拟页面隐藏
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }).catch(() => {});
  const hiddenResult = await ev(`(async()=>{
    // 模拟 document.hidden
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    return 'hidden simulated';
  })()`, true);
  console.log("   ", hiddenResult);
  await sleep(12000);
  const bg = await ev(`JSON.stringify({ count: window.__libPoll.length })`);
  console.log("   ", bg);

  // 4. 恢复前台
  console.log("\n  === 4. 恢复前台（应立即拉取一次）===");
  await ev(`window.__libPoll = []`);
  await ev(`(()=>{
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  await sleep(3000);
  const back = await ev(`JSON.stringify({ count: window.__libPoll.length })`);
  console.log("   ", back);

  // 5. 判定
  console.log("\n  === 判定 ===");
  const fg = JSON.parse(front);
  const bgg = JSON.parse(bg);
  const bk = JSON.parse(back);
  console.log(`  前台 22 秒请求数: ${fg.count}  ${fg.count <= 3 ? "✓ 已降频（原为 22 次）" : "✗ 仍高频"}`);
  console.log(`  后台 12 秒请求数: ${bgg.count}  ${bgg.count === 0 ? "✓ 完全休眠" : "✗ 仍在请求"}`);
  console.log(`  恢复前台后:       ${bk.count}  ${bk.count >= 1 ? "✓ 立即拉取" : "⚠ 未立即拉取"}`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
