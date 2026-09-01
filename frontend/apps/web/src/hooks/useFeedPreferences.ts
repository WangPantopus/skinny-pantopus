'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@pantopus/api';

export interface FeedPrefs {
  hide_deals_place: boolean;
  hide_alerts_place: boolean;
  show_politics_connections?: boolean;
  show_politics_place?: boolean;
}

export function useFeedPreferences(showToast: (msg: string) => void, onPrefChanged: () => void) {
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<FeedPrefs | null>(null);

  useEffect(() => {
    api.posts.getFeedPreferences().then((r) => setPrefs(r.preferences)).catch(() => {});
  }, []);

  const updatePref = useCallback(async (key: string, value: boolean) => {
    try {
      const res = await api.posts.updateFeedPreferences({ [key]: value } as Record<string, any>);
      setPrefs(res.preferences);
      onPrefChanged();
    } catch {
      showToast('Failed to update preference');
    }
  }, [showToast, onPrefChanged]);

  return {
    showPrefs,
    setShowPrefs,
    prefs,
    updatePref,
  };
}
