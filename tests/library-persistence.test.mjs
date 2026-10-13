import test from 'node:test';import assert from 'node:assert/strict';import { mkdtempSync } from 'node:fs';import { tmpdir } from 'node:os';import path from 'node:path';
import { LibraryStore } from '../shared/library-store.mjs';
import { LibrarySync } from '../server/library-sync.mjs';
test('local snapshot and unacknowledged operation survive database reopening',()=>{
 const file=path.join(mkdtempSync(path.join(tmpdir(),'hongguotv-library-')),'library.sqlite');let store=new LibraryStore(file);const event=store.write({kind:'search',key:'续播',op:'set',value:{query:'续播'}});store.close();store=new LibraryStore(file);try{assert.deepEqual(store.snapshot().searchHistory,['续播']);assert.equal(store.pending('remote')[0].id,event.id);store.acknowledge('remote',[event.id]);}finally{store.close();}store=new LibraryStore(file);try{assert.equal(store.pending('remote').length,0);assert.deepEqual(store.snapshot().searchHistory,['续播']);}finally{store.close();}
});
test('delayed configuration verification cannot reenable synchronization after disabling',async()=>{
 const store=new LibraryStore(':memory:');const sync=new LibrarySync(store);let release;sync.request=()=>new Promise(resolve=>release=resolve);
 try{const enabling=sync.configure({url:'http://localhost:8791',key:'shared-key-long-enough'});await sync.configure({enabled:false});release({protocolVersion:1,instanceId:'remote',serverTime:Date.now()});await assert.rejects(enabling);assert.equal(sync.view().enabled,false);assert.equal(sync.view().state,'unconfigured');}finally{sync.stop();store.close();}
});
test('failed multi-event transaction does not expose a partially applied snapshot',()=>{
 const store=new LibraryStore(':memory:');try{
  const event={id:'a',deviceId:'d',seq:1,kind:'search',key:'q',op:'set',at:1,value:{query:'q'}};
  assert.throws(()=>store.receive([event,{...event,id:'different-id'}]));assert.deepEqual(store.snapshot().searchHistory,[]);assert.equal(store.changes(0).events.length,0);
 }finally{store.close();}
});
