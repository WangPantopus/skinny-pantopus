import { del, get, patch, post } from '../client';
import type {
  AudienceMemberAction,
  AudienceMembersResponse,
  AudienceMembersSort,
  AudienceProfile,
  BeaconFollowingResponse,
  BeaconFollowingSort,
  BroadcastChannel,
  PersonaFollower,
  PersonaFollowerCounts,
  PersonaNotificationLevel,
  PersonaRelationshipType,
  Post,
} from '@pantopus/types';

export interface PersonaPayload {
  handle: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  public_links?: Array<{ label: string; url: string }>;
  category?: string;
  audience_label?: string;
  audience_mode?: string;
}

export interface PersonaCategoryPolicy {
  category: string;
  label: string;
  sensitive: boolean;
  enabled: boolean;
  defaultAudienceMode?: string;
  requirements: string[];
}

export async function createPersona(payload: PersonaPayload): Promise<{ persona: AudienceProfile; channel: BroadcastChannel | null }> {
  return post('/api/personas', payload);
}

export async function getMyPersona(): Promise<{ persona: AudienceProfile | null; channel: BroadcastChannel | null }> {
  return get('/api/personas/me');
}

export interface AudienceIdentity {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  publicPersonaId: string | null;
  source: 'generated' | 'user_selected' | 'persona_bound' | 'legacy_backfill';
  status: 'active' | 'disabled';
}

export async function getMyAudienceIdentity(): Promise<{ identity: AudienceIdentity | null }> {
  return get('/api/personas/audience-identity/me');
}

export async function getPersonaCategoryPolicies(): Promise<{
  categories: PersonaCategoryPolicy[];
  sensitiveCategoriesEnabled: boolean;
}> {
  return get('/api/personas/compliance/categories');
}

export async function updatePersona(id: string, payload: Partial<PersonaPayload>): Promise<{ persona: AudienceProfile }> {
  return patch(`/api/personas/${encodeURIComponent(id)}`, payload);
}

export async function getPersona(handle: string): Promise<{ persona: AudienceProfile; channel: BroadcastChannel | null }> {
  return get(`/api/personas/${encodeURIComponent(handle.replace(/^@/, ''))}`);
}

export async function getPersonaPosts(handle: string): Promise<{ posts: Post[] }> {
  return get(`/api/personas/${encodeURIComponent(handle.replace(/^@/, ''))}/posts`);
}

export async function followPersona(id: string): Promise<{ status: string }> {
  return post(`/api/personas/${encodeURIComponent(id)}/follow`);
}

// P1.8 — privacy-handshake first-follow.
//
// For tier_rank === 1 the response includes the legacy follow shape
// plus the new membership. For tier_rank > 1 the response is
// { requiresPayment: true, subscribeUrl: null, handshake: {...} };
// P1.9 wires up the subscribeUrl for Stripe Checkout.
export interface PersonaHandshakePayload {
  tier_rank: number;
  fan_handle: string;
  fan_display_name?: string | null;
  fan_avatar_url?: string | null;
  acknowledged_platform_trust: true;
  acknowledged_using_pantopus_username?: boolean;
}

export interface PersonaHandshakeResponse {
  status?: string;
  follow?: unknown;
  membership?: { id: string; audience_identity_id?: string; fan_handle: string; tier_id: string; status: string };
  requiresPayment?: boolean;
  subscribeUrl?: string | null;
  handshake?: {
    tier_rank: number;
    tier_id: string;
    audience_identity_id?: string;
    fan_handle: string;
    fan_display_name: string;
    fan_avatar_url: string | null;
  };
}

export async function followPersonaWithHandshake(
  id: string,
  payload: PersonaHandshakePayload,
): Promise<PersonaHandshakeResponse> {
  return post<PersonaHandshakeResponse>(
    `/api/personas/${encodeURIComponent(id)}/follow`,
    payload,
  );
}

export async function getFanHandleSuggestion(
  handle: string,
): Promise<{ suggestion: string; identity?: AudienceIdentity | null; locked?: boolean }> {
  const cleaned = handle.replace(/^@/, '');
  return get<{ suggestion: string; identity?: AudienceIdentity | null; locked?: boolean }>(
    `/api/personas/${encodeURIComponent(cleaned)}/fan-handle-suggestion`,
  );
}

// P1.10 — owner-only aggregate counts for the broadcast composer's
// tier-visibility selector. Returns running totals across the four
// ranks (followers includes all paid tiers; members includes
// insiders + direct; etc.).
export interface MembershipStats {
  followers: number;
  members: number;
  insiders: number;
  direct: number;
}

export async function getMembershipStats(
  personaId: string,
): Promise<{ counts: MembershipStats }> {
  return get<{ counts: MembershipStats }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership-stats`,
  );
}

export async function unfollowPersona(id: string): Promise<{ message: string }> {
  return del(`/api/personas/${encodeURIComponent(id)}/follow`);
}

export async function getPersonaFollowStatus(id: string): Promise<{
  following: boolean;
  status: string;
  relationshipType?: string | null;
  notificationLevel: PersonaNotificationLevel;
}> {
  return get(`/api/personas/${encodeURIComponent(id)}/follow/status`);
}

export async function updatePersonaFollowPreferences(id: string, payload: {
  notification_level: PersonaNotificationLevel;
}): Promise<{
  following: boolean;
  status: string;
  relationshipType?: string | null;
  notificationLevel: PersonaNotificationLevel;
}> {
  return patch(`/api/personas/${encodeURIComponent(id)}/follow/preferences`, payload);
}

export async function getPersonaFollowers(id: string, params: {
  status?: string;
  limit?: number;
} = {}): Promise<{ followers: PersonaFollower[]; counts: PersonaFollowerCounts }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return get(`/api/personas/${encodeURIComponent(id)}/followers${query ? `?${query}` : ''}`);
}

export async function updatePersonaFollower(id: string, followId: string, payload: {
  status?: 'pending' | 'active' | 'muted' | 'blocked' | 'removed';
  relationship_type?: PersonaRelationshipType;
  notification_level?: PersonaNotificationLevel;
}): Promise<{ follower: PersonaFollower }> {
  return patch(`/api/personas/${encodeURIComponent(id)}/followers/${encodeURIComponent(followId)}`, payload);
}

// "Beacons You Follow" management screen — fan-side surface.
// Backed by GET /api/personas/me/following.
export interface GetMyFollowingParams {
  sort?: BeaconFollowingSort;
  limit?: number;
  offset?: number;
}

export async function getMyFollowing(
  params: GetMyFollowingParams = {},
): Promise<BeaconFollowingResponse> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return get<BeaconFollowingResponse>(`/api/personas/me/following${query ? `?${query}` : ''}`);
}

// Zero out the unread count for one beacon (idempotent).
export async function markFollowingSeen(
  personaId: string,
): Promise<{ unreadCount: number; lastSeenAt?: string } | null> {
  // The endpoint returns 204 when the membership is missing — the client
  // wraps that as `null` so callers can treat it the same as success.
  try {
    return await post<{ unreadCount: number; lastSeenAt?: string }>(
      `/api/personas/me/following/${encodeURIComponent(personaId)}/seen`,
    );
  } catch {
    return null;
  }
}

// Temporary mute. Pass `days: null` to clear an active mute.
export async function muteFollowing(
  personaId: string,
  days: number | null,
): Promise<{ mutedUntil: string | null }> {
  return patch<{ mutedUntil: string | null }>(
    `/api/personas/me/following/${encodeURIComponent(personaId)}/mute`,
    { days },
  );
}

// Bulk unfollow — fans out to existing per-row endpoints rather than
// introducing a new bulk endpoint server-side. Paid memberships reject
// with code `paid_membership_managed_by_subscription` (409); we collect
// those into `skippedPaid` so the caller can surface "N paid memberships
// were skipped — manage in Audience".
export interface BulkUnfollowResult {
  succeeded: string[];
  skippedPaid: string[];
  failed: Array<{ personaId: string; error: string }>;
}

// "Your audience" management surface — owner-side.
// Backed by GET /api/personas/me/audience (privacy-correct via the
// fan_handle serializer).
export interface GetMyAudienceParams {
  sort?: AudienceMembersSort;
  /** Comma-separated subset of pending / active / muted / past_due / canceled_pending / paused; default 'all'. */
  status?: string;
  tier_rank?: 1 | 2 | 3 | 4;
  limit?: number;
  offset?: number;
}

export async function getMyAudience(
  params: GetMyAudienceParams = {},
): Promise<AudienceMembersResponse> {
  const qs = new URLSearchParams();
  if (params.sort) qs.set('sort', params.sort);
  if (params.status) qs.set('status', params.status);
  if (params.tier_rank) qs.set('tier_rank', String(params.tier_rank));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return get<AudienceMembersResponse>(`/api/personas/me/audience${query ? `?${query}` : ''}`);
}

export async function updateAudienceMember(
  membershipId: string,
  action: AudienceMemberAction,
): Promise<{ membershipId: string; status: string }> {
  return patch<{ membershipId: string; status: string }>(
    `/api/personas/me/audience/${encodeURIComponent(membershipId)}`,
    { action },
  );
}

export async function unfollowMany(personaIds: string[]): Promise<BulkUnfollowResult> {
  const results = await Promise.allSettled(
    personaIds.map((id) => unfollowPersona(id).then(() => id)),
  );
  const out: BulkUnfollowResult = { succeeded: [], skippedPaid: [], failed: [] };
  results.forEach((r: PromiseSettledResult<string>, i: number) => {
    const id = personaIds[i];
    if (r.status === 'fulfilled') {
      out.succeeded.push(id);
      return;
    }
    const reason: any = r.reason;
    const message = (reason && (reason.message || reason.error)) || 'Unknown error';
    const code = reason && (reason.code || (reason.body && reason.body.code));
    if (code === 'paid_membership_managed_by_subscription' || /paid membership/i.test(String(message))) {
      out.skippedPaid.push(id);
    } else {
      out.failed.push({ personaId: id, error: String(message) });
    }
  });
  return out;
}
