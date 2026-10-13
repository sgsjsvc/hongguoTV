import { historyUuid } from './history-outbox.mjs';

/** Stable ordered recommendation metadata. Loading a page never selects its content. */
export class RecommendationSession {
  constructor(fetchPage, uuid = historyUuid, changed = () => {}, selected = () => {}) {
    Object.assign(this, {fetchPage, uuid, changed, selected, items: [], page: 0, index: 0, id: '', generation: 0, selection: 0, pending: new Map(), exhausted: false, error: ''});
  }
  notify() { this.changed({items: [...this.items], index: this.index, page: this.page, loading: this.pending.size > 0, error: this.error, session: this.id}); }
  cancel() { for (const request of this.pending.values()) request.controller.abort(); this.pending.clear(); this.generation++; this.selection++; this.notify(); }
  preferenceKey(preferences = {}) { return `${preferences.recommendationMode || 'mixed'}:${preferences.recommendationResetAt || 0}`; }
  needsRestart(preferences = {}) { return !this.id || this.preferences !== this.preferenceKey(preferences); }
  async start(preferences = {}) {
    this.preferences = this.preferenceKey(preferences);
    this.cancel(); this.id = this.uuid(); this.items = []; this.index = 0; this.page = 0; this.exhausted = false; this.error = ''; this.notify();
    const generation = this.generation;
    await this.load(1);
    if (this.generation === generation && this.items.length) this.select(0);
  }
  async retry() {
    const generation = this.generation;
    await this.load(this.page + 1);
    if (this.generation === generation && this.page === 1 && this.items.length) this.select(0);
  }
  async load(page = this.page + 1) {
    if (this.pending.has(page)) return this.pending.get(page).promise;
    if (page <= this.page || this.exhausted) return;
    const generation = this.generation, id = this.id, controller = new AbortController();
    const request = {controller, promise: null};
    this.pending.set(page, request); this.error = ''; this.notify();
    request.promise = (async () => {
      try {
        const data = await this.fetchPage(page, id, controller.signal);
        if (generation !== this.generation || id !== this.id) return;
        if (data.session && data.session !== id) throw new Error('推荐会话不匹配，请重试');
        const seen = new Set(this.items.map(item => String(item.id)));
        for (const item of data.items || []) if (!seen.has(String(item.id))) { seen.add(String(item.id)); this.items.push(item); }
        this.page = page; this.exhausted = !(data.items || []).length;
      } catch (error) {
        if (generation !== this.generation) return;
        this.error = '推荐暂时不可用，请重试'; throw error;
      } finally {
        if (generation === this.generation) { this.pending.delete(page); this.notify(); }
      }
    })();
    return request.promise;
  }
  select(index, reason) {
    if (!this.items[index]) return;
    this.selection++; this.index = index; this.notify(); this.selected(this.items[index], this.id, reason);
  }
  async advance(direction, reason = direction) {
    const index = this.index + (direction === 'next' ? 1 : -1);
    if (index < 0) return false;
    const generation = this.generation, selection = this.selection;
    if (index >= this.items.length) await this.load();
    if (generation !== this.generation || selection !== this.selection || !this.items[index]) return false;
    this.select(index, reason); return true;
  }
}

/** Measures effective playback wall time; currentTime changes and playback speed cannot inflate it. */
export class RecommendationWatch {
  constructor(emit, clock = () => performance.now()) { this.emit = emit; this.clock = clock; this.records = new Map(); this.active = null; this.last = null; }
  discard() { this.last = null; this.active = null; this.records.clear(); }
  begin(session, series) {
    this.leave();
    if (!['real-drama','comic-drama','ai-drama'].includes(series.contentType)) return;
    const key = `${session}:${series.id}`;
    const previous = this.records.get(key);
    const value = previous || {seriesId: series.id, title: series.title || '', tags: series.tags || '', ...(series.contentType ? {contentType: series.contentType} : {}), watchMs: 0, exposures: 0, skips: 0, completed: false};
    value.exposures++; this.records.set(key, value); this.active = {key, value, visitStart: value.watchMs, flushed: value.watchMs}; this.flush();
  }
  accrue() {
    if (this.active && this.last !== null) { const now = this.clock(); this.active.value.watchMs += Math.max(0, Math.round(now - this.last)); this.last = now; }
  }
  playing() { if (this.active && this.last === null) this.last = this.clock(); }
  tick() { this.accrue(); if (this.active && this.active.value.watchMs - this.active.flushed >= 10000) this.flush(); }
  pause() { this.accrue(); this.last = null; this.flush(); }
  flush() {
    if (!this.active) return;
    const signature = JSON.stringify(this.active.value);
    if (signature === this.active.emitted) return;
    if (this.emit(this.active.key, {...this.active.value}) === false) return;
    this.active.emitted = signature; this.active.flushed = this.active.value.watchMs;
  }
  complete() { this.accrue(); if (this.active) this.active.value.completed = true; this.flush(); }
  leave(direction) {
    this.accrue(); this.last = null;
    if (this.active) {
      const visit = this.active.value.watchMs - this.active.visitStart;
      if (direction === 'next' && visit > 0 && visit < 10000 && !this.active.value.completed) this.active.value.skips++;
      this.flush(); this.active = null;
    }
  }
}

/** Bind actual media states; timer alone never turns stalled/error playback into valid watching. */
export function bindRecommendationPlayback(video, watch, env = globalThis) {
  const doc = env.document, win = env.window || env;
  let blocked = video.seeking || video.readyState < 3;
  const eligible = () => !doc.hidden && !video.paused && !video.ended && !video.seeking && video.readyState >= 3 && !blocked;
  const resume = () => { if (eligible()) watch.playing(); };
  const playing = () => { blocked = false; resume(); };
  const suspend = () => { blocked = true; watch.pause(); };
  const seeked = () => { blocked = video.readyState < 3; resume(); };
  const visibility = () => { if (doc.hidden) watch.pause(); else resume(); };
  const pauses = ['pause', 'waiting', 'stalled', 'seeking', 'error', 'ended'];
  for (const event of pauses) video.addEventListener(event, suspend);
  video.addEventListener('playing', playing); video.addEventListener('seeked', seeked);
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('pagehide', suspend);
  const timer = env.setInterval(() => { if (eligible()) {resume();watch.tick();} else watch.pause(); }, 1000);
  resume();
  return () => {
    watch.pause(); env.clearInterval(timer);
    for (const event of pauses) video.removeEventListener(event, suspend);
    video.removeEventListener('playing', playing);video.removeEventListener('seeked', seeked);
    doc.removeEventListener('visibilitychange', visibility);win.removeEventListener('pagehide', suspend);
  };
}
