import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../shared/library-store.mjs';
import { LibrarySync } from '../custom-server/library-sync.mjs';
import { createSyncServer } from '../apps/sync-server/server.mjs';

const key='test-family-shared-key-12345';
async function setup(){const remote=new LibraryStore(':memory:');const server=createSyncServer(remote,key);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return{remote,server,url:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});remote.close();}};}
const favorite={id:'9007199254740993',title:'收藏',cover:'',description:'',badge:'',tags:''};
test('replacement remote instance rejects upload before writing or acknowledging it',async()=>{
 const fixture=await setup();try{
  const response=await fetch(fixture.url+'/api/sync/push',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({instanceId:'old-instance',events:[{id:'e',deviceId:'d',seq:1,kind:'favorite',key:favorite.id,op:'set',at:100,value:favorite}]})});
  assert.equal(response.status,409);assert.equal(fixture.remote.snapshot().favorites.length,0);assert.equal(fixture.remote.changes(0).events.length,0);
 }finally{await fixture.close();}
});
test('independent local libraries merge all shared data, work offline, and retain data when disconnected',async()=>{
 const fixture=await setup();const first=new LibraryStore(':memory:');const second=new LibraryStore(':memory:');const a=new LibrarySync(first),b=new LibrarySync(second);
 try{
  first.write({kind:'favorite',key:favorite.id,op:'set',value:favorite});
  second.write({kind:'search',key:'搜索',op:'set',value:{query:'搜索'}});
  second.write({kind:'preference',key:'speed',op:'set',value:{value:1.25}});
  await a.configure({url:fixture.url,key});await b.configure({url:fixture.url,key});
  await a.tick();await b.tick();await a.tick();
  assert.equal(second.snapshot().favorites[0].id,favorite.id);
  assert.deepEqual(first.snapshot().searchHistory,['搜索']);assert.equal(first.snapshot().preferences.speed,1.25);
  await assert.rejects(a.configure({url:fixture.url,key:'wrong-key-is-long-enough'}));
  assert.equal(a.view().url,fixture.url);
  await a.configure({enabled:false});assert.equal(a.view().state,'unconfigured');assert.equal(first.snapshot().favorites.length,1);
 }finally{a.stop();b.stop();first.close();second.close();await fixture.close();}
});
test('remote authentication and clock normalization preserve idempotency',async()=>{
 const fixture=await setup();
 try{
  assert.equal((await fetch(fixture.url+'/api/sync/handshake')).status,401);
  const event={id:'future-event',deviceId:'a',seq:1,kind:'favorite',key:favorite.id,op:'set',at:Date.now()+3600000,value:favorite};
  const request=()=>fetch(fixture.url+'/api/sync/push',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({events:[event]})});
  const first=await(await request()).json();assert.ok(first.events[0].at<=Date.now()+300000);
  const duplicate=await(await request()).json();assert.equal(duplicate.events[0].at,first.events[0].at);assert.equal(fixture.remote.changes(0).events.length,1);
 }finally{await fixture.close();}
});
