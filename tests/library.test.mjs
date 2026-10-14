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
test('an explicit event timestamp may not rewind lastTime', () => {
  const store = new LibraryStore(':memory:');
  try {
    const first=store.write({kind:'search',key:'a',op:'set',at:1000,value:{query:'a'}});
    const second=store.write({kind:'search',key:'b',op:'set',at:500,value:{query:'b'}});
    assert.equal(first.at,1000);
    assert.equal(second.at,1000);
    assert.equal(store.getMeta('lastTime'),1000);
  } finally { store.close(); }
});
test('acknowledgement advances the per-target cursor and prunes subsumed rows while pending stays exact', () => {
  const store = new LibraryStore(':memory:');
  try {
    const ids=[];
    for(let i=0;i<5;i++)ids.push(store.write({kind:'search',key:`q${i}`,op:'set',value:{query:`q${i}`}}).id);
    store.acknowledge('gap',[ids[1],ids[3]]);
    assert.deepEqual(store.pending('gap').map(event=>ids.indexOf(event.id)),[0,2,4]);
    store.acknowledge('gap',[ids[0],ids[2],ids[4]]);
    assert.equal(store.pending('gap').length,0);
    assert.equal(store.getMeta('ackCursor:gap'),5);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM library_ack WHERE target=?').get('gap').count,0);
    const later=store.write({kind:'search',key:'q5',op:'set',value:{query:'q5'}});
    assert.deepEqual(store.pending('gap').map(event=>event.id),[later.id]);
  } finally { store.close(); }
});
test('acknowledgement rows written without a cursor keep pending exact until the cursor migrates', () => {
  const store = new LibraryStore(':memory:');
  try {
    const ids=[];
    for(let i=0;i<5;i++)ids.push(store.write({kind:'search',key:`q${i}`,op:'set',value:{query:`q${i}`}}).id);
    store.db.prepare('INSERT INTO library_ack VALUES(?,?)').run('legacy',ids[1]);
    store.db.prepare('INSERT INTO library_ack VALUES(?,?)').run('legacy',ids[3]);
    assert.deepEqual(store.pending('legacy').map(event=>ids.indexOf(event.id)),[0,2,4]);
    store.acknowledge('legacy',[ids[0]]);
    assert.deepEqual(store.pending('legacy').map(event=>ids.indexOf(event.id)),[2,4]);
  } finally { store.close(); }
});
test('snapshot caching reflects writes and never shares mutable state with callers', () => {
  const store = new LibraryStore(':memory:');
  try {
    store.write({kind:'search',key:'q1',op:'set',value:{query:'q1'}});
    const first=store.snapshot();
    first.searchHistory.push('mutated');
    assert.deepEqual(store.snapshot().searchHistory,['q1']);
    store.write({kind:'search',key:'q2',op:'set',value:{query:'q2'}});
    assert.deepEqual(store.snapshot().searchHistory,['q2','q1']);
  } finally { store.close(); }
});
