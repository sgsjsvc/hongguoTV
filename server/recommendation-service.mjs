import crypto from 'node:crypto';
import core from '../shared/recommendation-core.cjs';
const {RecommendationSession,TYPES}=core;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class RecommendationError extends Error {constructor(status,message){super(message);this.status=status;}}

/** Each browser/desktop has a private cursor. Candidates are shared only through source caches. */
export class RecommendationService {
  constructor({fetchPool,readProfile,now=Date.now,settleMs=2500,topics=[]}) {
    this.fetchPool=fetchPool;this.readProfile=readProfile;this.now=now;this.settleMs=settleMs;this.topics=topics;this.sessions=new Map();
  }
  async page(id,page=1) {
    if(typeof id!=='string'||!/^[-_A-Za-z0-9]{16,128}$/.test(id))throw new RecommendationError(400,'invalid recommendation session');
    if(!Number.isSafeInteger(page)||page<1||page>100)throw new RecommendationError(400,'invalid recommendation page');
    const now=this.now();
    for(const [key,state] of this.sessions)if(now-state.lastAccess>1800000)this.sessions.delete(key);
    let state=this.sessions.get(id);
    if(!state){
      if(page!==1)throw new RecommendationError(409,'推荐会话已过期，请刷新推荐');
      if(this.sessions.size>=64)throw new RecommendationError(503,'推荐会话繁忙，请稍后重试');
      const profile=this.readProfile();
      state={rank:new RecommendationSession({seed:id,now,mode:profile.preferences?.recommendationMode,profile}),pool:new Map(),pages:new Map(),round:0,lastAccess:now,chain:Promise.resolve(),pending:new Set(),topic:this.topic(profile)};
      this.sessions.set(id,state);
    }
    state.lastAccess=now;
    const operation=state.chain.then(async()=>{
      if(state.pages.has(page))return state.pages.get(page);
      if(page!==state.pages.size+1)throw new RecommendationError(409,'请按顺序加载推荐分页');
      let items=[];
      for(let attempt=0;attempt<3&&!items.length;attempt++){
        const available=[...state.pool.values()].filter(row=>!state.rank.emitted.has(row.id)&&!state.rank.completed.has(row.id));
        if(available.length<24) {
          try {await this.loadRound(state,id);}
          catch(error) {if(!available.length)throw error;}
        }
        items=state.rank.append([...state.pool.values()],24);
      }
      const result={items,page,session:id};state.pages.set(page,result);
      // Bound metadata; selections remain in the page cache and emitted set.
      items.forEach(row=>state.pool.delete(row.id));
      return result;
    });
    state.chain=operation.catch(()=>{});return operation;
  }
  topic(profile) {
    const reset=profile.preferences?.recommendationResetAt||0;
    const rows=[...(profile.favorites||[]),...(profile.recommendationSignals||[]).filter(row=>row.watchMs>=30000)];
    const scores=this.topics.map(tag=>({id:tag.id,score:rows.filter(row=>(row.updatedAt||0)>=reset&&String(row.tags||'').includes(tag.name)).length}));
    return scores.sort((a,b)=>b.score-a.score)[0]?.score>0?scores[0].id:'';
  }
  async loadRound(state,id) {
    const round=state.round++;
    const types=state.rank.mode==='mixed'?TYPES:[state.rank.mode];
    const offset=crypto.createHash('sha256').update(id).digest()[0]%7+2;
    const jobs=[];
    for(const type of types){
      const requests=[{type,page:round+1,source:'hot',tag:''},{type,page:offset+round,source:'discovery',tag:''}];
      if(state.topic)requests.push({type,page:round+1,source:'topic',tag:state.topic});
      for(const query of requests){
        const job=Promise.resolve().then(()=>this.fetchPool(query)).then(rows=>{
          if(!Array.isArray(rows))throw Error('Invalid recommendation source');
          for(const row of rows){if(typeof row.id==='string' && !state.rank.emitted.has(row.id) && !state.rank.completed.has(row.id)){
            const existing=state.pool.get(row.id);
            // Hot duplicates do not erase discovery/topic provenance.
            if(!existing || existing.source==='hot')state.pool.set(row.id,{...row,contentType:type,source:query.source});
          }}
          while(state.pool.size>512)state.pool.delete(state.pool.keys().next().value);
        });
        state.pending.add(job);job.then(()=>state.pending.delete(job),()=>state.pending.delete(job));jobs.push(job);
      }
    }
    try {await Promise.any([...state.pending]);}
    catch {throw new RecommendationError(502,'推荐内容源暂不可用，请重试');}
    // First available content need not wait for a stalled source. Usually all types settle here.
    await Promise.race([Promise.allSettled([...state.pending]),delay(this.settleMs)]);
  }
}
