'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import * as api from '@pantopus/api';
import { homeAccessExpiry, homeAccessFingerprint, readCurrentHomeAccess, watchHomeAccessExpiry } from './homeAccessFingerprint';
import { readHomeDashboardCopy } from './homeDashboardCopy';
import { RETURN_REFRESH_MS, transientFailure } from './returnRefresh';
import { onSyncTopic, touchesHome } from '@/lib/syncSignals';

// ============================================================
// Types
// ============================================================

export interface HomeAccess {
  hasAccess: boolean;
  access_expires_at?: string | null;
  isOwner: boolean;
  role_base: string | null;
  effective_role_base?: string | null;
  permissions: string[];
  occupancy: {
    id: string;
    role: string;
    role_base: string;
    start_at: string | null;
    end_at: string | null;
    age_band: string | null;
  } | null;
  // Navigation booleans projected from effective permissions by the server.
  can_manage_home: boolean;
  can_manage_access: boolean;
  can_manage_finance: boolean;
  can_manage_tasks: boolean;
  can_view_sensitive: boolean;
  // Verification context
  verification_status: string;
  verification_required?: boolean;
  verification_kind?: 'ownership' | 'residency';
  is_in_challenge_window: boolean;
  challenge_window_ends_at: string | null;
  /** When user has an ownership claim that was rejected or needs more info (for dashboard messaging) */
  ownership_claim_state?: 'rejected' | 'needs_more_info' | null;
  // Postcard context
  postcard_expires_at: string | null;
  // Claim window context (BUG 5B)
  is_in_claim_window: boolean;
  claim_window_ends_at: string | null;
  // Member context
  is_owner: boolean;
  age_band: string | null;
  occupancy_id: string | null;
}

export type TabName = 'tasks' | 'bills' | 'members' | 'settings' | 'sensitive';

const TAB_PERMISSION_MAP: Record<TabName, keyof Pick<HomeAccess, 'can_manage_tasks' | 'can_manage_finance' | 'can_manage_access' | 'can_manage_home' | 'can_view_sensitive'>> = {
  tasks: 'can_manage_tasks',
  bills: 'can_manage_finance',
  members: 'can_manage_access',
  settings: 'can_manage_home',
  sensitive: 'can_view_sensitive',
};

interface HomePermissionsContextType {
  access: HomeAccess | null;
  loading: boolean;
  error: string | null;
  /** Check if the current user has a specific permission */
  can: (permission: string) => boolean;
  /** Check if user has at least a minimum role level */
  hasRoleAtLeast: (minRole: string) => boolean;
  /** Check if user can see a specific tab (uses the 5 nav booleans) */
  canSeeTab: (tab: TabName) => boolean;
  /** True when the user still needs to complete verification */
  needsVerification: boolean;
  /** True when verification_status is provisional or provisional_bootstrap */
  isProvisional: boolean;
  /** Reload permissions */
  reload: () => Promise<void>;
}

// ============================================================
// Role hierarchy
// ============================================================

const ROLE_RANK: Record<string, number> = {
  service_provider: 5,
  guest: 10,
  restricted_member: 20,
  member: 30,
  lease_resident: 35,
  manager: 40,
  admin: 50,
  owner: 60,
};

// ============================================================
// Context
// ============================================================

const HomePermissionsContext = createContext<HomePermissionsContextType>({
  access: null,
  loading: true,
  error: null,
  can: () => false,
  hasRoleAtLeast: () => false,
  canSeeTab: () => false,
  needsVerification: true,
  isProvisional: false,
  reload: async () => {},
});

export function useHomePermissions() {
  return useContext(HomePermissionsContext);
}

// ============================================================
// Provider
// ============================================================

/** True while this browser's session, API origin and generation are the ones a read started under. */
function sessionCheck(revision: number, generation: { current: number }): () => boolean {
  const token = api.getAuthToken(), origin = api.getApiBaseUrl();
  const marker = typeof window === 'undefined' ? null : localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  return () => revision === generation.current && token === api.getAuthToken()
    && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
}

export function HomePermissionsProvider({
  homeId,
  keepsCopy = false,
  children,
}: {
  homeId: string;
  /** Start from the access kept with the Home dashboard's copy (owners and household roles,
   * components/home/homeDashboardCopy.ts) and check it again behind it. */
  keepsCopy?: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [copied] = useState(() => (keepsCopy ? readHomeDashboardCopy(queryClient, homeId)?.access as HomeAccess | undefined : undefined) ?? null);
  const [access, setAccess] = useState<HomeAccess | null>(copied);
  const [loading, setLoading] = useState(!copied);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const scopeHome = useRef(homeId);
  const copyHome = useRef(copied ? homeId : null);
  const ready = useRef<(() => boolean) | null>(null);
  // The copied access was shown under this session: it answers what may be shown until the re-check does.
  const readyInitialized = useRef(false);
  if (!readyInitialized.current) {
    readyInitialized.current = true;
    if (copied) ready.current = sessionCheck(generation.current, generation);
  }
  const stopExpiry = useRef<(() => void) | null>(null);
  const lastAttempt = useRef(0);
  const inFlight = useRef(0);
  // A change signal that arrived during a check: one more background check follows it.
  const signalPending = useRef(false);
  // The access the page currently shows (null while loading or failed), for background re-checks.
  const shownFingerprint = useRef<string | null>(null);
  const retireGeneration = useCallback(() => {
    generation.current++; ready.current = null;
    stopExpiry.current?.(); stopExpiry.current = null;
  }, []);

  // A full load clears access first. A background re-check (coming back to the page) keeps it when
  // the server answers the same access; a changed access or a refusal reloads in full.
  const load = useCallback(async (background = false) => {
    if (!background) retireGeneration();
    const revision = generation.current;
    let expiry: number | null = null;
    lastAttempt.current = Date.now();
    if (!background) { scopeHome.current = homeId; ready.current = null; }
    const token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => revision === generation.current && token === api.getAuthToken()
      && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY)
      && (expiry === null || Date.now() < expiry);
    if (!background) { copyHome.current = null; setAccess(null); setLoading(true); setError(null); }
    inFlight.current++;
    try {
      if (!token) throw new Error('Sign in again to check current home access.');
      const data = await readCurrentHomeAccess(homeId);
      if (!current()) return;
      if (background) {
        if (homeAccessFingerprint(data) !== shownFingerprint.current) void load();
        // The same access: its other details (claim and challenge windows) follow the server.
        else setAccess(previous => (previous && JSON.stringify(previous) === JSON.stringify(data) ? previous : data as HomeAccess));
        return;
      }
      const confirmed = data as HomeAccess;
      if ((confirmed.hasAccess !== true && confirmed.verification_required !== true) || !Array.isArray(confirmed.permissions)) {
        throw new Error('Current access to this home could not be confirmed. Reload to check access.');
      }
      expiry = homeAccessExpiry(confirmed);
      stopExpiry.current = watchHomeAccessExpiry(expiry, () => {
        if (revision !== generation.current) return;
        retireGeneration(); setAccess(null); setLoading(false);
        setError('Home access changed or could not be confirmed. Reload to check current access.');
      });
      if (!current()) return;
      ready.current = current;
      setAccess(confirmed);
    } catch (err: unknown) {
      if (!current()) return;
      if (background) { if (!transientFailure(err)) void load(); return; }
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
      setAccess({
        hasAccess: false,
        isOwner: false,
        role_base: null,
        permissions: [],
        occupancy: null,
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: false,
        can_view_sensitive: false,
        verification_status: 'unverified',
        is_in_challenge_window: false,
        challenge_window_ends_at: null,
        ownership_claim_state: undefined,
        postcard_expires_at: null,
        is_in_claim_window: false,
        claim_window_ends_at: null,
        is_owner: false,
        age_band: null,
        occupancy_id: null,
      });
    } finally {
      inFlight.current--;
      if (!background && current()) setLoading(false);
      if (inFlight.current === 0 && signalPending.current && current()) {
        signalPending.current = false;
        void load(ready.current !== null);
      }
    }
  }, [homeId, retireGeneration]);

  useEffect(() => {
    shownFingerprint.current = !loading && !error && access ? homeAccessFingerprint(access) : null;
  }, [access, loading, error]);

  useEffect(() => {
    // From a copy, the first load is the background re-check (a changed access reloads in full).
    const fromCopy = copyHome.current === homeId;
    if (fromCopy && ready.current === null) ready.current = sessionCheck(generation.current, generation);
    void load(fromCopy);
    // Another account's access must never show, so an account change clears it and reloads.
    const changed = () => { retireGeneration(); setAccess(null); setLoading(true); setError(null); void load(); };
    // Coming back keeps the page and re-checks access behind the scenes (in full when nothing is shown).
    const resume = () => {
      if (document.visibilityState === 'hidden' || inFlight.current > 0
        || Date.now() - lastAttempt.current < RETURN_REFRESH_MS) return;
      void load(ready.current !== null);
    };
    // The server says this Home changed (a role, a membership, a claim): check access again now.
    const signalled = (topic: string) => {
      if (!touchesHome(topic, homeId)) return;
      if (inFlight.current > 0) { signalPending.current = true; return; }
      void load(ready.current !== null);
    };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    const unsubscribeSync = onSyncTopic(signalled);
    window.addEventListener('storage', storage); window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { retireGeneration(); unsubscribe(); unsubscribeSync(); signalPending.current = false; window.removeEventListener('storage', storage);
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [load, retireGeneration, homeId]);

  const visibleAccess = scopeHome.current === homeId ? access : null;
  const opening = ready.current;
  const can = useCallback(
    (permission: string) => {
      if (!opening?.() || !visibleAccess?.hasAccess) return false;
      return visibleAccess.permissions.includes(permission);
    },
    [visibleAccess, opening]
  );

  const hasRoleAtLeast = useCallback(
    (minRole: string) => {
      if (!opening?.() || !visibleAccess?.hasAccess || !ROLE_RANK[minRole]) return false;
      const role = visibleAccess.effective_role_base ?? visibleAccess.role_base;
      const rank = ROLE_RANK[role || ''] || 0;
      const ceiling = visibleAccess.age_band === 'child' ? ROLE_RANK.restricted_member
        : visibleAccess.age_band === 'teen' ? ROLE_RANK.member : rank;
      return Math.min(rank, ceiling) >= ROLE_RANK[minRole];
    },
    [visibleAccess, opening]
  );

  const canSeeTab = useCallback(
    (tab: TabName) => {
      if (!opening?.() || !visibleAccess?.hasAccess) return false;
      const field = TAB_PERMISSION_MAP[tab];
      return field ? visibleAccess[field] : false;
    },
    [visibleAccess, opening]
  );

  const reload = useCallback(() => load(), [load]);

  const needsVerification = !visibleAccess || visibleAccess.verification_status !== 'verified';

  const isProvisional = visibleAccess?.verification_status === 'provisional'
    || visibleAccess?.verification_status === 'provisional_bootstrap';

  return (
    <HomePermissionsContext.Provider
      value={{ access: visibleAccess, loading, error, can, hasRoleAtLeast, canSeeTab, needsVerification, isProvisional, reload }}
    >
      {children}
    </HomePermissionsContext.Provider>
  );
}
