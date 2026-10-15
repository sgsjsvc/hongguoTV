import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
test('preload exposes only the desktop fullscreen contract and supports unsubscribe',()=>{
 const ipc=new EventEmitter();const calls=[];ipc.invoke=async(...args)=>{calls.push(args);return true;};let exposed;
 vm.runInNewContext(fs.readFileSync('apps/web-pc/electron/preload.cjs','utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(name,api)=>{assert.equal(name,'hongguotvDesktop');exposed=api;}},ipcRenderer:ipc})});
 assert.deepEqual(Object.keys(exposed).sort(),['isDesktop','isFullScreen','onFullScreenChanged','setFullScreen','toggleFullScreen']);
 assert.equal(exposed.isDesktop,true);exposed.setFullScreen(true);exposed.toggleFullScreen();exposed.isFullScreen();assert.equal(calls.length,3);
 const values=[];const off=exposed.onFullScreenChanged(value=>values.push(value));ipc.emit('fullscreen:changed',{},true);off();ipc.emit('fullscreen:changed',{},false);assert.deepEqual(values,[true]);assert.equal(ipc.listenerCount('fullscreen:changed'),0);
});
function fixture(){
 const handlers=new Map();const context=vm.createContext({setTimeout,clearTimeout,ipcMain:{handle:(key,handler)=>handlers.set(key,handler)}});
 const source=fs.readFileSync('apps/web-pc/electron/main.cjs','utf8');
 const start=source.indexOf('let fullscreenQueue');assert.ok(start>=0);
 vm.runInContext('let mainWindow;'+source.slice(start,source.indexOf('function bootlog'))+'\nthis.mount=win=>{mainWindow=win;watchFullscreen(win);registerFullscreenHandlers();};',context);
 const win=new EventEmitter();let full=false;win.isDestroyed=()=>false;win.isFullScreen=()=>full;win.setFullScreen=flag=>setTimeout(()=>{win.emit(flag?'enter-full-screen':'leave-full-screen');setTimeout(()=>{full=flag;},5);},5);
 const notifications=[];win.webContents=new EventEmitter();win.webContents.isDestroyed=()=>false;win.webContents.send=(...args)=>notifications.push(args);win.webContents.mainFrame={};context.mount(win);
 return {win,handlers,notifications,event:{sender:win.webContents,senderFrame:win.webContents.mainFrame}};
}
test('main waits for transitions and serializes rapid toggles, validates sender and destruction',async()=>{
 const {win,handlers,event,notifications}=fixture();
 const pending=handlers.get('fullscreen:set')(event,true);assert.equal(win.isFullScreen(),false);assert.equal(await pending,true);
 assert.equal(await handlers.get('fullscreen:is')(event),true);
 const toggles=await Promise.all(Array.from({length:10},()=>handlers.get('fullscreen:toggle')(event)));
 assert.deepEqual(toggles,[false,true,false,true,false,true,false,true,false,true]);assert.equal(notifications.length,11);
 assert.throws(()=>handlers.get('fullscreen:is')({...event,sender:{}}),/窗口/);
 win.isDestroyed=()=>true;assert.throws(()=>handlers.get('fullscreen:is')(event),/窗口/);
});
