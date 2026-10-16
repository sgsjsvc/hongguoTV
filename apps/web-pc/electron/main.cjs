const {app,BrowserWindow,protocol,net,dialog,ipcMain}=require('electron');
const {fork}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
if(process.env.HG_DESKTOP_PROFILE){const profile=path.resolve(process.env.HG_DESKTOP_PROFILE);fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);}
const singleInstanceLock=app.requestSingleInstanceLock();
let mainWindow,backend,backendOrigin,quitting=false,initializing=true,backendRestarts=0;
protocol.registerSchemesAsPrivileged([{scheme:'hongguotv',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
let fullscreenQueue=Promise.resolve();
function fullscreenWindow(event){
 const win=mainWindow;
 if(!win||win.isDestroyed()||win.webContents.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('全屏请求的窗口不可用');
 return win;
}
function setWindowFullscreen(win,flag){
 if(win.isDestroyed())return Promise.reject(Error('全屏窗口已关闭'));
 if(win.isFullScreen()===flag)return Promise.resolve(flag);
 return new Promise((resolve,reject)=>{
  let timer,stateTimer;
  const cleanup=()=>{clearTimeout(timer);clearTimeout(stateTimer);win.off('enter-full-screen',changed);win.off('leave-full-screen',changed);win.off('closed',closed);};
  // Windows can emit the native event before isFullScreen() updates.
  const changed=()=>{clearTimeout(stateTimer);if(win.isDestroyed()){closed();return;}if(win.isFullScreen()===flag){cleanup();resolve(win.isFullScreen());}else stateTimer=setTimeout(changed,16);};
  const closed=()=>{cleanup();reject(Error('全屏窗口已关闭'));};
  win.on('enter-full-screen',changed);win.on('leave-full-screen',changed);win.once('closed',closed);
  timer=setTimeout(()=>{cleanup();reject(Error('窗口全屏切换超时，请重试'));},4000);
  try{win.setFullScreen(flag);}catch(error){cleanup();reject(error);}
 });
}
function enqueueFullscreen(win,flag){
 const next=fullscreenQueue.catch(()=>{}).then(()=>{if(win.isDestroyed())throw Error('全屏窗口已关闭');return setWindowFullscreen(win,flag===undefined?!win.isFullScreen():flag);});
 fullscreenQueue=next;return next;
}
function registerFullscreenHandlers(){
 ipcMain.handle('fullscreen:set',(event,flag)=>{const win=fullscreenWindow(event);if(typeof flag!=='boolean')throw Error('全屏状态必须是 boolean');return enqueueFullscreen(win,flag);});
 ipcMain.handle('fullscreen:toggle',event=>enqueueFullscreen(fullscreenWindow(event)));
 ipcMain.handle('fullscreen:is',event=>fullscreenWindow(event).isFullScreen());
}
function watchFullscreen(win){
 let notificationTimer;
 const changed=flag=>{
  clearTimeout(notificationTimer);const deadline=Date.now()+4000;
  const publish=()=>{if(win.isDestroyed()||win.webContents.isDestroyed())return;if(win.isFullScreen()===flag)win.webContents.send('fullscreen:changed',flag);else if(Date.now()<deadline)notificationTimer=setTimeout(publish,16);};publish();
 };
 win.on('enter-full-screen',()=>changed(true));win.on('leave-full-screen',()=>changed(false));
 win.once('closed',()=>clearTimeout(notificationTimer));
 win.webContents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown')return;
  if(input.key==='F11'||(input.key==='Escape'&&win.isFullScreen())){event.preventDefault();enqueueFullscreen(win,input.key==='Escape'?false:undefined).catch(error=>console.warn(error.message));}
 });
}
registerFullscreenHandlers();
function bootlog(stage){const file=path.join(app.getPath('userData'),'startup-stage.log');try{if(fs.existsSync(file)&&fs.statSync(file).size>1048576)fs.renameSync(file,file+'.1');}catch{}fs.appendFileSync(file,new Date().toISOString()+' '+stage+'\n');}
const MAX_BACKEND_RESTARTS=3;
function resolveServiceRoot(){
 const packaged=path.join(process.resourcesPath,'hongguotv');
 return fs.existsSync(path.join(packaged,'custom-server','index.mjs'))?packaged:path.resolve(__dirname,'../../..');
}
// Fork the bundled backend and resolve once it reports its dynamically assigned port.
// A persistent exit watcher is armed only after ready, so a failed cold start is still
// handled by startBackend()'s rejection path instead of triggering a restart loop.
function launchBackend(){
 if(backend&&backend.exitCode===null){try{backend.kill();}catch{}}
 const serviceRoot=resolveServiceRoot();
 const bundledNode=path.join(serviceRoot,'runtime',process.platform==='win32'?'node.exe':'node');
 const runtime=fs.existsSync(bundledNode)?bundledNode:process.env.HG_NODE_RUNTIME||'node';
 const proc=fork(path.join(serviceRoot,'custom-server','index.mjs'),[],{execPath:runtime,execArgv:[],cwd:serviceRoot,windowsHide:true,env:{...process.env,HG_PORT:undefined,HG_MANAGED:'1',PORT:'0',HG_HOST:'127.0.0.1',HG_DATA_DIR:path.join(app.getPath('userData'),'local-service'),HG_WEB_DIR:path.join(__dirname,'../dist')},stdio:['ignore','pipe','pipe','ipc']});
 backend=proc;
 const logFile=path.join(app.getPath('userData'),'local-service.log');
 try{if(fs.existsSync(logFile)&&fs.statSync(logFile).size>1048576)fs.renameSync(logFile,logFile+'.1');}catch{}
 const logs=fs.createWriteStream(logFile,{flags:'a'});proc.stdout.pipe(logs,{end:false});proc.stderr.pipe(logs,{end:false});proc.once('exit',()=>logs.end());
 let ready=false;
 proc.on('exit',(code,signal)=>{if(!ready||quitting||proc!==backend)return;bootlog(`backend-crashed code=${code} signal=${signal}`);scheduleBackendRestart();});
 return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('内置后端启动超时')),15000);proc.once('error',error=>{clearTimeout(timeout);reject(error);});proc.once('exit',code=>{clearTimeout(timeout);reject(Error(`内置后端退出：${code}`));});proc.on('message',message=>{if(message?.type==='ready'){clearTimeout(timeout);ready=true;backendOrigin=`http://127.0.0.1:${message.port}`;resolve(message.port);}});});
}
// Runtime crash handling: restart the backend up to MAX_BACKEND_RESTARTS times, then fall
// back to an explicit dialog so the user is never left staring at a blank window.
function scheduleBackendRestart(){
 if(quitting)return;
 if(backendRestarts>=MAX_BACKEND_RESTARTS){dialog.showErrorBox('服务异常','内置服务已多次停止，请重启应用。');return;}
 backendRestarts+=1;
 bootlog(`backend-restarting attempt=${backendRestarts}`);
 launchBackend().then(()=>{
  bootlog(`backend-restarted attempt=${backendRestarts}`);
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.reload();
 }).catch(error=>{
  bootlog(`backend-restart-failed attempt=${backendRestarts} ${error.message}`);
  if(backendRestarts>=MAX_BACKEND_RESTARTS)dialog.showErrorBox('服务异常','内置服务已多次停止，请重启应用。');
  else setTimeout(scheduleBackendRestart,1000).unref();
 });
}
async function startBackend(){
 bootlog('starting-backend');
 await launchBackend();
 bootlog('backend-ready');
 const {legacyOperations}=await import(pathToFileURL(path.join(resolveServiceRoot(),'shared','legacy-migration.mjs')).href);
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
function createWindow(){bootlog('creating-main-window');mainWindow=new BrowserWindow({width:1380,height:860,minWidth:1024,minHeight:640,title:'红果短剧',backgroundColor:'#030712',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,webSecurity:true}});watchFullscreen(mainWindow);mainWindow.loadURL('hongguotv://app/');mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));mainWindow.on('closed',()=>{mainWindow=null;});}
if(!singleInstanceLock){app.quit();}
else{
 app.on('second-instance',()=>{if(!mainWindow||mainWindow.isDestroyed())return;if(mainWindow.isMinimized())mainWindow.restore();if(!mainWindow.isVisible())mainWindow.show();mainWindow.focus();});
 app.whenReady().then(async()=>{try{await startBackend();createWindow();initializing=false;}catch(error){fs.appendFileSync(path.join(app.getPath('userData'),'startup-errors.log'),error.stack+'\n');console.error(error);dialog.showErrorBox('启动失败',error.message);if(backend)backend.kill();app.quit();}});
 app.on('activate',()=>{if(!mainWindow&&backendOrigin)createWindow();});app.on('window-all-closed',()=>{if(!initializing)app.quit();});
 app.on('before-quit',event=>{if(quitting||!backend||backend.exitCode!==null)return;event.preventDefault();quitting=true;backend.once('exit',()=>app.quit());if(backend.connected)backend.send({type:'shutdown'});const timeout=setTimeout(()=>{backend.kill();app.quit();},5000);timeout.unref();});
}
