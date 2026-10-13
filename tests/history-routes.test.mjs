import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { HistoryStore } from '../server/history-store.mjs';
import { createHistoryHandler } from '../server/history-routes.mjs';

async function fixture(t) {
  const store = new HistoryStore(':memory:');
  const handle = createHistoryHandler(store);
  const server = http.createServer(async (req, res) => { if (!await handle(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
}

test('HTTP clients share persisted history and can delete across platforms', async t => {
  const request = await fixture(t);
  const registration = await request('/api/history/sessions', 'POST', { sessionId: 'tv1', clientId: 'living-room', source: 'tv', startedAt: Date.now(), series: { id: '123', title: '电视剧' } });
  assert.equal(registration.status, 200);
  assert.ok(registration.body.sessionOrder > 0);
  const update = { sessionId: 'tv1', sequence: 1, episodeId: '456', episodeNumber: 2, positionMs: 12345, durationMs: 60000, completed: false, observedAt: Date.now() };
  assert.equal((await request('/api/history/progress', 'POST', update)).body.accepted, true);
  assert.equal((await request('/api/history?source=all')).body.items[0].source, 'tv');
  assert.equal((await request('/api/history/123?source=tv')).body.item.positionMs, 12345);
  assert.equal((await request('/api/history?source=web')).body.items.length, 0);
  assert.equal((await request('/api/history/123', 'DELETE')).status, 200);
  assert.equal((await request('/api/history/123')).body.item, null);
  assert.equal((await request('/api/history/progress', 'POST', { ...update, sequence: 2 })).status, 410);
});

test('history routes return useful JSON errors and bounded request handling', async t => {
  const request = await fixture(t);
  assert.equal((await request('/api/history?source=phone')).status, 400);
  assert.equal((await request('/api/history/sessions', 'POST', '{bad')).status, 400);
  assert.equal((await request('/api/history/sessions', 'POST', 'null')).status, 400);
  assert.equal((await request('/api/history/sessions', 'POST', JSON.stringify({ huge: 'x'.repeat(2 * 1024 * 1024) }))).status, 413);
  const unsupported = await request('/api/history', 'POST', {});
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
  assert.equal((await request('/api/history/import', 'POST', { clientId: 'tv', source: 'tv', items: [] })).status, 200);
  assert.equal((await request('/api/history', 'DELETE')).body.ok, true);
});
