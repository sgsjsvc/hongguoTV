import fs from 'node:fs';import path from 'node:path';import { createHash } from 'node:crypto';
import { LibraryStore } from '../shared/library-store.mjs';import { HistoryStore } from '../custom-server/history-store.mjs';
const get=name=>process.argv[process.argv.indexOf(name)+1];const source=get('--from'),destination=get('--to');
if(!process.argv.includes('--from')||!process.argv.includes('--to')||!source||!destination)throw Error('usage: node scripts/migrate-library.mjs --from <old data directory> --to <new data directory>');
const oldDirectory=path.resolve(source),newDirectory=path.resolve(destination);if(oldDirectory===newDirectory)throw Error('source and destination must differ');
const store=new LibraryStore(path.join(newDirectory,'library.sqlite'));const marker='import-directory:'+createHash('sha256').update(oldDirectory).digest('hex');
try{
 if(!store.getMeta(marker)){
  const libraryFile=path.join(oldDirectory,'library.sqlite');
  if(fs.existsSync(libraryFile)){const old=new LibraryStore(libraryFile);try{const events=old.db.prepare('SELECT event_json FROM library_records').all().map(row=>JSON.parse(row.event_json));for(let i=0;i<events.length;i+=256)store.receive(events.slice(i,i+256),{canonical:true});}finally{old.close();}}
  else if(fs.existsSync(path.join(oldDirectory,'history.sqlite'))){const old=new HistoryStore(path.join(oldDirectory,'history.sqlite'));try{for(const item of old.list())store.write({id:'legacy-directory:'+item.seriesId,kind:'history',key:item.seriesId,op:'set',at:item.updatedAt,value:item});}finally{old.close();}}
  else throw Error('source has no supported library/history database');
  store.setMeta(marker,true);
 }
 console.log(`迁移完成：收藏 ${store.snapshot().favorites.length}，历史 ${store.snapshot().history.length}；源数据保留。`);
}finally{store.close();}
