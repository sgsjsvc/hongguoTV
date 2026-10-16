import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {createPrefetchQueue} from '../server/provider.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

test('time-weighted concurrency counts overlapping work, failures and cancellation',async()=>{
 let now=0;const metrics=createPrefetchMetrics({now:()=>now});
 const gate=deferred();
 const first=metrics.run(()=>gate.promise);
 now=10;const second=metrics.run(async()=>{now=20;throw Error('failed');});
 await assert.rejects(second,/failed/);
 now=30;gate.resolve();await first;
 const stats=metrics.snapshot();
 assert.equal(stats.active,0);assert.equal(stats.maxActive,2);assert.equal(stats.started,2);
 assert.equal(stats.succeeded,1);assert.equal(stats.failed,1);assert.equal(stats.cancelled,0);
 assert.equal(stats.elapsedMs,30);assert.equal(stats.activeTimeMs,40);assert.equal(stats.averageConcurrency,40/30);
 await assert.rejects(metrics.run(()=>{throw new DOMException('cancel','AbortError');}));
 assert.equal(metrics.snapshot().cancelled,1);
});

test('two-slot queue remains bounded, drains after failure and gives foreground priority',async()=>{
 const metrics=createPrefetchMetrics(),gates=new Map();
 const queue=createPrefetchQueue((target,signal)=>metrics.run(()=>new Promise((resolve,reject)=>{
  gates.set(target.id,resolve);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
 })),{concurrency:2});
 try{
  const batch=queue.submit(['1','2','3','4'].map(id=>({kind:'detail',id})));
  await tick();assert.equal(metrics.snapshot().active,2);
  const foregroundGate=deferred();const foreground=queue.foreground(()=>foregroundGate.promise);
  gates.get('1')();gates.get('2')();await tick();await tick();
  assert.equal(metrics.snapshot().active,0);assert.equal(metrics.snapshot().started,2);
  foregroundGate.resolve();await foreground;await tick();assert.equal(metrics.snapshot().active,2);
  queue.cancel(batch.id);await tick();await tick();
  assert.equal(metrics.snapshot().active,0);assert.equal(metrics.snapshot().maxActive,2);
  assert.equal(metrics.snapshot().cancelled,2);
 }finally{queue.close();}
});

test('disabled queues start no work; concurrency metrics are snapshots not mutable internals',async()=>{
 const metrics=createPrefetchMetrics();const queue=createPrefetchQueue(()=>metrics.run(async()=>{}),{concurrency:2,enabled:false});
 try{
  queue.submit([{kind:'detail',id:'1'}]);await tick();
  const stats=metrics.snapshot();assert.equal(stats.started,0);assert.equal(stats.averageConcurrency,0);
  stats.active=900;assert.equal(metrics.snapshot().active,0);
 }finally{queue.close();}
});
