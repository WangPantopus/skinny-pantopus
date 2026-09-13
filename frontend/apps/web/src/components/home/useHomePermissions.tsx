'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';

import * as api from '@pantopus/api';
import { readCurrentHomeAccess } from './homeAccessFingerprint';

// ============================================================
// Types
// ============================================================

export interface HomeAccess {
  hasAccess: boolean;
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

export function HomePermissionsProvider({
  homeId,
  children,
}: {
  homeId: string;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<HomeAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const scopeHome = useRef(homeId);
  const ready = useRef<(() => boolean) | null>(null);
  const retireGeneration = useCallback(() => { generation.current++; ready.current = null; }, []);

  const load = useCallback(async () => {
    const revision = ++generation.current;
    scopeHome.current = homeId; ready.current = null;
    const token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => revision === generation.current && token === api.getAuthToken()
      && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY)
      && document.visibilityState !== 'hidden';
    setAccess(null); setLoading(true);
    setError(null);
    try {
      if (!token) throw new Error('Sign in again to check current home access.');
      const data = await readCurrentHomeAccess(homeId);
      if (!current()) return;
      const confirmed = data as HomeAccess;
      if ((confirmed.hasAccess !== true && confirmed.verification_required !== true) || !Array.isArray(confirmed.permissions)) {
        throw new Error('Current access to this home could not be confirmed. Reload to check access.');
      }
      ready.current = current;
      setAccess(confirmed);
    } catch (err: unknown) {
      if (!current()) return;
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
      if (current()) setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    void load();
    const invalidate = () => { retireGeneration(); setAccess(null); setLoading(true); setError(null); };
    const changed = () => { invalidate(); if (document.visibilityState !== 'hidden') void load(); };
    const visibility = () => { if (document.visibilityState === 'hidden') invalidate(); else changed(); };
    const focus = () => { if (document.visibilityState !== 'hidden') changed(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    window.addEventListener('storage', storage); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => { retireGeneration(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [load, retireGeneration]);

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

  const needsVerification = !visibleAccess || visibleAccess.verification_status !== 'verified';

  const isProvisional = visibleAccess?.verification_status === 'provisional'
    || visibleAccess?.verification_status === 'provisional_bootstrap';

  return (
    <HomePermissionsContext.Provider
      value={{ access: visibleAccess, loading, error, can, hasRoleAtLeast, canSeeTab, needsVerification, isProvisional, reload: load }}
    >
      {children}
    </HomePermissionsContext.Provider>
  );
}
