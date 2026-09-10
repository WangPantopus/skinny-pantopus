'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { GigStopAction, GigStopPreview, GigStopProgress, GigStopReason, GigStopRequest } from '@pantopus/api';
import {
  readStopRequest, retainStopRequest, sameStopRequest, sameStopTerms, stopId, stopRecoveryKey,
  verifyStopPreview, verifyStopProgress,
} from './gigStopRecovery';

export interface GigStopOptions {
  gigId: string;
  actorId: string;
  action: GigStopAction;
  onCompleted?: () => void;
}

function sessionMarker(): string | null | undefined {
  try { return localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { return undefined; }
}

export function useGigStopRequest({ gigId, actorId, action, onCompleted }: GigStopOptions) {
  const [preview, setPreview] = useState<GigStopPreview | null>(null);
  const [attempt, setAttempt] = useState<GigStopRequest | null>(null);
  const [progress, setProgress] = useState<GigStopProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const opening = useRef({ gigId, actorId, action, token: api.getAuthToken(), origin: api.getApiBaseUrl(), marker: sessionMarker() });
  const latest = useRef({ gigId, actorId, action }); latest.current = { gigId, actorId, action };
  const mounted = useRef(false);
  const invalidated = useRef(false);
  const working = useRef(false);
  const serverSession = useRef<string | null>(null);
  const currentAttempt = useRef<GigStopRequest | null>(null);
  const completed = useRef(new Set<string>());
  const onConfirmed = useRef(onCompleted); onConfirmed.current = onCompleted;
  const key = stopRecoveryKey(opening.current.origin, opening.current.actorId, opening.current.gigId);

  function current() {
    const start = opening.current;
    if (!mounted.current || invalidated.current) return false;
    if (start.token === null || api.getAuthToken() !== start.token || api.getApiBaseUrl() !== start.origin || sessionMarker() !== start.marker
      || start.actorId !== latest.current.actorId || start.gigId !== latest.current.gigId || start.action !== latest.current.action) {
      invalidated.current = true;
      return false;
    }
    return true;
  }

  function remember(request: GigStopRequest | null) {
    currentAttempt.current = request;
    setAttempt(request);
  }

  function accept(value: GigStopProgress, requestId: string, expected?: GigStopRequest | null) {
    const verified = verifyStopProgress(value, gigId, actorId, requestId, serverSession.current, expected);
    serverSession.current = verified.sessionScope;
    if (verified.status === 'completed') {
      // Clear only the exact local operation that this receipt completes.
      const saved = readStopRequest(key, actorId, gigId);
      if (saved && sameStopRequest(saved, verified.request)) localStorage.removeItem(key);
    } else if (verified.request.actorId === actorId) retainStopRequest(key, verified.request);
    remember(verified.request);
    setProgress(verified);
    setCanRetry(verified.status !== 'completed' && verified.canRetry && verified.request.actorId === actorId);
    if (verified.status === 'completed' && !completed.current.has(requestId)) {
      completed.current.add(requestId);
      onConfirmed.current?.();
    }
  }

  async function fetchPreview(selected: GigStopAction) {
    const value = await api.gigs.getGigStopPreview(gigId, selected);
    if (!current()) return null;
    const verified = verifyStopPreview(value, gigId, actorId, selected, serverSession.current);
    serverSession.current = verified.sessionScope;
    setPreview(verified);
    return verified;
  }

  async function check() {
    if (!current()) { if (mounted.current) setRetired(true); return; }
    if (working.current) return;
    working.current = true; setBusy(true); setCanRetry(false); setError(''); setPreview(null);
    try {
      const saved = currentAttempt.current ?? readStopRequest(key, actorId, gigId);
      if (saved) {
        remember(saved);
        try {
          const result = await api.gigs.getGigStopRequest(gigId, saved.requestId);
          if (current()) accept(result, saved.requestId, saved);
          return;
        } catch (cause) {
          if ((cause as { statusCode?: number })?.statusCode !== 404) throw cause;
          // A missing receipt never permits a new UUID or silently changed terms.
          const next = await fetchPreview(saved.action);
          if (!next || !current()) return;
          // A conflicting preview never replaces the original request. An
          // explicit retry can obtain STOP_ACTIVE under the server lock and
          // then read that exact active receipt before adopting it.
          setCanRetry(saved.actorId === actorId && (next.activeRequestId !== null
            || (next.eligible && sameStopTerms(saved.terms, next.terms) && saved.financialAction === next.financialAction)));
          setError('The original request is not confirmed. You can check again or retry the same request when available.');
          return;
        }
      }
      const next = await fetchPreview(action);
      if (!next || !current() || !next.activeRequestId) return;
      const result = await api.gigs.getGigStopRequest(gigId, next.activeRequestId);
      if (current()) accept(result, next.activeRequestId);
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : 'Could not confirm task action details. Check again before continuing.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function recoverConflict(cause: unknown, original: GigStopRequest): Promise<boolean> {
    const conflict = cause as { statusCode?: number; data?: { code?: string; activeRequestId?: string } };
    if (conflict?.statusCode !== 409 || conflict.data?.code !== 'STOP_ACTIVE'
      || !stopId(conflict.data.activeRequestId) || conflict.data.activeRequestId === original.requestId) return false;
    const result = await api.gigs.getGigStopRequest(gigId, conflict.data.activeRequestId);
    if (!current()) return true;
    verifyStopProgress(result, gigId, actorId, conflict.data.activeRequestId, serverSession.current);
    const saved = readStopRequest(key, actorId, gigId);
    if (saved && sameStopRequest(saved, original)) localStorage.removeItem(key);
    accept(result, conflict.data.activeRequestId);
    return true;
  }

  async function submit(reason: GigStopReason | null = null) {
    if (!current()) { if (mounted.current) setRetired(true); return; }
    if (working.current || !serverSession.current) return;
    let request = currentAttempt.current;
    if (request) {
      if (!canRetry || request.actorId !== actorId || progress?.status === 'completed') return;
    } else {
      if (!preview?.eligible || preview.activeRequestId || preview.financialAction === 'review') return;
      if (typeof crypto.randomUUID !== 'function') { setError('Use a secure connection before continuing.'); return; }
      request = { requestId: crypto.randomUUID(), gigId, actorId, action: preview.action,
        terms: preview.terms, reason, rollbackMode: null, financialAction: preview.financialAction };
    }
    try {
      const saved = readStopRequest(key, actorId, gigId);
      if (saved && !sameStopRequest(saved, request)) throw new Error('Another task action is already saved. Reopen task actions to recover it.');
      retainStopRequest(key, request);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Allow local storage so this request can recover after an interruption.');
      return;
    }
    // Set the immutable request before any network call, including a lost response.
    remember(request);
    working.current = true; setBusy(true); setCanRetry(false); setError('');
    try {
      if (!current()) return;
      const result = await api.gigs.submitGigStopRequest(gigId, { requestId: request.requestId, action: request.action,
        expectedActorId: actorId, expectedSessionScope: serverSession.current, expectedTerms: request.terms,
        reason: request.reason, rollbackMode: request.rollbackMode });
      if (current()) accept(result, request.requestId, request);
    } catch (cause) {
      if (!current()) return;
      try { if (await recoverConflict(cause, request)) return; } catch { /* Keep original recovery until the active receipt is verified. */ }
      if (current()) setError('The result is not confirmed. Check status to recover this request before trying another action.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    const invalidate = () => {
      invalidated.current = true; setRetired(true); setPreview(null); setProgress(null); setAttempt(null); setCanRetry(false);
    };
    const unsubscribe = api.onTokenChange(invalidate);
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY || event.key === key) invalidate();
    };
    window.addEventListener('storage', changed);
    if (current()) void check(); else invalidate();
    return () => { mounted.current = false; unsubscribe(); window.removeEventListener('storage', changed); };
    // A dialog belongs to its opening actor, task, action and session only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { preview, attempt, progress, busy, canRetry, error,
    retired: retired || (!current() && mounted.current), check, submit };
}
