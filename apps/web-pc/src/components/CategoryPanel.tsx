import React from "react";
import { 
  Grid, 
  Compass, 
  RefreshCw, 
  Play, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { CategoryTag, CategoryType, Series } from "../types";

interface CategoryPanelProps {
  categoryTagsLoading: boolean;
  categoryTags: CategoryTag[];
  categoryTypes: CategoryType[];
  selectedCatType: string;
  setSelectedCatType: (type: string) => void;
  selectedCatTag: string;
  setSelectedCatTag: (tag: string) => void;
  catPage: number;
  setCatPage: React.Dispatch<React.SetStateAction<number>>;
  categoryError: string;
  onRetry: () => void;
  catLoading: boolean;
  categoryItems: Series[];
  categoryTotalPages: number;
  handleSelectSeries: (item: Series) => void;
}

export const CategoryPanel: React.FC<CategoryPanelProps> = ({
  categoryTagsLoading,
  categoryTags,
  categoryTypes,
  selectedCatType,
  setSelectedCatType,
  selectedCatTag,
  setSelectedCatTag,
  catPage,
  setCatPage,
  categoryError,
  onRetry,
  catLoading,
  categoryItems,
  categoryTotalPages,
  handleSelectSeries,
}) => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-14">
      {/* 分类标题与当前状态 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
            <Grid className="w-6 h-6 text-rose-500" /> 官方题材全部分类
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {categoryTagsLoading
              ? "正在读取官网题材…"
              : `官网当前 ${categoryTags.length} 种题材 · 真人剧 / 漫剧 / AI 剧`}
          </p>
        </div>

        {/* 一级内容类型选择器 (真人剧 / 漫剧 / AI剧) */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          {categoryTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedCatType(t.id);
                setSelectedCatTag("");
                setCatPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 ${
                selectedCatType === t.id
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {categoryError && (
        <div role="alert" className="text-sm text-rose-300">
          {categoryError}
          <button className="ml-3 underline" onClick={onRetry}>
            重试
          </button>
        </div>
      )}

      {/* 题材以当前官网分类页面为准 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Compass className="w-4 h-4 text-rose-500" /> 题材筛选：
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-wrap">
          <button
            onClick={() => {
              setSelectedCatTag("");
              setCatPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
              selectedCatTag === ""
                ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            全部题材
          </button>
          {categoryTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                setSelectedCatTag(tag.id);
                setCatPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
                selectedCatTag === tag.id
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* 短剧列表网格 */}
      {catLoading ? (
        <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-sm">正在加载官方分类片库...</span>
        </div>
      ) : categoryItems.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm">
          当前筛选分类暂无收录短剧
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {categoryItems.map((item) => (
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <Play className="w-4 h-4 fill-rose-300" /> 点击播放
                  </span>
                </div>
              </div>
              <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {item.tags || "官方分类"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部翻页控制器 */}
      <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-800/80">
        <button
          disabled={catPage <= 1 || catLoading}
          onClick={() => setCatPage((p) => Math.max(1, p - 1))}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-2 focus:ring-rose-500"
        >
          <ChevronLeft className="w-4 h-4" /> 上一页
        </button>
        <span className="text-xs font-bold font-mono px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
          第 {catPage} 页
        </span>
        <button
          disabled={
            catLoading ||
            (categoryTotalPages > 0
              ? catPage >= categoryTotalPages
              : categoryItems.length < 24)
          }
          onClick={() => setCatPage((p) => p + 1)}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-4 focus:ring-rose-500/50 shadow-md shadow-rose-900/40"
        >
          下一页 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
