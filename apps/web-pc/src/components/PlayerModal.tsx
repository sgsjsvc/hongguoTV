import React from "react";
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Gauge, 
  Check, 
  Sliders, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  HelpCircle, 
  X, 
  Trophy, 
  Film, 
  ChevronUp, 
  ChevronDown, 
  Layers, 
  Heart 
} from "lucide-react";
import { api } from "../api";
import { Detail, Episode, SeasonInfo, Series, VideoQualityItem } from "../types";
import { formatTime } from "../utils/format";

interface PlayerModalProps {
  activeSeries: Detail;
  setActiveSeries: (s: Detail | null) => void;
  currentEpisode: Episode | null;
  currentEpisodeIndex: number;
  setCurrentEpisodeIndex: React.Dispatch<React.SetStateAction<number>>;
  playerContainerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  resetControlsTimer: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  currentQuality: string;
  handleTimeUpdate: () => void;
  handleLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  handleVideoEnded: () => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  setShowSeriesEndModal: (b: boolean) => void;
  handleTogglePlay: () => void;
  showControls: boolean;
  showShortcutHelp: boolean;
  setShowShortcutHelp: React.Dispatch<React.SetStateAction<boolean>>;
  duration: number;
  currentTime: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showSpeedMenu: boolean;
  setShowSpeedMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setShowQualityMenu: React.Dispatch<React.SetStateAction<boolean>>;
  playbackSpeed: number;
  handleSelectSpeed: (s: number) => void;
  showQualityMenu: boolean;
  qualitiesLoading: boolean;
  videoQualities: VideoQualityItem[];
  handleSelectQuality: (k: string) => void;
  autoPlayNext: boolean;
  setAutoPlayNext: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string) => void;
  handleToggleMute: () => void;
  isMuted: boolean;
  volume: number;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showSeriesEndModal: boolean;
  seriesEndTarget: Series | null;
  handleSelectSeries: (item: Series, resume?: any) => void;
  seriesEndCountdown: number;
  handleSwitchNextSeriesRecommendation: () => void;
  relatedKeyword: string;
  handleRefreshRecommend: () => void;
  relatedLoading: boolean;
  relatedRefreshing: boolean;
  refreshRotateDeg: number;
  recommendFadeIn: boolean;
  relatedSeries: Series[];
  handleToggleFav: (item: Series) => void;
  favorites: Series[];
  showRangeDropdown: boolean;
  setShowRangeDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  episodeRangeIndex: number;
  setEpisodeRangeIndex: React.Dispatch<React.SetStateAction<number>>;
  seasonsList: SeasonInfo[];
  handleSwitchSeason: (season: SeasonInfo) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  activeSeries,
  setActiveSeries,
  currentEpisode,
  currentEpisodeIndex,
  setCurrentEpisodeIndex,
  playerContainerRef,
  videoRef,
  resetControlsTimer,
  toggleFullscreen,
  isFullscreen,
  currentQuality,
  handleTimeUpdate,
  handleLoadedMetadata,
  handleVideoEnded,
  isPlaying,
  setIsPlaying,
  setShowSeriesEndModal,
  handleTogglePlay,
  showControls,
  showShortcutHelp,
  setShowShortcutHelp,
  duration,
  currentTime,
  handleSeek,
  showSpeedMenu,
  setShowSpeedMenu,
  setShowQualityMenu,
  playbackSpeed,
  handleSelectSpeed,
  showQualityMenu,
  qualitiesLoading,
  videoQualities,
  handleSelectQuality,
  autoPlayNext,
  setAutoPlayNext,
  showToast,
  handleToggleMute,
  isMuted,
  volume,
  handleVolumeChange,
  showSeriesEndModal,
  seriesEndTarget,
  handleSelectSeries,
  seriesEndCountdown,
  handleSwitchNextSeriesRecommendation,
  relatedKeyword,
  handleRefreshRecommend,
  relatedLoading,
  relatedRefreshing,
  refreshRotateDeg,
  recommendFadeIn,
  relatedSeries,
  handleToggleFav,
  favorites,
  showRangeDropdown,
  setShowRangeDropdown,
  episodeRangeIndex,
  setEpisodeRangeIndex,
  seasonsList,
  handleSwitchSeason,
}) => {
  return (
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

          {/* 沉浸式专业播放器容器 */}
          <div
            ref={playerContainerRef}
            onMouseMove={resetControlsTimer}
            onClick={resetControlsTimer}
            onDoubleClick={toggleFullscreen}
            className={`bg-black overflow-hidden flex items-center justify-center group ${
              isFullscreen
                ? "fixed inset-0 z-50 w-screen h-screen"
                : "relative aspect-[9/16] max-h-[72vh] lg:max-h-none lg:aspect-video w-full rounded-2xl border border-slate-800 shadow-2xl"
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

                {/* 顶部控制栏 */}
                <div
                  className={`absolute top-0 inset-x-0 p-4 md:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-30 pointer-events-auto ${
                    showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isFullscreen && (
                      <button
                        onClick={toggleFullscreen}
                        className="text-slate-300 hover:text-white transition"
                        title="退出全屏 (ESC)"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    )}
                    <h3 className="font-extrabold text-sm md:text-base text-white tracking-tight line-clamp-1 drop-shadow">
                      {activeSeries.title}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-rose-300 border border-rose-500/30 font-medium">
                      第 {currentEpisode.number || currentEpisodeIndex + 1} 集
                    </span>
                    <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30">
                      官方画质: {currentQuality}
                    </span>
                  </div>

                  <div className="relative mr-12 md:mr-14">
                    <button
                      onClick={() => setShowShortcutHelp(!showShortcutHelp)}
                      className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                      title="查看键盘快捷键"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    {showShortcutHelp && (
                      <div className="absolute right-0 top-8 w-56 bg-slate-900/95 border border-slate-700 rounded-2xl p-3 shadow-2xl backdrop-blur text-xs space-y-1.5 z-40">
                        <div className="font-bold text-white pb-1 border-b border-slate-800 flex items-center justify-between">
                          <span>键盘快捷键</span>
                          <button onClick={() => setShowShortcutHelp(false)} className="text-slate-400 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">空格</kbd> 播放/暂停</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">F</kbd> 全屏切换</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">← / →</kbd> 快退/快进 5s</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">↑ / ↓</kbd> {isFullscreen ? "上一集 / 下一集" : "音量调节（全屏时切集）"}</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">[ / ]</kbd> 减速/加速</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">N / P</kbd> 下集/上集</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">M</kbd> 静音切换</div>
                        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-rose-400">双击</kbd> 全屏</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 底部控制栏 */}
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
                      {/* 倍速选择菜单 */}
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

                      {/* 官方真实清晰度选择菜单 */}
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

                      {/* 自动连播开关 */}
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

                      {/* 音量控制 */}
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

                      {/* 全屏按钮 */}
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? "退出全屏" : "全屏"}
                        title={isFullscreen ? "退出全屏 (ESC)" : "全屏 (F)"}
                        className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 片尾推荐弹窗 */}
                {showSeriesEndModal && seriesEndTarget && !isPlaying && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-fade-in select-none"
                  >
                    <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-slate-700/80 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-2xl text-center space-y-4 md:space-y-5">
                      <button
                        onClick={() => setShowSeriesEndModal(false)}
                        className="absolute top-3.5 right-3.5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                        title="留在本剧"
                      >
                        <X className="w-5 h-5" />
                      </button>

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

                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-500 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${(seriesEndCountdown / 5) * 100}%` }}
                        />
                      </div>

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

          {/* 左侧播放器下方：上下集切换 */}
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

          {/* 为你推荐 · 同类好剧 */}
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

        {/* 右侧面板 */}
        <div className="w-full lg:w-[480px] xl:w-[520px] 2xl:w-[560px] flex flex-col bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shrink-0 self-start">
          <div>
            <div className="flex items-center gap-6 border-b border-slate-800/80 pb-3 mb-4">
              <button className="text-base font-bold text-white border-b-2 border-rose-500 pb-1 -mb-3.5">
                视频
              </button>
            </div>

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

            {/* 选集头部与区间选择器 */}
            <div className="pt-2 pb-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-rose-500" />
                  <span className="font-bold text-sm text-white">选集</span>
                  <span className="text-xs text-slate-400 font-mono">
                    (共 {activeSeries.episodes.length} 集)
                  </span>
                </div>

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

            {/* 区间面板或选集网格 */}
            {showRangeDropdown && activeSeries.episodes.length > 30 ? (
              <div className="grid grid-cols-2 gap-2 my-2 p-3 bg-slate-900/95 border border-slate-800 rounded-xl max-h-[300px] overflow-y-auto">
                {Array.from({ length: Math.ceil(activeSeries.episodes.length / 30) }).map((_, rangeIdx) => {
                  const start = rangeIdx * 30 + 1;
                  const end = Math.min((rangeIdx + 1) * 30, activeSeries.episodes.length);
                  const isSelected = episodeRangeIndex === rangeIdx;
                  const hasCurrent = currentEpisodeIndex >= rangeIdx * 30 && currentEpisodeIndex < (rangeIdx + 1) * 30;

                  return (
                    <button
                      key={rangeIdx}
                      onClick={() => {
                        setEpisodeRangeIndex(rangeIdx);
                        setShowRangeDropdown(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? "bg-rose-600 text-white font-bold shadow-md shadow-rose-900/40"
                          : hasCurrent
                          ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      <span>第 {start} - {end} 集</span>
                      {hasCurrent && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2 my-2 select-none">
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
                        className={`aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all relative ${
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

            {/* 同系列剧集列表 */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-500" />
                  <span className="font-extrabold text-sm text-white">同系列</span>
                </div>
                <span className="text-[11px] text-slate-400">点击卡片直接播放</span>
              </div>

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

                      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5 space-y-1">
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

                        <h4
                          className={`font-black text-sm text-white tracking-tight leading-snug line-clamp-1 transition ${
                            isPlayingThis ? "text-rose-400" : "group-hover:text-rose-300"
                          }`}
                          title={season.title}
                        >
                          {season.title}
                        </h4>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {isPlayingThis
                            ? activeSeries.description || "全网高分热门力作，逆袭反转不停歇！"
                            : `${season.title}精彩连载，全剧高能反转逆袭，不容错过！`}
                        </p>

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
    </div>
  );
};
