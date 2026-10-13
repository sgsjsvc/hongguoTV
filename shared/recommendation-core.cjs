/* Shared by Node and API 22 QuickJS. No network, platform APIs or mutable global profile. */
(function(root) {
  const TYPES = ['real-drama', 'comic-drama', 'ai-drama'];
  const BASE = [.5, .3, .2];
  const DAY = 86400000;
  const tagsOf = value => String(value || '').split(/[\/·,，#\s]+/).map(t=>t.trim()).filter(t=>t && t!=='短剧');
  function hash(value) { let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967296; }
  const countEpisodes = row => Number(String(row.badge||'').match(/全\s*(\d+)\s*集/)?.[1] || row.episodeCount || 0);
  class RecommendationSession {
    constructor({seed='default', now=Date.now(), mode='mixed', profile={}}={}) {
      this.seed=String(seed); this.now=now; this.mode=TYPES.includes(mode)?mode:'mixed';
      this.emitted=new Set(); this.recent=new Map(); this.completed=new Set(); this.interests=new Map();
      this.typeInterests=Object.fromEntries(TYPES.map(type=>[type,0]));
      const reset=Number(profile.preferences?.recommendationResetAt)||0;
      const add=(row,weight)=>{
        if(Number(row.updatedAt||0)<reset)return;
        tagsOf(row.tags).forEach(tag=>this.interests.set(tag,(this.interests.get(tag)||0)+weight));
        if(TYPES.includes(row.contentType))this.typeInterests[row.contentType]+=weight;
      };
      (profile.history||[]).forEach(row=>{
        const id=String(row.seriesId||row.id||'');
        if(Number(row.positionMs)>0 || row.completed)this.recent.set(id,Number(row.updatedAt)||0);
        const total=countEpisodes(row);
        if(row.completed && total>0 && Number(row.episodeNumber)>=total)this.completed.add(id);
        if(Number(row.positionMs)>=30000)add(row,1);
      });
      (profile.favorites||[]).forEach(row=>add(row,4));
      (profile.recommendationSignals||[]).forEach(row=>{
        const id=String(row.seriesId||'');
        if(Number(row.watchMs)>0)this.recent.set(id,Math.max(this.recent.get(id)||0,Number(row.updatedAt)||0));
        if(row.completed)this.completed.add(id);
        if(Number(row.updatedAt||0)<reset)return;
        const watched=Number(row.watchMs)||0;
        add(row,(watched>=30000?Math.min(4,watched/60000):0)+(row.completed?4:0)-Math.min(3,Number(row.skips)||0)*1.5);
      });
      // Keep each type at >= 10% in mixed mode; no preference can eliminate exploration.
      const adjusted=TYPES.map((type,i)=>BASE[i]*Math.exp(Math.max(-1,Math.min(1,this.typeInterests[type]/12))));
      const sum=adjusted.reduce((a,b)=>a+b,0);
      this.weights=Object.fromEntries(TYPES.map((type,i)=>[type,.1+.7*adjusted[i]/sum]));
      if(TYPES.every(type=>this.typeInterests[type]===0))this.weights=Object.fromEntries(TYPES.map((type,i)=>[type,BASE[i]]));
    }
    get size(){return this.emitted.size;}
    score(row) {
      const interest=tagsOf(row.tags).reduce((sum,tag)=>sum+Math.max(-4,Math.min(6,this.interests.get(tag)||0)),0);
      const last=this.recent.get(String(row.id));
      const recent=last!==undefined && this.now-last<7*DAY && this.now-last>=-300000;
      return interest*2 + hash(`${this.seed}|${row.id}`)*4 - (recent?100:0);
    }
    append(candidates,limit=24) {
      const unique=new Map();
      for(const row of candidates||[]){
        if(!row || typeof row.id!=='string' || !row.id || !row.title || !TYPES.includes(row.contentType))continue;
        if(this.emitted.has(row.id)||this.completed.has(row.id)||this.mode!=='mixed'&&row.contentType!==this.mode)continue;
        if(!unique.has(row.id))unique.set(row.id,row);
      }
      const pool=[...unique.values()].sort((a,b)=>this.score(b)-this.score(a)||a.id.localeCompare(b.id));
      const result=[];const selected=new Set();const counts=Object.fromEntries(TYPES.map(t=>[t,0]));
      const desired=Object.fromEntries(TYPES.map(t=>[t,this.mode==='mixed'?limit*this.weights[t]:t===this.mode?limit:0]));
      const add=row=>{result.push(row);selected.add(row.id);counts[row.contentType]++;};
      const exploration = row => {
        const last=this.recent.get(row.id);
        if(last!==undefined && this.now-last<7*DAY)return false;
        return row.source==='latest'||row.source==='discovery'||tagsOf(row.tags).every(tag=>(this.interests.get(tag)||0)<=0);
      };
      // Reserve 20% for unseen or unfamiliar candidates while respecting the same type quotas.
      for(let slot=0;slot<Math.ceil(limit*.2);slot++) {
        const available=pool.filter(row=>!selected.has(row.id)&&exploration(row));
        if(!available.length)break;
        const type=TYPES.filter(t=>available.some(r=>r.contentType===t)).sort((a,b)=>(desired[b]-counts[b])-(desired[a]-counts[a]))[0];
        const marked=available.filter(r=>r.contentType===type&&['latest','discovery'].includes(r.source));
        add((marked.length?marked:available.filter(r=>r.contentType===type))[0]);
      }
      while(result.length<limit) {
        const available=pool.filter(row=>!selected.has(row.id));if(!available.length)break;
        const type=TYPES.filter(t=>available.some(r=>r.contentType===t)).sort((a,b)=>(desired[b]-counts[b])-(desired[a]-counts[a]))[0];
        add(available.find(row=>row.contentType===type));
      }
      // Spread types through the feed instead of grouping all exploration at the start.
      result.sort((a,b)=>hash(`${this.seed}|${this.size}|order|${a.id}`)-hash(`${this.seed}|${this.size}|order|${b.id}`));
      result.forEach(row=>this.emitted.add(row.id));return result;
    }
  }
  root.RecommendationSession=RecommendationSession;
  if(typeof module!=='undefined'&&module.exports)module.exports={RecommendationSession,TYPES};
})(globalThis);
