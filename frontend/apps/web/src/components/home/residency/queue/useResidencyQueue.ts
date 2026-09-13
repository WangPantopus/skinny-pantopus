'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { QueueController } from './QueueController';
import { queueError, type QueueClaim } from './queueModel';

interface View { homeId: string; phase: 'loading' | 'ready' | 'error'; claims: QueueClaim[]; error: string }
const empty = (homeId: string): View => ({ homeId, phase: 'loading', claims: [], error: '' });
export function useResidencyQueue(homeId: string, enabled = true) {
  const [view, setView] = useState<View>(() => empty(homeId)), [reload, setReload] = useState(0);
  const controller = useRef<QueueController | null>(null), generation = useRef(0);
  const retire = useCallback(() => {
    generation.current++; controller.current?.retire(); controller.current = null; setView(empty(homeId));
  }, [homeId]);
  const refresh = useCallback(() => { retire(); setReload(value => value + 1); }, [retire]);
  useEffect(() => {
    let disposed = false;
    const open = async () => {
      retire(); if (disposed || !enabled || document.visibilityState === 'hidden') return;
      const revision = generation.current;
      try {
        const current = new QueueController(homeId); controller.current = current; await current.open();
        if (!disposed && revision === generation.current && controller.current === current && current.current() && current.ready)
          setView({ homeId, phase: 'ready', claims: structuredClone(current.claims), error: '' });
      } catch (error) {
        if (!disposed && revision === generation.current) setView({ ...empty(homeId), phase: 'error', error: queueError(error) });
      }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else void open(); };
    const session = () => { retire(); queueMicrotask(() => { if (!disposed) void open(); }); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) session(); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('focus', visibility); window.addEventListener('pageshow', visibility);
    window.addEventListener('pagehide', retire); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility); void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('focus', visibility);
      window.removeEventListener('pageshow', visibility); window.removeEventListener('pagehide', retire);
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility); };
  }, [homeId, enabled, reload, retire]);
  // Props can change before effects run; never render a previous Home's rows.
  const currentView = enabled && view.homeId === homeId ? view : empty(homeId);
  return { ...currentView, refresh, retire };
}
