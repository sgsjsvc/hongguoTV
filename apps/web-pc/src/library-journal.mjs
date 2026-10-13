import { historyUuid } from './history-outbox.mjs';
export class LibraryJournal {
 constructor(storage,namespace,send,uuid=historyUuid){this.storage=storage;this.prefix=`hg_library_pending_v1:${namespace}:`;this.send=send;this.uuid=uuid;this.busy=null;}
 entries(){const rows=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(this.prefix)){const event=JSON.parse(this.storage.getItem(key));if(event)rows.push({key,event});}}return rows.sort((a,b)=>a.event.at-b.event.at||a.event.id.localeCompare(b.event.id));}
 save(operation){const event={...operation,id:this.uuid()};const key=this.prefix+event.id;this.storage.setItem(key,JSON.stringify(event));for(const row of this.entries())if(row.key!==key&&row.event.kind===event.kind&&(row.event.key===event.key||event.op==='clear')&&row.event.at<=event.at)this.storage.removeItem(row.key);return event;}
 flush(){if(this.busy)return this.busy;this.busy=(async()=>{for(const row of this.entries()){await this.send(row.event);this.storage.removeItem(row.key);}})().finally(()=>{this.busy=null;});return this.busy;}
}
