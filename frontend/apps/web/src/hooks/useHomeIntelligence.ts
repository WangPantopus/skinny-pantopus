'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { HomeHealthScore, SeasonalChecklist, BillTrendData, PropertyValueData, HomeTimelineItem } from '@pantopus/types';
import { validBillTrendData } from '@/components/home/validBillTrendData';
import { dropHomeSummaryCopy, keepHomeSummaryCopy, readHomeSummaryCopy, type HomeSummaryName } from '@/components/home/homeDashboardCopy';
import { onSyncTopic, touchesHome } from '@/lib/syncSignals';

type SummaryKey = 'health' | 'checklist' | 'bills' | 'property' | 'timeline';
const HEALTH_READ_PERMISSIONS = ['home.view', 'maintenance.view', 'finance.view', 'members.view', 'docs.view', 'sensitive.view'];
// A summary card read less than this long ago isn't asked again on coming back (contract §4, Homes and household).
const SUMMARY_FRESH_MS = 2 * 60 * 1000;

/**
 * A read belongs to one mounted Home/account and cannot outlive a newer read. With `kept`, the card
 * is kept beside the dashboard's copy while `allowed` (owners and household roles without an end
 * date): coming back shows it at once, and a refresh replaces it without a loading state. A failed
 * refresh keeps it, unless the server refused (403/404).
 */
function useSummaryRead<T>(homeId: string | undefined, request: () => Promise<T>, name: string, onDenied: () => void,
  kept?: { name: HomeSummaryName; allowed: boolean }) {
  const queryClient = useQueryClient();
  const keptName = kept?.name;
  const [initial] = useState(() => (kept?.allowed && homeId && keptName ? readHomeSummaryCopy<T>(queryClient, homeId, keptName) : null));
  const [data, setData] = useState<T | null>(initial?.data ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const shown = useRef<T | null>(data);
  shown.current = data;
  const allowed = useRef(kept?.allowed === true);
  allowed.current = kept?.allowed === true;
  // Read within the fresh window: the first load on this visit is skipped.
  const freshUntil = useRef(initial ? initial.at + SUMMARY_FRESH_MS : 0);
  const lifetime = useRef({ retired: true });
  const revision = useRef(0);
  useEffect(() => {
    const opening = { retired: false }; lifetime.current = opening;
    return () => { opening.retired = true; revision.current++; };
  }, [homeId]);
  const capture = useCallback(() => {
    const opening = lifetime.current, token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    // A hidden tab doesn't make a read stale (a card read while hidden would otherwise stay loading); an
    // account, API origin or session change does.
    return () => !opening.retired && opening === lifetime.current && !!homeId && !!token
      && token === api.getAuthToken() && origin === api.getApiBaseUrl()
      && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  }, [homeId]);
  const load = useCallback(async (read = request) => {
    const current = capture(), sequence = ++revision.current;
    if (!current()) return;
    const active = () => current() && sequence === revision.current;
    // A card already on screen refreshes quietly (contract §3: no indicator for background refreshes).
    if (shown.current === null) setLoading(true);
    setError(null);
    try {
      const result = await read();
      if (active()) {
        setData(result);
        if (keptName && homeId) {
          if (allowed.current) keepHomeSummaryCopy(queryClient, homeId, keptName, result);
          else dropHomeSummaryCopy(queryClient, homeId, keptName);
        }
      }
    } catch (failure) {
      if (active()) {
        const status = (failure as { statusCode?: number })?.statusCode;
        if (shown.current === null || status === 403 || status === 404) {
          setData(null); setError(`${name} could not be loaded. Retry to check current information.`);
          if (keptName && homeId) dropHomeSummaryCopy(queryClient, homeId, keptName);
        }
        if (status === 403) onDenied();
      }
    } finally { if (active()) setLoading(false); }
  }, [request, capture, name, onDenied, keptName, homeId, queryClient]);
  /** The first load of a visit: skipped while the kept card is fresh. */
  const open = useCallback(() => {
    if (Date.now() < freshUntil.current) { freshUntil.current = 0; return Promise.resolve(); }
    freshUntil.current = 0;
    return load();
  }, [load]);
  const failAction = useCallback((message: string) => {
    revision.current++; setData(null); setLoading(false); setError(message);
    if (keptName && homeId) dropHomeSummaryCopy(queryClient, homeId, keptName);
  }, [keptName, homeId, queryClient]);
  return { data, loading, error, load, open, capture, failAction };
}

export function useHomeIntelligence(homeId: string | undefined, can: (permission: string) => boolean, onDenied: () => void, keepsCopy = false) {
  const [billCurrency, setBillCurrency] = useState('USD');
  const readHealth = useCallback(async () => {
    const result = await api.homeProfile.getHomeHealthScore(homeId!, { force: true });
    // The ring renders topIssue and the action's label/route directly; a non-string there would take down the page.
    const action = result?.topAction;
    if (!result || !Number.isFinite(result.score) || !result.breakdown
      || (result.topIssue != null && typeof result.topIssue !== 'string')
      || (action != null && (typeof action.label !== 'string' || typeof action.route !== 'string'))) throw new Error('Invalid health response');
    return result;
  }, [homeId]);
  const readChecklist = useCallback(async () => {
    const result = await api.homeProfile.getSeasonalChecklist(homeId!);
    // Each row must be renderable (the card reads id, title, status and description), or one bad row would take down the page.
    if (!result || !Array.isArray(result.items) || !result.season?.key || !result.progress
      || result.items.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string'
        || typeof item.status !== 'string' || (item.description != null && typeof item.description !== 'string'))) throw new Error('Invalid checklist response');
    return result;
  }, [homeId]);
  const readBills = useCallback(async () => {
    const result = await api.homeProfile.getBillTrends(homeId!, billCurrency);
    if (!validBillTrendData(result, billCurrency)) throw new Error('Invalid bill response');
    return result;
  }, [homeId, billCurrency]);
  const readProperty = useCallback(async () => {
    const result = await api.homeProfile.getPropertyValue(homeId!);
    if (!result || !Object.hasOwn(result, 'estimated_value') || result.source === 'error') throw new Error('Invalid property response');
    return result;
  }, [homeId]);
  const readTimelinePage = useCallback(async (page = 1) => {
    const result = await api.homeProfile.getHomeTimeline(homeId!, page, 20);
    // Each row must be renderable, or one malformed row would take down the whole dashboard.
    if (!result || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean'
      || result.items.some(item => !item || typeof item.id !== 'string' || typeof item.action !== 'string'
        || !Number.isFinite(Date.parse(item.created_at)))) throw new Error('Invalid timeline response');
    return { items: result.items, page, hasMore: result.hasMore };
  }, [homeId]);
  const health = useSummaryRead<HomeHealthScore>(homeId, readHealth, 'Home health', onDenied, { name: 'health', allowed: keepsCopy });
  const checklist = useSummaryRead<SeasonalChecklist>(homeId, readChecklist, 'Seasonal checklist', onDenied, { name: 'checklist', allowed: keepsCopy });
  // Bill trends come from bills, which are never kept (contract §5).
  const bills = useSummaryRead<BillTrendData>(homeId, readBills, 'Bill trends', onDenied);
  const property = useSummaryRead<PropertyValueData>(homeId, readProperty, 'Property information', onDenied, { name: 'property', allowed: keepsCopy });
  const timeline = useSummaryRead<{ items: HomeTimelineItem[]; page: number; hasMore: boolean }>(homeId, readTimelinePage, 'Home activity', onDenied, { name: 'timeline', allowed: keepsCopy });
  const { load: loadHealth, open: openHealth } = health, { load: loadChecklist, open: openChecklist } = checklist;
  const { load: loadBills } = bills, { load: loadProperty, open: openProperty } = property, { load: loadTimeline, open: openTimeline } = timeline;
  const canReadHealth = HEALTH_READ_PERMISSIONS.every(can), canReadBills = can('finance.view'), canReadTimeline = can('members.manage');
  const deferred = useRef({ bills: false, property: false, timeline: false });
  const actionBusy = useRef({ checklist: false, bills: false });
  const [checklistBusy, setChecklistBusy] = useState(false), [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const lastSeason = useRef<string | null>(null);
  const [seasonTransition, setSeasonTransition] = useState<{ from: string; toKey: string; toLabel: string } | null>(null);

  useEffect(() => { deferred.current = { bills: false, property: false, timeline: false }; }, [homeId]);
  useEffect(() => { if (canReadBills && deferred.current.bills) void loadBills(); }, [canReadBills, loadBills]);
  useEffect(() => { if (canReadHealth) void openHealth(); void openChecklist(); }, [canReadHealth, openHealth, openChecklist]);
  useEffect(() => {
    const season = checklist.data?.season;
    if (!season) return;
    if (lastSeason.current && lastSeason.current !== season.key) setSeasonTransition({ from: lastSeason.current, toKey: season.key, toLabel: season.label });
    lastSeason.current = season.key;
  }, [checklist.data]);
  const ensureBillTrends = useCallback(() => {
    if (canReadBills && !deferred.current.bills) { deferred.current.bills = true; void loadBills(); }
  }, [canReadBills, loadBills]);
  const ensurePropertyValue = useCallback(() => {
    if (!deferred.current.property) { deferred.current.property = true; void openProperty(); }
  }, [openProperty]);
  const ensureTimeline = useCallback(() => {
    if (canReadTimeline && !deferred.current.timeline) { deferred.current.timeline = true; void openTimeline(); }
  }, [canReadTimeline, openTimeline]);
  const reloadSummary = useCallback(async (key: SummaryKey) => {
    if (key === 'health' && canReadHealth) await loadHealth();
    if (key === 'checklist') await loadChecklist();
    if (key === 'bills' && canReadBills) await loadBills();
    if (key === 'property') await loadProperty();
    if (key === 'timeline' && canReadTimeline) await loadTimeline();
  }, [canReadHealth, canReadBills, canReadTimeline, loadHealth, loadChecklist, loadBills, loadProperty, loadTimeline]);
  const changeChecklist = async (itemId: string, status: 'completed' | 'skipped') => {
    const current = checklist.capture();
    if (!current() || !can('home.edit') || actionBusy.current.checklist || checklist.error || checklist.loading) return;
    actionBusy.current.checklist = true; setChecklistBusy(true);
    try {
      await api.homeProfile.updateChecklistItem(homeId!, itemId, status);
      if (!current()) return;
      await Promise.all([loadChecklist(), ...(canReadHealth ? [loadHealth()] : []), ...(deferred.current.timeline && canReadTimeline ? [loadTimeline()] : [])]);
    } catch (failure) {
      if (current()) {
        checklist.failAction('The checklist change was not confirmed. Reload the current checklist before trying again.');
        if ((failure as { statusCode?: number })?.statusCode === 403) onDenied();
      }
    } finally { actionBusy.current.checklist = false; if (current()) setChecklistBusy(false); }
  };
  const setBillBenchmarkOptIn = async (optedIn: boolean) => {
    const current = bills.capture();
    if (!current() || !can('home.edit') || actionBusy.current.bills || bills.error || bills.loading) return;
    actionBusy.current.bills = true; setBenchmarkBusy(true);
    try {
      await api.homeProfile.setBillBenchmarkOptIn(homeId!, optedIn);
      if (current()) await loadBills();
    } catch (failure) {
      if (current()) {
        bills.failAction('The sharing preference was not confirmed. Reload current bill trends before trying again.');
        if ((failure as { statusCode?: number })?.statusCode === 403) onDenied();
      }
    } finally { actionBusy.current.bills = false; if (current()) setBenchmarkBusy(false); }
  };
  const loadMoreTimeline = async () => {
    const previous = timeline.data;
    if (!previous?.hasMore || timeline.loading) return;
    await loadTimeline(async () => { const next = await readTimelinePage(previous.page + 1);
      return { ...next, items: [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.id === item.id))] }; });
  };
  const clearSeasonTransition = useCallback(() => setSeasonTransition(null), []);
  // The server says this Home changed (contract §8): the cards on screen read again.
  const refreshShown = useRef<() => void>(() => {});
  const refreshAll = useCallback(async () => {
    await Promise.all([loadChecklist(), ...(canReadHealth ? [loadHealth()] : []),
      ...(deferred.current.bills && canReadBills ? [loadBills()] : []), ...(deferred.current.property ? [loadProperty()] : []),
      ...(deferred.current.timeline && canReadTimeline ? [loadTimeline()] : [])]);
  }, [canReadHealth, canReadBills, canReadTimeline, loadChecklist, loadHealth, loadBills, loadProperty, loadTimeline]);
  refreshShown.current = () => { void refreshAll(); };
  useEffect(() => {
    if (!homeId) return undefined;
    return onSyncTopic((topic) => { if (touchesHome(topic, homeId)) refreshShown.current(); });
  }, [homeId]);
  return {
    healthScore: health.data, healthLoading: health.loading,
    checklist: checklist.data, checklistLoading: checklist.loading, checklistBusy,
    billCurrency, setBillCurrency,
    billTrends: bills.data, billTrendsLoading: bills.loading, benchmarkBusy,
    propertyValue: property.data, propertyValueLoading: property.loading,
    timeline: timeline.data?.items || [], timelinePage: timeline.data?.page || 1,
    timelineHasMore: timeline.data?.hasMore || false, timelineLoading: timeline.loading,
    errors: { health: health.error, checklist: checklist.error, bills: bills.error, property: property.error, timeline: timeline.error },
    canReadHealth, canReadBills, canReadTimeline, reloadSummary,
    seasonTransition, clearSeasonTransition, refreshAll,
    refreshHealthScore: () => reloadSummary('health'),
    // The score counts the checklist, so it reloads once the items exist.
    generateChecklist: async () => { await reloadSummary('checklist'); await reloadSummary('health'); },
    setBillBenchmarkOptIn, completeChecklistItem: (id: string) => changeChecklist(id, 'completed'),
    skipChecklistItem: (id: string) => changeChecklist(id, 'skipped'), loadMoreTimeline,
    ensureBillTrends, ensurePropertyValue, ensureTimeline,
  };
}
