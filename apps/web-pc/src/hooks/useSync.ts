import { useState, useRef } from "react";
import { 
  getSyncStatus, 
  configureSync, 
  getPlaybackPreferences, 
  savePlaybackPreference, 
  resetRecommendationPreferences 
} from "../api";
import { RecommendationMode } from "../types";

export function useSync() {
  const [syncStatus, setSyncStatus] = useState<any>(() => getSyncStatus());
  const [remoteUrl, setRemoteUrl] = useState(() => getSyncStatus().url || "");
  const [remoteKey, setRemoteKey] = useState("");
  const [syncSaving, setSyncSaving] = useState(false);
  const remoteUrlTouched = useRef(false);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>(
    () => getPlaybackPreferences().recommendationMode
  );
  const [showRecommendationResetConfirm, setShowRecommendationResetConfirm] = useState(false);

  return {
    syncStatus,
    setSyncStatus,
    remoteUrl,
    setRemoteUrl,
    remoteKey,
    setRemoteKey,
    syncSaving,
    setSyncSaving,
    remoteUrlTouched,
    recommendationMode,
    setRecommendationMode,
    showRecommendationResetConfirm,
    setShowRecommendationResetConfirm,
    getSyncStatus,
    configureSync,
    savePlaybackPreference,
    resetRecommendationPreferences,
  };
}
