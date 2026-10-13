import { LibraryError } from '../shared/library-store.mjs';
import { readJson,sendJson } from '../shared/http-json.mjs';
export function createLibraryHandler(store,sync){return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/library'))return false;
  try{
    if(req.method==='GET'&&url.pathname==='/api/library')sendJson(res,{...store.snapshot(),sync:sync.view(),serverTime:Math.round(Date.now()+(store.getMeta('clockOffset')||0))});
    else if(req.method==='GET'&&url.pathname==='/api/library/sync')sendJson(res,sync.view());
    else if(req.method==='POST'&&url.pathname==='/api/library/sync')sendJson(res,await sync.configure(await readJson(req)));
    else if(req.method==='POST'&&url.pathname==='/api/library/operations')sendJson(res,{event:store.write(await readJson(req))});
    else if(req.method==='POST'&&url.pathname==='/api/library/import'){
      const input=await readJson(req);const id=typeof input.migrationId==='string'?input.migrationId:'';if(!id||id.length>256)throw new LibraryError(400,'migration ID required');
      if(!store.getMeta(`migration:${id}`)){
        if(!Array.isArray(input.operations)||input.operations.length>10000)throw new LibraryError(400,'invalid migration operations');
        // Outer transaction also includes the migration marker; write() uses its own transaction.
        for(let i=0;i<input.operations.length;i++)store.write({...input.operations[i],id:`migration:${id}:${i}`});
        store.setMeta(`migration:${id}`,true);
      }
      sendJson(res,{ok:true});
    }else throw new LibraryError(404,'unknown library route');
  }catch(error){sendJson(res,{error:error instanceof LibraryError?error.message:'本地资料保存失败'},error instanceof LibraryError?error.status:500);}
  return true;
};}
