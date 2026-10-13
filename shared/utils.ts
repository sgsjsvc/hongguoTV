// shared/utils.ts - 跨端通用工具函数

import { Detail, Progress } from "./types";

/**
 * 格式化播放时间 (秒 -> 00:00 / 00:00:00)
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * 格式化数字播放量或点赞量 (例如 12500 -> 1.3万)
 */
export function formatCount(count: number): string {
  if (!count || isNaN(count)) return "0";
  if (count >= 100000000) {
    return (count / 100000000).toFixed(1).replace(/\.0$/, "") + "亿";
  }
  if (count >= 10000) {
    return (count / 10000).toFixed(1).replace(/\.0$/, "") + "万";
  }
  return count.toString();
}

/**
 * 标准化服务基地址
 */
export function normalizeBaseUrl(input: string): string {
  const url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[a-z\d.\-\[\]:]+(?::\d+)?$/i.test(url)) {
    throw new Error("请输入完整服务地址，例如 http://192.168.1.10:8788");
  }
  return url;
}

/**
 * 计算断点续播集数与进度
 */
export function resumeTarget(
  detail: Detail,
  progress?: Progress | null
): { index: number; position: number } {
  if (!progress) return { index: 0, position: 0 };
  const index = detail.episodes.findIndex((e) => e.id === progress.episodeId);
  if (index < 0) return { index: 0, position: 0 };
  if (progress.completed) {
    return {
      index: Math.min(index + 1, detail.episodes.length - 1),
      position: 0,
    };
  }
  return { index, position: Math.max(0, progress.position) };
}

/**
 * 中文数字转阿拉伯数字 (支持 一 ~ 九十九)
 */
export function parseChineseNumber(str: string): number {
  const map: Record<string, number> = {
    "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10
  };
  if (!isNaN(Number(str))) return parseInt(str, 10);
  if (str === "十") return 10;
  if (str.startsWith("十")) return 10 + (map[str[1]] || 0);
  if (str.endsWith("十")) return (map[str[0]] || 1) * 10;
  if (str.includes("十")) {
    const parts = str.split("十");
    return (map[parts[0]] || 1) * 10 + (map[parts[1]] || 0);
  }
  return map[str] || 1;
}

/**
 * 解析剧名中的季数特征与系列根名称
 */
export function parseSeasonInfo(title: string): {
  baseTitle: string;
  seasonNumber: number;
  seasonLabel: string;
} {
  const cleanTitle = (title || "").trim();
  const patterns: RegExp[] = [
    /^(.*?)(?:[·\-_:：\s]*)第([一二两三四五六七八九十\d]+)([季部卷期])$/i,
    /^(.*?)(?:[·\-_:：\s]*)(?:season|s)\s*(\d+)$/i,
    /^(.*?)(?:[·\-_:：\s]*)([2-9\d])(?:[季部])$/i,
    /^(.*?)(?:[·\-_:：\s]*)(续集|后传|前传|番外)$/i,
    /^(.*?)(?:[·\-_:：\s]*)([2-9])$/
  ];

  for (const re of patterns) {
    const m = cleanTitle.match(re);
    if (m) {
      const base = m[1].trim();
      let num = 1;
      let label = m[2];
      if (m[3]) {
        num = parseChineseNumber(m[2]);
        label = `第${num}${m[3]}`;
      } else if (!isNaN(Number(m[2]))) {
        num = parseInt(m[2], 10);
        label = `第${num}季`;
      } else if (m[2] === "续集" || m[2] === "后传") {
        num = 2;
        label = m[2];
      } else if (m[2] === "前传") {
        num = 0;
        label = "前传";
      } else if (m[2] === "番外") {
        num = 99;
        label = "番外";
      }
      return { baseTitle: base || cleanTitle, seasonNumber: num, seasonLabel: label };
    }
  }

  return { baseTitle: cleanTitle, seasonNumber: 1, seasonLabel: "第1季" };
}

/**
 * 从候选短剧列表中精准匹配并归类同系列的所有季数，按季数由小到大排序
 */
export function matchAndSortSeasons(
  currentSeries: { id: string; title: string; cover?: string; badge?: string },
  candidateList: Array<{ id: string; title: string; cover?: string; badge?: string }>
): import("./types").SeasonInfo[] {
  const currentInfo = parseSeasonInfo(currentSeries.title);
  const matched: import("./types").SeasonInfo[] = [];
  const seenIds = new Set<string>();

  // 先把当前短剧纳入
  matched.push({
    seriesId: String(currentSeries.id),
    title: currentSeries.title,
    seasonNumber: currentInfo.seasonNumber,
    seasonLabel: currentInfo.seasonLabel,
    cover: currentSeries.cover,
    badge: currentSeries.badge,
    isCurrent: true,
  });
  seenIds.add(String(currentSeries.id));

  for (const item of candidateList) {
    const sid = String(item.id);
    if (seenIds.has(sid)) continue;

    const info = parseSeasonInfo(item.title);

    // 判断是否属于同一系列：
    // 1. baseTitle 完全一致
    // 2. baseTitle 长度大于等于 3 且前缀高度重合
    const isSameSeries =
      info.baseTitle === currentInfo.baseTitle ||
      (currentInfo.baseTitle.length >= 3 &&
        info.baseTitle.length >= 3 &&
        (info.baseTitle.startsWith(currentInfo.baseTitle) ||
          currentInfo.baseTitle.startsWith(info.baseTitle)));

    if (isSameSeries) {
      seenIds.add(sid);
      matched.push({
        seriesId: sid,
        title: item.title,
        seasonNumber: info.seasonNumber,
        seasonLabel: info.seasonLabel,
        cover: item.cover,
        badge: item.badge,
        isCurrent: false,
      });
    }
  }

  // 按季数数值升序排列 (第1季 -> 第2季 -> 第3季...)
  matched.sort((a, b) => a.seasonNumber - b.seasonNumber);
  return matched;
}
