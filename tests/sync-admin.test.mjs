import test from 'node:test';
import assert from 'node:assert/strict';
import { LibraryStore } from '../shared/library-store.mjs';
import { createSyncServer } from '../apps/sync-server/server.mjs';
const key='admin-test-family-key-20261013';
async function fixture(){const store=new LibraryStore(':memory:');const server=createSyncServer(store,key);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return{store,url:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});store.close()}};}
const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
test('admin login assets are public but all family queries and writes require authentication',async()=>{
 const f=await fixture();try{
  const page=await fetch(f.url+'/');assert.equal(page.status,200);assert.match(await page.text(),/远程共享管理/);assert.match(page.headers.get('Content-Security-Policy'),/default-src/);
  assert.equal((await fetch(f.url+'/api/admin/library')).status,401);
  assert.equal((await fetch(f.url+'/api/admin/operations',{method:'POST',body:'{}'})).status,401);
  const data=await(await fetch(f.url+'/api/admin/library',{headers})).json();assert.equal(data.overview.events,0);assert.equal(JSON.stringify(data).includes(key),false);
 }finally{await f.close()}
});
test('admin deletes create idempotent sync tombstones and old offline favorites cannot return',async()=>{
 const f=await fixture();try{
  const old={id:'old-tv-favorite',deviceId:'tv',seq:1,at:100,kind:'favorite',key:'9007199254740993',op:'set',value:{id:'9007199254740993',title:'收藏'}};f.store.receive([old]);
  const operation={id:'admin-delete-request',kind:'favorite',key:old.key,op:'delete'};
  const send=()=>fetch(f.url+'/api/admin/operations',{method:'POST',headers,body:JSON.stringify(operation)});
  assert.equal((await send()).status,200);assert.equal((await send()).status,200);assert.equal(f.store.changes(0).events.length,2);
  f.store.receive([old]);assert.equal(f.store.snapshot().favorites.length,0);assert.equal(f.store.changes(1).events[0].op,'delete');
  const data=await(await fetch(f.url+'/api/admin/library',{headers})).json();assert.equal(data.devices.find(d=>d.id==='tv').events,1);
 }finally{await f.close()}
});
test('admin clear and preferences travel through the existing event protocol; forged history updates are refused',async()=>{
 const f=await fixture();try{
  f.store.write({kind:'history',key:'h',op:'set',value:{seriesId:'h',title:'历史',episodeId:'e',episodeNumber:1,positionMs:2000}});
  const send=input=>fetch(f.url+'/api/admin/operations',{method:'POST',headers,body:JSON.stringify(input)});
  assert.equal((await send({id:'clear-history-request',kind:'history',key:'*',op:'clear'})).status,200);assert.equal(f.store.snapshot().history.length,0);
  assert.equal((await send({id:'change-speed-request',kind:'preference',key:'speed',op:'set',value:{value:1.5}})).status,200);assert.equal(f.store.snapshot().preferences.speed,1.5);
  assert.equal((await send({id:'forged-history-request',kind:'history',key:'h',op:'set',value:{seriesId:'h',title:'伪造',episodeId:'e',episodeNumber:1,positionMs:0}})).status,400);
  assert.equal(f.store.changes(1).events[0].op,'clear');
 }finally{await f.close()}
});
test('management deletion takes effect even when an accepted device event has a future clock',async()=>{
 const f=await fixture();try{
  f.store.receive([{id:'future-favorite',deviceId:'skewed-device',seq:1,at:Date.now()+200000,kind:'favorite',key:'future',op:'set',value:{id:'future',title:'未来时钟'}}],{clampFuture:true});
  const response=await fetch(f.url+'/api/admin/operations',{method:'POST',headers,body:JSON.stringify({id:'delete-future-request',kind:'favorite',key:'future',op:'delete'})});
  assert.equal(response.status,200);assert.equal(f.store.snapshot().favorites.length,0);
 }finally{await f.close()}
});
