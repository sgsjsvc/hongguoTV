import { useEffect } from "react";
import { Detail, Episode, Series } from "../types";

interface UseKeyboardShortcutsProps {
  activeSeries: Detail | null;
  currentEpisode: Episode | undefined;
  currentEpisodeIndex: number;
  setCurrentEpisodeIndex: React.Dispatch<React.SetStateAction<number>>;
  setActiveSeries: (s: Detail | null) => void;
  showSeriesEndModal: boolean;
  setShowSeriesEndModal: (b: boolean) => void;
  seriesEndTarget: Series | null;
  handleSelectSeries: (series: Series) => Promise<void>;
  playback: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    handleTogglePlay: () => void;
    toggleFullscreen: () => void;
    handleToggleMute: () => void;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  };
  showToast: (msg: string) => void;
}

export function useKeyboardShortcuts({
  activeSeries,
  currentEpisodeIndex,
  setCurrentEpisodeIndex,
  setActiveSeries,
  showSeriesEndModal,
  setShowSeriesEndModal,
  seriesEndTarget,
  handleSelectSeries,
  playback,
  showToast,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // D3-F3: 支持 Escape 退出片尾推荐弹窗、全屏以及主播放弹窗
      if (e.key === "Escape") {
        e.preventDefault();
        if (showSeriesEndModal) {
          setShowSeriesEndModal(false);
          return;
        }
        if (document.fullscreenElement) {
          void document.exitFullscreen();
          return;
        }
        if (activeSeries) {
          setActiveSeries(null);
          return;
        }
      }

      if (showSeriesEndModal) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (seriesEndTarget) {
            setShowSeriesEndModal(false);
            void handleSelectSeries(seriesEndTarget);
          }
        }
        return;
      }

      if (!activeSeries) return;

      const video = playback.videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "Spacebar":
          e.preventDefault();
          playback.handleTogglePlay();
          break;
        case "f":
        case "F":
          e.preventDefault();
          playback.toggleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          showToast(`快退 5s (${Math.floor(video.currentTime)}s)`);
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          showToast(`快进 5s (${Math.floor(video.currentTime)}s)`);
          break;
        case "ArrowUp":
          e.preventDefault();
          playback.setVolume((v) => {
            const next = Math.min(1, Math.round((v + 0.1) * 10) / 10);
            video.volume = next;
            playback.setIsMuted(false);
            showToast(`音量: ${Math.round(next * 100)}%`);
            return next;
          });
          break;
        case "ArrowDown":
          e.preventDefault();
          playback.setVolume((v) => {
            const next = Math.max(0, Math.round((v - 0.1) * 10) / 10);
            video.volume = next;
            showToast(`音量: ${Math.round(next * 100)}%`);
            return next;
          });
          break;
        case "m":
        case "M":
          e.preventDefault();
          playback.handleToggleMute();
          break;
        case "n":
        case "N":
          e.preventDefault();
          if (currentEpisodeIndex < activeSeries.episodes.length - 1) {
            setCurrentEpisodeIndex((i) => i + 1);
            showToast("切换下一集");
          }
          break;
        case "p":
        case "P":
          e.preventDefault();
          if (currentEpisodeIndex > 0) {
            setCurrentEpisodeIndex((i) => i - 1);
            showToast("切换上一集");
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSeries, currentEpisodeIndex, playback, showSeriesEndModal, seriesEndTarget, handleSelectSeries, setActiveSeries, setShowSeriesEndModal, setCurrentEpisodeIndex, showToast]);
}
