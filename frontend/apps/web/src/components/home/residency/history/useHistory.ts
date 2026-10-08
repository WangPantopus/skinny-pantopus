'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { HistoryController } from './HistoryController';
import { historyError, type HistoryItem } from './historyModel';
import { RETURN_REFRESH_MS } from '../../returnRefresh';

interface View { phase: 'loading' | 'ready' | 'error'; items: HistoryItem[]; detail: HistoryItem | null; hasMore: boolean; busy: boolean; error: string }
const empty: View = { phase: 'loading', items: [], detail: null, hasMore: false, busy: false, error: '' };
export function useHistory(homeId: string, receiptId: string | null) {
  const [view, setView] = useState<View>(empty), [reload, setReload] = useState(0);
  const controller = useRef<HistoryController | null>(null), generation = useRef(0), loadingMore = useRef(false);
  const publish = useCallback((current: HistoryController) => {
    if (controller.current !== current || !current.current()) return;
    setView({ phase: 'ready', items: structuredClone(current.items), detail: structuredClone(current.detail),
      hasMore: !!current.nextCursor, busy: false, error: '' });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => { generation.current++; loadingMore.current = false; controller.current?.retire(); controller.current = null; setView(empty); };
    let lastOpen = 0;
    const open = async () => {
      retire(); if (disposed) return;
      const revision = generation.current; lastOpen = Date.now();
      try {
        const current = new HistoryController(homeId, receiptId); controller.current = current; await current.open();
        if (!disposed && generation.current === revision) publish(current);
      } catch (error) {
        if (!disposed && generation.current === revision) setView({ ...empty, phase: 'error', error: historyError(error) });
      }
    };
    // Coming back keeps the decisions and the pages already loaded (Refresh decisions reads them again). A
    // changed sign-in opens the history again at once; a page left with only an error tries again at most
    // every 30 s.
    const resume = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      const current = controller.current;
      if (current && !current.current()) { void open(); return; }
      if (current?.ready || Date.now() - lastOpen < RETURN_REFRESH_MS) return;
      void open();
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void open(); };
    const session = () => { retire(); queueMicrotask(() => { if (!disposed) void open(); }); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) session(); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('focus', resume); window.addEventListener('pageshow', pageshow);
    window.addEventListener('pagehide', retire); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', resume); void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', pageshow); window.removeEventListener('pagehide', retire);
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', resume); };
  }, [homeId, receiptId, reload, publish]);
  const loadMore = async () => {
    const current = controller.current, revision = generation.current;
    if (!current?.current() || loadingMore.current || view.busy || !view.hasMore || view.phase !== 'ready') return;
    loadingMore.current = true;
    setView(previous => ({ ...previous, busy: true, error: '' }));
    try { await current.loadMore(); if (controller.current === current && generation.current === revision) publish(current); }
    catch (error) {
      if (controller.current === current && generation.current === revision) setView({ ...empty, phase: 'error', error: historyError(error) });
    } finally { if (generation.current === revision) loadingMore.current = false; }
  };
  return { ...view, refresh: () => setReload(value => value + 1), loadMore };
}
