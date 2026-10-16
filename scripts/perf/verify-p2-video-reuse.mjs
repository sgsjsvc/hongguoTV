// P2 验收：验证 video 元素在切集时不重建 + 播放新集内容
// 用 CDP 驱动浏览器（需 Vite dev server 运行）
const CDP = process.env.CDP || "http://127.0.0.1:9222";

async function main() {
  let targets;
  try {
    targets = await (await fetch(`${CDP}/json/list`)).json();
  } catch (e) {
    console.log("  无 CDP 端点 —— 需启动带 --remote-debugging-port 的浏览器");
    console.log("  " + e.message);
    return;
  }
  const page = targets.find((t) => t.type === "page" && (t.url.includes("3000") || t.url.includes("8788")));
  if (!page) {
    console.log("  未找到目标页面");
    console.log("  可用:", targets.filter((t) => t.type === "page").map((t) => t.url).join(", "));
    return;
  }
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

  console.log("\n  === 1. 页面状态 ===");
  console.log("   ", await ev(`JSON.stringify({
    readyState: document.readyState,
    hasVideo: !!document.querySelector('video'),
    url: location.href
  })`));

  console.log("\n  === 2. 标记当前 video 元素 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video';
    v.__marker = 'ORIGINAL_' + Date.now();
    window.__videoRef = v;
    return JSON.stringify({
      marker: v.__marker,
      src: (v.src||'').slice(-50),
      readyState: v.readyState
    });
  })()`));

  console.log("\n  === 3. 触发切集（点击下一集按钮）===");
  console.log("   ", await ev(`(()=>{
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => (b.textContent||'').includes('下一集'));
    if(!next) return 'no next button; buttons=' + btns.map(b=>b.textContent.trim().slice(0,8)).join('|');
    next.click();
    return 'clicked';
  })()`));
  await new Promise((r) => setTimeout(r, 3000));

  console.log("\n  === 4. 切集后检查元素是否复用 ===");
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    if(!v) return 'no video after';
    return JSON.stringify({
      同一个元素: window.__videoRef === v,
      marker保留: v.__marker || null,
      newSrc: (v.src||'').slice(-50),
      readyState: v.readyState,
      paused: v.paused,
      currentTime: v.currentTime
    });
  })()`));

  console.log("\n  === 5. 再次切集验证稳定性 ===");
  await ev(`(()=>{
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => (b.textContent||'').includes('下一集'));
    if(next) next.click();
  })()`);
  await new Promise((r) => setTimeout(r, 3000));
  console.log("   ", await ev(`(()=>{
    const v = document.querySelector('video');
    return JSON.stringify({
      仍是同一元素: window.__videoRef === v,
      src: (v.src||'').slice(-50),
      readyState: v.readyState,
      paused: v.paused
    });
  })()`));

  console.log("\n  === 判定 ===");
  console.log("  若「同一个元素」为 true -> P2 达成（元素未重建）");
  console.log("  若 false -> 元素仍被重建");

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
