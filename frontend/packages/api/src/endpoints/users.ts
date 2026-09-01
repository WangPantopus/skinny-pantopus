// ============================================================
// USER ENDPOINTS
// User profile, skills, and social features
// ============================================================

import { get, post, put, patch, del } from '../client';
import type { User, UserProfile, ProfileUpdateForm, ApiResponse, MonthlyReceipt, InviteProgress } from '@pantopus/types';

function cleanPathParam(value: string): string {
  return encodeURIComponent(String(value || '').trim().replace(/^@+/, ''));
}

/**
 * Get user profile by username (legacy — prefer getProfileById for UUID lookups)
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  return get<UserProfile>(`/api/users/${cleanPathParam(userId)}`);
}

/**
 * Get full public profile by user UUID
 */
export async function getProfileById(userId: string): Promise<UserProfile> {
  return get<UserProfile>(`/api/users/id/${cleanPathParam(userId)}`);
}

/**
 * Get user profile by username
 */
export async function getProfileByUsername(username: string): Promise<UserProfile> {
  return get<UserProfile>(`/api/users/username/${cleanPathParam(username)}`);
}

/**
 * Get current user's profile
 */
export async function getMyProfile(): Promise<UserProfile> {
  const response = await get<any>('/api/users/profile');
  // Backend wraps response in { user: {...} }, so unwrap it
  return response.user || response;
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: ProfileUpdateForm): Promise<{ user: User }> {
  return patch<{ user: User }>('/api/users/profile', data);
}

/**
 * Add a skill to user profile
 */
export async function addSkill(skill: string): Promise<ApiResponse> {
  return post<ApiResponse>('/api/users/skills', { skill });
}

/**
 * Remove a skill from user profile
 */
export async function removeSkill(skillId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/users/skills/${skillId}`);
}

/**
 * Update user skills (bulk update)
 */
export async function updateSkills(skills: string[]): Promise<{ skills: string[] }> {
  return put<{ skills: string[] }>('/api/users/skills', { skills });
}

/**
 * Follow a user
 */
export async function followUser(userId: string): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/users/${userId}/follow`);
}

/**
 * Unfollow a user
 */
export async function unfollowUser(userId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/users/${userId}/follow`);
}

/**
 * Get user's followers
 */
export async function getFollowers(userId?: string): Promise<{ followers: User[] }> {
  const endpoint = userId ? `/api/users/${userId}/followers` : '/api/users/followers';
  return get<{ followers: User[] }>(endpoint);
}

/**
 * Get users that this user is following
 */
export async function getFollowing(userId?: string): Promise<{ following: User[] }> {
  const endpoint = userId ? `/api/users/${userId}/following` : '/api/users/following';
  return get<{ following: User[] }>(endpoint);
}

/**
 * Search users
 */
export async function searchUsers(query: string, filters?: {
  skills?: string[];
  city?: string;
  type?: 'all' | 'people' | 'business';
  limit?: number;
}): Promise<{ users: User[] }> {
  return get<{ users: User[] }>('/api/users/search', { 
    q: query,
    ...filters 
  });
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<{
  total_gigs_completed: number;
  total_gigs_posted: number;
  total_earnings: number;
  average_rating: number;
  total_ratings: number;
}> {
  return get(`/api/users/${userId}/stats`);
}

/**
 * Update user location
 */
export async function updateLocation(latitude: number, longitude: number): Promise<ApiResponse> {
  return put<ApiResponse>('/api/users/location', {
    latitude,
    longitude,
  });
}

/**
 * Get nearby users
 */
export async function getNearbyUsers(params: {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
  limit?: number;
}): Promise<{ users: User[] }> {
  return get<{ users: User[] }>('/api/users/nearby', params);
}

/**
 * Check follow status with a user
 */
export async function getFollowStatus(userId: string): Promise<{ following: boolean }> {
  return get<{ following: boolean }>(`/api/users/${userId}/follow/status`);
}

/**
 * Get combined relationship status with a user
 * Returns follow + connection status for profile display.
 */
export async function getRelationshipStatus(userId: string): Promise<{
  relationship: 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';
  following: boolean;
  followed_by: boolean;
}> {
  return get(`/api/users/${userId}/relationship`);
}

/**
 * Send batched implicit view signals for affinity scoring.
 * Fire-and-forget — callers should not await this.
 */
export function sendSignals(signals: Array<{
  gig_id: string;
  category: string;
  dwell_ms: number;
  timestamp: string;
}>): Promise<{ processed: number }> {
  return post<{ processed: number }>('/api/users/me/signals', { signals });
}

/**
 * Permanently delete the authenticated user's account and all associated data.
 * This cannot be undone.
 */
export async function deleteAccount(): Promise<{ message: string }> {
  return del('/api/users/account');
}

/**
 * Get (or create) the authenticated user's stable invite code.
 */
export async function getInviteCode(): Promise<{ invite_code: string; invite_url: string }> {
  return get<{ invite_code: string; invite_url: string }>('/api/users/me/invite-code');
}

/**
 * Get monthly receipt for a given year/month.
 * Returns stored receipt or computes on-demand.
 */
export async function getMonthlyReceipt(year: number, month: number): Promise<MonthlyReceipt> {
  return get<MonthlyReceipt>('/api/users/me/monthly-receipt', { year, month });
}

/**
 * Get invite progress: referral counts, unlocked features, next unlock.
 */
export async function getInviteProgress(): Promise<InviteProgress> {
  return get<InviteProgress>('/api/users/me/invite-progress');
}

/**
 * Report an abusive user for moderation review.
 */
export async function reportUser(userId: string, reason: string, details?: string): Promise<{
  message: string;
  already_reported: boolean;
}> {
  return post(`/api/users/${userId}/report`, { reason, details });
}
