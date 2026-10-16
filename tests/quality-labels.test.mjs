import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import http from 'node:http';
import { createPrefetchQueue, sharedResource } from '../server/provider.mjs';

const engines = ['shared/content-core/hongguo.js', 'custom-server/vendor/hongguo.cjs', 'server/vendor/hongguo.cjs'];
const expected = ['1080P', '720P', '540P', '480P', '360P'];
const collision = Object.fromEntries([1080, 720, 540, 480, 360].map((quality, index) => ['video_' + (5 - index), {
  main_url: 'https://fixture.invalid/video', definition: quality + 'p', codec_type: 'bytevc1',
  vheight: [1924, 496, 496, 854, 642][index], vwidth: quality,
}]));
function load(file) {
  const context = vm.createContext({ require: () => crypto, Buffer, URL, URLSearchParams, axios: {} });
  vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.api={qualityRows,qualityNumber};', context, { timeout: 5000 });
  return { context, ...context.api };
}
const keys = (engine, list) => Array.from(engine.qualityRows(list), row => engine.qualityNumber(row.quality) + 'P');

for (const file of engines) {
  test(`${file}: standard definition takes precedence over odd pixel dimensions`, () => {
    const engine = load(file);
    const rows = engine.qualityRows({ video_5: { main_url: 'x', definition: '1080p', quality_desc: '1924', height: 1924, vheight: 1924 } });
    assert.equal(rows[0].quality, '1080p'); assert.equal(engine.qualityNumber(rows[0].quality), 1080);
    for (const value of [2160, 1440, 1080, 720, 576, 540, 480, 360]) assert.equal(engine.qualityNumber(value + 'p'), value);
  });
  test(`${file}: absent definition preserves the original fallback chain`, () => {
    const engine = load(file);
    for (const [fields, value] of [
      [{ quality_desc: '720p', height: 540, vheight: 480, quality: '360p' }, '720p'],
      [{ height: 540, vheight: 480, quality: '360p' }, '540'],
      [{ vheight: 480, quality: '360p' }, '480'],
      [{ quality: '360p' }, '360p'], [{}, 'video_1'],
    ]) assert.equal(engine.qualityRows({ video_1: { main_url: 'x', definition: '', ...fields } })[0].quality, value);
  });
  test(`${file}: equal heights cannot collapse 540p and 720p into one tier`, () => {
    const engine = load(file); assert.deepEqual(keys(engine, collision), expected);
    assert.equal(new Set(keys(engine, collision)).size, 5);
  });
}

test('unchanged TV content API receives five standard tiers from the shared engine', async () => {
  const { context } = load(engines[0]);
  context.fixture = collision;
  vm.runInContext('fetchVideoInfo=async()=>({rows:qualityRows(fixture)});', context);
  vm.runInContext(fs.readFileSync('apps/tv-android/app/src/main/assets/content-api.js', 'utf8'), context);
  const response = await context.localContent('/api/episodes/123/qualities', {});
  assert.deepEqual(Array.from(response.qualities, row => row.key), expected);
});

test('unchanged Web qualities route retains five distinct tiers for equal-height rows', async t => {
  const engine = load(engines[0]);
  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({ http, URL, Buffer, AbortController, process, createPrefetchQueue, sharedResource, createPrefetchMetrics, traceRequest,
    hgEngine: { fetchVideoInfo: async () => ({ rows: engine.qualityRows(collision) }), qualityNumber: engine.qualityNumber },
    handleLibrary: async () => false, handleHistory: async () => false, console: { warn() {}, error() {} },
  });
  vm.runInContext(source.slice(source.indexOf('function json('), source.indexOf('listenWithFallback(server, PORT')) + '\nthis.server=server;this.queue=prefetchQueue;', context);
  await new Promise(r => context.server.listen(0, '127.0.0.1', r));
  t.after(async () => { context.queue.close(); context.server.closeAllConnections(); await new Promise(r => context.server.close(r)); });
  const response = await fetch(`http://127.0.0.1:${context.server.address().port}/api/episodes/123/qualities`);
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).qualities.map(row => row.key), expected);
});
