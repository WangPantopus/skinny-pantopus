'use client';

/**
 * useFeatureFlag — P0.8 client visibility scaffolding.
 *
 * Audience Profile design v2 §19 acceptance criterion 15: every audience-
 * profile UI surface (the Audience tab in primary nav, persona-setup CTAs,
 * fan-side flows added in Phase 1) must check the `audience_profile` flag
 * and render nothing if the user does not have access.
 *
 * Consumers that redirect on disabled flags must use the stateful hook so
 * the initial loading state cannot be mistaken for "disabled". The 60s
 * staleTime matches the backend cache so a global flag flip propagates
 * within a minute even without page refresh.
 */

import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';

const FLAG_STALE_MS = 60_000;

export interface FeatureFlagState {
  enabled: boolean;
  isLoading: boolean;
  isFetched: boolean;
  error: unknown;
}

export function useFeatureFlagState(flagName: string): FeatureFlagState {
  const query = useQuery({
    queryKey: ['featureFlag', flagName],
    queryFn: () => api.featureFlags.getFeatureFlag(flagName),
    staleTime: FLAG_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    enabled: Boolean(query.data?.enabled),
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    error: query.error,
  };
}

export function useFeatureFlag(flagName: string): boolean {
  return useFeatureFlagState(flagName).enabled;
}
