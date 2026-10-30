'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { ME_FRESH_MS } from '@/lib/me';
import { queryKeys } from '@/lib/query-keys';
import { POST_TYPE_CONFIG } from '@pantopus/ui-utils';

export interface FeedPrefs {
  hide_deals_place: boolean;
  hide_alerts_place: boolean;
  show_politics_connections?: boolean;
  show_politics_place?: boolean;
}

export function useFeedPreferences(showToast: (msg: string) => void, onPrefChanged: () => void) {
  const [showPrefs, setShowPrefs] = useState(false);
  const [unmutingCategory, setUnmutingCategory] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Your feed preferences are one shared entry (contract §4, "You": fresh 10 minutes), so coming
  // back to the feed doesn't ask again. A failed read simply leaves them unknown, as before.
  const queryClient = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: queryKeys.feedPreferences(),
    queryFn: async () => (await api.posts.getFeedPreferences()).preferences as FeedPrefs,
    staleTime: ME_FRESH_MS,
  });
  const prefs = prefsQuery.data ?? null;
  const mutesQuery = useQuery({
    queryKey: ['feedCategoryMutes'],
    queryFn: async () => (await api.posts.getMutedEntities()).topic_mutes ?? [],
    enabled: showPrefs,
    staleTime: 0,
  });
  const mutedCategories = (mutesQuery.data ?? []).filter((mute) => Object.hasOwn(POST_TYPE_CONFIG, mute.topic));

  const unmuteCategory = useCallback(async (postType: string) => {
    if (unmutingCategory) return;
    setActionError(null);
    setUnmutingCategory(postType);
    try {
      await api.posts.unmuteEntity({ entityType: 'topic', entityId: postType });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feedCategoryMutes'] }),
        queryClient.resetQueries({ queryKey: ['feed'] }),
      ]);
      showToast('Category unmuted in all feeds');
    } catch {
      setActionError('Failed to unmute category. Try again.');
    } finally {
      setUnmutingCategory(null);
    }
  }, [queryClient, showToast, unmutingCategory]);

  const updatePref = useCallback(async (key: string, value: boolean) => {
    setActionError(null);
    try {
      const res = await api.posts.updateFeedPreferences({ [key]: value } as Record<string, any>);
      queryClient.setQueryData(queryKeys.feedPreferences(), res.preferences as FeedPrefs);
      onPrefChanged();
    } catch {
      setActionError('Failed to update preference. Try again.');
    }
  }, [onPrefChanged, queryClient]);

  return {
    showPrefs,
    setShowPrefs,
    prefs,
    updatePref,
    actionError,
    mutedCategories,
    mutesLoading: mutesQuery.isPending,
    mutesError: mutesQuery.isError,
    retryMutes: mutesQuery.refetch,
    unmutingCategory,
    unmuteCategory,
    prefsError: prefsQuery.isError,
    retryPrefs: prefsQuery.refetch,
  };
}
