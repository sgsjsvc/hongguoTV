import { useState, useRef, useCallback } from "react";
import { api } from "../api";
import { Series } from "../types";

export const HOT_SEARCH_KEYWORDS = [
  "太奶奶",
  "反向拿捏",
  "逆袭",
  "重生",
  "神豪",
  "战神",
  "甜宠",
  "穿越",
  "霸总",
  "白月光"
];

export const SEARCH_FILTER_TAGS = ["全部", "真人", "漫剧", "AI剧", "逆袭", "甜宠", "重生", "都市", "古装"];

export function useSearch(
  saveSearchHistory: (kw: string) => string[],
  setSearchHistoryList: (list: string[]) => void,
  refreshSearchHistory: () => void,
  handleSelectSeries: (series: Series) => void,
  showToast: (msg: string) => void
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Series[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Series[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [searchFilterTag, setSearchFilterTag] = useState<string>("全部");
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestGenerationRef = useRef(0);
  const searchGenerationRef = useRef(0);

  // 搜索框实时输入联想 (250ms 防抖，带代际控制 D3-F4)
  const handleSearchInputChange = useCallback((val: string) => {
    setSearchQuery(val);
    const gen = ++suggestGenerationRef.current;
    if (!val.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
      return;
    }

    setShowSuggestions(true);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      try {
        setIsSuggesting(true);
        const data = await api.search(val.trim(), 1);
        if (gen === suggestGenerationRef.current) {
          setSearchSuggestions((data.items || []).slice(0, 6));
        }
      } catch {
        if (gen === suggestGenerationRef.current) setSearchSuggestions([]);
      } finally {
        if (gen === suggestGenerationRef.current) setIsSuggesting(false);
      }
    }, 250);
  }, []);

  // 执行最终搜索 (保存历史、重置筛选、关闭联想浮层，带代际控制 D3-F4)
  const executeSearch = useCallback(async (queryText: string) => {
    const text = queryText.trim();
    if (!text) return;
    const gen = ++searchGenerationRef.current;
    suggestGenerationRef.current++;
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);

    setSearchQuery(text);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    setIsSuggesting(false);

    const updatedHistory = saveSearchHistory(text);
    setSearchHistoryList(updatedHistory);

    try {
      setSearchLoading(true);
      setHasSearched(true);
      setSearchFilterTag("全部");
      const data = await api.search(text, 1);
      if (gen === searchGenerationRef.current) {
        setSearchResults(data.items || []);
      }
    } catch {
      if (gen === searchGenerationRef.current) {
        showToast("搜索请求失败，请稍后重试");
      }
    } finally {
      if (gen === searchGenerationRef.current) {
        setSearchLoading(false);
      }
    }
  }, [saveSearchHistory, setSearchHistoryList, showToast]);

  const handleSearch = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(searchQuery);
  }, [executeSearch, searchQuery]);

  const handleSelectSuggestion = useCallback((item: Series) => {
    saveSearchHistory(item.title);
    refreshSearchHistory();
    setShowSuggestions(false);
    setSearchSuggestions([]);
    handleSelectSeries(item);
  }, [handleSelectSeries, refreshSearchHistory, saveSearchHistory]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    hasSearched,
    setHasSearched,
    searchSuggestions,
    setSearchSuggestions,
    showSuggestions,
    setShowSuggestions,
    isSuggesting,
    searchFilterTag,
    setSearchFilterTag,
    searchLoading,
    searchInputRef,
    handleSearchInputChange,
    executeSearch,
    handleSearch,
    handleSelectSuggestion,
    hotSearchKeywords: HOT_SEARCH_KEYWORDS,
    searchFilterTags: SEARCH_FILTER_TAGS,
  };
}
