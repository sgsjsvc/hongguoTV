// 诊断 Electron：注入 fixture 协议后页面为何空白
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net');
const { spawn } = require('node:child_process');
const PWROOT = 'C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules';
const { chromium } = require('node:module').createRequire(PWROOT + '/playwright/package.json')('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exe = process.env.HG_DESKTOP_TEST_EXECUTABLE || 'outputs/windows/win-unpacked/红果短剧.exe';
const hit = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;
  hit.push(pathname);
  let file = path.join('apps/web-pc/dist', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = 'apps/web-pc/dist/index.html';
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
async function freePort(base) { for (let p = base; p < base + 60; p++) { const s = net.createServer(); try { await new Promise((r, j) => { s.once('error', j); s.listen(p, '127.0.0.1', r); }); await new Promise(r => s.close(r)); return p; } catch { } } throw Error('no port'); }
async function inspector(port) { let url; for (let i = 0; i < 150; i++) { try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0]?.webSocketDebuggerUrl; if (url) break; } catch { } await sleep(100); } const socket = new WebSocket(url); await new Promise(r => socket.addEventListener('open', r, { once: true })); let id = 0; const w = new Map(); socket.addEventListener('message', e => { const d = JSON.parse(e.data); if (d.id) { const j = w.get(d.id); w.delete(d.id); d.error ? j.reject(Error(d.error.message)) : j.resolve(d.result); } }); return { socket, eval: async expr => { const k = ++id; const pr = new Promise((res, rej) => w.set(k, { resolve: res, reject: rej })); socket.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); const d = await pr; if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails)); return d.result.value; } }; }
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const port = await freePort(28910), inspectPort = await freePort(28990);
  const env = { ...process.env, HG_DESKTOP_PROFILE: path.resolve('outputs/w6-tests/diag-profile2') };
  delete env.ELECTRON_RUN_AS_NODE;
  console.log('origin', origin);
  const child = spawn(path.resolve(exe), [`--remote-debugging-port=${port}`, `--inspect=${inspectPort}`, '--disable-gpu', '--disable-software-rasterizer', '--no-sandbox'], { env, windowsHide: true, stdio: 'ignore' });
  const debug = await inspector(inspectPort);
  for (let i = 0; i < 200; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { } await sleep(100); }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  let page; for (let i = 0; i < 300; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().startsWith('hongguotv://app')); if (page) break; await sleep(100); }
  const logs = [];
  page.on('console', m => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
  console.log('initial', JSON.stringify(await page.evaluate(() => ({ href: location.href, len: document.body.innerHTML.length }))));
  await debug.eval(`(()=>{const e=process.mainModule.require('electron');e.protocol.unhandle('hongguotv');e.protocol.handle('hongguotv',request=>{const u=new URL(request.url);return e.net.fetch(${JSON.stringify(origin)}+u.pathname+u.search,{method:request.method,headers:request.headers,bypassCustomProtocolHandlers:true});});return true;})()`);
  await page.reload();
  await sleep(6000);
  console.log('afterReload', JSON.stringify(await page.evaluate(() => ({ href: location.href, readyState: document.readyState, len: document.body.innerHTML.length, text: document.body.innerText.slice(0, 120), rect: (r => [Math.round(r.width), Math.round(r.height)])(document.body.getBoundingClientRect()), vis: document.visibilityState, rootKids: document.getElementById('root')?.children.length ?? -1 }))));
  console.log('logs', JSON.stringify(logs.slice(0, 20), null, 1));
  console.log('hits', JSON.stringify(hit.slice(0, 20)));
  browser.close().catch(() => { }); debug.socket.close();
  if (child.exitCode === null) child.kill();
  server.closeAllConnections(); await new Promise(r => server.close(r));
})().catch(e => { console.error(e); process.exitCode = 1; });
