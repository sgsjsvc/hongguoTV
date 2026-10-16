import axios from "axios";
import { LibraryJournal } from "./library-journal.mjs";
import { legacyOperations } from "@shared/legacy-migration.mjs";
import { isVideoPlaying } from "./video-state";
import {
  RecommendationMode, RecommendationSignal,
  BannerItem,
  CategoryListResponse,
  CategoryTagsResponse,
  Detail,
  HistoryItem,
  RankGroup,
  RankPageResponse,
  RankTypeItem,
  Section,
  Series,
  Settings,
  VideoQualitiesResponse,
} from "./types";

const SETTINGS_KEY="hg_settings_v1";
export type HistorySource="all"|"web"|"pc"|"tv";
export type SyncStatus={state:string;enabled:boolean;url:string;pending:number;lastSyncedAt:number|null;error:string};
let cache:{favorites:Series[];history:HistoryItem[];searchHistory:string[];recommendationSignals:RecommendationSignal[];preferences:{quality:string;speed:number;recommendationMode:RecommendationMode;recommendationResetAt:number};sync:SyncStatus}={favorites:[],history:[],searchHistory:[],recommendationSignals:[],preferences:{quality:"1080P",speed:1,recommendationMode:"mixed",recommendationResetAt:0},sync:{state:"unconfigured",enabled:false,url:"",pending:0,lastSyncedAt:null,error:""}};
let clockOffset=0;
let activeHistory:Series|null=null;
let refreshInFlight:Promise<any>|null=null;
let migration:Promise<void>|null=null;
let auxiliaryRecommendationSession = "";
const migrationOnly=new URLSearchParams(window.location.search).has("__legacy_migration");
function client(){return axios.create({baseURL:window.location.protocol==="file:"?(getSettings().baseUrl||"http://127.0.0.1:8788").replace(/\/+$/,""):"",timeout:15000});}
function warning(error:any){window.dispatchEvent(new CustomEvent("history-storage-error",{detail:error?.message||"本地记录保存失败，请检查服务和存储空间"}));}
const journal=new LibraryJournal(localStorage,window.location.origin,async operation=>{await client().post("/api/library/operations",operation);});
function operation(kind:string,key:string,op:string,value:any=null){try{journal.save({kind,key,op,value,at:Math.round(Date.now()+clockOffset)});void journal.flush().catch(warning);return true;}catch(error){warning(error);return false;}}
export function getSettings():Settings{try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null")||{baseUrl:"http://127.0.0.1:8788",token:""};}catch{return{baseUrl:"http://127.0.0.1:8788",token:""};}}
export function saveSettings(value:Settings){localStorage.setItem(SETTINGS_KEY,JSON.stringify(value));}
export function getFavorites():Series[]{return cache.favorites;}
export function toggleFavorite(series:Series):boolean{const exists=cache.favorites.some(item=>item.id===series.id);cache.favorites=exists?cache.favorites.filter(item=>item.id!==series.id):[series,...cache.favorites];operation("favorite",series.id,exists?"delete":"set",exists?null:series);return !exists;}
export function getSearchHistory():string[]{return cache.searchHistory;}
export function saveSearchHistory(query:string):string[]{query=query.trim();if(query){cache.searchHistory=[query,...cache.searchHistory.filter(item=>item.toLowerCase()!==query.toLowerCase())].slice(0,10);operation("search",query.toLowerCase(),"set",{query});}return cache.searchHistory;}
export function removeSearchHistory(query:string):string[]{cache.searchHistory=cache.searchHistory.filter(item=>item!==query);operation("search",query.trim().toLowerCase(),"delete");return cache.searchHistory;}
export function clearSearchHistory(){cache.searchHistory=[];operation("search","*","clear");}
export function getPlaybackPreferences(){return cache.preferences;}
export function savePlaybackPreference(key:"quality"|"speed"|"recommendationMode"|"recommendationResetAt",value:string|number){cache.preferences={...cache.preferences,[key]:value};operation("preference",key,"set",{value});}
export function saveRecommendationSignal(key:string,value:RecommendationSignal){
 if (!["real-drama","comic-drama","ai-drama"].includes(value.contentType)) return;
 return operation("recommendation",key,"set",value);
}
export function resetRecommendationPreferences(){savePlaybackPreference("recommendationResetAt",Math.round(Date.now()+clockOffset));}
export function getProgress(id:string):HistoryItem|null{return cache.history.find(item=>item.seriesId===id)||null;}
export function beginHistory(series:Series,progress?:HistoryItem|null){activeHistory=series;if(progress)cache.history=[progress,...cache.history.filter(item=>item.seriesId!==series.id)];}
export function saveProgress(seriesId:string,episodeId:string,position:number,extra?:{title?:string;cover?:string;badge?:string;tags?:string;episodeNumber?:number;duration?:number;completed?:boolean}){
 if(!activeHistory||activeHistory.id!==seriesId||!episodeId)return;
 const item={seriesId,...(activeHistory.contentType?{contentType:activeHistory.contentType}:{}),title:extra?.title||activeHistory.title,cover:extra?.cover||activeHistory.cover,badge:extra?.badge||activeHistory.badge,tags:extra?.tags||activeHistory.tags,description:activeHistory.description,episodeId,episodeNumber:extra?.episodeNumber||1,position,duration:extra?.duration||0,completed:!!extra?.completed,updatedAt:Math.round(Date.now()+clockOffset)};
 cache.history=[item,...cache.history.filter(row=>row.seriesId!==seriesId)];
 operation("history",seriesId,"set",{...item,positionMs:Math.max(0,Math.round(position*1000)),durationMs:Number.isFinite(item.duration)?Math.max(0,Math.round(item.duration*1000)):0});
}
async function migrate(){if(migration)return migration;const keys=["hg_favorites_v1","hg_progress_v1","hg_search_history_v1","hg_pref_quality","hg_playback_speed",...Object.keys(localStorage).filter(key=>key.startsWith("hg_history_outbox_v1:")).sort()];const raw=Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]));if(!Object.values(raw).some(value=>value!==null))return;
 migration=(async()=>{const operations=legacyOperations(raw);await client().post("/api/library/import",{migrationId:(localStorage.getItem("hg_library_migration_id") || (()=>{const id=journal.uuid();localStorage.setItem("hg_library_migration_id",id);return id;})()),operations});for(const key of keys)if(localStorage.getItem(key)===raw[key])localStorage.removeItem(key);})();try{await migration;}finally{migration=null;}}
export async function refreshLibrary(){if(refreshInFlight)return refreshInFlight;refreshInFlight=(async()=>{await migrate();await journal.flush();const started=Date.now();const data=(await client().get("/api/library")).data;clockOffset=(data.serverTime||Date.now())-(started+Date.now())/2;cache={...data,recommendationSignals:data.recommendationSignals||[],preferences:{quality:"1080P",speed:1,recommendationMode:"mixed",recommendationResetAt:0,...data.preferences},history:(data.history||[]).map((item:any)=>({...item,position:item.positionMs/1000,duration:item.durationMs/1000}))};window.dispatchEvent(new CustomEvent("library-updated"));return cache;})();try{return await refreshInFlight;}finally{refreshInFlight=null;}}
export async function commitRecommendationPreferences(){
 const deadline=Date.now()+15000;
 while(journal.entries().length){await journal.flush();if(Date.now()>deadline)throw Error("推荐偏好尚未保存，请重试");}
 if(refreshInFlight)await refreshInFlight;
 return (await refreshLibrary()).preferences;
}
export async function getServerProgress(id:string):Promise<HistoryItem|null>{await refreshLibrary();return getProgress(id);}
export async function getHistoryList(_source:HistorySource="all"):Promise<HistoryItem[]>{await refreshLibrary();return cache.history;}
export async function removeHistoryItem(id:string,_source:HistorySource="all"){operation("history",id,"delete");await journal.flush();await refreshLibrary();}
export async function clearHistory(_source:HistorySource="all"){operation("history","*","clear");await journal.flush();await refreshLibrary();}
export function getSyncStatus(){return cache.sync;}
export async function configureSync(url:string,key:string,enabled=true){const data=(await client().post("/api/library/sync",enabled?{url,key}:{enabled:false})).data;cache.sync=data;await refreshLibrary();return data;}
export { isVideoPlaying };
if(!migrationOnly && typeof window !== "undefined"){
  let pollingTimer: any = null;
  let backoffMs = 10000;

  const scheduleNextPoll = (delay: number) => {
    if (pollingTimer) clearTimeout(pollingTimer);
    pollingTimer = setTimeout(async () => {
      if (typeof document !== "undefined" && document.hidden) {
        pollingTimer = null;
        return;
      }
      if (isVideoPlaying()) {
        scheduleNextPoll(10000);
        return;
      }
      try {
        await refreshLibrary();
        backoffMs = 10000;
      } catch {
        backoffMs = Math.min(backoffMs * 2, 30000);
      }
      scheduleNextPoll(backoffMs);
    }, delay);
  };

  scheduleNextPoll(10000);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        backoffMs = 10000;
        // 播放中不立即拉取，避免与视频流争用，安排下一次轮询
        if (!isVideoPlaying()) {
          void refreshLibrary().catch(() => {});
        }
        scheduleNextPoll(10000);
      } else {
        if (pollingTimer) {
          clearTimeout(pollingTimer);
          pollingTimer = null;
        }
      }
    });
  }

  window.addEventListener("online", () => {
    backoffMs = 10000;
    // 播放中不立即拉取，避免与视频流争用，安排下一次轮询
    if (!isVideoPlaying()) {
      void refreshLibrary().catch(warning);
    }
    scheduleNextPoll(10000);
  });
}

export const api = {
  // 1. 官方首页大轮播 Banner
  async getBanners(): Promise<BannerItem[]> {
    const res = await client().get("/api/banners");
    return res.data?.banners || [];
  },

  // 2. 官方四大分类专区 (热播短剧 / 真人剧 / 漫剧 / AI剧)
  async getSections(): Promise<Section[]> {
    const res = await client().get("/api/sections");
    return res.data?.sections || [];
  },

  // 3. 官方分类标签池 (三大类型与 24 种官方题材)
  async getCategoryTags(type = "real-drama"): Promise<CategoryTagsResponse> {
    const res = await client().get("/api/category/tags",{params:{type}});
    return res.data;
  },

  // 4. 官方分类短剧列表 (支持类型/题材/分页)
  async getCategoryList(
    type = "real-drama",
    tag = "",
    page = 1
  ): Promise<CategoryListResponse> {
    const res = await client().get(
      `/api/category/list?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(
        tag
      )}&page=${page}`
    );
    return res.data;
  },

  // 5. 官方排行榜分类选项
  async getRankTypes(): Promise<RankTypeItem[]> {
    const res = await client().get("/api/rank/types");
    return res.data?.types || [];
  },

  // 5.1 官方排行榜分页列表 (支持 4 大榜单，1~5 页，前 100 名)
  async getRankPageList(slug = "hot-drama", page = 1): Promise<RankPageResponse> {
    const res = await client().get(
      `/api/rank/list?type=${encodeURIComponent(slug)}&page=${page}`
    );
    return res.data;
  },

  // 5.2 兼容旧版全量四大排行榜 (获取首页 Top 9 集合)
  async getRanks(): Promise<RankGroup[]> {
    const res = await client().get("/api/ranks");
    return res.data?.ranks || [];
  },

  // 6. 搜索短剧
  async search(keyword: string, page = 1): Promise<{ items: Series[]; page: number }> {
    const res = await client().get(
      `/api/search?q=${encodeURIComponent(keyword)}&page=${page}`
    );
    return res.data;
  },

  // 6.1 沉浸式流推荐接口 (GET /api/recommend?page=N)
  async getRecommendStream(page = 1, session: string, signal?: AbortSignal): Promise<{ items: Series[]; page: number; session: string }> {
    await journal.flush();
    const res = await client().get(`/api/recommend?page=${page}&session=${encodeURIComponent(session)}`, {signal});
    return res.data;
  },

  // 7. 获取剧集与选集详情
  async getSeries(id: string): Promise<Detail> {
    const res = await client().get(`/api/series/${id}`);
    return res.data;
  },

  // 8. 获取官方实时画质清晰度列表 (仅提供真实可播放的官方流)
  async getVideoQualities(episodeId: string, seriesId?: string): Promise<VideoQualitiesResponse> {
    const sParam = seriesId ? `?seriesId=${encodeURIComponent(seriesId)}` : "";
    const res = await client().get(`/api/episodes/${episodeId}/qualities${sParam}`);
    return res.data;
  },

  // 9. 视频流播放直链 (支持指定清晰度画质与短剧关联)
  getVideoStreamUrl(episodeId: string, quality?: string, seriesId?: string): string {
    const params=new URLSearchParams();if(quality)params.set("quality",quality);if(seriesId)params.set("seriesId",seriesId);
    const base=window.location.protocol==="file:"?getSettings().baseUrl.replace(/\/+$/,""):"";
    return `${base}/api/episodes/${encodeURIComponent(episodeId)}/stream?${params}`;
  },

  // 10. 全库个性化算法推荐流 (瀑布流 / 猜你喜欢)
  async getRecommend(page = 1): Promise<{ items: Series[]; page: number }> {
    if (page === 1 || !auxiliaryRecommendationSession) auxiliaryRecommendationSession = journal.uuid();
    const res = await client().get(`/api/recommend?page=${page}&session=${encodeURIComponent(auxiliaryRecommendationSession)}`);
    return res.data;
  },

  // 11. 单剧同类相关推荐 (播放页/详情页猜你喜欢，支持按页换一批)
  async getRelatedSeries(
    seriesId: string,
    limit = 16,
    page = 1
  ): Promise<{ seriesId: string; keyword: string; items: Series[]; page?: number }> {
    const res = await client().get(
      `/api/series/${seriesId}/related?limit=${limit}&page=${page}`
    );
    return res.data;
  },

  // 12. 智能聚合当前短剧的同系列多季列表 (第1季、第2季、第3季...)
  async getSeriesSeasons(series: Series): Promise<import("@shared/types").SeasonInfo[]> {
    try {
      const { parseSeasonInfo, matchAndSortSeasons } = await import("@shared/utils");
      const info = parseSeasonInfo(series.title);
      // 用系列主剧名在全库进行同名检索
      const res = await this.search(info.baseTitle, 1);
      const candidates = res.items || [];
      return matchAndSortSeasons(series, candidates);
    } catch {
      return [{
        seriesId: String(series.id),
        title: series.title,
        seasonNumber: 1,
        seasonLabel: "第1季",
        cover: series.cover,
        badge: series.badge,
        isCurrent: true
      }];
    }
  },

  // 13. 后台智能预取接口 (支持 detail 与 qualities 预热)
  async prefetch(
    targets: Array<
      | { kind: "detail"; id: string }
      | { kind: "qualities"; id: string; seriesId: string }
    >
  ): Promise<{ id: string; state: string; targets: any[]; enabled?: boolean } | null> {
    if (!targets || targets.length === 0) return null;
    try {
      const res = await client().post("/api/prefetch", { targets });
      return res.data;
    } catch {
      return null;
    }
  },

  // 14. 取消预取任务批次
  async cancelPrefetch(id: string): Promise<boolean> {
    if (!id) return false;
    try {
      await client().delete(`/api/prefetch/${encodeURIComponent(id)}`);
      return true;
    } catch {
      return false;
    }
  },

  // 15. 查询预取任务状态
  async getPrefetchStatus(id: string): Promise<any> {
    if (!id) return null;
    try {
      const res = await client().get(`/api/prefetch/${encodeURIComponent(id)}`);
      return res.data;
    } catch {
      return null;
    }
  },
};

