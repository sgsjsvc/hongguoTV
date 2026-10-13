import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('TV categories use the available website route, preserving type, tag and page', async () => {
  const urls = [];
  const context = vm.createContext({
    streamCache: new Map(), videoInfoCache: new Map(),
    SELECTOR_GROUPS: [], CATEGORY_CONFIG: {}, SITE: 'https://hongguoduanju.com',
    rule: { 一级: async () => [] },
    routerData: async url => { urls.push(url); return {loaderData: {'category_$': {isSuccess:true,categoryRoute:{contentType:'comic-drama',canonicalPath:url.includes('/creative')?'/category/comic-drama/creative':'/category/comic-drama',categoryJsonIds:url.includes('/creative')?['755']:[]},selectorList:[{items:[{selector_item_id:'creative',show_name:'脑洞',category_json_ids:['755']}]}],pagination:{pageNum:url.includes('page=2')?2:1,totalPages:3},recommendList: [{series_id: '9007199254740999', series_name: '分类剧'}]}}}; },
    categoryData: data => data.loaderData['category_$'].recommendList,
    itemToCard: item => ({url: item.series_id, title: item.series_name}),
  });
  vm.runInContext(fs.readFileSync('shared/category-contract.cjs','utf8'),context);
  vm.runInContext(fs.readFileSync('apps/tv-android/app/src/main/assets/content-api.js', 'utf8'), context);
  const result = await context.localContent('/api/category/list', {type: 'comic-drama', tag: 'creative', page: '2'});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, '9007199254740999');
  assert.equal(urls[1], 'https://hongguoduanju.com/category/comic-drama/creative?page=2');
  const choices = await context.localContent('/api/category/tags',{type:'comic-drama'});
  assert.equal(choices.types[0].id, 'real-drama');
  assert.equal(choices.tags.length, 1);
  assert.equal(choices.tags[0].id,'creative');
  context.routerData = async () => {throw new Error('Network unavailable');};
  await assert.rejects(context.localContent('/api/category/list', {type: 'real-drama'}), /Network unavailable/);
});
