import http from 'node:http';
import { LibraryError } from '../../shared/library-store.mjs';
import { readJson,sendJson } from '../../shared/http-json.mjs';
import { serveAdminAsset,adminSnapshot,adminOperation } from './admin.mjs';
import { SharedKey } from './shared-key.mjs';
export function createSyncServer(store,key,options={}){
  const authority=new SharedKey(key,options);
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(serveAdminAsset(req,res,url.pathname))return;
      res.setHeader('Cache-Control','no-store');
      if(url.pathname==='/health'){sendJson(res,{service:'hongguotv-sync',ok:true});return;}
      const authorize=()=>{if(!authority.accepts(req.headers.authorization?.replace(/^Bearer /,'')||''))throw new LibraryError(401,'invalid shared key')};
      authorize();
      const metadata={protocolVersion:1,instanceId:store.getMeta('instanceId'),serverTime:Date.now()};
      if(req.method==='GET'&&url.pathname==='/api/admin/key')sendJson(res,authority.info());
      else if(req.method==='POST'&&url.pathname==='/api/admin/key'){const input=await readJson(req);authorize();sendJson(res,authority.rotate(input));}
      else if(req.method==='GET'&&url.pathname==='/api/admin/library')sendJson(res,adminSnapshot(store));
      else if(req.method==='POST'&&url.pathname==='/api/admin/operations'){const input=await readJson(req);authorize();sendJson(res,{event:adminOperation(store,input),data:adminSnapshot(store)});}
      else if(req.method==='GET'&&url.pathname==='/api/sync/handshake')sendJson(res,metadata);
      else if(req.method==='POST'&&url.pathname==='/api/sync/push'){
        const input=await readJson(req);
        authorize();
        if(input.instanceId&&input.instanceId!==metadata.instanceId)throw new LibraryError(409,'remote instance changed; verify configuration again');
        const events=store.receive(input.events,{clampFuture:true});sendJson(res,{...metadata,acked:events.map(e=>e.id),events});
      }else if(req.method==='GET'&&url.pathname==='/api/sync/pull')sendJson(res,{...metadata,...store.changes(Number(url.searchParams.get('cursor')||0),Number(url.searchParams.get('limit')||256))});
      else throw new LibraryError(404,'unknown sync route');
    }catch(error){sendJson(res,{error:error instanceof LibraryError?error.message:'storage unavailable'},error instanceof LibraryError?error.status:500);}
  });
}
