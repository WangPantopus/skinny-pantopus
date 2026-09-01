'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';

export interface HomeAccessData {
  hasAccess: boolean;
  // 5 navigation-gating booleans
  can_manage_home: boolean;
  can_manage_access: boolean;
  can_manage_finance: boolean;
  can_manage_tasks: boolean;
  can_view_sensitive: boolean;
  // Verification context
  verification_status: string;
  is_in_challenge_window: boolean;
  challenge_window_ends_at: string | null;
  // Postcard context
  postcard_expires_at: string | null;
  // Member context
  is_owner: boolean;
  role_base: string | null;
  age_band: string | null;
  occupancy_id: string | null;
  // Legacy
  isOwner: boolean;
  permissions: string[];
  occupancy: {
    id: string;
    role: string;
    role_base: string;
    start_at: string | null;
    end_at: string | null;
    age_band: string | null;
  } | null;
}

export type TabName = 'tasks' | 'bills' | 'members' | 'settings' | 'sensitive';

const TAB_PERMISSION_MAP: Record<TabName, keyof Pick<HomeAccessData, 'can_manage_tasks' | 'can_manage_finance' | 'can_manage_access' | 'can_manage_home' | 'can_view_sensitive'>> = {
  tasks: 'can_manage_tasks',
  bills: 'can_manage_finance',
  members: 'can_manage_access',
  settings: 'can_manage_home',
  sensitive: 'can_view_sensitive',
};

const EMPTY_ACCESS: HomeAccessData = {
  hasAccess: false,
  can_manage_home: false,
  can_manage_access: false,
  can_manage_finance: false,
  can_manage_tasks: false,
  can_view_sensitive: false,
  verification_status: 'unverified',
  is_in_challenge_window: false,
  challenge_window_ends_at: null,
  postcard_expires_at: null,
  is_owner: false,
  role_base: null,
  age_band: null,
  occupancy_id: null,
  isOwner: false,
  permissions: [],
  occupancy: null,
};

export function useHomeAccess(homeId: string | undefined) {
  const [access, setAccess] = useState<HomeAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!homeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setAccess(EMPTY_ACCESS);
        setLoading(false);
        return;
      }
      const data = await api.homeIam.getMyHomeAccess(homeId) as unknown as HomeAccessData;
      setAccess(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load access info');
      setAccess(EMPTY_ACCESS);
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    load();
  }, [load]);

  const canSeeTab = useCallback(
    (tab: TabName): boolean => {
      if (!access) return false;
      const field = TAB_PERMISSION_MAP[tab];
      return field ? access[field] : false;
    },
    [access],
  );

  const needsVerification = !access || access.verification_status !== 'verified';

  const isProvisional = access?.verification_status === 'provisional'
    || access?.verification_status === 'provisional_bootstrap';

  return {
    access,
    loading,
    error,
    canSeeTab,
    needsVerification,
    isProvisional,
    reload: load,
  };
}
