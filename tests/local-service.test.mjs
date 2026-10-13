import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('unified local service starts, serves Web, persists records and shuts down its own process', async t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hongguotv-local-entry-'));
  const web = path.join(directory, 'web');
  mkdirSync(web);
  writeFileSync(path.join(web, 'index.html'), '<html>local service fixture</html>');
  let child;
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, 'exit');
    child.send({ type: 'shutdown' });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 5000);
    try { await exited; } finally { clearTimeout(timeout); }
  };
  t.after(async () => { await stop(); rmSync(directory, { recursive: true, force: true }); });
  const start = async () => {
    const env = { ...process.env, HG_MANAGED: '1', HG_DATA_DIR: directory, HG_WEB_DIR: web, HG_HOST: '127.0.0.1', PORT: '0' };
    delete env.HISTORY_DB_PATH;
    child = fork(new URL('../server/index.mjs', import.meta.url), [], { env, execArgv: [], windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let diagnostics = '';
    child.stdout.on('data', data => { diagnostics += data; });
    child.stderr.on('data', data => { diagnostics += data; });
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('local entry did not become ready: ' + diagnostics)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('local entry exited: ' + code + ' ' + diagnostics)); });
      child.on('message', message => { if (message.type === 'ready') { clearTimeout(timer); resolve(message.port); } });
    });
    return `http://127.0.0.1:${port}`;
  };
  const base = await start();
  assert.equal((await (await fetch(base + '/health')).json()).ok, true);
  assert.match(await (await fetch(base + '/')).text(), /local service fixture/);
  const operation = { id: 'entry-favorite', kind: 'favorite', key: '90071992547409931', op: 'set', value: { id: '90071992547409931', title: 'entry persistence check', cover: '' } };
  const response = await fetch(base + '/api/library/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation) });
  assert.equal(response.status, 200);
  await stop();
  const restarted = await start();
  const library = await (await fetch(restarted + '/api/library')).json();
  assert.equal(library.favorites.find(row => row.id === operation.key)?.title, operation.value.title);
  assert.equal(library.sync.enabled, false);
  await stop();
});
