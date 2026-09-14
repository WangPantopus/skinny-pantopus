'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { HomeCreationController } from './HomeCreationController';
import type { HomeRequestDraft, HomeCreationInput } from './homeCreationModel';
import type { HomeResidencyInput } from './homeResidencySubmissionModel';

interface View { ready: boolean; busy: boolean; error: string; pending: HomeRequestDraft | null; canAcknowledge: boolean; blocked: boolean; actorId: string | null }
const empty: View = { ready: false, busy: false, error: '', pending: null, canAcknowledge: false, blocked: false, actorId: null };
export function useHomeCreation() {
  const controller = useRef<HomeCreationController | null>(null);
  const generation = useRef(0);
  const [view, setView] = useState<View>(empty);
  const [reload, setReload] = useState(0);
  const publish = useCallback((current: HomeCreationController, error = '') => {
    if (controller.current !== current) return;
    if (!current.current()) { setView({ ...empty, blocked: true, error: 'Your session changed. Reopen this form to recover your saved request.' }); return; }
    setView({ ready: true, busy: false, error, pending: current.pending, canAcknowledge: current.canAcknowledge,
      blocked: current.needsReload, actorId: current.actorId });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => { generation.current++; controller.current?.retire(); controller.current = null; setView(empty); };
    const open = async () => {
      retire();
      if (disposed || document.visibilityState === 'hidden') return;
      const revision = generation.current;
      let current: HomeCreationController | null = null;
      try {
        current = new HomeCreationController(); controller.current = current;
        await current.open();
        if (disposed || revision !== generation.current) return;
        if (current.pending) {
          try { await current.recover('status'); } catch (error) { publish(current, error instanceof Error ? error.message : 'Reopen recovery to try again.'); return; }
        }
        publish(current);
      } catch {
        if (!disposed && revision === generation.current) setView({ ...empty, blocked: true,
          error: 'Protected Home recovery could not be opened. Your saved request is kept. Reopen recovery to try again.' });
      }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else void open(); };
    const session = () => { retire(); void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) session(); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire);
    window.addEventListener('pageshow', visibility); document.addEventListener('visibilitychange', visibility);
    void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('pagehide', retire); window.removeEventListener('pageshow', visibility); document.removeEventListener('visibilitychange', visibility); };
  }, [reload, publish]);

  const run = async <T,>(action: (current: HomeCreationController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (!current?.current()) return;
    setView(previous => ({ ...previous, busy: true, error: '' }));
    try { const result = await action(current); if (controller.current === current && current.current()) { publish(current); return result; } }
    catch (error) { publish(current, error instanceof Error ? error.message : 'The request could not be confirmed. Reopen recovery.'); }
  };
  return { ...view, reopen: () => setReload(value => value + 1),
    submit: (input: HomeCreationInput) => run(current => current.submit(input)),
    submitResidency: (homeId: string, input: HomeResidencyInput) => run(current => current.submitResidency(homeId, input)),
    recover: (action: 'status' | 'retry' | 'cancel') => run(current => current.recover(action)),
    acknowledge: () => run(current => current.acknowledge()) };
}
