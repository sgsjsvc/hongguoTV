import http from "node:http";
import { traceRequest } from "./request-timing.mjs";
import { createPrefetchMetrics } from "./prefetch-metrics.mjs";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import axios from "axios";
import { listenWithFallback, serviceListenOptions } from "../shared/listen-port.mjs";
import { HistoryStore } from "./history-store.mjs";
import { createHistoryHandler } from "./history-routes.mjs";
import { provider as coreProvider, createPrefetchQueue, sharedResource, upstreamRequestSignal } from "../server/provider.mjs";
import { readJson } from "../shared/http-json.mjs";
import { LibraryStore } from "../shared/library-store.mjs";
import { LibrarySync } from "./library-sync.mjs";
import { createLibraryHandler } from "./library-routes.mjs";
import { RecommendationService, RecommendationError } from "./recommendation-service.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = process.env.HG_WEB_DIR || path.resolve(__dirname, "../apps/web-pc/dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function serveStatic(res, pathname) {
  if (!fs.existsSync(DIST_DIR)) return false;
  let targetFile = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.join(DIST_DIR, targetFile);

  if (!filePath.startsWith(DIST_DIR)) return false;

  // SPA 回退
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, "index.html");
  }
  if (!fs.existsSync(filePath)) return false;

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const listenOptions = serviceListenOptions(8788);
const PORT = listenOptions.port;
const DATA_DIR = process.env.HG_DATA_DIR || path.join(__dirname, "data");
const historyStore = new HistoryStore(process.env.HISTORY_DB_PATH || path.join(DATA_DIR, "history.sqlite"));
const libraryStore = new LibraryStore(path.join(DATA_DIR, "library.sqlite"));
const librarySync = new LibrarySync(libraryStore);
const handleLibrary = createLibraryHandler(libraryStore, librarySync);
if (!libraryStore.getMeta("legacyBackendMigrated")) {
  for (const item of historyStore.list()) libraryStore.write({kind:"history", key:item.seriesId, op:"set", at:item.updatedAt, value:item});
  libraryStore.setMeta("legacyBackendMigrated", true);
}
const legacyHistory = {
 registerSession: value => historyStore.registerSession(value),
 saveProgress: value => { const result=historyStore.saveProgress(value); if(result.accepted) libraryStore.write({id:`legacy:${value.sessionId}:${value.sequence}`,kind:"history",key:result.item.seriesId,op:"set",at:result.item.updatedAt,value:result.item}); return result; },
 list: () => libraryStore.snapshot().history,
 get: id => libraryStore.snapshot().history.find(item=>item.seriesId===id)||null,
 remove: id => { historyStore.remove(id); libraryStore.write({kind:"history",key:id,op:"delete"}); return {ok:true}; },
 clear: () => { historyStore.clear(); libraryStore.write({kind:"history",key:"*",op:"clear"}); return {ok:true}; },
 importLegacy: value => { const result=historyStore.importLegacy(value); const bridged=new Set(libraryStore.snapshot().history.map(row=>row.seriesId)); for(const item of historyStore.list()) if(!bridged.has(item.seriesId)) { libraryStore.write({id:`legacy-import:${value.clientId}:${item.seriesId}`,kind:"history",key:item.seriesId,op:"set",at:item.updatedAt,value:item}); bridged.add(item.seriesId); } return result; }
};
const handleHistory = createHistoryHandler(legacyHistory);
librarySync.start();

// 初始化官方视频解密与画质引擎
let hgEngine = null;
try {
  const sharedEngine = new URL("../shared/content-core/hongguo.js", import.meta.url);
  const cjsPath = fs.existsSync(sharedEngine) ? sharedEngine : new URL("./vendor/hongguo.cjs", import.meta.url);
  if (fs.existsSync(cjsPath)) {
    const source = fs.readFileSync(cjsPath, "utf8");
    const context = vm.createContext({
      require: (name) => {
        if (name === "node:crypto") return crypto;
        throw new Error("Unsupported module: " + name);
      },
      Buffer,
      URL,
      URLSearchParams,
      axios: (() => {
        const client = axios.create({ maxContentLength: 16 * 1024 * 1024, maxBodyLength: 1024 * 1024 });
        client.interceptors.request.use(config => {
          const signal = upstreamRequestSignal();
          if (signal) config.signal = signal;
          return config;
        });
        return client;
      })(),
    });
    vm.runInContext(
      source + "\nthis.api = {fetchVideoInfo, resolveStream, qualityLabel, qualityNumber, prepareHeader, remoteRange, decryptPartial, rankData, upstreamStats};",
      context,
      { timeout: 5000 }
    );
    hgEngine = context.api;
    console.log("✅ 官方视频模型与解密引擎 (vendor/hongguo.cjs) 加载成功!");
  }
} catch (e) {
  console.error("⚠️ 加载 hongguo.cjs 失败:", e.message);
}

function byteRange(value, total) {
  if (!value) return [0, total - 1];
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2])) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
  const end = m[1]
    ? m[2]
      ? Math.min(Number(m[2]), total - 1)
      : total - 1
    : total - 1;
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < total
    ? [start, end]
    : null;
}

// 官方 24 个题材标签映射池
const OFFICIAL_TAGS = [
  { id: "romance", name: "爱情", categoryId: "5000" },
  { id: "period", name: "年代", categoryId: "5021" },
  { id: "comeback", name: "逆袭", categoryId: "5031" },
  { id: "legend", name: "传奇", categoryId: "5011" },
  { id: "growth", name: "成长", categoryId: "5010" },
  { id: "family", name: "家庭", categoryId: "5001" },
  { id: "clan", name: "家族", categoryId: "5002" },
  { id: "cute-kids", name: "萌宝", categoryId: "5003" },
  { id: "suspense", name: "悬疑", categoryId: "5004" },
  { id: "thriller", name: "惊悚", categoryId: "5132" },
  { id: "horror", name: "恐怖", categoryId: "5133" },
  { id: "supernatural", name: "志怪", categoryId: "5006" },
  { id: "costume", name: "古装", categoryId: "5007" },
  { id: "fantasy", name: "玄幻", categoryId: "5008" },
  { id: "wonder", name: "奇幻", categoryId: "5009" },
  { id: "urban", name: "都市", categoryId: "5022" },
  { id: "youth", name: "青春", categoryId: "5023" },
  { id: "comedy", name: "喜剧", categoryId: "5024" },
  { id: "sci-fi", name: "科幻", categoryId: "5025" },
  { id: "disaster", name: "灾难", categoryId: "5026" },
  { id: "action-adventure", name: "动作冒险", categoryId: "5027" },
  { id: "war", name: "战争", categoryId: "5028" },
  { id: "variety", name: "综艺", categoryId: "5029" },
  { id: "drama", name: "剧情", categoryId: "5030" }
];

const OFFICIAL_TYPES = [
  { id: "real-drama", name: "真人剧" },
  { id: "comic-drama", name: "漫剧" },
  { id: "ai-drama", name: "AI剧" }
];

const recommendations = new RecommendationService({
  fetchPool: async ({type,tag,page}) => {
    if(tag){const metadata=await coreProvider.categoryMetadata(type);if(!metadata.tags.some(row=>row.id===tag))return [];}
    return coreProvider.category(type,tag,page);
  },
  readProfile: () => libraryStore.snapshot(),
  now: () => Math.round(Date.now()+(libraryStore.getMeta('clockOffset')||0)),
  topics: OFFICIAL_TAGS,
});

// 官方四大排行榜类别定义
const OFFICIAL_RANK_TYPES = [
  { id: "hot-drama", slug: "hot-drama", name: "红果热播榜", key: "all" },
  { id: "hot-real-drama", slug: "hot-real-drama", name: "真人剧热播榜", key: "real" },
  { id: "hot-ai-drama", slug: "hot-ai-drama", name: "AI剧热播榜", key: "ai" },
  { id: "hot-comic-drama", slug: "hot-comic-drama", name: "漫剧热播榜", key: "comic" },
];

let cacheHome = { timestamp: 0, banners: [], sections: [] };
let categoryCache = new Map();
let rankPageCache = new Map();
const vidToSeriesMap = new Map();


// 1. 获取官方首页数据 (含 Banner + 四大排行榜基础池)
async function fetchOfficialHome() {
  const now = Date.now();
  if (cacheHome.timestamp && now - cacheHome.timestamp < 10 * 60 * 1000) {
    return cacheHome;
  }

  try {
    const res = await axios.get("https://hongguoduanju.com", {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });

    const match = res.data.match(/_ROUTER_DATA\s*=\s*(\{.*?\});/s);
    if (match) {
      const data = JSON.parse(match[1]);
      const page = data?.loaderData?.page || {};
      cacheHome = {
        timestamp: now,
        banners: (page.bannerList || []).map((b) => ({
          id: String(b.series_id),
          title: b.series_name,
          cover: b.series_cover,
          backgroundCover: b.background_cover_pc,
          titleImage: b.title_link_pc,
          description: b.series_intro,
          tags: (b.tags || []).join("/"),
        })),
        sections: (page.homeSections || []).map((s) => ({
          type: s.tab_type,
          name: s.tab_name,
          items: (s.video_list || []).map((v) => ({
            id: String(v.series_id),
            title: v.series_title,
            cover: v.series_cover,
            badge: v.episode_right_text || `全${v.episode_cnt}集`,
            description: v.series_intro || "",
            tags: `${s.tab_name} · 排名第${v.rank || 1}`,
            rank: v.rank || 1,
          })),
        })),
      };
      return cacheHome;
    }
  } catch (err) {
    console.error("[Official Home Error]:", err.message);
  }
  return cacheHome;
}

// 2. 抓取官方分类短剧列表 (带题材路由与分页)
async function fetchOfficialCategory(type = "real-drama", tag = "", page = 1) {
  const cacheKey = `${type}_${tag}_${page}`;
  const cached = categoryCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
    return cached.data;
  }

  let url = `https://hongguoduanju.com/category/${type}`;
  if (tag) {
    url += `/${tag}`;
  }
  if (page > 1) {
    url += `?page=${page}`;
  }

  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" }
    });

    const match = res.data.match(/_ROUTER_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const catData = data?.loaderData?.["category_$"] || {};
      const items = (catData.recommendList || []).map((item) => ({
        id: String(item.series_id),
        title: item.series_name,
        cover: item.series_cover,
        badge: item.episode_right_text || `全${item.episode_cnt}集`,
        description: item.series_intro || "",
        tags: (item.tags || []).join("/"),
      }));

      const result = { type, tag, page, items };
      categoryCache.set(cacheKey, { time: Date.now(), data: result });
      return result;
    }
  } catch (err) {
    console.error("[Official Category Error]:", err.message);
  }
  return { type, tag, page, items: [] };
}

// 3. 官方排行榜 HTML 数据流提取器 (前 100 名分页解析)
function extractRankFromHtml(html) {
  // Share the same streamed-page contract as the standalone TV engine.
  try { return hgEngine?.rankData(html) || null; }
  catch { return null; }
}

// 4. 抓取官方排行榜单页 (支持 4 大榜单，1~5 页，每页 20 部，共 100 部)
async function fetchOfficialRankPage(slug = "hot-drama", page = 1) {
  const pageNum = Math.max(1, Math.min(5, parseInt(page, 10) || 1));
  const typeConfig = OFFICIAL_RANK_TYPES.find((r) => r.slug === slug || r.key === slug) || OFFICIAL_RANK_TYPES[0];
  const targetSlug = typeConfig.slug;
  const cacheKey = `${targetSlug}_${pageNum}`;

  const cached = rankPageCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30 * 60 * 1000) {
    return cached.data;
  }

  const url = `https://hongguoduanju.com/rank/${targetSlug}${pageNum > 1 ? `?page=${pageNum}` : ""}`;
  
  // 增加重试机制与长超时 (15000ms)，避免因官方接口偶尔慢响应导致降级
  let html = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 15000,
      });
      html = res.data;
      break;
    } catch (err) {
      console.warn(`[Rank Fetch Attempt ${attempt + 1} Failed for ${targetSlug}]:`, err.message);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (html) {
    const parsed = extractRankFromHtml(html);
    if (parsed && Array.isArray(parsed.rankList) && parsed.rankList.length > 0) {
      const items = parsed.rankList.map((item) => {
        const episodeCount = item.episodeVids?.length || 0;
        return {
          id: String(item.seriesId || item.id),
          rank: item.rank,
          title: item.title,
          cover: item.cover,
          badge: episodeCount > 0 ? `全${episodeCount}集` : "",
          heatText: item.heatText || "热播指数高",
          scoreText: item.scoreText || "",
          favoriteText: item.favoriteText || "",
          likeText: item.likeText || "",
          tags: Array.isArray(item.tags) ? item.tags.join(" · ") : (item.tags || ""),
          description: item.description || "",
        };
      });

      const result = {
        slug: targetSlug,
        title: typeConfig.name,
        page: pageNum,
        totalPages: parsed.pagination?.totalPages || 5,
        total: 100,
        updatedText: "今日已更新 · 基于红果内观看/互动等综合热度排序",
        items,
      };

      rankPageCache.set(cacheKey, { time: Date.now(), data: result });
      return result;
    }
  }

  // 兜底回退：若遇官方网站异常，优先使用首页对应分区，并自动从官方分类池补充至完整的 20 部！
  let fallbackItems = [];
  const home = await fetchOfficialHome();
  const sec = home.sections.find(
    (s) => s.type === typeConfig.key || s.type === typeConfig.slug || (typeConfig.key === "real" && s.type === "human")
  ) || home.sections[0];

  if (sec && Array.isArray(sec.items)) {
    fallbackItems = sec.items.map((it, idx) => ({
      ...it,
      rank: (pageNum - 1) * 20 + idx + 1,
      heatText: "热播指数高",
    }));
  }

  // 如果依然不足 20 部，从对应类型的分类池充实补满至 20 部！
  if (fallbackItems.length < 20) {
    try {
      const catMap = {
        "hot-drama": "real-drama",
        "hot-real-drama": "real-drama",
        "hot-ai-drama": "ai-drama",
        "hot-comic-drama": "comic-drama",
      };
      const catType = catMap[targetSlug] || "real-drama";
      const cat = await fetchOfficialCategory(catType, "", pageNum);
      const seen = new Set(fallbackItems.map((i) => String(i.id)));
      for (const item of (cat.items || [])) {
        if (!seen.has(String(item.id))) {
          seen.add(String(item.id));
          fallbackItems.push({
            ...item,
            rank: fallbackItems.length + 1,
            heatText: "热播指数高",
          });
        }
        if (fallbackItems.length >= 20) break;
      }
    } catch (_) {}
  }

  const fallbackResult = {
    slug: targetSlug,
    title: typeConfig.name,
    page: pageNum,
    totalPages: 5,
    total: 100,
    updatedText: "今日已更新 · 基于红果内观看/互动等综合热度排序",
    items: fallbackItems.slice(0, 20),
  };

  return fallbackResult;
}

function json(res, data, status = 200, headers = {}, reqStart = null) {
  if (res.headersSent) return;
  const elapsed = reqStart !== null ? Date.now() - reqStart : null;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "X-Cache, X-Response-Time",
    ...(elapsed !== null ? { "X-Response-Time": `${elapsed}ms` } : {}),
    ...headers,
  });
  res.end(JSON.stringify(data));
}

// B6: 内存层 50MB 本地 LRU Cache，热点接口 TTL 300s
class LocalLRUCache {
  constructor(maxBytes = 50 * 1024 * 1024, defaultTtlMs = 300000) {
    this.maxBytes = maxBytes;
    this.defaultTtlMs = defaultTtlMs;
    this.currentBytes = 0;
    this.cache = new Map();
  }

  estimateSize(val) {
    if (typeof val === "string") return val.length * 2;
    try {
      return Buffer.byteLength(JSON.stringify(val), "utf8");
    } catch {
      return 1024;
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.delete(key);
    const size = this.estimateSize(value) + (key.length * 2);
    while (this.currentBytes + size > this.maxBytes && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      this.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      size,
    });
    this.currentBytes += size;
  }

  delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentBytes -= entry.size;
      this.cache.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.currentBytes = 0;
  }
}

const hotLruCache = new LocalLRUCache(50 * 1024 * 1024, 300000);

const prefetchMetrics = createPrefetchMetrics();
const prefetchQueue = createPrefetchQueue(async (target, signal) => prefetchMetrics.run(async () => {
  if (target.kind === 'detail') {
    const detail = await coreProvider.detail(target.id, { signal });
    // A detail target also warms its first episode's existing video-info cache.
    const episode = detail.episodes[0];
    if (episode && hgEngine) {
      await sharedResource(`qualities:${episode.id}`, () => hgEngine.fetchVideoInfo(episode.id), { signal });
    }
  } else {
    if (!hgEngine) throw new Error('播放引擎不可用');
    await sharedResource(`qualities:${target.id}`, () => hgEngine.fetchVideoInfo(target.id), { signal });
  }
}), { enabled: process.env.HG_PREFETCH_ENABLED !== '0', concurrency: 2 });

const server = http.createServer(async (req, res) => {
  const reqStart = Date.now();
  // Keep B6's reqStart/X-Response-Time chain; monotonic tracing is opt-in.
  if (process.env.HG_TIMING === '1') traceRequest(req, res);
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = u.pathname;
  res.on("finish", () => {
    if (typeof console?.log === "function") {
      console.log(`[timing] ${pathname} cost=${Date.now() - reqStart}ms`);
    }
  });

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    });
    return res.end();
  }

  // 1. 健康检查
  // 说明：ok:true 只表示「进程活着」，不代表「能播」。
  // 2026-10-15 事故中上游返回空体，进程完全健康但三端全不可播，
  // 因此这里额外暴露 playback 段，让调用方能区分「活着」与「能用」。
  if (pathname === "/health") {
    const stats = hgEngine?.upstreamStats ?? null;
    const engineLoaded = Boolean(hgEngine);
    // 有历史样本时，最近一批是否全为空体（上游静默降级）
    const upstreamDegraded = Boolean(
      stats && stats.empty > 0 && stats.ok === 0
    );
    return json(res, {
      service: "hongguotv-custom-bridge",
      version: "2.3.0",
      ok: true,
      playback: {
        engineLoaded,
        // 只有确认近期成功过，才敢说可播
        upstreamHealthy: engineLoaded && !upstreamDegraded && (stats ? stats.ok > 0 : false),
        upstreamDegraded,
        stats: stats
          ? { total: stats.total, ok: stats.ok, empty: stats.empty, error: stats.error }
          : null,
      },
    });
  }

  // 1.1 静态托管 Web/PC 产物 (部署后端即自带 Web 前端页面)
  if (!pathname.startsWith("/api/")) {
    if (serveStatic(res, pathname)) {
      return;
    }
  }

  try {
    if (pathname === '/api/prefetch' && req.method === 'POST') {
      const input = await readJson(req);
      const result = prefetchQueue.submit(input.targets);
      return json(res, result, result.enabled ? 202 : 200, { 'Cache-Control': 'no-store' });
    }
    const prefetchMatch = /^\/api\/prefetch\/([a-f0-9-]{36})$/.exec(pathname);
    if (prefetchMatch && ['GET', 'DELETE'].includes(req.method)) {
      const result = req.method === 'DELETE' ? prefetchQueue.cancel(prefetchMatch[1]) : prefetchQueue.status(prefetchMatch[1]);
      return json(res, result || { error: '预取任务不存在或已过期' }, result ? 200 : 404, { 'Cache-Control': 'no-store' });
    }
    if (await handleLibrary(req, res, u)) return;
  if (await handleHistory(req, res, u)) return;
    // 2. 官方大轮播 Banner API
    if (pathname === "/api/banners") {
      const cached = hotLruCache.get("hot:banners");
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      const data = await fetchOfficialHome();
      const payload = { banners: data.banners };
      hotLruCache.set("hot:banners", payload);
      return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
    }

    // 2.1 官方首页专区列表 (GET /api/sections)
    if (pathname === "/api/sections") {
      const cached = hotLruCache.get("hot:sections");
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      const data = await fetchOfficialHome();
      const payload = { sections: data.sections };
      hotLruCache.set("hot:sections", payload);
      return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
    }

    // 3. 官方分类标签池 (GET /api/category/tags)
    if (pathname === "/api/category/tags") {
      const type = u.searchParams.get("type") || "real-drama";
      const cacheKey = `hot:cat:tags:${type}`;
      const cached = hotLruCache.get(cacheKey);
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      try {
        const payload = await coreProvider.categoryMetadata(type);
        hotLruCache.set(cacheKey, payload);
        return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
      } catch(error) {
        return json(res, { error: error.message }, error.status || 502, {}, reqStart);
      }
    }

    // 4. 官方分类短剧列表 (GET /api/category/list?type=real-drama&tag=romance&page=1)
    if (pathname === "/api/category/list") {
      const type = u.searchParams.get("type") || "real-drama";
      const tag = u.searchParams.get("tag") || "";
      const page = Number(u.searchParams.get("page") || "1");
      const cacheKey = `hot:cat:list:${type}:${tag}:${page}`;
      const cached = hotLruCache.get(cacheKey);
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      try {
        const payload = await coreProvider.categoryList(type, tag, page);
        hotLruCache.set(cacheKey, payload);
        return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
      } catch(error) {
        return json(res, { error: error.message }, error.status || 502, {}, reqStart);
      }
    }

    // 5. 官方排行榜类别 (GET /api/rank/types)
    if (pathname === "/api/rank/types") {
      return json(res, { types: OFFICIAL_RANK_TYPES }, 200, {}, reqStart);
    }

    // 5.1 官方四大排行榜分页列表 (GET /api/rank/list?type=hot-drama&page=1)
    if (pathname === "/api/rank/list" || pathname === "/api/rank/page") {
      const slug = u.searchParams.get("type") || u.searchParams.get("slug") || "hot-drama";
      const page = parseInt(u.searchParams.get("page") || "1", 10);
      const cacheKey = `hot:rank:${slug}:${page}`;
      const cached = hotLruCache.get(cacheKey);
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      const data = await fetchOfficialRankPage(slug, page);
      hotLruCache.set(cacheKey, data);
      return json(res, data, 200, { "X-Cache": "MISS" }, reqStart);
    }

    // 5.2 兼容旧版全量四大排行榜 (GET /api/ranks)
    if (pathname === "/api/ranks") {
      const cached = hotLruCache.get("hot:ranks:all");
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      const home = await fetchOfficialHome();
      const ranks = home.sections.map((sec) => ({
        key: sec.type,
        title: sec.name.includes("榜") ? sec.name : `${sec.name}榜`,
        items: sec.items,
      }));
      const payload = { ranks };
      hotLruCache.set("hot:ranks:all", payload);
      return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
    }

    // 6. 全库短剧综合推荐接口 (GET /api/recommend 或 GET /api/home)
    if (pathname === "/api/recommend") {
      try {
        const page = Number(u.searchParams.get("page") || 1);
        const session = u.searchParams.get("session") || "default";
        const cacheKey = `hot:recommend:${session}:${page}`;
        const cached = hotLruCache.get(cacheKey);
        if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
        const data = await recommendations.page(session, page);
        hotLruCache.set(cacheKey, data, 60000);
        // B6: 预取推荐前置短剧详情与首集清晰度，利用空闲连接加速切剧
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const targets = data.items.slice(0, 2)
            .filter((it) => it && it.id && /^\d+$/.test(String(it.id)))
            .map((it) => ({ kind: "detail", id: String(it.id) }));
          if (targets.length) {
            try { prefetchQueue.submit(targets); } catch (_) {}
          }
        }
        return json(res, data, 200, { "X-Cache": "MISS" }, reqStart);
      } catch(error) {
        return json(res, { error: error.message || '推荐读取失败' }, error instanceof RecommendationError ? error.status : 502, {}, reqStart);
      }
    }
    if (pathname === "/api/home") {
      const page = parseInt(u.searchParams.get("page") || "1", 10);
      const cacheKey = `hot:home:${page}`;
      const cached = hotLruCache.get(cacheKey);
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      try {
        const upstreamRes = { data: await coreProvider.home(page) };
        if (upstreamRes.data && Array.isArray(upstreamRes.data.items) && upstreamRes.data.items.length > 0) {
          hotLruCache.set(cacheKey, upstreamRes.data);
          return json(res, upstreamRes.data, 200, { "X-Cache": "MISS" }, reqStart);
        }
      } catch (err) {
        // 上游不可用时自动降级到官方 Web 分类推荐池
      }
      const cat = await fetchOfficialCategory("real-drama", "", page);
      const payload = { items: cat.items, page };
      hotLruCache.set(cacheKey, payload);
      return json(res, payload, 200, { "X-Cache": "MISS" }, reqStart);
    }


    // 7. 搜索接口 (GET /api/search?q=...)
    if (pathname === "/api/search") {
      const q = u.searchParams.get("q") || "";
      const page = Number(u.searchParams.get("page") || 1);
      const cacheKey = `hot:search:${q}:${page}`;
      const cached = hotLruCache.get(cacheKey);
      if (cached) return json(res, cached, 200, { "X-Cache": "HIT" }, reqStart);
      const upstreamRes = { data: await coreProvider.search(q, page) };
      if (upstreamRes.data && Array.isArray(upstreamRes.data.items) && upstreamRes.data.items.length > 0) {
        hotLruCache.set(cacheKey, upstreamRes.data, 180000);
      }
      return json(res, upstreamRes.data, 200, { "X-Cache": "MISS" }, reqStart);
    }

    // 8. 单剧相关推荐 / 猜你喜欢 (GET /api/series/:id/related 或 GET /api/series/:id/recommend)
    const relMatch = /^\/api\/series\/(\d+)\/(?:related|recommend)$/.exec(pathname);
    if (relMatch) {
      const seriesId = relMatch[1];
      const limit = parseInt(u.searchParams.get("limit") || "16", 10);
      const page = Math.max(1, parseInt(u.searchParams.get("page") || "1", 10));
      try {
        const detailRes = {data: await coreProvider.detail(seriesId)};
        const seriesData = detailRes.data;
        const tags = (seriesData.tags || "").split(/[\/,，\s]+/).filter(Boolean);
        const firstTag = tags[0] || "";

        let relatedItems = [];
        const seenIds = new Set([String(seriesId)]);

        // 1. 优先按相关题材/标签搜索（支持按页抓取）
        for (const t of (tags.length ? tags.slice(0, 3) : ["热播"])) {
          try {
            const searchRes = {data: await coreProvider.search(t,page)};
            for (const item of searchRes.data?.items || []) {
              const sid = String(item.id);
              if (!seenIds.has(sid)) {
                seenIds.add(sid);
                relatedItems.push(item);
              }
            }
          } catch (_) {}
          if (relatedItems.length >= limit) break;
        }

        // 2. 如果数量不足，从主页推荐与算法流按页补充
        let recPage = page;
        while (relatedItems.length < limit && recPage <= page + 2) {
          try {
            const recRes = {data: await coreProvider.home(recPage)};
            for (const item of recRes.data?.items || []) {
              const sid = String(item.id);
              if (!seenIds.has(sid)) {
                seenIds.add(sid);
                relatedItems.push(item);
              }
            }
          } catch (_) {}
          recPage++;
        }

        // 3. 兜底保障：官方网页分类列表
        if (relatedItems.length < limit) {
          try {
            const cat = await fetchOfficialCategory("real-drama", "", page);
            for (const item of cat.items || []) {
              const sid = String(item.id);
              if (!seenIds.has(sid)) {
                seenIds.add(sid);
                relatedItems.push(item);
              }
            }
          } catch (_) {}
        }

        return json(res, {
          seriesId,
          keyword: firstTag,
          page,
          items: relatedItems.slice(0, limit),
        });
      } catch (err) {
        const home = await fetchOfficialHome();
        const fallbackItems = (home.banners || [])
          .concat(home.sections?.[0]?.items || [])
          .filter((item) => String(item.id) !== String(seriesId));
        return json(res, { seriesId, keyword: "", page, items: fallbackItems.slice(0, limit) });
      }
    }

    // 8.1 剧集详情 (GET /api/series/:id)
    if (pathname.startsWith("/api/series/")) {
      const id = decodeURIComponent(pathname.slice("/api/series/".length));
      const fresh = u.searchParams.get('fresh') === '1' || u.searchParams.get('fresh') === 'true';
      const cacheStatus = fresh ? 'BYPASS' : coreProvider.detailCacheStatus(id);
      const upstreamRes = {data: await prefetchQueue.foreground(() => coreProvider.detail(id, { fresh }))};
      const seriesData = upstreamRes.data;
      if (seriesData && Array.isArray(seriesData.episodes)) {
        for (const ep of seriesData.episodes) {
          vidToSeriesMap.set(String(ep.id), String(seriesData.id));
        }
      }
      return json(res, seriesData, 200, { 'X-Cache': cacheStatus, 'Cache-Control': 'no-store' });
    }


    // 9. 官方多画质清晰度列表 (GET /api/episodes/:id/qualities)
    // 动态从官方接口读取该视频实际拥有的全部可解码播放清晰度档位，严格过滤会导致解码器崩溃的 bytevc2 私有流
    const qMatch = /^\/api\/episodes\/(\d+)\/qualities$/.exec(pathname);
    if (qMatch) {
      const episodeId = qMatch[1];
      const list = [];
      const seenKeys = new Set();
      let qualityFailure = hgEngine ? "NO_PLAYABLE_QUALITY" : "ENGINE_UNAVAILABLE";

      const labelMap = {
        2160: "4K 超高清",
        1440: "2K 超清",
        1080: "1080P 超清",
        720: "720P 高清",
        540: "540P 高清",
        480: "480P 标清",
        360: "360P 流畅",
      };

      if (hgEngine) {
        try {
          const info = await prefetchQueue.foreground(() => sharedResource(`qualities:${episodeId}`, () => hgEngine.fetchVideoInfo(episodeId)));
          if (info.rows && Array.isArray(info.rows)) {
            for (const row of info.rows) {
              const qNum = hgEngine.qualityNumber(row.quality || row.item?.vheight || row.key);
              const key = qNum ? `${qNum}P` : (row.item?.definition || row.key).toUpperCase();
              const codec = row.item?.codec_type;

              // 核心过滤：bytevc2 是字节跳动未开源私有编码，标准浏览器与电视机芯会直接触发 PIPELINE_ERROR_DECODE 崩溃
              // 仅保留官方真实支持解码的流（如 bytevc1/HEVC 或 H.264）
              if (codec === "bytevc2") {
                continue;
              }

              if (seenKeys.has(key)) continue;
              seenKeys.add(key);

              const label = labelMap[qNum] || `${key} ${row.quality || ""}`.trim();
              list.push({
                key,
                label,
                qualityNum: qNum || 0,
                codec: codec === "bytevc1" ? "HEVC" : (codec || "H.264"),
                rawKey: row.key,
                isDefault: false,
              });
            }
          }
        } catch (e) {
          qualityFailure = "UPSTREAM_UNAVAILABLE";
          console.warn("[Official Qualities Fetch Error]:", e.message);
        }
      }

      // 兜底保障
      if (list.length === 0) {
        return json(res, { episodeId, defaultQuality: null, qualities: [],
          code: qualityFailure, error: "无法获取可播放的清晰度，请重试" }, 502);
      } else {
        // 按分辨率从高到低排序，最高清晰度设为默认
        list.sort((a, b) => b.qualityNum - a.qualityNum);
        list[0].isDefault = true;
      }

      return json(res, {
        episodeId,
        defaultQuality: list[0]?.key || "1080P",
        qualities: list,
      });
    }

    // 10. 单集播放地址解析 (GET /api/episodes/:id/play)
    const pMatch = /^\/api\/episodes\/(\d+)\/play$/.exec(pathname);
    if (pMatch) {
      const episodeId = pMatch[1];
      const quality = u.searchParams.get("quality") || "1080P";
      const seriesId = u.searchParams.get("seriesId") || u.searchParams.get("series_id") || vidToSeriesMap.get(episodeId) || "";
      const sParam = seriesId ? `&seriesId=${encodeURIComponent(seriesId)}` : "";
      return json(res, {
        path: `/api/episodes/${episodeId}/stream?quality=${encodeURIComponent(quality)}${sParam}`,
        contentType: "video/mp4",
      });
    }

    // 11. MP4 视频媒体流代理 (支持官方全部实际拥有的 1080P/720P/540P/480P/360P 真实画质流，实时解密并支持 Range)
    const sMatch = /^\/api\/episodes\/(\d+)\/stream$/.exec(pathname);
    if (sMatch) {
      const episodeId = sMatch[1];
      const quality = u.searchParams.get("quality") || "1080P";

      // 走本地解密引擎调度官方 HEVC (bytevc1) 视频流
      if (hgEngine) {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        res.once("close", cancel);
        try {
          // resolveStream shares videoInfoPending with qualities prefetch. Subscribe
          // before parsing so cancelling the background batch cannot abort playback.
          if (typeof hgEngine.fetchVideoInfo === 'function') {
            await prefetchQueue.foreground(() => sharedResource(`qualities:${episodeId}`, () => hgEngine.fetchVideoInfo(episodeId), { signal: controller.signal }));
          }
          const stream = await hgEngine.resolveStream(episodeId, quality);
          const prepared = await hgEngine.prepareHeader(stream);
          if (res.destroyed || controller.signal.aborted) return;
          const range = byteRange(req.headers.range, prepared.total);
          if (!range) {
            res.writeHead(416, {
              "Content-Range": `bytes */${prepared.total}`,
              "Access-Control-Allow-Origin": "*",
            });
            return res.end();
          }
          const [start, end] = range;
          const headers = {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
          };
          if (req.headers.range) {
            headers["Content-Range"] = `bytes ${start}-${end}/${prepared.total}`;
          }
          const chunkSize = 1024 * 1024;
          // Validate media before advertising success; HEAD only needs the prepared metadata.
          let firstChunk = null;
          if (req.method !== "HEAD") {
            const raw = await hgEngine.remoteRange(stream, start, Math.min(start + chunkSize - 1, end), controller.signal);
            firstChunk = hgEngine.decryptPartial(raw.data, start, stream.key, prepared);
          }
          if (res.destroyed || controller.signal.aborted) return;
          res.writeHead(req.headers.range ? 206 : 200, headers);
          if (req.method === "HEAD") return res.end();

          for (let offset = start; offset <= end && !res.destroyed; offset += chunkSize) {
            const chunkEnd = Math.min(offset + chunkSize - 1, end);
            let chunk = firstChunk;
            if (offset !== start) {
              const raw = await hgEngine.remoteRange(stream, offset, chunkEnd, controller.signal);
              chunk = hgEngine.decryptPartial(raw.data, offset, stream.key, prepared);
            }
            if (res.destroyed) break;
            if (!res.write(chunk)) {
              await new Promise((resolve) => {
                const done = () => {
                  res.off("drain", done);
                  res.off("close", done);
                  resolve();
                };
                res.on("drain", done);
                res.on("close", done);
              });
            }
          }
          return res.end();
        } catch (err) {
          if (res.destroyed || controller.signal.aborted) return;
          if (res.headersSent) {
            res.destroy();
            return;
          }
          console.warn(`[Stream Engine Error for ${quality}]:`, err.message);
        } finally {
          res.off("close", cancel);
          controller.abort();
        }
      }

      return json(res, { error: "无法加载指定清晰度的视频媒体流" }, 502);
    }

    return json(res, { error: "404 Not Found" }, 404);
  } catch (err) {
    console.error("[API Gateway Error]:", err.message);
    return json(res, { error: err.message }, err.status || 500);
  }
});

listenWithFallback(server, PORT, process.env.HG_HOST || "0.0.0.0", listenOptions.attempts).then(actualPort => {
  try { fs.writeFileSync(path.join(DATA_DIR, "service-address.json"), JSON.stringify({pid:process.pid,port:actualPort})); }
  catch(error) { console.warn(`无法登记开发代理地址：${error.message}；可用 HG_BACKEND_URL 指定实际服务地址。`); }
  if (process.send) process.send({type:"ready",port:actualPort});
  console.log(`===============================================`);
  console.log(`🚀 红果全能 Bridge 服务端 (v2.3 官方全量 Top 100 榜单版) 已启动!`);
  console.log(`📡 监听地址: http://localhost:${actualPort}`);
  console.log(`🎬 包含板块: 官方首页Banner、24题材分类、官方四大热播榜(Top 100 分页)、MP4解密流代理`);
  console.log(`===============================================`);
  if (process.env.NODE_ENV !== "test") {
    fetchOfficialHome().catch(() => {});
  }
}).catch(error => { console.error(error.message); librarySync.stop(); libraryStore.close(); historyStore.close(); process.exitCode=1; if(process.connected)process.disconnect(); });

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return; shuttingDown = true; librarySync.stop(); prefetchQueue.close();
  const addressFile=path.join(DATA_DIR,"service-address.json");
  try { if(JSON.parse(fs.readFileSync(addressFile,"utf8")).pid===process.pid)fs.unlinkSync(addressFile); } catch {}
  server.close(() => { libraryStore.close(); historyStore.close(); process.exit(0); });
  server.closeAllConnections();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
process.on("message", message => { if (message?.type === "shutdown") shutdown(); });
process.on("disconnect", () => { if (process.env.HG_MANAGED === "1") shutdown(); });
