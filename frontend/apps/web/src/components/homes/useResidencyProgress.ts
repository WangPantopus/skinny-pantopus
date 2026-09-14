'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { validateResidencyProgress } from './residencyProgressModel';

export function useResidencyProgress(homeId: string) {
  const [progress, setProgress] = useState<api.homes.PersonalResidencyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const ready = useRef<(() => boolean) | null>(null);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setProgress(null); setLoading(true); setError('');
  }, []);
  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    ready.current = null; setProgress(null); setLoading(true); setError('');
    const token = api.getAuthToken(), origin = api.getApiBaseUrl();
    let marker: string | null;
    const current = () => generation.current === revision && api.getAuthToken() === token
      && api.getApiBaseUrl() === origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker
      && document.visibilityState !== 'hidden';
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      if (!token) throw new Error('Sign in to check your residency status.');
      const result = await api.homes.getMyResidencyProgress(homeId);
      if (!current()) return;
      validateResidencyProgress(result, homeId);
      ready.current = current; setProgress(result);
    } catch (error) {
      if (generation.current === revision) setError(error instanceof Error ? error.message : 'Could not check your residency status. Please retry.');
    } finally {
      if (generation.current === revision) setLoading(false);
    }
  }, [homeId]);
  useEffect(() => {
    const resume = () => { retire(); if (document.visibilityState !== 'hidden') void refresh(); };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else resume(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) resume(); };
    void refresh(); const unsubscribe = api.onTokenChange(resume);
    window.addEventListener('focus', resume); window.addEventListener('pagehide', retire); window.addEventListener('pageshow', resume);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility);
    return () => {
      retire(); unsubscribe(); window.removeEventListener('focus', resume); window.removeEventListener('pagehide', retire);
      window.removeEventListener('pageshow', resume); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
    };
  }, [refresh, retire]);
  return { progress, loading, error, refresh, ready };
}
