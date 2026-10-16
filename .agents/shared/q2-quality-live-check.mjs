import fs from 'node:fs';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import axios from 'axios';
const before = process.argv.includes('--before');
const phase = before ? 'before' : 'after';
const out = path.resolve('outputs/testing/q2-quality');
fs.mkdirSync(out, { recursive: true });
const log = fs.createWriteStream(path.join(out, phase + '-server.log'));
const child = fork(path.resolve('custom-server/index.mjs'), [], { env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(out, phase + '-data'), HG_PREFETCH_ENABLED: '0' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
child.stdout.pipe(log); child.stderr.pipe(log);
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('startup timeout')), 30000);
    child.on('message', m => { if (m?.type === 'ready') { clearTimeout(timer); resolve(m.port); } });
    child.once('exit', code => { clearTimeout(timer); reject(Error('startup exit ' + code)); });
  });
  const base = 'http://127.0.0.1:' + port;
  for (const name of process.argv.includes('--collision-only') ? [] : before ? ['quality-label-scan'] : ['quality-label-scan', 'quality-derive-compare']) {
    const dest = fs.createWriteStream(path.join(out, phase + '-' + name + '.log'));
    const probe = spawn(process.execPath, ['scripts/perf/' + name + '.mjs'], { env: { ...process.env, BASE: base }, stdio: ['ignore', 'pipe', 'pipe'] });
    probe.stdout.pipe(dest); probe.stderr.pipe(dest);
    const code = await new Promise(r => probe.once('exit', r)); await new Promise(r => dest.end(r)); assert.equal(code, 0);
    const text = fs.readFileSync(path.join(out, phase + '-' + name + '.log'), 'utf8');
    if (!before && name === 'quality-label-scan') {
      const checked = /检查 (\d+) 部/.exec(text); assert.ok(Number(checked?.[1]) >= 24);
      assert.match(text, /含非标准标签: 0 部/);
      assert.equal(Number(/>=4 档:\s*(\d+) 部/.exec(text)?.[1]), Number(checked[1]), 'every counted sample must actually have multiple qualities');
    }
    if (!before && name === 'quality-derive-compare') {
      assert.ok(Number(/检查 (\d+) 部/.exec(text)?.[1]) >= 20, 'derive comparison needs a real sample set');
      assert.match(text, /出现非标准标签: 0 部/);
    }
    console.log(phase + ' ' + name + ' passed');
  }
  if (!before) {
    const get = async url => { const response = await fetch(base + url, { signal: AbortSignal.timeout(60000) }); assert.ok(response.ok); return response.json(); };
    const search = await get('/api/search?q=' + encodeURIComponent('公路求生榜一说她要走到公路尽头') + '&page=1');
    const series = (search.items || search.series || []).find(row => row.title.includes('公路求生'));
    assert.ok(series, 'collision series must be found');
    const detail = await get('/api/series/' + series.id), episode = detail.episodes[0];
    const context = vm.createContext({ require: () => crypto, Buffer, URL, URLSearchParams, axios: axios.create() });
    vm.runInContext(fs.readFileSync('shared/content-core/hongguo.js', 'utf8') + '\nthis.api={fetchVideoInfo,qualityNumber};', context);
    const info = await context.api.fetchVideoInfo(episode.id);
    const rows = Array.from(info.rows).filter(row => row.item.codec_type !== 'bytevc2');
    const oldKeys = [...new Set(rows.map(row => context.api.qualityNumber(String(row.item.quality_desc || row.item.height || row.item.vheight || row.item.quality || row.key)) + 'P'))];
    const response = await get(`/api/episodes/${episode.id}/qualities?seriesId=${series.id}`);
    const keys = response.qualities.map(row => row.key);
    const result = { seriesId: series.id, episodeId: episode.id, oldKeys, keys,
      rows: rows.map(row => ({ key: row.key, definition: row.item.definition, vheight: row.item.vheight, vwidth: row.item.vwidth })) };
    fs.writeFileSync(path.join(out, 'collision-results.json'), JSON.stringify(result, null, 2));
    assert.equal(keys.length, 5); assert.ok(keys.includes('720P') && keys.includes('540P'));
    assert.ok(oldKeys.length < keys.length, 'same source metadata must reproduce the old collision');
    console.log(JSON.stringify(result));
  }
} finally {
  if (child.connected) child.send({ type: 'shutdown' });
  await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 6000))]);
  if (child.exitCode === null) child.kill(); log.end();
}
