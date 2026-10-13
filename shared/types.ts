// shared/types.ts - 跨端通用核心数据模型定义 (Web/PC/TV/Server)

export interface Series {
  id: string;
  title: string;
  cover: string;
  description: string;
  badge: string;
  tags: string;
  contentType?: "real-drama" | "comic-drama" | "ai-drama";
}

export interface BannerItem extends Series {
  backgroundCover?: string;
  titleImage?: string;
}

export interface SeasonInfo {
  seriesId: string;
  title: string;
  seasonNumber: number;
  seasonLabel: string;
  cover?: string;
  badge?: string;
  isCurrent?: boolean;
  episodeCount?: number;
}

export interface Section {
  type: string;
  name: string;
  items: Series[];
}

export interface Episode {
  id: string;
  number: number;
  title: string;
}

export interface Detail extends Series {
  episodes: Episode[];
}

export interface Progress {
  series: Series;
  episodeId: string;
  episodeNumber: number;
  position: number;
  duration?: number;
  completed?: boolean;
  updatedAt: number;
}

export interface Library {
  favorites: Series[];
  progress: Record<string, Progress>;
}

export interface Settings {
  baseUrl: string;
  token: string;
}

export interface CategoryTag {
  id: string;
  name: string;
  categoryId?: string;
}

export interface CategoryType {
  id: string;
  name: string;
}

export interface CategoryTagsResponse {
  types: CategoryType[];
  tags: CategoryTag[];
}

export interface CategoryListResponse {
  pagination?: {totalPages:number;pageNum:number;pageSize:number;total:number};
  type: string;
  tag: string;
  page: number;
  items: Series[];
}

export interface RankItem extends Series {
  rank: number;
  heatText?: string;
  scoreText?: string;
  favoriteText?: string;
  likeText?: string;
}

export interface RankGroup {
  key: string;
  title: string;
  items: RankItem[];
}

export interface RankTypeItem {
  slug: string;
  name: string;
  key: string;
}

export interface RankPageResponse {
  slug: string;
  title: string;
  page: number;
  totalPages: number;
  total: number;
  updatedText: string;
  items: RankItem[];
}

export interface VideoQualityItem {
  key: string;
  label: string;
  qualityNum: number;
  codec?: string;
  rawKey?: string;
  isDefault?: boolean;
}

export interface VideoQualitiesResponse {
  episodeId: string;
  defaultQuality: string;
  qualities: VideoQualityItem[];
}

export interface Playback {
  uri: string;
  headers: Record<string, string>;
}
