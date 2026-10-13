import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { LibraryStore } from '../shared/library-store.mjs';
import { createSyncServer } from '../apps/sync-server/server.mjs';
const oldKey='original-family-shared-key',newKey='replacement-family-shared-key';
async function fixture(options={}){const store=new LibraryStore(':memory:');const server=createSyncServer(store,oldKey,options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return{store,server,url:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});store.close()}}}
const auth=key=>({Authorization:`Bearer ${key}`,'Content-Type':'application/json'});
const rotate=(f,input={})=>fetch(f.url+'/api/admin/key',{method:'POST',headers:auth(oldKey),body:JSON.stringify({currentKey:oldKey,newKey,confirmation:newKey,...input})});
test('key replacement immediately revokes old clients, persists and keeps family data',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'hongguotv-key-'));const keyFile=path.join(dir,'shared-key.txt');writeFileSync(keyFile,oldKey);const f=await fixture({keyFile});try{
  f.store.write({kind:'search',key:'query',op:'set',value:{query:'query'}});
  const response=await rotate(f);assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes(newKey),false);
  assert.equal(readFileSync(keyFile,'utf8').trim(),newKey);assert.equal((await fetch(f.url+'/api/sync/handshake',{headers:auth(oldKey)})).status,401);assert.equal((await fetch(f.url+'/api/admin/library',{headers:auth(newKey)})).status,200);assert.deepEqual(f.store.snapshot().searchHistory,['query']);
  const restarted=createSyncServer(f.store,readFileSync(keyFile,'utf8').trim(),{keyFile});await new Promise(resolve=>restarted.listen(0,'127.0.0.1',resolve));try{assert.equal((await fetch(`http://127.0.0.1:${restarted.address().port}/api/sync/handshake`,{headers:auth(newKey)})).status,200)}finally{await new Promise(resolve=>{restarted.close(resolve);restarted.closeAllConnections()})}
 }finally{await f.close()}
});
test('key changes reject unauthenticated requests, mismatches and invalid values without changing authentication',async()=>{
 const f=await fixture();try{
  assert.equal((await fetch(f.url+'/api/admin/key')).status,401);
  for(const input of [{currentKey:'wrong'},{confirmation:'different'},{newKey:'short',confirmation:'short'},{newKey:'x'.repeat(129),confirmation:'x'.repeat(129)},{newKey:'空'.repeat(16),confirmation:'空'.repeat(16)}])assert.equal((await rotate(f,input)).status,400);
  assert.equal((await fetch(f.url+'/api/sync/handshake',{headers:auth(oldKey)})).status,200);
 }finally{await f.close()}
});
test('persistence failure and environment-managed keys preserve the existing key',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'hongguotv-key-failure-'));const keyFile=path.join(dir,'directory');mkdirSync(keyFile);
 for(const options of [{keyFile},{keyManaged:true}]){const f=await fixture(options);try{
  const response=await rotate(f);assert.equal(response.status,options.keyManaged?409:500);
  assert.equal((await fetch(f.url+'/api/sync/handshake',{headers:auth(oldKey)})).status,200);
  const metadata=await(await fetch(f.url+'/api/admin/key',{headers:auth(oldKey)})).json();assert.equal(metadata.canRotate,!options.keyManaged);assert.equal(JSON.stringify(metadata).includes(oldKey),false);
 }finally{await f.close()}}
});
test('a request started with the old key cannot modify data after rotation while its body is pending',async()=>{
 const f=await fixture();try{
  f.store.write({kind:'search',key:'saved',op:'set',value:{query:'saved'}});
  const body=JSON.stringify({id:'pending-clear-request',kind:'search',key:'*',op:'clear'});
  const arrived=new Promise(resolve=>f.server.once('request',resolve));let pending;
  const finished=new Promise((resolve,reject)=>{pending=httpRequest(f.url+'/api/admin/operations',{method:'POST',headers:{...auth(oldKey),'Content-Length':Buffer.byteLength(body)}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode))});pending.on('error',reject)});
  pending.flushHeaders();await arrived;assert.equal((await rotate(f)).status,200);pending.end(body);
  assert.equal(await finished,401);assert.deepEqual(f.store.snapshot().searchHistory,['saved']);
 }finally{await f.close()}
});
