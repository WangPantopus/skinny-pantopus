// ============================================================
// HUB ENDPOINTS
// Aggregated hub payload for Mission Control + Discovery
// ============================================================

import { get, post, put } from '../client';
import type { UserNotificationPreferences, HubToday } from '@pantopus/types';

// ---- Types ----

export type ActionItemType =
  | 'chat_unread'
  | 'mail_new'
  | 'bill_due'
  | 'task_due'
  | 'gig_update'
  | 'package_update'
  | 'business_order'
  | 'system_alert';

export type ActionItemSeverity = 'info' | 'warning' | 'critical';

export interface ActionItem {
  id: string;
  type: ActionItemType;
  pillar: 'personal' | 'home' | 'business';
  title: string;
  subtitle?: string;
  severity: ActionItemSeverity;
  count?: number;
  dueAt?: string;
  route: string;
  entityRef?: { kind: string; id: string };
}

export interface SetupStep {
  key: string;
  done: boolean;
}

export interface HubHome {
  id: string;
  name: string;
  addressShort: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
  roleBase: string;
}

export interface HubBusiness {
  id: string;
  name: string;
  username: string;
  roleBase: string;
}

export interface HubBillDue {
  id: string;
  name: string;
  amount: number;
  dueAt: string;
}

export interface HubTaskDue {
  id: string;
  title: string;
  dueAt: string;
}

export interface HubPersonalCard {
  unreadChats: number;
  earnings: number;
  gigsNearby: number;
  rating: number;
  reviewCount: number;
}

export interface HubHomeCard {
  newMail: number;
  billsDue: HubBillDue[];
  tasksDue: HubTaskDue[];
  memberCount: number;
}

export interface HubBusinessCard {
  newOrders: number;
  unreadThreads: number;
  pendingPayout: number;
}

export interface JumpBackInItem {
  title: string;
  route: string;
  icon?: string;
}

export interface ActivityItem {
  id: string;
  pillar: 'personal' | 'home' | 'business';
  title: string;
  at: string;
  read: boolean;
  route: string;
}

export interface NeighborDensity {
  count: number;
  radiusMiles: number;
  milestone: string | null;
}

export interface HubPayload {
  user: {
    id: string;
    name: string;
    firstName: string | null;
    username: string;
    avatarUrl: string | null;
    email: string;
  };
  context: {
    activeHomeId: string | null;
    activePersona: { type: 'personal' } | { type: 'business'; businessId: string };
  };
  availability: {
    hasHome: boolean;
    hasBusiness: boolean;
    hasPayoutMethod: boolean;
  };
  homes: HubHome[];
  businesses: HubBusiness[];
  setup: {
    steps: SetupStep[];
    allDone: boolean;
  };
  statusItems: ActionItem[];
  cards: {
    personal: HubPersonalCard;
    home?: HubHomeCard;
    business?: HubBusinessCard;
  };
  jumpBackIn: JumpBackInItem[];
  activity: ActivityItem[];
  neighborDensity: NeighborDensity | null;
}

export interface BriefingDelivery {
  id: string;
  briefing_date_local: string;
  briefing_kind: 'morning' | 'evening';
  summary_text: string;
  signals_snapshot: unknown[];
  location_geohash: string | null;
  composition_mode: string | null;
  status: string | null;
  delivered_at: string | null;
  created_at: string | null;
}

// ---- Discovery Types ----

export interface DiscoveryItem {
  id: string;
  type: 'gig' | 'person' | 'business' | 'post';
  title: string;
  meta: string | null;
  category?: string;
  avatarUrl?: string;
  route: string;
}

export interface DiscoveryResponse {
  filter: string;
  items: DiscoveryItem[];
}

export type DiscoveryFilter = 'gigs' | 'people' | 'businesses' | 'posts';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Endpoints ----

/**
 * Get aggregated hub data (Mission Control)
 */
export async function getHub(): Promise<HubPayload> {
  return get<HubPayload>('/api/hub');
}

function isHubTodayPayload(payload: unknown): payload is HubToday {
  return Boolean(
    payload
      && typeof payload === 'object'
      && 'display_mode' in payload
      && 'summary' in payload
  );
}

/**
 * Get Hub Today data only (weather, AQI, alerts, signals)
 */
export async function getHubToday(options: {
  retries?: number;
  retryDelayMs?: number;
} = {}): Promise<HubToday | null> {
  const { retries = 0, retryDelayMs = 0 } = options;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const payload = await get<HubToday | { today: null; error?: string }>('/api/hub/today');
      if (isHubTodayPayload(payload)) {
        return payload;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries && retryDelayMs > 0) {
      await delay(retryDelayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

/**
 * Get a saved briefing delivery, scoped to the authenticated user.
 */
export async function getBriefingDelivery(id: string): Promise<{ briefing: BriefingDelivery }> {
  return get<{ briefing: BriefingDelivery }>(`/api/hub/briefings/${id}`);
}

/**
 * Update user's hub preferences (active home, persona)
 */
export async function updateHubContext(data: {
  activeHomeId?: string | null;
  activePersona?: { type: 'personal' } | { type: 'business'; businessId: string };
}): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/hub/context', data);
}

/**
 * Get discovery items for the hub (nearby gigs, people, businesses, posts)
 */
/**
 * Dismiss a density milestone so it won't show again
 */
export async function dismissDensityMilestone(homeId: string, milestone: number): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/hub/dismiss-density-milestone', { homeId, milestone });
}

/**
 * Get discovery items for the hub (nearby gigs, people, businesses, posts)
 */
export async function getDiscovery(params: {
  filter: DiscoveryFilter;
  lat?: number;
  lng?: number;
  limit?: number;
}): Promise<DiscoveryResponse> {
  return get<DiscoveryResponse>('/api/hub/discovery', params);
}

/**
 * Get notification preferences (or defaults if none set)
 */
export async function getHubPreferences(): Promise<{ preferences: UserNotificationPreferences }> {
  return get<{ preferences: UserNotificationPreferences }>('/api/hub/preferences');
}

/**
 * Update notification preferences (partial update)
 */
export async function updateHubPreferences(
  data: Partial<UserNotificationPreferences>,
): Promise<{ preferences: UserNotificationPreferences }> {
  return put<{ preferences: UserNotificationPreferences }>('/api/hub/preferences', data);
}
