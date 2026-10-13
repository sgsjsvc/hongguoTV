import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {RecommendationSession}=require('../shared/recommendation-core.cjs');
const types=['real-drama','comic-drama','ai-drama'];
const candidates=types.flatMap(contentType=>Array.from({length:60},(_,i)=>({id:`${contentType}-${i}`,title:`剧${i}`,tags:i%2?'爱情/都市':'玄幻/奇幻',contentType,source:i>=45?'latest':'hot',badge:'全2集'})));
test('mixed cold start balances types, reserves exploration and changes with seed',()=>{
 const a=new RecommendationSession({seed:'a',now:10000000});const b=new RecommendationSession({seed:'b',now:10000000});
 const first=a.append(candidates,24);
 assert.deepEqual(types.map(t=>first.filter(c=>c.contentType===t).length),[12,7,5]);
 assert.ok(first.filter(c=>c.source==='latest').length>=5);
 assert.notDeepEqual(first.map(c=>c.id),b.append(candidates,24).map(c=>c.id));
 assert.equal(a.append(candidates,24).filter(c=>first.some(f=>f.id===c.id)).length,0);
 assert.equal(a.size,48);
});
test('recent history is downranked, fully watched series excluded; exposure alone is harmless',()=>{
 const selected=candidates[0];const done=candidates[1];
 const s=new RecommendationSession({seed:'a',now:10000000,profile:{history:[{seriesId:selected.id,updatedAt:9999990,episodeNumber:1,positionMs:50000},{seriesId:done.id,badge:'全2集',episodeNumber:2,completed:true,updatedAt:9999990}],recommendationSignals:[{seriesId:candidates[2].id,exposures:1,watchMs:0,skips:0,updatedAt:9999990}]}});
 const first=s.append(candidates,24);
 assert.ok(!first.some(c=>c.id===selected.id));
 assert.ok(!s.append(candidates,200).some(c=>c.id===done.id));
});
test('single mode, unavailable types, duplicates and preference reset remain safe',()=>{
 const only=new RecommendationSession({mode:'comic-drama',seed:'x'});
 assert.ok(only.append([...candidates,...candidates],24).every(c=>c.contentType==='comic-drama'));
 const mixed=new RecommendationSession({seed:'x'});assert.equal(mixed.append(candidates.filter(c=>c.contentType==='ai-drama'),24).length,24);
 const reset=new RecommendationSession({seed:'x',now:10000000,profile:{preferences:{recommendationResetAt:9999999},recommendationSignals:[{seriesId:'old',tags:'爱情',contentType:'comic-drama',watchMs:999999,completed:true,updatedAt:1000}]}});
 assert.deepEqual(reset.weights,{ 'real-drama':.5,'comic-drama':.3,'ai-drama':.2 });
});
test('strong positive and repeated skip signals adjust bounded type weights',()=>{
 const s=new RecommendationSession({seed:'x',now:10000000,profile:{recommendationSignals:[{seriesId:'yes',tags:'玄幻',contentType:'comic-drama',watchMs:200000,updatedAt:9999999},{seriesId:'no',tags:'爱情',contentType:'real-drama',watchMs:1000,skips:3,updatedAt:9999999}]}});
 assert.ok(s.weights['comic-drama']>.3);assert.ok(s.weights['real-drama']<.5);
 types.forEach(t=>assert.ok(s.weights[t]>=.1));
});
