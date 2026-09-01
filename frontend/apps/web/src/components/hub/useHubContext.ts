'use client';

import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { Persona, HubHome, HubBusiness } from './types';

const ACTIVE_HOME_KEY = 'pantopus_active_home_id';
const ACTIVE_PERSONA_KEY = 'pantopus_active_persona';

function readStoredHomeId(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(ACTIVE_HOME_KEY); } catch { return null; }
}

function readStoredPersona(): Persona {
  if (typeof window === 'undefined') return { type: 'personal' };
  try {
    const v = localStorage.getItem(ACTIVE_PERSONA_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return { type: 'personal' };
}

function persistHomeId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) localStorage.setItem(ACTIVE_HOME_KEY, id);
    else localStorage.removeItem(ACTIVE_HOME_KEY);
  } catch {}
}

function persistPersona(p: Persona) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(ACTIVE_PERSONA_KEY, JSON.stringify(p)); } catch {}
}

/**
 * Manages active home / persona state with localStorage persistence
 * and server sync via hub context API.
 * Call `init()` once with server-provided data to reconcile stored vs server state.
 */
export function useHubContext() {
  const [activeHomeId, setActiveHomeId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<Persona>({ type: 'personal' });
  const [homePickerOpen, setHomePickerOpen] = useState(false);
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);

  /** Reconcile stored state against server payload. Call once after fetch. */
  const init = useCallback((
    serverHomeId: string | null,
    homes: HubHome[],
    businesses: HubBusiness[],
  ) => {
    // Home
    const storedHome = readStoredHomeId();
    if (storedHome && homes.some((h) => h.id === storedHome)) {
      setActiveHomeId(storedHome);
    } else if (serverHomeId) {
      setActiveHomeId(serverHomeId);
      persistHomeId(serverHomeId);
    } else if (homes.length > 0) {
      setActiveHomeId(homes[0].id);
      persistHomeId(homes[0].id);
    }

    // Persona
    const storedPersona = readStoredPersona();
    if (storedPersona.type === 'business' && 'businessId' in storedPersona && businesses.some((b) => b.id === (storedPersona as { businessId: string }).businessId)) {
      setActivePersona(storedPersona);
    } else {
      setActivePersona({ type: 'personal' });
      persistPersona({ type: 'personal' });
    }
  }, []);

  const switchHome = useCallback((homeId: string | null) => {
    setActiveHomeId(homeId);
    persistHomeId(homeId);
    setHomePickerOpen(false);
    // Sync to server (fire-and-forget)
    api.hub.updateHubContext({ activeHomeId: homeId }).catch(() => {});
  }, []);

  const switchPersona = useCallback((p: Persona) => {
    setActivePersona(p);
    persistPersona(p);
    setPersonaPickerOpen(false);
    // Sync to server (fire-and-forget)
    api.hub.updateHubContext({ activePersona: p }).catch(() => {});
  }, []);

  return {
    activeHomeId,
    activePersona,
    homePickerOpen,
    setHomePickerOpen,
    personaPickerOpen,
    setPersonaPickerOpen,
    init,
    switchHome,
    switchPersona,
  };
}
