'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { InvitationDecisionController } from './InvitationDecisionController';
import type { InvitationDraft, InvitationContext } from './invitationDecisionModel';
import { RETURN_REFRESH_MS } from '../../home/returnRefresh';
interface View { ready: boolean; busy: boolean; error: string; pending: InvitationDraft | null; canAcknowledge: boolean;
  blocked: boolean; context: InvitationContext | null; progress: api.homes.PersonalResidencyProgress | null; lifetime: number; accountLabel: string; canDecide: boolean }
const empty: View = { ready: false, busy: false, error: '', pending: null, canAcknowledge: false, blocked: false, context: null, progress: null, lifetime: 0, accountLabel: '', canDecide: false };
export function useInvitationDecision(token: string) {
  const controller = useRef<InvitationDecisionController | null>(null), generation = useRef(0);
  const [view, setView] = useState<View>(empty), [reload, setReload] = useState(0);
  const publish = useCallback((current: InvitationDecisionController, error = '') => {
    if (controller.current !== current) return;
    if (!current.current()) { setView({ ...empty, blocked: true, lifetime: generation.current,
      error: 'Your sign-in changed. Reload to check your answer.' }); return; }
    setView({ ready: current.opened, busy: false, error, pending: current.pending, canAcknowledge: current.canAcknowledge,
      blocked: current.needsReload, context: current.context, progress: current.progress, lifetime: generation.current, accountLabel: current.accountLabel, canDecide: current.canDecide });
  }, []);
  useEffect(() => {
    let disposed = false;
    const retire = () => { generation.current++; controller.current?.retire(); controller.current = null; setView({ ...empty, lifetime: generation.current }); };
    let lastOpen = 0;
    const open = async () => {
      retire(); if (disposed) return;
      lastOpen = Date.now();
      const revision = generation.current;
      let current: InvitationDecisionController | null = null;
      try {
        current = new InvitationDecisionController(token); controller.current = current; await current.open();
        if (disposed || revision !== generation.current) return;
        if (current.pending) await current.recover('status');
        else await current.refresh();
        publish(current);
      } catch (error) {
        if (disposed || revision !== generation.current) return;
        if (current?.opened) publish(current, error instanceof Error ? error.message : 'Couldn’t check this invitation. Reload to try again.');
        else setView({ ...empty, blocked: true, lifetime: generation.current,
          error: 'Couldn’t open this invitation. Any answer you gave is kept. Reload to try again.' });
      }
    };
    // Coming back keeps what the page shows: answering checks the invitation again on the server, and the
    // expiry timer reopens it when it runs out. A changed sign-in opens it again at once; a page left with
    // only an error tries again at most every 30 s.
    const resume = () => {
      if (disposed || document.visibilityState === 'hidden') return;
      const current = controller.current;
      if (current && !current.current()) { void open(); return; }
      if (current?.context || current?.pending || Date.now() - lastOpen < RETURN_REFRESH_MS) return;
      void open();
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) void open(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) void open(); };
    const session = () => { retire(); queueMicrotask(() => { if (!disposed) void open(); }); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('storage', storage); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', pageshow);
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume); void open();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('storage', storage); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', pageshow); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [token, reload, publish]);
  useEffect(() => {
    const expires = view.context?.preview.invitation.expires_at;
    if (!expires) return;
    const timer = window.setTimeout(() => setReload(value => value + 1), Math.min(2_147_483_647, Math.max(0, Date.parse(expires) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [view.context]);
  const run = async <T,>(action: (current: InvitationDecisionController) => Promise<T>): Promise<T | undefined> => {
    const current = controller.current;
    if (generation.current !== view.lifetime || !current?.current()) return;
    setView(previous => ({ ...previous, busy: true, error: '', context: null, progress: null }));
    try { const result = await action(current); if (controller.current === current && current.current()) { publish(current); return result; } }
    catch (error) { publish(current, error instanceof Error ? error.message : 'We couldn’t confirm your answer. Check again, try again, or discard this attempt.'); }
  };
  return { ...view, isCurrent: (lifetime: number) => generation.current === lifetime && controller.current?.current() === true, reopen: () => setReload(value => value + 1),
    decide: (action: 'accept' | 'decline', expectedDecision: string) => run(current => current.decide(action, expectedDecision)),
    recover: (action: 'status' | 'retry' | 'cancel', expectedRequestId?: string) => run(current => current.recover(action, expectedRequestId)),
    checkAccess: () => run(current => current.checkAccess()),
    openHome: (requestId: string) => run(async current => {
      await current.checkAccess();
      if (current.pending?.request_id !== requestId || current.progress?.current_access !== 'shared') throw new Error('Current household access is unavailable. Your saved decision is kept.');
      const homeId = current.pending.home_id;
      await current.acknowledge(requestId);
      return homeId;
    }),
    acknowledge: (requestId: string) => run(current => current.acknowledge(requestId)) };
}
