// Verify the CURRENT entrypoint hooks in a disposable source copy. Never edits
// the live working entrypoint, restarts user services, or writes saved user data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
const root=process.cwd(),out=path.resolve('outputs/testing/b5-b7-final');
fs.mkdirSync(out,{recursive:true});
const folder=fs.mkdtempSync(path.join(out,'hook-validation-'));
for(const name of ['shared','server','custom-server'])fs.cpSync(path.join(root,name),path.join(folder,name),{recursive:true,filter:from=>!['data','node_modules','.cache'].includes(path.basename(from))});
fs.symlinkSync(path.join(root,'node_modules'),path.join(folder,'node_modules'),'junction');
const current=fs.readFileSync('custom-server/index.mjs','utf8');
assert.match(current,/const reqStart = Date\.now\(\);/);
fs.writeFileSync(path.join(folder,'custom-server/index.mjs'),current+"\nprocess.on('message',m=>{if(m?.type==='b7-metrics')process.send({type:'b7-metrics',stats:prefetchMetrics.snapshot()});});\n");
fs.copyFileSync('custom-server/prefetch-metrics.mjs',path.join(folder,'custom-server/prefetch-metrics.mjs'));
fs.copyFileSync('custom-server/request-timing.mjs',path.join(folder,'custom-server/request-timing.mjs'));
const log=fs.createWriteStream(path.join(folder,'server.log'));
const child=fork(path.join(folder,'custom-server/index.mjs'),[],{cwd:folder,env:{...process.env,HG_PORT:'0',HG_HOST:'127.0.0.1',HG_DATA_DIR:path.join(folder,'data'),HG_TIMING:'1',HG_PREFETCH_ENABLED:'1'},stdio:['ignore','pipe','pipe','ipc']});
child.stdout.pipe(log);child.stderr.pipe(log);
const request=(base,route,{method='GET',body}={})=>new Promise((resolve,reject)=>{
 const req=http.request(base+route,{method,headers:body?{'Content-Type':'application/json'}:{}},res=>{
  let text='';res.setEncoding('utf8');res.on('data',s=>text+=s);res.on('error',reject);
  res.on('end',()=>{try{resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(text)});}catch(e){reject(e);}});
 });req.on('error',reject);req.setTimeout(60000,()=>req.destroy(Error('HTTP timeout')));req.end(body&&JSON.stringify(body));
});
try{
 const port=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('startup timeout')),20000);
  child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('startup exit '+code));});
  child.on('message',m=>{if(m?.type==='ready'){clearTimeout(timer);resolve(m.port);}});
 });
 const base=`http://127.0.0.1:${port}`;
 const health=await request(base,'/health');assert.equal(health.status,200);assert.match(health.headers['server-timing']||'',/app;dur=/);
 const routes=[];let targets;
 const session='b5-b7-final-'+Date.now();
 for(const [route,key] of [['/api/banners','banners'],['/api/sections','sections'],['/api/rank/types','types'],[`/api/recommend?session=${session}&page=1`,'items']]){
  const response=await request(base,route);assert.equal(response.status,200,route+': '+JSON.stringify(response.body));assert.ok(!response.body.error);
  assert.ok(Array.isArray(response.body[key]),route+' shape');assert.match(response.headers['server-timing']||'',/app;dur=/);
  assert.match(response.headers['x-response-time']||'',/^\d+ms$/);
  routes.push({route:route.split('?')[0],status:response.status,key,count:response.body[key].length,serverTiming:response.headers['server-timing'],responseTime:response.headers['x-response-time'],cache:response.headers['x-cache']});
  if(key==='items'){
   targets=response.body.items.slice(0,2).map(row=>({kind:'detail',id:row.id}));
   const repeat=await request(base,route);assert.equal(repeat.status,200);assert.equal(repeat.headers['x-cache'],'HIT');assert.deepEqual(repeat.body,response.body);
  }
 }
 assert.equal(targets?.length,2);
 // Recommendation itself enqueues these targets. Pending work is shared;
 // already-completed work may legally be warmed again by an explicit POST.
 const submit=await request(base,'/api/prefetch',{method:'POST',body:{targets}});
 assert.equal(submit.status,202);const batch=submit.body;
 const start=Date.now();let status;
 do{
  const response=await request(base,'/api/prefetch/'+batch.id);assert.equal(response.status,200);status=response.body;
  if(status.state!=='pending')break;
  await new Promise(r=>setTimeout(r,100));
 }while(Date.now()-start<60000);
 assert.equal(status.state,'complete');assert.ok(status.targets.every(t=>t.state==='done'));
 const stats=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('stats IPC timeout')),3000);
  child.on('message',m=>{if(m?.type==='b7-metrics'){clearTimeout(timeout);resolve(m.stats);}});child.send({type:'b7-metrics'});
 });
 assert.equal(stats.maxActive,2);assert.ok(stats.started>=2&&stats.started<=4);
 assert.equal(stats.succeeded,stats.started);assert.equal(stats.failed,0);assert.equal(stats.cancelled,0);assert.equal(stats.active,0);
 const report={at:new Date().toISOString(),scope:'current-working-entry-isolated-data-and-port-not-user-service',sourceDir:folder,entrySha256:crypto.createHash('sha256').update(current).digest('hex'),routes,stats,targets:status.targets};
 fs.writeFileSync('.agents/outbox/prefetch-stats-final.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
 if(child.connected)child.send({type:'shutdown'});
 await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,6000))]);
 if(child.exitCode===null)child.kill();log.end();
}
