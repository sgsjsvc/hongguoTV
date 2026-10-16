// W6 独立复核脚本（workbuddy）—— 推荐流(W4) + 详情页(W5) 全屏
// 用法:
//   node .agents/shared/t-w6-verify.cjs --recommend        # Web 推荐流
//   node .agents/shared/t-w6-verify.cjs --detail           # Web 详情页
//   node .agents/shared/t-w6-verify.cjs --recommend --desktop
//   node .agents/shared/t-w6-verify.cjs --detail --desktop
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), net = require('node:net'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const PWROOT = 'C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules';
const { chromium } = require('node:module').createRequire(PWROOT + '/playwright/package.json')('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const desktop = process.argv.includes('--desktop');
const mode = desktop ? 'desktop' : 'web';
const part = process.argv.includes('--recommend') ? 'recommend' : 'detail';
const OUT = '.agents/shared';
const tag = `t-w6-${part}-${mode}`;
// 关掉 Playwright 的焦点模拟：否则原生窗口全屏会被抑制（W5 报告的已知陷阱）
if (!desktop) {
  const { CRSession } = require(PWROOT + '/playwright-core/lib/server/chromium/crConnection.js');
  const send = CRSession.prototype.send;
  CRSession.prototype.send = function (method, ...args) {
    if (method === 'Emulation.setFocusEmulationEnabled') args[0] = { ...args[0], enabled: false };
    return send.call(this, method, ...args);
  };
}
const title = '全屏验收样本（本地测试片）';
const series = {
  id: '9000000000000000001', title,
  cover: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480"><rect width="360" height="480" fill="#172033"/></svg>'),
  description: 'W6 controlled media fixture', badge: '全3集', tags: '验收', contentType: 'real-drama',
};
const detail = { ...series, episodes: [1, 2, 3].map(n => ({ id: '100' + n, number: n, title: '第' + n + '集' })) };
const media = fs.readFileSync('outputs/w6-tests/fixture-vertical.mp4');
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture'); const pathname = url.pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname.startsWith('/api/')) {
    requests.push({ method: req.method, path: pathname });
    if (/\/episodes\/\d+\/stream$/.test(pathname)) {
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1;
      res.writeHead(range ? 206 : 200, {
        'Content-Type': 'video/mp4', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${media.length}` } : {}),
      });
      res.end(media.subarray(start, end + 1)); return;
    }
    let result = { ok: true };
    if (pathname === '/api/banners') result = { banners: [series] };
    else if (pathname === '/api/sections') result = { sections: [{ type: 'hot', name: '验收剧集', items: [series] }] };
    else if (pathname === '/api/library') result = { favorites: [], history: [], searchHistory: [], recommendationSignals: [], preferences: { quality: '1080P', speed: 1, recommendationMode: 'mixed', recommendationResetAt: 0 }, sync: { state: 'unconfigured', enabled: false, url: '', pending: 0 }, serverTime: Date.now() };
    else if (pathname.startsWith('/api/library/history/')) result = { item: null };
    else if (pathname === `/api/series/${series.id}`) result = detail;
    else if (pathname.endsWith('/qualities')) result = { qualities: [{ key: '1080P', label: '1080P', qualityNum: 1080, codec: 'H.264' }] };
    else if (pathname.startsWith('/api/recommend')) result = { items: [series], page: 1 };
    else if (pathname.endsWith('/related')) result = { items: [] };
    else if (pathname.includes('/search')) result = { items: [] };
    else if (pathname.endsWith('/seasons')) result = { seasons: [] };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); req.resume(); return;
  }
  let file = path.join('apps/web-pc/dist', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = 'apps/web-pc/dist/index.html';
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' })[ext] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
async function freePort(base) { for (let port = base; port < base + 60; port++) { const p = net.createServer(); try { await new Promise((r, j) => { p.once('error', j); p.listen(port, '127.0.0.1', r); }); await new Promise(r => p.close(r)); return port; } catch { } } throw Error('no free port'); }
async function inspector(port) { let url; for (let i = 0; i < 150; i++) { try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0]?.webSocketDebuggerUrl; if (url) break; } catch { } await sleep(100); } assert.ok(url); const socket = new WebSocket(url); await new Promise(r => socket.addEventListener('open', r, { once: true })); let id = 0; const waiting = new Map(); socket.addEventListener('message', e => { const d = JSON.parse(e.data); if (d.id) { const j = waiting.get(d.id); waiting.delete(d.id); d.error ? j.reject(Error(d.error.message)) : j.resolve(d.result); } }); return { socket, eval: async expr => { const k = ++id; const pending = new Promise((res, rej) => waiting.set(k, { resolve: res, reject: rej })); socket.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); const d = await pending; if (d.exceptionDetails) throw Error(JSON.stringify(d.exceptionDetails)); return d.result.value; } }; }
const report = { tag, part, mode, at: new Date().toISOString(), checks: {}, evidence: {}, requests: [] };
function check(name, ok, detailInfo) { report.checks[name] = { pass: !!ok, detail: detailInfo }; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detailInfo === undefined ? '' : JSON.stringify(detailInfo)}`); }

(async () => {
  let browser, page, child, debug;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log('fixture origin', origin);
  try {
    if (desktop) {
      const port = await freePort(28600), inspectPort = await freePort(28800);
      const env = { ...process.env, HG_DESKTOP_PROFILE: path.resolve(`outputs/w5-tests/desktop-profile-${mode}`) };
      delete env.ELECTRON_RUN_AS_NODE;
      child = spawn(path.resolve(process.env.HG_DESKTOP_TEST_EXECUTABLE || 'outputs/w5-desktop/win-unpacked/红果短剧.exe'),
        [`--remote-debugging-port=${port}`, `--inspect=${inspectPort}`, '--disable-gpu', '--disable-software-rasterizer', '--no-sandbox'], { env, windowsHide: true, stdio: 'ignore' });
      debug = await inspector(inspectPort);
      for (let i = 0; i < 200; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { } await sleep(100); }
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      for (let i = 0; i < 300; i++) {
        const ctxs = browser.contexts();
        page = ctxs.flatMap(c => c.pages()).find(p => p.url().startsWith('hongguotv://app'));
        if (page) break;
        await sleep(100);
      }
      assert.ok(page, 'desktop page hongguotv://app 未出现');
      // 直接把页面导航到 fixture HTTP 源（preload 的 window.hongguotvDesktop 依然可用）。
      // 之前的 protocol 重定向方式在本机 Electron 上会让 assets 请求 ERR_UNEXPECTED。
      await page.goto(origin);
    } else {
      browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized', '--autoplay-policy=no-user-gesture-required'] });
      const context = await browser.newContext({ viewport: null });
      page = await context.newPage();
      await page.goto(origin);
      await (await context.newCDPSession(page)).send('Emulation.setFocusEmulationEnabled', { enabled: false });
    }
    await page.bringToFront();
    await page.waitForSelector('body');

    const geo = async () => page.evaluate(() => {
      const v = document.querySelector('video');
      const p = v && v.parentElement;
      const b = p && p.getBoundingClientRect();
      return {
        screen: [screen.width, screen.height], inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight],
        fsElement: document.fullscreenElement ? document.fullscreenElement.tagName : null,
        isDesktop: typeof window.hongguotvDesktop === 'object',
        hasFocus: document.hasFocus(),
        videoCount: document.querySelectorAll('video').length,
        player: b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), position: getComputedStyle(p).position } : null,
        videoNatural: v ? [v.videoWidth, v.videoHeight] : null,
        videoRect: v ? (r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))(v.getBoundingClientRect()) : null,
      };
    });
    const isFs = async () => page.evaluate(() => {
      if (document.fullscreenElement) return true;
      const v = document.querySelector('video');
      if (v) {
        // 详情页：播放器容器自身变 fixed；推荐流：最外层 containerRef 变 fixed
        if (v.parentElement && v.parentElement.classList.contains('fixed')) return true;
        const root = v.closest('div[class*="w-full h-full flex items-center justify-center"]');
        if (root && root.classList.contains('fixed')) return true;
      }
      // 桌面端：原生窗口级全屏（inner 与 outer 都等于屏幕）
      if (window.hongguotvDesktop) {
        return innerWidth === screen.width && innerHeight === screen.height && outerWidth === screen.width;
      }
      return false;
    });
    const fsBtn = () => page.locator('button[aria-label="全屏"], button[aria-label="退出全屏"]').first();
    const waitFs = async (want, ms = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if ((await isFs()) === want) return true; await sleep(120); }
      return false;
    };

    if (part === 'recommend') {
      // ---------- 推荐流（W4）----------
      await page.getByRole('button', { name: '推荐', exact: true }).click().catch(() => { });
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, {}, { timeout: 20000 });
      await page.evaluate(() => document.querySelector('video').pause());
      const btnCount = await page.getByRole('button', { name: '全屏', exact: true }).count();
      check('W4-1 推荐流存在全屏按钮', btnCount >= 1, { count: btnCount });
      await page.screenshot({ path: `${OUT}/${tag}-before.png` });

      // 点击进入全屏
      await fsBtn().click();
      const entered = await waitFs(true);
      await sleep(1200);
      check('W4-2 点击后进入全屏', entered);
      const g1 = await geo();
      report.evidence.geometryFullscreen = g1;
      await page.screenshot({ path: `${OUT}/${tag}-fullscreen.png` });

      // 控件完整性
      const controls = await page.evaluate(() => {
        const txt = document.body.innerText;
        return {
          badge: /第\s*\d+\s*集/.test(txt), speed: /1x/.test(txt), quality: /1080P/.test(txt),
          collection: /合集/.test(txt), progress: !!document.querySelector('input[type=range], .h-1\\.5, [class*="progress"]'),
          exitBtn: !!document.querySelector('button[aria-label="退出全屏"]'),
          arrows: /↑↓/.test(txt) || /切剧/.test(txt),
        };
      });
      report.evidence.controls = controls;
      check('W4-3 全屏下控件不丢失', Object.values(controls).every(Boolean), controls);

      // 竖版视频居中（object-contain 内容两侧留黑边）
      let centered = null;
      if (g1.videoNatural && g1.videoNatural[1] > g1.videoNatural[0] && g1.player) {
        const fit = await page.evaluate(() => {
          const v = document.querySelector('video'); const r = v.getBoundingClientRect();
          const s = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
          const cw = v.videoWidth * s, ch = v.videoHeight * s;
          return { objectFit: getComputedStyle(v).objectFit, contentW: Math.round(cw), contentH: Math.round(ch), boxW: Math.round(r.width), boxH: Math.round(r.height), barLeft: Math.round((r.width - cw) / 2), barRight: Math.round((r.width - cw) / 2) };
        });
        report.evidence.letterbox = fit;
        centered = fit.objectFit === 'contain' && fit.contentW < fit.boxW && Math.abs(fit.barLeft - fit.barRight) < 2 && fit.contentH <= fit.boxH + 1;
      }
      check('W4-4 竖版视频居中留黑边', centered === null ? 'n/a(横版)' : centered, report.evidence.letterbox || { natural: g1.videoNatural });

      // Escape 退出
      await page.keyboard.press('Escape');
      const exited = await waitFs(false);
      const afterEsc = await geo();
      check('W4-5 Escape 退出全屏且不关闭播放器', exited && afterEsc.videoCount === 1, { exited, videoCount: afterEsc.videoCount });

      // 双击切换（视频被控件层覆盖，用事件派发触发父容器 onDoubleClick）
      await page.locator('video').dispatchEvent('dblclick');
      const dblIn = await waitFs(true);
      await page.locator('video').dispatchEvent('dblclick');
      const dblOut = await waitFs(false);
      check('W4-6 双击切换全屏', dblIn && dblOut, { dblIn, dblOut });

      // F 键
      await page.keyboard.press('f');
      const fIn = await waitFs(true);
      await page.keyboard.press('f');
      const fOut = await waitFs(false);
      check('W4-7 F 键切换全屏', fIn && fOut, { fIn, fOut });

      // 反复切换 10 次
      let stable = true;
      for (let i = 0; i < 10; i++) {
        await fsBtn().click();
        if (!await waitFs(true)) { stable = false; break; }
        await fsBtn().click();
        if (!await waitFs(false)) { stable = false; break; }
      }
      check('W4-8 反复切换 10 次稳定', stable);

      // 自动下一集（真实 ended）
      await fsBtn().click();
      await waitFs(true); await sleep(800);
      await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); window.__w6ended = 0; v.addEventListener('ended', () => window.__w6ended++); });
      const srcBefore = await page.evaluate(() => document.querySelector('video').src);
      await page.evaluate(async () => { const v = document.querySelector('video'); v.currentTime = Math.max(0, v.duration - 0.4); await v.play(); });
      let advanced = false;
      try { await page.waitForFunction(s => document.querySelector('video')?.src !== s, srcBefore, { timeout: 20000 }); advanced = true; } catch { }
      await sleep(800);
      // 注意：推荐流的 video 父元素是内层绝对定位容器，全屏容器是最外层 containerRef。
      // 因此判据必须用 document.fullscreenElement（或最外层容器的 fixed 类），不能用 video.parentElement。
      const after = await page.evaluate(() => {
        const v = document.querySelector('video');
        const root = v.closest('div[class*="w-full h-full flex items-center justify-center"]') || v.parentElement;
        return {
          ended: window.__w6ended, src: v.src,
          domFullscreen: !!document.fullscreenElement,
          fsElementClass: document.fullscreenElement ? document.fullscreenElement.className : null,
          rootHasFixed: root.classList.contains('fixed'),
          fs: !!document.fullscreenElement || root.classList.contains('fixed'),
        };
      });
      report.evidence.autoNext = { srcBefore, ...after };
      check('W4-9 全屏下自动下一集', advanced && after.ended >= 1 && after.fs, after);
      await page.screenshot({ path: `${OUT}/${tag}-autonext.png` });

      // 失败提示
      await page.keyboard.press('Escape'); await waitFs(false);
      if (desktop) {
        await debug.eval("(()=>{const e=process.mainModule.require('electron');e.ipcMain.removeHandler('fullscreen:toggle');e.ipcMain.handle('fullscreen:toggle',()=>{throw Error('W6 intentional test failure');});return true;})()");
      } else {
        await page.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed')); });
      }
      await fsBtn().click();
      let toast = false;
      try { await page.getByText(/全屏失败|全屏切换失败/).first().waitFor({ timeout: 4000 }); toast = true; } catch { }
      check('W4-10 全屏失败有提示', toast);
      await page.screenshot({ path: `${OUT}/${tag}-failtoast.png` }).catch(() => { });
    } else {
      // ---------- 详情页（W5）----------
      await page.getByRole('button', { name: '立即观看', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, {}, { timeout: 20000 });
      await page.evaluate(() => document.querySelector('video').pause());
      const layout = await page.evaluate(() => {
        const v = document.querySelector('video'); const p = v.parentElement;
        const btns = [...document.querySelectorAll('button')].map(b => ({ aria: b.getAttribute('aria-label'), title: b.getAttribute('title'), txt: (b.innerText || '').trim() }));
        const fsBtns = btns.filter(b => b.aria === '全屏' || b.aria === '退出全屏');
        const rect = p.getBoundingClientRect();
        return { fsBtnCount: fsBtns.length, fsBtns, playerRect: { w: Math.round(rect.width), h: Math.round(rect.height) }, position: getComputedStyle(p).position, className: p.className };
      });
      report.evidence.detailLayout = layout;
      check('W5-1 详情页有底栏全屏按钮', layout.fsBtnCount >= 1, { count: layout.fsBtnCount });
      check('W5-2 详情页无冗余悬浮全屏按钮', layout.fsBtnCount === 1, { count: layout.fsBtnCount, btns: layout.fsBtns });
      check('W5-3 非全屏时播放器不是 fixed 满屏', layout.position === 'relative', { position: layout.position, rect: layout.playerRect });
      await page.screenshot({ path: `${OUT}/${tag}-before.png` });

      await fsBtn().click();
      const entered = await waitFs(true);
      await sleep(1200);
      const g = await geo();
      report.evidence.geometryFullscreen = g;
      await page.screenshot({ path: `${OUT}/${tag}-fullscreen.png` });
      check('W5-4 详情页可进入全屏', entered);
      const fills = g.player && Math.abs(g.player.w - g.screen[0]) <= 1 && Math.abs(g.player.h - g.screen[1]) <= 1 && g.player.x === 0 && g.player.y === 0 && g.player.position === 'fixed';
      check('W5-5 播放器填满屏幕(2304x1536 级)', fills, g.player);
      check('W5-6 屏幕级全屏(inner==screen)', g.inner[0] === g.screen[0] && g.inner[1] === g.screen[1], { inner: g.inner, screen: g.screen, outer: g.outer });

      // 自动下一集
      await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); window.__w6ended = 0; v.addEventListener('ended', () => window.__w6ended++); });
      const srcBefore = await page.evaluate(() => document.querySelector('video').src);
      await page.evaluate(async () => { const v = document.querySelector('video'); v.currentTime = Math.max(0, v.duration - 0.4); await v.play(); });
      let advanced = false;
      try { await page.waitForFunction(s => document.querySelector('video')?.src !== s, srcBefore, { timeout: 20000 }); advanced = true; } catch { }
      await sleep(800);
      const after = await page.evaluate(() => ({ ended: window.__w6ended, src: document.querySelector('video').src, fs: document.querySelector('video').parentElement.classList.contains('fixed') }));
      report.evidence.autoNext = { srcBefore, ...after };
      check('W5-7 全屏下自动下一集并保持全屏', advanced && after.ended >= 1 && after.fs, after);
      await page.screenshot({ path: `${OUT}/${tag}-autonext.png` });

      // Escape 不关闭
      await page.keyboard.press('Escape');
      const exited = await waitFs(false);
      const afterEsc = await geo();
      check('W5-8 Escape 退出全屏且不关闭播放器', exited && afterEsc.videoCount === 1, { exited, videoCount: afterEsc.videoCount });

      // 反复切换
      let stable = true;
      for (let i = 0; i < 10; i++) {
        await fsBtn().click();
        if (!await waitFs(true)) { stable = false; break; }
        await fsBtn().click();
        if (!await waitFs(false)) { stable = false; break; }
      }
      check('W5-9 反复切换 10 次稳定', stable);

      // 失败提示
      if (desktop) {
        await debug.eval("(()=>{const e=process.mainModule.require('electron');e.ipcMain.removeHandler('fullscreen:toggle');e.ipcMain.handle('fullscreen:toggle',()=>{throw Error('W6 intentional test failure');});return true;})()");
      } else {
        await page.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed')); });
      }
      await fsBtn().click();
      let toast = false;
      try { await page.getByText(/全屏失败|切换桌面全屏失败/).first().waitFor({ timeout: 4000 }); toast = true; } catch { }
      check('W5-10 全屏失败有提示', toast);
      await page.screenshot({ path: `${OUT}/${tag}-failtoast.png` }).catch(() => { });
    }
    report.requests = requests.slice(0, 40);
  } catch (error) {
    report.error = String(error && error.stack || error);
    console.log('ERROR', report.error);
    if (page && !page.isClosed()) {
      try { console.log('pageText', (await page.evaluate(() => document.body.innerText)).slice(-500)); } catch { }
      await page.screenshot({ path: `${OUT}/${tag}-failure.png` }).catch(() => { });
    }
  } finally {
    fs.writeFileSync(`${OUT}/${tag}-results.json`, JSON.stringify(report, null, 2));
    if (debug) { debug.socket.close(); }
    if (page && !page.isClosed()) await page.close().catch(() => { });
    if (browser) await browser.close().catch(() => { });
    if (child && child.exitCode === null) { await Promise.race([new Promise(r => child.once('exit', r)), sleep(5000)]); if (child.exitCode === null) child.kill(); }
    server.closeAllConnections(); await new Promise(r => server.close(r));
    const failed = Object.entries(report.checks).filter(([, v]) => !v.pass).map(([k]) => k);
    console.log(`\n=== ${tag} 完成：${Object.keys(report.checks).length} 项，失败 ${failed.length} ===`);
    if (failed.length) console.log('FAILED:', failed.join(', '));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
