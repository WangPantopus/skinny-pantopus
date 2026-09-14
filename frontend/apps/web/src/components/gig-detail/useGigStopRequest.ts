'use client';

import { useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { GigStopAction, GigStopPreview, GigStopProgress, GigStopReason, GigStopRequest } from '@pantopus/api';
import {
  clearStopRequest, readStopRequest, retainStopRequest, sameStopRequest, sameStopTerms, stopId, stopRecoveryKey,
  verifyStopPreview, verifyStopProgress, hashStopExplanation, retainStopExplanation, readStopExplanation, clearStopExplanation,
} from './gigStopRecovery';

export interface GigStopOptions {
  gigId: string;
  actorId: string;
  action: GigStopAction;
  onCompleted?: () => void;
  /** A saved-status entry must never become a new action if its storage changes. */
  recoveryRequest?: GigStopRequest;
}

function sessionMarker(): string | null | undefined {
  try { return localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { return undefined; }
}

export function useGigStopRequest({ gigId, actorId, action, onCompleted, recoveryRequest }: GigStopOptions) {
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
  const openingRecovery = useRef(recoveryRequest);
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

  async function accept(value: GigStopProgress, requestId: string, expected?: GigStopRequest | null) {
    const verified = verifyStopProgress(value, gigId, actorId, requestId, serverSession.current, expected);
    serverSession.current = verified.sessionScope;
    const saved = readStopRequest(key, actorId, gigId);
    if (saved && !sameStopRequest(saved, verified.request)) {
      throw new Error('Another task action is saved. Close and reopen its status before continuing.');
    }
    if (verified.status === 'completed') {
      // Clear only the exact local operation that this receipt completes.
      await clearStopExplanation(key, verified.request, current);
      if (!current()) return;
      const latestSaved = readStopRequest(key, actorId, gigId);
      if (latestSaved && !sameStopRequest(latestSaved, verified.request)) {
        throw new Error('Another task action is saved. Reopen its status before continuing.');
      }
      if (latestSaved) clearStopRequest(key);
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
      if (openingRecovery.current && (!saved || !sameStopRequest(saved, openingRecovery.current))) {
        throw new Error('The saved task action changed. Close and reopen its status before continuing.');
      }
      if (saved) {
        remember(saved);
        try {
          const result = await api.gigs.getGigStopRequest(gigId, saved.requestId);
          if (current()) await accept(result, saved.requestId, saved);
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
      if (current()) await accept(result, next.activeRequestId);
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
    if (saved && !sameStopRequest(saved, original)) {
      throw new Error('Another task action is saved. Close and reopen its status before continuing.');
    }
    if (result.status !== 'completed' && result.request.actorId === actorId) {
      // One storage replacement preserves the original if quota/write fails.
      retainStopRequest(key, result.request);
    } else if (saved) clearStopRequest(key);
    if (openingRecovery.current) openingRecovery.current = result.request;
    await accept(result, conflict.data.activeRequestId);
    return true;
  }

  async function submit(reason: GigStopReason | null = null, explanation?: string) {
    if (!current()) { if (mounted.current) setRetired(true); return; }
    if (working.current || !serverSession.current) return;
    working.current = true; setBusy(true); setError('');
    let request = currentAttempt.current;
    let sent = false;
    try {
      let note: string | null = null;
      if (request) {
        if (!canRetry || request.actorId !== actorId || progress?.status === 'completed') return;
        note = await readStopExplanation(key, request);
      } else {
        if (!preview?.eligible || preview.activeRequestId || preview.financialAction === 'review') return;
        if (typeof crypto.randomUUID !== 'function') throw new Error('Use a secure connection before continuing.');
        note = reason === 'other' ? explanation?.trim() || null : null;
        if (reason === 'other' && (!note || note.length > 1000)) throw new Error('Describe why you are cancelling, using at most 1000 characters.');
        const reasonNoteHash = note ? await hashStopExplanation(note) : null;
        request = { requestId: crypto.randomUUID(), gigId, actorId, action: preview.action,
          terms: preview.terms, reason, rollbackMode: null, financialAction: preview.financialAction,
          ...(reasonNoteHash ? { reasonNoteHash } : {}) };
        if (!current()) return;
        // No provider request can start before the explanation is protected.
        if (note) await retainStopExplanation(key, request, note, current);
      }
      if (!current()) return;
      const saved = readStopRequest(key, actorId, gigId);
      if (saved && !sameStopRequest(saved, request)) throw new Error('Another task action is already saved. Reopen task actions to recover it.');
      retainStopRequest(key, request);
      remember(request);
      setCanRetry(false);
      if (!current()) return;
      sent = true;
      const result = await api.gigs.submitGigStopRequest(gigId, { requestId: request.requestId, action: request.action,
        expectedActorId: actorId, expectedSessionScope: serverSession.current, expectedTerms: request.terms,
        reason: request.reason, rollbackMode: request.rollbackMode,
        ...(request.reasonNoteHash ? { reasonNoteHash: request.reasonNoteHash } : {}),
        ...(note ? { reasonNote: note } : {}) });
      if (current()) await accept(result, request.requestId, request);
    } catch (cause) {
      if (!current()) return;
      if (sent && request) {
        try { if (await recoverConflict(cause, request)) return; } catch { /* Keep original recovery until the active receipt is verified. */ }
      }
      if (current()) setError(sent
        ? 'The result is not confirmed. Check status to recover this request before trying another action.'
        : cause instanceof Error ? cause.message : 'The original request could not be saved. Reopen recovery before sending.');
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
