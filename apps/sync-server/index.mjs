import { randomBytes } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LibraryStore } from '../../shared/library-store.mjs';
import { createSyncServer } from './server.mjs';
const directory=process.env.HG_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url));
mkdirSync(directory,{recursive:true});
const keyFile=path.join(directory,'shared-key.txt');
let key=process.env.HG_SYNC_KEY|| (existsSync(keyFile)?readFileSync(keyFile,'utf8').trim():'');
if(!key){key=randomBytes(32).toString('base64url');writeFileSync(keyFile,key+'\n',{mode:0o600});console.log(`家庭共享密钥已生成，文件：${keyFile}`);}
const store=new LibraryStore(path.join(directory,'library.sqlite'));
const server=createSyncServer(store,key,{keyFile,keyManaged:!!process.env.HG_SYNC_KEY});
server.listen(Number(process.env.PORT||8791),process.env.HG_HOST||'0.0.0.0',()=>{console.log(`共享服务已启动，端口 ${server.address().port}；密钥文件：${keyFile}`);if(process.send)process.send({type:'ready',port:server.address().port});});
let stopping=false;function shutdown(){if(stopping)return;stopping=true;server.close(()=>{store.close();process.exit(0);});server.closeAllConnections();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
process.on('message',message=>{if(message?.type==='shutdown')shutdown();});
process.on('disconnect',()=>{if(process.env.HG_MANAGED==='1')shutdown();});
