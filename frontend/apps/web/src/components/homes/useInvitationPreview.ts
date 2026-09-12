'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { invitationReadFailure, validateInvitationPreview, type InvitationPreview } from './invitationPreviewModel';

export function useInvitationPreview(token: string) {
  const [data, setData] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const generation = useRef(0), ready = useRef<(() => boolean) | null>(null);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setData(null); setFailure(null); setLoading(true); setLoggedIn(false);
  }, []);
  const refresh = useCallback(async () => {
    retire();
    if (document.visibilityState === 'hidden') return;
    const revision = generation.current, auth = api.getAuthToken(), origin = api.getApiBaseUrl();
    let marker: string | null;
    const current = () => {
      try {
        return generation.current === revision && api.getAuthToken() === auth && api.getApiBaseUrl() === origin
          && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker && document.visibilityState !== 'hidden';
      } catch { return false; }
    };
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      const result = await api.homes.getInviteByToken(token);
      if (!current()) return;
      validateInvitationPreview(result);
      // Expiry can pass while a successful response is in flight.
      if (result.invitation.status === 'pending' && result.invitation.expires_at && Date.parse(result.invitation.expires_at) <= Date.now()) {
        setData({ invitation: { id: result.invitation.id, status: 'expired' }, expired: true, alreadyUsed: false });
      } else {
        ready.current = () => current() && (result.invitation.status !== 'pending' || result.invitation.expires_at === null || Date.parse(result.invitation.expires_at!) > Date.now()); setData(result);
      }
      setLoggedIn(!!auth);
    } catch (error) {
      if (current()) setFailure(invitationReadFailure(error));
      else if (generation.current === revision) setFailure({ title: 'Reopen invitation', message: 'Your session could not be checked. Reopen this page to try again.' });
    } finally {
      if (generation.current === revision) setLoading(false);
    }
  }, [token, retire]);
  useEffect(() => {
    let disposed = false;
    const resume = () => { if (!disposed) void refresh(); };
    // The API emits its in-tab event before storing the cross-tab marker.
    const session = () => { retire(); queueMicrotask(resume); };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else resume(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) session(); };
    const unsubscribe = api.onTokenChange(session);
    window.addEventListener('focus', resume); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', visibility);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility); resume();
    return () => {
      disposed = true; retire(); unsubscribe(); window.removeEventListener('focus', resume); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', visibility); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
    };
  }, [refresh, retire]);
  useEffect(() => {
    if (data?.invitation.status !== 'pending' || !data.invitation.expires_at) return;
    const timer = window.setTimeout(() => void refresh(), Math.min(2_147_483_647, Math.max(0, Date.parse(data.invitation.expires_at) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [data, refresh]);
  return { data, loading, failure, loggedIn, refresh, ready };
}
