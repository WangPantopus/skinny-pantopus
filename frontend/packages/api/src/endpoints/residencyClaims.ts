// ============================================================
// RESIDENCY CLAIMS — scoped, expiring, revocable residency proof
// (Wave 1 — Residency Pass)
//
// The live, minimal-disclosure sibling of the residency letter: a T4
// resident issues a claim that attests ONE derived fact ("a verified
// resident of Camas School District") behind an unguessable code. The
// public check re-verifies at view time that the issuer still holds
// verified occupancy, and every view is logged for the issuer.
//
// Claims are PERSONAL documents — the API only ever returns the
// caller's own claims for a home.
// ============================================================

import { get, post } from '../client';

export type ResidencyClaimScope =
  | 'address'
  | 'city'
  | 'county'
  | 'state'
  | 'school_district'
  | 'congressional_district';

/** `expired` is derived from expires_at; `no_longer_verified` appears only on the public check. */
export type ResidencyClaimStatus = 'active' | 'revoked' | 'expired';
export type ResidencyClaimLiveStatus = ResidencyClaimStatus | 'no_longer_verified';

export const RESIDENCY_CLAIM_EXPIRY_DAYS = [1, 7, 30, 90] as const;
export type ResidencyClaimExpiryDays = (typeof RESIDENCY_CLAIM_EXPIRY_DAYS)[number];

export interface ResidencyClaim {
  id: string;
  home_id: string;
  scope: ResidencyClaimScope;
  /** The exact sentence a verifier sees — frozen at issue. */
  statement: string;
  holder_name: string;
  status: ResidencyClaimStatus;
  claim_code: string;
  verify_url: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  residency_verified_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

/** One row of the issuer-visible audit trail. */
export interface ResidencyClaimView {
  viewed_at: string;
  user_agent: string | null;
}

/** Public third-party check result — the statement plus a LIVE status. */
export interface ResidencyClaimVerification {
  valid: boolean;
  status?: ResidencyClaimLiveStatus;
  scope?: ResidencyClaimScope;
  statement?: string;
  holder_name?: string;
  issued_at?: string;
  expires_at?: string;
  revoked_at?: string | null;
  residency_verified_at?: string | null;
}

/** POST /api/homes/:id/residency-claims — issue (verified residents only). */
export async function issueResidencyClaim(
  homeId: string,
  scope: ResidencyClaimScope,
  expiresInDays?: ResidencyClaimExpiryDays,
): Promise<ResidencyClaim> {
  const res = await post<{ claim: ResidencyClaim }>(`/api/homes/${homeId}/residency-claims`, {
    scope,
    expires_in_days: expiresInDays,
  });
  return res.claim;
}

/** GET /api/homes/:id/residency-claims — the caller's claims for this home. */
export async function listResidencyClaims(homeId: string): Promise<ResidencyClaim[]> {
  const res = await get<{ claims: ResidencyClaim[] }>(`/api/homes/${homeId}/residency-claims`);
  return res.claims;
}

/** GET .../:claimId/views — who checked this claim, newest first. */
export async function listResidencyClaimViews(homeId: string, claimId: string): Promise<ResidencyClaimView[]> {
  const res = await get<{ views: ResidencyClaimView[] }>(
    `/api/homes/${homeId}/residency-claims/${claimId}/views`,
  );
  return res.views;
}

/** POST .../:claimId/revoke — kills the claim's public verification. */
export async function revokeResidencyClaim(homeId: string, claimId: string): Promise<ResidencyClaim> {
  const res = await post<{ claim: ResidencyClaim }>(`/api/homes/${homeId}/residency-claims/${claimId}/revoke`);
  return res.claim;
}

/** GET /api/public/residency-claims/:code — anonymous third-party live check. */
export async function verifyResidencyClaim(code: string): Promise<ResidencyClaimVerification> {
  return get<ResidencyClaimVerification>(`/api/public/residency-claims/${encodeURIComponent(code)}`);
}
