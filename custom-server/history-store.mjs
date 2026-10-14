import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class HistoryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const invalid = message => { throw new HistoryError(400, message); };
function string(value, field, max = 256, optional = false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) invalid(`${field} must be a string of at most ${max} characters`);
  return value;
}
function integer(value, field, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${field} must be an integer between ${min} and ${max}`);
  return value;
}
function source(value = 'all', allowAll = true) {
  if (!['web', 'pc', 'tv', ...(allowAll ? ['all'] : [])].includes(value)) invalid('source must be all, web, pc or tv');
  return value;
}
function timestamp(value, field) {
  return value == null ? Date.now() : Math.min(integer(value, field), Date.now() + 300000);
}
function series(value) {
  if (!value || typeof value !== 'object') invalid('series is required');
  return { id: string(value.id, 'series.id'), title: string(value.title, 'series.title', 1000), cover: string(value.cover, 'cover', 8192, true), badge: string(value.badge, 'badge', 1000, true), tags: string(value.tags, 'tags', 4000, true), description: string(value.description, 'description', 20000, true) };
}
function playback(value) {
  if (value.completed != null && typeof value.completed !== 'boolean') invalid('completed must be boolean');
  return { episodeId: string(value.episodeId, 'episodeId'), episodeNumber: integer(value.episodeNumber, 'episodeNumber', 1, 1000000), positionMs: integer(value.positionMs, 'positionMs', 0, 31536000000), durationMs: integer(value.durationMs ?? 0, 'durationMs', 0, 31536000000), completed: value.completed ?? false };
}

export class HistoryStore {
  constructor(filename = process.env.HISTORY_DB_PATH || fileURLToPath(new URL('./data/history.sqlite', import.meta.url))) {
    if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (session_order INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT UNIQUE NOT NULL, client_id TEXT NOT NULL, source TEXT NOT NULL, series_id TEXT NOT NULL, series_json TEXT NOT NULL, started_at INTEGER NOT NULL, sequence INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS sessions_series_source ON sessions(series_id, source, session_order);
      CREATE TABLE IF NOT EXISTS history (series_id TEXT NOT NULL, source TEXT NOT NULL, item_json TEXT NOT NULL, updated_at INTEGER NOT NULL, imported INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL, PRIMARY KEY(series_id,source));
      CREATE TABLE IF NOT EXISTS tombstones (series_id TEXT NOT NULL, source TEXT NOT NULL, deleted_at INTEGER NOT NULL, PRIMARY KEY(series_id,source));
      CREATE TABLE IF NOT EXISTS deletion_watermarks (source TEXT PRIMARY KEY NOT NULL, deleted_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY AUTOINCREMENT);`);
    // Upgrade databases created by the first shared-history preview.
    if (!this.db.prepare('PRAGMA table_info(tombstones)').all().some(column => column.name === 'deleted_at')) {
      this.db.exec('ALTER TABLE tombstones ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0');
      this.db.prepare('UPDATE tombstones SET deleted_at=?').run(Date.now());
    }
    if (!this.db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'started_at')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN started_at INTEGER NOT NULL DEFAULT 0');
    }
  }
  close() { this.db.close(); }
  transaction(operation) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  registerSession(value) {
    const sessionId = string(value.sessionId, 'sessionId');
    const clientId = string(value.clientId, 'clientId');
    const platform = source(value.source, false);
    const metadata = series(value.series);
    const startedAt = timestamp(value.startedAt, 'startedAt');
    return this.transaction(() => {
      const previous = this.db.prepare('SELECT * FROM sessions WHERE session_id=?').get(sessionId);
      if (previous) {
        if (previous.client_id !== clientId || previous.source !== platform || previous.series_id !== metadata.id) throw new HistoryError(409, 'session identity cannot be changed');
        if (previous.deleted) throw new HistoryError(410, 'history session was deleted');
        return { sessionId, sessionOrder: previous.session_order };
      }
      const removed = this.db.prepare('SELECT deleted_at FROM tombstones WHERE series_id=? AND source=?').get(metadata.id, platform)?.deleted_at ?? -1;
      const cleared = this.db.prepare('SELECT deleted_at FROM deletion_watermarks WHERE source=?').get(platform)?.deleted_at ?? -1;
      const deletedAt = Math.max(removed, cleared);
      // D4-F7: deletion markers must not be jumpable via a client-claimed future timestamp.
      // Clock skew up to 1s is tolerated; a claim further ahead cannot be trusted to be after the deletion.
      if (deletedAt >= 0 && startedAt > Date.now() + 1000) throw new HistoryError(410, 'history session predates deletion');
      if (startedAt <= deletedAt) throw new HistoryError(410, 'history session predates deletion');
      const result = this.db.prepare('INSERT INTO sessions(session_id,client_id,source,series_id,series_json,started_at) VALUES(?,?,?,?,?,?)').run(sessionId, clientId, platform, metadata.id, JSON.stringify(metadata), startedAt);
      return { sessionId, sessionOrder: Number(result.lastInsertRowid) };
    });
  }
  saveProgress(value) {
    const sessionId = string(value.sessionId, 'sessionId');
    const sequence = integer(value.sequence, 'sequence', 1);
    const data = playback(value);
    const observedAt = timestamp(value.observedAt, 'observedAt');
    return this.transaction(() => {
      const current = this.db.prepare('SELECT * FROM sessions WHERE session_id=?').get(sessionId);
      if (!current) throw new HistoryError(404, 'history session not found');
      if (current.deleted) throw new HistoryError(410, 'history session was deleted');
      const latest = this.db.prepare('SELECT session_order FROM sessions WHERE series_id=? AND source=? ORDER BY started_at DESC,session_order DESC LIMIT 1').get(current.series_id, current.source).session_order;
      if (sequence <= current.sequence || latest !== current.session_order) return { accepted: false, item: this.get(current.series_id, current.source) };
      const metadata = JSON.parse(current.series_json);
      const item = { seriesId: metadata.id, title: metadata.title, cover: metadata.cover, badge: metadata.badge, tags: metadata.tags, description: metadata.description, ...data, updatedAt: observedAt, source: current.source, sessionId, sequence };
      const revision = Number(this.db.prepare('INSERT INTO revisions DEFAULT VALUES').run().lastInsertRowid);
      this.db.prepare('UPDATE sessions SET sequence=? WHERE session_id=?').run(sequence, sessionId);
      this.db.prepare('INSERT INTO history VALUES(?,?,?,?,0,?) ON CONFLICT(series_id,source) DO UPDATE SET item_json=excluded.item_json,updated_at=excluded.updated_at,imported=0,revision=excluded.revision').run(current.series_id, current.source, JSON.stringify(item), item.updatedAt, revision);
      return { accepted: true, item };
    });
  }
  list(platform = 'all') {
    source(platform);
    const rows = platform === 'all'
      ? this.db.prepare('SELECT * FROM history ORDER BY imported ASC, updated_at DESC, revision DESC').all()
      : this.db.prepare('SELECT * FROM history WHERE source=? ORDER BY updated_at DESC, revision DESC').all(platform);
    const seen = new Set();
    return rows.filter(row => { if (seen.has(row.series_id)) return false; seen.add(row.series_id); return true; }).map(row => JSON.parse(row.item_json));
  }
  get(seriesId, platform = 'all') {
    string(seriesId, 'seriesId');
    return this.list(platform).find(item => item.seriesId === seriesId) ?? null;
  }
  remove(seriesId, platform = 'all') {
    string(seriesId, 'seriesId'); source(platform);
    return this.transaction(() => {
      const deletedAt = Date.now();
      for (const entry of platform === 'all' ? ['web', 'pc', 'tv'] : [platform]) {
        this.db.prepare('UPDATE sessions SET deleted=1 WHERE series_id=? AND source=?').run(seriesId, entry);
        this.db.prepare('DELETE FROM history WHERE series_id=? AND source=?').run(seriesId, entry);
        this.db.prepare('INSERT INTO tombstones(series_id,source,deleted_at) VALUES(?,?,?) ON CONFLICT(series_id,source) DO UPDATE SET deleted_at=MAX(deleted_at,excluded.deleted_at)').run(seriesId, entry, deletedAt);
      }
      return { ok: true };
    });
  }
  clear(platform = 'all') {
    source(platform);
    return this.transaction(() => {
      const deletedAt = Date.now();
      const where = platform === 'all' ? '' : ' WHERE source=?';
      const params = platform === 'all' ? [] : [platform];
      for (const entry of platform === 'all' ? ['web', 'pc', 'tv'] : [platform]) {
        this.db.prepare('INSERT INTO deletion_watermarks(source,deleted_at) VALUES(?,?) ON CONFLICT(source) DO UPDATE SET deleted_at=MAX(deleted_at,excluded.deleted_at)').run(entry, deletedAt);
      }
      this.db.prepare(`UPDATE sessions SET deleted=1${where}`).run(...params);
      this.db.prepare(`DELETE FROM history${where}`).run(...params);
      return { ok: true };
    });
  }
  importLegacy(value) {
    string(value.clientId, 'clientId');
    const platform = source(value.source, false);
    if (!Array.isArray(value.items) || value.items.length > 10000) invalid('items must be an array with at most 10000 entries');
    const items = value.items.map(raw => {
      const metadata = series({ ...raw, id: raw.seriesId });
      const data = playback(raw);
      return { seriesId: metadata.id, title: metadata.title, cover: metadata.cover, badge: metadata.badge, tags: metadata.tags, description: metadata.description, ...data, updatedAt: integer(raw.updatedAt, 'updatedAt'), source: platform, sessionId: '', sequence: 0 };
    });
    return this.transaction(() => {
      for (const item of items) {
        // D4-F1: compare against deletion timestamps instead of mere existence, so data updated
        // after a clear/tombstone is importable while stale data stays blocked (mirrors registerSession).
        const removed = this.db.prepare('SELECT deleted_at FROM tombstones WHERE series_id=? AND source=?').get(item.seriesId, platform)?.deleted_at ?? -1;
        const cleared = this.db.prepare('SELECT deleted_at FROM deletion_watermarks WHERE source=?').get(platform)?.deleted_at ?? -1;
        if (item.updatedAt <= Math.max(removed, cleared)) continue;
        const revision = Number(this.db.prepare('INSERT INTO revisions DEFAULT VALUES').run().lastInsertRowid);
        this.db.prepare('INSERT OR IGNORE INTO history VALUES(?,?,?,?,1,?)').run(item.seriesId, platform, JSON.stringify(item), item.updatedAt, revision);
      }
      return { ok: true };
    });
  }
}
