const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function engine(profile={history:[],favorites:[],recommendationSignals:[],preferences:{}},failType=''){
 let fetches=0;
 const context=vm.createContext({console,Date,Map,Set,URLSearchParams,SITE:'https://example.com',streamCache:new Map(),videoInfoCache:new Map(),
  extractAssignedJson:JSON.parse,itemToCard:x=>({url:x.id,title:x.title}),
  native:(op,p)=>{
   if(op==='recommendationProfile')return profile;
   assert.equal(op,'recommendationCandidates');fetches++;
   return {rows:p.sources.filter(s=>s.contentType!==failType).map(s=>({...s,html:JSON.stringify({loaderData:{'category_$':{isSuccess:true,categoryRoute:{contentType:s.contentType,canonicalPath:`/category/${s.contentType}`,categoryJsonIds:[]},selectorList:[],pagination:{pageNum:s.page,totalPages:34},recommendList:Array.from({length:24},(_,i)=>({id:s.contentType+':'+s.source+':'+fetches+':'+i,title:'剧'}))}}})})),pending:0};
  }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../shared/recommendation-core.cjs'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../shared/category-contract.cjs'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/content-api.js'),'utf8'),context);
 return {call:p=>vm.runInContext(`localContent('/api/recommend',${JSON.stringify(p)})`,context),fetches:()=>fetches};
}
test('first page mixes actual content types and retries preserve cached rows',async()=>{
 const e=engine();const first=await e.call({session:'a',page:1});
 assert.deepEqual(new Set(first.items.map(x=>x.contentType)),new Set(['real-drama','comic-drama','ai-drama']));
 const again=await e.call({session:'a',page:1});assert.equal(JSON.stringify(first),JSON.stringify(again));assert.equal(e.fetches(),1);
 const second=await e.call({session:'a',page:2});assert.ok(second.items.every(x=>!first.items.some(y=>x.id===y.id)));
});
test('separate feed sessions do not reuse old pagination state',async()=>{
 const e=engine();await e.call({session:'old',page:1});await e.call({session:'new',page:1});assert.equal(e.fetches(),2);
});
test('explicit content preference restricts candidates and fallback keeps a full page',async()=>{
 const only=engine({preferences:{recommendationMode:'comic-drama'}});
 const page=await only.call({session:'comic',page:1});assert.equal(page.items.length,24);assert.ok(page.items.every(x=>x.contentType==='comic-drama'));
 const degraded=await engine(undefined,'ai-drama').call({session:'failure',page:1});
 assert.equal(degraded.items.length,24);assert.ok(degraded.items.every(x=>x.contentType!=='ai-drama'));
});
test('a completely watched first pool advances candidate round without ending result pagination',async()=>{
 const signals=[];
 for(const type of ['real-drama','comic-drama','ai-drama'])for(const source of ['hot','discovery'])for(let i=0;i<24;i++)signals.push({seriesId:type+':'+source+':1:'+i,completed:true});
 const e=engine({recommendationSignals:signals,preferences:{}});
 const page=await e.call({session:'completed',page:1});
 assert.equal(page.items.length,24);assert.equal(e.fetches(),2);
 assert.ok(page.items.every(x=>!signals.some(s=>s.seriesId===x.id)));
 assert.equal(JSON.stringify(await e.call({session:'completed',page:1})),JSON.stringify(page));
 assert.equal(e.fetches(),2);
});
