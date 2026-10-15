const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const req = createRequire('C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/package.json');
const { chromium } = req('playwright');
const { spawn } = require('node:child_process');
const net = require('node:net');
(async () => {
  const env = { ...process.env, PATH: '', HG_DESKTOP_PROFILE: path.resolve('outputs/packaging-tests/desktop-no-node') };
  delete env.ELECTRON_RUN_AS_NODE;
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  let app, child, page;
  try {
    child = spawn(path.resolve(process.env.HG_DESKTOP_TEST_EXECUTABLE || 'outputs/windows/win-unpacked/红果短剧.exe'), ['--disable-gpu', `--remote-debugging-port=${port}`], { env, windowsHide: true, stdio: 'ignore' });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    app = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    while (Date.now() < deadline) {
      page = app.contexts()[0].pages().find(window => window.url().startsWith('hongguotv://app'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!page) throw new Error('Main packaged window not found');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#root').waitFor();
    const result = await page.evaluate(async () => {
      const health = await fetch('/health');
      const home = await fetch('/');
      return { url: location.href, healthStatus: health.status, homeStatus: home.status, homepageHTML: (await home.text()).includes('<!doctype html>'), rootTextLength: document.querySelector('#root').innerText.length };
    });
    if (result.healthStatus !== 200 || result.homeStatus !== 200 || !result.homepageHTML || result.rootTextLength < 10) throw new Error(JSON.stringify(result));
    await page.close();
    await app.close();
    app = null;
    await new Promise((resolve, reject) => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(() => reject(new Error('Own application did not exit')), 10000).unref(); });
    result.closedOwnApplication = true;
    result.pathEmpty = true;
    result.profile = env.HG_DESKTOP_PROFILE;
    fs.writeFileSync('.agents/shared/t-b1-no-node-smoke.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (app) await app.close();
    if (child && child.exitCode === null) child.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
