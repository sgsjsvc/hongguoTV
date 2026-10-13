import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryOutbox } from '../apps/web-pc/src/history-outbox.mjs';
import { HistoryStore } from '../server/history-store.mjs';
const storage = () => { const map=new Map(); return {get length(){return map.size},key:i=>[...map.keys()][i]||null,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; };
test('durable queued progress survives restart and retains newest sequence during acknowledgement', async () => {
 const disk=storage(); let release; const sent=[];
 const request=async (path,value)=>{sent.push([path,value]); if(path.endsWith('progress')) await new Promise(r=>release=r); return {};};
 const box=new HistoryOutbox(disk,'server-a','web',request,()=> 'session');
 box.begin({id:'s',title:'Drama'}); box.save('s',{episodeId:'e',episodeNumber:1,positionMs:1000});
 const flush=box.flush(); await new Promise(r=>setImmediate(r));
 box.save('s',{episodeId:'e',episodeNumber:1,positionMs:2000}); release(); await flush;
 assert.equal(box.pending()[0].progress.sequence,2);
 const restarted=new HistoryOutbox(disk,'server-a','web',async()=>({})); assert.equal(restarted.pending()[0].progress.positionMs,2000);
 await restarted.flush(); assert.equal(restarted.pending().length,0);
 assert.equal(new HistoryOutbox(disk,'server-b','web',request).pending().length,0);
});
test('deleted session is discarded and never recreated by ticks', async()=>{
 const box=new HistoryOutbox(storage(),'a','pc',async()=>{throw Object.assign(new Error('gone'),{status:410});},()=> 's');
 box.begin({id:'x',title:'X'}); box.save('x',{episodeId:'e',episodeNumber:1,positionMs:0}); await box.flush();
 box.save('x',{episodeId:'e',episodeNumber:1,positionMs:1000}); assert.equal(box.pending().length,0);
});
test('network failure keeps a durable operation and later retry registers the same session',async()=>{
 const disk=storage(); let offline=true; const registered=[];
 const box=new HistoryOutbox(disk,'a','web',async(path,data)=>{if(offline)throw Error('offline');if(path.endsWith('sessions'))registered.push(data.sessionId);return {};},()=> 'stable');
 box.begin({id:'s',title:'S'});box.save('s',{episodeId:'e',episodeNumber:1,positionMs:100});
 await assert.rejects(box.flush());assert.equal(box.pending().length,1);
 offline=false;await box.flush();assert.deepEqual(registered,['stable']);assert.equal(box.pending().length,0);
});
test('deleted-session response drops a newer tick that arrived while request was in flight',async()=>{
 let reject;
 const box=new HistoryOutbox(storage(),'a','tv',async()=>new Promise((_,r)=>reject=r),()=> 's');
 box.begin({id:'x',title:'X'});box.save('x',{episodeId:'e',episodeNumber:1,positionMs:0});
 const flush=box.flush();box.save('x',{episodeId:'e',episodeNumber:1,positionMs:1000});
 reject(Object.assign(Error('deleted'),{status:410}));await flush;assert.equal(box.pending().length,0);
});
test('orphan replay acknowledgement cannot erase a live writer newer tick',async()=>{
 const disk=storage(); const owner=new HistoryOutbox(disk,'a','web',async()=>({}),()=> 'owner');
 owner.begin({id:'x',title:'X'});owner.save('x',{episodeId:'e',episodeNumber:1,positionMs:1000});
 let release; const replay=new HistoryOutbox(disk,'a','web',async(path)=>{if(path.endsWith('progress'))await new Promise(r=>release=r);return {};});
 const flush=replay.flush();await new Promise(r=>setImmediate(r));
 owner.save('x',{episodeId:'e',episodeNumber:1,positionMs:2000});release();await flush;
 assert.equal(owner.pending()[0].progress.positionMs,2000);
});
test('independent page journals cannot overwrite each other',()=>{
 const disk=storage(); const a=new HistoryOutbox(disk,'a','web',async()=>({}),()=> 'a','journal:a');
 const b=new HistoryOutbox(disk,'a','web',async()=>({}),()=> 'b','journal:b');
 a.begin({id:'a',title:'A'});b.begin({id:'b',title:'B'});
 a.save('a',{episodeId:'e',episodeNumber:1,positionMs:1000});b.save('b',{episodeId:'e',episodeNumber:1,positionMs:2000});
 assert.equal(a.pending().length,1);assert.equal(b.pending().length,1);
});
test('client protocol records cross-platform progress and intentional backward seeking',async()=>{
 const server=new HistoryStore(':memory:');
 try {
  const request=async(path,value)=>path.endsWith('sessions') ? server.registerSession(value) : server.saveProgress(value);
  const web=new HistoryOutbox(storage(),'a','web',request,()=> 'web-session');
  const tv=new HistoryOutbox(storage(),'a','tv',request,()=> 'tv-session');
  web.begin({id:'s',title:'S'});tv.begin({id:'s',title:'S'});
  web.save('s',{episodeId:'1',episodeNumber:1,positionMs:30000});await web.flush();
  tv.save('s',{episodeId:'2',episodeNumber:2,positionMs:90000});await tv.flush();
  assert.equal(server.list('all').length,1);assert.equal(server.get('s','tv').episodeId,'2');
  assert.equal(server.get('s','web').positionMs,30000);
  web.save('s',{episodeId:'1',episodeNumber:1,positionMs:10000});await web.flush();
  assert.equal(server.get('s','web').positionMs,10000);
 }finally{server.close();}
});
test('acknowledgement removes only its immutable event even when another process writes at that instant',async()=>{
 const disk=storage();const owner=new HistoryOutbox(disk,'a','web',async()=>({}),()=> 'session');
 owner.begin({id:'s',title:'S'});owner.save('s',{episodeId:'e',episodeNumber:1,positionMs:1000});
 const remove=disk.removeItem;let interleaved=false;
 disk.removeItem=key=>{if(!interleaved){interleaved=true;owner.save('s',{episodeId:'e',episodeNumber:1,positionMs:2000});}remove(key);};
 const replay=new HistoryOutbox(disk,'a','web',async()=>({}));await replay.flush();
 assert.equal(owner.pending()[0].progress.positionMs,2000);
});
test('full browser storage reports failure without marking an unsaved tick as saved',()=>{
 const disk=storage();const box=new HistoryOutbox(disk,'a','web',async()=>({}),()=> 's');
 box.begin({id:'s',title:'S'});const write=disk.setItem;
 disk.setItem=()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
 assert.throws(()=>box.save('s',{episodeId:'e',episodeNumber:1,positionMs:1000}),{name:'QuotaExceededError'});
 disk.setItem=write;box.save('s',{episodeId:'e',episodeNumber:1,positionMs:1000});assert.equal(box.pending().length,1);
});
