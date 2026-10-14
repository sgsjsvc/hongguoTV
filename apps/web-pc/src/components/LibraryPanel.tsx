import React, { useState } from "react";
import { 
  Heart, 
  Clock, 
  Trash2, 
  Play, 
  X 
} from "lucide-react";
import { HistoryItem, Series } from "../types";
import { formatTime } from "../utils/format";

interface LibraryPanelProps {
  favorites: Series[];
  historyList: HistoryItem[];
  refreshHistory: () => Promise<void>;
  clearHistory: () => Promise<any>;
  removeHistoryItem: (id: string) => Promise<any>;
  handleSelectSeries: (series: Series, resumeHistory?: HistoryItem) => void;
  showToast: (msg: string) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  favorites,
  historyList,
  refreshHistory,
  clearHistory,
  removeHistoryItem,
  handleSelectSeries,
  showToast,
}) => {
  const [favSubTab, setFavSubTab] = useState<"favorites" | "history">("favorites");
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  return (
    <div className="max-w-7xl mx-auto pb-14 space-y-6">
      {/* 顶部双选项卡切换栏与操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* 双选项卡: 我的追剧 / 观看历史 */}
        <div className="flex items-center gap-2 bg-[#0a0f1d] p-1.5 rounded-2xl border border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setFavSubTab("favorites")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 cursor-pointer ${
              favSubTab === "favorites"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Heart className={`w-4 h-4 ${favSubTab === "favorites" ? "fill-white" : ""}`} />
            <span>我的追剧</span>
            {favorites.length > 0 && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  favSubTab === "favorites" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {favorites.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFavSubTab("history");
              void refreshHistory();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-extrabold transition-all outline-none focus:ring-4 focus:ring-rose-500/50 cursor-pointer ${
              favSubTab === "history"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>观看历史</span>
            {historyList.length > 0 && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  favSubTab === "history" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {historyList.length}
              </span>
            )}
          </button>
        </div>

        {/* 右侧操作按钮：仅在历史记录页且有记录时展示清空全部按钮 */}
        {favSubTab === "history" && historyList.length > 0 && (
          <div className="flex items-center gap-3">
            {showClearHistoryConfirm ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-rose-500/40 p-1.5 rounded-xl text-xs">
                <span className="text-rose-400 font-semibold px-2">确定清空观看历史?</span>
                <button
                  type="button"
                  onClick={() => {
                    void clearHistory().then(() => {
                      void refreshHistory();
                      setShowClearHistoryConfirm(false);
                      showToast("已清空观看历史记录");
                    }).catch(() => showToast("清空失败，请检查后端连接后重试"));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition cursor-pointer"
                >
                  确认清空
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearHistoryConfirm(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-semibold transition cursor-pointer outline-none focus:ring-2 focus:ring-rose-500/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空观看历史</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* A. 我的追剧列表 */}
      {favSubTab === "favorites" && (
        <div>
          {favorites.length === 0 ? (
            <div className="text-center py-28 text-slate-500 text-sm space-y-3">
              <Heart className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
              <p>暂无收藏短剧，快去官方首页、分类或热播榜单看看吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {favorites.map((item) => (
                <div
                  key={item.id}
                  tabIndex={0}
                  onClick={() => handleSelectSeries(item)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSelectSeries(item); }}
                  className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 relative"
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
                    <p className="text-xs text-slate-500 line-clamp-1">{item.tags || "全网高分短剧"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* B. 观看历史列表 */}
      {favSubTab === "history" && (
        <div>
          {historyList.length === 0 ? (
            <div className="text-center py-28 text-slate-500 text-sm space-y-3">
              <Clock className="w-10 h-10 mx-auto text-slate-700 stroke-[1.5]" />
              <p>暂无观看记录，点击任意短剧即可智能为您记录播放进度！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {historyList.map((hist) => {
                const seriesObj: Series = {
                  id: hist.seriesId,
                  contentType: hist.contentType,
                  title: hist.title || "未知短剧",
                  cover: hist.cover || "",
                  badge: hist.badge || "",
                  description: "",
                  tags: hist.tags || "",
                };
                const percent =
                  hist.duration && hist.duration > 0
                    ? Math.min(100, Math.round((hist.position / hist.duration) * 100))
                    : 0;

                return (
                  <div
                    key={hist.seriesId}
                    tabIndex={0}
                    onClick={() => handleSelectSeries(seriesObj, hist)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSelectSeries(seriesObj, hist);
                    }}
                    className="group flex flex-col rounded-2xl overflow-hidden bg-[#0a0f1d] border border-slate-800/80 hover:border-rose-500/60 hover:shadow-2xl hover:shadow-rose-950/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/70 relative"
                  >
                    {/* 封面与底部高亮进度条 */}
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                      <img
                        src={hist.cover}
                        alt={hist.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* 悬浮删除单条按钮 */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await removeHistoryItem(hist.seriesId);
                            await refreshHistory();
                            showToast(`已删除《${hist.title}》的播放记录`);
                          } catch {
                            showToast("删除失败，请检查后端连接后重试");
                          }
                        }}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer shadow-md"
                        title="删除此记录"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* 角标 */}
                      {hist.badge && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600/90 text-white shadow-md">
                          {hist.badge}
                        </span>
                      )}

                      {/* 悬浮播放微浮层 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-950/50">
                          <Play className="w-3.5 h-3.5 fill-white text-white" /> 继续观看
                        </span>
                      </div>

                      {/* 底部红色进度条底衬 */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* 详情描述区 */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5">
                      <div>
                        <h4 className="font-bold text-sm leading-snug line-clamp-1 group-hover:text-rose-400 transition">
                          {hist.title || "未知剧集"}
                        </h4>
                        {/* 观看进度与百分比标注 */}
                        <div className="flex items-center justify-between text-xs text-rose-400/90 font-medium mt-1">
                          <span>看到第 {hist.episodeNumber || 1} 集</span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatTime(hist.position)}
                            {percent > 0 ? ` (${percent}%)` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span>
                          {hist.updatedAt
                            ? new Date(hist.updatedAt).toLocaleString("zh-CN", {
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "最近"}
                        </span>
                        <span className="text-slate-400 group-hover:text-rose-400 font-semibold transition">
                          一键续播 &gt;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
