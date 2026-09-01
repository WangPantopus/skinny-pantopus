// ============================================================
// LANDLORD PORTAL ENDPOINTS
// Property management, leases, tenant requests, notices
// Mounted at /api/v1/landlord in the backend
// ============================================================

import { get, post, put, del, patch } from '../client';

// ── Types ───────────────────────────────────────────────────

export type AuthorityStatus = 'pending' | 'verified' | 'revoked';
export type VerificationTier = 'weak' | 'standard' | 'strong' | 'legal';
export type LeaseState = 'pending' | 'active' | 'ended' | 'canceled';
export type LeaseSource = 'landlord_invite' | 'tenant_request' | 'admin';

export type HomeAuthority = {
  id: string;
  home_id: string;
  subject_type: 'user' | 'business' | 'trust';
  subject_id: string;
  role: string;
  status: AuthorityStatus;
  verification_tier: VerificationTier;
  added_via: string;
  created_at: string;
  updated_at: string;
  home?: {
    id: string;
    name: string;
    address_id: string | null;
    home_type: string;
  } | null;
};

export type PropertyUnit = {
  id: string;
  name: string;
  home_type: string;
};

export type LeaseResident = {
  id: string;
  username: string;
  name: string;
  email?: string;
  profile_picture_url?: string | null;
};

export type HomeLease = {
  id: string;
  home_id: string;
  state: LeaseState;
  source: LeaseSource;
  start_at: string;
  end_at: string | null;
  created_at: string;
  primary_resident?: LeaseResident | null;
  metadata?: Record<string, unknown>;
};

export type HomeOccupant = {
  id: string;
  user_id: string;
  role: string;
  role_base: string;
  verification_status: string;
  is_active: boolean;
  start_at: string | null;
};

export type PropertyDetail = {
  home: {
    id: string;
    name: string;
    address_id: string | null;
    home_type: string;
    owner_id: string | null;
    created_at: string;
  };
  units: PropertyUnit[];
  leases: HomeLease[];
  pending_requests: HomeLease[];
  occupants: HomeOccupant[];
  authority: HomeAuthority;
};

export type TenantRequest = HomeLease & {
  primary_resident: LeaseResident;
};

export type NoticeRecipientType = 'unit' | 'building' | 'tenant';

export type Notice = {
  id: string;
  home_id: string;
  sender_user_id: string;
  recipient_type: NoticeRecipientType;
  recipient_id: string | null;
  subject: string;
  body: string;
  notice_type: string;
  read_at: string | null;
  created_at: string;
};

export type PropertySettings = {
  auto_approve_invites: boolean;
  required_verification_method: string | null;
  staff: StaffMember[];
};

export type StaffMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  created_at: string;
};

// ── Authority ───────────────────────────────────────────────

/** Request authority over a property */
export async function requestAuthority(data: {
  home_id: string;
  subject_type: 'user' | 'business' | 'trust';
  subject_id: string;
  evidence_type: string;
  evidence?: {
    storage_ref?: string | null;
    provider?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
}): Promise<{ authority: HomeAuthority; claim: any | null }> {
  return post('/api/v1/landlord/authority/request', data);
}

// ── Properties ──────────────────────────────────────────────

/** List properties where the user has authority */
export async function getProperties(): Promise<{ properties: HomeAuthority[] }> {
  return get('/api/v1/landlord/properties');
}

/** Get detailed property info */
export async function getPropertyDetail(homeId: string): Promise<PropertyDetail> {
  return get(`/api/v1/landlord/properties/${homeId}`);
}

/** Get pending tenant requests for a property */
export async function getPropertyRequests(homeId: string): Promise<{ requests: TenantRequest[] }> {
  return get(`/api/v1/landlord/properties/${homeId}/requests`);
}

// ── Leases ──────────────────────────────────────────────────

/** Invite a tenant to a unit */
export async function inviteTenant(data: {
  home_id: string;
  authority_id: string;
  invitee_email: string;
  start_at: string;
  end_at?: string | null;
}): Promise<{ invite: any; token: string }> {
  return post('/api/v1/landlord/lease/invite', data);
}

/** Approve a pending tenant lease request */
export async function approveLease(leaseId: string, authorityId: string): Promise<{
  lease: HomeLease;
  occupancy: any;
}> {
  return post(`/api/v1/landlord/lease/${leaseId}/approve`, { authority_id: authorityId });
}

/** Deny a pending tenant lease request */
export async function denyLease(leaseId: string, authorityId: string, reason?: string): Promise<{
  success: boolean;
}> {
  return post(`/api/v1/landlord/lease/${leaseId}/deny`, { authority_id: authorityId, reason });
}

/** End an active lease */
export async function endLease(leaseId: string): Promise<{ success: boolean }> {
  return post(`/api/v1/landlord/lease/${leaseId}/end`, {});
}

// ── Notices ─────────────────────────────────────────────────

/** Send an official notice */
export async function sendNotice(homeId: string, data: {
  recipient_type: NoticeRecipientType;
  recipient_id?: string | null;
  subject: string;
  body: string;
  notice_type: string;
}): Promise<{ notice: Notice }> {
  return post(`/api/v1/landlord/properties/${homeId}/notices`, data);
}

/** Get notices for a property */
export async function getNotices(homeId: string): Promise<{ notices: Notice[] }> {
  return get(`/api/v1/landlord/properties/${homeId}/notices`);
}

// ── Settings ────────────────────────────────────────────────

/** Get property management settings */
export async function getPropertySettings(homeId: string): Promise<{ settings: PropertySettings }> {
  return get(`/api/v1/landlord/properties/${homeId}/settings`);
}

/** Update property management settings */
export async function updatePropertySettings(homeId: string, data: {
  auto_approve_invites?: boolean;
  required_verification_method?: string | null;
}): Promise<{ settings: PropertySettings }> {
  return patch(`/api/v1/landlord/properties/${homeId}/settings`, data);
}

/** Add a staff member */
export async function addStaff(homeId: string, data: {
  email: string;
  role: string;
  permissions: string[];
}): Promise<{ staff: StaffMember }> {
  return post(`/api/v1/landlord/properties/${homeId}/staff`, data);
}

/** Remove a staff member */
export async function removeStaff(homeId: string, staffId: string): Promise<{ success: boolean }> {
  return del(`/api/v1/landlord/properties/${homeId}/staff/${staffId}`);
}

// ── Units (bulk) ────────────────────────────────────────────

/** Import units from CSV */
export async function importUnits(homeId: string, data: {
  units: Array<{ label: string }>;
}): Promise<{ created: number; units: PropertyUnit[] }> {
  return post(`/api/v1/landlord/properties/${homeId}/units/import`, data);
}

/** Generate a range of units */
export async function generateUnits(homeId: string, data: {
  prefix: string;
  start: number;
  end: number;
}): Promise<{ created: number; units: PropertyUnit[] }> {
  return post(`/api/v1/landlord/properties/${homeId}/units/generate`, data);
}

/** Mark a unit as vacant */
export async function markUnitVacant(homeId: string, unitId: string): Promise<{ success: boolean }> {
  return post(`/api/v1/landlord/properties/${homeId}/units/${unitId}/mark-vacant`);
}
