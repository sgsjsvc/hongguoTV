import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import assert from 'node:assert/strict';
const out = path.resolve('outputs/testing/p1-prefetch');
const child = fork(path.resolve('custom-server/index.mjs'), [], { env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(out, 'concurrent-data') }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('startup timeout')), 30000);
    child.on('message', m => { if (m?.type === 'ready') { clearTimeout(timeout); resolve(m.port); } });
  });
  const base = 'http://127.0.0.1:' + port;
  const get = async url => { const at = performance.now(); const r = await fetch(base + url, { signal: AbortSignal.timeout(60000) }); assert.ok(r.ok); return { ms: performance.now() - at, cache: r.headers.get('x-cache'), body: await r.json() }; };
  const rows = (await get('/api/recommend?page=1&session=p1-foreground-test-20261016')).body.items;
  await get('/api/series/' + rows[0].id);
  const idle = await get('/api/series/' + rows[0].id);
  const job = await (await fetch(base + '/api/prefetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets: [{ kind: 'detail', id: rows[1].id }] }) })).json();
  let started;
  for (let i = 0; i < 20; i++) { started = (await get('/api/prefetch/' + job.id)).body; if (started.targets[0].state === 'running') break; await sleep(10); }
  const concurrent = [];
  for (let i = 0; i < 5; i++) { const result = await get('/api/series/' + rows[0].id); concurrent.push({ ms: result.ms, cache: result.cache }); }
  const cancelled = await (await fetch(base + '/api/prefetch/' + job.id, { method: 'DELETE' })).json();
  assert.equal(cancelled.state, 'cancelled');
  const result = { idleMs: idle.ms, backgroundState: started.targets[0].state, concurrent, cancelled: cancelled.state };
  fs.writeFileSync(path.join(out, 'concurrent-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  if (child.connected) child.send({ type: 'shutdown' });
  await Promise.race([new Promise(r => child.once('exit', r)), sleep(6000)]);
  if (child.exitCode === null) child.kill();
}
