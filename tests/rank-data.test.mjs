import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const engines=['shared/content-core/hongguo.js','custom-server/vendor/hongguo.cjs','server/vendor/hongguo.cjs'];
const payload={isSuccess:true,rankList:[{seriesId:'9007199254740999',title:'官方榜单剧',cover:'https://example.com/cover.jpg',rank:21}],pagination:{pageNum:2,totalPages:5,pageSize:20,total:100}};
const escape=value=>JSON.stringify(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const modern=(data=payload,stringify=true)=>`<script defer data-fn-args="${escape(['rank_hot-drama/page',[{key:'content',routerDataFnName:'p',routerDataFnArgs:[stringify?JSON.stringify(data):data]}]])}" data-fn-name="mergeLoaderData"></script>`;
const legacy=data=>`<script data-fn-name="r" data-fn-args="${escape(['rank',[],data])}"></script>`;
for(const file of engines){
 const context=vm.createContext({Buffer,URL,URLSearchParams,require:()=>crypto,axios:async()=>({status:200,data:modern()})});
 vm.runInContext(fs.readFileSync(file,'utf8')+'\nthis.rankApi={rankData,rankPage};',context);
 test(`${file}: reads current streamed content preserving string IDs and page`,async()=>{
  const result=await context.rankApi.rankPage('hot-drama',2);
  assert.equal(result.list[0].url,payload.rankList[0].seriesId);
  assert.equal(result.list[0].title,'官方榜单剧');
  assert.equal(result.pagination.pageNum,2);
  assert.equal(result.pagination.total,100);
 });
 test(`${file}: accepts object content and skips unrelated or malformed stream chunks`,()=>{
  const prefix='<script data-fn-name="mergeLoaderData" data-fn-args="broken"></script>'+modern({isSuccess:true,otherList:[]});
  assert.equal(context.rankApi.rankData(prefix+modern(payload,false)).rankList[0].seriesId,payload.rankList[0].seriesId);
 });
 test(`${file}: retains legacy format and valid empty page`,()=>{
  assert.equal(context.rankApi.rankData(legacy(payload)).rankList.length,1);
  assert.equal(context.rankApi.rankData(modern({...payload,rankList:[]})).rankList.length,0);
 });
 test(`${file}: reads deferred r content with single-quoted attributes after the document`,()=>{
  const unresolved=modern({otherList:[]});
  const deferred=`<script async data-fn-name='r' data-script-src="modern-run-router-data-fn" data-fn-args='${escape(['rank_hot-real-drama/page','content',payload])}' suppressHydrationWarning></script>`;
  assert.equal(context.rankApi.rankData(unresolved+'</html>'+deferred).rankList[0].seriesId,payload.rankList[0].seriesId);
 });
 test(`${file}: fails on failed or malformed rank payload instead of fabricating data`,()=>{
  for(const html of ['<html>unavailable</html>',modern({...payload,isSuccess:false}),modern({...payload,rankList:{}})])assert.throws(()=>context.rankApi.rankData(html),/榜单/);
 });
}

test('Web/desktop bridge reads deferred official rank data through the shared parser',()=>{
 const context=vm.createContext({Buffer,URL,URLSearchParams,require:()=>crypto});
 vm.runInContext(fs.readFileSync(engines[0],'utf8')+'\nthis.hgEngine={rankData};',context);
 const source=fs.readFileSync('custom-server/index.mjs','utf8');
 vm.runInContext(source.slice(source.indexOf('function extractRankFromHtml('),source.indexOf('// 4. 抓取官方排行榜单页')),context);
 const html=`<script data-fn-name="r" data-fn-args='${escape(['rank','content',payload])}'></script>`;
 assert.equal(context.extractRankFromHtml(html)?.rankList[0].seriesId,payload.rankList[0].seriesId);
 assert.equal(context.extractRankFromHtml('<html>unavailable</html>'),null);
 assert.equal(context.extractRankFromHtml(modern({...payload,rankList:[]})).rankList.length,0);
});
