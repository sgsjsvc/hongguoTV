function localSeries(card){return {id:String(card.url||card.vod_id||''),title:String(card.title||card.vod_name||''),cover:card.img||card.vod_pic||'',description:card.content||card.vod_content||'',badge:card.desc||card.vod_remarks||'',tags:card.tname||card.type_name||'',contentType:card.contentType||''};}
const localRecommendationSessions=new Map();
async function localCategoryMetadata(type='real-drama'){
  if(!['real-drama','comic-drama','ai-drama'].includes(type))throw Error('不支持的内容类型');
  const data=await routerData(`${SITE}/category/${type}`);
  const {types,tags,sourceUrl}=officialCategory(data,type);
  return {types,type,tags,sourceUrl};
}
function recommendationSources(state,page){
  const preferences=state.profile.preferences||{};
  const types=preferences.recommendationMode&&preferences.recommendationMode!=='mixed'?[preferences.recommendationMode]:['real-drama','comic-drama','ai-drama'];
  const interests=[...(state.profile.favorites||[]),...(state.profile.history||[])].filter(row=>Number(row.updatedAt||0)>=Number(preferences.recommendationResetAt||0));
  const depth=2+Math.abs([...state.id].reduce((n,c)=>n+c.charCodeAt(0),0))%5;
  const sources=[];
  for(const contentType of types){
    const topic=(state.tagsByType[contentType]||[]).find(tag=>interests.some(item=>String(item.tags||'').includes(tag.name)));
    sources.push({contentType,source:'hot',page,tag:'',url:`${SITE}/category/${contentType}${page>1?'?page='+page:''}`});
    sources.push({contentType,source:'discovery',page:depth+page-1,tag:'',url:`${SITE}/category/${contentType}?page=${depth+page-1}`});
    if(topic&&page>1)sources.push({contentType,source:'topic',page,tag:topic.id,url:`${SITE}/category/${contentType}/${topic.id}${page>1?'?page='+page:''}`});
  }
  return sources;
}
async function localRecommend(p){
  const id=String(p.session||'default'),page=Math.max(1,Number.parseInt(p.page,10)||1);
  if(page>100)throw Error('推荐会话已结束，请刷新推荐');
  let state=localRecommendationSessions.get(id);
  if(!state){
    const profile=native('recommendationProfile',{}),now=Number(profile.serverTime)||Date.now();
    state={id,profile,tagsByType:{},time:Date.now(),round:0,pages:[],pool:[],emitted:new Set(),ranker:new RecommendationSession({seed:id,now,mode:profile.preferences?.recommendationMode||'mixed',profile})};
    localRecommendationSessions.set(id,state);
    for(const [key,item]of localRecommendationSessions)if(key!==id&&(Date.now()-item.time>1800000||localRecommendationSessions.size>8))localRecommendationSessions.delete(key);
  }
  while(state.pages.length<page){
    const next=state.pages.length+1;
    let selected=[];
    for(let attempt=0;attempt<3&&!selected.length;attempt++){
    const fetched=native('recommendationCandidates',{session:id,sources:recommendationSources(state,++state.round)});
    const groups=[];
    for(const row of fetched.rows||[]){
      try{
        const data=extractAssignedJson(row.html),catalog=officialCategory(data,row.contentType,row.tag||'',row.page||1);
        const items=catalog.rows;state.tagsByType[row.contentType]=catalog.tags;
        groups.push(items.map(itemToCard).map(localSeries).filter(item=>item.id&&item.title).map(item=>({...item,contentType:row.contentType,source:row.source})));
      }catch(error){/* Keep all healthy pools if one official route fails. */}
    }
    // Round-robin arrival groups prevent source order from filling a whole page with one type.
    for(let index=0;groups.some(group=>index<group.length);index++)for(const group of groups)if(group[index])state.pool.push(group[index]);
    state.pool=[...new Map(state.pool.filter(item=>!state.emitted.has(item.id)).map(item=>[item.id,item])).values()].slice(-512);
    selected=state.ranker.append(state.pool,24);
    if(!selected.length&&fetched.pending)throw Error('推荐源仍在加载，请重试');
    selected.forEach(item=>state.emitted.add(item.id));state.pool=state.pool.filter(item=>!state.emitted.has(item.id));
    if(!selected.length&&groups.length===0)throw Error('推荐源暂不可用，请检查网络后重试');
    }
    state.pages.push({items:selected,page:next,session:id});
  }
  return state.pages[page-1];
}
async function localContent(path,p={}) {
  for(const cache of [streamCache,videoInfoCache]){for(const [key,item]of cache)if(Date.now()-item.time>300000)cache.delete(key);while(cache.size>24)cache.delete(cache.keys().next().value);}
  if(path==='/health')return {ok:true,service:'hongguotv-custom-bridge',version:'standalone-tv'};
  if(path==='/api/recommend')return localRecommend(p);
  if(path==='/api/search')return {items:(await rule.搜索(p.q,false,Number(p.page||1))).map(localSeries)};
  if(path==='/api/category/tags')return localCategoryMetadata(p.type||'real-drama');
  if(path==='/api/category/list'){
    const type=({human:'real-drama',comic:'comic-drama',ai:'ai-drama'})[p.type]||p.type||'real-drama';
    if(!['real-drama','comic-drama','ai-drama'].includes(type))throw Error('不支持的内容类型');
    const metadata=await localCategoryMetadata(type);
    if(p.tag&&!metadata.tags.some(tag=>tag.id===p.tag))throw Error('不支持的题材');
    const page=Number(p.page||1);
    const data=await routerData(`${SITE}/category/${type}${p.tag?'/'+p.tag:''}${page>1?'?page='+page:''}`);
    const {rows,...catalog}=officialCategory(data,type,p.tag||'',page);
    return {...catalog,items:rows.map(itemToCard).map(localSeries).map(item=>({...item,contentType:type}))};
  }
  if(path==='/api/rank/types')return {types:Object.entries(CATEGORY_CONFIG).filter(([id,v])=>v.kind==='rank').map(([id,v])=>({id,name:v.type_name}))};
  if(path==='/api/rank/list')return {items:(await rule.一级(({all:'rank_hot',real:'rank_human',comic:'rank_comic',ai:'rank_ai'})[p.type]||p.type||'rank_hot',Number(p.page||1),false,{})).map(localSeries)};
  const detail=path.match(/^\/api\/series\/([^/]+)$/);
  if(detail){const data=await rule.二级.call({orId:decodeURIComponent(detail[1])});if(!data.vod_play_url)throw Error('暂无可播放分集');const episodes=data.vod_play_url.split('$$$')[0].split('#').map((e,i)=>({id:e.split('$')[1].split('|')[0],number:i+1,title:e.split('$')[0]}));return {...localSeries(data),episodes};}
  if(/^\/api\/series\/[^/]+\/related$/.test(path))return {items:(await rule.一级('short',Number(p.page||1),false,{})).map(localSeries)};
  const quality=path.match(/^\/api\/episodes\/([^/]+)\/qualities$/);
  if(quality){const info=await fetchVideoInfo(quality[1]);const seen=new Set();return {qualities:info.rows.filter(row=>row.item.codec_type!=='bytevc2').map(row=>({key:qualityNumber(row.quality)?`${qualityNumber(row.quality)}P`:row.key.toUpperCase(),label:qualityLabel(row.quality),qualityNum:qualityNumber(row.quality),codec:row.item.codec_type==='bytevc1'?'HEVC':row.item.codec_type||'H.264'})).filter(row=>{if(seen.has(row.key))return false;seen.add(row.key);return true;})};}
  const stream=path.match(/^\/api\/episodes\/([^/]+)\/stream$/);
  if(stream){
    const info=await fetchVideoInfo(stream[1]),selected=info.rows.find(row=>row.item.codec_type!=='bytevc2'&&(row.key===p.quality||qualityLabel(row.quality)===p.quality))||info.rows.find(row=>row.item.codec_type!=='bytevc2');if(!selected)throw Error('没有可解码的画质');
    const resolved=await resolveStream(stream[1],selected.key);
    if(!resolved.nativePrepared||!native('hasStream',{token:resolved.nativePrepared.token}).exists)resolved.nativePrepared=native('prepareStream',{url:resolved.url,key:resolved.key?resolved.key.toString('base64'):''});
    const prepared=resolved.nativePrepared,requested=parseRangeHeader(p.range||'',prepared.total);if(requested==='invalid')return {status:416,type:'text/plain',data:'Invalid Range',headers:{},binary:false};
    const start=requested?requested[0]:0,end=Math.min(requested?requested[1]:prepared.total-1,start+SEG_SIZE-1,prepared.total-1);
    return {status:206,type:'video/mp4',nativeToken:prepared.token,start,end,headers:{'Content-Range':`bytes ${start}-${end}/${prepared.total}`,'Accept-Ranges':'bytes'},binary:true};
  }
  throw Error('Unknown local content route '+path);
}
