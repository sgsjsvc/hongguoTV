const {createRequire}=require('node:module');const fs=require('node:fs');const path=require('node:path');const net=require('node:net');const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const {chromium}=createRequire('C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/package.json')('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(start){for(let p=start;p<start+100;p++){const s=net.createServer();try{await new Promise((r,j)=>{s.once('error',j);s.listen(p,'127.0.0.1',r);});await new Promise(r=>s.close(r));return p;}catch{}}throw Error('No test debug port');}
(async()=>{
 for(const [source,target]of [['apps/web-pc/electron/main.cjs','resources/app/electron/main.cjs'],['apps/web-pc/electron/preload.cjs','resources/app/electron/preload.cjs'],['custom-server/index.mjs','resources/hongguotv/custom-server/index.mjs'],['shared/listen-port.mjs','resources/hongguotv/shared/listen-port.mjs']])assert.ok(fs.readFileSync(source).equals(fs.readFileSync(path.join('outputs/windows/win-unpacked',target))),target+' is current');
 const port=await freePort(28100),inspectPort=await freePort(28300);let child,browser,page,socket,native,stderr='';
 const env={...process.env,HG_PORT:'8899',HG_DESKTOP_PROFILE:path.resolve('outputs/w3-profile'),HG_NODE_RUNTIME:process.execPath};delete env.ELECTRON_RUN_AS_NODE;
 try{
  child=spawn(path.resolve('outputs/windows/win-unpacked/红果短剧.exe'),[`--remote-debugging-port=${port}`,`--inspect=${inspectPort}`],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.on('data',data=>stderr+=data);
  let inspector;for(let i=0;i<200;i++){try{inspector=(await(await fetch(`http://127.0.0.1:${inspectPort}/json/list`)).json())[0]?.webSocketDebuggerUrl;await fetch(`http://127.0.0.1:${port}/json/version`);if(inspector)break;}catch{}await sleep(100);}
  assert.ok(inspector,'Inspector available');socket=new WebSocket(inspector);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const call=pending.get(message.id);pending.delete(message.id);if(message.error)call.reject(Error(message.error.message));else call.resolve(message.result);}});
  const rpc=(method,params)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
  native=async expression=>{const response=await rpc('Runtime.evaluate',{expression:`JSON.stringify((()=>{const e=process.mainModule.require('electron');const w=e.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('hongguotv://app'));${expression}})())`,returnByValue:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return JSON.parse(response.result.value);};
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for(let i=0;i<200;i++){page=browser.contexts()[0].pages().find(p=>p.url().startsWith('hongguotv://app'));if(page)break;await sleep(100);}assert.ok(page);
  await page.waitForFunction(()=>!!window.hongguotvDesktop);
  const bridge=await page.evaluate(()=>({type:typeof window.hongguotvDesktop,keys:Object.keys(window.hongguotvDesktop),isDesktop:window.hongguotvDesktop.isDesktop}));
  await page.evaluate(()=>{window.testChanges=[];window.testUnsubscribe=window.hongguotvDesktop.onFullScreenChanged(flag=>window.testChanges.push(flag));});
  await native("globalThis.testFocusWindow=new e.BrowserWindow({width:320,height:160,show:true});globalThis.testFocusWindow.loadURL('about:blank');globalThis.testFocusWindow.focus();return w.isFocused();");await sleep(200);const focusedBefore=await native('return w.isFocused();');assert.equal(focusedBefore,false);
  await native("globalThis.fullscreenTrace=[];for(const name of ['enter-full-screen','leave-full-screen','resize'])w.on(name,()=>globalThis.fullscreenTrace.push({name,full:w.isFullScreen(),bounds:w.getBounds()}));return true;");
  try{assert.equal(await page.evaluate(()=>window.hongguotvDesktop.setFullScreen(true)),true);}catch(error){console.log('nativeFailure',await native('return {full:w.isFullScreen(),bounds:w.getBounds(),events:globalThis.fullscreenTrace,fullscreenable:w.isFullScreenable(),focused:w.isFocused()};'));throw error;}
  await page.waitForFunction(()=>window.innerWidth===screen.width&&window.innerHeight===screen.height);
  const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height}));
  const bounds=await native('return {window:w.getBounds(),display:e.screen.getDisplayMatching(w.getBounds()).bounds,contextIsolation:w.webContents.getLastWebPreferences().contextIsolation,nodeIntegration:w.webContents.getLastWebPreferences().nodeIntegration};');
  assert.equal(bounds.contextIsolation,true);assert.equal(bounds.nodeIntegration,false);assert.equal(bounds.window.width,bounds.display.width);assert.equal(bounds.window.height,bounds.display.height);
  await page.evaluate(()=>window.hongguotvDesktop.setFullScreen(false));
  const cycles=await page.evaluate(async()=>{const rows=[];for(let i=0;i<10;i++)rows.push([await window.hongguotvDesktop.toggleFullScreen(),await window.hongguotvDesktop.toggleFullScreen()]);return rows;});assert.ok(cycles.every(row=>row[0]===true&&row[1]===false));
  await page.bringToFront();await page.evaluate(()=>window.hongguotvDesktop.setFullScreen(true));await page.keyboard.press('Escape');await page.waitForFunction(async()=>!(await window.hongguotvDesktop.isFullScreen()));
  const beforeOff=await page.evaluate(()=>{const n=window.testChanges.length;window.testUnsubscribe();return n;});await page.evaluate(()=>window.hongguotvDesktop.setFullScreen(true));await page.evaluate(()=>window.hongguotvDesktop.setFullScreen(false));assert.equal(await page.evaluate(()=>window.testChanges.length),beforeOff);
  const health=await page.evaluate(async()=>{const r=await fetch('/health');return r.status;});assert.equal(health,200);
  const backendState=JSON.parse(fs.readFileSync('outputs/w3-profile/local-service/service-address.json','utf8'));assert.notEqual(backendState.port,8899);
  const result={bridge,focusedBefore,unfocusedFullscreenSucceeded:true,dimensions,bounds,cycles,escapeExit:true,unsubscribe:true,notificationsBeforeUnsubscribe:beforeOff,health,backendPort:backendState.port,parentHgPortIgnored:true};
  await native('globalThis.testFocusWindow.destroy();return true;');socket.close();socket=null;await page.close();await browser.close();browser=null;
  await Promise.race([new Promise(r=>child.exitCode!==null?r():child.once('exit',r)),sleep(8000)]);assert.notEqual(child.exitCode,null);result.closedOwnProcess=true;
  fs.writeFileSync('.agents/shared/t-w3-fullscreen-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(native&&socket?.readyState===WebSocket.OPEN)await native('if(globalThis.testFocusWindow&&!globalThis.testFocusWindow.isDestroyed())globalThis.testFocusWindow.destroy();return true;').catch(()=>{});if(socket)socket.close();if(page&&!page.isClosed())await page.close().catch(()=>{});if(browser)await browser.close();if(child&&child.exitCode===null)child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
