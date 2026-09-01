// ============================================================
// PERSONA MEMBERSHIP LIFECYCLE (P1.13)
// Audience Profile design v2 §7.3 + §11.6.
// All five endpoints addressed by the persona id; the calling
// fan's own membership is loaded server-side.
// ============================================================

import { get, post } from '../client';

// FanMembershipPayload mirrors serializeMembershipForFan output.
// Persona is rendered through the existing audience profile
// serializer; tier carries policy + price; Stripe identifiers are
// never exposed.
export interface FanMembershipPayload {
  membershipId: string;
  persona: {
    type: 'persona';
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    followerCount: number;
  };
  fanHandle: string;
  fanDisplayName: string;
  fanAvatarUrl: string | null;
  tier: {
    id: string;
    rank: number;
    name: string;
    priceCents: number;
    currency: string;
    billingInterval: 'month' | 'year';
    msgThreadsPerPeriod: number | null;
    creatorCanInitiateDm: boolean;
    replyPolicy: 'discretion' | 'within_3_days' | 'within_7_days' | 'within_14_days' | 'always';
  };
  status: 'active' | 'past_due' | 'paused' | 'canceled_pending' | 'canceled' | 'expired';
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  scheduledTierChange: { tierId: string } | null;
  quotaRemaining: {
    msgThreads: number | null;
    videoCalls: number | null;
  };
}

export async function getMyMembership(personaId: string): Promise<{ membership: FanMembershipPayload }> {
  return get<{ membership: FanMembershipPayload }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership`,
  );
}

export async function upgradeMembership(
  personaId: string,
  tierRank: number,
): Promise<{ membership: FanMembershipPayload }> {
  return post<{ membership: FanMembershipPayload }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership/upgrade`,
    { tier_rank: tierRank },
  );
}

export async function downgradeMembership(
  personaId: string,
  tierRank: number,
): Promise<{ membership: FanMembershipPayload }> {
  return post<{ membership: FanMembershipPayload }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership/downgrade`,
    { tier_rank: tierRank },
  );
}

export async function cancelMembership(
  personaId: string,
): Promise<{ membership: FanMembershipPayload }> {
  return post<{ membership: FanMembershipPayload }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership/cancel`,
    {},
  );
}

export async function requestRefund(
  personaId: string,
  payload: { reason: 'sla_missed' | 'period_unused'; thread_id?: string },
): Promise<{ membership: FanMembershipPayload }> {
  return post<{ membership: FanMembershipPayload }>(
    `/api/personas/${encodeURIComponent(personaId)}/membership/refund-request`,
    payload,
  );
}
