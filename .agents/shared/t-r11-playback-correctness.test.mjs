import {test} from 'node:test';import assert from 'node:assert/strict';
import {engineFiles,engine,backend} from './playback-test-helpers.mjs';
for(const file of engineFiles){
 test(`${file}: reject incorrect and malformed 206 ranges`,async()=>{
  for(const value of ['bytes 0-3/100','bytes 10-13/*','bytes 10-13/12','bytes 10-13/9007199254740992',undefined]){
   const {api}=engine(file,async()=>({status:206,data:Buffer.from('ABCD'),headers:{'content-range':value}}));
   await assert.rejects(api.remoteRange({url:'main'},10,13),/Range|范围/);
  }
 });
 test(`${file}: preserve valid ranges and reject changed total`,async()=>{
  const {api}=engine(file,async()=>({status:206,data:Buffer.from('ABCD'),headers:{'content-range':'Bytes 10-13/100'}}));
  assert.equal((await api.remoteRange({url:'main'},10,13)).data.toString(),'ABCD');
  await assert.rejects(api.remoteRange({url:'main',prepared:{total:200}},10,13),/Range|范围/);
 });
 test(`${file}: valid 200 full body slicing remains supported`,async()=>{
  const {api}=engine(file,async()=>({status:200,data:Buffer.from('0123456789'),headers:{'content-length':'10'}}));
  const out=await api.remoteRange({url:'main'},3,6);assert.equal(out.data.toString(),'3456');assert.equal(out.total,10);
 });
 test(`${file}: invalid primary range retries a valid backup`,async()=>{
  const {api}=engine(file,async target=>({status:206,data:Buffer.from('ABCD'),headers:{'content-range':target==='main'?'bytes 0-3/100':'bytes 10-13/100'}}));const stream={url:'main',backupUrl:'backup'};
  await api.remoteRange(stream,10,13);assert.equal(stream.url,'backup');
 });
}
for(const mode of ['unavailable','empty','private'])test(`qualities ${mode} returns explicit failure without fabricated quality`,async t=>{
 const root=await backend(t,{fetchVideoInfo:async()=>{if(mode==='unavailable')throw Error('unavailable');return {rows:mode==='private'?[{key:'hd',quality:'1080',item:{codec_type:'bytevc2'}}]:[]};},qualityNumber:()=>1080});
 const r=await fetch(root+'/api/episodes/0/qualities');assert.equal(r.status,502);const data=await r.json();assert.equal(data.qualities.length,0);assert.equal(data.defaultQuality,null);assert.ok(data.error);assert.ok(data.code);
});
test('real supplied HEVC quality retains successful contract',async t=>{const root=await backend(t,{fetchVideoInfo:async()=>({rows:[{key:'hd',quality:'1080',item:{codec_type:'bytevc1'}}]}),qualityNumber:()=>1080});const r=await fetch(root+'/api/episodes/123/qualities');assert.equal(r.status,200);assert.equal((await r.json()).qualities[0].key,'1080P');});
