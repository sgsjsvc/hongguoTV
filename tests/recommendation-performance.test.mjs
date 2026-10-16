import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {RecommendationSession}=require('../shared/recommendation-core.cjs');
const types=['real-drama','comic-drama','ai-drama'];
const rows=Array.from({length:1000},(_,i)=>({id:String(i),title:'剧'+i,tags:i%2?'爱情/都市':'玄幻/奇幻',contentType:types[i%3],source:i%5?'hot':'discovery'}));

test('append scores each eligible unique candidate once, without mutating rows',()=>{
 const s=new RecommendationSession({seed:'cost',now:10000000});
 let calls=0;const original=s.score;
 s.score=function(row){calls++;return original.call(this,row);};
 const frozen=rows.map(row=>Object.freeze({...row}));
 const selected=s.append([...frozen,...frozen],24);
 assert.equal(selected.length,24);
 assert.equal(calls,1000,'sorting must reuse scores instead of recomputing them in comparisons');
 calls=0;s.append(frozen,24);assert.equal(calls,976);
});

// Retain the pre-B7 append algorithm as an independent semantic oracle.
function legacyAppend(candidates,limit=24){
 const unique=new Map();
 for(const row of candidates||[]){
  if(!row||typeof row.id!=='string'||!row.id||!row.title||!types.includes(row.contentType))continue;
  if(this.emitted.has(row.id)||this.completed.has(row.id)||this.mode!=='mixed'&&row.contentType!==this.mode)continue;
  if(!unique.has(row.id))unique.set(row.id,row);
 }
 const pool=[...unique.values()].sort((a,b)=>this.score(b)-this.score(a)||a.id.localeCompare(b.id));
 const result=[],selected=new Set(),counts=Object.fromEntries(types.map(t=>[t,0]));
 const desired=Object.fromEntries(types.map(t=>[t,this.mode==='mixed'?limit*this.weights[t]:t===this.mode?limit:0]));
 const add=row=>{result.push(row);selected.add(row.id);counts[row.contentType]++;};
 const exploration=row=>{
  const last=this.recent.get(row.id);
  if(last!==undefined&&this.now-last<7*86400000)return false;
  return row.source==='latest'||row.source==='discovery'||String(row.tags||'').split(/[\/·,，#\s]+/).map(t=>t.trim()).filter(t=>t&&t!=='短剧').every(tag=>(this.interests.get(tag)||0)<=0);
 };
 for(let slot=0;slot<Math.ceil(limit*.2);slot++){
  const available=pool.filter(row=>!selected.has(row.id)&&exploration(row));if(!available.length)break;
  const type=types.filter(t=>available.some(r=>r.contentType===t)).sort((a,b)=>(desired[b]-counts[b])-(desired[a]-counts[a]))[0];
  const marked=available.filter(r=>r.contentType===type&&['latest','discovery'].includes(r.source));
  add((marked.length?marked:available.filter(r=>r.contentType===type))[0]);
 }
 while(result.length<limit){
  const available=pool.filter(row=>!selected.has(row.id));if(!available.length)break;
  const type=types.filter(t=>available.some(r=>r.contentType===t)).sort((a,b)=>(desired[b]-counts[b])-(desired[a]-counts[a]))[0];
  add(available.find(row=>row.contentType===type));
 }
 const hash=value=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;};
 result.sort((a,b)=>hash(`${this.seed}|${this.size}|order|${a.id}`)-hash(`${this.seed}|${this.size}|order|${b.id}`));
 result.forEach(row=>this.emitted.add(row.id));return result;
}

test('optimized append preserves exact seeded order, quotas, exploration and pagination',()=>{
 for(let i=0;i<60;i++){
  const options={seed:'parity-'+i,now:10000000,mode:[undefined,...types][i%4],profile:{favorites:[{tags:'爱情',contentType:types[i%3]}],history:[{seriesId:String(i),positionMs:30000,updatedAt:9999999}],recommendationSignals:[{seriesId:String(i+1),completed:true,watchMs:60000,updatedAt:9999999}]}};
  const old=new RecommendationSession(options),next=new RecommendationSession(options);
  const source=rows.filter((_,n)=>i%3||n%3===0);
  const input=[null,{id:12,title:'invalid',contentType:'real-drama'},...source,...source.slice(0,12),{id:'bad',contentType:'unknown',title:'invalid'}];
  for(let page=0;page<3;page++){
   const limit=[0,1,24,50,2000][i%5];
   assert.deepEqual(next.append(input,limit),legacyAppend.call(old,input,limit),'seed '+i+' page '+page);
   assert.deepEqual([...next.emitted],[...old.emitted]);
  }
 }
});
