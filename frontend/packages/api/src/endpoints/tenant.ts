// ============================================================
// TENANT ENDPOINTS
// Tenant-facing landlord verification flow: request approval,
// accept invites, check landlord status, manage lease.
// Mounted at /api/v1/tenant in the backend
// ============================================================

import { get, post } from '../client';

// ── Types ───────────────────────────────────────────────────

export type LandlordInfo = {
  has_landlord: boolean;
  /** Masked name, e.g. "J*** S***" */
  landlord_name_masked?: string;
  landlord_entity_type?: 'user' | 'business' | 'trust';
  verification_tier?: 'weak' | 'standard' | 'strong' | 'legal';
};

export type TenantLeaseState = 'none' | 'pending' | 'active' | 'denied' | 'ended';

export type TenantLease = {
  id: string;
  home_id: string;
  state: TenantLeaseState;
  source: 'landlord_invite' | 'tenant_request' | 'admin';
  start_at: string;
  end_at: string | null;
  created_at: string;
  metadata?: {
    message?: string | null;
    denied_reason?: string | null;
    denied_at?: string | null;
  };
};

export type TenantHomeStatus = {
  home_id: string;
  landlord: LandlordInfo;
  lease: {
    state: TenantLeaseState;
    lease: TenantLease | null;
  };
};

// ── Endpoints ───────────────────────────────────────────────

/**
 * Check the landlord + lease status for a home from the tenant perspective.
 * Returns whether a landlord authority exists and the tenant's current lease state.
 */
export async function getTenantHomeStatus(homeId: string): Promise<TenantHomeStatus> {
  return get(`/api/v1/tenant/home/${homeId}/status`);
}

/**
 * Request lease approval from the landlord of a home.
 * Creates a pending HomeLease record.
 */
export async function requestApproval(data: {
  home_id: string;
  start_at?: string | null;
  end_at?: string | null;
  message?: string | null;
}): Promise<{ lease: TenantLease }> {
  return post('/api/v1/tenant/request-approval', data);
}

/**
 * Accept a lease invite by token.
 * The token is a 64-char hex string provided by the landlord.
 */
export async function acceptInvite(token: string): Promise<{
  lease: TenantLease;
  occupancy: any;
}> {
  return post('/api/v1/tenant/accept-invite', { token });
}

/**
 * Cancel a pending lease request.
 */
export async function cancelRequest(leaseId: string): Promise<{ success: boolean }> {
  return post(`/api/v1/tenant/request/${leaseId}/cancel`);
}

/**
 * Tenant requests to end their own active lease (move out).
 */
export async function moveOut(leaseId: string, reason?: string): Promise<{ success: boolean }> {
  return post('/api/v1/tenant/move-out', { lease_id: leaseId, reason });
}
