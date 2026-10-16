import React, { useState, useEffect, useRef } from "react";
import { historyUuid } from "./history-outbox.mjs";
import { bindRecommendationPlayback } from "./recommendation-session.mjs";
import { 
  api,
  getFavorites, 
  getServerProgress,
  beginHistory,
  saveProgress, 
  getPlaybackPreferences, 
  getSyncStatus, 
  refreshLibrary
} from "./api";
import { isVideoPlaying } from "./video-state";
import { 
  Detail, 
  Episode, 
  Series
} from "./types";

import { Header, NavTab } from "./components/Header";
import { HomePanel } from "./components/HomePanel";

// B8：非首屏组件按需加载（code-splitting），缩小首屏 JS。
// 首屏必需的 Header / HomePanel 保持同步加载；其余 Tab 与播放器仅在进入时拉取。
const RecommendStream = React.lazy(() => import("./components/RecommendStream").then((m) => ({ default: m.RecommendStream })));
const CategoryPanel = React.lazy(() => import("./components/CategoryPanel").then((m) => ({ default: m.CategoryPanel })));
const RankPanel = React.lazy(() => import("./components/RankPanel").then((m) => ({ default: m.RankPanel })));
const SearchPanel = React.lazy(() => import("./components/SearchPanel").then((m) => ({ default: m.SearchPanel })));
const LibraryPanel = React.lazy(() => import("./components/LibraryPanel").then((m) => ({ default: m.LibraryPanel })));
const SettingsPanel = React.lazy(() => import("./components/SettingsPanel").then((m) => ({ default: m.SettingsPanel })));
const PlayerModal = React.lazy(() => import("./components/PlayerModal").then((m) => ({ default: m.PlayerModal })));

const PanelFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex items-center justify-center py-24 text-slate-500 text-sm">
    加载中…
  </div>
);

import { useCatalog } from "./hooks/useCatalog";
import { useLibrary } from "./hooks/useLibrary";
import { useSync } from "./hooks/useSync";
import { useSearch } from "./hooks/useSearch";
import { usePlayback } from "./hooks/usePlayback";
import { useStreamFeed } from "./hooks/useStreamFeed";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function App() {
  const [tab, setTabState] = useState<NavTab>("home");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 1. 抽离的领域 Hooks
  const catalog = useCatalog(showToast);
  const library = useLibrary(showToast);
  const sync = useSync();
  const stream = useStreamFeed(showToast);

  // 2. 详情与播放器核心状态
  const [activeSeries, setActiveSeriesState] = useState<Detail | null>(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  const detailRequest = useRef(0);
  const lastLibraryRefreshRef = useRef(0);

  const invalidatePlaybackRequests = () => {
    detailRequest.current++;
    stream.streamDetailRequest.current++;
    stream.navigationGeneration.current++;
    stream.streamFeedRef.current?.cancel();
    stream.streamWatchRef.current?.leave();
    stream.detailWatchRef.current?.leave();
  };
  const setTab = (next: NavTab) => { invalidatePlaybackRequests(); setTabState(next); };
  const setActiveSeries = (next: Detail | null) => { if (!next) invalidatePlaybackRequests(); setActiveSeriesState(next); };

  // 选择短剧进入播放详情
  const handleSelectSeries = async (series: Series, selectedProgress?: any) => {
    const request = ++detailRequest.current;
    try {
      playback.setShowSeriesEndModal(false);
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
      playback.setPlaybackSpeed(getPlaybackPreferences().speed);
      stream.setStreamPlaybackSpeed(getPlaybackPreferences().speed);
      setActiveSeries(detail);
      setCurrentEpisodeIndex(initIndex);
      playback.setEpisodeRangeIndex(Math.floor(initIndex / 30));
      playback.setShowRangeDropdown(false);

      const ep = detail.episodes?.[initIndex];
      playback.qualitySwitchTimeRef.current = prog?.completed || prog?.episodeId !== ep?.id ? 0 : prog?.position || 0;
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
    }
  };

  // 3. 搜索 Hook (包含代际防竞态控制 D3-F4)
  const search = useSearch(
    library.saveSearchHistory,
    library.setSearchHistoryList,
    library.refreshSearchHistory,
    handleSelectSeries,
    showToast
  );

  // 4. 播放控制 Hook
  const playback = usePlayback(
    activeSeries,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    handleSelectSeries,
    showToast,
    catalog.sections,
    catalog.banners
  );

  const currentEpisode: Episode | undefined = activeSeries?.episodes?.[currentEpisodeIndex];

  // 5. 键盘与遥控快捷键 Hook (包含 Escape 键退出播放弹窗 D3-F3)
  useKeyboardShortcuts({
    activeSeries,
    currentEpisode,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    setActiveSeries,
    showSeriesEndModal: playback.showSeriesEndModal,
    setShowSeriesEndModal: playback.setShowSeriesEndModal,
    seriesEndTarget: playback.seriesEndTarget,
    handleSelectSeries,
    playback: {
      videoRef: playback.videoRef,
      handleTogglePlay: playback.handleTogglePlay,
      toggleFullscreen: playback.toggleFullscreen,
      handleToggleMute: playback.handleToggleMute,
      setVolume: playback.setVolume,
      setIsMuted: playback.setIsMuted,
      isFullscreen: playback.isFullscreen,
    },
    showToast,
  });

  // 初始加载 (D3-F2 保持：移除重复的 loadCategoryTags，只留 selectedCatType 监听)
  useEffect(() => {
    catalog.loadHomeData();
    catalog.loadRankTypes();
    library.setFavorites(getFavorites());
    void library.refreshHistory();
    library.refreshSearchHistory();
  }, []);

  useEffect(() => {
    if (tab !== "favorites" || activeSeries) return;
    void library.refreshHistory();
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (isVideoPlaying()) return;
      void library.refreshHistory();
    }, 10000);
    return () => { clearInterval(timer); };
  }, [tab, activeSeries]);

  useEffect(() => {
    const update = () => {
      const pref = getPlaybackPreferences();
      const epoch = stream.recommendationSignalEpoch.current;
      if (epoch.resetAt !== pref.recommendationResetAt) {
        stream.streamWatchRef.current.discard();
        stream.detailWatchRef.current.discard();
        epoch.resetAt = pref.recommendationResetAt;
        epoch.session = historyUuid();
        const series = stream.streamFeedRef.current.items[stream.streamFeedRef.current.index];
        if (tab === "recommend" && !activeSeries && series && stream.streamCurrentEpisode) {
          stream.streamWatchRef.current.begin(epoch.session, series);
        } else if (activeSeries) {
          stream.detailWatchRef.current.begin(historyUuid(), activeSeries);
        }
      }
      sync.setRecommendationMode(pref.recommendationMode);
      library.setFavorites(getFavorites());
      library.refreshSearchHistory();
      const status = getSyncStatus();
      sync.setSyncStatus(status);
      if (!sync.remoteUrlTouched.current) sync.setRemoteUrl(status.url);
      if (!activeSeries && tab !== "recommend") {
        playback.setPlaybackSpeed(pref.speed);
        playback.setCurrentQuality(pref.quality);
      }
    };
    window.addEventListener("library-updated", update);
    const now = Date.now();
    if (now - lastLibraryRefreshRef.current > 5000) {
      lastLibraryRefreshRef.current = now;
      void refreshLibrary().then(update).catch(()=>{});
    } else {
      update();
    }
    return () => window.removeEventListener("library-updated", update);
  }, [activeSeries, tab, stream.streamCurrentEpisode?.id]);

  useEffect(() => {
    if (!activeSeries && tab !== "recommend") {
      const preferences = getPlaybackPreferences();
      playback.setPlaybackSpeed(preferences.speed);
      playback.setCurrentQuality(preferences.quality);
    }
  }, [activeSeries, tab]);

  // 轮播定时器
  useEffect(() => {
    if (catalog.banners.length <= 1) return;
    const timer = setInterval(() => {
      catalog.setActiveBannerIndex((prev) => (prev + 1) % catalog.banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [catalog.banners]);

  // 分类筛选变动时加载
  useEffect(() => {
    catalog.loadCategoryTags(catalog.selectedCatType);
    catalog.fetchCategoryList(catalog.selectedCatType, catalog.selectedCatTag, catalog.catPage);
  }, [catalog.selectedCatType, catalog.selectedCatTag, catalog.catPage]);

  // 榜单类型或页码变动时加载
  useEffect(() => {
    catalog.fetchRankList(catalog.selectedRankSlug, catalog.rankPage);
  }, [catalog.selectedRankSlug, catalog.rankPage]);

  // 推荐流上下键切剧
  useEffect(() => {
    const handleStreamKeyDown = (e: KeyboardEvent) => {
      if (tab !== "recommend" || activeSeries) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        stream.handleSwitchStream("next");
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        stream.handleSwitchStream("prev");
      }
    };

    window.addEventListener("keydown", handleStreamKeyDown);
    return () => window.removeEventListener("keydown", handleStreamKeyDown);
  }, [tab, activeSeries, stream]);

  useEffect(() => {
    const watch = stream.detailWatchRef.current, video = playback.videoRef.current;
    if (!activeSeries || !video) { watch.pause(); return; }
    return bindRecommendationPlayback(video, watch);
  }, [activeSeries, currentEpisode?.id, playback.currentQuality]);

  useEffect(() => {
    const snapshot = () => {
      const series = activeSeries || stream.streamList[stream.streamIndex];
      const episode = activeSeries ? currentEpisode : stream.streamCurrentEpisode;
      const video = activeSeries ? playback.videoRef.current : stream.streamVideoRef.current;
      if (!series || !episode || !video || (activeSeries ? playback.qualitySwitchTimeRef.current : stream.streamQualitySwitchTimeRef.current) !== null) return;
      saveProgress(series.id, episode.id, Math.floor(video.currentTime || 0), {
        title: series.title, cover: series.cover, badge: series.badge, tags: series.tags,
        episodeNumber: episode.number, duration: Math.floor(video.duration || 0), completed: video.ended,
      });
    };
    const visibility = () => { if (document.visibilityState === "hidden") snapshot(); };
    window.addEventListener("pagehide", snapshot);
    document.addEventListener("visibilitychange", visibility);
    const video = activeSeries ? playback.videoRef.current : stream.streamVideoRef.current;
    video?.addEventListener("seeked", snapshot);
    return () => {
      window.removeEventListener("pagehide", snapshot);
      document.removeEventListener("visibilitychange", visibility);
      video?.removeEventListener("seeked", snapshot);
    };
  }, [activeSeries, currentEpisode?.id, stream.streamIndex, stream.streamCurrentEpisode?.id]);

  // 拉取官方清晰度列表
  useEffect(() => {
    if (!currentEpisode) return;
    let isMounted = true;
    playback.setQualitiesLoading(true);

    api.getVideoQualities(currentEpisode.id, activeSeries?.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.qualities && res.qualities.length > 0) {
          playback.setVideoQualities(res.qualities);
          const pref = getPlaybackPreferences().quality;
          const hasPref = pref && res.qualities.some((q) => q.key === pref);
          if (hasPref) playback.setCurrentQuality(pref);
          else if (res.defaultQuality) playback.setCurrentQuality(res.defaultQuality);
          else playback.setCurrentQuality(res.qualities[0].key);
        }
      })
      .catch((err) => { console.warn("加载官方画质失败:", err); })
      .finally(() => { if (isMounted) playback.setQualitiesLoading(false); });

    return () => { isMounted = false; };
  }, [currentEpisode?.id, activeSeries?.id]);

  // 同题材推荐短剧
  useEffect(() => {
    if (!activeSeries?.id) {
      playback.setRelatedSeries([]);
      playback.setRelatedPool([]);
      playback.setRelatedKeyword("");
      playback.setRelatedPage(1);
      return;
    }

    let isMounted = true;
    playback.setRelatedLoading(true);
    playback.setRelatedPage(1);
    playback.setRecommendFadeIn(true);

    Promise.all([
      api.getRelatedSeries(activeSeries.id, 16, 1).catch(() => ({ seriesId: "", keyword: "", items: [] })),
      api.getRecommend(1).catch(() => ({ items: [], page: 1 })),
    ])
      .then(([relRes, recRes]) => {
        if (!isMounted) return;
        const seenIds = new Set<string>([String(activeSeries.id)]);
        const combinedPool: Series[] = [];

        for (const item of relRes.items || []) {
          const sid = String(item.id);
          if (!seenIds.has(sid)) { seenIds.add(sid); combinedPool.push(item); }
        }
        for (const item of recRes.items || []) {
          const sid = String(item.id);
          if (!seenIds.has(sid)) { seenIds.add(sid); combinedPool.push(item); }
        }

        playback.setRelatedPool(combinedPool);
        playback.setRelatedSeries(combinedPool.slice(0, 15));
        playback.setRelatedKeyword(relRes.keyword || "都市");
      })
      .catch((err) => { console.warn("加载同类推荐短剧失败:", err); })
      .finally(() => { if (isMounted) playback.setRelatedLoading(false); });

    return () => { isMounted = false; };
  }, [activeSeries?.id]);

  // 5秒倒计时引擎，全剧终沉浸式自动连播
  useEffect(() => {
    if (!playback.showSeriesEndModal || !playback.seriesEndTarget) return;
    playback.setSeriesEndCountdown(5);
    const timer = setInterval(() => {
      playback.setSeriesEndCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          playback.setShowSeriesEndModal(false);
          void handleSelectSeries(playback.seriesEndTarget!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playback.showSeriesEndModal, playback.seriesEndTarget]);

  useEffect(() => {
    playback.setShowSeriesEndModal(false);
  }, [activeSeries?.id, currentEpisodeIndex]);

  // 自动拉取当前短剧的同系列多季列表
  useEffect(() => {
    if (!activeSeries) {
      playback.setSeasonsList([]);
      return;
    }
    let cancelled = false;
    api.getSeriesSeasons(activeSeries)
      .then((list) => {
        if (!cancelled) playback.setSeasonsList(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeSeries?.id]);

  // 全屏状态同步监听 (DOM 原生与 Electron 桌面双同步)
  useEffect(() => {
    const handleFullscreenChange = () => {
      playback.setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    const desktop = (window as any).hongguotvDesktop;
    let unsubscribeDesktop: (() => void) | undefined;
    if (desktop?.isDesktop && typeof desktop.onFullScreenChanged === "function") {
      try {
        unsubscribeDesktop = desktop.onFullScreenChanged((flag: boolean) => {
          playback.setIsFullscreen(Boolean(flag));
        });
      } catch {}
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (typeof unsubscribeDesktop === "function") {
        try { unsubscribeDesktop(); } catch {}
      }
    };
  }, []);

  const handleVideoEnded = () => {
    const video = playback.videoRef.current;
    if (!video || !activeSeries) return;
    playback.handleTimeUpdate();
    stream.detailWatchRef.current.pause();
    if (currentEpisodeIndex === activeSeries.episodes.length - 1 && video.ended) stream.detailWatchRef.current.complete();

    if (currentEpisodeIndex < activeSeries.episodes.length - 1) {
      if (playback.autoPlayNext) {
        setCurrentEpisodeIndex((prev) => prev + 1);
        showToast(`第 ${currentEpisodeIndex + 1} 集播放完毕，自动播放下一集`);
      } else {
        video.pause();
        playback.setIsPlaying(false);
      }
      return;
    }

    const isDurationValid = !isNaN(video.duration) && video.duration > 0;
    const isCompletelyEnded = video.ended || (isDurationValid && video.currentTime >= video.duration - 0.3);
    if (!isCompletelyEnded) return;

    video.pause();
    playback.setIsPlaying(false);

    let candidate: Series | null = null;
    let isNextSeason = false;

    const currentSeasonIdx = playback.seasonsList.findIndex(
      (s) => String(s.seriesId) === String(activeSeries.id)
    );
    if (currentSeasonIdx !== -1 && currentSeasonIdx < playback.seasonsList.length - 1) {
      const nextSeason = playback.seasonsList[currentSeasonIdx + 1];
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

    if (!candidate) {
      const allPool = [
        ...playback.relatedSeries,
        ...playback.relatedPool,
        ...catalog.sections.flatMap((s) => s.items),
        ...catalog.banners
      ];
      candidate = allPool.find((s) => String(s.id) !== String(activeSeries.id)) || null;
    }

    if (candidate) {
      playback.setSeriesEndTarget(candidate);
      playback.setShowSeriesEndModal(true);
      if (isNextSeason) showToast(`🎉 恭喜追完当前季！即将自动连播下一季`);
    } else {
      showToast(`🎉 恭喜追完《${activeSeries.title}》全集！`);
    }
  };

  const todayStr = (() => {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日已更新`;
  })();

  const handleNavigate = (nextTab: NavTab) => {
    setTab(nextTab);
    setActiveSeries(null);
    if (nextTab === "recommend") stream.loadStreamData(1, false);
    else if (nextTab === "category" && catalog.categoryItems.length === 0) {
      catalog.fetchCategoryList(catalog.selectedCatType, catalog.selectedCatTag, catalog.catPage);
    } else if (nextTab === "rank" && catalog.rankItems.length === 0) {
      catalog.fetchRankList(catalog.selectedRankSlug, catalog.rankPage);
    } else if (nextTab === "favorites") {
      void library.refreshHistory();
      library.setFavorites(getFavorites());
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100 flex-col font-sans select-none">
      {/* 提示条 Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 border border-slate-700/80 backdrop-blur px-5 py-2.5 rounded-full text-sm shadow-2xl text-rose-400 font-semibold animate-bounce">
          {toast}
        </div>
      )}

      {/* 顶部通用导航栏 */}
      {!(tab === "recommend" && !activeSeries && playback.isFullscreen) && <Header
        tab={tab}
        activeSeries={activeSeries}
        favoritesCount={library.favorites.length}
        onNavigate={handleNavigate}
      />}

      {library.historyStorageWarning && (
        <div role="alert" className="bg-amber-950 text-amber-200 px-5 py-2">
          {library.historyStorageWarning}
        </div>
      )}

      {/* 主界面区域 */}
      <main className={`flex-1 ${!activeSeries && tab === "recommend" ? "overflow-hidden p-0" : "overflow-y-auto px-4 md:px-8 py-6"}`}>
        <React.Suspense fallback={<PanelFallback />}>
        {/* 1. 播放与选集详情界面 */}
        {activeSeries ? (
          <PlayerModal
            activeSeries={activeSeries}
            setActiveSeries={setActiveSeries}
            currentEpisode={currentEpisode || null}
            currentEpisodeIndex={currentEpisodeIndex}
            setCurrentEpisodeIndex={setCurrentEpisodeIndex}
            playerContainerRef={playback.playerContainerRef}
            videoRef={playback.videoRef}
            resetControlsTimer={playback.resetControlsTimer}
            toggleFullscreen={playback.toggleFullscreen}
            isFullscreen={playback.isFullscreen}
            currentQuality={playback.currentQuality}
            handleTimeUpdate={playback.handleTimeUpdate}
            handleLoadedMetadata={playback.handleLoadedMetadata}
            handleVideoEnded={handleVideoEnded}
            isPlaying={playback.isPlaying}
            setIsPlaying={playback.setIsPlaying}
            setShowSeriesEndModal={playback.setShowSeriesEndModal}
            handleTogglePlay={playback.handleTogglePlay}
            showControls={playback.showControls}
            showShortcutHelp={playback.showShortcutsHelp}
            setShowShortcutHelp={playback.setShowShortcutsHelp}
            duration={playback.duration}
            currentTime={playback.currentTime}
            handleSeek={playback.handleSeek}
            showSpeedMenu={playback.showSpeedMenu}
            setShowSpeedMenu={playback.setShowSpeedMenu}
            setShowQualityMenu={playback.setShowQualityMenu}
            playbackSpeed={playback.playbackSpeed}
            handleSelectSpeed={playback.handleSelectSpeed}
            showQualityMenu={playback.showQualityMenu}
            qualitiesLoading={playback.qualitiesLoading}
            videoQualities={playback.videoQualities}
            handleSelectQuality={playback.handleSelectQuality}
            autoPlayNext={playback.autoPlayNext}
            setAutoPlayNext={playback.setAutoPlayNext}
            showToast={showToast}
            handleToggleMute={playback.handleToggleMute}
            isMuted={playback.isMuted}
            volume={playback.volume}
            handleVolumeChange={playback.handleVolumeChange}
            showSeriesEndModal={playback.showSeriesEndModal}
            seriesEndTarget={playback.seriesEndTarget}
            handleSelectSeries={handleSelectSeries}
            seriesEndCountdown={playback.seriesEndCountdown}
            handleSwitchNextSeriesRecommendation={playback.handleSwitchNextSeriesRecommendation}
            relatedKeyword={playback.relatedKeyword}
            handleRefreshRecommend={playback.handleRefreshRecommend}
            relatedLoading={playback.relatedLoading}
            relatedRefreshing={playback.relatedRefreshing}
            refreshRotateDeg={playback.refreshRotateDeg}
            recommendFadeIn={playback.recommendFadeIn}
            relatedSeries={playback.relatedSeries}
            handleToggleFav={library.handleToggleFav}
            favorites={library.favorites}
            showRangeDropdown={playback.showRangeDropdown}
            setShowRangeDropdown={playback.setShowRangeDropdown}
            episodeRangeIndex={playback.episodeRangeIndex}
            setEpisodeRangeIndex={playback.setEpisodeRangeIndex}
            seasonsList={playback.seasonsList}
            handleSwitchSeason={playback.handleSwitchSeason}
          />
        ) : null}

        {/* 2. 官方首页板块 */}
        {!activeSeries && tab === "home" && (
          <HomePanel
            banners={catalog.banners}
            activeBannerIndex={catalog.activeBannerIndex}
            setActiveBannerIndex={catalog.setActiveBannerIndex}
            selectedHomeSection={catalog.selectedHomeSection}
            setSelectedHomeSection={catalog.setSelectedHomeSection}
            sections={catalog.sections}
            handleSelectSeries={handleSelectSeries}
            handleToggleFav={library.handleToggleFav}
          />
        )}

        {/* 2.5 沉浸式刷剧流板块 */}
        {!activeSeries && tab === "recommend" && (
          <RecommendStream
            streamWheelLockRef={stream.streamWheelLockRef}
            streamLoading={stream.streamLoading}
            streamList={stream.streamList}
            streamIndex={stream.streamIndex}
            streamError={stream.streamError}
            setStreamError={stream.setStreamError}
            streamFeedRef={stream.streamFeedRef}
            loadStreamDetail={stream.loadStreamDetail}
            favorites={library.favorites}
            handleToggleFav={library.handleToggleFav}
            handleSwitchStream={stream.handleSwitchStream}
            streamVideoRef={stream.streamVideoRef}
            streamCurrentEpisode={stream.streamCurrentEpisode}
            streamEpisodeIndex={stream.streamEpisodeIndex}
            streamQuality={stream.streamQuality}
            streamPlaybackSpeed={stream.streamPlaybackSpeed}
            streamIsPlaying={stream.streamIsPlaying}
            setStreamIsPlaying={stream.setStreamIsPlaying}
            streamIsLandscape={stream.streamIsLandscape}
            setStreamIsLandscape={stream.setStreamIsLandscape}
            streamQualitySwitchTimeRef={stream.streamQualitySwitchTimeRef}
            streamCurrentTime={stream.streamCurrentTime}
            setStreamCurrentTime={stream.setStreamCurrentTime}
            streamDuration={stream.streamDuration}
            setStreamDuration={stream.setStreamDuration}
            streamIsDraggingProgress={stream.streamIsDraggingProgress}
            setStreamIsDraggingProgress={stream.setStreamIsDraggingProgress}
            streamShowSpeedMenu={stream.streamShowSpeedMenu}
            setStreamShowSpeedMenu={stream.setStreamShowSpeedMenu}
            streamShowQualityMenu={stream.streamShowQualityMenu}
            setStreamShowQualityMenu={stream.setStreamShowQualityMenu}
            streamQualitiesLoading={stream.streamQualitiesLoading}
            streamQualities={stream.streamQualities}
            handleStreamSelectQuality={stream.handleStreamSelectQuality}
            handleStreamSelectSpeed={stream.handleStreamSelectSpeed}
            handleStreamNextEpisode={stream.handleStreamNextEpisode}
            streamDescriptionExpanded={stream.streamDescriptionExpanded}
            setStreamDescriptionExpanded={stream.setStreamDescriptionExpanded}
            streamDetail={stream.streamDetail}
            handleSelectSeries={handleSelectSeries}
            refreshHistory={library.refreshHistory}
            showToast={showToast}
          />
        )}

        {/* 3. 官方分类板块 */}
        {!activeSeries && tab === "category" && (
          <CategoryPanel
            categoryTagsLoading={catalog.categoryTagsLoading}
            categoryTags={catalog.categoryTags}
            categoryTypes={catalog.categoryTypes}
            selectedCatType={catalog.selectedCatType}
            setSelectedCatType={catalog.setSelectedCatType}
            selectedCatTag={catalog.selectedCatTag}
            setSelectedCatTag={catalog.setSelectedCatTag}
            catPage={catalog.catPage}
            setCatPage={catalog.setCatPage}
            categoryError={catalog.categoryError}
            onRetry={() => {
              void catalog.loadCategoryTags(catalog.selectedCatType);
              void catalog.fetchCategoryList(catalog.selectedCatType, catalog.selectedCatTag, catalog.catPage);
            }}
            catLoading={catalog.catLoading}
            categoryItems={catalog.categoryItems}
            categoryTotalPages={catalog.categoryTotalPages}
            handleSelectSeries={handleSelectSeries}
          />
        )}

        {/* 4. 官方榜单板块 */}
        {!activeSeries && tab === "rank" && (
          <RankPanel
            rankTypes={catalog.rankTypes}
            selectedRankSlug={catalog.selectedRankSlug}
            setSelectedRankSlug={catalog.setSelectedRankSlug}
            rankPage={catalog.rankPage}
            setRankPage={catalog.setRankPage}
            rankTotalPages={catalog.rankTotalPages}
            rankLoading={catalog.rankLoading}
            rankItems={catalog.rankItems}
            handleSelectSeries={handleSelectSeries}
            onNavigateHome={() => handleNavigate("home")}
            todayStr={todayStr}
          />
        )}

        {/* 5. 搜索片库板块 */}
        {!activeSeries && tab === "search" && (
          <SearchPanel
            searchQuery={search.searchQuery}
            setSearchQuery={search.setSearchQuery}
            handleSearchInputChange={search.handleSearchInputChange}
            handleSearch={search.handleSearch}
            searchInputRef={search.searchInputRef}
            searchLoading={search.searchLoading}
            showSuggestions={search.showSuggestions}
            setShowSuggestions={search.setShowSuggestions}
            searchSuggestions={search.searchSuggestions}
            setSearchSuggestions={search.setSearchSuggestions}
            isSuggesting={search.isSuggesting}
            handleSelectSuggestion={search.handleSelectSuggestion}
            hasSearched={search.hasSearched}
            setHasSearched={search.setHasSearched}
            searchResults={search.searchResults}
            setSearchResults={search.setSearchResults}
            hotSearchKeywords={search.hotSearchKeywords}
            searchHistoryList={library.searchHistoryList}
            setSearchHistoryList={library.setSearchHistoryList}
            searchFilterTags={search.searchFilterTags}
            searchFilterTag={search.searchFilterTag}
            setSearchFilterTag={search.setSearchFilterTag}
            executeSearch={search.executeSearch}
            clearSearchHistory={library.clearSearchHistory}
            removeSearchHistory={library.removeSearchHistory}
            refreshSearchHistory={library.refreshSearchHistory}
            showToast={showToast}
            handleSelectSeries={handleSelectSeries}
          />
        )}

        {/* 6. 我的追剧与观看历史板块 */}
        {!activeSeries && tab === "favorites" && (
          <LibraryPanel
            favorites={library.favorites}
            historyList={library.historyList}
            refreshHistory={library.refreshHistory}
            clearHistory={library.clearHistory}
            removeHistoryItem={library.removeHistoryItem}
            handleSelectSeries={handleSelectSeries}
            showToast={showToast}
          />
        )}

        {/* 7. 设置板块 */}
        {!activeSeries && tab === "settings" && (
          <SettingsPanel
            recommendationMode={sync.recommendationMode}
            setRecommendationMode={sync.setRecommendationMode}
            savePlaybackPreference={sync.savePlaybackPreference}
            showToast={showToast}
            showRecommendationResetConfirm={sync.showRecommendationResetConfirm}
            setShowRecommendationResetConfirm={sync.setShowRecommendationResetConfirm}
            onResetRecommendationPreferences={() => {
              stream.streamWatchRef.current.leave();
              sync.resetRecommendationPreferences();
            }}
            syncStatus={sync.syncStatus}
            remoteUrl={sync.remoteUrl}
            setRemoteUrl={sync.setRemoteUrl}
            remoteUrlTouched={sync.remoteUrlTouched}
            remoteKey={sync.remoteKey}
            setRemoteKey={sync.setRemoteKey}
            syncSaving={sync.syncSaving}
            setSyncSaving={sync.setSyncSaving}
            configureSync={sync.configureSync}
            setSyncStatus={sync.setSyncStatus}
            getSyncStatus={sync.getSyncStatus}
          />
        )}
        </React.Suspense>
      </main>
    </div>
  );
}
