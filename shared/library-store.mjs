import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export class LibraryError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = message => { throw new LibraryError(400,message); };
const text = (value,name,max=256) => typeof value==='string' && value.trim() && value.length<=max ? value : fail(`invalid ${name}`);
const number = (value,name,min=0,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value)&&value>=min&&value<=max ? value : fail(`invalid ${name}`);
const contentTypes=['real-drama','comic-drama','ai-drama'];
const contentType = value => contentTypes.includes(value) ? value : fail('invalid content type');
const series = value => ({id:text(value?.id,'series id'),title:text(value?.title,'title',1000),...Object.fromEntries(['cover','description','badge','tags'].map(key=>[key,typeof value[key]==='string'?value[key].slice(0,key==='description'?20000:8192):''])),...(value.contentType==null?{}:{contentType:contentType(value.contentType)})});
export function validateEvent(input) {
  if (!input || typeof input!=='object') fail('event required');
  const event={id:text(input.id,'event id'),deviceId:text(input.deviceId,'device id'),seq:number(input.seq,'sequence',1),kind:input.kind,key:text(input.key,'key',1000),op:input.op,at:number(input.at,'event time'),value:null};
  if (!['history','favorite','search','preference','recommendation'].includes(event.kind)||!['set','delete','clear'].includes(event.op)) fail('invalid event kind or operation');
  if (event.op==='clear') { if(event.key!=='*'||event.kind==='preference')fail('invalid clear'); return event; }
  if (event.key==='*') fail('reserved key');
  if(event.kind==='recommendation') {
    const parts=event.key.split(':');
    if(parts.length!==2)fail('invalid recommendation key');
    text(parts[0],'session id');text(parts[1],'series id');
  }
  if (event.op==='delete') { if(event.kind==='preference')fail('preferences must be reset explicitly'); return event; }
  const value=input.value;
  if(event.kind==='favorite') {event.value=series(value);if(event.value.id!==event.key)fail('favorite key mismatch');}
  if(event.kind==='history') {
    const metadata=series({...value,id:value?.seriesId});
    if(metadata.id!==event.key)fail('history key mismatch');
    event.value={seriesId:metadata.id,title:metadata.title,cover:metadata.cover,description:metadata.description,badge:metadata.badge,tags:metadata.tags,...(metadata.contentType?{contentType:metadata.contentType}:{}),
      episodeId:text(value.episodeId,'episode id'),episodeNumber:number(value.episodeNumber,'episode number',1,1000000),positionMs:number(value.positionMs,'position',0,31536000000),durationMs:number(value.durationMs??0,'duration',0,31536000000),completed:value.completed??false};
    if(typeof event.value.completed!=='boolean')fail('invalid completed state');
  }
  if(event.kind==='search') {const query=text(value?.query,'query',1000).trim();if(query.toLowerCase()!==event.key)fail('search key mismatch');event.value={query};}
  if(event.kind==='recommendation') {
    const seriesId=text(value?.seriesId,'series id');
    if(event.key.split(':')[1]!==seriesId)fail('recommendation key mismatch');
    if(typeof value.tags!=='string'||value.tags.length>8192)fail('invalid recommendation tags');
    if(typeof value.completed!=='boolean')fail('invalid completed state');
    event.value={seriesId,title:text(value.title,'title',1000),tags:value.tags,contentType:contentType(value.contentType),watchMs:number(value.watchMs,'watch time'),exposures:number(value.exposures,'exposures'),skips:number(value.skips,'skips'),completed:value.completed};
  }
  if(event.kind==='preference') {
    if(event.key==='quality') event.value={value:text(value?.value,'quality',32)};
    else if(event.key==='speed'&&typeof value?.value==='number'&&Number.isFinite(value.value)&&value.value>=.25&&value.value<=4)event.value={value:value.value};
    else if(event.key==='recommendationMode'&&['mixed',...contentTypes].includes(value?.value))event.value={value:value.value};
    else if(event.key==='recommendationResetAt')event.value={value:number(value?.value,'recommendation reset time')};
    else fail('invalid preference');
  }
  return event;
}
export function compareEvents(a,b) {return a.at-b.at || (a.deviceId<b.deviceId?-1:a.deviceId>b.deviceId?1:0) || a.seq-b.seq;}
const fingerprint = event => createHash('sha256').update(JSON.stringify(event)).digest('hex');

export class LibraryStore {
  constructor(filename) {
    if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS library_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS library_events(revision INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,device_id TEXT NOT NULL,seq INTEGER NOT NULL,kind TEXT NOT NULL,item_key TEXT NOT NULL,event_time INTEGER NOT NULL,event_json TEXT NOT NULL,fingerprint TEXT NOT NULL,is_local INTEGER NOT NULL,UNIQUE(device_id,seq));
      CREATE INDEX IF NOT EXISTS library_event_item ON library_events(kind,item_key,event_time);
      CREATE TABLE IF NOT EXISTS library_records(kind TEXT NOT NULL,item_key TEXT NOT NULL,event_json TEXT NOT NULL,PRIMARY KEY(kind,item_key));
      CREATE TABLE IF NOT EXISTS library_ack(target TEXT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(target,event_id));`);
    for(const key of ['deviceId','instanceId'])if(!this.getMeta(key))this.setMeta(key,randomUUID());
    this.recordVersion=0;this.snapshotCache=null;
  }
  close(){this.db.close();}
  getMeta(key){const row=this.db.prepare('SELECT value FROM library_meta WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
  setMeta(key,value){this.db.prepare('INSERT INTO library_meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  write(input) {
    return this.transaction(()=>{
      if(input.id){const previous=this.db.prepare('SELECT * FROM library_events WHERE id=?').get(input.id);if(previous){const saved=JSON.parse(previous.event_json);const retry=validateEvent({...input,deviceId:saved.deviceId,seq:saved.seq,at:input.at??saved.at});if(fingerprint(retry)!==previous.fingerprint&&fingerprint(retry)!==fingerprint(saved))throw new LibraryError(409,'operation ID was reused');return saved;}}
      const seq=(this.getMeta('sequence')||0)+1;
      const clock=Math.round(Date.now()+(this.getMeta('clockOffset')||0));
      const last=this.getMeta('lastTime')||0;
      const auto=Math.max(clock,Math.abs(last-clock)>300000?clock:last+1);
      const at=input.at==null?auto:Math.max(input.at,last);
      const event=validateEvent({...input,id:input.id||randomUUID(),deviceId:this.getMeta('deviceId'),seq,at});
      this.setMeta('sequence',seq);this.setMeta('lastTime',at);this.insert(event,1);return event;
    });
  }
  insert(event,isLocal,original=event) {
    const known=this.db.prepare('SELECT * FROM library_events WHERE id=?').get(event.id);
    if(known){
      if(known.fingerprint!==fingerprint(original)&&fingerprint(JSON.parse(known.event_json))!==fingerprint(original))throw new LibraryError(409,'event ID was reused');
      return JSON.parse(known.event_json);
    }
    try {this.db.prepare('INSERT INTO library_events(id,device_id,seq,kind,item_key,event_time,event_json,fingerprint,is_local) VALUES(?,?,?,?,?,?,?,?,?)').run(event.id,event.deviceId,event.seq,event.kind,event.key,event.at,JSON.stringify(event),fingerprint(original),isLocal);}
    catch(error){if(error.message.includes('UNIQUE'))throw new LibraryError(409,'device sequence was reused');throw error;}
    this.materialize(event);return event;
  }
  materialize(event) {
    const row=this.db.prepare('SELECT event_json FROM library_records WHERE kind=? AND item_key=?').get(event.kind,event.key);
    if(row&&compareEvents(event,JSON.parse(row.event_json))<=0)return;
    this.db.prepare('INSERT INTO library_records VALUES(?,?,?) ON CONFLICT(kind,item_key) DO UPDATE SET event_json=excluded.event_json').run(event.kind,event.key,JSON.stringify(event));
    this.recordVersion++;
  }
  receive(inputs,{clampFuture=false,canonical=false}={}) {
    if(!Array.isArray(inputs)||inputs.length>256)fail('at most 256 events are allowed');
    const events=inputs.map(validateEvent);
    return this.transaction(()=>events.map(original=>{
      const event=clampFuture?{...original,at:Math.min(original.at,Date.now()+300000)}:original;
      const known=this.db.prepare('SELECT * FROM library_events WHERE id=?').get(event.id);
      if(canonical&&known){
        const previous=JSON.parse(known.event_json);
        if(fingerprint({...previous,at:event.at})!==fingerprint(event))throw new LibraryError(409,'canonical event changed identity');
        if(previous.at!==event.at){
          this.db.prepare('UPDATE library_events SET event_time=?,event_json=? WHERE id=?').run(event.at,JSON.stringify(event),event.id);
          const winner=this.db.prepare('SELECT event_json FROM library_events WHERE kind=? AND item_key=? ORDER BY event_time DESC,device_id DESC,seq DESC LIMIT 1').get(event.kind,event.key);
          this.db.prepare('INSERT INTO library_records VALUES(?,?,?) ON CONFLICT(kind,item_key) DO UPDATE SET event_json=excluded.event_json').run(event.kind,event.key,winner.event_json);
          this.recordVersion++;
        }
        return event;
      }
      return this.insert(event,0,original);
    }));
  }
  snapshot() {
    const key=`${this.recordVersion}:${this.db.prepare('PRAGMA data_version').get().data_version}`;
    if(this.snapshotCache&&this.snapshotCache.key===key)return structuredClone(this.snapshotCache.value);
    const events=this.db.prepare('SELECT event_json FROM library_records').all().map(row=>JSON.parse(row.event_json));
    const clears=new Map(events.filter(event=>event.op==='clear').map(event=>[event.kind,event]));
    const active=events.filter(event=>event.op==='set'&&(!clears.has(event.kind)||compareEvents(event,clears.get(event.kind))>0)).sort((a,b)=>compareEvents(b,a));
    const result={favorites:active.filter(e=>e.kind==='favorite').map(e=>({...e.value,updatedAt:e.at})),
      history:active.filter(e=>e.kind==='history').map(e=>({...e.value,updatedAt:e.at})),
      recommendationSignals:active.filter(e=>e.kind==='recommendation').map(e=>({...e.value,sessionId:e.key.split(':')[0],updatedAt:e.at})),
      searchHistory:active.filter(e=>e.kind==='search').slice(0,10).map(e=>e.value.query),
      preferences:Object.fromEntries([['quality','1080P'],['speed',1],['recommendationMode','mixed'],['recommendationResetAt',0],...active.filter(e=>e.kind==='preference').map(e=>[e.key,e.value.value])])};
    this.snapshotCache={key,value:structuredClone(result)};
    return result;
  }
  pending(target,limit=256){const cursor=this.getMeta(`ackCursor:${target}`)||0;return this.db.prepare('SELECT event_json FROM library_events WHERE is_local=1 AND revision>? AND id NOT IN(SELECT event_id FROM library_ack WHERE target=?) ORDER BY revision LIMIT ?').all(cursor,target,limit).map(row=>JSON.parse(row.event_json));}
  acknowledge(target,ids){this.transaction(()=>{
    const statement=this.db.prepare('INSERT OR IGNORE INTO library_ack VALUES(?,?)');
    for(const id of ids)statement.run(target,id);
    let cursor=this.getMeta(`ackCursor:${target}`)||0;const previous=cursor;
    const walk=this.db.prepare('SELECT e.revision AS revision,a.event_id IS NOT NULL AS acked FROM library_events e LEFT JOIN library_ack a ON a.target=? AND a.event_id=e.id WHERE e.is_local=1 AND e.revision>? ORDER BY e.revision LIMIT 128');
    for(;;){const rows=walk.all(target,cursor);if(!rows.length)break;let advanced=0;for(const row of rows){if(!row.acked)break;cursor=row.revision;advanced++;}if(advanced<rows.length)break;}
    if(cursor!==previous){
      this.db.prepare('DELETE FROM library_ack WHERE target=? AND event_id IN(SELECT id FROM library_events WHERE revision>? AND revision<=?)').run(target,previous,cursor);
      this.setMeta(`ackCursor:${target}`,cursor);
    }
  });}
  changes(cursor=0,limit=256){number(cursor,'cursor');number(limit,'limit',1,256);const rows=this.db.prepare('SELECT revision,event_json FROM library_events WHERE revision>? ORDER BY revision LIMIT ?').all(cursor,limit+1);return{events:rows.slice(0,limit).map(row=>({revision:row.revision,...JSON.parse(row.event_json)})),cursor:rows.length?rows[Math.min(rows.length,limit)-1].revision:cursor,hasMore:rows.length>limit};}
  seedTarget(target){if(this.getMeta(`seed:${target}`))return;this.transaction(()=>{
    for(const row of this.db.prepare('SELECT event_json FROM library_records').all()){
      const event=JSON.parse(row.event_json);
      this.db.prepare('UPDATE library_events SET is_local=1 WHERE id=?').run(event.id);
    }
    this.setMeta(`seed:${target}`,true);
  });}
}
