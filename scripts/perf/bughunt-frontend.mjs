// 前端实测 bug 排查：用 CDP 驱动浏览器，检查控制台错误与异常行为
const CDP = process.env.CDP || "http://127.0.0.1:9222";

async function connect() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("无页面");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  return { ws, send, events, page };
}

async function main() {
  const { ws, send, events, page } = await connect();
  console.log(`  页面: ${page.url}\n`);

  const ev = async (x, a = false) => {
    const r = await send("Runtime.evaluate", { expression: x, awaitPromise: a, returnByValue: true });
    return r?.result?.value ?? JSON.stringify(r?.exceptionDetails?.exception?.description || "");
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 启用控制台与网络监听
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");

  console.log("  === 1. 捕获控制台错误（清空后重载）===");
  events.length = 0;
  await send("Page.reload", { ignoreCache: true });
  await sleep(12000);

  const consoleErrors = events
    .filter((e) => e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type))
    .map((e) => ({
      type: e.params.type,
      text: (e.params.args || []).map((a) => a.value || a.description || "").join(" ").slice(0, 200),
    }));
  const exceptions = events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => (e.params.exceptionDetails?.exception?.description || "").slice(0, 200));

  console.log(`     控制台错误/警告: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 10)) console.log(`       [${e.type}] ${e.text}`);
  console.log(`     未捕获异常: ${exceptions.length}`);
  for (const e of exceptions.slice(0, 5)) console.log(`       ${e}`);

  console.log("\n  === 2. 页面基础健康 ===");
  console.log("   ", await ev(`JSON.stringify({
    readyState: document.readyState,
    title: document.title,
    hasApp: !!document.querySelector('#root, [id*=root], main'),
    bodyChildren: document.body.children.length,
    localStorage: Object.keys(localStorage).length
  })`));

  console.log("\n  === 3. 导航到各页面，捕获错误 ===");
  const pages = ["推荐", "分类", "榜单", "搜索", "追剧", "设置"];
  for (const name of pages) {
    events.length = 0;
    const clicked = await ev(`(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='${name}');
      if(!b) return 'not found';
      b.click(); return 'ok';
    })()`);
    await sleep(4000);
    const errs = events.filter((e) => e.method === "Runtime.exceptionThrown").length;
    const cerr = events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error").length;
    console.log(`     ${name.padEnd(6)} click=${clicked}  异常=${errs}  控制台错误=${cerr}`);
  }

  console.log("\n  === 4. 快速切换压力测试 ===");
  events.length = 0;
  for (let i = 0; i < 15; i += 1) {
    const name = pages[i % pages.length];
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='${name}');if(b)b.click()})()`);
    await sleep(300);
  }
  await sleep(3000);
  const stressErr = events.filter((e) => e.method === "Runtime.exceptionThrown").length;
  const stressCer = events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error").length;
  console.log(`     15 次快速切换 -> 异常=${stressErr}  控制台错误=${stressCer}`);

  console.log("\n  === 5. 最终健康检查 ===");
  console.log("   ", await ev(`JSON.stringify({
    hasApp: !!document.querySelector('#root, [id*=root], main'),
    bodyChildren: document.body.children.length
  })`));

  console.log("\n  === 汇总 ===");
  const totalIssues = consoleErrors.length + exceptions.length + stressErr + stressCer;
  console.log(`  控制台错误/警告: ${consoleErrors.length}`);
  console.log(`  未捕获异常: ${exceptions.length}`);
  console.log(`  压力测试异常: ${stressErr}`);
  console.log(`  压力测试控制台错误: ${stressCer}`);
  console.log("");
  if (totalIssues === 0) console.log("  ✓ 未发现前端异常");
  else console.log(`  ⚠ 发现 ${totalIssues} 个前端问题`);

  ws.close();
}

main().catch((e) => console.log("  ERR:", e.message));
