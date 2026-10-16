import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrefetchQueue, sharedResource, upstreamRequestSignal } from '../server/provider.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('prefetch deduplicates jobs, limits concurrency, and cancels only unwanted targets', async () => {
  const gates = new Map(); let active = 0, maximum = 0, calls = 0, aborted = 0;
  const queue = createPrefetchQueue(async (target, signal) => {
    calls++; active++; maximum = Math.max(active, maximum);
    try { await new Promise((resolve, reject) => {
      gates.set(target.id, resolve);
      signal.addEventListener('abort', () => { aborted++; reject(signal.reason); }, { once: true });
    }); } finally { active--; }
  });
  const one = queue.submit([{ kind: 'detail', id: '1' }, { kind: 'detail', id: '2' }]);
  const two = queue.submit([{ kind: 'detail', id: '1' }]);
  await tick(); assert.equal(calls, 1);
  queue.cancel(one.id); await tick(); assert.equal(aborted, 0);
  gates.get('1')(); await tick(); await tick();
  assert.equal(queue.status(two.id).state, 'complete');
  assert.equal(calls, 1); assert.equal(maximum, 1);
  const three = queue.submit([{ kind: 'qualities', id: '3', seriesId: '4' }]);
  await tick(); queue.cancel(three.id); await tick();
  assert.equal(aborted, 1); assert.equal(queue.status(three.id).state, 'cancelled');
  queue.close();
});

test('prefetch isolates failures, is disableable and rejects invalid or excessive batches', async () => {
  let calls = 0;
  const queue = createPrefetchQueue(async () => { calls++; throw Error('upstream unavailable'); });
  const batch = queue.submit([{ kind: 'detail', id: '7' }]);
  await tick(); await tick(); assert.equal(queue.status(batch.id).state, 'complete');
  assert.equal(queue.status(batch.id).targets[0].state, 'failed');
  assert.throws(() => queue.submit([{ kind: 'detail', id: 9007199254740992 }]), /字符串|ID/);
  assert.throws(() => queue.submit([{ kind: 'recommend', page: 99 }]), /类型/);
  assert.throws(() => queue.submit(Array.from({ length: 9 }, (_, i) => ({ kind: 'detail', id: String(i) }))), /8/);
  queue.close();
  const disabled = createPrefetchQueue(async () => { calls++; }, { enabled: false });
  assert.equal(disabled.submit([{ kind: 'detail', id: '9' }]).enabled, false);
  assert.equal(calls, 1); disabled.close();
});

test('queued prefetch waits for foreground work instead of taking its slots', async () => {
  const gate = deferred(); let calls = 0;
  const queue = createPrefetchQueue(async () => { calls++; });
  const foreground = queue.foreground(() => gate.promise);
  queue.submit([{ kind: 'detail', id: '1' }]);
  await tick(); assert.equal(calls, 0);
  gate.resolve(); await foreground; await tick(); await tick();
  assert.equal(calls, 1); queue.close();
});

test('foreground joining cancelled prefetch retains shared upstream, but abandoned work aborts', async () => {
  const controller = new AbortController(); const gate = deferred(); let signal, calls = 0;
  const load = () => { calls++; signal = upstreamRequestSignal(); return gate.promise; };
  const prefetch = sharedResource('test-join', load, { signal: controller.signal });
  const foreground = sharedResource('test-join', load);
  controller.abort(); await assert.rejects(prefetch);
  assert.equal(signal.aborted, false); gate.resolve('detail'); assert.equal(await foreground, 'detail'); assert.equal(calls, 1);
  const last = new AbortController(); let abandonedSignal;
  const abandoned = sharedResource('test-abandon', async () => {
    abandonedSignal = upstreamRequestSignal();
    return new Promise((resolve, reject) => abandonedSignal.addEventListener('abort', () => reject(abandonedSignal.reason), { once: true }));
  }, { signal: last.signal });
  last.abort(); await assert.rejects(abandoned); assert.equal(abandonedSignal.aborted, true);
});
