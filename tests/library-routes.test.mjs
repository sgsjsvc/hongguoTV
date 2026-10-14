import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { LibraryStore } from '../shared/library-store.mjs';
import { createLibraryHandler } from '../custom-server/library-routes.mjs';

async function fixture(t) {
  const store = new LibraryStore(':memory:');
  const handle = createLibraryHandler(store, { view: () => ({}) });
  const server = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://localhost'))) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const migrationEvents = id => store.db.prepare('SELECT id FROM library_events WHERE id LIKE ? ORDER BY id').all(`migration:${id}:%`).map(row => row.id);
  const marker = id => store.getMeta(`migration:${id}`);
  return { request, migrationEvents, marker };
}
const operation = (key, query) => ({ kind: 'search', key, op: 'set', value: { query } });

test('a failed migration import keeps committed operations and an idempotent retry completes it', async t => {
  const { request, migrationEvents, marker } = await fixture(t);
  const partial = await request('/api/library/import', 'POST', {
    migrationId: 'm1',
    operations: [operation('q1', 'q1'), operation('q2', 'q2'), { kind: 'bogus', key: 'q3', op: 'set', value: { query: 'q3' } }],
  });
  assert.equal(partial.status, 400);
  assert.equal(partial.body.error, 'invalid event kind or operation');
  assert.deepEqual(migrationEvents('m1'), ['migration:m1:0', 'migration:m1:1']);
  assert.equal(marker('m1'), null);

  const retry = await request('/api/library/import', 'POST', {
    migrationId: 'm1',
    operations: [operation('q1', 'q1'), operation('q2', 'q2'), operation('q3', 'q3')],
  });
  assert.equal(retry.status, 200);
  assert.deepEqual(migrationEvents('m1'), ['migration:m1:0', 'migration:m1:1', 'migration:m1:2']);
  assert.equal(marker('m1'), true);
  assert.deepEqual((await request('/api/library')).body.searchHistory.sort(), ['q1', 'q2', 'q3']);
});

test('a completed migration import is not replayed', async t => {
  const { request, migrationEvents, marker } = await fixture(t);
  const body = { migrationId: 'm2', operations: [operation('only', 'only')] };
  assert.equal((await request('/api/library/import', 'POST', body)).status, 200);
  assert.equal((await request('/api/library/import', 'POST', body)).status, 200);
  assert.deepEqual(migrationEvents('m2'), ['migration:m2:0']);
  assert.equal(marker('m2'), true);
  assert.deepEqual((await request('/api/library')).body.searchHistory, ['only']);
});
