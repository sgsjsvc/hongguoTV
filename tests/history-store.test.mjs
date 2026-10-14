import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { HistoryStore } from '../custom-server/history-store.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hongguo-history-'));
  const filename = join(dir, 'history.sqlite');
  let store = new HistoryStore(filename);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  return { get store() { return store; }, restart() { store.close(); store = new HistoryStore(filename); } };
}
const session = (id, source = 'tv', seriesId = '90071992547409999') => ({ sessionId: id, clientId: 'device', source, series: { id: seriesId, title: '测试剧', cover: 'https://cover' } });
const progress = (sessionId, sequence, positionMs = 1000) => ({ sessionId, sequence, episodeId: '90071992547409998', episodeNumber: 1, positionMs, durationMs: 60000, completed: false });

test('accepted history survives database restart with string IDs and milliseconds', t => {
  const f = fixture(t);
  f.store.registerSession(session('first'));
  assert.equal(f.store.saveProgress(progress('first', 1, 12345)).accepted, true);
  f.restart();
  assert.equal(f.store.list('all')[0].positionMs, 12345);
  assert.equal(f.store.get('90071992547409999', 'all').episodeId, '90071992547409998');
});

test('sequence permits intentional rewind but rejects duplicates and old sessions', t => {
  const { store } = fixture(t);
  const first = store.registerSession(session('first'));
  assert.deepEqual(store.registerSession(session('first')), first);
  store.saveProgress(progress('first', 2, 40000));
  assert.equal(store.saveProgress(progress('first', 1)).accepted, false);
  assert.equal(store.saveProgress(progress('first', 2)).accepted, false);
  store.saveProgress(progress('first', 3, 500));
  assert.equal(store.list()[0].positionMs, 500);
  store.registerSession(session('second'));
  assert.equal(store.list()[0].positionMs, 500);
  assert.equal(store.saveProgress(progress('first', 4)).accepted, false);
  assert.throws(() => store.registerSession(session('first', 'web')), e => e.status === 409);
});

test('all deduplicates series while each platform retains its own latest record', t => {
  const { store } = fixture(t);
  for (const source of ['web', 'pc', 'tv']) {
    store.registerSession(session(source, source));
    store.saveProgress(progress(source, 1));
  }
  assert.equal(store.list('all').length, 1);
  assert.equal(store.list('all')[0].source, 'tv');
  assert.equal(store.list('web')[0].source, 'web');
  assert.equal(store.list('pc')[0].source, 'pc');
});

test('deletion tombstones sessions and delayed import cannot recreate deleted history', t => {
  const { store } = fixture(t);
  store.registerSession(session('first'));
  store.saveProgress(progress('first', 1));
  store.remove('90071992547409999', 'tv');
  assert.throws(() => store.saveProgress(progress('first', 2)), e => e.status === 410);
  store.importLegacy({ clientId: 'device', source: 'tv', items: [{ seriesId: '90071992547409999', title: 'old', episodeId: 'old', episodeNumber: 1, positionMs: 1, durationMs: 10, updatedAt: 1 }] });
  assert.equal(store.list().length, 0);
  store.registerSession(session('new'));
  store.saveProgress(progress('new', 1));
  assert.equal(store.list().length, 1);
  store.clear('all');
  assert.throws(() => store.saveProgress(progress('new', 2)), e => e.status === 410);
});

test('legacy import is idempotent, preserves timestamp, and cannot outrank live progress', t => {
  const { store } = fixture(t);
  store.registerSession(session('live', 'web'));
  store.saveProgress(progress('live', 1));
  const payload = { clientId: 'device', source: 'tv', items: [{ seriesId: '90071992547409999', title: 'old', episodeId: 'old', episodeNumber: 1, positionMs: 5, durationMs: 10, updatedAt: Date.now() + 100000 }] };
  store.importLegacy(payload);
  store.importLegacy(payload);
  assert.equal(store.list('all')[0].source, 'web');
  assert.equal(store.list('tv').length, 1);
  assert.equal(store.list('tv')[0].updatedAt, payload.items[0].updatedAt);
});

test('legacy data updated after a clear or tombstone is importable like a fresh registration', t => {
  const { store } = fixture(t);
  store.clear('tv');
  store.importLegacy({ clientId: 'device', source: 'tv', items: [{ seriesId: '90071992547409999', title: 'newer', episodeId: 'e', episodeNumber: 1, positionMs: 1, durationMs: 10, updatedAt: Date.now() + 60000 }] });
  assert.equal(store.list('tv').length, 1);
  store.remove('90071992547409999', 'tv');
  store.importLegacy({ clientId: 'device', source: 'tv', items: [{ seriesId: '90071992547409998', title: 'newer', episodeId: 'e', episodeNumber: 1, positionMs: 1, durationMs: 10, updatedAt: Date.now() + 60000 }] });
  assert.equal(store.list('tv').length, 1);
  assert.equal(store.list('tv')[0].seriesId, '90071992547409998');
  store.importLegacy({ clientId: 'device', source: 'tv', items: [{ seriesId: '90071992547409997', title: 'stale', episodeId: 'e', episodeNumber: 1, positionMs: 1, durationMs: 10, updatedAt: Date.now() - 60000 }] });
  assert.equal(store.list('tv').length, 1);
});

test('a claimed future startedAt cannot jump over deletion markers beyond one second of skew', t => {
  const { store } = fixture(t);
  store.remove('90071992547409999', 'tv');
  assert.throws(() => store.registerSession({ ...session('future'), startedAt: Date.now() + 290000 }), e => e.status === 410);
  assert.throws(() => store.saveProgress(progress('future', 1)), e => e.status === 404);
  store.registerSession({ ...session('skewed'), startedAt: Date.now() + 500 });
  assert.equal(store.saveProgress(progress('skewed', 1)).accepted, true);
});

test('malformed identities and invalid progress are rejected before storage', t => {
  const { store } = fixture(t);
  assert.throws(() => store.registerSession(session('bad', 'phone')), e => e.status === 400);
  assert.throws(() => store.registerSession({ ...session('bad'), series: { id: 123, title: 'bad' } }), e => e.status === 400);
  store.registerSession(session('first'));
  assert.throws(() => store.saveProgress(progress('first', 1, -1)), e => e.status === 400);
  assert.throws(() => store.saveProgress({ ...progress('first', 1), episodeId: 123 }), e => e.status === 400);
  assert.throws(() => store.list('unknown'), e => e.status === 400);
});

test('delayed offline registration cannot supersede a later viewing session', t => {
  const { store } = fixture(t);
  const now = Date.now();
  store.registerSession({ ...session('newer'), startedAt: now });
  store.saveProgress(progress('newer', 1, 20000));
  store.registerSession({ ...session('offline'), startedAt: now - 60000 });
  assert.equal(store.saveProgress(progress('offline', 1)).accepted, false);
  assert.equal(store.list('tv')[0].positionMs, 20000);
});

test('offline upload arrival does not reorder older viewing ahead of another platform', t => {
  const { store } = fixture(t);
  const now = Date.now();
  store.registerSession(session('web', 'web'));
  store.saveProgress({ ...progress('web', 1), observedAt: now });
  store.registerSession({ ...session('offline'), startedAt: now - 60000 });
  store.saveProgress({ ...progress('offline', 1), observedAt: now - 30000 });
  assert.equal(store.list('all')[0].source, 'web');
  assert.equal(store.list('tv')[0].updatedAt, now - 30000);
});

test('delete blocks unregistered offline sessions but allows an explicitly later viewing', t => {
  const { store } = fixture(t);
  const old = Date.now() - 60000;
  store.remove('90071992547409999', 'tv');
  store.remove('90071992547409999', 'tv');
  assert.throws(() => store.registerSession({ ...session('offline'), startedAt: old }), e => e.status === 410);
  store.registerSession({ ...session('later'), startedAt: Date.now() + 1 });
  assert.equal(store.saveProgress(progress('later', 1)).accepted, true);
});

test('platform clear blocks unseen offline series and legacy imports across restart', t => {
  const f = fixture(t);
  const old = Date.now() - 60000;
  f.store.clear('all');
  f.restart();
  for (const platform of ['web', 'pc', 'tv']) {
    assert.throws(() => f.store.registerSession({ ...session(`offline-${platform}`, platform, 'unseen'), startedAt: old }), e => e.status === 410);
    f.store.importLegacy({ clientId: 'device', source: platform, items: [{ seriesId: 'unseen', title: 'old', episodeId: 'old', episodeNumber: 1, positionMs: 1, durationMs: 10, updatedAt: old }] });
    assert.equal(f.store.list(platform).length, 0);
  }
  f.store.registerSession({ ...session('new', 'tv', 'unseen'), startedAt: Date.now() + 1 });
  assert.equal(f.store.saveProgress(progress('new', 1)).accepted, true);
});

test('clearing one platform preserves other platform records and sessions', t => {
  const { store } = fixture(t);
  store.registerSession(session('web', 'web'));
  store.saveProgress(progress('web', 1));
  store.clear('tv');
  assert.equal(store.saveProgress(progress('web', 2)).accepted, true);
  assert.equal(store.list('web').length, 1);
});

test('preview database upgrades deletion markers without losing their protection', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hongguo-history-migrate-'));
  const filename = join(dir, 'history.sqlite');
  const old = new DatabaseSync(filename);
  old.exec(`CREATE TABLE tombstones(series_id TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY(series_id,source)); INSERT INTO tombstones VALUES('90071992547409999','tv');`);
  old.close();
  const store = new HistoryStore(filename);
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.throws(() => store.registerSession({ ...session('offline'), startedAt: Date.now() - 60000 }), e => e.status === 410);
  store.remove('90071992547409999', 'tv');
  store.clear('all');
  assert.equal(store.list().length, 0);
});
