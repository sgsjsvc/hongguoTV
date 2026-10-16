import {test} from 'node:test';
import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import {createPrefetchQueue,sharedResource,upstreamRequestSignal} from '../server/provider.mjs';
import {readJson} from '../shared/http-json.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import http from 'node:http';
import {byteRange} from '../server/http.mjs';

const engines=['shared/content-core/hongguo.js','custom-server/vendor/hongguo.cjs','server/vendor/hongguo.cjs'];
function load(file,axios){const c=vm.createContext({Buffer,URL,URLSearchParams,axios,require:()=>crypto});vm.runInContext(fs.readFileSync(file,'utf8')+'\nthis.api={remoteRange};',c);return c.api;}
const media=()=>({status:206,data:Buffer.from('abcd'),headers:{'content-range':'bytes 0-3/100'}});
for(const file of engines){
  test(`${file}: simultaneous backup successes preserve the sticky primary`,async()=>{
    const waiting=[],targets=[];
    const api=load(file,async target=>{targets.push(target);if(target==='main')throw Error('primary failed');if(target==='backup')return await new Promise(r=>{waiting.push(r);if(waiting.length===2)waiting.forEach(done=>done(media()));});throw Error('empty URL');});
    const stream={url:'main',backupUrl:'backup'};
    const out=await Promise.all([api.remoteRange(stream,0,3),api.remoteRange(stream,0,3)]);
    assert.equal(out.length,2);assert.equal(stream.url,'backup');assert.equal(stream.backupUrl,'');
    // Third request uses the sticky backup without another primary attempt or barrier.
    waiting.length=1;
    await api.remoteRange(stream,0,3);assert.equal(targets.at(-1),'backup');assert.equal(targets.filter(t=>t==='main').length,2);
  });
  test(`${file}: primary failure arriving after another request switched still retries backup`,async()=>{
    let primaryCalls=0,lateReject;
    const api=load(file,async target=>{if(target==='main'){primaryCalls++;if(primaryCalls===1)throw Error('first primary failed');return await new Promise((_r,reject)=>lateReject=reject);}if(target==='backup')return media();throw Error('empty URL');});
    const stream={url:'main',backupUrl:'backup'},first=api.remoteRange(stream,0,3),late=api.remoteRange(stream,0,3);
    await first;assert.equal(stream.url,'backup');lateReject(Error('late primary failure'));
    await late;assert.equal(stream.url,'backup');await api.remoteRange(stream,0,3);
  });
}

function fixture(engine){
  const source=fs.readFileSync('custom-server/index.mjs','utf8');
  const c=vm.createContext({http,URL,Buffer,AbortController,process,createPrefetchQueue,sharedResource,createPrefetchMetrics,traceRequest,readJson,hgEngine:engine,byteRange,serveStatic:()=>false,handleLibrary:async()=>false,handleHistory:async()=>false,vidToSeriesMap:new Map(),console:{warn(){},error(){}}});
  vm.runInContext(source.slice(source.indexOf('function json('),source.indexOf('listenWithFallback(server, PORT'))+'\nthis.serverForTest=server;',c);return c.serverForTest;
}
async function serve(t,engine){const server=fixture(engine);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});return `http://127.0.0.1:${server.address().port}`;}
function stub(total,chunk){return {resolveStream:async()=>({}),prepareHeader:async()=>({total}),remoteRange:chunk,decryptPartial:b=>b};}

test('cancelling qualities prefetch cannot interrupt a foreground stream sharing video metadata',async t=>{
  let enter,release,signal,pending;
  const entered=new Promise(r=>enter=r);
  const fetchVideoInfo=()=>pending??=(new Promise((resolve,reject)=>{
    signal=upstreamRequestSignal();release=()=>resolve({rows:[]});enter();
    signal?.addEventListener('abort',()=>reject(Error('metadata aborted')),{once:true});
  }));
  const engine={...stub(16,async(_s,start,end)=>({data:Buffer.alloc(end-start+1)})),fetchVideoInfo,resolveStream:async()=>{await fetchVideoInfo();return {};}};
  const root=await serve(t,engine);
  const job=await(await fetch(root+'/api/prefetch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targets:[{kind:'qualities',id:'123'}]})})).json();
  await entered;
  const stream=fetch(root+'/api/episodes/123/stream');
  await new Promise(r=>setTimeout(r,20));
  await fetch(root+'/api/prefetch/'+job.id,{method:'DELETE'});
  assert.equal(signal.aborted,false,'foreground stream must retain metadata subscription');
  release();const response=await stream;assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,16);
});
function get(root,headers={}){
  return new Promise((resolve,reject)=>{
    let settled=false,bytes=0,status,type;
    const finish=result=>{if(!settled){settled=true;clearTimeout(timer);resolve({status,type,bytes,...result});}};
    const req=http.get(root+'/api/episodes/123/stream',{headers},res=>{status=res.statusCode;type=res.headers['content-type'];res.on('data',b=>bytes+=b.length);res.on('end',()=>finish({ended:true}));res.on('aborted',()=>finish({aborted:true}));res.on('error',()=>{});});
    req.on('error',e=>{if(!settled){clearTimeout(timer);reject(e);}});
    const timer=setTimeout(()=>{finish({hung:true});req.destroy();},1500);
  });
}
test('custom backend aborts a response after its second media chunk fails',async t=>{
  const root=await serve(t,stub(2097152,async(_stream,start,end)=>{if(start)throw Error('second media chunk failed');return {data:Buffer.alloc(end-start+1)};}));
  const out=await get(root,{Range:'bytes=0-2097151'});assert.equal(out.status,206);assert.equal(out.bytes,1048576);assert.equal(out.aborted,true);assert.equal(out.hung,undefined);
});
test('custom backend first media failure returns JSON 502 rather than MP4 success',async t=>{
  const root=await serve(t,stub(2097152,async()=>{throw Error('first media chunk failed');}));
  const out=await get(root);assert.equal(out.status,502);assert.match(out.type,/application\/json/);assert.equal(out.ended,true);
});
test('custom backend HEAD and successful multi-chunk responses retain their contracts',async t=>{
  let calls=0;const root=await serve(t,stub(1048583,async(_stream,start,end)=>{calls++;return {data:Buffer.alloc(end-start+1)};}));
  const head=await fetch(root+'/api/episodes/123/stream',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'1048583');assert.equal(calls,0);
  const out=await get(root,{Range:'bytes=0-1048582'});assert.equal(out.status,206);assert.equal(out.bytes,1048583);assert.equal(out.ended,true);assert.equal(calls,2);
});
test('client disconnect aborts an active media fetch',async t=>{
  let enter,aborted=false;const entered=new Promise(r=>enter=r);
  const root=await serve(t,stub(2097152,async(_stream,start,end,signal)=>{if(start===0)return {data:Buffer.alloc(end-start+1)};enter();return await new Promise((_r,reject)=>{if(signal?.aborted){aborted=true;reject(Error('aborted'));}else signal?.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));},{once:true});});}));
  const req=http.get(root+'/api/episodes/123/stream',res=>res.resume());req.on('error',()=>{});
  await entered;req.destroy();
  for(let i=0;i<25&&!aborted;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(aborted,true);
});
