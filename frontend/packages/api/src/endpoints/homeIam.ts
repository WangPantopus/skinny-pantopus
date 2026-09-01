// ============================================================
// HOME IAM ENDPOINTS
// Role presets, permission management, member management, audit
// ============================================================

import { get, post, del } from '../client';

// ---- Types ----

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
}

export interface RolePreset {
  key: string;
  display_name: string;
  description: string;
  role_base: string;
  grant_perms: string[];
  deny_perms: string[];
  icon_key: string | null;
  sort_order: number;
}

export interface RoleTemplate {
  role_base: string;
  display_name: string;
  description: string;
  sort_order: number;
  icon_key: string | null;
}

export interface AuditEntry {
  id: string;
  home_id: string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string;
  };
}

export interface GuestPass {
  id: string;
  home_id: string;
  label: string;
  kind: 'wifi_only' | 'guest' | 'airbnb' | 'vendor';
  role_base: string;
  included_sections: string[];
  custom_title: string | null;
  passcode_hash: string | null;
  max_views: number | null;
  view_count: number;
  start_at: string;
  end_at: string | null;
  revoked_at: string | null;
  created_at: string;
  status?: 'active' | 'expired' | 'revoked';
  last_viewed_at?: string | null;
}

export interface ScopedGrant {
  id: string;
  home_id: string;
  resource_type: string;
  resource_id: string;
  can_view: boolean;
  can_edit: boolean;
  start_at: string;
  end_at: string;
  max_views: number | null;
  view_count: number;
  created_by: string;
  created_at: string;
}

// ---- Members ----

/**
 * Get members of a home (occupants + pending invites).
 * Alias so callers can use `api.homeIam.getHomeMembers(id)` alongside
 * other IAM helpers without reaching into homeProfile.
 */
export async function getHomeMembers(homeId: string): Promise<{ members: any[] }> {
  return get<{ members: any[] }>(`/api/homes/${homeId}/occupants`);
}

// ---- My Access ----

/**
 * Get current user's access & permissions for a home
 */
export async function getMyHomeAccess(homeId: string): Promise<HomeAccess> {
  return get<HomeAccess>(`/api/homes/${homeId}/me`);
}

// ---- Role Presets ----

/**
 * Get available role presets for invite/management UI
 */
export async function getRolePresets(homeId: string): Promise<{ presets: RolePreset[] }> {
  return get<{ presets: RolePreset[] }>(`/api/homes/${homeId}/role-presets`);
}

/**
 * Get role template metadata (display names, icons)
 */
export async function getRoleTemplates(homeId: string): Promise<{ templates: RoleTemplate[] }> {
  return get<{ templates: RoleTemplate[] }>(`/api/homes/${homeId}/role-templates`);
}

// ---- Member Role Management ----

/**
 * Update a member's role using a preset
 */
export async function applyMemberPreset(homeId: string, userId: string, data: {
  preset_key: string;
  start_at?: string;
  end_at?: string;
}): Promise<{ message: string; preset_key: string; role_base: string }> {
  return post(`/api/homes/${homeId}/members/${userId}/role`, data);
}

/**
 * Update a member's role_base directly
 */
export async function updateMemberRole(homeId: string, userId: string, data: {
  role_base: string;
  start_at?: string;
  end_at?: string;
}): Promise<{ message: string; role_base: string }> {
  return post(`/api/homes/${homeId}/members/${userId}/role`, data);
}

/**
 * Toggle a specific permission override for a member
 */
export async function toggleMemberPermission(homeId: string, userId: string, data: {
  permission: string;
  allowed: boolean;
}): Promise<{ message: string; permission: string; allowed: boolean }> {
  return post(`/api/homes/${homeId}/members/${userId}/permissions`, data);
}

/**
 * Get a member's full permission list
 */
export async function getMemberPermissions(homeId: string, userId: string): Promise<{
  permissions: string[];
  role_base: string;
}> {
  return get(`/api/homes/${homeId}/members/${userId}/permissions`);
}

/**
 * Remove/revoke a member from the home
 */
export async function removeMember(homeId: string, userId: string): Promise<{ message: string }> {
  return del(`/api/homes/${homeId}/members/${userId}`);
}

// ---- Audit Log ----

/**
 * Get the audit log for a home
 */
export async function getAuditLog(homeId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditEntry[] }> {
  return get<{ entries: AuditEntry[] }>(`/api/homes/${homeId}/audit-log`, params);
}

// ---- Guest Passes (V2) ----

/**
 * Create a guest pass (returns one-time token)
 */
export async function createGuestPass(homeId: string, data: {
  label: string;
  kind?: 'wifi_only' | 'guest' | 'airbnb' | 'vendor';
  included_sections?: string[];
  custom_title?: string;
  duration_hours?: number;
  start_at?: string;
  end_at?: string;
  passcode?: string;
  max_views?: number;
  permissions?: Record<string, any>;
}): Promise<{ pass: GuestPass; token: string }> {
  return post(`/api/homes/${homeId}/guest-passes`, data);
}

/**
 * List guest passes (enriched with status and view info)
 */
export async function getGuestPasses(homeId: string, params?: {
  include_revoked?: boolean;
}): Promise<{ passes: GuestPass[] }> {
  return get<{ passes: GuestPass[] }>(`/api/homes/${homeId}/guest-passes`, params);
}

/**
 * Revoke a guest pass
 */
export async function revokeGuestPass(homeId: string, passId: string): Promise<{ message: string; pass: GuestPass }> {
  return del(`/api/homes/${homeId}/guest-passes/${passId}`);
}

// ---- Scoped Grants ----

/**
 * Create a scoped share link for a single resource (returns one-time token)
 */
export async function createScopedGrant(homeId: string, data: {
  resource_type: string;
  resource_id: string;
  duration_hours?: number;
  passcode?: string;
  can_edit?: boolean;
  permission_scope?: string;
}): Promise<{ grant: ScopedGrant; token: string }> {
  return post(`/api/homes/${homeId}/scoped-grants`, data);
}
