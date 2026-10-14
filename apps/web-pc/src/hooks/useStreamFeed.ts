import { useState, useRef } from "react";
import { historyUuid } from "../history-outbox.mjs";
import { RecommendationSession, RecommendationWatch } from "../recommendation-session.mjs";
import { api, getPlaybackPreferences, savePlaybackPreference, saveProgress, commitRecommendationPreferences, saveRecommendationSignal } from "../api";
import { Detail, Episode, Series, VideoQualityItem } from "../types";

export function useStreamFeed(showToast: (msg: string) => void) {
  const [streamList, setStreamList] = useState<Series[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);
  const [streamPage, setStreamPage] = useState(1);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState("");
  const streamFeedRef = useRef<any>(null);
  const streamWatchRef = useRef<any>(null);
  const detailWatchRef = useRef<any>(null);
  const streamDetailLoaderRef = useRef<any>(null);
  const streamStartRequest = useRef(0);
  const streamDetailRequest = useRef(0);
  const navigationGeneration = useRef(0);
  const recommendationSignalEpoch = useRef({ feed: "", session: "", resetAt: getPlaybackPreferences().recommendationResetAt });
  
  const [streamCurrentEpisode, setStreamCurrentEpisode] = useState<Episode | null>(null);
  const [streamDetail, setStreamDetail] = useState<Detail | null>(null);
  const [, setStreamDetailLoading] = useState(false);
  const [streamIsPlaying, setStreamIsPlaying] = useState(true);
  const [streamCurrentTime, setStreamCurrentTime] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamDescriptionExpanded, setStreamDescriptionExpanded] = useState(false);
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

  if (!detailWatchRef.current) detailWatchRef.current = new RecommendationWatch(saveRecommendationSignal);
  if (!streamWatchRef.current) streamWatchRef.current = new RecommendationWatch(saveRecommendationSignal);
  if (!streamFeedRef.current) streamFeedRef.current = new RecommendationSession(
    (page: number, session: string, signal: AbortSignal) => api.getRecommendStream(page, session, signal),
    undefined,
    (state: any) => { setStreamList(state.items); setStreamIndex(state.index); setStreamPage(state.page); setStreamLoading(state.loading); setStreamError(state.error); },
    (series: Series, session: string, reason?: string) => { streamWatchRef.current.leave(reason); beginRecommendationExposure(series, session); void streamDetailLoaderRef.current?.(series); }
  );

  const beginRecommendationExposure = (series: Series, session: string) => {
    const epoch = recommendationSignalEpoch.current, resetAt = getPlaybackPreferences().recommendationResetAt;
    if (epoch.feed !== session) { epoch.feed = session; epoch.session = session; epoch.resetAt = resetAt; }
    else if (epoch.resetAt !== resetAt) { streamWatchRef.current.discard(); epoch.resetAt = resetAt; epoch.session = historyUuid(); }
    streamWatchRef.current.begin(epoch.session, series);
  };

  const loadStreamData = async (targetPage = 1, append = false) => {
    try {
      if (append) await streamFeedRef.current.load(targetPage);
      else {
        const request = ++streamStartRequest.current, generation = navigationGeneration.current;
        streamFeedRef.current.cancel();
        streamWatchRef.current.leave(); streamVideoRef.current?.pause();
        streamDetailRequest.current++;
        setStreamCurrentEpisode(null); setStreamDetail(null);
        const preferences = await commitRecommendationPreferences();
        if (request !== streamStartRequest.current || generation !== navigationGeneration.current) return;
        await streamFeedRef.current.start(preferences);
      }
    } catch { setStreamError("推荐暂时不可用，请检查本地服务后重试"); }
  };

  const loadStreamDetail = async (series: Series) => {
    if (!series) return;
    const request = ++streamDetailRequest.current;
    const session = streamFeedRef.current.id;
    streamWatchRef.current.pause(); streamVideoRef.current?.pause();
    setStreamCurrentEpisode(null); setStreamDetail(null);
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
      setStreamPlaybackSpeed(getPlaybackPreferences().speed);
      setStreamEpisodeIndex(0); setStreamCurrentEpisode(ep);
      if (ep) saveProgress(series.id, ep.id, 0, { title: detail.title, cover: detail.cover, badge: detail.badge, tags: detail.tags, episodeNumber: ep.number, duration: 0 });
      setStreamIsPlaying(true); streamQualitySwitchTimeRef.current = 0;

      if (ep) {
        setStreamQualitiesLoading(true);
        api.getVideoQualities(ep.id, series.id)
          .then((res) => {
            if (request !== streamDetailRequest.current) return;
            if (res.qualities && res.qualities.length > 0) {
              setStreamQualities(res.qualities);
              const pref = getPlaybackPreferences().quality;
              const hasPref = pref && res.qualities.some((q) => q.key === pref);
              if (hasPref) setStreamQuality(pref);
              else if (res.defaultQuality) setStreamQuality(res.defaultQuality);
              else setStreamQuality(res.qualities[0].key);
            }
          })
          .catch(() => {})
          .finally(() => { if (request === streamDetailRequest.current) setStreamQualitiesLoading(false); });
      }
    } catch (err) {
      if (request === streamDetailRequest.current) { setStreamError("剧集加载失败，请重试"); console.warn("加载流剧集详情失败:", err); }
    } finally {
      if (request === streamDetailRequest.current) setStreamDetailLoading(false);
    }
  };

  streamDetailLoaderRef.current = loadStreamDetail;

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
      showToast("本剧已连播完毕，自动为您切换下一部精选短剧");
      if (automatic) streamWatchRef.current.complete();
      handleSwitchStream("next", automatic ? "automatic" : "manual");
    }
  };

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
    try { savePlaybackPreference("quality", qKey); } catch {}
    showToast(`清晰度已切换至：${qKey}`);

    if (video) {
      const handleRestoreOnReady = () => {
        if (streamQualitySwitchTimeRef.current !== null && streamQualitySwitchTimeRef.current > 0) {
          video.currentTime = streamQualitySwitchTimeRef.current;
          streamQualitySwitchTimeRef.current = null;
        }
        video.playbackRate = streamPlaybackSpeed;
        if (!wasPaused) video.play().catch(() => {});
      };
      video.addEventListener("loadeddata", handleRestoreOnReady, { once: true });
    }
  };

  const handleStreamSelectSpeed = (speed: number) => {
    setStreamPlaybackSpeed(speed);
    savePlaybackPreference("speed", speed);
    setStreamShowSpeedMenu(false);
    if (streamVideoRef.current) streamVideoRef.current.playbackRate = speed;
    showToast(`倍速已切换至：${speed}x`);
  };

  const handleSwitchStream = async (direction: "prev" | "next", reason: "manual" | "automatic" = "manual") => {
    try {
      if (streamFeedRef.current.needsRestart(getPlaybackPreferences())) { await loadStreamData(1, false); return; }
      const moved = await streamFeedRef.current.advance(direction, reason === "manual" ? direction : "automatic");
      if (!moved && direction === "prev") showToast("已经是本次推荐的第一部");
      else if (!moved) showToast("暂无更多推荐");
    } catch { showToast("推荐加载失败，可重试当前会话"); }
  };

  return {
    streamList,
    streamIndex,
    streamPage,
    streamLoading,
    streamError,
    setStreamError,
    streamFeedRef,
    streamWatchRef,
    detailWatchRef,
    recommendationSignalEpoch,
    streamStartRequest,
    streamDetailRequest,
    navigationGeneration,
    streamCurrentEpisode,
    setStreamCurrentEpisode,
    streamDetail,
    setStreamDetail,
    streamIsPlaying,
    setStreamIsPlaying,
    streamCurrentTime,
    setStreamCurrentTime,
    streamDuration,
    setStreamDuration,
    streamDescriptionExpanded,
    setStreamDescriptionExpanded,
    streamIsLandscape,
    setStreamIsLandscape,
    streamEpisodeIndex,
    streamPlaybackSpeed,
    setStreamPlaybackSpeed,
    streamShowSpeedMenu,
    setStreamShowSpeedMenu,
    streamQuality,
    setStreamQuality,
    streamShowQualityMenu,
    setStreamShowQualityMenu,
    streamQualities,
    streamQualitiesLoading,
    streamIsDraggingProgress,
    setStreamIsDraggingProgress,
    streamQualitySwitchTimeRef,
    streamVideoRef,
    streamWheelLockRef,
    loadStreamData,
    loadStreamDetail,
    handleStreamNextEpisode,
    handleStreamSelectQuality,
    handleStreamSelectSpeed,
    handleSwitchStream,
  };
}
