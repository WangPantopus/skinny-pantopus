'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { PostalController } from './PostalController';
import type { MailingAddress, PostalDraft, PostalStatus } from './postcardModel';
interface View { ready: boolean; busy: boolean; error: string; pending: PostalDraft | null; canAcknowledge: boolean;
  blocked: boolean; status: PostalStatus | null; progress: api.homes.PersonalResidencyProgress | null; lifetime: number }
const empty: View = { ready: false, busy: false, error: '', pending: null, canAcknowledge: false, blocked: false, status: null, progress: null, lifetime: 0 };
export function usePostalVerification(homeId: string) {
  const controller = useRef<PostalController | null>(null), generation = useRef(0);
  const [view, setView] = useState<View>(empty), [reload, setReload] = useState(0);
  const publish = useCallback((current: PostalController, error = '') => {
    if (controller.current !== current) return;
    if (!current.current()) { setView({ ...empty, blocked: true, lifetime: generation.current,
      error: 'Your session changed. Reopen recovery to check the original request.' }); return; }
    setView({ ready: current.opened, busy: false, error, pending: current.pending, canAcknowledge: current.canAcknowledge,
      blocked: current.needsReload, status: current.status, progress: current.progress, lifetime: generation.current });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => { generation.current++; controller.current?.retire(); controller.current = null; setView({ ...empty, lifetime: generation.current }); };
    const open = async () => {
      retire(); if (disposed || document.visibilityState === 'hidden') return;
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
        if (current?.opened) publish(current, current.pending && error instanceof Error ? error.message : 'Mail status could not be checked. Retry to check current access and mailing.');
        else setView({ ...empty, blocked: true, lifetime: generation.current,
          error: 'Protected postal recovery could not be opened. Your saved request is kept. Reopen recovery to try again.' });
      }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) void open(); };
    const unsubscribe = api.onTokenChange(open);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', visibility);
    window.addEventListener('focus', visibility); document.addEventListener('visibilitychange', visibility); void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', visibility); window.removeEventListener('focus', visibility); document.removeEventListener('visibilitychange', visibility); };
  }, [homeId, reload, publish]);
  const run = async <T,>(action: (current: PostalController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (!current?.current()) return;
    setView(previous => ({ ...previous, busy: true, error: '', status: null, progress: null }));
    try { const result = await action(current); if (controller.current === current && current.current()) { publish(current); return result; } }
    catch (error) { publish(current, error instanceof Error ? error.message : 'The postal request could not be confirmed. Reopen recovery.'); }
  };
  return { ...view, reopen: () => setReload(value => value + 1),
    requestMail: (address: MailingAddress) => run(current => current.requestMail(address)), resumeMail: () => run(current => current.resumeMail()),
    verify: (code: string) => run(current => current.verify(code)), refresh: () => run(current => current.refresh()),
    recover: (action: 'status' | 'retry' | 'cancel') => run(current => current.recover(action)),
    acknowledge: () => run(async current => { const result = await current.acknowledge(); await current.refresh(); return result; }) };
}
