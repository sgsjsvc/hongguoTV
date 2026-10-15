import {fork,spawn} from 'node:child_process';import net from 'node:net';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const profile=path.resolve('outputs/w1-vite-profile');fs.mkdirSync(profile,{recursive:true});
const env={...process.env,HG_DATA_DIR:profile,HG_HOST:'127.0.0.1',HG_PORT:undefined,PORT:undefined};
const held=[];let child,vite,log='';
async function occupy(port){const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(port,'127.0.0.1',r);});held.push(server);}
try{
 await occupy(8788);await occupy(3000);
 child=fork('custom-server/index.mjs',[],{env,stdio:['ignore','ignore','ignore','ipc']});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Backend timeout')),15000);child.on('message',message=>{if(message.type==='ready'){clearTimeout(timer);resolve(message.port);}});});assert.equal(port,8789);
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3000'],{cwd:'apps/web-pc',env,stdio:['ignore','pipe','pipe']});vite.stdout.on('data',data=>log+=data);vite.stderr.on('data',data=>log+=data);
 let pagePort;for(let i=0;i<150;i++){pagePort=Number(log.match(/127\.0\.0\.1:(\d+)/)?.[1]);if(pagePort)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(pagePort,3001,log);const response=await fetch('http://127.0.0.1:3001/api/rank/types',{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);assert.equal((await response.json()).types.length,4);
 const result={backendPort:port,vitePort:pagePort,proxyRankTypes:4,proxyStatus:200};fs.writeFileSync('.agents/shared/t-w1-vite-results.json',JSON.stringify(result,null,2));fs.writeFileSync('outputs/w1-tests/vite.log',log);console.log(JSON.stringify(result));
}finally{
 if(vite&&vite.exitCode===null){vite.kill();await new Promise(r=>vite.once('exit',r));}
 if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await done;}
 await Promise.all(held.map(server=>new Promise(r=>server.close(r))));
}
