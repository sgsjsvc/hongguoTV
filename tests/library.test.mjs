import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../shared/library-store.mjs';

const event = (id, at, value, extra = {}) => ({ id, deviceId: 'device-a', seq: Number(id.replace(/\D/g,'')) || 1, kind: 'history', key: '9007199254740993', op: 'set', at, value, ...extra });
const progress = positionMs => ({ seriesId:'9007199254740993',title:'剧',episodeId:'9007199254740995',episodeNumber:2,positionMs,durationMs:90000,completed:false });

test('seeding preserves equal-time deletion ordering and does not change the local snapshot',()=>{
 const store=new LibraryStore(':memory:');try{
  store.setMeta('deviceId','c');
  store.receive([{id:'clear',deviceId:'b',seq:1,kind:'favorite',key:'*',op:'clear',at:100,value:null},{id:'set',deviceId:'a',seq:1,kind:'favorite',key:'s',op:'set',at:100,value:{id:'s',title:'剧'}}]);
  assert.equal(store.snapshot().favorites.length,0);store.seedTarget('new');assert.equal(store.snapshot().favorites.length,0);
  const replica=new LibraryStore(':memory:');try{replica.receive(store.pending('new'));assert.equal(replica.snapshot().favorites.length,0);}finally{replica.close();}
 }finally{store.close();}
});

test('library accepts newer backward seeks, ignores delayed events, and deduplicates retries', () => {
  const store = new LibraryStore(':memory:');
  try {
    store.receive([event('e1',100,progress(50000)),event('e2',200,progress(2000)),event('e3',150,progress(40000))]);
    assert.equal(store.snapshot().history[0].positionMs,2000);
    const first = store.changes(0);
    store.receive([event('e2',200,progress(2000))]);
    assert.equal(store.changes(0).events.length,first.events.length);
  } finally { store.close(); }
});
test('clear and per-record deletion cannot be undone by older offline events', () => {
  const store = new LibraryStore(':memory:');
  try {
    store.receive([event('e1',100,progress(5000)),event('e2',200,null,{op:'clear',key:'*'}),event('e3',150,progress(9000))]);
    assert.equal(store.snapshot().history.length,0);
    store.receive([event('e4',300,progress(1000)),event('e5',400,null,{op:'delete'}),event('e6',350,progress(2000))]);
    assert.equal(store.snapshot().history.length,0);
    store.receive([event('e7',500,progress(3000))]);
    assert.equal(store.snapshot().history[0].positionMs,3000);
  } finally { store.close(); }
});
test('transactional local writes queue independently for each remote and remote changes do not echo', () => {
  const store = new LibraryStore(':memory:');
  try {
    const saved=store.write({kind:'history',key:'9007199254740993',op:'set',value:progress(12345)});
    assert.equal(store.pending('remote-a').length,1);
    store.acknowledge('remote-a',[saved.id]);
    assert.equal(store.pending('remote-a').length,0);
    assert.equal(store.pending('remote-b').length,1);
    store.receive([event('remote1',Date.now()+1000,progress(54321),{deviceId:'other'})]);
    assert.equal(store.pending('remote-a').length,0);
    assert.equal(store.snapshot().history[0].positionMs,54321);
  } finally { store.close(); }
});
