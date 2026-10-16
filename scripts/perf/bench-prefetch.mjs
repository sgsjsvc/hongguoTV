// Controlled metadata-only scheduler experiment, not an upstream/video benchmark.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createPrefetchQueue} from '../../server/provider.mjs';
import {createPrefetchMetrics} from '../../custom-server/prefetch-metrics.mjs';
const results=[];
for(const concurrency of [1,2]){
 const metrics=createPrefetchMetrics(),queue=createPrefetchQueue(()=>metrics.run(()=>new Promise(r=>setTimeout(r,25))),{concurrency});
 const start=performance.now();
 try{
  const batch=queue.submit(Array.from({length:8},(_,i)=>({kind:'detail',id:String(i+1)})));
  while(queue.status(batch.id).state==='pending')await new Promise(r=>setTimeout(r,2));
  results.push({configuredConcurrency:concurrency,durationMs:performance.now()-start,...metrics.snapshot()});
 }finally{queue.close();}
}
const report={at:new Date().toISOString(),kind:'synthetic-metadata-queue',jobCount:8,delayMs:25,results};
fs.mkdirSync('.agents/outbox',{recursive:true});
fs.writeFileSync('.agents/outbox/prefetch-stats.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
