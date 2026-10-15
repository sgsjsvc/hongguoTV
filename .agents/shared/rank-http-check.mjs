import {fork} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const child=fork('custom-server/index.mjs',[],{env:{...process.env,HG_HOST:'127.0.0.1',PORT:'0',HG_MANAGED:'1',HG_DATA_DIR:path.resolve('outputs/rank-diagnosis/http-data')},stdio:['ignore','ignore','pipe','ipc']});
let errors='';child.stderr.on('data',data=>errors+=data);
try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),20000);child.once('error',reject);child.once('exit',()=>reject(Error('startup exited')));child.on('message',message=>{if(message.type==='ready'){clearTimeout(timer);resolve(message.port);}});});
 const baseline=JSON.parse(fs.readFileSync('.agents/shared/t-rank-live-results.json','utf8'));
 const results=[];
 for(const route of ['hot-drama','hot-real-drama','hot-comic-drama','hot-ai-drama']){
  await Promise.all([1,2,3,4,5].map(async page=>{
   const response=await fetch(`http://127.0.0.1:${port}/api/rank/list?type=${route}&page=${page}`,{signal:AbortSignal.timeout(45000)});
   assert.equal(response.status,200);const data=await response.json();
   const official=baseline.find(row=>row.route===route&&row.page===page);
   assert.equal(data.items.length,20);assert.equal(data.items[0].id,official.firstId);assert.equal(data.items[0].rank,official.officialFirstRank);assert.equal(data.page,page);
   results.push({route,page,count:data.items.length,firstId:data.items[0].id,firstRank:data.items[0].rank});
  }));
 }
 fs.writeFileSync('.agents/shared/t-rank-http-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({pages:results.length,allOfficialFirstIdsAndRanksMatch:true}));
}finally{
 if(child.exitCode===null){child.send({type:'shutdown'});await new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{if(child.exitCode===null)child.kill();resolve();},5000).unref();});}
 if(errors.includes('Error'))console.error(errors);
}
