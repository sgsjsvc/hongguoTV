import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import { createPrefetchQueue, sharedResource } from '../server/provider.mjs';
import { readJson } from '../shared/http-json.mjs';

test('web-pc api.ts exports prefetch client methods', () => {
  const content = fs.readFileSync('apps/web-pc/src/api.ts', 'utf8');
  assert.ok(content.includes('async prefetch('), 'api.ts should define prefetch');
  assert.ok(content.includes('async cancelPrefetch('), 'api.ts should define cancelPrefetch');
  assert.ok(content.includes('async getPrefetchStatus('), 'api.ts should define getPrefetchStatus');
  assert.ok(content.includes('/api/prefetch'), 'api.ts should call /api/prefetch endpoint');
});

test('useStreamFeed wires prefetch for next drama detail and cancels on change/unmount', () => {
  const content = fs.readFileSync('apps/web-pc/src/hooks/useStreamFeed.ts', 'utf8');
  assert.ok(content.includes('prefetchBatchIdRef'), 'useStreamFeed should track prefetchBatchIdRef');
  assert.ok(content.includes('prefetchedSeriesIdsRef'), 'useStreamFeed should track prefetchedSeriesIdsRef to prevent duplicates');
  assert.ok(content.includes('api.prefetch([{ kind: "detail", id: nextId }])'), 'useStreamFeed should prefetch next detail');
  assert.ok(content.includes('api.cancelPrefetch'), 'useStreamFeed should cancel old prefetch batch');
  // Red line check: strictly prohibit prefetching recommendation pages
  assert.ok(!content.includes('prefetch([{ kind: "recommend"'), 'must not prefetch recommendation feed');
  assert.ok(!content.includes('api.prefetch([{ kind: "page"'), 'must not prefetch recommendation page');
});

test('RecommendStream wires 80% next episode qualities prefetch and cancels batch on switch', () => {
  const content = fs.readFileSync('apps/web-pc/src/components/RecommendStream.tsx', 'utf8');
  assert.ok(content.includes('cur / dur >= 0.8'), 'RecommendStream should check 80% playback progress');
  assert.ok(content.includes('kind: "qualities"'), 'RecommendStream should prefetch next episode qualities');
  assert.ok(content.includes('prefetchedNextEpQualitiesRef'), 'RecommendStream should guard against redundant prefetch');
  assert.ok(content.includes('api.cancelPrefetch'), 'RecommendStream should cancel pending batch on episode switch');
});

test('usePlayback wires 80% next episode qualities prefetch and cancels batch on switch', () => {
  const content = fs.readFileSync('apps/web-pc/src/hooks/usePlayback.ts', 'utf8');
  assert.ok(content.includes('cur / dur >= 0.8'), 'usePlayback should check 80% playback progress');
  assert.ok(content.includes('kind: "qualities"'), 'usePlayback should prefetch next episode qualities');
  assert.ok(content.includes('prefetchedNextEpQualitiesRef'), 'usePlayback should guard against redundant prefetch');
  assert.ok(content.includes('api.cancelPrefetch'), 'usePlayback should cancel pending batch on episode switch');
});

test('end-to-end prefetch speedup: prefetch warms cache from cold delay down to < 50ms', async t => {
  const cached = new Map();
  const provider = {
    detailCacheStatus: id => cached.has(id) ? 'HIT' : 'MISS',
    async detail(id, options = {}) {
      if (options.fresh) cached.delete(id);
      if (!cached.has(id)) {
        // Cold fetch delay (simulating network upstream ~80ms)
        await new Promise(r => setTimeout(r, 80));
        cached.set(id, { id, title: `Series ${id}`, episodes: [{ id: `ep-${id}-1`, number: 1 }] });
      }
      return cached.get(id);
    },
  };

  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({
    http, URL, Buffer, process, readJson, createPrefetchQueue, sharedResource, createPrefetchMetrics, traceRequest,
    hgEngine: { fetchVideoInfo: async () => ({ rows: [] }) },
    coreProvider: provider,
    handleLibrary: async () => false,
    handleHistory: async () => false,
    vidToSeriesMap: new Map(),
    console: { error() {} },
  });

  vm.runInContext(
    source.slice(source.indexOf('function json('), source.indexOf('listenWithFallback(server, PORT')) +
    '\nthis.server = server;this.queue = prefetchQueue;',
    context
  );

  const server = context.server;
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    context.queue.close();
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  // 1. Cold fetch without prefetch: takes ~80ms
  const tCold0 = performance.now();
  const coldRes = await fetch(`${base}/api/series/77`);
  const coldElapsed = performance.now() - tCold0;
  assert.equal(coldRes.status, 200);
  assert.ok(coldElapsed >= 50, `cold fetch should take > 50ms, took ${coldElapsed.toFixed(2)}ms`);

  // 2. Trigger prefetch for next drama
  const prefetchRes = await fetch(`${base}/api/prefetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets: [{ kind: 'detail', id: '88' }] }),
  });
  assert.equal(prefetchRes.status, 202);
  const prefetchData = await prefetchRes.json();
  assert.ok(prefetchData.id);

  // Wait for prefetch queue to warm the cache
  for (let i = 0; i < 25 && provider.detailCacheStatus('88') !== 'HIT'; i++) {
    await new Promise(r => setTimeout(r, 20));
  }

  // 3. User switches to next drama: cache hit returns in < 50ms (typically 1-5ms)
  const tWarm0 = performance.now();
  const warmRes = await fetch(`${base}/api/series/88`);
  const warmElapsed = performance.now() - tWarm0;
  assert.equal(warmRes.status, 200);
  const warmData = await warmRes.json();
  assert.equal(warmData.id, '88');
  assert.ok(warmElapsed < 50, `warm fetch after prefetch should take < 50ms, took ${warmElapsed.toFixed(2)}ms`);
});
