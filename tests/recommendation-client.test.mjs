import test from 'node:test';
import assert from 'node:assert/strict';
import { RecommendationSession, RecommendationWatch, bindRecommendationPlayback } from '../apps/web-pc/src/recommendation-session.mjs';
test('local or synchronized mode and reset changes require a new metadata session after return',async()=>{
 const feed=new RecommendationSession(async(_,session)=>({items:[{id:'a'}],session}),()=> 'session');
 const original={recommendationMode:'mixed',recommendationResetAt:0};
 await feed.start(original);feed.cancel();
 assert.equal(feed.needsRestart(original),false);
 assert.equal(feed.needsRestart({...original,recommendationMode:'ai-drama'}),true);
 assert.equal(feed.needsRestart({...original,recommendationResetAt:1000}),true);
 await feed.start({...original,recommendationMode:'ai-drama'});
 assert.equal(feed.needsRestart({...original,recommendationMode:'ai-drama'}),false);
});
test('prefetch deduplicates without selecting, previous keeps session order, retry retains session', async()=>{
 const requests=[],selected=[];let fail=true;
 const feed=new RecommendationSession(async(page,session)=>{requests.push({page,session});if(page===2&&fail){fail=false;throw Error('offline');}return {items:page===1?[{id:'a'},{id:'b'}]:[{id:'b'},{id:'c'}],page,session};},()=> 'session',()=>{},s=>selected.push(s.id));
 await feed.start();assert.deepEqual(selected,['a']);
 await assert.rejects(feed.load(2));await feed.load(2);
 assert.deepEqual(feed.items.map(s=>s.id),['a','b','c']);assert.deepEqual(selected,['a']);
 await feed.advance('next');await feed.advance('prev');assert.deepEqual(selected,['a','b','a']);
 assert.deepEqual(requests.map(r=>r.session),['session','session','session']);
});
test('new session isolates old responses and tail request cannot override later previous selection',async()=>{
 let resolveOld;let count=0;
 const feed=new RecommendationSession(async(page,session)=>{if(session==='old')return new Promise(r=>resolveOld=r);return {items:[{id:'new'}],page,session};},()=>++count===1?'old':'new');
 const old=feed.start();await feed.start();resolveOld({items:[{id:'old'}],page:1,session:'old'});await old;assert.equal(feed.items[0].id,'new');
});
test('watch records actual walltime; pause, seek, background and errors add no time or skips',()=>{
 let now=0;const events=[];const watch=new RecommendationWatch((key,value)=>events.push({key,value}),()=>now);
 watch.begin('session',{id:'s',title:'S',tags:'甜宠',contentType:'real-drama'});
 watch.playing();now=4000;watch.pause();now=30000;watch.tick();assert.equal(events.at(-1).value.watchMs,4000);
 watch.playing();now=32000;watch.pause();now=90000;watch.tick();assert.equal(events.at(-1).value.watchMs,6000);
 watch.leave('prev');assert.equal(events.at(-1).value.skips,0);
 watch.begin('session',{id:'s',title:'S',contentType:'real-drama'});watch.playing();now=92000;watch.leave('next');
 assert.equal(events.at(-1).value.watchMs,8000);assert.equal(events.at(-1).value.skips,1);assert.equal(events.at(-1).value.exposures,2);
});
test('ten-second cumulative signal and full-series completion distinguish exposures from watching',()=>{
 let now=0;const events=[];const watch=new RecommendationWatch((_,v)=>events.push(v),()=>now);
 watch.begin('s',{id:'a',title:'A',contentType:'comic-drama'});assert.equal(events.at(-1).watchMs,0);
 watch.leave('next');assert.equal(events.at(-1).skips,0);
 watch.begin('s',{id:'b',title:'B',contentType:'ai-drama'});watch.playing();now=12000;watch.tick();assert.equal(events.at(-1).watchMs,12000);
 watch.complete();watch.leave('next');assert.equal(events.at(-1).completed,true);assert.equal(events.at(-1).skips,0);
});
test('pending tail selection cannot override an explicit previous selection', async()=>{
 let release;const selected=[];
 const feed=new RecommendationSession(async(page,session)=>page===1?{items:[{id:'a'},{id:'b'}],session}:new Promise(r=>release=()=>r({items:[{id:'c'}],session})),()=> 's',()=>{},s=>selected.push(s.id));
 await feed.start();await feed.advance('next');const next=feed.advance('next');
 await feed.advance('prev');release();assert.equal(await next,false);assert.equal(feed.index,0);assert.equal(selected.at(-1),'a');
});
test('watch reset discards old cumulative counters without restamping them',()=>{
 let now=0;const events=[];const watch=new RecommendationWatch((key,value)=>events.push({key,value}),()=>now);
 const series={id:'a',title:'A',contentType:'comic-drama'};
 watch.begin('old',series);watch.playing();now=4000;watch.tick();const before=events.length;
 watch.discard();assert.equal(events.length,before);watch.begin('new',series);watch.playing();now=7000;watch.pause();
 assert.equal(events.at(-1).key,'new:a');assert.equal(events.at(-1).value.watchMs,3000);
 watch.pause();watch.tick();assert.equal(events.at(-1).value.watchMs,3000);
 const pausedCount=events.length;watch.pause();assert.equal(events.length,pausedCount);
});
test('actual media bindings exclude seek, hidden and error time even with readyState still playable',()=>{
 let now=0,tick;const values=[];const watch=new RecommendationWatch((_,v)=>values.push(v),()=>now);
 const video=Object.assign(new EventTarget(),{paused:false,ended:false,seeking:false,readyState:4});
 const doc=Object.assign(new EventTarget(),{hidden:false});const win=new EventTarget();
 watch.begin('s',{id:'a',title:'A',contentType:'ai-drama'});
 const dispose=bindRecommendationPlayback(video,watch,{document:doc,window:win,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}});
 now=2000;video.seeking=true;video.dispatchEvent(new Event('seeking'));now=12000;tick();
 video.seeking=false;video.dispatchEvent(new Event('seeked'));now=14000;doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
 now=24000;tick();doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));
 now=26000;video.dispatchEvent(new Event('error'));now=36000;tick();
 assert.equal(values.at(-1).watchMs,6000);assert.equal(values.at(-1).skips,0);
 dispose();
});
test('unknown legacy type produces no guessed recommendation signal',()=>{
 const events=[];const watch=new RecommendationWatch((_,v)=>events.push(v));
 watch.begin('s',{id:'legacy',title:'Legacy'});watch.playing();watch.tick();watch.leave('next');assert.equal(events.length,0);
});
