'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { invitationReadFailure, validateInvitationPreview, type InvitationPreview } from './invitationPreviewModel';
import { RETURN_REFRESH_MS, transientFailure } from '../home/returnRefresh';

export function useInvitationPreview(token: string) {
  const [data, setData] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const generation = useRef(0), ready = useRef<(() => boolean) | null>(null);
  const lastAttempt = useRef(0), inFlight = useRef(0);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setData(null); setFailure(null); setLoading(true); setLoggedIn(false);
  }, []);
  // A full load clears the page first. A background re-check (coming back to the page) keeps the invitation
  // on screen and replaces it with the newer answer; a network or server blip keeps it, a refusal shows why.
  const load = useCallback(async (background = false) => {
    if (!background) retire();
    const revision = generation.current, auth = api.getAuthToken(), origin = api.getApiBaseUrl();
    lastAttempt.current = Date.now();
    let marker: string | null;
    const current = () => {
      try {
        return generation.current === revision && api.getAuthToken() === auth && api.getApiBaseUrl() === origin
          && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker;
      } catch { return false; }
    };
    inFlight.current++;
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      const result = await api.homes.getInviteByToken(token);
      if (!current()) return;
      validateInvitationPreview(result);
      // Expiry can pass while a successful response is in flight.
      if (result.invitation.status === 'pending' && result.invitation.expires_at && Date.parse(result.invitation.expires_at) <= Date.now()) {
        ready.current = null; setData({ invitation: { id: result.invitation.id, status: 'expired' }, expired: true, alreadyUsed: false });
      } else {
        ready.current = () => current() && (result.invitation.status !== 'pending' || result.invitation.expires_at === null || Date.parse(result.invitation.expires_at!) > Date.now()); setData(result);
      }
      setLoggedIn(!!auth); setFailure(null);
    } catch (error) {
      if (background && current()) {
        if (transientFailure(error)) return;
        ready.current = null; setData(null);
      }
      if (current()) setFailure(invitationReadFailure(error));
      else if (generation.current === revision) setFailure({ title: 'Reopen invitation', message: 'Your session could not be checked. Reopen this page to try again.' });
    } finally {
      inFlight.current--;
      if (generation.current === revision) setLoading(false);
    }
  }, [token, retire]);
  const refresh = useCallback(() => load(), [load]);
  useEffect(() => {
    let disposed = false;
    const restart = () => { if (!disposed) void load(); };
    // The API emits its in-tab event before storing the cross-tab marker.
    const session = () => { retire(); queueMicrotask(restart); };
    // Coming back keeps the invitation and re-checks it behind the scenes (in full when none is shown).
    const resume = () => {
      if (disposed || document.visibilityState === 'hidden' || inFlight.current > 0
        || Date.now() - lastAttempt.current < RETURN_REFRESH_MS) return;
      void load(ready.current !== null);
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) restart(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) session(); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('focus', resume); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', pageshow);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', resume); restart();
    return () => {
      disposed = true; retire(); unsubscribe(); window.removeEventListener('focus', resume); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', pageshow); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', resume);
    };
  }, [load, retire]);
  useEffect(() => {
    if (data?.invitation.status !== 'pending' || !data.invitation.expires_at) return;
    const timer = window.setTimeout(() => void refresh(), Math.min(2_147_483_647, Math.max(0, Date.parse(data.invitation.expires_at) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [data, refresh]);
  return { data, loading, failure, loggedIn, refresh, ready };
}
