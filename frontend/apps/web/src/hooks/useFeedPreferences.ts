'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { ME_FRESH_MS } from '@/lib/me';
import { queryKeys } from '@/lib/query-keys';

export interface FeedPrefs {
  hide_deals_place: boolean;
  hide_alerts_place: boolean;
  show_politics_connections?: boolean;
  show_politics_place?: boolean;
}

export function useFeedPreferences(showToast: (msg: string) => void, onPrefChanged: () => void) {
  const [showPrefs, setShowPrefs] = useState(false);
  // Your feed preferences are one shared entry (contract §4, "You": fresh 10 minutes), so coming
  // back to the feed doesn't ask again. A failed read simply leaves them unknown, as before.
  const queryClient = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: queryKeys.feedPreferences(),
    queryFn: async () => (await api.posts.getFeedPreferences()).preferences as FeedPrefs,
    staleTime: ME_FRESH_MS,
  });
  const prefs = prefsQuery.data ?? null;

  const updatePref = useCallback(async (key: string, value: boolean) => {
    try {
      const res = await api.posts.updateFeedPreferences({ [key]: value } as Record<string, any>);
      queryClient.setQueryData(queryKeys.feedPreferences(), res.preferences as FeedPrefs);
      onPrefChanged();
    } catch {
      showToast('Failed to update preference');
    }
  }, [showToast, onPrefChanged, queryClient]);

  return {
    showPrefs,
    setShowPrefs,
    prefs,
    updatePref,
  };
}
