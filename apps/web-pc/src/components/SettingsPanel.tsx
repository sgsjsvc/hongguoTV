import React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { RecommendationMode } from "../types";

interface SettingsPanelProps {
  recommendationMode: RecommendationMode;
  setRecommendationMode: (mode: RecommendationMode) => void;
  savePlaybackPreference: (key: string, value: any) => void;
  showToast: (msg: string) => void;
  showRecommendationResetConfirm: boolean;
  setShowRecommendationResetConfirm: (v: boolean) => void;
  onResetRecommendationPreferences: () => void;
  syncStatus: any;
  remoteUrl: string;
  setRemoteUrl: (v: string) => void;
  remoteUrlTouched: React.MutableRefObject<boolean>;
  remoteKey: string;
  setRemoteKey: (v: string) => void;
  syncSaving: boolean;
  setSyncSaving: (v: boolean) => void;
  configureSync: (url: string, key: string, enabled?: boolean) => Promise<any>;
  setSyncStatus: (v: any) => void;
  getSyncStatus: () => any;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  recommendationMode,
  setRecommendationMode,
  savePlaybackPreference,
  showToast,
  showRecommendationResetConfirm,
  setShowRecommendationResetConfirm,
  onResetRecommendationPreferences,
  syncStatus,
  remoteUrl,
  setRemoteUrl,
  remoteUrlTouched,
  remoteKey,
  setRemoteKey,
  syncSaving,
  setSyncSaving,
  configureSync,
  setSyncStatus,
  getSyncStatus,
}) => {
  return (
    <div className="max-w-xl mx-auto space-y-6 pt-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-rose-500" /> 本地服务与远程同步
      </h2>
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 space-y-5">
        <h3 className="font-semibold">推荐偏好</h3>
        <label className="block text-sm text-slate-300">
          推荐内容
          <select
            aria-label="推荐内容"
            value={recommendationMode}
            onChange={(e) => {
              const mode = e.target.value as RecommendationMode;
              setRecommendationMode(mode);
              savePlaybackPreference("recommendationMode", mode);
              showToast("推荐模式已保存，下次进入推荐页生效");
            }}
            className="block mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none"
          >
            <option value="mixed">混合推荐</option>
            <option value="real-drama">仅真人剧</option>
            <option value="comic-drama">仅漫剧</option>
            <option value="ai-drama">仅 AI 剧</option>
          </select>
        </label>
        <p className="text-xs text-slate-400">
          混合推荐包含真人剧、漫剧与 AI 剧，根据观看兴趣调整，并保留新内容探索。
        </p>
        {showRecommendationResetConfirm ? (
          <div className="space-y-3 text-sm">
            <p>确定重新学习推荐偏好？收藏和观看历史会保留。</p>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded-xl bg-rose-600"
                onClick={() => {
                  onResetRecommendationPreferences();
                  setShowRecommendationResetConfirm(false);
                  showToast("推荐偏好已重置，下次进入推荐页生效");
                }}
              >
                确认重置
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-slate-800"
                onClick={() => setShowRecommendationResetConfirm(false)}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700"
            onClick={() => setShowRecommendationResetConfirm(true)}
          >
            重置推荐偏好
          </button>
        )}
      </div>

      <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 space-y-5">
        <p className="text-sm text-slate-400">
          收藏、历史、搜索记录与播放偏好先保存在本地。配置远程服务后，连接同一家庭的设备可互相续播。
        </p>
        <div role="status" className="p-4 rounded-xl bg-slate-950 text-sm">
          <span className="text-rose-400 font-semibold">
            {{
              unconfigured: "未配置远程",
              pending: "待同步",
              syncing: "同步中",
              synced: "已同步",
              offline: "离线待同步",
            }[syncStatus.state as string] || "连接失败"}
          </span>
          {syncStatus.pending > 0 && (
            <span className="ml-3 text-slate-400">待同步 {syncStatus.pending} 条</span>
          )}
          {syncStatus.error && <p className="mt-2 text-amber-300">{syncStatus.error}</p>}
        </div>

        <label className="block text-sm text-slate-300">
          远程服务地址
          <input
            aria-label="远程服务地址"
            value={remoteUrl}
            onChange={(e) => {
              remoteUrlTouched.current = true;
              setRemoteUrl(e.target.value);
            }}
            placeholder="https://sync.example.com"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none"
          />
        </label>

        <label className="block text-sm text-slate-300">
          家庭共享密钥
          <input
            aria-label="家庭共享密钥"
            type="password"
            autoComplete="new-password"
            value={remoteKey}
            onChange={(e) => setRemoteKey(e.target.value)}
            placeholder={
              syncStatus.enabled
                ? "留空沿用当前地址已保存的密钥"
                : "填写远程服务生成的共享密钥"
            }
            className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none"
          />
        </label>

        <div className="flex gap-3">
          <button
            disabled={syncSaving}
            onClick={async () => {
              setSyncSaving(true);
              try {
                await configureSync(remoteUrl, remoteKey);
                setRemoteKey("");
                setSyncStatus(getSyncStatus());
                showToast("远程连接已验证，开始同步");
              } catch (error: any) {
                showToast(error.response?.data?.error || "连接失败，原配置已保留");
              } finally {
                setSyncSaving(false);
              }
            }}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
          >
            验证并启用同步
          </button>
          {syncStatus.enabled && (
            <button
              disabled={syncSaving}
              onClick={async () => {
                try {
                  await configureSync("", "", false);
                  setSyncStatus(getSyncStatus());
                  showToast("已关闭远程同步，本地数据保留");
                } catch {
                  showToast("配置保存失败");
                }
              }}
              className="px-4 py-3 rounded-xl bg-slate-800"
            >
              关闭同步
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          关闭同步后继续使用本地数据；更换地址需要重新验证连接。
        </p>
      </div>
    </div>
  );
};
