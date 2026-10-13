import React, { useState, useEffect, useRef } from "react";
import { historyUuid } from "./history-outbox.mjs";
import { RecommendationSession, RecommendationWatch, bindRecommendationPlayback } from "./recommendation-session.mjs";
import { 
  api,
  saveRecommendationSignal, resetRecommendationPreferences, commitRecommendationPreferences,
  getFavorites, 
  toggleFavorite, 
  getProgress,
  getServerProgress,
  beginHistory,
  saveProgress, 
  getHistoryList,
  removeHistoryItem,
  clearHistory,
  getSearchHistory,
  saveSearchHistory,
  removeSearchHistory,
  clearSearchHistory,
  getSettings, 
  saveSettings, getPlaybackPreferences, savePlaybackPreference, getSyncStatus, configureSync, refreshLibrary
} from "./api";
import { 
  BannerItem, 
  CategoryTag, 
  CategoryType, 
  Detail, 
  Episode, 
  RankItem, 
  RankTypeItem, 
  Section, 
  Series, RecommendationMode, 
  Settings,
  VideoQualityItem,
  SeasonInfo,
  HistoryItem
} from "./types";
import { 
  Play, 
  Pause,
  Search, 
  Heart, 
  Settings as SettingsIcon, 
  Sparkles, 
  ArrowLeft, 
  ChevronRight, 
  ChevronLeft, 
  Film, 
  Flame, 
  ChevronDown,
  ChevronUp,
  UserCheck, 
  Palette, 
  Bot, 
  Grid, 
  Trophy, 
  Crown, 
  RefreshCw, 
  Compass,
  Star,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Gauge,
  Check,
  RotateCcw,
  Sliders,
  HelpCircle,
  X,
  Layers,
  Clock,
  Trash2,
  Tag,
  Tv
} from "lucide-react";

export default function App() {
  // 顶层主标签：首页 | 推荐刷剧 | 分类 | 榜单 | 搜索 | 追剧 | 设置
  const [tab, setTabState] = useState<"home" | "recommend" | "category" | "rank" | "search" | "favorites" | "settings">("home");

  // 1. 首页状态
  const [selectedHomeSection, setSelectedHomeSection] = useState<string>("all");
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);

  // 2. 分类状态 (对应官方 category/real-drama)
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([
    { id: "real-drama", name: "真人剧" },
    { id: "comic-drama", name: "漫剧" },
    { id: "ai-drama", name: "AI剧" },
  ]);
  const [categoryTags, setCategoryTags] = useState<CategoryTag[]>([]);
  const categoryTagsRequest=useRef(0);
  const categoryListRequest=useRef(0);
  const [categoryTagsLoading,setCategoryTagsLoading]=useState(false);
  const [categoryError,setCategoryError]=useState("");
  const [categoryTotalPages,setCategoryTotalPages]=useState(0);
  const [selectedCatType, setSelectedCatType] = useState<string>("real-drama");
  const [selectedCatTag, setSelectedCatTag] = useState<string>("");
  const [categoryItems, setCategoryItems] = useState<Series[]>([]);
  const [catPage, setCatPage] = useState<number>(1);
  const [catLoading, setCatLoading] = useState(false);

  // 3. 官方榜单状态 (对应图一官方横幅与 4 大子榜单，每页 20 部共 5 页 100 名)
  const [rankTypes, setRankTypes] = useState<RankTypeItem[]>([
    { slug: "hot-drama", name: "红果热播榜", key: "all" },
    { slug: "hot-real-drama", name: "真人剧热播榜", key: "real" },
    { slug: "hot-ai-drama", name: "AI剧热播榜", key: "ai" },
    { slug: "hot-comic-drama", name: "漫剧热播榜", key: "comic" },
  ]);
  const [selectedRankSlug, setSelectedRankSlug] = useState<string>("hot-drama");
  const [rankItems, setRankItems] = useState<RankItem[]>([]);
  const [rankPage, setRankPage] = useState<number>(1);
  const [rankTotalPages, setRankTotalPages] = useState<number>(5);
  const [rankLoading, setRankLoading] = useState(false);

  // 4. 搜索状态 (任务 06: 热搜榜、搜索历史、实时输入联想、题材快筛)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Series[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistoryList, setSearchHistoryList] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<Series[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [searchFilterTag, setSearchFilterTag] = useState<string>("全部");
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 热门搜索推荐词 (基于官方热榜与爆款关键词)
  const hotSearchKeywords = [
    "太奶奶",
    "反向拿捏",
    "逆袭",
    "重生",
    "神豪",
    "战神",
    "甜宠",
    "穿越",
    "霸总",
    "白月光"
  ];

  // 搜索快筛标签
  const searchFilterTags = ["全部", "真人", "漫剧", "AI剧", "逆袭", "甜宠", "重生", "都市", "古装"];

  // 🌟 4.1 沉浸式刷剧流状态 (任务 07: PC滚轮/上下键 + 9:16竖屏大流容器 + 随刷随播)
  const [streamList, setStreamList] = useState<Series[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);
  const [streamPage, setStreamPage] = useState(1);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>(getPlaybackPreferences().recommendationMode);
  const [showRecommendationResetConfirm, setShowRecommendationResetConfirm] = useState(false);
  const streamFeedRef = useRef<any>(null);
  const streamWatchRef = useRef<any>(null);
  const detailWatchRef = useRef<any>(null);
  const streamDetailLoaderRef = useRef<any>(null);
  const streamStartRequest = useRef(0);
  const recommendationSignalEpoch = useRef({feed: "", session: "", resetAt: getPlaybackPreferences().recommendationResetAt});
  const [streamCurrentEpisode, setStreamCurrentEpisode] = useState<Episode | null>(null);
  const [streamDetail, setStreamDetail] = useState<Detail | null>(null);
  const [streamDetailLoading, setStreamDetailLoading] = useState(false);
  const [streamIsPlaying, setStreamIsPlaying] = useState(true);
  const [streamCurrentTime, setStreamCurrentTime] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamDescriptionExpanded, setStreamDescriptionExpanded] = useState(false);
  const [streamVideoFit, setStreamVideoFit] = useState<"contain" | "cover">("contain");
  const [streamIsLandscape, setStreamIsLandscape] = useState<boolean>(false);
  const [streamEpisodeIndex, setStreamEpisodeIndex] = useState<number>(0);
  const [streamPlaybackSpeed, setStreamPlaybackSpeed] = useState<number>(1.0);
  const [streamShowSpeedMenu, setStreamShowSpeedMenu] = useState<boolean>(false);
  const [streamQuality, setStreamQuality] = useState<string>("1080P");
  const [streamShowQualityMenu, setStreamShowQualityMenu] = useState<boolean>(false);
  const [streamQualities, setStreamQualities] = useState<VideoQualityItem[]>([]);
  const [streamQualitiesLoading, setStreamQualitiesLoading] = useState<boolean>(false);
  const [streamIsDraggingProgress, setStreamIsDraggingProgress] = useState<boolean>(false);
  const streamQualitySwitchTimeRef = useRef<number | null>(null);
  const streamVideoRef = useRef<HTMLVideoElement>(null);
  const streamWheelLockRef = useRef(false);

  // 5. 播放器与画质倍速控制状态
  const [activeSeries, setActiveSeriesState] = useState<Detail | null>(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [favorites, setFavorites] = useState<Series[]>([]);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyStorageWarning, setHistoryStorageWarning] = useState("");
  const historyRequest = useRef(0);
  const detailRequest = useRef(0);
  const streamDetailRequest = useRef(0);
  const navigationGeneration = useRef(0);
  const invalidatePlaybackRequests = () => {
    detailRequest.current++; streamDetailRequest.current++; navigationGeneration.current++;
    streamFeedRef.current?.cancel(); streamWatchRef.current?.leave(); detailWatchRef.current?.leave();
    setLoading(false); setStreamDetailLoading(false);
  };
  const setTab = (next: typeof tab) => { invalidatePlaybackRequests(); setTabState(next); };
  const setActiveSeries = (next: Detail | null) => { if (!next) invalidatePlaybackRequests(); setActiveSeriesState(next); };
  useEffect(() => () => { detailRequest.current++; streamDetailRequest.current++; navigationGeneration.current++; }, []);

  const [favSubTab, setFavSubTab] = useState<"favorites" | "history">("favorites");
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteKey, setRemoteKey] = useState("");
  const [syncSaving, setSyncSaving] = useState(false);
  const remoteUrlTouched = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!detailWatchRef.current) detailWatchRef.current = new RecommendationWatch(saveRecommendationSignal);
  if (!streamWatchRef.current) streamWatchRef.current = new RecommendationWatch(saveRecommendationSignal);
  if (!streamFeedRef.current) streamFeedRef.current = new RecommendationSession(
    (page: number, session: string, signal: AbortSignal) => api.getRecommendStream(page, session, signal),
    undefined,
    (state: any) => {setStreamList(state.items);setStreamIndex(state.index);setStreamPage(state.page);setStreamLoading(state.loading);setStreamError(state.error);},
    (series: Series, session: string, reason?: string) => {streamWatchRef.current.leave(reason);beginRecommendationExposure(series, session);void streamDetailLoaderRef.current?.(series);}
  );



  const beginRecommendationExposure = (series: Series, session: string) => {
    const epoch = recommendationSignalEpoch.current, resetAt = getPlaybackPreferences().recommendationResetAt;
    if (epoch.feed !== session) {epoch.feed = session;epoch.session = session;epoch.resetAt = resetAt;}
    else if (epoch.resetAt !== resetAt) {streamWatchRef.current.discard();epoch.resetAt = resetAt;epoch.session = historyUuid();}
    streamWatchRef.current.begin(epoch.session, series);
  };

  // 官方真实画质清晰度状态
  const [videoQualities, setVideoQualities] = useState<VideoQualityItem[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>(() => {
    try {
      return getPlaybackPreferences().quality || "1080P";
    } catch {
      return "1080P";
    }
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);

  // 🌟 同类好剧推荐状态 (任务 01: 猜你喜欢 & 任务 02: 换一批)
  const [relatedSeries, setRelatedSeries] = useState<Series[]>([]);
  const [relatedPool, setRelatedPool] = useState<Series[]>([]);
  const [relatedPage, setRelatedPage] = useState<number>(1);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedRefreshing, setRelatedRefreshing] = useState(false);
  const [refreshRotateDeg, setRefreshRotateDeg] = useState(0);
  const [relatedKeyword, setRelatedKeyword] = useState<string>("");
  const [recommendFadeIn, setRecommendFadeIn] = useState(true);

  // 🌟 全剧终「片尾推荐弹窗」状态 (任务 03)
  const [showSeriesEndModal, setShowSeriesEndModal] = useState(false);
  const [seriesEndCountdown, setSeriesEndCountdown] = useState(5);
  const [seriesEndTarget, setSeriesEndTarget] = useState<Series | null>(null);

  // 🌟 多季短剧状态 (任务 04: 智能季数识别与快速换季)
  const [seasonsList, setSeasonsList] = useState<SeasonInfo[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

  // 选集区间状态 (每页 50 集，10 列 x 5 排)
  const [episodeRangeIndex, setEpisodeRangeIndex] = useState(0);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  // 播放倍速状态 (0.75x ~ 3.0x)

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const saved = String(getPlaybackPreferences().speed);
      if (saved) return Number(saved);
    } catch {}
    return 1.0;
  });
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // 播放器控制与交互状态
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const qualitySwitchTimeRef = useRef<number | null>(null);


  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    loadHomeData();
    loadCategoryTags();
    loadRankTypes();
    setFavorites(getFavorites());
    void refreshHistory();
    setSearchHistoryList(getSearchHistory());
  }, []);

  const refreshHistory = async () => {
    const request = ++historyRequest.current;
    try {
      const items = await getHistoryList();
      if (request === historyRequest.current) { setHistoryList(items); setHistoryError(""); }
    } catch { if (request === historyRequest.current) setHistoryError("历史记录服务不可用，待上传进度将在恢复连接后补传。"); }
  };
  useEffect(() => {
    if (tab !== "favorites" || activeSeries || favSubTab !== "history") return;
    void refreshHistory();
    const timer = setInterval(() => void refreshHistory(), 1000);
    return () => { clearInterval(timer); historyRequest.current++; };
  }, [favSubTab, tab, activeSeries]);
  useEffect(() => {
    const warning = (event: Event) => setHistoryStorageWarning((event as CustomEvent<string>).detail);
    window.addEventListener("history-storage-error", warning);
    return () => window.removeEventListener("history-storage-error", warning);
  }, []);

  useEffect(() => {
    const update = () => {
      const pref = getPlaybackPreferences();
      const epoch = recommendationSignalEpoch.current;
      if (epoch.resetAt !== pref.recommendationResetAt) {
        streamWatchRef.current.discard();detailWatchRef.current.discard();
        epoch.resetAt = pref.recommendationResetAt;epoch.session = historyUuid();
        const series = streamFeedRef.current.items[streamFeedRef.current.index];
        if (tab === "recommend" && !activeSeries && series && streamCurrentEpisode) streamWatchRef.current.begin(epoch.session, series);
        else if (activeSeries) detailWatchRef.current.begin(historyUuid(), activeSeries);
      }
      setRecommendationMode(pref.recommendationMode); setFavorites(getFavorites()); setSearchHistoryList(getSearchHistory()); const status=getSyncStatus(); setSyncStatus(status); if(!remoteUrlTouched.current)setRemoteUrl(status.url); if(!activeSeries && tab!=="recommend"){const pref=getPlaybackPreferences();setPlaybackSpeed(pref.speed);setCurrentQuality(pref.quality);} };
    window.addEventListener("library-updated", update); void refreshLibrary().then(update).catch(()=>{});
    return () => window.removeEventListener("library-updated", update);
  }, [activeSeries,tab,streamCurrentEpisode?.id]);
  useEffect(() => { if(!activeSeries && tab!=="recommend") {const preferences=getPlaybackPreferences();setPlaybackSpeed(preferences.speed);setCurrentQuality(preferences.quality);} }, [activeSeries,tab]);
  const refreshSearchHistory = () => {
    setSearchHistoryList(getSearchHistory());
  };

  // 轮播定时器
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners]);

  // 分类筛选变动时加载
  useEffect(() => {
    if (tab === "category") {
      fetchCategoryList(selectedCatType, selectedCatTag, catPage);
    }
  }, [tab, selectedCatType, selectedCatTag, catPage]);
  useEffect(()=>{void loadCategoryTags(selectedCatType);},[selectedCatType]);

  // 榜单类型或页码变动时加载
  useEffect(() => {
    if (tab === "rank") {
      fetchRankList(selectedRankSlug, rankPage);
    }
  }, [tab, selectedRankSlug, rankPage]);

  useEffect(() => {
    if (tab !== "recommend" || activeSeries) return;
    const feed = streamFeedRef.current;
    if (feed.needsRestart(getPlaybackPreferences())) void loadStreamData(1, false);
    else if (feed.items[feed.index] && !streamWatchRef.current.active) void loadStreamDetail(feed.items[feed.index]);
  }, [tab, activeSeries]);
  useEffect(() => {
    const feed = streamFeedRef.current;
    if (tab === "recommend" && !activeSeries && feed.items.length && feed.index >= feed.items.length - 3 && !feed.exhausted) {
      void feed.load().catch(() => {});
    }
  }, [tab, activeSeries, streamIndex, streamList.length, streamPage]);
  useEffect(() => {
    const watch = streamWatchRef.current, video = streamVideoRef.current;
    if (tab !== "recommend" || activeSeries || !video) {watch.pause();return;}
    return bindRecommendationPlayback(video, watch);
  }, [tab, activeSeries, streamCurrentEpisode?.id, streamQuality]);

  // 🌟 PC端键盘上下键切剧 (仅在 recommend 标签且无主动播放弹窗时生效)
  useEffect(() => {
    if (tab !== "recommend" || activeSeries) return;

    const handleStreamKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleSwitchStream("prev");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleSwitchStream("next");
      } else if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        const video = streamVideoRef.current;
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
            setStreamIsPlaying(true);
          } else {
            video.pause();
            setStreamIsPlaying(false);
          }
        }
      }
    };

    window.addEventListener("keydown", handleStreamKeyDown);
    return () => window.removeEventListener("keydown", handleStreamKeyDown);
  }, [tab, activeSeries, streamIndex, streamList, streamPage]);

  // 加载首页基础数据
  const loadHomeData = async () => {
    try {
      setLoading(true);
      const [bannerData, sectionData] = await Promise.all([
        api.getBanners(),
        api.getSections(),
      ]);
      setBanners(bannerData);
      setSections(sectionData);
    } catch {
      showToast("获取首页数据失败，请确认服务端已启动");
    } finally {
      setLoading(false);
    }
  };

  // 加载分类标签
  const loadCategoryTags = async (type="real-drama") => {
    const request=++categoryTagsRequest.current;
    setCategoryTagsLoading(true);setCategoryTags([]);
    try {
      const res = await api.getCategoryTags(type);
      if(request!==categoryTagsRequest.current)return;
      if (res.types && res.types.length > 0) setCategoryTypes(res.types);
      setCategoryTags(res.tags||[]);
    } catch {
      if(request===categoryTagsRequest.current)setCategoryError("官网题材读取失败，请重试");
    } finally {
      if(request===categoryTagsRequest.current)setCategoryTagsLoading(false);
    }
  };

  // 加载榜单类别定义
  const loadRankTypes = async () => {
    try {
      const types = await api.getRankTypes();
      if (types && types.length > 0) setRankTypes(types);
    } catch {
      console.warn("加载榜单分类失败");
    }
  };

  // 请求分类短剧列表
  const fetchCategoryList = async (type: string, tag: string, page: number) => {
    const request=++categoryListRequest.current;
    try {
      setCatLoading(true);setCategoryError("");setCategoryItems([]);
      const res = await api.getCategoryList(type, tag, page);
      if(request!==categoryListRequest.current)return;
      setCategoryItems(res.items || []);
      setCategoryTotalPages(res.pagination?.totalPages||0);
    } catch {
      if(request===categoryListRequest.current)setCategoryError("官网分类读取失败，请重试");
    } finally {
      if(request===categoryListRequest.current)setCatLoading(false);
    }
  };

  // 请求排行榜单分页列表 (1~5页，每页20部)
  const fetchRankList = async (slug: string, page: number) => {
    try {
      setRankLoading(true);
      const res = await api.getRankPageList(slug, page);
      setRankItems(res.items || []);
      setRankTotalPages(res.totalPages || 5);
    } catch {
      showToast("加载榜单列表失败");
    } finally {
      setRankLoading(false);
    }
  };

  const loadStreamData = async (targetPage = 1, append = false) => {
    try {
      if (append) await streamFeedRef.current.load(targetPage);
      else {
        const request=++streamStartRequest.current, generation=navigationGeneration.current;
        streamFeedRef.current.cancel();
        streamWatchRef.current.leave();streamVideoRef.current?.pause();
        streamDetailRequest.current++;
        setStreamCurrentEpisode(null);setStreamDetail(null);
        const preferences=await commitRecommendationPreferences();
        if(request!==streamStartRequest.current||generation!==navigationGeneration.current)return;
        await streamFeedRef.current.start(preferences);
      }
    } catch { setStreamError("推荐暂时不可用，请检查本地服务后重试"); }
  };

  // 加载当前刷剧项的详情与续播集数
  const loadStreamDetail = async (series: Series) => {
    if (!series) return;
    const request = ++streamDetailRequest.current;
    const session = streamFeedRef.current.id;
    streamWatchRef.current.pause();streamVideoRef.current?.pause();
    setStreamCurrentEpisode(null);setStreamDetail(null);
    if (streamWatchRef.current.active?.value.seriesId !== series.id) beginRecommendationExposure(series, session);
    try {
      setStreamDetailLoading(true);
      setStreamDescriptionExpanded(false);
      setStreamCurrentTime(0);
      setStreamDuration(0);
      setStreamIsLandscape(false);
      
      const detail = await api.getSeries(series.id);

      if (request !== streamDetailRequest.current) return;
      detail.contentType = series.contentType || detail.contentType;
      setStreamDetail(detail);
      const ep = detail.episodes?.[0] || null;
      beginHistory(detail);
      setPlaybackSpeed(getPlaybackPreferences().speed);setStreamPlaybackSpeed(getPlaybackPreferences().speed);
      setStreamEpisodeIndex(0);setStreamCurrentEpisode(ep);
      if (ep) saveProgress(series.id, ep.id, 0, {title: detail.title, cover: detail.cover, badge: detail.badge, tags: detail.tags, episodeNumber: ep.number, duration: 0});
      setStreamIsPlaying(true);streamQualitySwitchTimeRef.current = 0;

      // 加载官方清晰度
      if (ep) {
        setStreamQualitiesLoading(true);
        api.getVideoQualities(ep.id, series.id)
          .then((res) => {
            if (request !== streamDetailRequest.current) return;
            if (res.qualities && res.qualities.length > 0) {
              setStreamQualities(res.qualities);
              const pref = getPlaybackPreferences().quality;
              const hasPref = pref && res.qualities.some((q) => q.key === pref);
              if (hasPref) {
                setStreamQuality(pref);
              } else if (res.defaultQuality) {
                setStreamQuality(res.defaultQuality);
              } else {
                setStreamQuality(res.qualities[0].key);
              }
            }
          })
          .catch(() => {})
          .finally(() => { if (request === streamDetailRequest.current) setStreamQualitiesLoading(false); });
      }
    } catch (err) {
      if (request === streamDetailRequest.current) {setStreamError("剧集加载失败，请重试");console.warn("加载流剧集详情失败:", err);}
    } finally {
      if (request === streamDetailRequest.current) setStreamDetailLoading(false);
    }
  };

  streamDetailLoaderRef.current = loadStreamDetail;

  // 推荐流中无缝播放当前短剧的下一集
  const handleStreamNextEpisode = (automatic = false) => {
    if (!streamDetail || !streamDetail.episodes || streamDetail.episodes.length === 0) return;
    streamWatchRef.current.pause();
    const nextIdx = streamEpisodeIndex + 1;
    if (nextIdx < streamDetail.episodes.length) {
      const nextEp = streamDetail.episodes[nextIdx];
      setStreamEpisodeIndex(nextIdx);
      setStreamCurrentEpisode(nextEp);
      setStreamCurrentTime(0);
      setStreamIsPlaying(true);
      showToast(`已自动连播：第 ${nextEp.number || nextIdx + 1} 集`);
    } else {
      // 当前短剧全集播放完毕，自动切到推荐流下一部短剧
      showToast("本剧已连播完毕，自动为您切换下一部精选短剧");
      if (automatic) streamWatchRef.current.complete();
      handleSwitchStream("next", automatic ? "automatic" : "manual");
    }
  };

  // 推荐流切换画质 (保持当前播放进度秒级续播)
  const handleStreamSelectQuality = (qKey: string) => {
    if (qKey === streamQuality) {
      setStreamShowQualityMenu(false);
      return;
    }
    const video = streamVideoRef.current;
    const prevTime = video ? video.currentTime : streamCurrentTime;
    const wasPaused = video ? video.paused : false;

    streamQualitySwitchTimeRef.current = prevTime;
    setStreamQuality(qKey);
    setStreamShowQualityMenu(false);
    try {
      savePlaybackPreference("quality", qKey);
    } catch {}
    showToast(`清晰度已切换至：${qKey}`);

    if (video) {
      const handleRestoreOnReady = () => {
        if (streamQualitySwitchTimeRef.current !== null && streamQualitySwitchTimeRef.current > 0) {
          video.currentTime = streamQualitySwitchTimeRef.current;
          streamQualitySwitchTimeRef.current = null;
        }
        video.playbackRate = streamPlaybackSpeed;
        if (!wasPaused) {
          video.play().catch(() => {});
        }
      };
      video.addEventListener("loadeddata", handleRestoreOnReady, { once: true });
    }
  };

  // 推荐流切换播放倍速
  const handleStreamSelectSpeed = (speed: number) => {
    setStreamPlaybackSpeed(speed);
    savePlaybackPreference("speed", speed);
    setStreamShowSpeedMenu(false);
    if (streamVideoRef.current) {
      streamVideoRef.current.playbackRate = speed;
    }
    showToast(`倍速已切换至：${speed}x`);
  };

  // Previous remains inside the same session; only explicit next can produce a quick skip.
  const handleSwitchStream = async (direction: "prev" | "next", reason: "manual" | "automatic" = "manual") => {
    try {
      if(streamFeedRef.current.needsRestart(getPlaybackPreferences())){await loadStreamData(1,false);return;}
      const moved = await streamFeedRef.current.advance(direction, reason === "manual" ? direction : "automatic");
      if (!moved && direction === "prev") showToast("已经是本次推荐的第一部");
      else if (!moved) showToast("暂无更多推荐");
    } catch { showToast("推荐加载失败，可重试当前会话"); }
  };

  // 搜索框实时输入联想 (250ms 防抖)
  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
      return;
    }

    setShowSuggestions(true);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      try {
        setIsSuggesting(true);
        const data = await api.search(val.trim(), 1);
        setSearchSuggestions((data.items || []).slice(0, 6));
      } catch {
        setSearchSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);
  };

  // 执行最终搜索 (保存历史、重置筛选、关闭联想浮层)
  const executeSearch = async (queryText: string) => {
    const text = queryText.trim();
    if (!text) return;
    setSearchQuery(text);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    setIsSuggesting(false);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);

    // 保存到本地搜索历史
    const updatedHistory = saveSearchHistory(text);
    setSearchHistoryList(updatedHistory);

    try {
      setSearchLoading(true);
      setHasSearched(true);
      setSearchFilterTag("全部");
      const data = await api.search(text, 1);
      setSearchResults(data.items || []);
    } catch {
      showToast("搜索请求失败，请稍后重试");
    } finally {
      setSearchLoading(false);
    }
  };

  // 表单提交搜索
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(searchQuery);
  };

  // 点击联想候选项
  const handleSelectSuggestion = (item: Series) => {
    saveSearchHistory(item.title);
    setSearchHistoryList(getSearchHistory());
    setShowSuggestions(false);
    setSearchSuggestions([]);
    handleSelectSeries(item);
  };

  // 选择短剧进入播放详情
  const handleSelectSeries = async (series: Series, selectedProgress?: HistoryItem) => {
    const request = ++detailRequest.current;
    try {
      setShowSeriesEndModal(false);
      setLoading(true);
      const detail = await api.getSeries(series.id);
      const prog = selectedProgress || await getServerProgress(series.id).catch(() => null);
      if (request !== detailRequest.current) return;
      let initIndex = 0;
      if (prog && detail.episodes) {
        const found = detail.episodes.findIndex((ep) => ep.id === prog.episodeId);
        if (found !== -1) initIndex = found;
      }
      if (prog?.completed && detail.episodes[initIndex]?.id === prog.episodeId && initIndex < detail.episodes.length - 1) initIndex++;
      beginHistory(detail, prog);
      setPlaybackSpeed(getPlaybackPreferences().speed);
      setStreamPlaybackSpeed(getPlaybackPreferences().speed);
      setActiveSeries(detail);
      setCurrentEpisodeIndex(initIndex);
      setEpisodeRangeIndex(Math.floor(initIndex / 30));
      setShowRangeDropdown(false);

      // 立即记录/更新观看历史（即使刚点进来，也能作为最近浏览/观看记录）
      const ep = detail.episodes?.[initIndex];
      qualitySwitchTimeRef.current = prog?.completed || prog?.episodeId !== ep?.id ? 0 : prog?.position || 0;
      saveProgress(series.id, ep?.id || "", prog?.completed || prog?.episodeId !== ep?.id ? 0 : prog?.position || 0, {
        title: detail.title || series.title,
        cover: detail.cover || series.cover,
        badge: detail.badge || series.badge,
        tags: detail.tags || series.tags,
        episodeNumber: ep?.number || initIndex + 1,
        duration: prog?.duration || 0,
      });
    } catch {
      if (request === detailRequest.current) showToast("获取剧集详情失败");
    } finally {
      if (request === detailRequest.current) setLoading(false);
    }
  };

  // 收藏 / 取消收藏
  const handleToggleFav = (series: Series) => {
    const isFav = toggleFavorite(series);
    setFavorites(getFavorites());
    showToast(isFav ? "已加入我的追剧" : "已从我的追剧移除");
  };

  const currentEpisode: Episode | undefined = activeSeries?.episodes?.[currentEpisodeIndex];
  useEffect(() => {
    const watch = detailWatchRef.current, video = videoRef.current;
    if (!activeSeries || !video) {watch.pause();return;}
    return bindRecommendationPlayback(video, watch);
  }, [activeSeries, currentEpisode?.id, currentQuality]);

  useEffect(() => {
    const snapshot = () => {
      const series = activeSeries || streamList[streamIndex];
      const episode = activeSeries ? currentEpisode : streamCurrentEpisode;
      const video = activeSeries ? videoRef.current : streamVideoRef.current;
      if (!series || !episode || !video || (activeSeries ? qualitySwitchTimeRef.current : streamQualitySwitchTimeRef.current) !== null) return;
      saveProgress(series.id, episode.id, Math.floor(video.currentTime || 0), {
        title: series.title, cover: series.cover, badge: series.badge, tags: series.tags,
        episodeNumber: episode.number, duration: Math.floor(video.duration || 0), completed: video.ended,
      });
    };
    const visibility = () => { if (document.visibilityState === "hidden") snapshot(); };
    window.addEventListener("pagehide", snapshot);
    document.addEventListener("visibilitychange", visibility);
    const video = activeSeries ? videoRef.current : streamVideoRef.current;
    video?.addEventListener("seeked", snapshot);
    return () => {
      window.removeEventListener("pagehide", snapshot);
      document.removeEventListener("visibilitychange", visibility);
      video?.removeEventListener("seeked", snapshot);
    };
  }, [activeSeries, currentEpisode?.id, streamIndex, streamCurrentEpisode?.id]);


  // 1. 选集切换时，从官方真实接口拉取该分集的可播放真实清晰度列表
  useEffect(() => {
    if (!currentEpisode) return;

    let isMounted = true;
    setQualitiesLoading(true);

    api.getVideoQualities(currentEpisode.id, activeSeries?.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.qualities && res.qualities.length > 0) {
          setVideoQualities(res.qualities);
          // 优先匹配用户此前选择的画质，若该画质在当前官方真实支持列表中则复用
          const pref = getPlaybackPreferences().quality;
          const hasPref = pref && res.qualities.some((q) => q.key === pref);
          if (hasPref) {
            setCurrentQuality(pref);
          } else if (res.defaultQuality) {
            setCurrentQuality(res.defaultQuality);
          } else {
            setCurrentQuality(res.qualities[0].key);
          }
        }
      })
      .catch((err) => {
        console.warn("加载官方画质失败:", err);
      })
      .finally(() => {
        if (isMounted) setQualitiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentEpisode?.id, activeSeries?.id]);

  // 🌟 1.5 切换短剧时，自动拉取同题材推荐短剧 (任务 01: 猜你喜欢 & 任务 02: 换一批)
  useEffect(() => {
    if (!activeSeries?.id) {
      setRelatedSeries([]);
      setRelatedPool([]);
      setRelatedKeyword("");
      setRelatedPage(1);
      return;
    }

    let isMounted = true;
    setRelatedLoading(true);
    setRelatedPage(1);
    setRecommendFadeIn(true);

    // 联合拉取同题材与算法流，组建充足的推荐候选池
    Promise.all([
      api.getRelatedSeries(activeSeries.id, 16, 1).catch(() => ({ seriesId: "", keyword: "", items: [] })),
      api.getRecommend(1).catch(() => ({ items: [], page: 1 })),
    ])
      .then(([relRes, recRes]) => {
        if (!isMounted) return;
        const seenIds = new Set<string>([String(activeSeries.id)]);
        const combinedPool: Series[] = [];

        // 优先收纳同题材好剧
        for (const item of relRes.items || []) {
          const sid = String(item.id);
          if (!seenIds.has(sid)) {
            seenIds.add(sid);
            combinedPool.push(item);
          }
        }
        // 补充算法推荐剧集
        for (const item of recRes.items || []) {
          const sid = String(item.id);
          if (!seenIds.has(sid)) {
            seenIds.add(sid);
            combinedPool.push(item);
          }
        }

        setRelatedPool(combinedPool);
        setRelatedSeries(combinedPool.slice(0, 15));
        setRelatedKeyword(relRes.keyword || "");
      })
      .catch((err) => {
        console.warn("加载同类推荐短剧失败:", err);
      })
      .finally(() => {
        if (isMounted) setRelatedLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeSeries?.id]);

  // 🌟 任务 02:「🔄 换一批」智能实时换剧与微动效交互 (一排5个共三排，每次15部)
  const handleRefreshRecommend = async () => {
    if (!activeSeries?.id || relatedRefreshing || relatedLoading) return;

    // 1. 图标旋转 360° 微动效 (连续点击累加角度，永不倒转)
    setRefreshRotateDeg((prev) => prev + 360);
    setRelatedRefreshing(true);

    // 2. 卡片渐变微动效
    setRecommendFadeIn(false);

    const BATCH_SIZE = 15;
    const nextPage = relatedPage + 1;
    const startIndex = (nextPage - 1) * BATCH_SIZE;
    const endIndex = nextPage * BATCH_SIZE;

    // 3. 检查本地缓冲池是否有足够的剧集库存
    if (relatedPool.length >= endIndex) {
      setTimeout(() => {
        setRelatedSeries(relatedPool.slice(startIndex, endIndex));
        setRelatedPage(nextPage);
        setRecommendFadeIn(true);
        setRelatedRefreshing(false);
      }, 180);

      // 后台静默预取下一页充实库存
      if (relatedPool.length < (nextPage + 1) * BATCH_SIZE) {
        Promise.all([
          api.getRelatedSeries(activeSeries.id, 15, nextPage + 1).catch(() => ({ items: [] })),
          api.getRecommend(nextPage + 1).catch(() => ({ items: [] })),
        ]).then(([rel, rec]) => {
          setRelatedPool((prev) => {
            const seen = new Set(prev.map((i) => String(i.id)));
            const addList: Series[] = [];
            for (const item of [...(rel.items || []), ...(rec.items || [])]) {
              const sid = String(item.id);
              if (sid !== String(activeSeries.id) && !seen.has(sid)) {
                seen.add(sid);
                addList.push(item);
              }
            }
            return [...prev, ...addList];
          });
        });
      }
      return;
    }

    // 4. 库存不足，实时向服务端拉取新数据
    try {
      const [moreRelated, moreRec] = await Promise.all([
        api.getRelatedSeries(activeSeries.id, 15, nextPage).catch(() => ({ items: [] })),
        api.getRecommend(nextPage).catch(() => ({ items: [] })),
      ]);

      const seen = new Set<string>([String(activeSeries.id), ...relatedPool.map((i) => String(i.id))]);
      const newItems: Series[] = [];

      for (const item of moreRelated.items || []) {
        const sid = String(item.id);
        if (!seen.has(sid)) {
          seen.add(sid);
          newItems.push(item);
        }
      }
      for (const item of moreRec.items || []) {
        const sid = String(item.id);
        if (!seen.has(sid)) {
          seen.add(sid);
          newItems.push(item);
        }
      }

      setTimeout(() => {
        if (newItems.length >= 8) {
          const updatedPool = [...relatedPool, ...newItems];
          setRelatedPool(updatedPool);
          setRelatedSeries(newItems.slice(0, 15));
          setRelatedPage(nextPage);
        } else {
          // 若全库已轮换到底，平滑循环回第一批
          setRelatedSeries(relatedPool.slice(0, 15));
          setRelatedPage(1);
        }
        setRecommendFadeIn(true);
        setRelatedRefreshing(false);
      }, 180);
    } catch {
      setTimeout(() => {
        setRelatedSeries(relatedPool.slice(0, 15));
        setRelatedPage(1);
        setRecommendFadeIn(true);
        setRelatedRefreshing(false);
      }, 180);
    }
  };

  // 🌟 任务 03: 5秒倒计时引擎，全剧终沉浸式自动连播下一部精选短剧
  useEffect(() => {
    if (!showSeriesEndModal || !seriesEndTarget) return;

    setSeriesEndCountdown(5);
    const timer = setInterval(() => {
      setSeriesEndCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowSeriesEndModal(false);
          handleSelectSeries(seriesEndTarget);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showSeriesEndModal, seriesEndTarget]);

  // 当短剧或集数发生变动时，确保片尾弹窗处于关闭状态
  useEffect(() => {
    setShowSeriesEndModal(false);
  }, [activeSeries?.id, currentEpisodeIndex]);

  // 🌟 任务 04: 自动拉取当前短剧的同系列多季列表
  useEffect(() => {
    if (!activeSeries) {
      setSeasonsList([]);
      setSelectedSeasonId(null);
      return;
    }
    setSelectedSeasonId(activeSeries.id);
    let cancelled = false;
    setSeasonsLoading(true);
    api.getSeriesSeasons(activeSeries)
      .then((list) => {
        if (!cancelled) {
          setSeasonsList(list);
          setSelectedSeasonId(activeSeries.id);
          setSeasonsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSeasonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSeries?.id]);

  // 🌟 任务 04: 快速切换季数
  const handleSwitchSeason = async (season: SeasonInfo) => {
    if (String(season.seriesId) === String(activeSeries?.id)) return;
    try {
      setShowSeriesEndModal(false);
      showToast(`正在切换至《${season.title}》...`);
      await handleSelectSeries({
        id: season.seriesId,
        title: season.title,
        cover: season.cover || activeSeries?.cover || "",
        badge: season.badge || "",
        description: "",
        tags: activeSeries?.tags || "",
      });
    } catch {
      showToast("切换季数失败");
    }
  };

  // 换一部片尾推荐剧集
  const handleSwitchNextSeriesRecommendation = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeSeries) return;
    const pool = [
      ...relatedSeries,
      ...relatedPool,
      ...sections.flatMap((s) => s.items),
      ...banners
    ].filter(
      (s) => String(s.id) !== String(activeSeries.id) && String(s.id) !== String(seriesEndTarget?.id)
    );
    if (pool.length > 0) {
      const nextTarget = pool[Math.floor(Math.random() * pool.length)];
      setSeriesEndTarget(nextTarget);
      setSeriesEndCountdown(5);
    } else {
      showToast("暂无更多同类推荐剧");
    }
  };

  // 2. 全屏状态同步监听
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 3. 遥控器与键盘快捷键全面支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // 若片尾推荐弹窗已打开，响应回车立即连播、Esc 关闭弹窗
      if (showSeriesEndModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSeriesEndModal(false);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (seriesEndTarget) {
            setShowSeriesEndModal(false);
            handleSelectSeries(seriesEndTarget);
          }
          return;
        }
      }

      if (!activeSeries || !videoRef.current) return;
      const video = videoRef.current;

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (video.paused) {
            video.play();
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
          resetControlsTimer();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          setCurrentTime(video.currentTime);
          showToast(`快退 5 秒 (${formatTime(video.currentTime)})`);
          resetControlsTimer();
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 9999, video.currentTime + 5);
          setCurrentTime(video.currentTime);
          showToast(`快进 5 秒 (${formatTime(video.currentTime)})`);
          resetControlsTimer();
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, Math.round((video.volume + 0.1) * 10) / 10);
          setVolume(video.volume);
          setIsMuted(false);
          showToast(`音量: ${Math.round(video.volume * 100)}%`);
          resetControlsTimer();
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, Math.round((video.volume - 0.1) * 10) / 10);
          setVolume(video.volume);
          showToast(`音量: ${Math.round(video.volume * 100)}%`);
          resetControlsTimer();
          break;
        case "[": {
          e.preventDefault();
          const speeds = [0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          const nextIdx = Math.max(0, currIdx - 1);
          handleSelectSpeed(speeds[nextIdx]);
          break;
        }
        case "]": {
          e.preventDefault();
          const speeds = [0.75, 1.0, 1.25, 1.5, 2.0, 3.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          const nextIdx = Math.min(speeds.length - 1, currIdx + 1);
          handleSelectSpeed(speeds[nextIdx]);
          break;
        }
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          showToast(video.muted ? "已静音" : "已恢复声音");
          resetControlsTimer();
          break;
        case "n":
        case "N":
          e.preventDefault();
          if (currentEpisodeIndex < activeSeries.episodes.length - 1) {
            setShowSeriesEndModal(false);
            setCurrentEpisodeIndex((i) => i + 1);
          }
          break;
        case "p":
        case "P":
          e.preventDefault();
          if (currentEpisodeIndex > 0) {
            setShowSeriesEndModal(false);
            setCurrentEpisodeIndex((i) => i - 1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSeries, currentEpisodeIndex, playbackSpeed, showSeriesEndModal, seriesEndTarget]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setShowQualityMenu(false);
      setShowSpeedMenu(false);
    }, 3500);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackSpeed;
    setDuration(videoRef.current.duration || 0);

    // 如果是画质切换，精确恢复当前播放时间戳并继续播放
    if (qualitySwitchTimeRef.current !== null) {
      if (qualitySwitchTimeRef.current > 0) {
        videoRef.current.currentTime = qualitySwitchTimeRef.current;
      }
      qualitySwitchTimeRef.current = null;
    } else if (activeSeries && currentEpisode) {
      // 换集/初次加载时才检查历史续播
      const prog = getProgress(activeSeries.id);
      if (prog && !prog.completed && prog.episodeId === currentEpisode.id && prog.position > 0) {
        if (prog.position < (videoRef.current.duration || 9999) - 5) {
          videoRef.current.currentTime = prog.position;
          showToast(`已为您恢复至上次播放进度 ${formatTime(prog.position)}`);
        }
      }
    }

    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
  };


  const handleTimeUpdate = () => {
    if (!activeSeries || !currentEpisode || !videoRef.current || qualitySwitchTimeRef.current !== null) return;
    const time = Math.floor(videoRef.current.currentTime);
    setCurrentTime(videoRef.current.currentTime);
    setDuration(videoRef.current.duration || 0);

    // 严禁在视频还在正常播放中显示片尾推荐弹窗
    if (showSeriesEndModal && videoRef.current.duration > 0 && videoRef.current.currentTime < videoRef.current.duration - 0.5) {
      setShowSeriesEndModal(false);
    }

    if (time >= 0) {
      saveProgress(activeSeries.id, currentEpisode.id, time, {
        title: activeSeries.title,
        cover: activeSeries.cover,
        badge: activeSeries.badge,
        tags: activeSeries.tags,
        episodeNumber: currentEpisode.number || currentEpisodeIndex + 1,
        duration: Math.floor(videoRef.current.duration || 0),
        completed: videoRef.current.ended,
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const target = parseFloat(e.target.value);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    handleTimeUpdate();
    resetControlsTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
    if (val > 0) videoRef.current.muted = false;
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
    if (!videoRef.current.muted && videoRef.current.volume === 0) {
      videoRef.current.volume = 0.6;
      setVolume(0.6);
    }
  };

  // 切换画质 (平滑保持当前时间进度，零黑屏零卡顿)
  const handleSelectQuality = (qKey: string) => {
    if (qKey === currentQuality) {
      setShowQualityMenu(false);
      return;
    }
    const video = videoRef.current;
    const prevTime = video ? video.currentTime : currentTime;
    const wasPaused = video ? video.paused : false;

    qualitySwitchTimeRef.current = prevTime;
    setCurrentQuality(qKey);
    setShowQualityMenu(false);
    try {
      savePlaybackPreference("quality", qKey);
    } catch {}
    showToast(`正在切换至官方 ${qKey}...`);

    if (video) {
      const handleRestoreOnReady = () => {
        if (qualitySwitchTimeRef.current !== null && qualitySwitchTimeRef.current > 0) {
          video.currentTime = qualitySwitchTimeRef.current;
          qualitySwitchTimeRef.current = null;
        }
        video.playbackRate = playbackSpeed;
        if (!wasPaused) {
          video.play().catch(() => {});
        }
      };
      // 监听新流就绪后再续播
      video.addEventListener("loadeddata", handleRestoreOnReady, { once: true });
    }
  };


  // 切换倍速
  const handleSelectSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    try {
      savePlaybackPreference("speed", speed);
    } catch {}
    setShowSpeedMenu(false);
    showToast(`播放倍速已设为 ${speed}x`);
  };

  // 全屏切换
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleVideoEnded = () => {
    const video = videoRef.current;
    if (!video || !activeSeries) return;
    handleTimeUpdate();
    detailWatchRef.current.pause();
    if (currentEpisodeIndex === activeSeries.episodes.length - 1 && video.ended) detailWatchRef.current.complete();

    // 1. 中间集数：继续连播下一集
    if (currentEpisodeIndex < activeSeries.episodes.length - 1) {
      if (autoPlayNext) {
        setCurrentEpisodeIndex((prev) => prev + 1);
        showToast(`第 ${currentEpisodeIndex + 1} 集播放完毕，自动播放下一集`);
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }

    // 2. 全剧最后一集：严格保证全剧彻底播放完毕后才显示
    // 必须经过多重严格校验：确保视频已经彻底到底，而不是在播放过程中触发
    const isDurationValid = !isNaN(video.duration) && video.duration > 0;
    const isCompletelyEnded = video.ended || (isDurationValid && video.currentTime >= video.duration - 0.3);

    if (!isCompletelyEnded) {
      // 视频尚未彻底播完，严禁显示推荐弹窗！
      return;
    }

    // 彻底停止视频流播放并定格
    video.pause();
    setIsPlaying(false);

    // 🌟 任务 04: 当季播放完后，最高优先级锁定并自动连播同系列下一季！
    let candidate: Series | null = null;
    let isNextSeason = false;

    const currentSeasonIdx = seasonsList.findIndex(
      (s) => String(s.seriesId) === String(activeSeries.id)
    );
    if (currentSeasonIdx !== -1 && currentSeasonIdx < seasonsList.length - 1) {
      const nextSeason = seasonsList[currentSeasonIdx + 1];
      candidate = {
        id: nextSeason.seriesId,
        title: nextSeason.title,
        cover: nextSeason.cover || activeSeries.cover,
        badge: nextSeason.badge || "全集",
        description: `本季已完结！精彩剧情不间断，即将为您无缝连播《${nextSeason.seasonLabel}》第 1 集！`,
        tags: "同系列下一季"
      };
      isNextSeason = true;
    }

    // 若没有下一季（或已是最终季），回退至同类好剧推荐池
    if (!candidate) {
      const allPool = [
        ...relatedSeries,
        ...relatedPool,
        ...sections.flatMap((s) => s.items),
        ...banners
      ];
      candidate = allPool.find((s) => String(s.id) !== String(activeSeries.id)) || null;
    }

    if (candidate) {
      setSeriesEndTarget(candidate);
      setShowSeriesEndModal(true);
      if (isNextSeason) {
        showToast(`🎉 恭喜追完当前季！即将自动连播下一季`);
      }
    } else {
      showToast(`🎉 恭喜追完《${activeSeries.title}》全集！`);
    }
  };

  const currentBanner = banners[activeBannerIndex];
  const currentRankType = rankTypes.find((r) => r.slug === selectedRankSlug) || rankTypes[0];

  // 今日日期格式化
  const todayStr = (() => {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日已更新`;
  })();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100 flex-col font-sans select-none">
      {/* 提示条 Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 border border-slate-700/80 backdrop-blur px-5 py-2.5 rounded-full text-sm shadow-2xl text-rose-400 font-semibold animate-bounce">
          {toast}
        </div>
      )}

      {/* 🔝 顶部通用导航栏（TV 遥控器与电脑鼠标通用，导航栏置顶） */}
      <header className="h-16 md:h-20 bg-[#0a0f1d]/95 backdrop-blur border-b border-slate-800/80 px-4 md:px-8 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
          {/* Logo */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0" 
            onClick={() => { setTab("home"); setActiveSeries(null); }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-900/40">
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                红果短剧
              </h1>
              <span className="text-[10px] text-rose-400/90 font-bold tracking-widest uppercase block -mt-1">
                TV & PC 客户端
              </span>
            </div>
          </div>

          {/* 顶部主菜单项 (首页 | 分类 | 榜单 | 搜索 | 追剧) */}
          <nav className="flex items-center gap-1 md:gap-2">
            {/* 1. 首页 */}
            <button
              tabIndex={1}
              onClick={() => { setTab("home"); setActiveSeries(null); }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "home" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-4 h-4" /> 首页
            </button>

            {/* 1.5 推荐刷剧 (沉浸式 9:16 短剧流) */}
            <button
              tabIndex={2}
              onClick={() => { 
                setTab("recommend"); 
                setActiveSeries(null); 
                loadStreamData(1, false);
              }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "recommend" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Compass className="w-4 h-4" /> 推荐
            </button>

            {/* 2. 分类 */}
            <button
              tabIndex={3}
              onClick={() => { 
                setTab("category"); 
                setActiveSeries(null);
                if (categoryItems.length === 0) fetchCategoryList(selectedCatType, selectedCatTag, catPage);
              }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "category" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Grid className="w-4 h-4" /> 分类
            </button>

            {/* 3. 榜单 */}
            <button
              tabIndex={3}
              onClick={() => { 
                setTab("rank"); 
                setActiveSeries(null); 
                if (rankItems.length === 0) fetchRankList(selectedRankSlug, rankPage);
              }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "rank" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" /> 榜单
            </button>

            {/* 4. 搜索 */}
            <button
              tabIndex={4}
              onClick={() => { setTab("search"); setActiveSeries(null); }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "search" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Search className="w-4 h-4" /> 搜索
            </button>

            {/* 5. 追剧与历史 */}
            <button
              tabIndex={5}
              onClick={() => { 
                setTab("favorites"); 
                setActiveSeries(null); 
                refreshHistory();
                setFavorites(getFavorites());
              }}
              className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
                tab === "favorites" && !activeSeries
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Heart className="w-4 h-4" /> 追剧
              {favorites.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                  {favorites.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* 右侧设置与自建服务状态 */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            tabIndex={6}
            onClick={() => { setTab("settings"); setActiveSeries(null); }}
            className={`tv-nav-item flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 ${
              tab === "settings" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">设置</span>
          </button>

          <div className="hidden xl:flex items-center gap-2 text-xs bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>本地服务</span>
          </div>
        </div>
      </header>

      {historyStorageWarning && <div role="alert" className="bg-amber-950 text-amber-200 px-5 py-2">{historyStorageWarning}</div>}
      {/* 主界面区域 */}
      <main className={`flex-1 ${!activeSeries && tab === "recommend" ? "overflow-hidden p-0" : "overflow-y-auto px-4 md:px-8 py-6"}`}>
        {/* ======================= 1. 播放与选集详情界面 ======================= */}
        {activeSeries ? (
          <div className="max-w-[1720px] mx-auto flex flex-col gap-8 pb-14 px-2 sm:px-4">
            {/* 上半部分：左侧播放器 + 右侧选集栏 */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* 左侧大屏播放器 */}
              <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  tabIndex={7}
                  onClick={() => setActiveSeries(null)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <ArrowLeft className="w-4 h-4" /> 返回
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                    正在播放第 {currentEpisode?.number || currentEpisodeIndex + 1} 集
                  </span>
                </div>
              </div>

              {/* 🌟 沉浸式专业播放器容器 (全屏/倍速/官方真实画质/连播/快捷键) */}
              <div
                ref={playerContainerRef}
                onMouseMove={resetControlsTimer}
                onClick={resetControlsTimer}
                onDoubleClick={toggleFullscreen}
                className={`relative aspect-[9/16] max-h-[72vh] lg:max-h-none lg:aspect-video w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group ${
                  isFullscreen ? "fixed inset-0 z-50 rounded-none border-none max-h-none aspect-auto w-screen h-screen" : ""
                }`}
              >
                {currentEpisode ? (
                  <>
                    <video
                      ref={videoRef}
                      key={currentEpisode.id}
                      src={api.getVideoStreamUrl(currentEpisode.id, currentQuality, activeSeries.id)}
                      autoPlay
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={handleVideoEnded}
                      onPlay={() => {
                        setIsPlaying(true);
                        setShowSeriesEndModal(false);
                      }}
                      onPlaying={() => {
                        setIsPlaying(true);
                        setShowSeriesEndModal(false);
                      }}
                      onPause={() => { handleTimeUpdate(); setIsPlaying(false); }}
                      onSeeked={handleTimeUpdate}
                      onClick={handleTogglePlay}
                      className="w-full h-full object-contain cursor-pointer"
                    />

                    {/* 暂停时中央呼吸播放大按钮 */}
                    {!isPlaying && (
                      <button
                        onClick={handleTogglePlay}
                        className="absolute inset-0 m-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-950/80 backdrop-blur transition-transform hover:scale-110 z-20"
                      >
                        <Play className="w-8 h-8 fill-white ml-1" />
                      </button>
                    )}

                    {/* 🔝 顶部控制栏 (标题、集数、画质徽章、快捷键说明) */}
                    <div
                      className={`absolute top-0 inset-x-0 p-4 md:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-30 pointer-events-auto ${
                        showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isFullscreen && (
                          <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                        )}
                        <div>
                          <h3 className="font-bold text-sm md:text-base text-white flex items-center gap-2">
                            {activeSeries.title}
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-medium">
                              第 {currentEpisode.number || currentEpisodeIndex + 1} 集
                            </span>
                          </h3>
                        </div>
                      </div>

                      {/* 顶部右侧徽章与快捷键帮助 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-black/60 border border-rose-500/40 text-rose-400 font-bold">
                          {currentQuality}
                        </span>
                        {playbackSpeed !== 1 && (
                          <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                            {playbackSpeed}x
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowShortcutsHelp(!showShortcutsHelp);
                          }}
                          title="快捷键说明"
                          className="p-1.5 rounded-xl bg-black/60 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* ⌨️ 快捷键说明悬浮卡片 */}
                    {showShortcutsHelp && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-16 right-4 z-40 bg-slate-900/95 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur text-xs space-y-2.5 w-64"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-bold text-white">
                          <span>⌨️ 播放器快捷键 (TV / PC)</span>
                          <button onClick={() => setShowShortcutsHelp(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 text-slate-300">
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">空格</kbd> 播放/暂停</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">F</kbd> 全屏切换</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">← / →</kbd> 快退/快进 5s</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">↑ / ↓</kbd> 音量调节</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">[ / ]</kbd> 减速/加速</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">N / P</kbd> 下集/上集</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">M</kbd> 静音切换</div>
                          <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">双击</kbd> 全屏</div>
                        </div>
                      </div>
                    )}

                    {/* 🔽 底部控制栏 (时间轴、播放/暂停、选集、倍速、官方画质、音量、全屏) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3 transition-opacity duration-300 z-30 pointer-events-auto ${
                        showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      {/* 1. 进度条 (Scrub bar) */}
                      <div className="relative group/bar flex items-center w-full">
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          step={0.5}
                          className="w-full h-1.5 group-hover/bar:h-2.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500 transition-all"
                        />
                      </div>

                      {/* 2. 按钮控制栏 */}
                      <div className="flex items-center justify-between gap-3 text-xs">
                        {/* 左侧控制：播放/暂停、上集、下集、时间 */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleTogglePlay}
                            className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition shadow-lg shadow-rose-950/60"
                          >
                            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                          </button>

                          <button
                            disabled={currentEpisodeIndex <= 0}
                            onClick={() => setCurrentEpisodeIndex((i) => i - 1)}
                            title="上一集 (P)"
                            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <button
                            disabled={currentEpisodeIndex >= activeSeries.episodes.length - 1}
                            onClick={() => setCurrentEpisodeIndex((i) => i + 1)}
                            title="下一集 (N)"
                            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          <div className="text-slate-300 font-mono text-xs pl-1">
                            <span className="text-white font-bold">{formatTime(currentTime)}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>

                        {/* 右侧控制：倍速、画质、连播、音量、全屏 */}
                        <div className="flex items-center gap-2 md:gap-3">
                          {/* ⚡ 倍速选择菜单 */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setShowSpeedMenu(!showSpeedMenu);
                                setShowQualityMenu(false);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                                playbackSpeed !== 1.0
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/80"
                              }`}
                            >
                              <Gauge className="w-3.5 h-3.5" />
                              <span>{playbackSpeed}x</span>
                            </button>

                            {showSpeedMenu && (
                              <div className="absolute bottom-11 right-0 bg-slate-900/95 border border-slate-700 rounded-2xl p-1.5 shadow-2xl backdrop-blur flex flex-col gap-1 w-24 z-40">
                                <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800">
                                  播放倍速
                                </div>
                                {[0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => handleSelectSpeed(s)}
                                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                      playbackSpeed === s
                                        ? "bg-rose-600 text-white font-bold"
                                        : "hover:bg-slate-800 text-slate-300"
                                    }`}
                                  >
                                    <span>{s}x</span>
                                    {playbackSpeed === s && <Check className="w-3.5 h-3.5" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 📺 官方真实清晰度选择菜单 */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setShowQualityMenu(!showQualityMenu);
                                setShowSpeedMenu(false);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-rose-400 font-bold text-xs border border-rose-500/30 transition shadow-sm"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>{currentQuality}</span>
                            </button>

                            {showQualityMenu && (
                              <div className="absolute bottom-11 right-0 bg-slate-900/95 border border-slate-700 rounded-2xl p-1.5 shadow-2xl backdrop-blur flex flex-col gap-1 w-36 z-40">
                                <div className="px-2.5 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800 flex items-center justify-between">
                                  <span>官方真实画质</span>
                                  {qualitiesLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-rose-400" />}
                                </div>
                                {videoQualities.length > 0 ? (
                                  videoQualities.map((q) => (
                                    <button
                                      key={q.key}
                                      onClick={() => handleSelectQuality(q.key)}
                                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        currentQuality === q.key
                                          ? "bg-rose-600 text-white font-bold"
                                          : "hover:bg-slate-800 text-slate-300"
                                      }`}
                                    >
                                      <span>{q.label}</span>
                                      {currentQuality === q.key && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-2.5 py-2 text-xs text-slate-500">
                                    {qualitiesLoading ? "加载官方画质中..." : "1080P 超清"}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 🔁 自动连播开关 */}
                          <button
                            onClick={() => {
                              setAutoPlayNext(!autoPlayNext);
                              showToast(autoPlayNext ? "已关闭自动连播" : "已开启自动连播");
                            }}
                            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                              autoPlayNext
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-slate-900/80 text-slate-400 border-slate-800"
                            }`}
                          >
                            <span>连播: {autoPlayNext ? "开" : "关"}</span>
                          </button>

                          {/* 🔊 音量控制 */}
                          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                            <button onClick={handleToggleMute} className="text-slate-300 hover:text-white transition">
                              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={isMuted ? 0 : volume}
                              onChange={handleVolumeChange}
                              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                          </div>

                          {/* ⛶ 全屏按钮 */}
                          <button
                            onClick={toggleFullscreen}
                            title="全屏 (F)"
                            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                          >
                            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 🌟 任务 03: 全剧终「片尾推荐弹窗」（仅在全剧彻底播放完后显示，播放中绝对不显示） */}
                    {showSeriesEndModal && seriesEndTarget && !isPlaying && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-fade-in select-none"
                      >
                        <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-slate-700/80 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-2xl text-center space-y-4 md:space-y-5">
                          {/* 右上角关闭按钮 */}
                          <button
                            onClick={() => setShowSeriesEndModal(false)}
                            className="absolute top-3.5 right-3.5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                            title="留在本剧"
                          >
                            <X className="w-5 h-5" />
                          </button>

                          {/* 撒花 / 追完提示 */}
                          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs md:text-sm">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span>
                              {seriesEndTarget.tags === "同系列下一季"
                                ? `恭喜追完当前季！即将连播下一季`
                                : `恭喜追完《${activeSeries.title}》全集！`}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h2 className="text-lg md:text-2xl font-black text-white tracking-wide">
                              {seriesEndTarget.tags === "同系列下一季"
                                ? `为您自动连播同系列下一季`
                                : `为您精选下一部同类爆款`}
                            </h2>
                            <p className="text-xs md:text-sm text-slate-400">
                              {seriesEndTarget.tags === "同系列下一季"
                                ? `原班人马精彩剧情不间断，即刻无缝续看下一季！`
                                : `高分好剧连播不间断，精彩剧情即刻续享`}
                            </p>
                          </div>

                          {/* 精选短剧卡片 (点击立即播放) */}
                          <div
                            onClick={() => {
                              setShowSeriesEndModal(false);
                              handleSelectSeries(seriesEndTarget);
                            }}
                            className="flex items-center gap-3.5 md:gap-4 p-3 md:p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-rose-500/50 transition cursor-pointer text-left group"
                          >
                            <div className="relative w-18 md:w-24 aspect-[3/4] rounded-xl overflow-hidden shrink-0 bg-slate-800 shadow-lg">
                              <img
                                src={seriesEndTarget.cover}
                                alt={seriesEndTarget.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-white font-medium">
                                {seriesEndTarget.badge || "全集"}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/20 text-rose-400 border border-rose-500/30">
                                  {seriesEndTarget.tags || "同类好剧"}
                                </span>
                                <span className="text-xs text-amber-400 font-semibold flex items-center gap-0.5">
                                  🔥 9.8分
                                </span>
                              </div>
                              <h4 className="font-bold text-sm md:text-base text-white group-hover:text-rose-400 transition truncate">
                                {seriesEndTarget.title}
                              </h4>
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {seriesEndTarget.description || "精彩短剧连播，高潮迭起，逆袭反转不停歇！"}
                              </p>
                            </div>
                          </div>

                          {/* 倒计时提示与换一部 */}
                          <div className="flex items-center justify-between text-xs font-semibold px-1">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              ⏱️ <span className="text-rose-400 font-bold">{seriesEndCountdown}s</span> 后自动连播
                            </span>
                            <button
                              onClick={handleSwitchNextSeriesRecommendation}
                              className="text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              换一部推荐
                            </button>
                          </div>

                          {/* 倒计时进度条 */}
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500 transition-all duration-1000 ease-linear rounded-full"
                              style={{ width: `${(seriesEndCountdown / 5) * 100}%` }}
                            />
                          </div>

                          {/* 操作按钮组 */}
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => setShowSeriesEndModal(false)}
                              className="flex-1 py-2.5 md:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs md:text-sm transition"
                            >
                              留在本剧
                            </button>
                            <button
                              onClick={() => {
                                setShowSeriesEndModal(false);
                                handleSelectSeries(seriesEndTarget);
                              }}
                              className="flex-[1.5] py-2.5 md:py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs md:text-sm shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2 transition hover:scale-[1.02]"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              立即播放 ({seriesEndCountdown}s)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-500 text-sm">加载中...</div>
                )}
              </div>

              {/* 左侧播放器下方：轻量操作条（上下集切换） */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <button
                    tabIndex={9}
                    disabled={currentEpisodeIndex <= 0}
                    onClick={() => {
                      setShowSeriesEndModal(false);
                      setCurrentEpisodeIndex((i) => i - 1);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <ChevronLeft className="w-4 h-4" /> 上一集
                  </button>
                  <button
                    tabIndex={10}
                    disabled={currentEpisodeIndex >= activeSeries.episodes.length - 1}
                    onClick={() => {
                      setShowSeriesEndModal(false);
                      setCurrentEpisodeIndex((i) => i + 1);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition outline-none focus:ring-4 focus:ring-rose-500/50 shadow-lg shadow-rose-900/40"
                  >
                    下一集 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  正在播放第 <span className="text-rose-400 font-bold">{currentEpisode?.number || currentEpisodeIndex + 1}</span> / {activeSeries.episodes.length} 集
                </div>
              </div>

              {/* 🌟「为你推荐 · 同类好剧」专区 (严格放置在系列季数左侧，播放器正下方) */}
              <div className="w-full pt-6 border-t border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      为你推荐
                    </h3>
                    {relatedKeyword && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-normal">
                        关联标签: {relatedKeyword}
                      </span>
                    )}
                  </div>

                  {/* 🔄「换一批」智能实时换剧与微动效按钮 */}
                  <button
                    type="button"
                    onClick={handleRefreshRecommend}
                    disabled={relatedLoading || relatedRefreshing}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 active:scale-95 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/60 hover:border-rose-500/50 shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group outline-none focus:ring-2 focus:ring-rose-500/50"
                    title="换一批推荐短剧"
                  >
                    <RefreshCw
                      style={{
                        transform: `rotate(${refreshRotateDeg}deg)`,
                        transition: "transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      className={`w-3.5 h-3.5 text-rose-400 group-hover:text-rose-300 ${
                        relatedRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    <span>换一批</span>
                  </button>
                </div>

                {/* 推荐卡片列表：标准 5 列栅格，3 排共 15 部 (严格还原图一优酷版式)，具备平滑切换动效 */}
                {relatedLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 15 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="animate-pulse bg-[#0a0f1d] border border-slate-800/60 rounded-2xl p-2.5 space-y-2.5"
                      >
                        <div className="aspect-[3/4] bg-slate-800/60 rounded-xl" />
                        <div className="h-4 bg-slate-800/60 rounded w-3/4" />
                        <div className="h-3 bg-slate-800/40 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : relatedSeries.length > 0 ? (
                  <div
                    className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 transition-all duration-300 ease-out ${
                      recommendFadeIn ? "opacity-100 translate-y-0" : "opacity-30 translate-y-1"
                    }`}
                  >
                    {relatedSeries.slice(0, 15).map((item) => (
                      <div
                        key={item.id}
                        tabIndex={0}
                        onClick={() => handleSelectSeries(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSelectSeries(item);
                        }}
                        className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          {item.badge && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                              {item.badge}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                              <Play className="w-4 h-4 fill-rose-300" /> 点击换剧
                            </span>
                          </div>
                        </div>
                        <div className="p-3 flex flex-col flex-1 justify-between gap-1">
                          <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {item.tags || "同类好剧"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 text-sm bg-slate-900/30 rounded-2xl border border-slate-800">
                    暂无同类推荐短剧
                  </div>
                )}
              </div>
            </div>

            {/* 右侧面板 (1排6个共5排30集，自然紧凑高度，减少两排卡片高度) */}
            <div className="w-full lg:w-[480px] xl:w-[520px] 2xl:w-[560px] flex flex-col bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shrink-0 self-start">
              <div>
                {/* 1. 顶部 Tab 标签栏 */}
                <div className="flex items-center gap-6 border-b border-slate-800/80 pb-3 mb-4">
                  <button className="text-base font-bold text-white border-b-2 border-rose-500 pb-1 -mb-3.5">
                    视频
                  </button>
                </div>

                {/* 2. 剧名与题材热度标签 */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-white leading-snug line-clamp-1">
                      {activeSeries.title}
                    </h2>
                    <button
                      tabIndex={8}
                      onClick={() => handleToggleFav(activeSeries)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 outline-none focus:ring-2 focus:ring-rose-500 ${
                        favorites.some((f) => f.id === activeSeries.id)
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          favorites.some((f) => f.id === activeSeries.id)
                            ? "fill-rose-500 text-rose-500"
                            : "text-slate-400"
                        }`}
                      />
                      {favorites.some((f) => f.id === activeSeries.id) ? "已追剧" : "追剧"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      🔥 连载中
                    </span>
                    <span>·</span>
                    <span>共 {activeSeries.episodes.length} 集</span>
                    {activeSeries.tags && (
                      <>
                        <span>·</span>
                        <span className="text-slate-300">{activeSeries.tags}</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {activeSeries.description || "暂无剧集简介"}
                  </p>
                </div>

                {/* 选集头部与区间选择器 (点击展开完整区间面板) */}
                <div className="pt-2 pb-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-rose-500" />
                      <span className="font-bold text-sm text-white">选集</span>
                      <span className="text-xs text-slate-400 font-mono">
                        (共 {activeSeries.episodes.length} 集)
                      </span>
                    </div>

                    {/* 区间切换触发器（带有展开/收起浮动面板功能） */}
                    {activeSeries.episodes.length > 30 && (
                      <button
                        onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-rose-400 hover:text-rose-300 border border-slate-700/60 transition"
                        title="点击展开选择剧集区间"
                      >
                        <span>
                          第 {episodeRangeIndex * 30 + 1}-{Math.min((episodeRangeIndex + 1) * 30, activeSeries.episodes.length)} 集
                        </span>
                        {showRangeDropdown ? (
                          <ChevronUp className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. 展开时显示区间选择面板，收起时显示 30 集卡片网格 */}
              {showRangeDropdown ? (
                <div className="pt-3 flex-1">
                  <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur">
                    <div className="text-[11px] font-bold text-slate-400 mb-2.5 flex items-center justify-between">
                      <span className="text-slate-300">快速跳转分段区间 (每组30集)</span>
                      <button
                        onClick={() => setShowRangeDropdown(false)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                      >
                        返回选集
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {Array.from({ length: Math.ceil(activeSeries.episodes.length / 30) }).map((_, rIdx) => {
                        const start = rIdx * 30 + 1;
                        const end = Math.min((rIdx + 1) * 30, activeSeries.episodes.length);
                        const isCurrentRange = episodeRangeIndex === rIdx;
                        return (
                          <button
                            key={rIdx}
                            onClick={() => {
                              setEpisodeRangeIndex(rIdx);
                              setShowRangeDropdown(false);
                            }}
                            className={`py-2 px-1 rounded-lg text-xs font-bold transition text-center ${
                              isCurrentRange
                                ? "bg-rose-600 text-white shadow-md shadow-rose-900/50"
                                : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                            }`}
                          >
                            {start}-{end}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* 选集网格：1排6个共5排 */
                <div className="grid grid-cols-6 gap-2.5 pt-3">
                  {activeSeries.episodes
                    .slice(episodeRangeIndex * 30, (episodeRangeIndex + 1) * 30)
                    .map((ep, idx) => {
                      const actualIdx = episodeRangeIndex * 30 + idx;
                      const isCurrent = actualIdx === currentEpisodeIndex;
                      return (
                        <button
                          key={ep.id}
                          onClick={() => {
                            setShowSeriesEndModal(false);
                            setCurrentEpisodeIndex(actualIdx);
                          }}
                          title={`第 ${ep.number || actualIdx + 1} 集`}
                          className={`h-12 rounded-xl text-sm font-extrabold transition-all outline-none focus:ring-2 focus:ring-rose-500/70 flex items-center justify-center relative shadow-sm ${
                            isCurrent
                              ? "bg-rose-600 text-white shadow-md shadow-rose-900/60 scale-105 z-10 ring-2 ring-rose-400"
                              : "bg-slate-800/85 hover:bg-slate-700/90 text-slate-200 hover:text-white"
                          }`}
                        >
                          {isCurrent ? (
                            <div className="flex items-center gap-1">
                              <span className="w-1 h-3 bg-white rounded-full animate-bounce" />
                              <span className="w-1 h-4.5 bg-white rounded-full animate-bounce [animation-delay:0.15s]" />
                              <span className="w-1 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0.3s]" />
                            </div>
                          ) : (
                            ep.number || actualIdx + 1
                          )}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* 🌟 4. 重点实现：选集下方的同系列剧集列表（整卡可点，与播放深度结合，无多余按钮） */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-rose-500" />
                    <span className="font-extrabold text-sm text-white">同系列</span>
                  </div>
                  <span className="text-[11px] text-slate-400">点击卡片直接播放</span>
                </div>

                {/* 同系列卡片纵向排布列表（显示区域限制显示6个，其他支持滚动浏览） */}
                <div className="flex flex-col gap-3 max-h-[855px] overflow-y-auto pr-1.5 select-none">
                  {(seasonsList.length > 0
                    ? seasonsList
                    : [
                        {
                          seriesId: activeSeries.id,
                          title: activeSeries.title,
                          baseTitle: activeSeries.title,
                          seasonNumber: 1,
                          seasonLabel: "第1季",
                          cover: activeSeries.cover,
                          badge: activeSeries.badge || "全集",
                          episodeCount: activeSeries.episodes.length,
                        },
                      ]
                  ).map((season) => {
                    const isPlayingThis = String(season.seriesId) === String(activeSeries.id);

                    return (
                      <div
                        key={season.seriesId}
                        tabIndex={0}
                        onClick={() => handleSwitchSeason(season)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSwitchSeason(season);
                        }}
                        className={`relative flex items-center gap-3.5 p-3 rounded-2xl border transition-all duration-300 group cursor-pointer outline-none focus:ring-2 focus:ring-rose-500/70 select-none ${
                          isPlayingThis
                            ? "bg-gradient-to-r from-rose-950/40 via-slate-900 to-[#0c0f18] border-rose-500/60 shadow-lg shadow-rose-950/30"
                            : "bg-gradient-to-r from-[#121624] via-[#101420] to-[#0c0f18] border-slate-800/80 hover:border-rose-500/50 hover:shadow-xl hover:-translate-y-0.5"
                        }`}
                      >
                        {/* 左侧海报封面 (带 hover 微播放浮层动效) */}
                        <div className="relative w-20 aspect-[3/4] rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-slate-800 shadow-md">
                          <img
                            src={season.cover || activeSeries.cover}
                            alt={season.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          {!isPlayingThis && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-white drop-shadow-md" />
                            </div>
                          )}
                        </div>

                        {/* 右侧季数详情区 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5 space-y-1">
                          {/* 顶部标签行：全集标签 + 正在播放状态 */}
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1a233a] text-slate-300 border border-slate-700/50">
                              全{season.episodeCount || (isPlayingThis ? activeSeries.episodes.length : 80)}集
                            </span>
                            {isPlayingThis && (
                              <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                正在播放
                              </span>
                            )}
                          </div>

                          {/* 大标题：加粗白色季数全名 */}
                          <h4
                            className={`font-black text-sm text-white tracking-tight leading-snug line-clamp-1 transition ${
                              isPlayingThis ? "text-rose-400" : "group-hover:text-rose-300"
                            }`}
                            title={season.title}
                          >
                            {season.title}
                          </h4>

                          {/* 剧情简介：2 行自然截断 */}
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {isPlayingThis
                              ? activeSeries.description || "全网高分热门力作，逆袭反转不停歇！"
                              : `${season.title}精彩连载，全剧高能反转逆袭，不容错过！`}
                          </p>

                          {/* 底部信息行：🔥 7173万热度 */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                              🔥 7173万热度
                            </span>
                            {!isPlayingThis && (
                              <span className="text-[11px] text-slate-500 group-hover:text-rose-400 font-medium transition flex items-center gap-0.5">
                                点击播放 <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

        {/* ======================= 2. 官方首页板块 (Home) ======================= */}
        {!activeSeries && tab === "home" && (
          <div className="max-w-7xl mx-auto space-y-8 pb-14">
            {/* 🌟 官方级顶部大宽屏 Banner 轮播 */}
            {currentBanner && (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl group min-h-[280px] md:min-h-[360px] flex items-end p-6 md:p-10">
                <img
                  src={currentBanner.backgroundCover || currentBanner.cover}
                  alt={currentBanner.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#070a12]/90 via-transparent to-transparent" />

                <div className="relative z-10 max-w-2xl space-y-3">
                  {currentBanner.titleImage ? (
                    <img src={currentBanner.titleImage} alt={currentBanner.title} className="h-10 md:h-14 object-contain" />
                  ) : (
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">{currentBanner.title}</h2>
                  )}

                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30">官方主打推荐</span>
                    <span>{currentBanner.tags}</span>
                  </div>

                  <p className="text-xs md:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                    {currentBanner.description}
                  </p>

                  <div className="pt-2 flex items-center gap-4">
                    <button
                      onClick={() => handleSelectSeries(currentBanner)}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-sm font-bold shadow-xl shadow-rose-900/50 transition-all scale-100 hover:scale-105 outline-none focus:ring-4 focus:ring-rose-500/60"
                    >
                      <Play className="w-4 h-4 fill-white" /> 立即观看
                    </button>
                    <button
                      onClick={() => handleToggleFav(currentBanner)}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-sm font-semibold border border-slate-700/80 transition outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <Heart className="w-4 h-4 text-rose-500" /> 加入追剧
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-6 right-8 z-10 flex gap-2">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveBannerIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === activeBannerIndex ? "w-8 bg-rose-500" : "w-2 bg-slate-600 hover:bg-slate-400"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 首页专区快速切换 */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
              {[
                { type: "all", name: "全部热播", icon: Flame },
                { type: "human", name: "真人短剧", icon: UserCheck },
                { type: "comic", name: "热门漫剧", icon: Palette },
                { type: "ai", name: "AI 先锋剧", icon: Bot },
              ].map((tabItem) => {
                const Icon = tabItem.icon;
                const isSelected = selectedHomeSection === tabItem.type;
                return (
                  <button
                    key={tabItem.type}
                    onClick={() => setSelectedHomeSection(tabItem.type)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 ${
                      isSelected
                        ? "bg-slate-800 text-rose-400 border border-rose-500/30 shadow-md"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {tabItem.name}
                  </button>
                );
              })}
            </div>

            {/* 专区短剧网格 */}
            {sections
              .filter((sec) => selectedHomeSection === "all" || sec.type === selectedHomeSection)
              .map((section) => (
                <div key={section.type} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                      <span className="w-1.5 h-5 rounded-full bg-rose-500 inline-block" />
                      {section.name}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        tabIndex={0}
                        onClick={() => handleSelectSeries(item)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                        className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          {item.badge && (
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                              {item.badge}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3.5">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                              <Play className="w-4 h-4 fill-rose-300" /> 点击播放
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                          <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{item.tags || "官方推荐"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ======================= 2.5 沉浸式刷剧流板块 (Recommend - 任务 07: 最大化全屏无白边 + 图二对齐布局) ======================= */}
        {!activeSeries && tab === "recommend" && (
          <div 
            className="w-full h-full flex items-center justify-center relative select-none overflow-hidden bg-black"
            onWheel={(e) => {
              e.preventDefault();
              if (streamWheelLockRef.current) return;
              if (Math.abs(e.deltaY) < 30) return;
              streamWheelLockRef.current = true;
              if (e.deltaY > 0) {
                handleSwitchStream("next");
              } else {
                handleSwitchStream("prev");
              }
              setTimeout(() => {
                streamWheelLockRef.current = false;
              }, 450);
            }}
          >
            {streamLoading && streamList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                <span className="text-sm">正在加载沉浸式短剧推荐流...</span>
              </div>
            ) : streamList.length === 0 ? (
              <div className="text-center py-32 text-slate-500 text-sm">
                <p>{streamError || "暂无推荐短剧"}</p>
                <button className="mt-4 px-5 py-2 rounded-xl bg-rose-600 text-white" onClick={() => void streamFeedRef.current.retry().catch(() => {})}>重试</button>
              </div>
            ) : (() => {
              const currentItem = streamList[streamIndex] || streamList[0];
              const isFav = favorites.some((f) => String(f.id) === String(currentItem.id));
              const videoStreamUrl = streamCurrentEpisode
                ? api.getVideoStreamUrl(streamCurrentEpisode.id, undefined, currentItem.id)
                : "";

              return (
                <div className="relative w-full h-full overflow-hidden bg-black flex flex-col justify-between group">
                  {streamError && <div role="alert" className="absolute top-3 left-3 z-50 bg-black/80 rounded-xl p-3 text-rose-200">{streamError} <button className="underline ml-3" onClick={() => {setStreamError(""); if(!streamCurrentEpisode)void loadStreamDetail(currentItem);else void streamFeedRef.current.retry().catch(()=>{});}}>重试</button></div>}
                  {/* 背景氛围虚化图 (彻底填充屏幕，消除任何黑边死角) */}
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 scale-110 pointer-events-none transition-all duration-700"
                    style={{ backgroundImage: `url(${currentItem.cover})` }}
                  />

                  {/* 核心视频播放器或封面兜底 */}
                  <div 
                    className="absolute inset-0 z-0 flex items-center justify-center cursor-pointer"
                    onClick={() => {
                      const video = streamVideoRef.current;
                      if (!video) return;
                      if (video.paused) {
                        video.play().catch(() => {});
                        setStreamIsPlaying(true);
                      } else {
                        video.pause();
                        setStreamIsPlaying(false);
                      }
                    }}
                  >
                    {videoStreamUrl ? (
                      <video
                        ref={streamVideoRef}
                        key={`${currentItem.id}-${streamCurrentEpisode?.id || 0}`}
                        src={api.getVideoStreamUrl(streamCurrentEpisode?.id || "", streamQuality, currentItem.id)}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain transition-all duration-300"
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          v.playbackRate = streamPlaybackSpeed;
                          if (v.videoWidth && v.videoHeight) {
                            setStreamIsLandscape(v.videoWidth > v.videoHeight);
                          }
                          if (streamQualitySwitchTimeRef.current !== null) {
                            if (streamQualitySwitchTimeRef.current > 0) v.currentTime = streamQualitySwitchTimeRef.current;
                            streamQualitySwitchTimeRef.current = null;
                          }
                          setStreamDuration(v.duration || 0);
                        }}
                        onTimeUpdate={() => {
                          const v = streamVideoRef.current;
                          if (v && !streamIsDraggingProgress && streamQualitySwitchTimeRef.current === null) {
                            const cur = v.currentTime;
                            setStreamCurrentTime(cur);
                            setStreamDuration(v.duration || 0);

                            // 每秒持久化待上传进度，再发送到后端
                            const sec = Math.floor(cur);
                            if (sec >= 0 && streamCurrentEpisode) {
                              saveProgress(currentItem.id, streamCurrentEpisode.id, sec, {
                                title: currentItem.title,
                                cover: currentItem.cover,
                                badge: currentItem.badge,
                                tags: currentItem.tags,
                                episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                                duration: Math.floor(v.duration || 0),
                                completed: v.ended,
                              });
                            }
                          }
                        }}
                        onEnded={() => {
                          // 当前一集播放完毕，记录进度并自动无缝播放下一集
                          if (streamCurrentEpisode) {
                            saveProgress(currentItem.id, streamCurrentEpisode.id, Math.floor(streamDuration || 0), {
                              title: currentItem.title,
                              cover: currentItem.cover,
                              badge: currentItem.badge,
                              tags: currentItem.tags,
                              episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                              duration: Math.floor(streamDuration || 0),
                              completed: true,
                            });
                            refreshHistory();
                          }
                          handleStreamNextEpisode(true);
                        }}
                        onPlay={() => setStreamIsPlaying(true)}
                        onPause={() => {
                          setStreamIsPlaying(false);
                          const v = streamVideoRef.current;
                          if (v && streamCurrentEpisode) {
                            saveProgress(currentItem.id, streamCurrentEpisode.id, Math.floor(v.currentTime || 0), {
                              title: currentItem.title,
                              cover: currentItem.cover,
                              badge: currentItem.badge,
                              tags: currentItem.tags,
                              episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                              duration: Math.floor(v.duration || 0),
                                completed: v.ended,
                            });
                            refreshHistory();
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={currentItem.cover}
                        alt={currentItem.title}
                        className="w-full h-full object-contain transition-all duration-300"
                      />
                    )}

                    {/* 暂停时显示居中播放按钮（参考图二：精致半透明播放三角图标） */}
                    {!streamIsPlaying && (
                      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center z-10">
                        <div className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-2xl scale-105 transition-transform">
                          <Play className="w-10 h-10 fill-white ml-1 text-white opacity-95" />
                        </div>
                      </div>
                    )}

                    {/* 顶部与底部渐变遮罩 (自然烘托文字) */}
                    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                  </div>

                  {/* 顶部状态与控制栏：当前分集、倍速、清晰度 */}
                  <div className="relative z-10 px-6 pt-5 flex items-center justify-between text-xs text-white/90 pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <span className="px-3.5 py-1.5 rounded-full bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-xs backdrop-blur-md shadow-lg">
                        第 {streamCurrentEpisode?.number || streamEpisodeIndex + 1} 集
                      </span>
                      {streamIsLandscape && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold backdrop-blur-md">
                          🖥️ 横屏剧
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                      {/* ⚡ 倍速选择菜单 */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStreamShowSpeedMenu(!streamShowSpeedMenu);
                            setStreamShowQualityMenu(false);
                          }}
                          className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
                            streamPlaybackSpeed !== 1.0
                              ? "bg-amber-500/30 text-amber-300 border-amber-500/50"
                              : "bg-black/60 hover:bg-black/80 text-white/90 border-white/15"
                          }`}
                        >
                          <Gauge className="w-3.5 h-3.5 text-amber-400" />
                          <span>{streamPlaybackSpeed}x</span>
                        </button>

                        {streamShowSpeedMenu && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-10 right-0 bg-slate-900/95 border border-slate-700 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md flex flex-col gap-1 w-24 z-40"
                          >
                            <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800">
                              播放倍速
                            </div>
                            {[0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleStreamSelectSpeed(s)}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                  streamPlaybackSpeed === s
                                    ? "bg-rose-600 text-white font-bold"
                                    : "hover:bg-slate-800 text-slate-300"
                                }`}
                              >
                                <span>{s}x</span>
                                {streamPlaybackSpeed === s && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 📺 官方清晰度选择菜单 */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStreamShowQualityMenu(!streamShowQualityMenu);
                            setStreamShowSpeedMenu(false);
                          }}
                          className="px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-xs font-bold text-rose-300 transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5 text-rose-400" />
                          <span>{streamQuality}</span>
                        </button>

                        {streamShowQualityMenu && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-10 right-0 bg-slate-900/95 border border-slate-700 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md flex flex-col gap-1 w-32 z-40"
                          >
                            <div className="px-2.5 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-800 flex items-center justify-between">
                              <span>清晰度画质</span>
                              {streamQualitiesLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin text-rose-400" />}
                            </div>
                            {streamQualities.length > 0 ? (
                              streamQualities.map((q) => (
                                <button
                                  key={q.key}
                                  type="button"
                                  onClick={() => handleStreamSelectQuality(q.key)}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    streamQuality === q.key
                                      ? "bg-rose-600 text-white font-bold"
                                      : "hover:bg-slate-800 text-slate-300"
                                  }`}
                                >
                                  <span>{q.label}</span>
                                  {streamQuality === q.key && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))
                            ) : (
                              ["1080P", "720P", "480P"].map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => handleStreamSelectQuality(q)}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    streamQuality === q
                                      ? "bg-rose-600 text-white font-bold"
                                      : "hover:bg-slate-800 text-slate-300"
                                  }`}
                                >
                                  <span>{q} 超清</span>
                                  {streamQuality === q && <Check className="w-3.5 h-3.5" />}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-white/70 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/15 shadow-lg">
                        滚轮 / ↑↓ 键切剧
                      </span>
                    </div>
                  </div>

                  {/* 👉 右侧纵向操作栏（严格参考图二排布：头像/追剧、爱心、评论、收藏、分享、切剧） */}
                  <div className="absolute right-6 bottom-20 z-20 flex flex-col items-center gap-4">
                    {/* 1. 作者/剧集头像 + 追剧加号小标 */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFav(currentItem);
                      }}
                      className="relative cursor-pointer group/avatar flex flex-col items-center mb-1"
                      title={isFav ? "已追剧" : "点击追剧"}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/90 shadow-2xl bg-slate-900 group-hover/avatar:scale-105 transition-transform">
                        <img src={currentItem.cover} alt={currentItem.title} className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute -bottom-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[12px] font-bold shadow-lg transition-transform ${
                        isFav ? "bg-slate-700 text-white" : "bg-rose-600 scale-110"
                      }`}>
                        {isFav ? "✓" : "+"}
                      </div>
                    </div>

                    {/* 2. 点赞 / 追剧心形按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFav(currentItem);
                      }}
                      className="flex flex-col items-center gap-1 group/btn cursor-pointer"
                    >
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-xl transition-all ${
                        isFav ? "text-rose-500 scale-110" : "text-white/90 hover:text-white hover:scale-110"
                      }`}>
                        <Heart className={`w-7 h-7 drop-shadow-lg ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                      </div>
                      <span className="text-[11px] font-bold text-white/90 drop-shadow">
                        {isFav ? "已追" : "追剧"}
                      </span>
                    </button>

                    {/* 3. 悬浮切剧上/下按钮 (PC端便捷操作) */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                      <button
                        type="button"
                        disabled={streamIndex === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchStream("prev");
                        }}
                        className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 disabled:opacity-20 disabled:cursor-not-allowed border border-white/15 flex items-center justify-center text-white transition cursor-pointer"
                        title="上一部短剧 (键盘↑)"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchStream("next");
                        }}
                        className="w-9 h-9 rounded-full bg-black/45 hover:bg-black/75 border border-white/15 flex items-center justify-center text-white transition cursor-pointer"
                        title="下一部短剧 (键盘↓)"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* 👈 左下角信息层与胶囊条（严格参考图二：@创作者/剧名、第X集、#标签、合集条） */}
                  <div className="relative z-10 px-8 pb-10 space-y-2.5 max-w-[700px] pointer-events-auto">
                    {/* 剧名与发布/集数信息 */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg md:text-xl font-black text-white leading-snug drop-shadow-md">
                          @{currentItem.title}
                        </h3>
                        {currentItem.badge && (
                          <span className="text-xs text-white/70 font-medium">
                            {currentItem.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white/90 drop-shadow">
                        第 {streamCurrentEpisode?.number || streamEpisodeIndex + 1} 集 · 《{currentItem.title}》 {streamCurrentEpisode?.title || `第${streamEpisodeIndex + 1}集`}
                      </p>
                      {/* #标签 (参考图二黄色/主题高亮标签) */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-xs font-bold text-amber-400 drop-shadow">#短剧</span>
                        <span className="text-xs font-bold text-amber-400 drop-shadow">#{currentItem.tags || "爆款推荐"}</span>
                        {currentItem.tags?.split("/").map((t, idx) => (
                          <span key={idx} className="text-xs font-bold text-amber-300 drop-shadow">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 剧情简介（点击展开/折叠） */}
                    <div className="max-w-[560px]">
                      <p 
                        onClick={() => setStreamDescriptionExpanded(!streamDescriptionExpanded)}
                        className={`text-xs text-slate-300/90 leading-relaxed drop-shadow cursor-pointer hover:text-white transition ${
                          streamDescriptionExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {currentItem.description || "精彩短剧连播，高潮迭起，逆袭反转不停歇！"}
                      </p>
                    </div>

                    {/* 🌟 底部合集胶囊胶囊条与集数控制 */}
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSelectSeries(currentItem)}
                        className="px-4 py-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-2 shadow-xl hover:border-rose-500/60 transition group/col cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-rose-400" />
                        <span>合集：{currentItem.title}</span>
                        <span className="text-slate-400 text-[11px] font-normal border-l border-white/20 pl-2 ml-1">
                          {currentItem.badge || "连载热播"}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover/col:translate-x-0.5 transition-transform" />
                      </button>

                      {/* 快捷下一集按钮 */}
                      {streamDetail && streamDetail.episodes && streamDetail.episodes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleStreamNextEpisode()}
                          className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4 text-rose-400" />
                          <span>下一集</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 🌟 底部绝对铺满全宽进度条 (从最左端横跨到最右端，满屏无留白) */}
                  <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col group/fullbar pointer-events-auto bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-2 px-0">
                    {/* 时间提示条：悬浮或平时在进度条上方显示 */}
                    <div className="px-6 flex items-center justify-between text-[11px] font-mono text-slate-400 mb-0.5 opacity-80 group-hover/fullbar:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{formatTime(streamCurrentTime)}</span>
                        <span className="text-slate-500">/</span>
                        <span>{formatTime(streamDuration)}</span>
                      </div>
                      <span className="text-[10px] text-white/50 group-hover/fullbar:text-white/80 transition-colors">
                        可拖动或点击进度条快进快退
                      </span>
                    </div>

                    {/* 满屏横跨可点击/拖拽进度条 */}
                    <div 
                      className="relative w-full h-3 flex items-center cursor-pointer px-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const newTime = clickPos * streamDuration;
                        if (streamVideoRef.current && streamDuration > 0) {
                          streamVideoRef.current.currentTime = newTime;
                          setStreamCurrentTime(newTime);
                          if (streamCurrentEpisode) {
                            saveProgress(currentItem.id, streamCurrentEpisode.id, Math.floor(newTime), {
                              title: currentItem.title,
                              cover: currentItem.cover,
                              badge: currentItem.badge,
                              tags: currentItem.tags,
                              episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                              duration: Math.floor(streamDuration || 0),
                            });
                            refreshHistory();
                          }
                        }
                      }}
                    >
                      <input
                        type="range"
                        min={0}
                        max={streamDuration || 100}
                        step={0.1}
                        value={streamCurrentTime}
                        onMouseDown={() => setStreamIsDraggingProgress(true)}
                        onTouchStart={() => setStreamIsDraggingProgress(true)}
                        onChange={(e) => {
                          const newTime = parseFloat(e.target.value);
                          setStreamCurrentTime(newTime);
                        }}
                        onMouseUp={(e) => {
                          setStreamIsDraggingProgress(false);
                          const newTime = parseFloat((e.target as HTMLInputElement).value);
                          if (streamVideoRef.current) {
                            streamVideoRef.current.currentTime = newTime;
                            if (streamCurrentEpisode) {
                              saveProgress(currentItem.id, streamCurrentEpisode.id, Math.floor(newTime), {
                                title: currentItem.title,
                                cover: currentItem.cover,
                                badge: currentItem.badge,
                                tags: currentItem.tags,
                                episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                                duration: Math.floor(streamDuration || 0),
                              });
                              refreshHistory();
                            }
                          }
                        }}
                        onTouchEnd={(e) => {
                          setStreamIsDraggingProgress(false);
                          const newTime = parseFloat((e.target as HTMLInputElement).value);
                          if (streamVideoRef.current) {
                            streamVideoRef.current.currentTime = newTime;
                            if (streamCurrentEpisode) {
                              saveProgress(currentItem.id, streamCurrentEpisode.id, Math.floor(newTime), {
                                title: currentItem.title,
                                cover: currentItem.cover,
                                badge: currentItem.badge,
                                tags: currentItem.tags,
                                episodeNumber: streamCurrentEpisode.number || streamEpisodeIndex + 1,
                                duration: Math.floor(streamDuration || 0),
                              });
                              refreshHistory();
                            }
                          }
                        }}
                        className="w-full h-1.5 group-hover/fullbar:h-2.5 rounded-none appearance-none cursor-pointer accent-rose-500 bg-white/20 hover:bg-white/30 transition-all m-0 p-0"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ======================= 3. 官方分类板块 (Category) ======================= */}
        {!activeSeries && tab === "category" && (
          <div className="max-w-7xl mx-auto space-y-6 pb-14">
            {/* 分类标题与当前状态 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
                  <Grid className="w-6 h-6 text-rose-500" /> 官方题材全部分类
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {categoryTagsLoading?"正在读取官网题材…":`官网当前 ${categoryTags.length} 种题材 · 真人剧 / 漫剧 / AI 剧`}
                </p>
              </div>

              {/* 一级内容类型选择器 (真人剧 / 漫剧 / AI剧) */}
              <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
                {categoryTypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedCatType(t.id);
                      setSelectedCatTag("");
                      setCatPage(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 ${
                      selectedCatType === t.id
                        ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {categoryError&&<div role="alert" className="text-sm text-rose-300">{categoryError}<button className="ml-3 underline" onClick={()=>{void loadCategoryTags(selectedCatType);void fetchCategoryList(selectedCatType,selectedCatTag,catPage);}}>重试</button></div>}
            {/* 题材以当前官网分类页面为准 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Compass className="w-4 h-4 text-rose-500" /> 题材筛选：
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-wrap">
                <button
                  onClick={() => {
                    setSelectedCatTag("");
                    setCatPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
                    selectedCatTag === ""
                      ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  全部题材
                </button>
                {categoryTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setSelectedCatTag(tag.id);
                      setCatPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
                      selectedCatTag === tag.id
                        ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 短剧列表网格 */}
            {catLoading ? (
              <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                <span className="text-sm">正在加载官方分类片库...</span>
              </div>
            ) : categoryItems.length === 0 ? (
              <div className="text-center py-28 text-slate-500 text-sm">
                当前筛选分类暂无收录短剧
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    tabIndex={0}
                    onClick={() => handleSelectSeries(item)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                    className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {item.badge && (
                        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                          {item.badge}
                        </span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3.5">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                          <Play className="w-4 h-4 fill-rose-300" /> 点击播放
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                      <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.tags || "官方分类"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 底部翻页控制器 */}
            <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-800/80">
              <button
                disabled={catPage <= 1 || catLoading}
                onClick={() => setCatPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-2 focus:ring-rose-500"
              >
                <ChevronLeft className="w-4 h-4" /> 上一页
              </button>
              <span className="text-xs font-bold font-mono px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
                第 {catPage} 页
              </span>
              <button
                disabled={catLoading || (categoryTotalPages>0?catPage>=categoryTotalPages:categoryItems.length<24)}
                onClick={() => setCatPage((p) => p + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-4 focus:ring-rose-500/50 shadow-md shadow-rose-900/40"
              >
                下一页 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================= 4. 官方榜单板块 (Rank: 图一官网宏观风格 + 图二卡片式排布 + Top 100 分页) ======================= */}
        {!activeSeries && tab === "rank" && (
          <div className="max-w-7xl mx-auto space-y-6 pb-16">
            {/* 🌟 4.1 官方级热播榜顶部红色/金色神鸟国风 Banner (对应图一官网) */}
            <div className="relative rounded-3xl overflow-hidden border border-rose-900/40 shadow-2xl bg-gradient-to-r from-[#420d11] via-[#5c131a] to-[#2b080b] p-6 md:p-10 flex flex-col justify-between min-h-[170px] md:min-h-[210px]">
              {/* 背景装饰：右侧发光艺术飞鸟与云霞光效 */}
              <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden opacity-60 md:opacity-80">
                <div className="absolute right-12 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-tr from-amber-500/40 to-rose-500/20 blur-3xl" />
                <svg className="absolute right-6 md:right-16 top-1/2 -translate-y-1/2 w-60 h-40 text-amber-200/50 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" viewBox="0 0 200 120" fill="currentColor">
                  <path d="M10 60 Q 50 10, 110 30 Q 150 45, 190 20 Q 160 70, 110 65 Q 60 60, 10 60 Z" opacity="0.4" />
                  <path d="M40 70 Q 90 20, 140 40 Q 170 55, 195 35 Q 160 85, 120 75 Q 70 70, 40 70 Z" opacity="0.7" />
                  <circle cx="180" cy="25" r="4" fill="#fef08a" />
                </svg>
              </div>

              {/* 面包屑导航与副标题 */}
              <div className="relative z-10 space-y-2">
                <div className="text-xs text-rose-300/80 font-medium flex items-center gap-1.5">
                  <span className="hover:text-white cursor-pointer" onClick={() => setTab("home")}>首页</span>
                  <span>/</span>
                  <span className="text-rose-200 font-semibold">{currentRankType.name}</span>
                </div>

                {/* 类似图一官网的大书名号标题 */}
                <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">
                  《 {currentRankType.name} 》
                </h2>

                <p className="text-xs md:text-sm text-rose-200/80 font-medium pt-0.5">
                  {todayStr} · 基于红果内观看/互动等综合热度排序 · 官方 Top 100
                </p>
              </div>
            </div>

            {/* 🌟 4.2 官方四大子榜单 Tab 切换栏 (对应图一官方标签：红果热播榜 / 真人剧热播榜 / AI剧热播榜 / 漫剧热播榜) */}
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
              {rankTypes.map((rt) => {
                const isSelected = selectedRankSlug === rt.slug;
                return (
                  <button
                    key={rt.slug}
                    onClick={() => {
                      setSelectedRankSlug(rt.slug);
                      setRankPage(1);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 ${
                      isSelected
                        ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40 scale-105"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    {rt.name}
                  </button>
                );
              })}
            </div>

            {/* 🌟 4.3 排行榜单项卡片列表 (采用图二现有卡片式排布，支持电视 TV 遥控与电脑鼠标) */}
            {rankLoading ? (
              <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                <span className="text-sm">正在加载官方前 100 名热播短剧...</span>
              </div>
            ) : rankItems.length === 0 ? (
              <div className="text-center py-28 text-slate-500 text-sm">
                当前榜单暂无数据
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                {rankItems.map((item, index) => {
                  const rankNum = item.rank || (rankPage - 1) * 20 + index + 1;
                  const isTop1 = rankNum === 1;
                  const isTop2 = rankNum === 2;
                  const isTop3 = rankNum === 3;

                  let rankBadgeBg = "bg-slate-800 text-slate-300";
                  if (isTop1) rankBadgeBg = "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/40";
                  else if (isTop2) rankBadgeBg = "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black";
                  else if (isTop3) rankBadgeBg = "bg-gradient-to-r from-amber-700 to-amber-600 text-white font-black";

                  return (
                    <div
                      key={item.id}
                      tabIndex={0}
                      onClick={() => handleSelectSeries(item)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                      className={`group relative flex items-center gap-4 p-3.5 rounded-2xl bg-[#0a0f1d] border transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 ${
                        isTop1
                          ? "border-amber-500/40 hover:border-amber-400 bg-gradient-to-r from-amber-950/20 via-[#0a0f1d] to-[#0a0f1d] hover:shadow-xl hover:shadow-amber-950/30"
                          : "border-slate-800/80 hover:border-rose-500/60 hover:shadow-xl hover:shadow-rose-950/20"
                      }`}
                    >
                      {/* 左侧封面海报与排名数字角标 */}
                      <div className="relative shrink-0 w-20 md:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div
                          className={`absolute top-0 left-0 min-w-6 h-6 px-1.5 flex items-center justify-center rounded-br-xl text-xs ${rankBadgeBg}`}
                        >
                          {rankNum}
                        </div>
                      </div>

                      {/* 右侧剧集详情与操作栏 */}
                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${rankBadgeBg}`}
                            >
                              TOP {rankNum}
                            </span>
                            {item.badge && (
                              <span className="text-[10px] text-slate-400 font-medium bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm md:text-base leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {item.description || item.tags || "官方推荐榜首热剧"}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-rose-400/90 font-semibold flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                            {item.heatText || "热播指数高"}
                          </span>
                          <span className="text-xs px-3 py-1 rounded-lg bg-rose-600/90 text-white font-bold group-hover:bg-rose-500 transition shadow">
                            立即播放
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🌟 4.4 底部官方前 100 名分页翻页控制器 (1~5 页，共 100 名) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-800/80">
              <div className="text-xs text-slate-400">
                展示官方前 <span className="text-rose-400 font-bold">100</span> 名 · 当前为第 <span className="text-white font-bold font-mono">{(rankPage - 1) * 20 + 1} ~ {Math.min(100, rankPage * 20)}</span> 名
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={rankPage <= 1 || rankLoading}
                  onClick={() => setRankPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <ChevronLeft className="w-4 h-4" /> 上一页
                </button>

                {[1, 2, 3, 4, 5].map((pageNum) => (
                  <button
                    key={pageNum}
                    disabled={rankLoading}
                    onClick={() => setRankPage(pageNum)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
                      rankPage === pageNum
                        ? "bg-rose-600 text-white shadow-md shadow-rose-900/40 scale-105"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  disabled={rankPage >= rankTotalPages || rankLoading}
                  onClick={() => setRankPage((p) => Math.min(rankTotalPages, p + 1))}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-4 focus:ring-rose-500/50 shadow-md shadow-rose-900/40"
                >
                  下一页 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================= 5. 搜索片库板块 (Search - 任务 06 全方位增强) ======================= */}
        {!activeSeries && tab === "search" && (
          <div className="max-w-6xl mx-auto space-y-7 pt-2 pb-14">
            {/* 1. 搜索表单与实时防抖下拉联想 */}
            <div className="relative max-w-3xl mx-auto">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim() && searchSuggestions.length === 0) {
                        handleSearchInputChange(searchQuery);
                      }
                    }}
                    placeholder="搜索短剧名、主角或关键词（如：太奶奶、反向拿捏、神豪、逆袭...）"
                    className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#0a0f1d] border border-slate-800 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-sm font-medium transition placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setShowSuggestions(false);
                        setSearchSuggestions([]);
                        setHasSearched(false);
                        setSearchResults([]);
                        refreshSearchHistory();
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                      title="清除输入"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-8 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-sm font-bold transition shadow-lg shadow-rose-900/30 shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 flex items-center gap-2 cursor-pointer"
                >
                  {searchLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>搜索</span>
                </button>
              </form>

              {/* 实时输入联想下拉浮层 (Autocomplete Dropdown) */}
              {showSuggestions && searchQuery.trim() && (searchSuggestions.length > 0 || isSuggesting) && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d1326] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-40 backdrop-blur">
                  <div className="p-2 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-semibold px-3">
                    <span>💡 相关剧集实时联想</span>
                    {isSuggesting && <RefreshCw className="w-3 h-3 animate-spin text-rose-400" />}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-800/40">
                    {searchSuggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSuggestion(item)}
                        className="flex items-center gap-3 p-2.5 hover:bg-slate-800/70 transition cursor-pointer group"
                      >
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="w-10 aspect-[3/4] object-cover rounded-lg shrink-0 bg-slate-900 border border-slate-800"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs md:text-sm font-bold text-white group-hover:text-rose-400 transition truncate">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.tags || item.badge || "热门短剧"}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 group-hover:text-rose-400 font-semibold shrink-0 flex items-center gap-0.5">
                          即点即看 <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. 空状态 / 未搜索时的探索区：热门搜索词 + 搜索历史 */}
            {!hasSearched && (
              <div className="max-w-3xl mx-auto space-y-6 pt-2">
                {/* 2.1 热门搜索榜 Top 10 */}
                <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                    <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span>热门搜索推荐</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {hotSearchKeywords.map((kw, idx) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => executeSearch(kw)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-xs font-semibold text-slate-300 hover:text-rose-400 transition cursor-pointer"
                      >
                        <span
                          className={`text-[10px] font-bold ${
                            idx < 3 ? "text-rose-400" : "text-slate-500"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span>{kw}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2.2 本地搜索历史 (最近 10 条，支持单条删除与一键清空) */}
                {searchHistoryList.length > 0 && (
                  <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>搜索历史</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          clearSearchHistory();
                          setSearchHistoryList([]);
                          showToast("已清空搜索历史");
                        }}
                        className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 清空历史
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistoryList.map((hist) => (
                        <div
                          key={hist}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-semibold text-slate-300 group hover:border-slate-700 transition"
                        >
                          <span
                            onClick={() => executeSearch(hist)}
                            className="cursor-pointer hover:text-rose-400"
                          >
                            {hist}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = removeSearchHistory(hist);
                              setSearchHistoryList(updated);
                            }}
                            className="text-slate-600 hover:text-slate-300 transition cursor-pointer ml-0.5"
                            title="删除"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. 搜索结果展示区 */}
            {hasSearched && (
              <div className="space-y-5">
                {/* 3.1 搜索结果统计与题材快筛栏 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      搜索「<span className="text-rose-400">{searchQuery}</span>」的结果
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      (共 {searchResults.length} 部)
                    </span>
                  </div>

                  {/* 题材快筛微标签 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {searchFilterTags.map((tag) => {
                      const isSelected = searchFilterTag === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSearchFilterTag(tag)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3.2 搜索加载中与结果网格 */}
                {searchLoading ? (
                  <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
                    <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                    <span className="text-sm">正在检索片库，请稍候...</span>
                  </div>
                ) : (
                  (() => {
                    const filteredItems = searchResults.filter((item) => {
                      if (searchFilterTag === "全部") return true;
                      const text = `${item.title} ${item.tags} ${item.description || ""}`;
                      return text.includes(searchFilterTag);
                    });

                    if (filteredItems.length === 0) {
                      return (
                        <div className="text-center py-24 text-slate-500 text-sm space-y-2 bg-[#0a0f1d] border border-slate-800 rounded-2xl">
                          <p>
                            {searchFilterTag === "全部"
                              ? `未找到与「${searchQuery}」相关的短剧`
                              : `在「${searchFilterTag}」分类下未找到匹配短剧`}
                          </p>
                          <p className="text-xs text-slate-600">
                            请尝试更换关键词（如：都市、逆袭、甜宠）或切换全部题材
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {filteredItems.map((item) => (
                          <div
                            key={item.id}
                            tabIndex={0}
                            onClick={() => handleSelectSeries(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSelectSeries(item);
                            }}
                            className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70"
                          >
                            <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                              <img
                                src={item.cover}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                              {item.badge && (
                                <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                                  {item.badge}
                                </span>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                                  <Play className="w-4 h-4 fill-white text-white" /> 点击播放
                                </span>
                              </div>
                            </div>
                            <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                              <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                                {item.title}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-1">
                                {item.tags || "全网高分短剧"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================= 6. 我的追剧与观看历史板块 (Favorites & History) ======================= */}
        {!activeSeries && tab === "favorites" && (
          <div className="max-w-7xl mx-auto pb-14 space-y-6">
            {/* 顶部双选项卡切换栏与操作区 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              {/* 双选项卡: 我的追剧 / 观看历史 */}
              <div className="flex items-center gap-2 bg-[#0a0f1d] p-1.5 rounded-2xl border border-slate-800 w-fit">
                <button
                  type="button"
                  onClick={() => setFavSubTab("favorites")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 cursor-pointer ${
                    favSubTab === "favorites"
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${favSubTab === "favorites" ? "fill-white" : ""}`} />
                  <span>我的追剧</span>
                  {favorites.length > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        favSubTab === "favorites" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {favorites.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFavSubTab("history");
                    refreshHistory();
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 cursor-pointer ${
                    favSubTab === "history"
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>观看历史</span>
                  {historyList.length > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        favSubTab === "history" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {historyList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* 右侧操作按钮：仅在历史记录页且有记录时展示清空全部按钮 */}
              {favSubTab === "history" && historyList.length > 0 && (
                <div className="flex items-center gap-3">
                  {showClearHistoryConfirm ? (
                    <div className="flex items-center gap-2 bg-slate-900 border border-rose-500/40 p-1.5 rounded-xl text-xs">
                      <span className="text-rose-400 font-semibold px-2">确定清空观看历史?</span>
                      <button
                        type="button"
                        onClick={() => {
                          void clearHistory().then(() => {
                            void refreshHistory(); setShowClearHistoryConfirm(false); showToast("已清空观看历史记录");
                          }).catch(() => showToast("清空失败，请检查后端连接后重试"));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer"
                      >
                        确认清空
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearHistoryConfirm(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearHistoryConfirm(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-semibold transition cursor-pointer outline-none focus:ring-2 focus:ring-rose-500/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空观看历史</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* A. 我的追剧列表 */}
            {favSubTab === "favorites" && (
              <div>
                {favorites.length === 0 ? (
                  <div className="text-center py-28 text-slate-500 text-sm space-y-3">
                    <Heart className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
                    <p>暂无收藏短剧，快去官方首页、分类或热播榜单看看吧！</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {favorites.map((item) => (
                      <div
                        key={item.id}
                        tabIndex={0}
                        onClick={() => handleSelectSeries(item)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                        className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 relative"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          {item.badge && (
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                              {item.badge}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <Play className="w-4 h-4 fill-white text-white" /> 点击播放
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                          <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{item.tags || "全网高分短剧"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* B. 观看历史列表 (带进度条、集数、时间百分比、一键续播、悬浮单条删除) */}
            {favSubTab === "history" && (
              <div>
                <p className="mb-5 text-sm text-slate-400">从最近观看的位置继续，记录保存在本地并按远程配置自动同步。</p>
                {historyError && <div className="mb-5 text-rose-300">{historyError} <button className="underline" onClick={() => void refreshHistory()}>重试</button></div>}
                {historyList.length === 0 ? (
                  <div className="text-center py-28 text-slate-500 text-sm space-y-3">
                    <Clock className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
                    <p>暂无观看历史记录，点击任意短剧即可自动保存您的播放足迹！</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {historyList.map((hist) => {
                      const seriesObj: Series = {
                        id: hist.seriesId,
                        contentType: hist.contentType,
                        title: hist.title || "未知短剧",
                        cover: hist.cover || "",
                        badge: hist.badge || "",
                        description: "",
                        tags: hist.tags || "",
                      };
                      const percent =
                        hist.duration && hist.duration > 0
                          ? Math.min(100, Math.round((hist.position / hist.duration) * 100))
                          : 0;

                      return (
                        <div
                          key={hist.seriesId}
                          tabIndex={0}
                          onClick={() => handleSelectSeries(seriesObj, hist)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSelectSeries(seriesObj, hist);
                          }}
                          className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 relative"
                        >
                          {/* 封面与底部高亮进度条 */}
                          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                            <img
                              src={hist.cover}
                              alt={hist.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />

                            {/* 悬浮删除单条按钮 */}
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try { await removeHistoryItem(hist.seriesId); await refreshHistory(); showToast(`已删除《${hist.title}》的播放记录`); }
                                catch { showToast("删除失败，请检查后端连接后重试"); }
                              }}
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer shadow-md"
                              title="删除此记录"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            {/* 角标 */}
                            {hist.badge && (
                              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                                {hist.badge}
                              </span>
                            )}

                            {/* 悬浮播放微浮层 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/50">
                                <Play className="w-3.5 h-3.5 fill-white text-white" /> 继续观看
                              </span>
                            </div>

                            {/* 底部红色进度条底衬 */}
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
                              <div
                                className="h-full bg-rose-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* 详情描述区 */}
                          <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                            <div>
                              <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                                {hist.title || "未知剧集"}
                              </h4>
                              {/* 观看进度与百分比标注 */}
                              <div className="flex items-center justify-between text-xs text-rose-400/90 font-medium mt-1">
                                <span>看到第 {hist.episodeNumber || 1} 集</span>
                                <span className="font-mono text-[11px] text-slate-400">
                                  {formatTime(hist.position)}
                                  {percent > 0 ? ` (${percent}%)` : ""}
                                </span>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                              <span>
                                {hist.updatedAt
                                  ? new Date(hist.updatedAt).toLocaleString("zh-CN", {
                                      month: "numeric",
                                      day: "numeric", hour: "2-digit", minute: "2-digit",
                                    })
                                  : "最近"}
                              </span>
                              <span className="text-slate-400 group-hover:text-rose-400 font-semibold transition">
                                一键续播 &gt;
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!activeSeries && tab === "settings" && (
          <div className="max-w-xl mx-auto space-y-6 pt-6">
            <h2 className="text-xl font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-rose-500" /> 本地服务与远程同步</h2>
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 space-y-5">
              <h3 className="font-semibold">推荐偏好</h3>
              <label className="block text-sm text-slate-300">推荐内容
                <select aria-label="推荐内容" value={recommendationMode} onChange={e => {const mode=e.target.value as RecommendationMode;setRecommendationMode(mode);savePlaybackPreference("recommendationMode", mode);showToast("推荐模式已保存，下次进入推荐页生效");}} className="block mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none">
                  <option value="mixed">混合推荐</option><option value="real-drama">仅真人剧</option><option value="comic-drama">仅漫剧</option><option value="ai-drama">仅 AI 剧</option>
                </select>
              </label>
              <p className="text-xs text-slate-400">混合推荐包含真人剧、漫剧与 AI 剧，根据观看兴趣调整，并保留新内容探索。</p>
              {showRecommendationResetConfirm ? <div className="space-y-3 text-sm"><p>确定重新学习推荐偏好？收藏和观看历史会保留。</p><div className="flex gap-3"><button className="px-4 py-2 rounded-xl bg-rose-600" onClick={() => {streamWatchRef.current.leave();resetRecommendationPreferences();setShowRecommendationResetConfirm(false);showToast("推荐偏好已重置，下次进入推荐页生效");}}>确认重置</button><button className="px-4 py-2 rounded-xl bg-slate-800" onClick={() => setShowRecommendationResetConfirm(false)}>取消</button></div></div> : <button className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700" onClick={() => setShowRecommendationResetConfirm(true)}>重置推荐偏好</button>}
            </div>
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 space-y-5">
              <p className="text-sm text-slate-400">收藏、历史、搜索记录与播放偏好先保存在本地。配置远程服务后，连接同一家庭的设备可互相续播。</p>
              <div role="status" className="p-4 rounded-xl bg-slate-950 text-sm">
                <span className="text-rose-400 font-semibold">{{unconfigured:"未配置远程",pending:"待同步",syncing:"同步中",synced:"已同步",offline:"离线待同步"}[syncStatus.state] || "连接失败"}</span>
                {syncStatus.pending > 0 && <span className="ml-3 text-slate-400">待同步 {syncStatus.pending} 条</span>}
                {syncStatus.error && <p className="mt-2 text-amber-300">{syncStatus.error}</p>}
              </div>
              <label className="block text-sm text-slate-300">远程服务地址<input aria-label="远程服务地址" value={remoteUrl} onChange={e=>{remoteUrlTouched.current=true;setRemoteUrl(e.target.value)}} placeholder="https://sync.example.com" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none" /></label>
              <label className="block text-sm text-slate-300">家庭共享密钥<input aria-label="家庭共享密钥" type="password" autoComplete="new-password" value={remoteKey} onChange={e=>setRemoteKey(e.target.value)} placeholder={syncStatus.enabled?"留空沿用当前地址已保存的密钥":"填写远程服务生成的共享密钥"} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none" /></label>
              <div className="flex gap-3">
                <button disabled={syncSaving} onClick={async()=>{setSyncSaving(true);try{await configureSync(remoteUrl,remoteKey);setRemoteKey("");setSyncStatus(getSyncStatus());showToast("远程连接已验证，开始同步")}catch(error:any){showToast(error.response?.data?.error||"连接失败，原配置已保留")}finally{setSyncSaving(false)}}} className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50">验证并启用同步</button>
                {syncStatus.enabled && <button disabled={syncSaving} onClick={async()=>{try{await configureSync("","",false);setSyncStatus(getSyncStatus());showToast("已关闭远程同步，本地数据保留")}catch{showToast("配置保存失败")}}} className="px-4 py-3 rounded-xl bg-slate-800">关闭同步</button>}
              </div>
              <p className="text-xs text-slate-500">关闭同步后继续使用本地数据；更换地址需要重新验证连接。</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
