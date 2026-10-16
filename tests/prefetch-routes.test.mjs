import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { createPrefetchQueue, sharedResource } from '../server/provider.mjs';
import { readJson } from '../shared/http-json.mjs';

test('detail uses the existing router cache, deduplicates requests and fresh invalidates it', async () => {
  const cache = new Map(); let calls = 0;
  const api = { pageCache: cache, itemToCard: row => row,
    async routerData(url) {
      if (!cache.has(url)) { calls++; await new Promise(r => setTimeout(r, 5)); cache.set(url, { value: { loaderData: { detail_page: { seriesDetail: { vid_list: ['81', '82'] } } } } }); }
      return cache.get(url).value;
    },
  };
  const source = fs.readFileSync('server/provider.mjs', 'utf8');
  const context = vm.createContext({ api, SITE: 'https://fixture', card: row => row, AsyncLocalStorage, AbortController, setImmediate, crypto });
  // Run the actual coalescer and provider together, so fresh sees the same pending map.
  vm.runInContext(source.slice(source.indexOf('const requestContext ='), source.indexOf('const upstreamClient =')).replaceAll('export ', '') + '\n' + source.slice(source.indexOf('export const provider ='), source.indexOf('// Limit the pinned')).replace('export const provider', 'this.provider'), context);
  const provider = context.provider;
  assert.equal(provider.detailCacheStatus('77'), 'MISS');
  await Promise.all([provider.detail('77'), provider.detail('77')]);
  assert.equal(calls, 1); assert.equal(provider.detailCacheStatus('77'), 'HIT');
  await provider.detail('77'); assert.equal(calls, 1);
  await provider.detail('77', { fresh: true }); assert.equal(calls, 2);
  await Promise.all([provider.detail('77', { fresh: true }), provider.detail('77')]);
  assert.equal(calls, 3, 'fresh concurrent with ordinary detail must fetch upstream');
  cache.clear();
  await Promise.all([provider.detail('77'), provider.detail('77', { fresh: true })]);
  assert.equal(calls, 5, 'fresh must wait for an older ordinary load, then fetch updated detail');
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(provider.detail('77', { fresh: true, signal: cancelled.signal }));
  await provider.detail('77'); assert.equal(calls, 5, 'cancelled refresh cannot leave a stale refresh lock');
});

test('HTTP prefetch warms detail and qualities, exposes status, cancel, fresh and validation', async t => {
  const cached = new Map(); let qualities = 0, fresh = 0;
  const provider = {
    detailCacheStatus: id => cached.has(id) ? 'HIT' : 'MISS',
    async detail(id, options = {}) {
      if (id === '99') throw Error('upstream error');
      if (options.fresh) { cached.delete(id); fresh++; }
      if (!cached.has(id)) cached.set(id, { id, episodes: [{ id: '81', number: 1 }] });
      return cached.get(id);
    },
  };
  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({ http, URL, Buffer, process, readJson, createPrefetchQueue, sharedResource, createPrefetchMetrics, traceRequest,
    hgEngine: { fetchVideoInfo: async () => { qualities++; return { rows: [] }; } }, coreProvider: provider,
    handleLibrary: async () => false, handleHistory: async () => false, vidToSeriesMap: new Map(), console: { error() {} },
  });
  vm.runInContext(source.slice(source.indexOf('function json('), source.indexOf('listenWithFallback(server, PORT')) + '\nthis.server = server;this.queue = prefetchQueue;', context);
  const server = context.server;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { context.queue.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = targets => fetch(base + '/api/prefetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets }) });
  const accepted = await post([{ kind: 'detail', id: '77' }]); assert.equal(accepted.status, 202);
  const job = await accepted.json();
  let done;
  for (let i = 0; i < 20; i++) { done = await (await fetch(base + '/api/prefetch/' + job.id)).json(); if (done.state === 'complete') break; await new Promise(r => setTimeout(r, 5)); }
  assert.equal(done.state, 'complete'); assert.equal(done.targets[0].state, 'done'); assert.equal(qualities, 1);
  let detail = await fetch(base + '/api/series/77'); assert.equal(detail.headers.get('x-cache'), 'HIT');
  detail = await fetch(base + '/api/series/77?fresh=1'); assert.equal(detail.headers.get('x-cache'), 'BYPASS'); assert.equal(fresh, 1);
  assert.equal((await post([{ kind: 'detail', id: 77 }])).status, 400);
  assert.equal((await fetch(base + '/api/prefetch/' + job.id, { method: 'DELETE' })).status, 200);
  assert.equal((await fetch(base + '/api/prefetch/00000000-0000-0000-0000-000000000000')).status, 404);
});
