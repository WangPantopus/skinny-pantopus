'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';

function sessionMarker() {
  try { return localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { return null; }
}

type ListSession = { key: string; token: string | null; origin: string; marker: string | null; active: boolean };

/** Both existing personal task lists retire together with their opening session. */
export function useGigListSession() {
  const [session, setSession] = useState<ListSession | null>(null);
  const opening = useRef<ListSession | null>(null);
  const [, update] = useState(0);
  useEffect(() => {
    const scope = { key: crypto.randomUUID(), token: api.getAuthToken(), origin: api.getApiBaseUrl(), marker: sessionMarker(), active: true };
    opening.current = scope;
    setSession(scope);
    const retire = () => { scope.active = false; update(value => value + 1); };
    const unsubscribe = api.onTokenChange(retire);
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire();
    };
    window.addEventListener('storage', changed);
    return () => {
      scope.active = false;
      if (opening.current === scope) opening.current = null;
      unsubscribe(); window.removeEventListener('storage', changed);
    };
  }, []);
  const isCurrent = useCallback(() => Boolean(session?.token && session.active && opening.current === session
    && session.token === api.getAuthToken() && session.origin === api.getApiBaseUrl() && session.marker === sessionMarker()), [session]);
  return { key: session?.key ?? 'pending', isCurrent, active: isCurrent(), retired: session !== null && !isCurrent() };
}
