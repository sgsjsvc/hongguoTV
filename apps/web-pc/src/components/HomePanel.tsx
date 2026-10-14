import React from "react";
import { 
  Play, 
  Heart, 
  Flame, 
  UserCheck, 
  Palette, 
  Bot 
} from "lucide-react";
import { BannerItem, Section, Series } from "../types";

interface HomePanelProps {
  banners: BannerItem[];
  activeBannerIndex: number;
  setActiveBannerIndex: (idx: number) => void;
  selectedHomeSection: string;
  setSelectedHomeSection: (sec: string) => void;
  sections: Section[];
  handleSelectSeries: (item: Series) => void;
  handleToggleFav: (item: Series) => void;
}

export const HomePanel: React.FC<HomePanelProps> = ({
  banners,
  activeBannerIndex,
  setActiveBannerIndex,
  selectedHomeSection,
  setSelectedHomeSection,
  sections,
  handleSelectSeries,
  handleToggleFav,
}) => {
  const currentBanner = banners[activeBannerIndex];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-14">
      {/* 官方级顶部大宽屏 Banner 轮播 */}
      {currentBanner && (
        <div className="relative rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl group min-h-[280px] md:min-h-[360px] flex items-end p-6 md:p-10">
          <img
            src={currentBanner.backgroundCover || currentBanner.cover}
            alt={currentBanner.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070a12]/90 via-transparent to-transparent" />

          <div className="relative z-10 max-w-2xl space-y-3">
            {currentBanner.titleImage ? (
              <img
                src={currentBanner.titleImage}
                alt={currentBanner.title}
                className="h-10 md:h-14 object-contain"
              />
            ) : (
              <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                {currentBanner.title}
              </h2>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30">
                官方主打推荐
              </span>
              <span>{currentBanner.tags}</span>
            </div>

            <p className="text-xs md:text-sm text-slate-300 line-clamp-2 leading-relaxed">
              {currentBanner.description}
            </p>

            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={() => handleSelectSeries(currentBanner)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-sm font-bold shadow-xl shadow-rose-900/50 transition-all scale-100 hover:scale-105 outline-none focus:ring-4 focus:ring-rose-500/60"
              >
                <Play className="w-4 h-4 fill-white" /> 立即观看
              </button>
              <button
                onClick={() => handleToggleFav(currentBanner)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-sm font-semibold border border-slate-700/80 transition outline-none focus:ring-2 focus:ring-rose-500"
              >
                <Heart className="w-4 h-4 text-rose-500" /> 加入追剧
              </button>
            </div>
          </div>

          <div className="absolute bottom-6 right-8 z-10 flex gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveBannerIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === activeBannerIndex
                    ? "w-8 bg-rose-500"
                    : "w-2 bg-slate-600 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 首页专区快速切换 */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
        {[
          { type: "all", name: "全部热播", icon: Flame },
          { type: "human", name: "真人短剧", icon: UserCheck },
          { type: "comic", name: "热门漫剧", icon: Palette },
          { type: "ai", name: "AI 先锋剧", icon: Bot },
        ].map((tabItem) => {
          const Icon = tabItem.icon;
          const isSelected = selectedHomeSection === tabItem.type;
          return (
            <button
              key={tabItem.type}
              onClick={() => setSelectedHomeSection(tabItem.type)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 outline-none focus:ring-4 focus:ring-rose-500/50 ${
                isSelected
                  ? "bg-slate-800 text-rose-400 border border-rose-500/30 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <Icon className="w-4 h-4" /> {tabItem.name}
            </button>
          );
        })}
      </div>

      {/* 专区短剧网格 */}
      {sections
        .filter(
          (sec) =>
            selectedHomeSection === "all" || sec.type === selectedHomeSection
        )
        .map((section) => (
          <div key={section.type} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-rose-500 inline-block" />
                {section.name}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {section.items.map((item) => (
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
                      {item.tags || "官方推荐"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};
