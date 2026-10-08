'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { QueueController } from './QueueController';
import { queueError, type QueueClaim } from './queueModel';
import { RETURN_REFRESH_MS, transientFailure } from '../../returnRefresh';

interface View { homeId: string; owner: QueueController | null; phase: 'loading' | 'ready' | 'error'; claims: QueueClaim[]; error: string }
const empty = (homeId: string): View => ({ homeId, owner: null, phase: 'loading', claims: [], error: '' });
export function useResidencyQueue(homeId: string, enabled = true) {
  const [view, setView] = useState<View>(() => empty(homeId)), [reload, setReload] = useState(0);
  const controller = useRef<QueueController | null>(null), generation = useRef(0);
  const retire = useCallback(() => {
    generation.current++; controller.current?.retire(); controller.current = null; setView(empty(homeId));
  }, [homeId]);
  const refresh = useCallback(() => { retire(); setReload(value => value + 1); }, [retire]);
  useEffect(() => {
    let disposed = false, lastRead = 0, reading = false;
    const show = (current: QueueController) => setView({ homeId, owner: current, phase: 'ready', claims: structuredClone(current.claims), error: '' });
    const open = async () => {
      retire(); if (disposed || !enabled) return;
      const revision = generation.current; lastRead = Date.now();
      try {
        const current = new QueueController(homeId); controller.current = current; await current.open();
        if (!disposed && revision === generation.current && controller.current === current && current.current() && current.ready) show(current);
      } catch (error) {
        if (!disposed && revision === generation.current) setView({ ...empty(homeId), phase: 'error', error: queueError(error) });
      }
    };
    // Coming back keeps the claims on screen and re-reads them behind the scenes at most every 30 s; the new
    // list replaces them only once it arrives. A network or server blip keeps them, a refusal shows why. A
    // changed sign-in, or a queue left with only an error, opens it again from the start.
    const recheck = async (shown: QueueController) => {
      const revision = generation.current, next = new QueueController(homeId);
      lastRead = Date.now(); reading = true;
      try {
        await next.open();
        if (disposed || revision !== generation.current || controller.current !== shown || !next.current() || !next.ready) { next.retire(); return; }
        shown.retire(); controller.current = next; show(next);
      } catch (error) {
        next.retire();
        if (disposed || revision !== generation.current || controller.current !== shown || transientFailure(error)) return;
        retire(); setView({ ...empty(homeId), phase: 'error', error: queueError(error) });
      } finally { reading = false; }
    };
    const resume = () => {
      if (disposed || !enabled || document.visibilityState === 'hidden') return;
      const shown = controller.current;
      if (shown && !shown.current()) { void open(); return; }
      if (reading || Date.now() - lastRead < RETURN_REFRESH_MS) return;
      if (shown?.ready) void recheck(shown); else void open();
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
  }, [homeId, enabled, reload, retire]);
  // A new Home/session can render before effect cleanup. Only the controller
  // that loaded these rows may authorize their display or a later click.
  const current = useCallback(() => enabled && view.homeId === homeId && view.phase === 'ready'
    && view.owner === controller.current && view.owner?.current() === true, [enabled, homeId, view]);
  const canReview = useCallback((claimId: string) => current() && view.claims.some(claim => claim.id === claimId), [current, view.claims]);
  const currentView = enabled && view.homeId === homeId && (view.phase !== 'ready' || current()) ? view : empty(homeId);
  return { ...currentView, refresh, retire, canReview };
}
