// ============================================================
// PERSONA TIERS — owner CRUD + public list
// Audience Profile design v2 §10. Endpoints:
//   GET    /api/personas/:id/tiers          — owner list
//   GET    /api/personas/:handle/tiers      — public list (handle)
//   PATCH  /api/personas/:id/tiers/:tierId  — edit
//   PATCH  /api/personas/:id/tiers/:tierId/visibility — hide/show/archive
//   DELETE /api/personas/:id/tiers/:tierId  — only when no active members
// ============================================================

import { del, get, patch } from '../client';

export type TierReplyPolicy =
  | 'discretion'
  | 'within_3_days'
  | 'within_7_days'
  | 'within_14_days'
  | 'always';

export type TierStatus = 'active' | 'hidden' | 'archived';

export interface OwnerTier {
  id: string;
  rank: number;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  msgThreadsPerPeriod: number | null;
  videoCallsPerPeriod: number | null;
  videoCallDurationMinutes: number | null;
  creatorCanInitiateDm: boolean;
  replyPolicy: TierReplyPolicy;
  status: TierStatus;
  stripePriceId: string | null;
  position: number;
}

// Public list shape strips stripe_price_id and status (always 'active').
export interface PublicTier {
  id: string;
  rank: number;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  msgThreadsPerPeriod: number | null;
  creatorCanInitiateDm: boolean;
  replyPolicy: TierReplyPolicy;
}

export interface TierUpdatePayload {
  name?: string;
  description?: string;
  price_cents?: number;
  msg_threads_per_period?: number | null;
  reply_policy?: TierReplyPolicy;
  creator_can_initiate_dm?: boolean;
  position?: number;
}

export async function listOwnerTiers(
  personaId: string,
  options: { includeHidden?: boolean } = {},
): Promise<{ tiers: OwnerTier[] }> {
  const qs = options.includeHidden ? '?include_hidden=true' : '';
  return get<{ tiers: OwnerTier[] }>(
    `/api/personas/${encodeURIComponent(personaId)}/tiers${qs}`,
  );
}

export async function listPublicTiers(handle: string): Promise<{ tiers: PublicTier[] }> {
  const cleaned = handle.replace(/^@/, '');
  return get<{ tiers: PublicTier[] }>(
    `/api/personas/${encodeURIComponent(cleaned)}/tiers`,
  );
}

export async function updateTier(
  personaId: string,
  tierId: string,
  payload: TierUpdatePayload,
): Promise<{ tier: OwnerTier }> {
  return patch<{ tier: OwnerTier }>(
    `/api/personas/${encodeURIComponent(personaId)}/tiers/${encodeURIComponent(tierId)}`,
    payload,
  );
}

export async function setTierVisibility(
  personaId: string,
  tierId: string,
  status: TierStatus,
): Promise<{ tier: OwnerTier }> {
  return patch<{ tier: OwnerTier }>(
    `/api/personas/${encodeURIComponent(personaId)}/tiers/${encodeURIComponent(tierId)}/visibility`,
    { status },
  );
}

export async function deleteTier(
  personaId: string,
  tierId: string,
): Promise<{ ok: true }> {
  return del<{ ok: true }>(
    `/api/personas/${encodeURIComponent(personaId)}/tiers/${encodeURIComponent(tierId)}`,
  );
}
