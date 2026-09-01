// ============================================================
// NOTIFICATION ENDPOINTS
// In-app notification management
// ============================================================

import { get, post, del } from '../client';
import apiClient from '../client';
import type { ApiRequestConfig } from '../client';

// Re-exported from @pantopus/types
export type { Notification } from '@pantopus/types/notification';
import type { Notification } from '@pantopus/types/notification';

/**
 * Get notifications for the current user
 */
export async function getNotifications(opts?: {
  limit?: number;
  offset?: number;
  unread?: boolean;
  /**
   * P2.3 / unified-IA §6.1 — firewall context filter.
   * 'all' (default), 'personal', 'audience', 'platform'.
   */
  context?: 'all' | 'personal' | 'audience' | 'platform';
  /**
   * Legacy Identity Firewall axis for non-split bell filters.
   */
  context_type?: 'personal' | 'business';
  context_id?: string;
}): Promise<{ notifications: Notification[]; unreadCount: number; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.unread) params.set('unread', 'true');
  if (opts?.context && opts.context !== 'all') params.set('context', opts.context);
  if (opts?.context_type) params.set('context_type', opts.context_type);
  if (opts?.context_id) params.set('context_id', opts.context_id);
  const qs = params.toString();
  return get(`/api/notifications${qs ? `?${qs}` : ''}`);
}

export interface UnreadCountByContext {
  personal: number;
  audience: number;
  platform: number;
}

/**
 * Get unread count only (lightweight, for badge).
 * Returns the legacy `count` field plus a `byContext` breakdown so the
 * Personal-zone bell and the Audience-zone megaphone (P2.3) can render
 * independently from a single network call.
 */
export async function getUnreadCount(
  config?: ApiRequestConfig,
): Promise<{ count: number; total?: number; byContext?: UnreadCountByContext }> {
  return get('/api/notifications/unread-count', undefined, config);
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<{ notification: Notification }> {
  return apiClient.patch(`/api/notifications/${notificationId}/read`).then(r => r.data);
}

export type NotificationReadScope =
  | { context?: 'all' | 'personal' | 'audience' | 'platform'; contexts?: never; context_type?: 'personal' | 'business'; context_id?: string }
  | { contexts?: Array<'personal' | 'audience' | 'platform'>; context?: never; context_type?: 'personal' | 'business'; context_id?: string };

/**
 * Mark notifications as read, optionally scoped to a firewall stream.
 */
export async function markAllAsRead(scope?: NotificationReadScope): Promise<{ message: string }> {
  return post('/api/notifications/read-all', scope || {});
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<{ message: string }> {
  return del(`/api/notifications/${notificationId}`);
}

/**
 * Register an Expo push token for the current user's device.
 */
export async function registerPushToken(token: string): Promise<{ message: string }> {
  return post('/api/notifications/push-token', { token });
}

/**
 * Unregister an Expo push token (e.g. on logout).
 */
export async function unregisterPushToken(token: string): Promise<{ message: string }> {
  return del('/api/notifications/push-token', { token });
}

/**
 * Check if the user is eligible for the no-bid gig nudge floating modal.
 * Returns whether they have an unread no_bid_gig_nudge notification
 * and whether they have a verified home address.
 */
export async function getNoBidNudgeCheck(): Promise<{ eligible: boolean; hasHome?: boolean }> {
  return get('/api/notifications/no-bid-nudge-check');
}

/**
 * Mark all no_bid_gig_nudge notifications as read.
 * Called after the floating modal fires (or was already dismissed)
 * so the trigger won't block lower-priority promos on next app open.
 */
export async function markNoBidNudgeRead(): Promise<{ ok: boolean }> {
  return post('/api/notifications/no-bid-nudge-mark-read');
}
