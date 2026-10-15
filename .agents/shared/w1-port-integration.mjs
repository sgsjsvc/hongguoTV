import {fork,spawnSync} from 'node:child_process';
import net from 'node:net';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const directory=path.resolve('outputs/w1-tests');fs.mkdirSync(directory,{recursive:true});
const results=[];const held=[];
async function occupy(port){const server=net.createServer();try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});held.push(server);return 'test-owned';}catch(e){if(e.code==='EADDRINUSE')return 'existing-preserved';throw e;}}
async function release(){await Promise.all(held.splice(0).map(server=>new Promise(r=>server.close(r))));}
async function run(label,entry,env,expectedPort,fail=false){
 let log='';const child=fork(entry,[],{env:{...process.env,HG_PORT:undefined,PORT:undefined,...env,HG_HOST:'127.0.0.1',HG_MANAGED:'1',HG_DATA_DIR:path.join(directory,label)},stdio:['ignore','pipe','pipe','ipc']});
 child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const done=new Promise(resolve=>child.once('exit',(code)=>resolve(code)));
 try{
  const message=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),20000);child.once('exit',code=>{clearTimeout(timer);if(fail)resolve({failed:true,code});else reject(Error('early exit '+code+' '+log));});child.on('message',message=>{if(message.type==='ready'){clearTimeout(timer);resolve(message);}});});
  if(fail){assert.equal(message.failed,true);assert.equal(message.code,1);assert.match(log,/netstat/);assert.match(log,/HG_PORT/);}
  else{assert.equal(child.exitCode,null);if(expectedPort!==null)assert.equal(message.port,expectedPort);assert.ok(message.port>0);assert.equal((await fetch(`http://127.0.0.1:${message.port}/health`)).status,200);child.send({type:'shutdown'});assert.equal(await done,0);assert.ok(log.includes(String(message.port)));}
  fs.writeFileSync(path.join(directory,label+'.log'),log);results.push({label,...message,logFile:'outputs/w1-tests/'+label+'.log'});
 }finally{if(child.exitCode===null){child.kill();await done;}}
}
try{
 const ownership=await occupy(8788);await run('default-one','custom-server/index.mjs',{},8789);await release();
 await occupy(8788);await occupy(8789);await occupy(8790);await run('default-three','custom-server/index.mjs',{},8791);await release();
 for(let port=8788;port<=8798;port++)await occupy(port);await run('all-busy','custom-server/index.mjs',{},null,true);await release();
 await occupy(8899);await run('explicit-busy','custom-server/index.mjs',{HG_PORT:'8899'},null,true);await release();
 await run('explicit-free','custom-server/index.mjs',{HG_PORT:'8899'},8899);
 await run('ephemeral','custom-server/index.mjs',{PORT:'0'},null);
 await occupy(8791);await run('sync-fallback','apps/sync-server/index.mjs',{},8792);await release();
 for(const remote of [false,true]){
  const port=remote?8791:8788;await occupy(port);
  const profile=path.join(directory,remote?'launcher-sync':'launcher-web');const env={...process.env,HG_PORT:undefined,PORT:undefined,HG_HOST:'127.0.0.1',HG_DATA_DIR:profile,HG_SERVICE:remote?'sync':'web'};
  try{
   const start=spawnSync(process.execPath,['scripts/service-launcher.mjs','start'],{env,encoding:'utf8',timeout:25000});assert.equal(start.status,0,start.stderr);const state=JSON.parse(fs.readFileSync(path.join(profile,'service-state.json'),'utf8'));assert.equal(state.port,port+1);
   const again=spawnSync(process.execPath,['scripts/service-launcher.mjs','start'],{env,encoding:'utf8',timeout:10000});assert.equal(again.status,0);assert.match(again.stdout,/已运行/);
   results.push({label:remote?'launcher-sync':'launcher-web',actualPort:state.port,repeatedStart:true});
  }finally{const stop=spawnSync(process.execPath,['scripts/service-launcher.mjs','stop'],{env,encoding:'utf8',timeout:10000});assert.equal(stop.status,0);await new Promise(r=>setTimeout(r,500));await release();}
 }
 results.push({label:'existing-8788-owner',ownership});
 fs.writeFileSync('.agents/shared/t-w1-port-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await release();}
