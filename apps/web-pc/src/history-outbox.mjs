// The journal contains only unacknowledged uploads, never an authoritative history list.
export const historyUuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), x => x.toString(16)).join('')}`;
export class HistoryOutbox {
  constructor(storage, origin, source, request, uuid = historyUuid, journalKey) {
    this.storage = storage;
    this.key = journalKey || `hg_history_outbox_v1:${source}:${origin}`;
    this.request = request;
    this.uuid = uuid;
    this.source = source;
    this.origin = origin;
    this.active = null;
    this.busy = false;
    this.refresh();
  }
  refresh() {
    const raw = this.storage.getItem(this.key);
    this.state = raw ? JSON.parse(raw) : this.state || { clientId: this.uuid(), origin: this.origin, source: this.source };
    if (this.state.operations?.length) {
      // Upgrade an old whole-journal queue without deleting its recovery copy before all events are durable.
      for (const operation of this.state.operations) this.storage.setItem(this.eventKey(operation.progress), JSON.stringify(operation));
      delete this.state.operations;
      this.persist();
    }
  }
  persist() {
    this.storage.setItem(this.key, JSON.stringify({clientId:this.state.clientId,origin:this.origin,source:this.source,kind:'history-journal'}));
  }
  eventKey(progress) { return `${this.key}:event:${encodeURIComponent(progress.sessionId)}:${progress.sequence}`; }
  events() {
    const result = [];
    // Every event has its own immutable key. Acknowledgement never rewrites another process's tick.
    const keys = Array.from({length:this.storage.length}, (_,i)=>this.storage.key(i));
    for (const key of keys) {
      if (!key?.startsWith(`${this.key}:event:`)) continue;
      const raw = this.storage.getItem(key);
      if (raw) result.push({key,operation:JSON.parse(raw)});
    }
    return result;
  }
  pending() {
    this.refresh();
    const latest = new Map();
    for (const {operation} of this.events()) {
      const previous = latest.get(operation.progress.sessionId);
      if (!previous || previous.progress.sequence < operation.progress.sequence) latest.set(operation.progress.sessionId,operation);
    }
    return [...latest.values()];
  }
  begin(series) {
    const session = { sessionId: this.uuid(), clientId: this.state.clientId, source: this.source, series, startedAt: Date.now() };
    this.active = { session, sequence: 0 };
  }
  save(seriesId, data) {
    if (!this.active || this.active.session.series.id !== seriesId) return;
    const signature = JSON.stringify(data);
    if (this.active.lastSignature === signature) return;
    this.refresh();
    const progress = { ...data, durationMs: data.durationMs || 0, completed: data.completed || false,
      sessionId: this.active.session.sessionId, sequence: ++this.active.sequence, observedAt: Date.now() };
    const operation = { session: this.active.session, progress };
    this.persist();
    this.storage.setItem(this.eventKey(progress), JSON.stringify(operation));
    // Remove only older immutable keys from this session after the new event is durable.
    for (const event of this.events()) if (event.operation.progress.sessionId === progress.sessionId && event.operation.progress.sequence < progress.sequence) this.storage.removeItem(event.key);
    this.active.lastSignature = signature;
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      this.refresh();
      const snapshot = this.pending();
      for (const operation of snapshot) {
        let terminal = false;
        try {
          await this.request('/api/history/sessions', operation.session);
          await this.request('/api/history/progress', operation.progress);
        } catch (error) {
          if (error.status !== 410 && error.status !== 409) throw error;
          terminal = true;
          if (this.active?.session.sessionId === operation.session.sessionId) this.active = null;
        }
        for (const event of this.events()) {
          if (event.operation.progress.sessionId === operation.session.sessionId && (terminal || event.operation.progress.sequence <= operation.progress.sequence)) this.storage.removeItem(event.key);
        }
      }
    } finally { this.busy = false; }
  }
  discard(seriesId) {
    for (const event of this.events()) if (!seriesId || event.operation.session.series.id === seriesId) this.storage.removeItem(event.key);
    if (!seriesId || this.active?.session.series.id === seriesId) this.active = null;
  }
}
