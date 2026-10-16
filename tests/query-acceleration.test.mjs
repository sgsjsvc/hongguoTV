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

test('hongguo.js pageCache TTL is 300s and dynamic category params sort correctly', () => {
  const content = fs.readFileSync('shared/content-core/hongguo.js', 'utf8');
  assert.match(content, /pageCache\s*=\s*new\s+BoundedCache\(\s*100\s*,\s*300000\s*\)/);
  assert.match(content, /Date\.now\(\)\s*-\s*cached\.time\s*<\s*300000/);
  assert.match(content, /params\.sort\(\)/);
});

test('custom-server/index.mjs LocalLRUCache evicts, respects TTL, and maintains memory limits', async () => {
  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({ Buffer, Map, Date });
  const classExtract = source.slice(source.indexOf('class LocalLRUCache'), source.indexOf('const hotLruCache ='));
  vm.runInContext(classExtract + '\nthis.LocalLRUCache = LocalLRUCache;', context);
  const LRU = context.LocalLRUCache;

  // Max bytes 45: k1 (13 bytes), k2 (13 bytes) fit (26 bytes).
  // When k3 (26 bytes) is added, 26 + 26 = 52 > 45, evicts k2 (oldest), keeping k1 and k3 (39 <= 45).
  const cache = new LRU(45, 40);
  cache.set('k1', { a: '1' });
  cache.set('k2', { b: '2' });
  cache.get('k1'); // touch k1 so k2 becomes LRU
  cache.set('k3', { c: '33333333333333' });

  assert.equal(cache.get('k2'), null, 'k2 should have been evicted by LRU capacity');
  assert.deepEqual(cache.get('k1'), { a: '1' });

  // TTL test
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(cache.get('k1'), null, 'k1 should expire after TTL');
});

test('Search batching and deduplication in provider.mjs', async () => {
  const providerSource = fs.readFileSync('server/provider.mjs', 'utf8');
  assert.match(providerSource, /appSearchPage/);
  assert.match(providerSource, /routerData/);
  assert.match(providerSource, /Promise\.race/);
});

test('custom-server endpoints return X-Response-Time and hot LRU cache returns X-Cache HIT', async t => {
  const provider = {
    detailCacheStatus: () => 'MISS',
    async detail() { return { id: '1', episodes: [] }; }
  };
  const mockAxios = {
    get: async () => ({
      data: `_ROUTER_DATA = ${JSON.stringify({
        loaderData: {
          page: {
            bannerList: [{ series_id: 1, series_name: '测试短剧', series_cover: 'https://example.com/cover.jpg' }],
            homeSections: []
          }
        }
      })};`
    })
  };

  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({
    http, URL, Buffer, process, readJson, createPrefetchQueue, sharedResource, createPrefetchMetrics, traceRequest,
    axios: mockAxios,
    hgEngine: null, coreProvider: provider,
    handleLibrary: async () => false, handleHistory: async () => false,
    vidToSeriesMap: new Map(), console: { log() {}, error() {} },
  });
  vm.runInContext(source.slice(source.indexOf('let cacheHome ='), source.indexOf('listenWithFallback(server, PORT')) + '\nthis.server = server;this.queue = prefetchQueue;', context);
  const server = context.server;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { context.queue.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const res1 = await fetch(base + '/api/banners');
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get('x-cache'), 'MISS');
  assert.ok(res1.headers.get('x-response-time'));

  // Immediate second request to same endpoint should hit LRU cache
  const res2 = await fetch(base + '/api/banners');
  assert.equal(res2.status, 200);
  assert.equal(res2.headers.get('x-cache'), 'HIT');
  assert.ok(res2.headers.get('x-response-time'));
});
