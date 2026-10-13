export function legacyOperations(storage) {
  const read=key=>{try{return JSON.parse(storage[key]||'null');}catch{return null;}};
  const operations=[];
  for(const item of read('hg_favorites_v1')||[])if(item?.id&&item.title)operations.push({kind:'favorite',key:String(item.id),op:'set',at:item.updatedAt||0,value:{...item,id:String(item.id)}});
  for(const [id,item] of Object.entries(read('hg_progress_v1')||{}))if(item?.title&&item.episodeId)operations.push({kind:'history',key:String(item.seriesId||id),op:'set',at:item.updatedAt||0,value:{...item,seriesId:String(item.seriesId||id),episodeId:String(item.episodeId),episodeNumber:item.episodeNumber||1,positionMs:Math.max(0,Math.round((item.position||0)*1000)),durationMs:Math.max(0,Math.round((item.duration||0)*1000)),completed:!!item.completed}});
  for(const query of read('hg_search_history_v1')||[])if(typeof query==='string'&&query.trim())operations.push({kind:'search',key:query.trim().toLowerCase(),op:'set',at:0,value:{query:query.trim()}});
  if(storage.hg_pref_quality)operations.push({kind:'preference',key:'quality',op:'set',at:0,value:{value:storage.hg_pref_quality}});
  const speed=Number(storage.hg_playback_speed);if(speed>=.25&&speed<=4)operations.push({kind:'preference',key:'speed',op:'set',at:0,value:{value:speed}});
  for(const key of Object.keys(storage).filter(key=>key.startsWith('hg_history_outbox_v1:')).sort()){
    const parsed=read(key);const pending=parsed?.session&&parsed?.progress?[parsed]:(parsed?.operations||[]);
    for(const item of pending){const progress=item.progress,metadata=item.session?.series;if(progress?.episodeId&&metadata?.id&&metadata.title)operations.push({kind:'history',key:String(metadata.id),op:'set',at:progress.observedAt||item.session.startedAt||0,value:{...metadata,...progress,seriesId:String(metadata.id),episodeId:String(progress.episodeId)}});}
  }
  return operations;
}
