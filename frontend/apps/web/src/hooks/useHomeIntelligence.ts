'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@pantopus/api';
import type { HomeHealthScore, SeasonalChecklist, BillTrendData, PropertyValueData, HomeTimelineItem } from '@pantopus/types';
import { validBillTrendData } from '@/components/home/validBillTrendData';

type SummaryKey = 'health' | 'checklist' | 'bills' | 'property' | 'timeline';
const HEALTH_READ_PERMISSIONS = ['home.view', 'maintenance.view', 'finance.view', 'members.view', 'docs.view', 'sensitive.view'];

/** A read belongs to one mounted Home/account and cannot outlive a newer read. */
function useSummaryRead<T>(homeId: string | undefined, request: () => Promise<T>, name: string, onDenied: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lifetime = useRef({ retired: true });
  const revision = useRef(0);
  useEffect(() => {
    const opening = { retired: false }; lifetime.current = opening;
    return () => { opening.retired = true; revision.current++; };
  }, [homeId]);
  const capture = useCallback(() => {
    const opening = lifetime.current, token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    return () => !opening.retired && opening === lifetime.current && !!homeId && !!token
      && token === api.getAuthToken() && origin === api.getApiBaseUrl()
      && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) && document.visibilityState !== 'hidden';
  }, [homeId]);
  const load = useCallback(async (read = request) => {
    const current = capture(), sequence = ++revision.current;
    if (!current()) return;
    const active = () => current() && sequence === revision.current;
    setLoading(true); setError(null);
    try {
      const result = await read();
      if (active()) setData(result);
    } catch (failure) {
      if (active()) {
        setData(null); setError(`${name} could not be loaded. Retry to check current information.`);
        if ((failure as { statusCode?: number })?.statusCode === 403) onDenied();
      }
    } finally { if (active()) setLoading(false); }
  }, [request, capture, name, onDenied]);
  const failAction = useCallback((message: string) => { revision.current++; setData(null); setLoading(false); setError(message); }, []);
  return { data, loading, error, load, capture, failAction };
}

export function useHomeIntelligence(homeId: string | undefined, can: (permission: string) => boolean, onDenied: () => void) {
  const [billCurrency, setBillCurrency] = useState('USD');
  const readHealth = useCallback(async () => {
    const result = await api.homeProfile.getHomeHealthScore(homeId!, { force: true });
    if (!result || !Number.isFinite(result.score) || !result.breakdown) throw new Error('Invalid health response');
    return result;
  }, [homeId]);
  const readChecklist = useCallback(async () => {
    const result = await api.homeProfile.getSeasonalChecklist(homeId!);
    if (!result || !Array.isArray(result.items) || !result.season?.key || !result.progress) throw new Error('Invalid checklist response');
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
    if (!result || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean') throw new Error('Invalid timeline response');
    return { items: result.items, page, hasMore: result.hasMore };
  }, [homeId]);
  const health = useSummaryRead<HomeHealthScore>(homeId, readHealth, 'Home health', onDenied);
  const checklist = useSummaryRead<SeasonalChecklist>(homeId, readChecklist, 'Seasonal checklist', onDenied);
  const bills = useSummaryRead<BillTrendData>(homeId, readBills, 'Bill trends', onDenied);
  const property = useSummaryRead<PropertyValueData>(homeId, readProperty, 'Property information', onDenied);
  const timeline = useSummaryRead<{ items: HomeTimelineItem[]; page: number; hasMore: boolean }>(homeId, readTimelinePage, 'Home activity', onDenied);
  const { load: loadHealth } = health, { load: loadChecklist } = checklist;
  const { load: loadBills } = bills, { load: loadProperty } = property, { load: loadTimeline } = timeline;
  const canReadHealth = HEALTH_READ_PERMISSIONS.every(can), canReadBills = can('finance.view'), canReadTimeline = can('members.manage');
  const deferred = useRef({ bills: false, property: false, timeline: false });
  const actionBusy = useRef({ checklist: false, bills: false });
  const [checklistBusy, setChecklistBusy] = useState(false), [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const lastSeason = useRef<string | null>(null);
  const [seasonTransition, setSeasonTransition] = useState<{ from: string; toKey: string; toLabel: string } | null>(null);

  useEffect(() => { deferred.current = { bills: false, property: false, timeline: false }; }, [homeId]);
  useEffect(() => { if (canReadBills && deferred.current.bills) void loadBills(); }, [canReadBills, loadBills]);
  useEffect(() => { if (canReadHealth) void loadHealth(); void loadChecklist(); }, [canReadHealth, loadHealth, loadChecklist]);
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
    if (!deferred.current.property) { deferred.current.property = true; void loadProperty(); }
  }, [loadProperty]);
  const ensureTimeline = useCallback(() => {
    if (canReadTimeline && !deferred.current.timeline) { deferred.current.timeline = true; void loadTimeline(); }
  }, [canReadTimeline, loadTimeline]);
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
  const refreshAll = useCallback(async () => {
    await Promise.all([loadChecklist(), ...(canReadHealth ? [loadHealth()] : []),
      ...(deferred.current.bills && canReadBills ? [loadBills()] : []), ...(deferred.current.property ? [loadProperty()] : []),
      ...(deferred.current.timeline && canReadTimeline ? [loadTimeline()] : [])]);
  }, [canReadHealth, canReadBills, canReadTimeline, loadChecklist, loadHealth, loadBills, loadProperty, loadTimeline]);
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
    refreshHealthScore: () => reloadSummary('health'), generateChecklist: () => reloadSummary('checklist'),
    setBillBenchmarkOptIn, completeChecklistItem: (id: string) => changeChecklist(id, 'completed'),
    skipChecklistItem: (id: string) => changeChecklist(id, 'skipped'), loadMoreTimeline,
    ensureBillTrends, ensurePropertyValue, ensureTimeline,
  };
}
