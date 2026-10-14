import { useState, useCallback } from "react";
import { 
  getFavorites, 
  toggleFavorite, 
  getHistoryList, 
  removeHistoryItem, 
  clearHistory, 
  getSearchHistory, 
  saveSearchHistory, 
  removeSearchHistory, 
  clearSearchHistory 
} from "../api";
import { HistoryItem, Series } from "../types";

export function useLibrary(showToast: (msg: string) => void) {
  const [favorites, setFavorites] = useState<Series[]>(() => getFavorites());
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyStorageWarning, setHistoryStorageWarning] = useState("");
  const [searchHistoryList, setSearchHistoryList] = useState<string[]>(() => getSearchHistory());

  const refreshHistory = useCallback(async () => {
    try {
      const items = await getHistoryList();
      setHistoryList(items);
      setHistoryStorageWarning("");
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || String(e?.message || "").includes("quota")) {
        setHistoryStorageWarning("浏览器存储空间不足，正在仅保留最近观看记录；建议清理部分历史记录以保证正常续播。");
      }
    }
  }, []);

  const handleToggleFav = useCallback((series: Series) => {
    try {
      const isFav = toggleFavorite(series);
      setFavorites(getFavorites());
      showToast(isFav ? `已加入追剧《${series.title}》` : `已取消追剧《${series.title}》`);
    } catch {
      showToast("操作失败，请重试");
    }
  }, [showToast]);

  const refreshSearchHistory = useCallback(() => {
    setSearchHistoryList(getSearchHistory());
  }, []);

  return {
    favorites,
    setFavorites,
    historyList,
    setHistoryList,
    historyStorageWarning,
    refreshHistory,
    handleToggleFav,
    removeHistoryItem,
    clearHistory,
    searchHistoryList,
    setSearchHistoryList,
    refreshSearchHistory,
    saveSearchHistory,
    removeSearchHistory,
    clearSearchHistory,
  };
}
