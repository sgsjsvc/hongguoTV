import { readFileSync } from 'node:fs';
import { LibraryError, compareEvents } from '../../shared/library-store.mjs';

const assets=new Map([
 ['/', ['index.html','text/html; charset=utf-8']],
 ['/admin.css',['admin.css','text/css; charset=utf-8']],
 ['/admin.js',['admin.js','text/javascript; charset=utf-8']],
]);
export function serveAdminAsset(req,res,pathname){
 if(!assets.has(pathname)||!['GET','HEAD'].includes(req.method))return false;
 const [file,type]=assets.get(pathname);const data=readFileSync(new URL(`./public/${file}`,import.meta.url));
 res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
 res.end(req.method==='HEAD'?undefined:data);return true;
}
export function adminSnapshot(store){
 const snapshot=store.snapshot();const events=store.db.prepare('SELECT event_json FROM library_records WHERE kind=?').all('search').map(row=>JSON.parse(row.event_json));
 const clear=events.find(event=>event.op==='clear');
 const searchRecords=events.filter(event=>event.op==='set'&&(!clear||compareEvents(event,clear)>0)).sort((a,b)=>compareEvents(b,a)).map(event=>({key:event.key,query:event.value.query,updatedAt:event.at}));
 const overview=store.db.prepare('SELECT COUNT(*) AS events,COALESCE(MAX(revision),0) AS cursor FROM library_events').get();
 const devices=store.db.prepare('SELECT device_id AS id,COUNT(*) AS events,MAX(event_time) AS lastEventAt FROM library_events GROUP BY device_id ORDER BY lastEventAt DESC').all();
 return {...snapshot,searchRecords,overview,devices,instanceId:store.getMeta('instanceId'),serverTime:Date.now()};
}
export function adminOperation(store,input){
 if(!input||typeof input.id!=='string'||input.id.length<8||input.id.length>256)throw new LibraryError(400,'operation ID required');
 const allowed=input.kind==='preference'?input.op==='set':['favorite','history','search','recommendation'].includes(input.kind)&&['delete','clear'].includes(input.op);
 if(!allowed)throw new LibraryError(400,'unsupported management operation');
 const operation={id:input.id,kind:input.kind,key:input.key,op:input.op,value:input.value};
 if(store.db.prepare('SELECT id FROM library_events WHERE id=?').get(input.id))return store.write(operation);
 const latest=input.op==='clear'
  ?store.db.prepare('SELECT COALESCE(MAX(event_time),0) AS at FROM library_events WHERE kind=?').get(input.kind)
  :store.db.prepare('SELECT COALESCE(MAX(event_time),0) AS at FROM library_events WHERE kind=? AND item_key=?').get(input.kind,input.key);
 return store.write({...operation,at:Math.max(Date.now(),latest.at+1)});
}
