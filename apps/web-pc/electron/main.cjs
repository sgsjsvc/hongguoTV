const {app,BrowserWindow,protocol,net,dialog}=require('electron');
const {fork}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
if(process.env.HG_DESKTOP_PROFILE){const profile=path.resolve(process.env.HG_DESKTOP_PROFILE);fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);}
let mainWindow,backend,backendOrigin,quitting=false,initializing=true;
protocol.registerSchemesAsPrivileged([{scheme:'hongguotv',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
function bootlog(stage){fs.appendFileSync(path.join(app.getPath('userData'),'startup-stage.log'),new Date().toISOString()+' '+stage+'\n');}
async function startBackend(){
 bootlog('starting-backend');
 const packaged=path.join(process.resourcesPath,'hongguotv');
 const serviceRoot=fs.existsSync(path.join(packaged,'custom-server','index.mjs'))?packaged:path.resolve(__dirname,'../../..');
 const bundledNode=path.join(serviceRoot,'runtime',process.platform==='win32'?'node.exe':'node');
 const runtime=fs.existsSync(bundledNode)?bundledNode:process.env.HG_NODE_RUNTIME||'node';
 backend=fork(path.join(serviceRoot,'custom-server','index.mjs'),[],{execPath:runtime,execArgv:[],cwd:serviceRoot,windowsHide:true,env:{...process.env,HG_MANAGED:'1',PORT:'0',HG_HOST:'127.0.0.1',HG_DATA_DIR:path.join(app.getPath('userData'),'local-service'),HG_WEB_DIR:path.join(__dirname,'../dist')},stdio:['ignore','pipe','pipe','ipc']});
 const logs=fs.createWriteStream(path.join(app.getPath('userData'),'local-service.log'),{flags:'a'});backend.stdout.pipe(logs,{end:false});backend.stderr.pipe(logs,{end:false});backend.once('exit',()=>logs.end());
 const port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('内置后端启动超时')),15000);backend.once('error',error=>{clearTimeout(timeout);reject(error);});backend.once('exit',code=>{clearTimeout(timeout);reject(Error(`内置后端退出：${code}`));});backend.on('message',message=>{if(message?.type==='ready'){clearTimeout(timeout);resolve(message.port);}});});
 bootlog('backend-ready');
 backendOrigin=`http://127.0.0.1:${port}`;
 const {legacyOperations}=await import(pathToFileURL(path.join(serviceRoot,'shared','legacy-migration.mjs')).href);
 bootlog('migration-module-loaded');
 const migrationWindow=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 try{
  await migrationWindow.loadFile(path.join(__dirname,'../dist/index.html'),{query:{__legacy_migration:'1'}});
  bootlog('migration-page-loaded');
  const snapshot=await migrationWindow.webContents.executeJavaScript(`Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))`);
  bootlog('legacy-storage-read');
  const response=await fetch(backendOrigin+'/api/library/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({migrationId:'desktop-file-origin-v1',operations:legacyOperations(snapshot)})});
  if(!response.ok)throw Error('旧桌面数据迁移未成功，已保留原数据');
  // The preceding client version moved history into a standalone bridge. Import it once when available.
  try{
   const oldSettings=JSON.parse(snapshot.hg_settings_v1||'null');const oldOrigin=(oldSettings?.baseUrl||'http://127.0.0.1:8788').replace(/\/+$/,'');
   const health=await(await fetch(oldOrigin+'/health',{signal:AbortSignal.timeout(1500)})).json();
   if(health.service==='hongguotv-custom-bridge'){
    const history=await(await fetch(oldOrigin+'/api/history?source=all',{signal:AbortSignal.timeout(1500)})).json();
    if(Array.isArray(history.items)){const operations=history.items.map(item=>({kind:'history',key:item.seriesId,op:'set',at:item.updatedAt,value:item}));await fetch(backendOrigin+'/api/library/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({migrationId:'desktop-legacy-bridge-v1',operations})});}
   }
  }catch{ /* Legacy service is optional; standalone startup never depends on it. */ }
 }finally{migrationWindow.destroy();}
 bootlog('legacy-migration-finished');
 protocol.handle('hongguotv',async request=>{const source=new URL(request.url);return net.fetch(backendOrigin+source.pathname+source.search,{method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),bypassCustomProtocolHandlers:true});});
}
function createWindow(){bootlog('creating-main-window');mainWindow=new BrowserWindow({width:1380,height:860,minWidth:1024,minHeight:640,title:'红果短剧',backgroundColor:'#030712',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,webSecurity:true}});mainWindow.loadURL('hongguotv://app/');mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));mainWindow.on('closed',()=>{mainWindow=null;});}
app.whenReady().then(async()=>{try{await startBackend();createWindow();initializing=false;}catch(error){fs.appendFileSync(path.join(app.getPath('userData'),'startup-errors.log'),error.stack+'\n');console.error(error);dialog.showErrorBox('启动失败',error.message);if(backend)backend.kill();app.quit();}});
app.on('activate',()=>{if(!mainWindow&&backendOrigin)createWindow();});app.on('window-all-closed',()=>{if(!initializing)app.quit();});
app.on('before-quit',event=>{if(quitting||!backend||backend.exitCode!==null)return;event.preventDefault();quitting=true;backend.once('exit',()=>app.quit());if(backend.connected)backend.send({type:'shutdown'});const timeout=setTimeout(()=>{backend.kill();app.quit();},5000);timeout.unref();});
