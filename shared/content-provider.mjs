import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import axios from "axios";
import categoryContract from './category-contract.cjs';

// Trusted, pinned GPL source. This is a compatibility wrapper, not a sandbox for user scripts.
const source = fs.readFileSync(
  fs.existsSync(new URL("./content-core/hongguo.js", import.meta.url)) ? new URL("./content-core/hongguo.js", import.meta.url) : new URL("./content-core/vendor/hongguo.cjs", import.meta.url),
  "utf8"
);
const context = vm.createContext({
  require: (name) => {
    if (name === "node:crypto") return crypto;
    throw new Error("Unsupported module");
  },
  Buffer,
  URL,
  URLSearchParams,
  axios: axios.create({
    maxContentLength: 16 * 1024 * 1024,
    maxBodyLength: 1024 * 1024,
  }),
});
vm.runInContext(
  source +
    "\nthis.api = {categoryPage, categoryData, itemToCard, appSearchPage, routerData, resolveStream, prepareHeader, remoteRange, decryptPartial, streamCache, videoInfoCache, pageCache, appSearchCache};",
  context,
  { timeout: 5000 }
);
const api = context.api;
const SITE = "https://hongguoduanju.com";
const card = (row) => ({
  id: String(row.url),
  title: row.title,
  cover: row.img || "",
  description: row.content || "",
  badge: row.desc || "",
  tags: row.tname || "",
});
const cards = (rows) =>
  Array.from(rows)
    .filter((r) => /^\d+$/.test(String(r.url)) && r.title)
    .map(card);

export const provider = {
  async categoryMetadata(type='real-drama') {
    if(!categoryContract.types.some(row=>row.id===type)){const error=new Error('不支持的分类类型');error.status=400;throw error;}
    const data=await api.routerData(`${SITE}/category/${type}`);
    const {types,tags,sourceUrl}=categoryContract.officialCategory(data,type);
    return {types,type,tags,sourceUrl};
  },
  async category(type, tag = '', page = 1) {
    if(!['real-drama','comic-drama','ai-drama'].includes(type)||!/^[-a-z]*$/.test(tag))throw new Error('Unsupported category');
    const data=await api.routerData(`${SITE}/category/${type}${tag?`/${tag}`:''}${page>1?`?page=${page}`:''}`);
    const result=categoryContract.officialCategory(data,type,tag,page);
    return cards(result.rows.map(api.itemToCard)).map(row=>({...row,contentType:type}));
  },
  async categoryList(type,tag='',page=1) {
    const metadata=await this.categoryMetadata(type);
    if(tag&&!metadata.tags.some(row=>row.id===tag)){const error=new Error('当前类型不支持该题材');error.status=400;throw error;}
    const data=await api.routerData(`${SITE}/category/${type}${tag?`/${tag}`:''}${page>1?`?page=${page}`:''}`);
    const {rows,...result}=categoryContract.officialCategory(data,type,tag,page);
    return {...result,items:cards(rows.map(api.itemToCard)).map(row=>({...row,contentType:type}))};
  },
  async home(page = 1) {
    const data = await api.categoryPage("tab=1&sort_type=1", page);
    const pageData =
      data?.loaderData?.category_page || data?.loaderData?.["category_$"];
    if (!Array.isArray(pageData?.recommendList))
      throw new Error("首页数据结构已变化");
    return { items: cards(pageData.recommendList.map(api.itemToCard)), page };
  },
  async search(keyword, page = 1) {
    try {
      const result = await api.appSearchPage(keyword, 11, page, 20);
      if (result.list.length) return { items: cards(result.list), page };
    } catch {
      /* Website fallback; failure below remains an error, never an empty success. */
    }
    const data = await api.routerData(
      `${SITE}/search/${encodeURIComponent(keyword)}?page=${page}`
    );
    const pageData =
      data?.loaderData?.["search_(keyword)/page"] ||
      data?.loaderData?.search_page;
    if (!Array.isArray(pageData?.searchList)) throw new Error("搜索数据不可用");
    return { items: cards(pageData.searchList.map(api.itemToCard)), page };
  },
  async detail(id) {
    const data = await api.routerData(`${SITE}/detail?series_id=${id}`);
    const series = data?.loaderData?.detail_page?.seriesDetail;
    if (!series || !Array.isArray(series.vid_list) || !series.vid_list.length)
      throw new Error("剧集不存在或分集暂不可用");
    const episodes = Array.from(series.vid_list, (vid, index) => ({
      id: String(vid),
      title: `第 ${index + 1} 集`,
      number: index + 1,
    }));
    if (
      episodes.some((e) => !/^\d+$/.test(e.id)) ||
      new Set(episodes.map((e) => e.id)).size !== episodes.length
    )
      throw new Error("分集数据异常");
    return { ...card(api.itemToCard(series)), id, episodes };
  },
  async stream(id, fresh = false) {
    if (fresh) {
      api.streamCache.delete(`${id}|auto`);
      api.videoInfoCache.delete(id);
    }
    const stream = await api.resolveStream(id, "auto");
    const prepared = await api.prepareHeader(stream);
    return {
      total: prepared.total,
      chunk: async (start, end) =>
        api.decryptPartial(
          (await api.remoteRange(stream, start, end)).data,
          start,
          stream.key,
          prepared
        ),
    };
  },
};

// Limit the pinned upstream's otherwise unbounded caches during long-lived home use.
setInterval(() => {
  for (const cache of [
    api.streamCache,
    api.videoInfoCache,
    api.pageCache,
    api.appSearchCache,
  ]) {
    for (const [key, value] of cache)
      if (Date.now() - value.time > 300000) cache.delete(key);
    while (cache.size > 100) cache.delete(cache.keys().next().value);
  }
}, 60000).unref();
