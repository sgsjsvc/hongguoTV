import React from "react";
import { 
  Flame, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { RankItem, RankTypeItem, Series } from "../types";

interface RankPanelProps {
  rankTypes: RankTypeItem[];
  selectedRankSlug: string;
  setSelectedRankSlug: (slug: string) => void;
  rankPage: number;
  setRankPage: React.Dispatch<React.SetStateAction<number>>;
  rankTotalPages: number;
  rankLoading: boolean;
  rankItems: RankItem[];
  handleSelectSeries: (item: Series) => void;
  onNavigateHome: () => void;
  todayStr: string;
}

export const RankPanel: React.FC<RankPanelProps> = ({
  rankTypes,
  selectedRankSlug,
  setSelectedRankSlug,
  rankPage,
  setRankPage,
  rankTotalPages,
  rankLoading,
  rankItems,
  handleSelectSeries,
  onNavigateHome,
  todayStr,
}) => {
  const currentRankType = rankTypes.find((r) => r.slug === selectedRankSlug) || rankTypes[0] || { slug: "", name: "热播榜", key: "" };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* 4.1 官方级热播榜顶部国风 Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-rose-900/40 shadow-2xl bg-gradient-to-r from-[#420d11] via-[#5c131a] to-[#2b080b] p-6 md:p-10 flex flex-col justify-between min-h-[170px] md:min-h-[210px]">
        {/* 背景装饰 */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden opacity-60 md:opacity-80">
          <div className="absolute right-12 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-tr from-amber-500/40 to-rose-500/20 blur-3xl" />
          <svg className="absolute right-6 md:right-16 top-1/2 -translate-y-1/2 w-60 h-40 text-amber-200/50 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" viewBox="0 0 200 120" fill="currentColor">
            <path d="M10 60 Q 50 10, 110 30 Q 150 45, 190 20 Q 160 70, 110 65 Q 60 60, 10 60 Z" opacity="0.4" />
            <path d="M40 70 Q 90 20, 140 40 Q 170 55, 195 35 Q 160 85, 120 75 Q 70 70, 40 70 Z" opacity="0.7" />
            <circle cx="180" cy="25" r="4" fill="#fef08a" />
          </svg>
        </div>

        {/* 面包屑导航与副标题 */}
        <div className="relative z-10 space-y-2">
          <div className="text-xs text-rose-300/80 font-medium flex items-center gap-1.5">
            <span className="hover:text-white cursor-pointer" onClick={onNavigateHome}>首页</span>
            <span>/</span>
            <span className="text-rose-200 font-semibold">{currentRankType.name}</span>
          </div>

          <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">
            《 {currentRankType.name} 》
          </h2>

          <p className="text-xs md:text-sm text-rose-200/80 font-medium pt-0.5">
            {todayStr} · 基于红果内观看/互动等综合热度排序 · 官方 Top 100
          </p>
        </div>
      </div>

      {/* 4.2 官方四大子榜单 Tab 切换栏 */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
        {rankTypes.map((rt) => {
          const isSelected = selectedRankSlug === rt.slug;
          return (
            <button
              key={rt.slug}
              onClick={() => {
                setSelectedRankSlug(rt.slug);
                setRankPage(1);
              }}
              className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 ${
                isSelected
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40 scale-105"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {rt.name}
            </button>
          );
        })}
      </div>

      {/* 4.3 排行榜单项卡片列表 */}
      {rankLoading ? (
        <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-sm">正在加载官方前 100 名热播短剧...</span>
        </div>
      ) : rankItems.length === 0 ? (
        <div className="text-center py-28 text-slate-500 text-sm">
          当前榜单暂无数据
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {rankItems.map((item, index) => {
            const rankNum = item.rank || (rankPage - 1) * 20 + index + 1;
            const isTop1 = rankNum === 1;
            const isTop2 = rankNum === 2;
            const isTop3 = rankNum === 3;

            let rankBadgeBg = "bg-slate-800 text-slate-300";
            if (isTop1) rankBadgeBg = "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg shadow-amber-500/40";
            else if (isTop2) rankBadgeBg = "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 font-black";
            else if (isTop3) rankBadgeBg = "bg-gradient-to-r from-amber-700 to-amber-600 text-white font-black";

            return (
              <div
                key={item.id}
                tabIndex={0}
                onClick={() => handleSelectSeries(item)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                className={`group relative flex items-center gap-4 p-3.5 rounded-2xl bg-[#0a0f1d] border transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 ${
                  isTop1
                    ? "border-amber-500/40 hover:border-amber-400 bg-gradient-to-r from-amber-950/20 via-[#0a0f1d] to-[#0a0f1d] hover:shadow-xl hover:shadow-amber-950/30"
                    : "border-slate-800/80 hover:border-rose-500/60 hover:shadow-xl hover:shadow-rose-950/20"
                }`}
              >
                {/* 左侧封面海报与排名数字角标 */}
                <div className="relative shrink-0 w-20 md:w-24 aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div
                    className={`absolute top-0 left-0 min-w-6 h-6 px-1.5 flex items-center justify-center rounded-br-xl text-xs ${rankBadgeBg}`}
                  >
                    {rankNum}
                  </div>
                </div>

                {/* 右侧剧集详情与操作栏 */}
                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${rankBadgeBg}`}
                      >
                        TOP {rankNum}
                      </span>
                      {item.badge && (
                        <span className="text-[10px] text-slate-400 font-medium bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm md:text-base leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description || item.tags || "官方推荐榜首热剧"}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-rose-400/90 font-semibold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                      {item.heatText || "热播指数高"}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-lg bg-rose-600/90 text-white font-bold group-hover:bg-rose-500 transition shadow">
                      立即播放
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4.4 底部官方前 100 名分页翻页控制器 (1~5 页，共 100 名) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-800/80">
        <div className="text-xs text-slate-400">
          展示官方前 <span className="text-rose-400 font-bold">100</span> 名 · 当前为第 <span className="text-white font-bold font-mono">{(rankPage - 1) * 20 + 1} ~ {Math.min(100, rankPage * 20)}</span> 名
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={rankPage <= 1 || rankLoading}
            onClick={() => setRankPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-2 focus:ring-rose-500"
          >
            <ChevronLeft className="w-4 h-4" /> 上一页
          </button>

          {[1, 2, 3, 4, 5].map((pageNum) => (
            <button
              key={pageNum}
              disabled={rankLoading}
              onClick={() => setRankPage(pageNum)}
              className={`w-9 h-9 rounded-xl text-xs font-bold transition-all outline-none focus:ring-2 focus:ring-rose-500 ${
                rankPage === pageNum
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/40 scale-105"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            disabled={rankPage >= rankTotalPages || rankLoading}
            onClick={() => setRankPage((p) => Math.min(rankTotalPages, p + 1))}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition outline-none focus:ring-4 focus:ring-rose-500/50 shadow-md shadow-rose-900/40"
          >
            下一页 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
