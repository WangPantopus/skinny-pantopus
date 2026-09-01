'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

// ============================================================
// Types
// ============================================================

export interface HomeAccess {
  hasAccess: boolean;
  isOwner: boolean;
  role_base: string | null;
  permissions: string[];
  occupancy: {
    id: string;
    role: string;
    role_base: string;
    start_at: string | null;
    end_at: string | null;
    age_band: string | null;
  } | null;
  // Navigation-gating booleans (from occupancy row)
  can_manage_home: boolean;
  can_manage_access: boolean;
  can_manage_finance: boolean;
  can_manage_tasks: boolean;
  can_view_sensitive: boolean;
  // Verification context
  verification_status: string;
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
  guest: 10,
  restricted_member: 20,
  member: 30,
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { get } = await import('@pantopus/api');
      const data = await get(`/api/homes/${homeId}/me`);
      setAccess(data as HomeAccess);
    } catch (err: unknown) {
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
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (permission: string) => {
      if (!access) return false;
      if (access.isOwner) return true; // owner can do everything
      return access.permissions.includes(permission);
    },
    [access]
  );

  const hasRoleAtLeast = useCallback(
    (minRole: string) => {
      if (!access?.role_base) return false;
      if (access.isOwner) return true;
      return (ROLE_RANK[access.role_base] || 0) >= (ROLE_RANK[minRole] || 0);
    },
    [access]
  );

  const canSeeTab = useCallback(
    (tab: TabName) => {
      if (!access) return false;
      const field = TAB_PERMISSION_MAP[tab];
      return field ? access[field] : false;
    },
    [access]
  );

  const needsVerification = !access || access.verification_status !== 'verified';

  const isProvisional = access?.verification_status === 'provisional'
    || access?.verification_status === 'provisional_bootstrap';

  return (
    <HomePermissionsContext.Provider
      value={{ access, loading, error, can, hasRoleAtLeast, canSeeTab, needsVerification, isProvisional, reload: load }}
    >
      {children}
    </HomePermissionsContext.Provider>
  );
}
