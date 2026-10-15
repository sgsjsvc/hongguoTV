import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import axios from 'axios';
import assert from 'node:assert/strict';
const fetched=new Map();
const context=vm.createContext({Buffer,URL,URLSearchParams,require:()=>crypto,
 axios:async(url,options)=>{if(!fetched.has(url)){const response=await axios(url,options);fetched.set(url,response);fs.writeFileSync('outputs/rank-diagnosis/'+url.split('/').at(-1).replace('?page=','-')+'.html',response.data);}return fetched.get(url);},
 setResult:rows=>rows,log:message=>{throw Error(message);}});
vm.runInContext(fs.readFileSync('shared/content-core/hongguo.js','utf8')+'\nthis.rankApi={rankPage,rankData};',context);
vm.runInContext(fs.readFileSync('apps/tv-android/app/src/main/assets/content-api.js','utf8'),context);
const results=[];
await Promise.all([['rank_hot','hot-drama'],['rank_human','hot-real-drama'],['rank_comic','hot-comic-drama'],['rank_ai','hot-ai-drama']].map(async([type,route])=>{
 const seen=new Set();
 for(let page=1;page<=5;page++){
  const data=await context.rankApi.rankPage(route,page);
  const actual=await context.localContent('/api/rank/list',{type,page:String(page)});
  const url=`https://hongguoduanju.com/rank/${route}${page>1?'?page='+page:''}`;
  const official=context.rankApi.rankData(fetched.get(url).data);
  assert.equal(data.pagination.pageNum,page);assert.equal(actual.items.length,20);
  assert.deepEqual(Array.from(actual.items,row=>row.id),Array.from(official.rankList,row=>String(row.seriesId)));
  for(const row of actual.items){assert.ok(row.title);assert.ok(/^\d+$/.test(row.id));assert.ok(!seen.has(row.id));seen.add(row.id);}
  results.push({route,page,count:actual.items.length,firstId:actual.items[0].id,firstTitle:actual.items[0].title,officialFirstRank:official.rankList[0].rank});
 }
}));
results.sort((a,b)=>a.route.localeCompare(b.route)||a.page-b.page);
fs.writeFileSync('.agents/shared/t-rank-live-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({pages:results.length,items:results.reduce((n,row)=>n+row.count,0),allMatchOfficial:true}));
