import { performance } from 'node:perf_hooks';
// Opt-in at the caller. Never log IDs, query strings, authorization or bodies.
function routeName(url) {
  const pathname=String(url||'').split('?')[0];
  if(/^\/api\/series\/[^/]+$/.test(pathname)) return '/api/series/:id';
  if(/^\/api\/episodes\/[^/]+\/(qualities|stream)$/.test(pathname)) return '/api/episodes/:id/'+pathname.split('/').at(-1);
  return new Set(['/health','/api/home','/api/recommend','/api/search','/api/ranks','/api/rank/list','/api/category/list','/api/categories']).has(pathname) ? pathname : 'other';
}
export function traceRequest(req,res,{now=()=>performance.now(),log=console.log}={}) {
  const start=now(),original=res.writeHead;
  let ended=false;
  res.writeHead=function(...args) {
    if(!this.headersSent) {
      const existing=this.getHeader('Server-Timing');
      this.setHeader('Server-Timing',(existing?existing+', ':'')+`app;dur=${Math.max(0,now()-start).toFixed(3)}`);
    }
    return original.apply(this,args);
  };
  const finish=aborted=>{
    if(ended)return;ended=true;res.writeHead=original;
    res.off('finish',onFinish);res.off('close',onClose);
    log(`[timing] route=${routeName(req.url)} status=${Number(res.statusCode)||0} cost=${Math.max(0,now()-start).toFixed(3)}ms aborted=${aborted}`);
  };
  const onFinish=()=>finish(false),onClose=()=>finish(true);
  res.once('finish',onFinish);res.once('close',onClose);
}
