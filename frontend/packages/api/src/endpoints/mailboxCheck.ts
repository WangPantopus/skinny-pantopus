// ============================================================
// MAILBOX REALITY CHECK (Wave 1, #3)
//
// "Can USPS, lenders, and delivery apps actually find your address?"
// Read-only diagnostic composed from the claim-time postal validation
// already on file (DPV match, RDI type, vacancy, missing-unit flags)
// plus the caller's postcard state as the physical leg. No vendor
// calls; the physical-leg copy is per-caller.
// ============================================================

import { get } from '../client';

export type MailboxCheckVerdict = 'looks_good' | 'needs_attention' | 'problem' | 'unknown';
export type MailboxFindingSeverity = 'ok' | 'info' | 'attention' | 'problem';
export type MailboxPhysicalStatus = 'proven' | 'in_progress' | 'not_run';

export interface MailboxFinding {
  severity: MailboxFindingSeverity;
  title: string;
  detail: string;
}

export interface MailboxCheck {
  verdict: MailboxCheckVerdict;
  findings: MailboxFinding[];
  physical: {
    status: MailboxPhysicalStatus;
    title: string;
    detail: string;
  };
  checked_at: string | null;
}

/** GET /api/homes/:id/mailbox-check — any home member. */
export async function getMailboxCheck(homeId: string): Promise<MailboxCheck> {
  const res = await get<{ check: MailboxCheck }>(`/api/homes/${homeId}/mailbox-check`);
  return res.check;
}
