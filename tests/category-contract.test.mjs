import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {officialCategory}=createRequire(import.meta.url)('../shared/category-contract.cjs');
const fixture=(type,id='creative',name='脑洞',page=1)=>({loaderData:{'category_$':{isSuccess:true,categoryRoute:{contentType:type,canonicalPath:`/category/${type}`,categoryJsonIds:[]},selectorList:[{items:[{selector_item_id:id,show_name:name,category_json_ids:['755']}]}],recommendList:[],pagination:{pageNum:page,pageSize:24,total:48,totalPages:2}}}});
test('tags and pagination come from the requested official type rather than a global tag pool',()=>{
 const real=officialCategory(fixture('real-drama','romance','爱情'),'real-drama');
 const comic=officialCategory(fixture('comic-drama'),'comic-drama');
 assert.deepEqual(real.tags.map(t=>t.id),['romance']);assert.deepEqual(comic.tags.map(t=>t.id),['creative']);
 assert.equal(comic.pagination.totalPages,2);assert.equal(comic.sourceUrl,'https://hongguoduanju.com/category/comic-drama');
});
test('wrong type, fake tag, mismatched filter or page and broken structure fail visibly',()=>{
 assert.throws(()=>officialCategory(fixture('real-drama'),'ai-drama'),/类型/);
 assert.throws(()=>officialCategory(fixture('comic-drama'),'comic-drama','romance'),/题材/);
 assert.throws(()=>officialCategory(fixture('comic-drama'),'comic-drama','creative'),/题材/);
 assert.throws(()=>officialCategory(fixture('comic-drama'),'comic-drama','',2),/页码/);
 assert.throws(()=>officialCategory({loaderData:{}},'real-drama'),/分类/);
});
test('valid selected tag is checked against official category IDs and source path',()=>{
 const data=fixture('ai-drama');data.loaderData['category_$'].categoryRoute={contentType:'ai-drama',canonicalPath:'/category/ai-drama/creative',categoryJsonIds:['755']};
 assert.equal(officialCategory(data,'ai-drama','creative').sourceUrl,'https://hongguoduanju.com/category/ai-drama/creative');
});
