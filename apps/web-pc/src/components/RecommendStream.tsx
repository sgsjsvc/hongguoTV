import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Play, 
  Heart, 
  Gauge, 
  Check, 
  Sliders, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  ChevronRight, 
  Layers,
  Maximize,
  Minimize
} from "lucide-react";
import { api, saveProgress } from "../api";
import { Detail, Episode, Series, VideoQualityItem } from "../types";
import { formatTime } from "../utils/format";

interface RecommendStreamProps {
  streamWheelLockRef: React.MutableRefObject<boolean>;
  streamLoading: boolean;
  streamList: Series[];
  streamIndex: number;
  streamError: string;
  setStreamError: (err: string) => void;
  streamFeedRef: any;
  loadStreamDetail: (item: Series) => Promise<any>;
  favorites: Series[];
  handleToggleFav: (item: Series) => void;
  handleSwitchStream: (dir: "next" | "prev") => void;
  streamVideoRef: React.RefObject<HTMLVideoElement | null>;
  streamCurrentEpisode: Episode | null;
  streamEpisodeIndex: number;
  streamQuality: string;
  streamPlaybackSpeed: number;
  streamIsPlaying: boolean;
  setStreamIsPlaying: (p: boolean) => void;
  streamIsLandscape: boolean;
  setStreamIsLandscape: (l: boolean) => void;
  streamQualitySwitchTimeRef: React.MutableRefObject<number | null>;
  streamCurrentTime: number;
  setStreamCurrentTime: (t: number) => void;
  streamDuration: number;
  setStreamDuration: (d: number) => void;
  streamIsDraggingProgress: boolean;
  setStreamIsDraggingProgress: (d: boolean) => void;
  streamShowSpeedMenu: boolean;
  setStreamShowSpeedMenu: (m: boolean) => void;
  streamShowQualityMenu: boolean;
  setStreamShowQualityMenu: (m: boolean) => void;
  streamQualitiesLoading: boolean;
  streamQualities: VideoQualityItem[];
  handleStreamSelectQuality: (key: string) => void;
  handleStreamSelectSpeed: (s: number) => void;
  handleStreamNextEpisode: (auto?: boolean) => void;
  streamDescriptionExpanded: boolean;
  setStreamDescriptionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  streamDetail: Detail | null;
  handleSelectSeries: (item: Series) => void;
  refreshHistory: () => Promise<void>;
  showToast?: (msg: string) => void;
}

export const RecommendStream: React.FC<RecommendStreamProps> = ({
  streamWheelLockRef,
  streamLoading,
  streamList,
  streamIndex,
  streamError,
  setStreamError,
  streamFeedRef,
  loadStreamDetail,
  favorites,
  handleToggleFav,
  handleSwitchStream,
  streamVideoRef,
  streamCurrentEpisode,
  streamEpisodeIndex,
  streamQuality,
  streamPlaybackSpeed,
  streamIsPlaying,
  setStreamIsPlaying,
  streamIsLandscape,
  setStreamIsLandscape,
  streamQualitySwitchTimeRef,
  streamCurrentTime,
  setStreamCurrentTime,
  streamDuration,
  setStreamDuration,
  streamIsDraggingProgress,
  setStreamIsDraggingProgress,
  streamShowSpeedMenu,
  setStreamShowSpeedMenu,
  streamShowQualityMenu,
  setStreamShowQualityMenu,
  streamQualitiesLoading,
  streamQualities,
  handleStreamSelectQuality,
  handleStreamSelectSpeed,
  handleStreamNextEpisode,
  streamDescriptionExpanded,
  setStreamDescriptionExpanded,
  streamDetail,
  handleSelectSeries,
  refreshHistory,
  showToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 监听全屏状态同步（DOM 与桌面端）
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    const desktop = (window as any).hongguotvDesktop;
    let unsubscribeDesktop: (() => void) | undefined;
    if (desktop?.isDesktop) {
      if (typeof desktop.isFullScreen === "function") {
        desktop.isFullScreen().then((state: boolean) => {
          setIsFullscreen(Boolean(state));
        }).catch(() => {});
      }
      if (typeof desktop.onFullScreenChanged === "function") {
        unsubscribeDesktop = desktop.onFullScreenChanged((state: boolean) => {
          setIsFullscreen(Boolean(state));
        });
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      if (typeof unsubscribeDesktop === "function") {
        unsubscribeDesktop();
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const desktop = (window as any).hongguotvDesktop;
    if (desktop?.isDesktop && typeof desktop.toggleFullScreen === "function") {
      try {
        const nextState = await desktop.toggleFullScreen();
        setIsFullscreen(Boolean(nextState));
      } catch (err: any) {
        showToast?.("切换桌面全屏失败，请先点击窗口激活");
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Permissions check failed") || err?.name === "TypeError") {
        showToast?.("全屏失败，请先点击播放窗口再试");
      } else {
        showToast?.("全屏切换失败，请点击播放界面后再试");
      }
    }
  }, [showToast]);

  // 全屏快捷键 (F 键切换全屏，Escape 退出全屏)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "Escape") {
        if (isFullscreen || document.fullscreenElement) {
          e.preventDefault();
          const desktop = (window as any).hongguotvDesktop;
          if (desktop?.isDesktop && typeof desktop.setFullScreen === "function") {
            desktop.setFullScreen(false).catch(() => {});
          } else if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          } else {
            void toggleFullscreen();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center relative select-none overflow-hidden bg-black ${
        isFullscreen ? "fixed inset-0 z-50 w-screen h-screen" : ""
      }`}
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
            {streamError && (
              <div role="alert" className="absolute top-3 left-3 z-50 bg-black/80 rounded-xl p-3 text-rose-200">
                {streamError}{" "}
                <button
                  className="underline ml-3"
                  onClick={() => {
                    setStreamError("");
                    if (!streamCurrentEpisode) void loadStreamDetail(currentItem);
                    else void streamFeedRef.current.retry().catch(() => {});
                  }}
                >
                  重试
                </button>
              </div>
            )}
            {/* 背景氛围虚化图 */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 scale-110 pointer-events-none transition-all duration-700"
              style={{ backgroundImage: `url(${currentItem.cover})` }}
            />

            {/* 核心视频播放器或封面兜底 */}
            <div 
              className="absolute inset-0 z-0 flex items-center justify-center cursor-pointer"
              onDoubleClick={(e) => {
                e.stopPropagation();
                void toggleFullscreen();
              }}
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
                      void refreshHistory();
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
                      void refreshHistory();
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

              {/* 暂停时显示居中播放按钮 */}
              {!streamIsPlaying && (
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center z-10">
                  <div className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white flex items-center justify-center shadow-2xl scale-105 transition-transform">
                    <Play className="w-10 h-10 fill-white ml-1 text-white opacity-95" />
                  </div>
                </div>
              )}

              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
            </div>

            {/* 顶部状态与控制栏 */}
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
                {/* 倍速选择菜单 */}
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

                {/* 清晰度选择菜单 */}
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

                {/* 全屏切换按钮 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFullscreen();
                  }}
                  aria-label={isFullscreen ? "退出全屏" : "全屏"}
                  title={isFullscreen ? "退出全屏 (ESC)" : "全屏 (F)"}
                  className={`px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer ${
                    isFullscreen
                      ? "bg-rose-600/40 text-rose-300 border-rose-500/50 hover:bg-rose-600/50"
                      : "bg-black/60 hover:bg-black/80 text-white/90 border-white/15"
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5 text-white/90" />
                  )}
                  <span>{isFullscreen ? "退出全屏" : "全屏"}</span>
                </button>
              </div>
            </div>

            {/* 右侧纵向操作栏 */}
            <div className="absolute right-6 bottom-20 z-20 flex flex-col items-center gap-4">
              {/* 作者/剧集头像 + 追剧加号小标 */}
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

              {/* 点赞 / 追剧心形按钮 */}
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

              {/* 悬浮切剧上/下按钮 */}
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

            {/* 左下角信息层与胶囊条 */}
            <div className="relative z-10 px-8 pb-10 space-y-2.5 max-w-[700px] pointer-events-auto">
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

                {/* #标签 */}
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

              {/* 剧情简介 */}
              <div className="max-w-[560px]">
                <p 
                  onClick={() => setStreamDescriptionExpanded((prev) => !prev)}
                  className={`text-xs text-slate-300/90 leading-relaxed drop-shadow cursor-pointer hover:text-white transition ${
                    streamDescriptionExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {currentItem.description || "精彩短剧连播，高潮迭起，逆袭反转不停歇！"}
                </p>
              </div>

              {/* 底部合集胶囊条与集数控制 */}
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

            {/* 底部横跨全宽进度条 */}
            <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col group/fullbar pointer-events-auto bg-gradient-to-t from-black/80 via-black/30 to-transparent pt-2 px-0">
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
                      void refreshHistory();
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
                        void refreshHistory();
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
                        void refreshHistory();
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
  );
};
