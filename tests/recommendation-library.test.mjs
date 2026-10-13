import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore, validateEvent } from '../shared/library-store.mjs';
import { adminOperation, adminSnapshot } from '../apps/sync-server/admin.mjs';
import { createSyncServer } from '../apps/sync-server/server.mjs';
import { LibrarySync } from '../custom-server/library-sync.mjs';
import { createLibraryHandler } from '../custom-server/library-routes.mjs';
import http from 'node:http';

const signal = (seriesId = '90071992547409999') => ({ seriesId, title: '测试剧', tags: '甜宠', contentType: 'comic-drama', watchMs: 12345, exposures: 2, skips: 1, completed: false });
const event = (overrides = {}) => ({ id: 'signal-one', deviceId: 'tv', seq: 1, at: 100, kind: 'recommendation', key: 'session-one:90071992547409999', op: 'set', value: signal(), ...overrides });

test('recommendation signals synchronize cumulative values and preserve observation time', t => {
  const first = new LibraryStore(':memory:');
  const second = new LibraryStore(':memory:');
  t.after(() => { first.close(); second.close(); });
  first.receive([event()]);
  second.receive(first.changes().events);
  assert.deepEqual(second.snapshot().recommendationSignals, [{ ...signal(), sessionId: 'session-one', updatedAt: 100 }]);
  second.receive([event({ id: 'signal-two', seq: 2, at: 200, value: { ...signal(), watchMs: 15000, completed: true } })]);
  assert.equal(second.snapshot().recommendationSignals.length, 1);
  assert.equal(second.snapshot().recommendationSignals[0].watchMs, 15000);
});

test('recommendation clear and per-session deletion prevent older offline signals from returning', t => {
  const store = new LibraryStore(':memory:'); t.after(() => store.close());
  store.receive([event()]);
  store.write({ kind: 'recommendation', key: event().key, op: 'delete', at: 300 });
  store.receive([event({ id: 'delayed', seq: 2, at: 200 })]);
  assert.deepEqual(store.snapshot().recommendationSignals, []);
  store.receive([event({ id: 'newer', seq: 3, at: 400 })]);
  store.write({ kind: 'recommendation', key: '*', op: 'clear', at: 500 });
  store.receive([event({ id: 'late-other', key: 'another:90071992547409999', seq: 4, at: 450 })]);
  assert.deepEqual(store.snapshot().recommendationSignals, []);
});

test('recommendation preferences have safe defaults and reset leaves viewing history intact', t => {
  const store = new LibraryStore(':memory:'); t.after(() => store.close());
  assert.equal(store.snapshot().preferences.recommendationMode, 'mixed');
  assert.equal(store.snapshot().preferences.recommendationResetAt, 0);
  store.write({ kind: 'history', key: 'h', op: 'set', value: { seriesId: 'h', title: '历史', episodeId: 'e', episodeNumber: 1, positionMs: 1000 } });
  store.write({ kind: 'preference', key: 'recommendationMode', op: 'set', value: { value: 'ai-drama' } });
  store.write({ kind: 'preference', key: 'recommendationResetAt', op: 'set', value: { value: 2000 } });
  assert.equal(store.snapshot().preferences.recommendationMode, 'ai-drama');
  assert.equal(store.snapshot().preferences.recommendationResetAt, 2000);
  assert.equal(store.snapshot().history.length, 1);
});

test('recommendation schema rejects mismatched keys, malformed counters and unsupported preferences', () => {
  for (const input of [
    event({ key: 'wrong:series' }), event({ key: ':90071992547409999' }), event({ key: 'session:extra:90071992547409999' }),
    event({ value: { ...signal(), contentType: 'mixed' } }), event({ value: { ...signal(), watchMs: -1 } }),
    event({ value: { ...signal(), exposures: 1.5 } }), event({ value: { ...signal(), skips: Number.MAX_SAFE_INTEGER + 1 } }),
    event({ value: { ...signal(), completed: 'yes' } }), event({ value: { ...signal(), seriesId: 123 } }),
    event({ kind: 'preference', key: 'recommendationMode', value: { value: 'unknown' } }),
    event({ kind: 'preference', key: 'recommendationResetAt', value: { value: -1 } }),
    event({ kind: 'preference', key: 'recommendationResetAt', value: { value: 1.5 } }),
    event({ kind: 'preference', key: 'unsupported', value: { value: 'mixed' } }),
  ]) assert.throws(() => validateEvent(input), error => error.status === 400);
});

test('management preferences and signal deletion use normal synchronization operations', t => {
  const store = new LibraryStore(':memory:'); t.after(() => store.close());
  store.receive([event()]);
  adminOperation(store, { id: 'recommendation-mode-request', kind: 'preference', key: 'recommendationMode', op: 'set', value: { value: 'real-drama' } });
  adminOperation(store, { id: 'recommendation-reset-request', kind: 'preference', key: 'recommendationResetAt', op: 'set', value: { value: 999 } });
  adminOperation(store, { id: 'recommendation-delete-request', kind: 'recommendation', key: event().key, op: 'delete' });
  assert.deepEqual(adminSnapshot(store).recommendationSignals, []);
  assert.equal(adminSnapshot(store).preferences.recommendationMode, 'real-drama');
  assert.throws(() => adminOperation(store, { id: 'forged-signal-request', kind: 'recommendation', key: event().key, op: 'set', value: signal() }), error => error.status === 400);
});

test('favorite and history preserve optional official content type while old records stay compatible', t => {
  const store = new LibraryStore(':memory:'); t.after(() => store.close());
  store.write({ kind: 'favorite', key: 'f', op: 'set', value: { id: 'f', title: '漫剧', contentType: 'comic-drama' } });
  store.write({ kind: 'history', key: 'h', op: 'set', value: { seriesId: 'h', title: 'AI剧', contentType: 'ai-drama', episodeId: 'e', episodeNumber: 1, positionMs: 0 } });
  assert.equal(store.snapshot().favorites[0].contentType, 'comic-drama');
  assert.equal(store.snapshot().history[0].contentType, 'ai-drama');
  store.write({ kind: 'favorite', key: 'old', op: 'set', value: { id: 'old', title: '旧收藏' } });
  assert.equal(Object.hasOwn(store.snapshot().favorites.find(item => item.id === 'old'), 'contentType'), false);
  assert.throws(() => store.write({ kind: 'favorite', key: 'bad', op: 'set', value: { id: 'bad', title: '坏数据', contentType: 'mixed' } }), error => error.status === 400);
});

test('local HTTP operations and authenticated remote sync accept identical recommendation contracts', async () => {
  const remote = new LibraryStore(':memory:');
  const first = new LibraryStore(':memory:');
  const second = new LibraryStore(':memory:');
  const key = 'recommendation-fixture-shared-key';
  const syncServer = createSyncServer(remote, key);
  const a = new LibrarySync(first), b = new LibrarySync(second);
  const handler = createLibraryHandler(first, a);
  const localServer = http.createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(404);res.end(); } });
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  try {
    await listen(syncServer);await listen(localServer);
    const localUrl = `http://127.0.0.1:${localServer.address().port}`;
    const remoteUrl = `http://127.0.0.1:${syncServer.address().port}`;
    const response = await fetch(localUrl + '/api/library/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'recommendation', key: event().key, op: 'set', value: signal() }) });
    assert.equal(response.status, 200);
    const snapshot = await (await fetch(localUrl + '/api/library')).json();
    assert.equal(snapshot.recommendationSignals[0].contentType, 'comic-drama');
    await a.configure({ url: remoteUrl, key }); await b.configure({ url: remoteUrl, key });
    await a.tick(); await b.tick();
    assert.deepEqual(second.snapshot().recommendationSignals, first.snapshot().recommendationSignals);
    const reset = await fetch(remoteUrl + '/api/admin/operations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ id: 'remote-interest-reset', kind: 'preference', key: 'recommendationResetAt', op: 'set', value: { value: 555 } }) });
    assert.equal(reset.status, 200);
    await a.tick();await b.tick();
    assert.equal(second.snapshot().preferences.recommendationResetAt, 555);
    const invalid = await fetch(localUrl + '/api/library/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'recommendation', key: 'wrong:series', op: 'set', value: signal() }) });
    assert.equal(invalid.status, 400);
  } finally { a.stop();b.stop();await close(localServer);await close(syncServer);first.close();second.close();remote.close(); }
});
