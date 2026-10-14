// Read-only discovery harness: imports/exercises current source, writes only its evidence report.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import http from 'node:http';
import assert from 'node:assert/strict';
import axios from 'axios';
import {byteRange, createServer} from '../../server/http.mjs';

const files = ['shared/content-core/hongguo.js','custom-server/vendor/hongguo.cjs','server/vendor/hongguo.cjs','custom-server/index.mjs','server/provider.mjs','server/http.mjs'];
const hashes = () => Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const before = hashes();
const source = fs.readFileSync(files[0],'utf8');
const backend = fs.readFileSync('custom-server/index.mjs','utf8');
const results=[];
function engine(client=axios) {
  const c=vm.createContext({Buffer,URL,URLSearchParams,axios:client,require:()=>crypto});
  vm.runInContext(source+'\nthis.api={parseRangeHeader,remoteRange,fetchVideoInfo,resolveStream,prepareHeader,decryptPartial,addCounter,streamCache,videoInfoCache,pageCache,qualityRows,qualityNumber,parseTrack,readBox};',c);
  return c.api;
}
async function probe(name,fn) {try{const evidence=await fn();results.push({name,ok:true,evidence});console.log(JSON.stringify({name,...evidence}));}catch(e){results.push({name,ok:false,error:e.message});console.log(JSON.stringify({name,error:e.message}));process.exitCode=1;}}
async function start(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
function backendFixture(hgEngine){
  const context=vm.createContext({http,URL,Buffer,hgEngine,byteRange,serveStatic:()=>false,handleLibrary:async()=>false,handleHistory:async()=>false,vidToSeriesMap:new Map(),console:{warn(){},error(){}}});
  vm.runInContext(backend.slice(backend.indexOf('function json('),backend.indexOf('server.listen('))+'\nthis.serverForProbe=server;',context);
  return context.serverForProbe;
}

await probe('range-parser-mismatch',async()=>{
  const api=engine();const values=['bytes=0-1,5-6','bytes=0-1junk','bytes=0-1\r\nExtra: x','bytes=-0','bytes=100-','bytes=2-1','bytes=0-999','bytes=-200'];
  const rows=values.map(value=>({value,engine:api.parseRangeHeader(value,100),http:byteRange(value,100)}));
  assert.deepEqual(Array.from(rows[0].engine),[0,1]);assert.equal(rows[0].http,null);
  return {rows};
});

await probe('concurrent-backup-clears-primary',async()=>{
  const waiters=[];const targets=[];
  const client=async target=>{targets.push(target);if(target==='main')throw new Error('fixture ENOTFOUND');if(target==='backup')return await new Promise(r=>{waiters.push(r);if(waiters.length===2)waiters.forEach(done=>done({status:206,data:Buffer.from('abcd'),headers:{'content-range':'bytes 0-3/100'}}));});throw new Error('empty URL');};
  const api=engine(client),stream={url:'main',backupUrl:'backup'};
  await Promise.all([api.remoteRange(stream,0,3),api.remoteRange(stream,0,3)]);
  assert.equal(stream.url,'');
  let nextError;try{await api.remoteRange(stream,0,3);}catch(e){nextError=e.message;}
  assert.equal(nextError,'empty URL');return {targets,finalUrl:stream.url,finalBackup:stream.backupUrl,nextError};
});

await probe('range-offset-not-validated',async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(206,{'Content-Range':'bytes 0-3/100','Content-Type':'video/mp4'});res.end('ABCD');});
  const root=await start(server);
  try{const out=await engine().remoteRange({url:root},10,13);assert.equal(out.data.toString(),'ABCD');return {requested:'bytes=10-13',returned:'bytes 0-3/100',accepted:true,data:out.data.toString()};}finally{await close(server);}
});

await probe('qualities-fabricate-1080-on-error',async()=>{
  const server=backendFixture({fetchVideoInfo:async()=>{throw new Error('fixture unavailable');}}),root=await start(server);
  try{const r=await fetch(root+'/api/episodes/123/qualities');const body=await r.json();assert.equal(r.status,200);assert.equal(body.qualities[0].key,'1080P');return {status:r.status,body};}finally{await close(server);}
});

async function interruptedResponse(server){
  const root=await start(server);
  try{return await new Promise((resolve,reject)=>{
    let settled=false;let status,bytes=0;const done=value=>{if(!settled){settled=true;clearTimeout(timer);resolve(value);}};
    const req=http.get(root+'/api/episodes/123/stream',{headers:{Range:'bytes=0-2097151'}},res=>{status=res.statusCode;res.on('data',b=>bytes+=b.length);res.on('end',()=>done({status,bytes,ended:true}));res.on('aborted',()=>done({status,bytes,aborted:true}));res.on('error',()=>{});});
    req.on('error',e=>{if(!settled)reject(e);});
    const timer=setTimeout(()=>{done({status,bytes,hung:true});req.destroy();},800);
  });}finally{await close(server);}
}
await probe('backend-midstream-failure-hangs',async()=>{
  const engineStub={resolveStream:async()=>({}),prepareHeader:async()=>({total:2097152}),remoteRange:async(_s,start,end)=>{if(start)throw new Error('fixture second chunk failed');return {data:Buffer.alloc(end-start+1)};},decryptPartial:b=>b};
  const broken=await interruptedResponse(backendFixture(engineStub));assert.equal(broken.hung,true);assert.equal(broken.bytes,1048576);
  const good=await interruptedResponse(createServer({stream:async()=>({total:2097152,chunk:async(start,end)=>{if(start)throw new Error('fixture second chunk failed');return Buffer.alloc(end-start+1);}})}));assert.equal(good.aborted,true);
  return {customBackend:broken,legacyHttpControl:good};
});

await probe('cache-capacity-and-request-coalescing',async()=>{
  let posts=0,gets=0;
  const client=async()=>{gets++;return {status:200,data:JSON.stringify({video_info:{data:{video_list:{hd:{main_url:'https://example.test/media',vheight:1920,codec_type:'bytevc1'}}}}})};};
  client.post=async()=>{posts++;await new Promise(r=>setTimeout(r,2));return {status:200,data:JSON.stringify({code:0,data:{video_model:JSON.stringify({video_list:[],fallback_api:'https://example.test/info'})}})};};
  const api=engine(client);await Promise.all(Array.from({length:12},()=>api.fetchVideoInfo('same')));const parallel={posts,gets,cacheEntries:api.videoInfoCache.size};assert.equal(posts,12);
  for(let i=0;i<150;i++)await api.resolveStream(String(i),'1080P');
  assert.equal(api.videoInfoCache.size,151);assert.equal(api.streamCache.size,150);
  return {parallel,after150Distinct:{videoCache:api.videoInfoCache.size,streamCache:api.streamCache.size},note:'Custom backend uses a separate VM from provider cleanup; observations alone do not measure production heap.'};
});

await probe('decrypt-slice-correctness-and-scan-cost',async()=>{
  const api=engine();const key=Buffer.from('00112233445566778899aabbccddeeff','hex');const iv=Buffer.alloc(16,255);const plain=Buffer.alloc(4096);for(let i=0;i<plain.length;i++)plain[i]=i%251;
  const cipher=crypto.createCipheriv('aes-128-ctr',key,iv),encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  const prepared={header:Buffer.alloc(0),samples:[{start:0,end:plain.length,iv}]};
  for(const [start,end] of [[0,4096],[1,17],[15,33],[16,100],[255,1025],[4095,4096]])assert.deepEqual(api.decryptPartial(encrypted.subarray(start,end),start,key,prepared),plain.subarray(start,end));
  let reads=0;const samples=Array.from({length:10000},(_,i)=>({start:i*16,get end(){reads++;return (i+1)*16;},iv}));
  api.decryptPartial(Buffer.alloc(16),9999*16,key,{header:Buffer.alloc(0),samples});assert.ok(reads>=10000);
  const a=api.qualityRows({hd:{vheight:1920,main_url:'x'},sd:{vheight:960,main_url:'x'}}).map(r=>api.qualityNumber(r.quality));assert.deepEqual(Array.from(a),[1080,540]);
  return {sliceAssertions:6,counterCarryVerified:true,samples:10000,tailRangeEndReads:reads,qualityOrder:Array.from(a)};
});

await probe('prepareHeader-coalesces-and-retries',async()=>{
  const bytes=Buffer.alloc(262144);bytes.writeUInt32BE(24,0);bytes.write('ftyp',4);bytes.writeUInt32BE(8,24);bytes.write('moov',28);
  let calls=0,fail=false;
  const client=async()=>{calls++;await new Promise(r=>setTimeout(r,1));if(fail)throw new Error('fixture network failed');return {status:206,data:bytes,headers:{'content-range':'bytes 0-262143/1000000'}};};
  const api=engine(client),stream={url:'fixture'};
  const values=await Promise.all(Array.from({length:12},()=>api.prepareHeader(stream)));assert.equal(calls,1);assert.ok(values.every(x=>x===values[0]));
  const concurrentCalls=calls;fail=true;const retryStream={url:'fixture'};await assert.rejects(api.prepareHeader(retryStream),/fixture network failed/);assert.equal(retryStream.preparePromise,undefined);
  fail=false;const recovered=await api.prepareHeader(retryStream);assert.equal(recovered.header.length,32);
  return {parallelRequests:12,concurrentCalls,failedPromiseCleared:true,retryRecovered:true};
});

await probe('vendor-comparison',async()=>{
  const original=source.replace(/\r/g,'').split('\n');
  const peers=files.slice(1,3).map(file=>{const peer=fs.readFileSync(file,'utf8').replace(/\r/g,'').split('\n');const changedLines=original.flatMap((line,i)=>line===peer[i]?[]:[i+1]);return {file,changedLines};});
  assert.ok(peers.every(p=>p.changedLines.length===1&&p.changedLines[0]===138));
  return {peers,note:'Only category_$ compatibility differs; playback code is currently identical.'};
});

await probe('cenc-parser-crosses-track-boundary',async()=>{
  const box=(name,body)=>{const out=Buffer.alloc(8+body.length);out.writeUInt32BE(out.length);out.write(name,4);body.copy(out,8);return out;};
  const stsz=Buffer.alloc(12);stsz.writeUInt32BE(16,4);stsz.writeUInt32BE(1,8);
  const stsc=Buffer.alloc(20);stsc.writeUInt32BE(1,4);stsc.writeUInt32BE(1,8);stsc.writeUInt32BE(1,12);stsc.writeUInt32BE(1,16);
  const stco=Buffer.alloc(12);stco.writeUInt32BE(1,4);stco.writeUInt32BE(1000,8);
  const saiz=Buffer.alloc(9);saiz[4]=8;saiz.writeUInt32BE(1,5);
  const saio=Buffer.alloc(12);saio.writeUInt32BE(1,4);
  const tables=[box('stsz',stsz),box('stsc',stsc),box('stco',stco)];
  const clear=box('trak',box('stbl',Buffer.concat(tables)));
  const encrypted=box('trak',box('stbl',Buffer.concat([...tables,box('saiz',saiz),box('saio',saio)])));
  const body=Buffer.concat([clear,encrypted]),api=engine();
  const parsed=api.parseTrack(body,api.readBox(body,0));assert.ok(parsed);assert.equal(parsed.auxSizes.length,1);
  const alone=api.parseTrack(clear,api.readBox(clear,0));assert.equal(alone,null);
  return {clearTrackBytes:clear.length,clearTrackHasSaiz:false,aloneReturnedNull:alone===null,withFollowingEncryptedTrackParsedAsEncrypted:!!parsed,borrowedAuxSizes:Array.from(parsed.auxSizes)};
});

const after=hashes();assert.deepEqual(after,before);
const report={at:new Date().toISOString(),sourceHashes:before,businessSourceUnchanged:true,results};
fs.writeFileSync('.agents/shared/t-d1-playback-discovery-evidence.json',JSON.stringify(report,null,2)+'\n');
