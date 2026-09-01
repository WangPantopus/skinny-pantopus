'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@pantopus/api';
import type {
  HomeHealthScore,
  SeasonalChecklist,
  BillTrendData,
  PropertyValueData,
  HomeTimelineItem,
} from '@pantopus/types';

const isDev = process.env.NODE_ENV === 'development';

// ── Health score cache (5-minute TTL, shared across instances) ──
const HEALTH_CACHE_TTL = 5 * 60 * 1000;
const healthCache: Record<string, { data: HomeHealthScore; ts: number }> = {};

export function useHomeIntelligence(homeId: string | undefined) {
  // ── Health score ──────────────────────────────────────────────
  const [healthScore, setHealthScore] = useState<HomeHealthScore | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // ── Seasonal checklist ────────────────────────────────────────
  const [checklist, setChecklist] = useState<SeasonalChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(true);

  // ── Bill trends (deferred — fetched on demand) ────────────────
  const [billTrends, setBillTrends] = useState<BillTrendData | null>(null);
  const [billTrendsLoading, setBillTrendsLoading] = useState(true);
  const billTrendsFetchedRef = useRef(false);

  // ── Timeline (deferred — fetched on demand) ───────────────────
  const [timeline, setTimeline] = useState<HomeTimelineItem[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const timelineFetchedRef = useRef(false);

  // ── Property value (deferred — fetched on demand) ─────────────
  const [propertyValue, setPropertyValue] = useState<PropertyValueData | null>(null);
  const [propertyValueLoading, setPropertyValueLoading] = useState(true);
  const propertyValueFetchedRef = useRef(false);

  // ── Season transition detection ──────────────────────────────
  const lastSeasonKeyRef = useRef<string | null>(null);
  const [seasonTransition, setSeasonTransition] = useState<{
    from: string;
    toKey: string;
    toLabel: string;
  } | null>(null);

  // ── Cancelled flag for cleanup ────────────────────────────────
  const cancelledRef = useRef(false);

  // ── Deferred loading timer refs ─────────────────────────────
  const deferredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Individual fetchers ───────────────────────────────────────

  const fetchHealthScore = useCallback(
    async (cancelled: { current: boolean }, silent = false, opts?: { forceServer?: boolean }) => {
      if (!homeId) return;

      if (!opts?.forceServer) {
        const cached = healthCache[homeId];
        if (cached && Date.now() - cached.ts < HEALTH_CACHE_TTL) {
          if (!cancelled.current) {
            setHealthScore(cached.data);
            setHealthLoading(false);
          }
          return;
        }
      }

      if (!silent) setHealthLoading(true);
      try {
        const res = await api.homeProfile.getHomeHealthScore(homeId, opts?.forceServer ? { force: true } : undefined);
        if (!cancelled.current) {
          setHealthScore(res ?? null);
          if (res) healthCache[homeId] = { data: res, ts: Date.now() };
        }
      } catch (err) {
        if (isDev) console.warn('Failed to fetch health score:', err);
      } finally {
        if (!cancelled.current) setHealthLoading(false);
      }
    },
    [homeId],
  );

  const fetchChecklist = useCallback(async (cancelled: { current: boolean }, silent = false) => {
    if (!homeId) return;
    if (!silent) setChecklistLoading(true);
    try {
      const res = await api.homeProfile.getSeasonalChecklist(homeId);
      if (!cancelled.current) {
        setChecklist(res ?? null);
        // Detect season transition
        if (res?.season?.key) {
          const prevKey = lastSeasonKeyRef.current;
          if (prevKey && prevKey !== res.season.key) {
            setSeasonTransition({
              from: prevKey,
              toKey: res.season.key,
              toLabel: res.season.label,
            });
          }
          lastSeasonKeyRef.current = res.season.key;
        }
      }
    } catch (err) {
      if (isDev) console.warn('Failed to fetch checklist:', err);
    } finally {
      if (!cancelled.current) setChecklistLoading(false);
    }
  }, [homeId]);

  const fetchBillTrends = useCallback(async (cancelled: { current: boolean }, silent = false) => {
    if (!homeId) return;
    if (!silent) setBillTrendsLoading(true);
    try {
      const res = await api.homeProfile.getBillTrends(homeId);
      if (!cancelled.current) setBillTrends(res ?? null);
    } catch (err) {
      if (isDev) console.warn('Failed to fetch bill trends:', err);
    } finally {
      if (!cancelled.current) setBillTrendsLoading(false);
      billTrendsFetchedRef.current = true;
    }
  }, [homeId]);

  const fetchTimeline = useCallback(async (cancelled: { current: boolean }, page = 1, append = false, silent = false) => {
    if (!homeId) return;
    if (!silent) setTimelineLoading(true);
    try {
      const res = await api.homeProfile.getHomeTimeline(homeId, page, 20);
      if (!cancelled.current) {
        const items = res?.items ?? [];
        setTimeline((prev) => append ? [...prev, ...items] : items);
        setTimelinePage(page);
        setTimelineHasMore(res?.hasMore ?? false);
      }
    } catch (err) {
      if (isDev) console.warn('Failed to fetch timeline:', err);
    } finally {
      if (!cancelled.current) setTimelineLoading(false);
      timelineFetchedRef.current = true;
    }
  }, [homeId]);

  const fetchPropertyValue = useCallback(async (cancelled: { current: boolean }, silent = false) => {
    if (!homeId) return;
    if (!silent) setPropertyValueLoading(true);
    try {
      const res = await api.homeProfile.getPropertyValue(homeId);
      if (!cancelled.current) setPropertyValue(res ?? null);
    } catch (err) {
      if (isDev) console.warn('Failed to fetch property value:', err);
    } finally {
      if (!cancelled.current) setPropertyValueLoading(false);
      propertyValueFetchedRef.current = true;
    }
  }, [homeId]);

  // ── Fetch critical data on mount (health score + checklist) ───
  // Property value, bill trends, and timeline are deferred

  useEffect(() => {
    cancelledRef.current = false;
    billTrendsFetchedRef.current = false;
    timelineFetchedRef.current = false;
    propertyValueFetchedRef.current = false;

    if (homeId) {
      delete healthCache[homeId];
      Promise.allSettled([
        fetchHealthScore(cancelledRef, false, { forceServer: true }),
        fetchChecklist(cancelledRef),
      ]);
    }

    return () => {
      cancelledRef.current = true;
      if (deferredTimerRef.current) clearTimeout(deferredTimerRef.current);
    };
  }, [homeId, fetchHealthScore, fetchChecklist]);

  // ── Deferred fetchers (called by components when visible) ─────

  const ensureBillTrends = useCallback(() => {
    if (!billTrendsFetchedRef.current && homeId) {
      billTrendsFetchedRef.current = true;
      // Delay 500ms so below-fold fetches don't compete with critical data
      deferredTimerRef.current = setTimeout(() => {
        if (!cancelledRef.current) fetchBillTrends(cancelledRef);
      }, 500);
    }
  }, [homeId, fetchBillTrends]);

  const ensurePropertyValue = useCallback(() => {
    if (!propertyValueFetchedRef.current && homeId) {
      propertyValueFetchedRef.current = true;
      // Delay 500ms so below-fold fetches don't compete with critical data
      setTimeout(() => {
        if (!cancelledRef.current) fetchPropertyValue(cancelledRef);
      }, 500);
    }
  }, [homeId, fetchPropertyValue]);

  const ensureTimeline = useCallback(() => {
    if (!timelineFetchedRef.current && homeId) {
      timelineFetchedRef.current = true;
      fetchTimeline(cancelledRef, 1, false);
    }
  }, [homeId, fetchTimeline]);

  // ── Actions ───────────────────────────────────────────────────

  const invalidateHealthCache = useCallback(() => {
    if (homeId) delete healthCache[homeId];
  }, [homeId]);

  const completeChecklistItem = useCallback(async (itemId: string) => {
    if (!homeId) return;
    try {
      await api.homeProfile.updateChecklistItem(homeId, itemId, 'completed');
      invalidateHealthCache();
      await Promise.allSettled([
        fetchChecklist(cancelledRef),
        fetchHealthScore(cancelledRef, true, { forceServer: true }),
        timelineFetchedRef.current ? fetchTimeline(cancelledRef, 1, false) : Promise.resolve(),
      ]);
    } catch (err) {
      if (isDev) console.warn('Failed to complete checklist item:', err);
    }
  }, [homeId, fetchChecklist, fetchHealthScore, fetchTimeline, invalidateHealthCache]);

  const skipChecklistItem = useCallback(async (itemId: string) => {
    if (!homeId) return;
    try {
      await api.homeProfile.updateChecklistItem(homeId, itemId, 'skipped');
      invalidateHealthCache();
      await Promise.allSettled([
        fetchChecklist(cancelledRef),
        fetchHealthScore(cancelledRef, true, { forceServer: true }),
        timelineFetchedRef.current ? fetchTimeline(cancelledRef, 1, false) : Promise.resolve(),
      ]);
    } catch (err) {
      if (isDev) console.warn('Failed to skip checklist item:', err);
    }
  }, [homeId, fetchChecklist, fetchHealthScore, fetchTimeline, invalidateHealthCache]);

  const loadMoreTimeline = useCallback(async () => {
    if (!timelineHasMore || timelineLoading) return;
    await fetchTimeline(cancelledRef, timelinePage + 1, true);
  }, [timelineHasMore, timelineLoading, timelinePage, fetchTimeline]);

  const clearSeasonTransition = useCallback(() => {
    setSeasonTransition(null);
  }, []);

  const generateChecklist = useCallback(async () => {
    if (!homeId) return;
    await fetchChecklist(cancelledRef);
  }, [homeId, fetchChecklist]);

  const setBillBenchmarkOptIn = useCallback(async (optedIn: boolean) => {
    if (!homeId) return;
    try {
      await api.homeProfile.setBillBenchmarkOptIn(homeId, optedIn);
      // Optimistically update the local state
      setBillTrends((prev) => prev ? { ...prev, bill_benchmark_opt_in: optedIn } : prev);
    } catch (err) {
      if (isDev) console.warn('Failed to update bill benchmark opt-in:', err);
    }
  }, [homeId]);

  const refreshHealthScore = useCallback(async () => {
    if (!homeId) return;
    invalidateHealthCache();
    await fetchHealthScore(cancelledRef, true, { forceServer: true });
  }, [homeId, fetchHealthScore, invalidateHealthCache]);

  const refreshAll = useCallback(async () => {
    if (!homeId) return;
    invalidateHealthCache();
    // Stale-while-revalidate: don't show loading spinners on refresh
    await Promise.allSettled([
      fetchHealthScore(cancelledRef, true, { forceServer: true }),
      fetchChecklist(cancelledRef, true),
      billTrendsFetchedRef.current ? fetchBillTrends(cancelledRef, true) : Promise.resolve(),
      timelineFetchedRef.current ? fetchTimeline(cancelledRef, 1, false, true) : Promise.resolve(),
      propertyValueFetchedRef.current ? fetchPropertyValue(cancelledRef, true) : Promise.resolve(),
    ]);
  }, [homeId, fetchHealthScore, fetchChecklist, fetchBillTrends, fetchTimeline, fetchPropertyValue, invalidateHealthCache]);

  return {
    healthScore,
    healthLoading,
    checklist,
    checklistLoading,
    billTrends,
    billTrendsLoading,
    timeline,
    timelinePage,
    timelineHasMore,
    timelineLoading,
    propertyValue,
    propertyValueLoading,
    seasonTransition,
    clearSeasonTransition,
    refreshAll,
    refreshHealthScore,
    generateChecklist,
    setBillBenchmarkOptIn,
    completeChecklistItem,
    skipChecklistItem,
    loadMoreTimeline,
    ensureBillTrends,
    ensurePropertyValue,
    ensureTimeline,
  };
}
