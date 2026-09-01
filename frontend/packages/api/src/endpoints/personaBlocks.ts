// ============================================================
// PERSONA BLOCKS (P1.14)
// Audience Profile design v2 §9. Creator-driven block + unblock +
// list. Wire shapes carry membership_id + fan_handle only — never
// the underlying user_id of the blocked fan.
// ============================================================

import { del, get, post } from '../client';

export type PersonaBlockSource =
  | 'persona_owner_action'
  | 'personal_block_propagation'
  | 'platform_safety'
  | 'chargeback';

export interface PersonaBlockSummary {
  id: string;
  membershipId: string | null;
  createdAt: string;
  fanHandle: string | null;
  fanDisplayName: string | null;
  fanAvatarUrl: string | null;
  canUnblock: boolean;
}

export async function blockFan(
  personaId: string,
  membershipId: string,
  payload: { reason?: string | null } = {},
): Promise<{ blocked: boolean; blockId: string; revokedMembershipId: string | null; fanHandle: string | null }> {
  return post(
    `/api/personas/${encodeURIComponent(personaId)}/fans/${encodeURIComponent(membershipId)}/block`,
    payload,
  );
}

export async function unblockFan(
  personaId: string,
  membershipId: string,
): Promise<{ unblocked: boolean }> {
  return del(
    `/api/personas/${encodeURIComponent(personaId)}/fans/${encodeURIComponent(membershipId)}/block`,
  );
}

export async function listBlocks(
  personaId: string,
): Promise<{ blocks: PersonaBlockSummary[] }> {
  return get(
    `/api/personas/${encodeURIComponent(personaId)}/blocks`,
  );
}
