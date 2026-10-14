import { useState, useRef, useEffect, useCallback } from "react";
import { api, getPlaybackPreferences, savePlaybackPreference, saveProgress } from "../api";
import { Detail, Episode, SeasonInfo, Series, VideoQualityItem } from "../types";

export function usePlayback(
  activeSeries: Detail | null,
  currentEpisodeIndex: number,
  setCurrentEpisodeIndex: React.Dispatch<React.SetStateAction<number>>,
  handleSelectSeries: (series: Series, resumeHistory?: any) => Promise<void>,
  showToast: (msg: string) => void,
  catalogSections: any[],
  catalogBanners: any[]
) {
  const currentEpisode: Episode | undefined = activeSeries?.episodes?.[currentEpisodeIndex];

  // 播放器状态
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // 画质与倍速
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const saved = String(getPlaybackPreferences().speed);
      if (saved) return Number(saved);
    } catch {}
    return 1.0;
  });
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>(() => {
    try {
      return getPlaybackPreferences().quality || "1080P";
    } catch {
      return "1080P";
    }
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [videoQualities, setVideoQualities] = useState<VideoQualityItem[]>([]);
  const [qualitiesLoading, setQualitiesLoading] = useState(false);

  // 推荐状态
  const [relatedSeries, setRelatedSeries] = useState<Series[]>([]);
  const [relatedPool, setRelatedPool] = useState<Series[]>([]);
  const [relatedPage, setRelatedPage] = useState<number>(1);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedRefreshing, setRelatedRefreshing] = useState(false);
  const [refreshRotateDeg, setRefreshRotateDeg] = useState(0);
  const [relatedKeyword, setRelatedKeyword] = useState<string>("都市");
  const [recommendFadeIn, setRecommendFadeIn] = useState(true);

  // 片尾推荐弹窗
  const [showSeriesEndModal, setShowSeriesEndModal] = useState(false);
  const [seriesEndCountdown, setSeriesEndCountdown] = useState(5);
  const [seriesEndTarget, setSeriesEndTarget] = useState<Series | null>(null);

  // 多季状态
  const [seasonsList, setSeasonsList] = useState<SeasonInfo[]>([]);
  const [, setSelectedSeasonId] = useState<string | number | null>(null);
  const [, setSeasonsLoading] = useState(false);

  // 选集区间状态
  const [episodeRangeIndex, setEpisodeRangeIndex] = useState(0);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const qualitySwitchTimeRef = useRef<number | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  }, [isPlaying]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else video.play().catch(() => {});
    setIsPlaying(!isPlaying);
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeSeries || !currentEpisode) return;
    const cur = video.currentTime;
    setCurrentTime(cur);
    setDuration(video.duration || 0);

    const sec = Math.floor(cur);
    if (sec >= 0 && qualitySwitchTimeRef.current === null) {
      saveProgress(activeSeries.id, currentEpisode.id, sec, {
        title: activeSeries.title,
        cover: activeSeries.cover,
        badge: activeSeries.badge,
        tags: activeSeries.tags,
        episodeNumber: currentEpisode.number || currentEpisodeIndex + 1,
        duration: Math.floor(video.duration || 0),
        completed: video.ended,
      });
    }
  }, [activeSeries, currentEpisode, currentEpisodeIndex]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    setDuration(video.duration || 0);
    video.playbackRate = playbackSpeed;
    if (qualitySwitchTimeRef.current !== null) {
      if (qualitySwitchTimeRef.current > 0) video.currentTime = qualitySwitchTimeRef.current;
      qualitySwitchTimeRef.current = null;
    }
    video.play().catch(() => {});
    setIsPlaying(true);
    resetControlsTimer();
  }, [playbackSpeed, resetControlsTimer]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (activeSeries && currentEpisode) {
        saveProgress(activeSeries.id, currentEpisode.id, Math.floor(time), {
          title: activeSeries.title,
          cover: activeSeries.cover,
          badge: activeSeries.badge,
          tags: activeSeries.tags,
          episodeNumber: currentEpisode.number || currentEpisodeIndex + 1,
          duration: Math.floor(duration || 0),
        });
      }
    }
    resetControlsTimer();
  }, [activeSeries, currentEpisode, currentEpisodeIndex, duration, resetControlsTimer]);

  const handleSelectQuality = useCallback((qKey: string) => {
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
    try { savePlaybackPreference("quality", qKey); } catch {}
    showToast(`清晰度已切换至：${qKey}`);

    if (video) {
      const handleRestoreOnReady = () => {
        if (qualitySwitchTimeRef.current !== null && qualitySwitchTimeRef.current > 0) {
          video.currentTime = qualitySwitchTimeRef.current;
          qualitySwitchTimeRef.current = null;
        }
        video.playbackRate = playbackSpeed;
        if (!wasPaused) video.play().catch(() => {});
      };
      video.addEventListener("loadeddata", handleRestoreOnReady, { once: true });
    }
    resetControlsTimer();
  }, [currentQuality, currentTime, playbackSpeed, resetControlsTimer, showToast]);

  const handleSelectSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    savePlaybackPreference("speed", speed);
    setShowSpeedMenu(false);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    showToast(`倍速已切换至：${speed}x`);
    resetControlsTimer();
  }, [resetControlsTimer, showToast]);

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) playerContainerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      showToast(`已开启声音 (音量 ${Math.round(volume * 100)}%)`);
    } else {
      video.muted = true;
      setIsMuted(true);
      showToast("已静音");
    }
    resetControlsTimer();
  }, [isMuted, resetControlsTimer, showToast, volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = false;
    }
    setIsMuted(false);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleSwitchSeason = useCallback(async (season: SeasonInfo) => {
    if (String(season.seriesId) === String(activeSeries?.id)) {
      showToast(`当前正处于《${season.seasonLabel}》`);
      return;
    }
    try {
      showToast(`正在为您切换至《${season.seasonLabel}》...`);
      const targetSeries: Series = {
        id: season.seriesId,
        title: season.title,
        cover: season.cover || activeSeries?.cover || "",
        badge: season.badge || "全集",
        description: "",
        tags: "同系列多季",
      };
      await handleSelectSeries(targetSeries);
      showToast(`已成功切换并开始播放《${season.seasonLabel}》`);
    } catch {
      showToast("切换季数失败，请重试");
    }
  }, [activeSeries?.cover, activeSeries?.id, handleSelectSeries, showToast]);

  const handleSwitchNextSeriesRecommendation = useCallback(() => {
    const allPool = [
      ...relatedSeries,
      ...relatedPool,
      ...catalogSections.flatMap((s) => s.items),
      ...catalogBanners
    ];
    const available = allPool.filter(
      (s) => String(s.id) !== String(activeSeries?.id) && String(s.id) !== String(seriesEndTarget?.id)
    );
    if (available.length > 0) {
      const nextOne = available[Math.floor(Math.random() * available.length)];
      setSeriesEndTarget(nextOne);
      setSeriesEndCountdown(5);
      showToast(`已更换推荐短剧：《${nextOne.title}》`);
    } else {
      showToast("暂无更多推荐剧集");
    }
  }, [activeSeries?.id, catalogBanners, catalogSections, relatedPool, relatedSeries, seriesEndTarget?.id, showToast]);

  const handleRefreshRecommend = useCallback(async () => {
    if (!activeSeries?.id || relatedRefreshing || relatedLoading) return;
    setRefreshRotateDeg((prev) => prev + 360);
    setRelatedRefreshing(true);
    setRecommendFadeIn(false);

    const BATCH_SIZE = 15;
    const nextPage = relatedPage + 1;
    const startIndex = (nextPage - 1) * BATCH_SIZE;
    const endIndex = nextPage * BATCH_SIZE;

    if (relatedPool.length >= endIndex) {
      setTimeout(() => {
        setRelatedSeries(relatedPool.slice(startIndex, endIndex));
        setRelatedPage(nextPage);
        setRecommendFadeIn(true);
        setRelatedRefreshing(false);
      }, 180);
      return;
    }

    try {
      const [moreRelated, moreRec] = await Promise.all([
        api.getRelatedSeries(activeSeries.id, 15, nextPage).catch(() => ({ items: [] })),
        api.getRecommend(nextPage).catch(() => ({ items: [] })),
      ]);

      const seen = new Set<string>([String(activeSeries.id), ...relatedPool.map((i) => String(i.id))]);
      const newItems: Series[] = [];

      for (const item of moreRelated.items || []) {
        const sid = String(item.id);
        if (!seen.has(sid)) { seen.add(sid); newItems.push(item); }
      }
      for (const item of moreRec.items || []) {
        const sid = String(item.id);
        if (!seen.has(sid)) { seen.add(sid); newItems.push(item); }
      }

      setTimeout(() => {
        if (newItems.length >= 8) {
          const updatedPool = [...relatedPool, ...newItems];
          setRelatedPool(updatedPool);
          setRelatedSeries(newItems.slice(0, 15));
          setRelatedPage(nextPage);
        } else {
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
  }, [activeSeries?.id, relatedLoading, relatedPage, relatedPool, relatedRefreshing]);

  return {
    currentEpisode,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isFullscreen,
    setIsFullscreen,
    autoPlayNext,
    setAutoPlayNext,
    showControls,
    setShowControls,
    showShortcutsHelp,
    setShowShortcutsHelp,
    playbackSpeed,
    setPlaybackSpeed,
    currentQuality,
    setCurrentQuality,
    showQualityMenu,
    setShowQualityMenu,
    showSpeedMenu,
    setShowSpeedMenu,
    videoQualities,
    setVideoQualities,
    qualitiesLoading,
    setQualitiesLoading,
    relatedSeries,
    setRelatedSeries,
    relatedPool,
    setRelatedPool,
    relatedPage,
    setRelatedPage,
    relatedLoading,
    setRelatedLoading,
    relatedRefreshing,
    setRelatedRefreshing,
    refreshRotateDeg,
    setRefreshRotateDeg,
    relatedKeyword,
    setRelatedKeyword,
    recommendFadeIn,
    setRecommendFadeIn,
    showSeriesEndModal,
    setShowSeriesEndModal,
    seriesEndCountdown,
    setSeriesEndCountdown,
    seriesEndTarget,
    setSeriesEndTarget,
    seasonsList,
    setSeasonsList,
    episodeRangeIndex,
    setEpisodeRangeIndex,
    showRangeDropdown,
    setShowRangeDropdown,
    videoRef,
    playerContainerRef,
    controlsTimerRef,
    qualitySwitchTimeRef,
    resetControlsTimer,
    handleTogglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleSeek,
    handleSelectQuality,
    handleSelectSpeed,
    toggleFullscreen,
    handleToggleMute,
    handleVolumeChange,
    handleSwitchSeason,
    handleSwitchNextSeriesRecommendation,
    handleRefreshRecommend,
  };
}
