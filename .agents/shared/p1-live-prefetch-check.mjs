import fs from 'node:fs';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const out = path.resolve('outputs/testing/p1-prefetch');
fs.mkdirSync(out, { recursive: true });
const session = 'p1-prefetch-measure-20261016';
const original = fs.readFileSync('scripts/perf/measure-real-switch.mjs', 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function start(name) {
  const log = fs.createWriteStream(path.join(out, name + '-server.log'));
  const child = fork(path.resolve('custom-server/index.mjs'), [], { env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(out, name + '-data') }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('start timeout')), 30000);
    child.on('message', m => { if (m?.type === 'ready') { clearTimeout(timer); resolve(m.port); } });
    child.once('exit', code => { clearTimeout(timer); reject(Error('start exit ' + code)); });
  });
  return { base: `http://127.0.0.1:${port}`, async stop() {
    if (child.exitCode === null && child.connected) child.send({ type: 'shutdown' });
    await Promise.race([new Promise(r => child.once('exit', r)), sleep(6000)]);
    if (child.exitCode === null) child.kill(); log.end();
  } };
}
async function measureOriginal(base, name) {
  // Same coordinator script and logic, with only base URL and session pinned for isolation / repeatability.
  const code = original.replace('http://127.0.0.1:8788', base).replace('/api/recommend?page=1', '/api/recommend?page=1&session=' + session);
  const child = spawn(process.execPath, ['--input-type=module', '--eval', code], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const codeValue = await new Promise(r => child.once('exit', r));
  fs.writeFileSync(path.join(out, name + '-measure-real-switch.log'), output);
  assert.equal(codeValue, 0, output.slice(-600));
  return output;
}
async function json(base, url, options) {
  const result = await fetch(base + url, { ...options, signal: AbortSignal.timeout(90000) });
  assert.ok(result.ok, url + ' status ' + result.status);
  return { body: await result.json(), cache: result.headers.get('x-cache') };
}
let service;
try {
  service = await start('cold');
  const before = await measureOriginal(service.base, 'before');
  await service.stop();
  service = await start('prefetched');
  const rec = (await json(service.base, '/api/recommend?page=1&session=' + session)).body;
  const targets = rec.items.slice(0, 6).map(row => ({ kind: 'detail', id: row.id }));
  const t0 = performance.now();
  const accepted = (await json(service.base, '/api/prefetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets }) })).body;
  let job;
  for (let i = 0; i < 600; i++) {
    job = (await json(service.base, '/api/prefetch/' + accepted.id)).body;
    if (job.state === 'complete') break;
    await sleep(100);
  }
  assert.ok(job.targets.every(row => row.state === 'done'), JSON.stringify(job));
  const backgroundMs = performance.now() - t0;
  const results = [];
  for (const target of targets) {
    let at = performance.now();
    const detail = await json(service.base, '/api/series/' + target.id);
    const detailMs = performance.now() - at;
    const ep = detail.body.episodes[0];
    at = performance.now(); const qualities = await json(service.base, `/api/episodes/${ep.id}/qualities?seriesId=${target.id}`);
    const qualitiesMs = performance.now() - at;
    assert.ok(qualities.body.qualities.length);
    at = performance.now();
    const stream = await fetch(service.base + `/api/episodes/${ep.id}/stream?quality=720P&seriesId=${target.id}`, { headers: { Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(90000) });
    const bytes = Buffer.from(await stream.arrayBuffer());
    const streamMs = performance.now() - at;
    assert.equal(stream.status, 206); assert.equal(bytes.length, 65536); assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    results.push({ id: target.id, cache: detail.cache, detailMs, qualitiesMs, streamMs, totalMs: detailMs + qualitiesMs + streamMs });
  }
  const after = await measureOriginal(service.base, 'after');
  const freshAt = performance.now();
  const fresh = await json(service.base, '/api/series/' + targets[0].id + '?fresh=1');
  const freshMs = performance.now() - freshAt;
  assert.equal(fresh.cache, 'BYPASS');
  const result = { originalScript: 'scripts/perf/measure-real-switch.mjs', backgroundMs, results, fresh: { cache: fresh.cache, ms: freshMs }, meanTotalMs: results.reduce((sum, row) => sum + row.totalMs, 0) / results.length,
    detailUnder50Ms: results.every(row => row.detailMs < 50), totalUnder300Ms: results.every(row => row.totalMs < 300) };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(before); console.log(after); console.log(JSON.stringify(result, null, 2));
} finally { if (service) await service.stop(); }
