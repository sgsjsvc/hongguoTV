const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, fork } = require('node:child_process');
const pwRoot = 'C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/';
const { chromium } = require(pwRoot + 'playwright');
const desktop = process.argv.includes('--desktop');
const mode = desktop ? 'desktop' : 'web';
const evidence = path.resolve('outputs/testing/w7-release');
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!desktop) {
  const { CRSession } = require(pwRoot + 'playwright-core/lib/server/chromium/crConnection.js');
  const send = CRSession.prototype.send;
  CRSession.prototype.send = function (method, ...args) {
    if (method === 'Emulation.setFocusEmulationEnabled') args[0] = { ...args[0], enabled: false };
    return send.call(this, method, ...args);
  };
}
async function freePort() {
  const server = net.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise(r => server.close(r));
  return port;
}
(async () => {
  let child, browser, page, log;
  try {
    if (desktop) {
      const port = await freePort();
      const env = { ...process.env, HG_DESKTOP_PROFILE: path.join(evidence, 'desktop-live-profile') };
      delete env.ELECTRON_RUN_AS_NODE;
      child = spawn(path.resolve('outputs/w7-release/win-unpacked/红果短剧.exe'), [`--remote-debugging-port=${port}`], { env, windowsHide: true, stdio: 'ignore' });
      let ready = false;
      for (let i = 0; i < 300; i++) {
        try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) { ready = true; break; } } catch {}
        await sleep(200);
      }
      assert.ok(ready, 'Desktop CDP startup');
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      for (let i = 0; i < 200; i++) {
        page = browser.contexts()[0].pages().find(p => p.url().startsWith('hongguotv://app/'));
        if (page) break;
        await sleep(200);
      }
      assert.ok(page, 'Desktop main window');
      await page.waitForLoadState('domcontentloaded');
    } else {
      const root = path.join(evidence, 'web-extracted/hongguotv-web-win-x64');
      log = fs.createWriteStream(path.join(evidence, 'web-live-server.log'));
      child = fork(path.join(root, 'custom-server/index.mjs'), [], {
        execPath: path.join(root, 'runtime/node.exe'), cwd: root,
        env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(evidence, 'web-live-data'), HG_WEB_DIR: path.join(root, 'apps/web-pc/dist') },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
      });
      child.stdout.pipe(log); child.stderr.pipe(log);
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Web startup timeout')), 30000);
        child.on('message', m => { if (m?.type === 'ready') { clearTimeout(timer); resolve(m.port); } });
        child.once('exit', () => { clearTimeout(timer); reject(Error('Web startup exited')); });
      });
      browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized', '--autoplay-policy=no-user-gesture-required'] });
      page = await (await browser.newContext({ viewport: null })).newPage();
      await page.goto(`http://127.0.0.1:${port}/`);
    }
    const health = await page.evaluate(async () => (await fetch('/health')).json());
    assert.ok(health.playback, 'Packaged backend health includes playback');
    fs.writeFileSync(path.join(evidence, `${mode}-health.json`), JSON.stringify(health, null, 2));
    await page.bringToFront();
    await page.getByRole('button', { name: '推荐', exact: true }).click({ timeout: 60000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      return v && v.readyState === 4 && !v.paused && v.currentTime > 0.3;
    }, null, { timeout: 150000 });
    const video = await page.evaluate(() => {
      const v = document.querySelector('video');
      return { readyState: v.readyState, paused: v.paused, currentTime: v.currentTime, width: v.videoWidth, height: v.videoHeight };
    });
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    await page.waitForFunction(() => innerWidth === screen.width && innerHeight === screen.height && !document.querySelector('header'), null, { timeout: 15000 });
    const geometry = await page.evaluate(() => ({ innerWidth, innerHeight, screenWidth: screen.width, screenHeight: screen.height, headerHidden: !document.querySelector('header') }));
    await page.screenshot({ path: path.join(evidence, `${mode}-live-fullscreen.png`) });
    await page.keyboard.press('Escape');
    await page.locator('header').waitFor();
    const result = { mode, realUpstream: true, packagedFrontend: true, video, geometry, escapeRestoresHeader: true };
    fs.writeFileSync(path.join(evidence, `${mode}-live-results.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    if (page && !page.isClosed()) {
      const state = await page.evaluate(() => ({ text: document.body.innerText.slice(-1400), video: [...document.querySelectorAll('video')].map(v => ({ readyState: v.readyState, paused: v.paused, errorCode: v.error?.code })) })).catch(() => ({}));
      fs.writeFileSync(path.join(evidence, `${mode}-live-failure.json`), JSON.stringify({ error: error.message, state }, null, 2));
    }
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (child && child.exitCode === null) {
      if (!desktop && child.connected) child.send({ type: 'shutdown' });
      await Promise.race([new Promise(r => child.once('exit', r)), sleep(6000)]);
      if (child.exitCode === null) child.kill();
    }
    if (log) log.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
