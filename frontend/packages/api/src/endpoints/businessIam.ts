// ============================================================
// BUSINESS IAM ENDPOINTS
// Team management, role presets, permissions, audit log
// ============================================================

import { get, post, del } from '../client';

// ---- Types ----

export interface BusinessAccess {
  hasAccess: boolean;
  isOwner: boolean;
  role_base: string | null;
  permissions: string[];
  membership: {
    id: string;
    role_base: string;
    title?: string;
    joined_at: string;
  } | null;
}

export interface BusinessRolePreset {
  key: string;
  display_name: string;
  description: string;
  role_base: string;
  grant_perms: string[];
  deny_perms: string[];
  icon_key: string | null;
  sort_order: number;
}

export interface BusinessTeamMember {
  id: string;
  role_base: string;
  title?: string;
  joined_at: string;
  invited_at?: string;
  notes?: string;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
    profile_picture_url?: string;
  };
}

export interface BusinessAuditEntry {
  id: string;
  business_user_id: string;
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

// ---- My Access ----

/**
 * Get current user's access & permissions for a business
 */
export async function getMyBusinessAccess(businessId: string): Promise<BusinessAccess> {
  return get<BusinessAccess>(`/api/businesses/${businessId}/me`);
}

// ---- Role Presets ----

/**
 * Get available role presets
 */
export async function getRolePresets(businessId: string): Promise<{ presets: BusinessRolePreset[] }> {
  return get<{ presets: BusinessRolePreset[] }>(`/api/businesses/${businessId}/role-presets`);
}

// ---- Team Members ----

/**
 * List team members
 */
export async function getTeamMembers(businessId: string): Promise<{ members: BusinessTeamMember[] }> {
  return get<{ members: BusinessTeamMember[] }>(`/api/businesses/${businessId}/members`);
}

/**
 * Add/invite a team member
 */
export async function addTeamMember(businessId: string, data: {
  user_id?: string;
  username?: string;
  role_base?: string;
  title?: string;
  notes?: string;
}): Promise<{ message: string; user_id: string; role_base: string }> {
  return post(`/api/businesses/${businessId}/members`, data);
}

/**
 * Apply a role preset to a member
 */
export async function applyMemberPreset(businessId: string, userId: string, data: {
  preset_key: string;
  title?: string;
}): Promise<{ message: string; preset_key: string; role_base: string }> {
  return post(`/api/businesses/${businessId}/members/${userId}/role`, data);
}

/**
 * Update a member's role directly
 */
export async function updateMemberRole(businessId: string, userId: string, data: {
  role_base: string;
  title?: string;
}): Promise<{ message: string; role_base: string }> {
  return post(`/api/businesses/${businessId}/members/${userId}/role`, data);
}

/**
 * Toggle a specific permission override
 */
export async function toggleMemberPermission(businessId: string, userId: string, data: {
  permission: string;
  allowed: boolean;
}): Promise<{ message: string; permission: string; allowed: boolean }> {
  return post(`/api/businesses/${businessId}/members/${userId}/permissions`, data);
}

/**
 * Get a member's permissions
 */
export async function getMemberPermissions(businessId: string, userId: string): Promise<{
  permissions: string[];
  role_base: string;
}> {
  return get(`/api/businesses/${businessId}/members/${userId}/permissions`);
}

/**
 * Remove a team member
 */
export async function removeMember(businessId: string, userId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/members/${userId}`);
}

// ---- Audit Log ----

/**
 * Get audit log entries
 */
export async function getAuditLog(businessId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ entries: BusinessAuditEntry[] }> {
  return get<{ entries: BusinessAuditEntry[] }>(`/api/businesses/${businessId}/audit-log`, params);
}
