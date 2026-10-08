'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { validateResidencyProgress } from './residencyProgressModel';
import { RETURN_REFRESH_MS, transientFailure } from '../home/returnRefresh';

export function useResidencyProgress(homeId: string) {
  const [progress, setProgress] = useState<api.homes.PersonalResidencyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const ready = useRef<(() => boolean) | null>(null);
  const lastAttempt = useRef(0), inFlight = useRef(0);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setProgress(null); setLoading(true); setError('');
  }, []);
  // A full load clears the page first. A background re-check (coming back to the page) keeps the status on
  // screen and replaces it with the newer answer; a network or server blip keeps it, a refusal shows the error.
  const load = useCallback(async (background = false) => {
    const revision = background ? generation.current : ++generation.current;
    lastAttempt.current = Date.now();
    if (!background) { ready.current = null; setProgress(null); setLoading(true); setError(''); }
    inFlight.current++;
    const token = api.getAuthToken(), origin = api.getApiBaseUrl();
    let marker: string | null;
    const current = () => generation.current === revision && api.getAuthToken() === token
      && api.getApiBaseUrl() === origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker;
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      if (!token) throw new Error('Sign in to check your residency status.');
      const result = await api.homes.getMyResidencyProgress(homeId);
      if (!current()) return;
      validateResidencyProgress(result, homeId);
      if (!background) ready.current = current;
      setProgress(result); setError('');
    } catch (error) {
      if (generation.current !== revision || (background && transientFailure(error))) return;
      if (background) { ready.current = null; setProgress(null); }
      setError(error instanceof Error ? error.message : 'Could not check your residency status. Please retry.');
    } finally {
      inFlight.current--;
      if (generation.current === revision) setLoading(false);
    }
  }, [homeId]);
  const refresh = useCallback(() => load(), [load]);
  useEffect(() => {
    // Another account's status must never show, so an account change clears the page and reloads it.
    const restart = () => { retire(); void load(); };
    const resume = () => {
      if (document.visibilityState === 'hidden' || inFlight.current > 0
        || Date.now() - lastAttempt.current < RETURN_REFRESH_MS) return;
      void load(ready.current !== null);
    };
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) restart(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) restart(); };
    void load(); const unsubscribe = api.onTokenChange(restart);
    window.addEventListener('focus', resume); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', pageshow);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', resume);
    return () => {
      retire(); unsubscribe(); window.removeEventListener('focus', resume); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', pageshow); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', resume);
    };
  }, [load, retire]);
  return { progress, loading, error, refresh, ready };
}
