const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hongguotvDesktop',{
 isDesktop:true,
 setFullScreen:flag=>ipcRenderer.invoke('fullscreen:set',!!flag),
 toggleFullScreen:()=>ipcRenderer.invoke('fullscreen:toggle'),
 isFullScreen:()=>ipcRenderer.invoke('fullscreen:is'),
 onFullScreenChanged:callback=>{
  if(typeof callback!=='function')throw TypeError('callback must be a function');
  const handler=(_event,flag)=>callback(!!flag);
  ipcRenderer.on('fullscreen:changed',handler);
  return ()=>ipcRenderer.removeListener('fullscreen:changed',handler);
 }
});
