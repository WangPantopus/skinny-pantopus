'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { RemovalController } from './RemovalController';
import type { RemovalInput, RemovalDraft, RemovalContext } from './removalModel';
import { RETURN_REFRESH_MS } from '../returnRefresh';

interface View {
  ready: boolean; busy: boolean; error: string; pending: RemovalDraft | null; canAcknowledge: boolean;
  blocked: boolean; context: RemovalContext | null; lifetime: number; accountLabel: string; actorId: string | null;
}
interface Roster { state: 'unchecked' | 'loading' | 'checked' | 'unavailable'; listed?: boolean; input?: RemovalInput }
const empty: View = { ready: false, busy: false, error: '', pending: null, canAcknowledge: false,
  blocked: false, context: null, lifetime: 0, accountLabel: '', actorId: null };
export function useRemoval(selectionKey: string) {
  const controller = useRef<RemovalController | null>(null), generation = useRef(0), readGeneration = useRef(0);
  const [view, setView] = useState<View>(empty), [reload, setReload] = useState(0);
  const [roster, setRoster] = useState<Roster>({ state: 'unchecked' });
  const publish = useCallback((current: RemovalController, error = '') => {
    if (controller.current !== current) return;
    if (!current.current()) {
      readGeneration.current++; setRoster({ state: 'unchecked' });
      setView({ ...empty, blocked: true, lifetime: generation.current, error: 'Your sign-in changed. Reload to check your last removal.' });
      return;
    }
    setView({ ready: current.opened, busy: false, error, pending: current.pending, canAcknowledge: current.canAcknowledge,
      blocked: current.needsReload, context: current.context, lifetime: generation.current, accountLabel: current.accountLabel, actorId: current.actorId });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => {
      generation.current++; readGeneration.current++; controller.current?.retire(); controller.current = null;
      setView({ ...empty, lifetime: generation.current }); setRoster({ state: 'unchecked' });
    };
    let lastOpen = 0;
    const open = async () => {
      retire();
      if (disposed) return;
      const revision = generation.current; lastOpen = Date.now();
      let current: RemovalController | null = null;
      try {
        current = new RemovalController(); controller.current = current; await current.open();
        if (disposed || revision !== generation.current) return;
        if (current.pending) await current.recover('status');
        publish(current);
      } catch (error) {
        if (disposed || revision !== generation.current) return;
        if (current?.opened) publish(current, error instanceof Error ? error.message : 'The original removal could not be checked.');
        else setView({ ...empty, blocked: true, lifetime: generation.current,
          error: 'Couldn’t open your removals. Anything unfinished is kept. Reload to try again.' });
      }
    };
    // Coming back keeps what the page shows, including a removal you're reviewing: submitting checks it again
    // on the server. A changed sign-in opens it again at once; a page that couldn't open tries again at most
    // every 30 s.
    const resume = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      const current = controller.current;
      if (current && !current.current()) { void open(); return; }
      if (current?.opened || Date.now() - lastOpen < RETURN_REFRESH_MS) return;
      void open();
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) void open(); };
    const session = () => { retire(); queueMicrotask(() => { if (!disposed) void open(); }); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire);
    window.addEventListener('pageshow', pageshow); window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume); void open();
    return () => {
      disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', retire); window.removeEventListener('pageshow', pageshow);
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
    };
  }, [selectionKey, reload, publish]);
  const run = async <T,>(action: (current: RemovalController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (generation.current !== view.lifetime || !current?.current()) return;
    readGeneration.current++; setRoster({ state: 'unchecked' }); setView(previous => ({ ...previous, busy: true, error: '' }));
    try {
      const result = await action(current);
      if (controller.current === current && current.current()) { publish(current); return result; }
    } catch (error) { publish(current, error instanceof Error ? error.message : 'We couldn’t confirm the result. Check again, try again, or discard this attempt.'); }
  };
  const checkRoster = async (input: RemovalInput) => {
    const current = controller.current, revision = generation.current, read = ++readGeneration.current;
    if (!current?.current() || revision !== view.lifetime) return;
    const isCurrent = () => controller.current === current && current.current() && generation.current === revision && readGeneration.current === read;
    setRoster({ state: 'loading', input });
    try {
      const listed = await current.checkCurrentRoster(input);
      if (isCurrent()) setRoster({ state: 'checked', input, listed });
    } catch {
      if (isCurrent()) setRoster({ state: 'unavailable', input });
      else if (controller.current === current && !current.current()) publish(current);
    }
  };
  return { ...view, roster, reopen: () => setReload(v => v + 1),
    prepare: (input: RemovalInput) => run(c => c.prepare(input)), submit: (decision: string) => run(c => c.submit(decision)),
    cancelReview: () => { const c = controller.current; if (c?.current()) { c.cancelReview(); publish(c); } },
    recover: (action: 'status' | 'retry' | 'cancel', requestId: string) => run(c => c.recover(action, requestId)),
    acknowledge: (requestId: string) => run(c => c.acknowledge(requestId)), checkRoster };
}
