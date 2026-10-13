// shared/constants.ts - 跨端通用常量与配置

export const STORAGE_KEYS = {
  SETTINGS: "hg_settings_v1",
  PROGRESS: "hg_progress_v1",
  FAVORITES: "hg_favorites_v1",
  PREF_QUALITY: "hg_pref_quality",
  PLAYBACK_SPEED: "hg_playback_speed",
} as const;

export const DEFAULT_SETTINGS = {
  baseUrl: "http://192.168.1.21:8788",
  localBaseUrl: "http://localhost:8788",
  token: "",
} as const;

export const OFFICIAL_CATEGORIES = [
  { id: "real-drama", name: "真人短剧" },
  { id: "comic-drama", name: "精彩漫剧" },
  { id: "ai-drama", name: "AI 剧场" },
] as const;

export const QUALITY_LABELS: Record<number, string> = {
  2160: "4K 超高清",
  1440: "2K 超清",
  1080: "1080P 超清",
  720: "720P 高清",
  540: "540P 高清",
  480: "480P 标清",
  360: "360P 流畅",
};
