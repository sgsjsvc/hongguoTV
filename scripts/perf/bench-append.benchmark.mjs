// Fixed 1,000-candidate workload, paired old/new order verification, fresh sessions.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const ref=process.env.BEFORE_REF||'c2561f5';
const file='shared/recommendation-core.cjs';
const sources={before:execFileSync('git',['show',`${ref}:${file}`],{encoding:'utf8'}),after:fs.readFileSync(file,'utf8')};
const constructors=Object.fromEntries(Object.entries(sources).map(([name,source])=>{
 // Use the same V8 realm as the candidate objects, as Node's real CJS require
 // does. A VM with host objects measures cross-realm bridge overhead instead.
 const module={exports:{}};new Function('module',source)(module);return[name,module.exports.RecommendationSession];
}));
const types=['real-drama','comic-drama','ai-drama'];
const candidates=Array.from({length:1000},(_,i)=>({id:String(i),title:'剧'+i,tags:i%2?'爱情/都市':'玄幻/奇幻',contentType:types[i%3],source:i%5?'hot':'discovery'}));
const options=i=>({seed:'bench-'+i,now:10000000,profile:{favorites:[{tags:'爱情',contentType:'comic-drama'}],history:[{seriesId:'10',positionMs:30000,updatedAt:9999999}]}});
const samples={before:[],after:[]};
for(let i=0;i<350;i++){
 const results={};
 // Alternate order to reduce thermal/JIT ordering bias; first 50 pairs are warmup.
 for(const name of i%2?['before','after']:['after','before']){
  const session=new constructors[name](options(i));
  const start=performance.now();results[name]=session.append(candidates,24).map(r=>r.id);
  const elapsed=performance.now()-start;if(i>=50)samples[name].push(elapsed);
 }
 assert.equal(JSON.stringify(results.before),JSON.stringify(results.after));
}
const quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const report={at:new Date().toISOString(),beforeRef:ref,candidates:1000,limit:24,warmup:50,pairs:300,seededOrderMatches:350,node:process.version,platform:process.platform,arch:process.arch,
 sourceHashes:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,crypto.createHash('sha256').update(v).digest('hex')])),
 results:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,{p50Ms:quantile(v,.5),p95Ms:quantile(v,.95),p99Ms:quantile(v,.99),samplesMs:v}]))};
report.p95ImprovementPercent=100*(1-report.results.after.p95Ms/report.results.before.p95Ms);
const out=process.env.OUT||'outputs/testing/b7/append-benchmark.json';fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:Object.fromEntries(Object.entries(report.results).map(([k,{samplesMs,...rest}])=>[k,rest]))},null,2));
assert.ok(report.results.after.p95Ms<=3,'append P95 must be <=3ms for 1000 candidates');
