import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const bundle=path.resolve(process.argv[2]||'outputs/bundles/hongguotv-web-win-x64');
const runtime=path.join(bundle,'runtime',process.platform==='win32'?'node.exe':'node');
const profile=mkdtempSync(path.join(os.tmpdir(),'hongguotv-bundle-check-'));
const env={...process.env,HG_SERVICE:'web',HG_DATA_DIR:profile,HG_PORT:'0'};
const run=action=>{
 const result=spawnSync(runtime,[path.join(bundle,'scripts/service-launcher.mjs'),action],{env,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);return result.stdout;
};
const state=()=>JSON.parse(readFileSync(path.join(profile,'service-state.json'),'utf8'));
const stopped=async old=>{
 for(let i=0;i<100;i++){
  try{await fetch(`http://127.0.0.1:${old.controlPort}/health`,{headers:{Authorization:`Bearer ${old.token}`},signal:AbortSignal.timeout(100)});}
  catch{return;}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error('owned service did not stop');
};
try{
 run('start');const first=state();assert.match(run('start'),/已运行/);assert.equal(state().pid,first.pid);
 const origin=`http://127.0.0.1:${first.port}`;
 assert.equal((await fetch(origin+'/health')).status,200);
 assert.match(await(await fetch(origin+'/')).text(),/<html/);
 const home=await fetch(origin+'/api/home',{signal:AbortSignal.timeout(45000)});assert.equal(home.status,200);assert(Object.keys(await home.json()).length);
 const operation={id:'bundle-check-record',kind:'history',key:'7686713195246930968',op:'set',value:{seriesId:'7686713195246930968',title:'独立包持久化检查',episodeId:'90071992547409931',episodeNumber:1,positionMs:12345,durationMs:174000}};
 assert.equal((await fetch(origin+'/api/library/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(operation)})).status,200);
 run('stop');await stopped(first);run('start');const next=state();
 const library=await(await fetch(`http://127.0.0.1:${next.port}/api/library`)).json();
 assert.equal(library.history.find(row=>row.seriesId===operation.key).positionMs,12345);assert.equal(library.sync.enabled,false);
 run('stop');await stopped(next);
 console.log(JSON.stringify({bundle,profile,home:true,repeatedStart:true,persistence:true,ownedStop:true}));
}finally{run('stop');}
