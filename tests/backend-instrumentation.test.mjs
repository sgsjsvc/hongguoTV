import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import http from 'node:http';
import {createPrefetchQueue,sharedResource} from '../server/provider.mjs';
import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import {readJson} from '../shared/http-json.mjs';

function request(base,route,{method='GET',body}={}){
 return new Promise((resolve,reject)=>{
  const req=http.request(base+route,{method,headers:body?{'Content-Type':'application/json'}:{}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);
   res.on('end',()=>{try{resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(text)});}catch(e){reject(e);}});
   res.on('error',reject);
  });req.on('error',reject);req.end(body&&JSON.stringify(body));
 });
}
async function backend(t,{timing='1',enabled=false,source}={}){
 let homeCalls=0,recommendCalls=0,release;
 const gate=new Promise(r=>release=r), logs=[];
 const context=vm.createContext({http,URL,Buffer,readJson,createPrefetchQueue,sharedResource,createPrefetchMetrics,
  traceRequest:(req,res)=>traceRequest(req,res,{log:line=>logs.push(line)}),
  process:{env:{HG_TIMING:timing,HG_PREFETCH_ENABLED:enabled?'1':'0'}},
  fetchOfficialHome:async()=>{homeCalls++;return{banners:[{id:'1'}],sections:[{type:'hot',items:[{id:'1'}]}]};},
  OFFICIAL_RANK_TYPES:[{slug:'hot-drama',name:'热播榜'}],
  recommendations:{page:async(session,page)=>{recommendCalls++;return{session,page,items:[{id:'101',title:'剧1'},{id:'102',title:'剧2'}]};}},
  RecommendationError:class extends Error{},hgEngine:{fetchVideoInfo:async()=>({rows:[]})},
  coreProvider:{detail:async(_id,{signal}={})=>{
   await new Promise((resolve,reject)=>{if(signal?.aborted)return reject(signal.reason);const abort=()=>reject(signal.reason);signal?.addEventListener('abort',abort,{once:true});gate.then(()=>{signal?.removeEventListener('abort',abort);resolve();});});
   return{episodes:[{id:'201'}]};
  }},handleLibrary:async()=>false,handleHistory:async()=>false,console:{error(){},warn(){}},
 });
 source??=fs.readFileSync('custom-server/index.mjs','utf8');
 vm.runInContext(source.slice(source.indexOf('function json('),source.indexOf('listenWithFallback(server, PORT'))+
  '\nthis.server=server;this.queue=prefetchQueue;this.metrics=typeof prefetchMetrics === "undefined" ? null : prefetchMetrics;',context);
 await new Promise(r=>context.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{release();context.queue.close();context.server.closeAllConnections();await new Promise(r=>context.server.close(r));});
 return{...context,logs,release,base:`http://127.0.0.1:${context.server.address().port}`,homeCalls:()=>homeCalls,recommendCalls:()=>recommendCalls};
}

for(const timing of ['1','0'])test(`real entry routes preserve reqStart and B6 cache with HG_TIMING=${timing}`,async t=>{
 const app=await backend(t,{timing});
 for(const [route,key] of [['/api/banners','banners'],['/api/sections','sections'],['/api/rank/types','types'],['/api/recommend?session=instrument-session-0001&page=1','items']]){
  const response=await request(app.base,route);
  assert.equal(response.status,200,route+': '+JSON.stringify(response.body));assert.ok(!response.body.error);
  assert.ok(Array.isArray(response.body[key])&&response.body[key].length>0,route+' nonempty '+key);
  assert.match(response.headers['x-response-time']||'',/^\d+ms$/,route+' B6 elapsed retained');
  if(timing==='1')assert.match(response.headers['server-timing']||'',/app;dur=\d+(\.\d+)?/);
  else assert.equal(response.headers['server-timing'],undefined);
  if(key!=='types'){
   const repeat=await request(app.base,route);assert.equal(repeat.status,200);assert.equal(repeat.headers['x-cache'],'HIT');
   assert.deepEqual(repeat.body,response.body);
  }
 }
 assert.equal(app.homeCalls(),2);assert.equal(app.recommendCalls(),1,'same-page retry must retain hot:recommend cache');
 assert.equal(app.metrics?.snapshot().started,0,'disabled speculative work stays disabled');
 assert.equal(timing==='1'?app.logs.length>0:app.logs.length===0,true);
});

test('actual entry explicit concurrency=2 instruments B6 recommendation prefetch without changing response',async t=>{
 const app=await backend(t,{enabled:true});
 const result=await request(app.base,'/api/recommend?session=instrument-session-0002&page=1');
 assert.equal(result.status,200);assert.deepEqual(result.body.items.map(row=>row.id),['101','102']);
 for(let i=0;i<30&&app.metrics?.snapshot().started!==2;i++)await new Promise(r=>setImmediate(r));
 assert.ok(app.metrics,'real entry must connect the metrics object');
 assert.equal(app.metrics.snapshot().active,2);assert.equal(app.metrics.snapshot().maxActive,2);
 app.release();
 for(let i=0;i<30&&app.metrics.snapshot().active;i++)await new Promise(r=>setImmediate(r));
 assert.equal(app.metrics.snapshot().succeeded,2);assert.equal(app.metrics.snapshot().active,0);
});

test('route regression detects the discarded patch missing reqStart definition',async t=>{
 const original=fs.readFileSync('custom-server/index.mjs','utf8');
 const mutant=original.replace('const reqStart = Date.now();','');assert.notEqual(mutant,original);
 const app=await backend(t,{source:mutant});
 for(const route of ['/api/banners','/api/sections','/api/rank/types','/api/recommend?session=instrument-session-0003&page=1']){
  const response=await request(app.base,route);assert.equal(response.status,500);assert.match(response.body.error,/reqStart/);
 }
});
