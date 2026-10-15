import { randomBytes } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibraryStore } from '../../shared/library-store.mjs';
import { createSyncServer } from './server.mjs';
import { listenWithFallback, serviceListenOptions } from '../../shared/listen-port.mjs';
const directory=process.env.HG_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url));
mkdirSync(directory,{recursive:true});
const keyFile=path.join(directory,'shared-key.txt');
let key=process.env.HG_SYNC_KEY|| (existsSync(keyFile)?readFileSync(keyFile,'utf8').trim():'');
if(!key){key=randomBytes(32).toString('base64url');writeFileSync(keyFile,key+'\n',{mode:0o600});console.log(`家庭共享密钥已生成，文件：${keyFile}`);}
const store=new LibraryStore(path.join(directory,'library.sqlite'));
const server=createSyncServer(store,key,{keyFile,keyManaged:!!process.env.HG_SYNC_KEY});
const listenOptions=serviceListenOptions(8791);
listenWithFallback(server,listenOptions.port,process.env.HG_HOST||'0.0.0.0',listenOptions.attempts).then(port=>{console.log(`共享服务已启动：http://localhost:${port}；密钥文件：${keyFile}`);if(process.send)process.send({type:'ready',port});}).catch(error=>{console.error(error.message);store.close();process.exitCode=1;if(process.connected)process.disconnect();});
let stopping=false;function shutdown(){if(stopping)return;stopping=true;server.close(()=>{store.close();process.exit(0);});server.closeAllConnections();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
process.on('message',message=>{if(message?.type==='shutdown')shutdown();});
process.on('disconnect',()=>{if(process.env.HG_MANAGED==='1')shutdown();});
