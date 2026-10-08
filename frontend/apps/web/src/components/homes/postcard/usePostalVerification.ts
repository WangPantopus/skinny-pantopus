'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { PostalController } from './PostalController';
import type { MailingAddress, PostalDraft, PostalStatus } from './postcardModel';
import { RETURN_REFRESH_MS, transientFailure } from '../../home/returnRefresh';
interface View { ready: boolean; busy: boolean; error: string; pending: PostalDraft | null; canAcknowledge: boolean;
  blocked: boolean; status: PostalStatus | null; progress: api.homes.PersonalResidencyProgress | null; lifetime: number }
const empty: View = { ready: false, busy: false, error: '', pending: null, canAcknowledge: false, blocked: false, status: null, progress: null, lifetime: 0 };
export function usePostalVerification(homeId: string) {
  const controller = useRef<PostalController | null>(null), generation = useRef(0);
  const [view, setView] = useState<View>(empty), [reload, setReload] = useState(0);
  const publish = useCallback((current: PostalController, error = '') => {
    if (controller.current !== current) return;
    if (!current.current()) { setView({ ...empty, blocked: true, lifetime: generation.current,
      error: 'Your sign-in changed. Reload to check your last attempt.' }); return; }
    setView({ ready: current.opened, busy: false, error, pending: current.pending, canAcknowledge: current.canAcknowledge,
      blocked: current.needsReload, status: current.status, progress: current.progress, lifetime: generation.current });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => { generation.current++; controller.current?.retire(); controller.current = null; setView({ ...empty, lifetime: generation.current }); };
    const open = async () => {
      retire(); if (disposed) return;
      const revision = generation.current;
      let current: PostalController | null = null;
      try {
        current = new PostalController(homeId); controller.current = current; await current.open();
        if (disposed || revision !== generation.current) return;
        if (current.pending) await current.recover('status');
        else await current.refresh();
        publish(current);
      } catch (error) {
        if (disposed || revision !== generation.current) return;
        if (current?.opened) publish(current, current.pending && error instanceof Error ? error.message : 'Couldn’t check your postcard status. Reload to try again.');
        else setView({ ...empty, blocked: true, lifetime: generation.current,
          error: 'Couldn’t open mail verification. Anything unfinished is kept. Reload to try again.' });
      }
    };
    // Coming back keeps the address and code being typed and re-reads the postcard status behind the scenes
    // (at most every 30 s; an unfinished attempt is resolved by its own buttons). A refusal, a closed or
    // changed session, an account change or leaving the page opens again from the start.
    let lastReturn = Date.now();
    const resume = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      const current = controller.current;
      if (current && !current.opened) return;
      if (!current || !current.current()) { void open(); return; }
      if (current.pending || Date.now() - lastReturn < RETURN_REFRESH_MS) return;
      lastReturn = Date.now();
      void current.refresh().then(() => publish(current), error => { if (!transientFailure(error) && controller.current === current) void open(); });
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) void open(); };
    const unsubscribe = api.onTokenChange(open);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', pageshow);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume); void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', pageshow); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [homeId, reload, publish]);
  const run = async <T,>(action: (current: PostalController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (!current?.current()) return;
    setView(previous => ({ ...previous, busy: true, error: '', status: null, progress: null }));
    try { const result = await action(current); if (controller.current === current && current.current()) { publish(current); return result; } }
    catch (error) { publish(current, error instanceof Error ? error.message : 'We couldn’t confirm the result. Check again, try again, or discard this attempt.'); }
  };
  return { ...view, reopen: () => setReload(value => value + 1),
    requestMail: (address: MailingAddress) => run(current => current.requestMail(address)), resumeMail: () => run(current => current.resumeMail()),
    verify: (code: string) => run(current => current.verify(code)), refresh: () => run(current => current.refresh()),
    recover: (action: 'status' | 'retry' | 'cancel') => run(current => current.recover(action)),
    acknowledge: () => run(async current => { const result = await current.acknowledge(); await current.refresh(); return result; }) };
}
