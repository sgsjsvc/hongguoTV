import { spawn,fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync,existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const remote=process.env.HG_SERVICE==='sync';
const profile=process.env.HG_DATA_DIR||path.join(process.platform==='win32'?(process.env.APPDATA||os.homedir()):process.platform==='darwin'?path.join(os.homedir(),'Library','Application Support'):(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local','share')),'HongguoTV',remote?'remote-service':'web-service');
mkdirSync(profile,{recursive:true,mode:0o700});
const stateFile=path.join(profile,'service-state.json'),lockFile=path.join(profile,'service.lock');
const readState=()=>{try{return JSON.parse(readFileSync(stateFile,'utf8'));}catch{return null;}};
async function control(state,stop=false){if(!state)return null;try{const response=await fetch(`http://127.0.0.1:${state.controlPort}/${stop?'stop':'health'}`,{method:stop?'POST':'GET',headers:{Authorization:`Bearer ${state.token}`},signal:AbortSignal.timeout(1500)});return response.ok?await response.json():null;}catch{return null;}}
function removeOwned(file,token){try{if(JSON.parse(readFileSync(file,'utf8')).token===token)unlinkSync(file);}catch{}}
const command=process.argv[2]||'start';
if(command==='stop'){
 const state=readState();if(await control(state,true))console.log('正在关闭本服务。');else console.log('本服务未运行；没有停止其他进程。');
}else if(command==='start'){
 const current=readState();const live=await control(current);if(live){console.log(`本服务已运行：http://localhost:${live.port}；数据：${profile}`);process.exit(0);}
 if(existsSync(lockFile)){
  const lock=JSON.parse(readFileSync(lockFile,'utf8'));let alive=true;try{process.kill(lock.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
  if(alive)throw Error('本服务正在启动或启动锁仍有效，请检查日志。');removeOwned(lockFile,lock.token);
 }
 const token=randomUUID();const lock=openSync(lockFile,'wx',0o600);writeFileSync(lock,JSON.stringify({pid:process.pid,token}));closeSync(lock);
 const output=openSync(path.join(profile,'service.log'),'a');const errors=openSync(path.join(profile,'service-errors.log'),'a');
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'run',token],{cwd:root,env:process.env,detached:true,windowsHide:true,stdio:['ignore',output,errors]});child.unref();closeSync(output);closeSync(errors);
 writeFileSync(lockFile,JSON.stringify({pid:child.pid,token}),{mode:0o600});
 let ready;
 for(let attempt=0;attempt<100;attempt++){ready=await control(readState());if(ready)break;await new Promise(resolve=>setTimeout(resolve,150));}
 if(!ready)throw Error(`启动未就绪，请查看 ${path.join(profile,'service-errors.log')}。默认端口已自动尝试递增；指定 HG_PORT 时严格使用该端口，请释放占用或更换 HG_PORT。`);
 console.log(`服务地址：http://localhost:${ready.port}\n数据：${profile}\n日志：${path.join(profile,'service.log')}`);
 if(remote)console.log(`家庭密钥文件：${path.join(profile,'shared-key.txt')}`);
}else if(command==='run'){
 const token=process.argv[3];if(!token)throw Error('managed startup token required');
 let stopped=false,backendReady=false;
 const child=fork(path.join(root,remote?'apps/sync-server/index.mjs':'custom-server/index.mjs'),[],{execPath:process.execPath,cwd:root,env:{...process.env,HG_MANAGED:'1',HG_DATA_DIR:profile,PORT:process.env.HG_PORT||(remote?'8791':'8788')},windowsHide:true,stdio:['ignore','inherit','inherit','ipc']});
 const controller=http.createServer((req,res)=>{
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/health')res.end(JSON.stringify({port:state.port}));
  else if(req.url==='/stop'&&req.method==='POST'){res.end('{"ok":true}');shutdown();}
  else{res.writeHead(404);res.end('{}');}
 });
 const state={pid:process.pid,backendPid:child.pid,token,port:0,controlPort:0};
 controller.listen(0,'127.0.0.1',()=>{state.controlPort=controller.address().port;publish();});
 const publish=()=>{if(backendReady&&state.controlPort&&state.port)writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});};
 child.on('message',message=>{if(message?.type==='ready'){backendReady=true;state.port=message.port;publish();}});
 // Remote service uses the same ready IPC contract as the local server.
 child.on('exit',(code)=>{removeOwned(stateFile,token);removeOwned(lockFile,token);controller.close();process.exitCode=code||0;});
 function shutdown(){if(stopped)return;stopped=true;if(child.connected)child.send({type:'shutdown'});const timeout=setTimeout(()=>child.kill('SIGTERM'),5000);timeout.unref();}
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
}else throw Error('use start or stop');
