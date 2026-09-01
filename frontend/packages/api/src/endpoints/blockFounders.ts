// ============================================================
// BLOCK FOUNDERS — the growth mechanic (Wave 3, final slice)
//
// A verified occupant's permanent founding rank in their geohash-6
// block, the per-section unlock meters, and real Lob postcard invites
// to nearby addresses — template-only, sender anonymized to street,
// 3/week cap, 90-day per-recipient dedup, permanent opt-out registry.
// Both authed routes are hard T4-gated server-side.
// ============================================================

import { get, post } from '../client';

export interface BlockMeter {
  id: string;
  label: string;
  current: number;
  needed: number;
  unlocked: boolean;
}

export interface BlockStatus {
  available: boolean;
  reason?: string;
  /** 1-based founding order; null while rank assignment is unavailable. */
  rank?: number | null;
  established_at?: string | null;
  /** Raw verified-homes count — T4 insiders only, by server contract. */
  verified_count?: number;
  /** Rent reports in the cell — what the `real_rent` meter counts (Wave 3). */
  rent_reports?: number;
  meters?: BlockMeter[];
  invites_remaining?: number;
  invites_weekly_cap?: number;
}

export interface BlockInviteRecipient {
  line1: string;
  city: string;
  state: string;
  zip: string;
}

export interface BlockInviteResult {
  sent: boolean;
  invites_remaining: number;
}

/** GET /api/homes/:id/block-founders — verified occupants only. */
export async function getBlockStatus(homeId: string): Promise<BlockStatus> {
  const res = await get<{ block: BlockStatus }>(`/api/homes/${homeId}/block-founders`);
  return res.block;
}

/** POST /api/homes/:id/block-founders/invites — one postcard invite. */
export async function sendBlockInvite(homeId: string, recipient: BlockInviteRecipient): Promise<BlockInviteResult> {
  return post<BlockInviteResult>(`/api/homes/${homeId}/block-founders/invites`, { recipient });
}

/** POST /api/public/block-invites/opt-out/:code — the recipient's kill switch. */
export async function redeemInviteOptOut(code: string): Promise<{ done: boolean }> {
  return post<{ done: boolean }>(`/api/public/block-invites/opt-out/${encodeURIComponent(code)}`);
}
