import React from "react";
import { 
  Search, 
  X, 
  RefreshCw, 
  ChevronRight, 
  Flame, 
  Clock, 
  Trash2, 
  Play 
} from "lucide-react";
import { Series } from "../types";

interface SearchPanelProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearchInputChange: (val: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchLoading: boolean;
  showSuggestions: boolean;
  setShowSuggestions: (b: boolean) => void;
  searchSuggestions: Series[];
  setSearchSuggestions: (s: Series[]) => void;
  isSuggesting: boolean;
  handleSelectSuggestion: (item: Series) => void;
  hasSearched: boolean;
  setHasSearched: (b: boolean) => void;
  searchResults: Series[];
  setSearchResults: (s: Series[]) => void;
  hotSearchKeywords: string[];
  searchHistoryList: string[];
  setSearchHistoryList: (list: string[]) => void;
  searchFilterTags: string[];
  searchFilterTag: string;
  setSearchFilterTag: (tag: string) => void;
  executeSearch: (q: string) => void;
  clearSearchHistory: () => void;
  removeSearchHistory: (kw: string) => string[];
  refreshSearchHistory: () => void;
  showToast: (msg: string) => void;
  handleSelectSeries: (item: Series) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  searchQuery,
  setSearchQuery,
  handleSearchInputChange,
  handleSearch,
  searchInputRef,
  searchLoading,
  showSuggestions,
  setShowSuggestions,
  searchSuggestions,
  setSearchSuggestions,
  isSuggesting,
  handleSelectSuggestion,
  hasSearched,
  setHasSearched,
  searchResults,
  setSearchResults,
  hotSearchKeywords,
  searchHistoryList,
  setSearchHistoryList,
  searchFilterTags,
  searchFilterTag,
  setSearchFilterTag,
  executeSearch,
  clearSearchHistory,
  removeSearchHistory,
  refreshSearchHistory,
  showToast,
  handleSelectSeries,
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-7 pt-2 pb-14">
      {/* 1. 搜索表单与实时防抖下拉联想 */}
      <div className="relative max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && searchSuggestions.length === 0) {
                  handleSearchInputChange(searchQuery);
                }
              }}
              placeholder="搜索短剧名、主角或关键词（如：太奶奶、反向拿捏、神豪、逆袭...）"
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#0a0f1d] border border-slate-800 focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-sm font-medium transition placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowSuggestions(false);
                  setSearchSuggestions([]);
                  setHasSearched(false);
                  setSearchResults([]);
                  refreshSearchHistory();
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                title="清除输入"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searchLoading}
            className="px-8 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-sm font-bold transition shadow-lg shadow-rose-900/30 shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 flex items-center gap-2 cursor-pointer"
          >
            {searchLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>搜索</span>
          </button>
        </form>

        {/* 实时输入联想下拉浮层 (Autocomplete Dropdown) */}
        {showSuggestions && searchQuery.trim() && (searchSuggestions.length > 0 || isSuggesting) && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d1326] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-40 backdrop-blur">
            <div className="p-2 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-semibold px-3">
              <span>💡 相关剧集实时联想</span>
              {isSuggesting && <RefreshCw className="w-3 h-3 animate-spin text-rose-400" />}
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-800/40">
              {searchSuggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item)}
                  className="flex items-center gap-3 p-2.5 hover:bg-slate-800/70 transition cursor-pointer group"
                >
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-10 aspect-[3/4] object-cover rounded-lg shrink-0 bg-slate-900 border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs md:text-sm font-bold text-white group-hover:text-rose-400 transition truncate">
                      {item.title}
                    </h5>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.tags || item.badge || "热门短剧"}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-rose-400 font-semibold shrink-0 flex items-center gap-0.5">
                    即点即看 <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. 空状态 / 未搜索时的探索区：热门搜索词 + 搜索历史 */}
      {!hasSearched && (
        <div className="max-w-3xl mx-auto space-y-6 pt-2">
          {/* 2.1 热门搜索榜 Top 10 */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
              <span>热门搜索推荐</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {hotSearchKeywords.map((kw, idx) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => executeSearch(kw)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-xs font-semibold text-slate-300 hover:text-rose-400 transition cursor-pointer"
                >
                  <span
                    className={`text-[10px] font-bold ${
                      idx < 3 ? "text-rose-400" : "text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>{kw}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2.2 本地搜索历史 (最近 10 条，支持单条删除与一键清空) */}
          {searchHistoryList.length > 0 && (
            <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>搜索历史</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearSearchHistory();
                    setSearchHistoryList([]);
                    showToast("已清空搜索历史");
                  }}
                  className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清空历史
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistoryList.map((hist) => (
                  <div
                    key={hist}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-semibold text-slate-300 group hover:border-slate-700 transition"
                  >
                    <span
                      onClick={() => executeSearch(hist)}
                      className="cursor-pointer hover:text-rose-400"
                    >
                      {hist}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = removeSearchHistory(hist);
                        setSearchHistoryList(updated);
                      }}
                      className="text-slate-600 hover:text-slate-300 transition cursor-pointer ml-0.5"
                      title="删除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 搜索结果展示区 */}
      {hasSearched && (
        <div className="space-y-5">
          {/* 3.1 搜索结果统计与题材快筛栏 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                搜索「<span className="text-rose-400">{searchQuery}</span>」的结果
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                (共 {searchResults.length} 部)
              </span>
            </div>

            {/* 题材快筛微标签 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {searchFilterTags.map((tag) => {
                const isSelected = searchFilterTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchFilterTag(tag)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3.2 搜索加载中与结果网格 */}
          {searchLoading ? (
            <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
              <span className="text-sm">正在检索片库，请稍候...</span>
            </div>
          ) : (
            (() => {
              const filteredItems = searchResults.filter((item) => {
                if (searchFilterTag === "全部") return true;
                const text = `${item.title} ${item.tags} ${item.description || ""}`;
                return text.includes(searchFilterTag);
              });

              if (filteredItems.length === 0) {
                return (
                  <div className="text-center py-24 text-slate-500 text-sm space-y-2 bg-[#0a0f1d] border border-slate-800 rounded-2xl">
                    <p>
                      {searchFilterTag === "全部"
                        ? `未找到与「${searchQuery}」相关的短剧`
                        : `在「${searchFilterTag}」分类下未找到匹配短剧`}
                    </p>
                    <p className="text-xs text-slate-600">
                      请尝试更换关键词（如：都市、逆袭、甜宠）或切换全部题材
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      tabIndex={0}
                      onClick={() => handleSelectSeries(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSelectSeries(item);
                      }}
                      className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                        <img
                          src={item.cover}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        {item.badge && (
                          <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                            {item.badge}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <Play className="w-4 h-4 fill-white text-white" /> 点击播放
                          </span>
                        </div>
                      </div>
                      <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                        <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.tags || "全网高分短剧"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};
