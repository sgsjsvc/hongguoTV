import React from "react";
import { 
  Play, 
  Sparkles, 
  Compass, 
  Grid, 
  Trophy, 
  Search, 
  Heart, 
  Settings as SettingsIcon 
} from "lucide-react";

export type NavTab = "home" | "recommend" | "category" | "rank" | "search" | "favorites" | "settings";

interface HeaderProps {
  tab: NavTab;
  activeSeries: any;
  favoritesCount: number;
  onNavigate: (tab: NavTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  tab,
  activeSeries,
  favoritesCount,
  onNavigate,
}) => {
  return (
    <header className="h-16 md:h-20 bg-[#0a0f1d]/95 backdrop-blur border-b border-slate-800/80 px-4 md:px-8 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
        {/* Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer shrink-0" 
          onClick={() => onNavigate("home")}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-900/40">
            <Play className="w-5 h-5 fill-white text-white ml-0.5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              红果短剧
            </h1>
            <span className="text-[10px] text-rose-400/90 font-bold tracking-widest uppercase block -mt-1">
              TV & PC 客户端
            </span>
          </div>
        </div>

        {/* 顶部主菜单项 (首页 | 分类 | 榜单 | 搜索 | 追剧) */}
        <nav className="flex items-center gap-1 md:gap-2">
          {/* 1. 首页 */}
          <button
            tabIndex={1}
            onClick={() => onNavigate("home")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "home" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className="w-4 h-4" /> 首页
          </button>

          {/* 1.5 推荐刷剧 (沉浸式 9:16 短剧流) */}
          <button
            tabIndex={2}
            onClick={() => onNavigate("recommend")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "recommend" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Compass className="w-4 h-4" /> 推荐
          </button>

          {/* 2. 分类 */}
          <button
            tabIndex={3}
            onClick={() => onNavigate("category")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "category" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Grid className="w-4 h-4" /> 分类
          </button>

          {/* 3. 榜单 */}
          <button
            tabIndex={3}
            onClick={() => onNavigate("rank")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "rank" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" /> 榜单
          </button>

          {/* 4. 搜索 */}
          <button
            tabIndex={4}
            onClick={() => onNavigate("search")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "search" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Search className="w-4 h-4" /> 搜索
          </button>

          {/* 5. 追剧与历史 */}
          <button
            tabIndex={5}
            onClick={() => onNavigate("favorites")}
            className={`tv-nav-item flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 shrink-0 ${
              tab === "favorites" && !activeSeries
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Heart className="w-4 h-4" /> 追剧
            {favoritesCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                {favoritesCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* 右侧设置与自建服务状态 */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          tabIndex={6}
          onClick={() => onNavigate("settings")}
          className={`tv-nav-item flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus:ring-4 focus:ring-rose-500/50 ${
            tab === "settings" && !activeSeries
              ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="hidden sm:inline">设置</span>
        </button>

        <div className="hidden xl:flex items-center gap-2 text-xs bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>本地服务</span>
        </div>
      </div>
    </header>
  );
};
