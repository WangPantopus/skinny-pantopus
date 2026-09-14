'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { RemovalController } from './RemovalController';
import type { RemovalInput, RemovalDraft, RemovalContext } from './removalModel';

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
      setView({ ...empty, blocked: true, lifetime: generation.current, error: 'Your session changed. Reopen recovery to check the original removal.' });
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
    const open = async () => {
      retire();
      if (disposed || document.visibilityState === 'hidden') return;
      const revision = generation.current;
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
          error: 'Protected removal recovery could not be opened. Your saved action is kept. Reopen recovery to try again.' });
      }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) void open(); };
    const session = () => { retire(); queueMicrotask(() => { if (!disposed) void open(); }); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire);
    window.addEventListener('pageshow', visibility); window.addEventListener('focus', visibility);
    document.addEventListener('visibilitychange', visibility); void open();
    return () => {
      disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', retire); window.removeEventListener('pageshow', visibility);
      window.removeEventListener('focus', visibility); document.removeEventListener('visibilitychange', visibility);
    };
  }, [selectionKey, reload, publish]);
  const run = async <T,>(action: (current: RemovalController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (generation.current !== view.lifetime || !current?.current()) return;
    readGeneration.current++; setRoster({ state: 'unchecked' }); setView(previous => ({ ...previous, busy: true, error: '' }));
    try {
      const result = await action(current);
      if (controller.current === current && current.current()) { publish(current); return result; }
    } catch (error) { publish(current, error instanceof Error ? error.message : 'The removal result could not be confirmed. Reopen recovery.'); }
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
