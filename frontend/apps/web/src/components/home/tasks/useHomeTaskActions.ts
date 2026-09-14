'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import { HomeTaskClient } from './HomeTaskClient';

/** Bind dashboard actions before a confirmation dialog or other asynchronous work. */
export function useHomeTaskActions(homeId: string, scope: api.HomeTaskSessionScope | null) {
  const context = useRef<HomeTaskClient | null>(null);
  const scopeHome = scope?.home_id;
  const scopeActor = scope?.actor_id;
  const scopeProof = scope?.session_scope;
  useEffect(() => {
    if (!scopeHome || !scopeActor || !scopeProof) return;
    const client = new HomeTaskClient(homeId, { home_id: scopeHome, actor_id: scopeActor, session_scope: scopeProof });
    context.current = client;
    const retire = () => client.retire();
    const visibility = () => { if (document.visibilityState === 'hidden') client.invalidatePending(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire(); };
    const unsubscribe = api.onTokenChange(retire);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility);
    return () => {
      retire(); unsubscribe();
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
      if (context.current === client) context.current = null;
    };
  }, [homeId, scopeHome, scopeActor, scopeProof]);
  return useCallback(() => {
    const client = context.current;
    if (!client || document.visibilityState === 'hidden') throw new Error('Reload current tasks before continuing.');
    client.requireCurrent(); return client;
  }, []);
}
