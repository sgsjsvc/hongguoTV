const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {chromium}=require('node:module').createRequire('C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright/package.json')('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const desktop=process.argv.includes('--desktop'),mode=desktop?'desktop':'web';
if(!desktop){
 // Disable Playwright's focus emulation on its original CDP session; a second
 // CDP session cannot undo the first session's fullscreen suppression.
 const {CRSession}=require('C:/Users/AnLin/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core/lib/server/chromium/crConnection.js');
 const send=CRSession.prototype.send;
 CRSession.prototype.send=function(method,...args){if(method==='Emulation.setFocusEmulationEnabled')args[0]={...args[0],enabled:false};return send.call(this,method,...args);};
}
const title='全屏验收样本（本地测试片）';
const series={id:'9000000000000000001',title,cover:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480"><rect width="360" height="480" fill="#172033"/></svg>'),description:'W5 controlled media fixture',badge:'全3集',tags:'验收'};
const detail={...series,episodes:[1,2,3].map(n=>({id:'100'+n,number:n,title:'第'+n+'集'}))};
const media=fs.readFileSync('outputs/w5-tests/fixture.mp4');const requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture');const pathname=url.pathname;res.setHeader('Cache-Control','no-store');
 if(pathname.startsWith('/api/')){
  requests.push({method:req.method,path:pathname});
  if(pathname.match(/\/episodes\/\d+\/stream$/)){
   const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),media.length-1):media.length-1;
   res.writeHead(range?206:200,{'Content-Type':'video/mp4','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${media.length}`}:{})});res.end(media.subarray(start,end+1));return;
  }
  let result={ok:true};
  if(pathname==='/api/banners')result={banners:[series]};
  else if(pathname==='/api/sections')result={sections:[{type:'hot',name:'验收剧集',items:[series]}]};
  else if(pathname==='/api/library')result={favorites:[],history:[],searchHistory:[],recommendationSignals:[],preferences:{quality:'1080P',speed:1,recommendationMode:'mixed',recommendationResetAt:0},sync:{state:'unconfigured',enabled:false,url:'',pending:0},serverTime:Date.now()};
  else if(pathname.startsWith('/api/library/history/'))result={item:null};
  else if(pathname===`/api/series/${series.id}`)result=detail;
  else if(pathname.endsWith('/qualities'))result={qualities:[{key:'1080P',label:'1080P',qualityNum:1080,codec:'H.264'}]};
  else if(pathname.startsWith('/api/recommend')||pathname.endsWith('/related')||pathname.includes('/search'))result={items:[]};
  else if(pathname.endsWith('/seasons'))result={seasons:[]};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));req.resume();return;
 }
 let file=path.join('apps/web-pc/dist',pathname==='/'?'index.html':pathname);
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file='apps/web-pc/dist/index.html';
 const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));
});
async function freePort(base){for(let port=base;port<base+50;port++){const probe=net.createServer();try{await new Promise((r,j)=>{probe.once('error',j);probe.listen(port,'127.0.0.1',r);});await new Promise(r=>probe.close(r));return port;}catch{}}throw Error('No free test port');}
async function inspector(port){let url;for(let i=0;i<150;i++){try{url=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json())[0]?.webSocketDebuggerUrl;if(url)break;}catch{}await sleep(100);}assert.ok(url);const socket=new WebSocket(url);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let id=0;const waiting=new Map();socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const job=waiting.get(data.id);waiting.delete(data.id);data.error?job.reject(Error(data.error.message)):job.resolve(data.result);}});return {socket,eval:async expression=>{const key=++id;const pending=new Promise((resolve,reject)=>waiting.set(key,{resolve,reject}));socket.send(JSON.stringify({id:key,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));const data=await pending;if(data.exceptionDetails)throw Error(JSON.stringify(data.exceptionDetails));return data.result.value;}};}
(async()=>{
 let browser,page,child,debug;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  if(desktop){
   const port=await freePort(28500),inspectPort=await freePort(28700);const env={...process.env,HG_DESKTOP_PROFILE:path.resolve('outputs/w5-tests/desktop-profile')};delete env.ELECTRON_RUN_AS_NODE;
   child=spawn(path.resolve('outputs/w5-desktop/win-unpacked/红果短剧.exe'),[`--remote-debugging-port=${port}`,`--inspect=${inspectPort}`],{env,windowsHide:true,stdio:'ignore'});
   debug=await inspector(inspectPort);for(let i=0;i<150;i++){try{await fetch(`http://127.0.0.1:${port}/json/version`);break;}catch{}await sleep(100);}
   browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);for(let i=0;i<200;i++){page=browser.contexts()[0].pages().find(p=>p.url().startsWith('hongguotv://app'));if(page)break;await sleep(100);}assert.ok(page);
   await debug.eval(`(()=>{const e=process.mainModule.require('electron');e.protocol.unhandle('hongguotv');e.protocol.handle('hongguotv',request=>{const u=new URL(request.url);return e.net.fetch(${JSON.stringify(origin)}+u.pathname+u.search,{method:request.method,headers:request.headers,bypassCustomProtocolHandlers:true});});return true;})()`);
   await page.reload();
  }else{
   browser=await chromium.launch({channel:'chrome',headless:false,args:['--start-maximized','--autoplay-policy=no-user-gesture-required']});
   const context=await browser.newContext({viewport:null});page=await context.newPage();await page.goto(origin);
   await (await context.newCDPSession(page)).send('Emulation.setFocusEmulationEnabled',{enabled:false});
  }
  await page.bringToFront();await page.getByRole('button',{name:'立即观看',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await page.evaluate(()=>{const video=document.querySelector('video');video.pause();window.w5Ended=0;video.addEventListener('ended',()=>window.w5Ended++);});
  if(desktop)await debug.eval("(()=>{const e=process.mainModule.require('electron');globalThis.w5Other=new e.BrowserWindow({width:300,height:150,show:true});globalThis.w5Other.loadURL('about:blank');globalThis.w5Other.focus();return true;})()");
  if(!desktop){await page.bringToFront();await sleep(200);}
  await page.getByRole('button',{name:'全屏',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelector('video')?.parentElement.classList.contains('fixed'));
  await sleep(1500);
  const geometry=await page.evaluate(()=>{const v=document.querySelector('video'),p=v.parentElement,b=p.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],screen:[screen.width,screen.height],outer:[outerWidth,outerHeight],focused:document.hasFocus(),player:{x:b.x,y:b.y,width:b.width,height:b.height,position:getComputedStyle(p).position},domFullscreen:!!document.fullscreenElement,desktop:!!window.hongguotvDesktop};});
  const beforeFile=`.agents/shared/t-w5-${mode}-fullscreen.png`;await page.locator('video').dispatchEvent('mousemove');await page.waitForFunction(()=>getComputedStyle(document.querySelector('video').parentElement.querySelector('div.absolute.top-0')).opacity==='1');await page.screenshot({path:beforeFile});
  fs.writeFileSync(`.agents/shared/t-w5-${mode}-geometry.json`,JSON.stringify(geometry,null,2));console.log('geometry',JSON.stringify(geometry));
  assert.equal(geometry.viewport[0],geometry.screen[0]);assert.equal(geometry.viewport[1],geometry.screen[1]);assert.ok(Math.abs(geometry.player.width-geometry.viewport[0])<1);assert.ok(Math.abs(geometry.player.height-geometry.viewport[1])<1);assert.equal(geometry.player.x,0);assert.equal(geometry.player.y,0);
  await page.evaluate(async()=>{const v=document.querySelector('video');v.currentTime=v.duration-0.4;await v.play();});
  await page.waitForFunction(()=>document.querySelector('video')?.src.includes('/1002/stream'),{},{timeout:15000});await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const continued=await page.evaluate(()=>({ended:window.w5Ended,url:document.querySelector('video').src,fullscreen:document.querySelector('video').parentElement.classList.contains('fixed')}));assert.equal(continued.ended,1);assert.equal(continued.fullscreen,true);
  await page.mouse.move(2,2);await sleep(4000);
  const idle=await page.evaluate(()=>{const p=document.querySelector('video').parentElement,top=p.querySelector('div.absolute.top-0'),button=p.querySelector('button[aria-label="退出全屏"]');return {topOpacity:top?getComputedStyle(top).opacity:null,buttonOpacity:getComputedStyle(button).opacity,buttonSize:button.getBoundingClientRect().width};});assert.equal(idle.topOpacity,'0');assert.ok(idle.buttonSize>0);
  await page.mouse.move(200,200);await page.getByRole('button',{name:'退出全屏',exact:true}).last().waitFor();await sleep(400);
  await page.screenshot({path:`.agents/shared/t-w5-${mode}-idle.png`});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('video')?.parentElement.classList.contains('fixed'));assert.equal(await page.locator('video').count(),1);
  if(desktop){await debug.eval("(()=>{const e=process.mainModule.require('electron');e.ipcMain.removeHandler('fullscreen:toggle');e.ipcMain.handle('fullscreen:toggle',()=>{throw Error('W5 intentional test failure');});return true;})()");}
  else await page.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new TypeError('Permissions check failed'));});
  await page.getByRole('button',{name:'全屏',exact:true}).first().click();await page.getByText(desktop?'切换桌面全屏失败，请先点击窗口激活':'全屏失败，请先点击播放窗口再试',{exact:true}).waitFor();
  const result={mode,controlledMedia:true,geometry,continued,idle,escapeKeepsPlayer:true,errorToast:true,requests};fs.writeFileSync(`.agents/shared/t-w5-${mode}-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({mode,passed:true}));
 }catch(error){
  if(page&&!page.isClosed()){console.log('failureDetails',JSON.stringify(await page.evaluate(()=>({body:document.body.innerText.slice(-600),video:[...document.querySelectorAll('video')].map(v=>({src:v.src,readyState:v.readyState,error:v.error?{code:v.error.code,message:v.error.message}:null,networkState:v.networkState}))})).catch(()=>({}))));await page.screenshot({path:`.agents/shared/t-w5-${mode}-failure.png`}).catch(()=>{});}
  console.log('fixtureRequests',JSON.stringify(requests));throw error;
 }finally{
  if(debug){await debug.eval("(()=>{if(globalThis.w5Other&&!globalThis.w5Other.isDestroyed())globalThis.w5Other.destroy();return true;})()").catch(()=>{});debug.socket.close();}
  if(page&&!page.isClosed())await page.close().catch(()=>{});if(browser)await browser.close();
  if(child&&child.exitCode===null){await Promise.race([new Promise(r=>child.once('exit',r)),sleep(5000)]);if(child.exitCode===null)child.kill();}
  server.closeAllConnections();await new Promise(r=>server.close(r));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
