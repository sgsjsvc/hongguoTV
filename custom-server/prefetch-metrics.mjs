import {performance} from 'node:perf_hooks';

// Metadata work only. Time weighting avoids a misleading average of samples
// taken just when a job starts; no media bytes, URLs or device data are stored.
export function createPrefetchMetrics({now=()=>performance.now()}={}){
 const startedAt=now();let lastAt=startedAt,activeTimeMs=0;
 let active=0,maxActive=0,started=0,succeeded=0,failed=0,cancelled=0;
 const account=()=>{const at=now();activeTimeMs+=Math.max(0,at-lastAt)*active;lastAt=at;return at;};
 return{
  async run(work){
   account();active++;started++;maxActive=Math.max(maxActive,active);
   try{const value=await work();succeeded++;return value;}
   catch(error){if(error?.name==='AbortError')cancelled++;else failed++;throw error;}
   finally{account();active--;}
  },
  snapshot(){
   const elapsedMs=Math.max(0,account()-startedAt);
   return{active,maxActive,started,succeeded,failed,cancelled,elapsedMs,activeTimeMs,averageConcurrency:elapsedMs?activeTimeMs/elapsedMs:0};
  },
 };
}
