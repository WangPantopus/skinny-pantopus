// ============================================================
// RELATIONSHIP / CONNECTION ENDPOINTS (Trust Graph)
// Mutual connections: request → accept model
// ============================================================

import { get, post, del } from '../client';

// ============ TYPES ============

export type RelationshipStatus = 'pending' | 'accepted' | 'blocked';

export interface RelationshipUser {
  id: string;
  username: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  city?: string;
  state?: string;
}

export interface Relationship {
  id: string;
  status: RelationshipStatus;
  created_at: string;
  responded_at?: string;
  accepted_at?: string;
  blocked_by?: string;
  requester: RelationshipUser;
  addressee: RelationshipUser;
  other_user?: RelationshipUser;
  direction?: 'sent' | 'received';
}

export interface ConnectionRequest {
  id: string;
  status: string;
  created_at: string;
  requester?: RelationshipUser;
  addressee?: RelationshipUser;
}

// ============ ENDPOINTS ============

/**
 * Send a connection request to a user
 */
export async function sendRequest(addresseeId: string, message?: string): Promise<{
  message: string;
  relationship: Relationship;
}> {
  return post('/api/relationships/requests', {
    addressee_id: addresseeId,
    message,
  });
}

/**
 * Accept a connection request
 */
export async function acceptRequest(relationshipId: string): Promise<{
  message: string;
  relationship: Relationship;
}> {
  return post(`/api/relationships/${relationshipId}/accept`);
}

/**
 * Reject a connection request
 */
export async function rejectRequest(relationshipId: string): Promise<{ message: string }> {
  return post(`/api/relationships/${relationshipId}/reject`);
}

/**
 * Block a user from an existing relationship
 */
export async function blockFromRelationship(relationshipId: string, reason?: string): Promise<{
  message: string;
  relationship: Relationship;
}> {
  return post(`/api/relationships/${relationshipId}/block`, { reason });
}

/**
 * Block a user by their user ID (no existing relationship needed)
 */
export async function blockUser(userId: string, reason?: string): Promise<{
  message: string;
  relationship: Relationship;
}> {
  return post('/api/relationships/block-user', {
    user_id: userId,
    reason,
  });
}

/**
 * Unblock a user
 */
export async function unblock(relationshipId: string): Promise<{ message: string }> {
  return post(`/api/relationships/${relationshipId}/unblock`);
}

/**
 * Disconnect from a user (remove accepted connection)
 */
export async function disconnect(relationshipId: string): Promise<{ message: string }> {
  return del(`/api/relationships/${relationshipId}`);
}

/**
 * Get my connections (filtered by status)
 */
export async function getRelationships(params?: {
  status?: RelationshipStatus;
  limit?: number;
  offset?: number;
}): Promise<{ relationships: Relationship[] }> {
  return get('/api/relationships', params);
}

/**
 * Get my accepted connections
 */
export async function getConnections(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ relationships: Relationship[] }> {
  return get('/api/relationships', { status: 'accepted', ...params });
}

/**
 * Get pending connection requests received by me
 */
export async function getPendingRequests(): Promise<{ requests: ConnectionRequest[] }> {
  return get('/api/relationships/requests/pending');
}

/**
 * Get connection requests sent by me
 */
export async function getSentRequests(): Promise<{ requests: ConnectionRequest[] }> {
  return get('/api/relationships/requests/sent');
}

/**
 * Get users I've blocked
 */
export async function getBlockedUsers(): Promise<{ blocked: any[] }> {
  return get('/api/relationships/blocked');
}
