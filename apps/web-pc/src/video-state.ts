/**
 * 判断页面中是否有视频正在播放。
 * 用于避免轮询与视频流争用网络。
 */
export function isVideoPlaying(): boolean {
  if (typeof document === "undefined") return false;
  const videos = document.querySelectorAll("video");
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (!v.paused && !v.ended && v.readyState > 2) return true;
  }
  return false;
}
