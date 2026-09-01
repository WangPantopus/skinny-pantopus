// ============================================================
// RESIDENCY LETTERS — server-attested proof of residency (Phase 1, #11)
//
// A T4 (verified-occupancy) resident issues a letter; the backend
// freezes the printed facts + the exact PDF, and prints an unguessable
// verification code on the letter. Anyone holding the paper can check
// it at GET /api/public/residency-letters/:code (and the web page
// /verify-residency/[code]).
//
// Letters are PERSONAL documents — the API only ever returns the
// caller's own letters for a home.
// ============================================================

import { get, post } from '../client';

export type ResidencyLetterStatus = 'issued' | 'revoked';

export interface ResidencyLetterAddress {
  line1: string;
  city: string | null;
  state: string | null;
  zipcode: string | null;
}

export interface ResidencyLetter {
  id: string;
  home_id: string;
  status: ResidencyLetterStatus;
  purpose: string;
  resident_name: string;
  address: ResidencyLetterAddress;
  /** Printed on the letter; what third parties verify. */
  letter_code: string;
  verify_url: string;
  issued_at: string;
  revoked_at: string | null;
  pdf_sha256: string;
}

/** Public third-party check result — exactly what the paper shows. */
export interface ResidencyLetterVerification {
  valid: boolean;
  status?: ResidencyLetterStatus;
  resident_name?: string;
  address?: ResidencyLetterAddress;
  purpose?: string;
  issued_at?: string;
  revoked_at?: string | null;
}

/** POST /api/homes/:id/residency-letters — issue (verified residents only). */
export async function issueResidencyLetter(homeId: string, purpose?: string): Promise<ResidencyLetter> {
  const res = await post<{ letter: ResidencyLetter }>(`/api/homes/${homeId}/residency-letters`, { purpose });
  return res.letter;
}

/** GET /api/homes/:id/residency-letters — the caller's letters for this home. */
export async function listResidencyLetters(homeId: string): Promise<ResidencyLetter[]> {
  const res = await get<{ letters: ResidencyLetter[] }>(`/api/homes/${homeId}/residency-letters`);
  return res.letters;
}

/** GET .../:letterId/pdf — the exact issued artifact, as a Blob for download. */
export async function getResidencyLetterPdf(homeId: string, letterId: string): Promise<Blob> {
  return get<Blob>(
    `/api/homes/${homeId}/residency-letters/${letterId}/pdf`,
    undefined,
    { responseType: 'blob' },
  );
}

/** POST .../:letterId/revoke — kills the letter's public verification. */
export async function revokeResidencyLetter(homeId: string, letterId: string): Promise<ResidencyLetter> {
  const res = await post<{ letter: ResidencyLetter }>(`/api/homes/${homeId}/residency-letters/${letterId}/revoke`);
  return res.letter;
}

/** GET /api/public/residency-letters/:code — anonymous third-party check. */
export async function verifyResidencyLetter(code: string): Promise<ResidencyLetterVerification> {
  return get<ResidencyLetterVerification>(`/api/public/residency-letters/${encodeURIComponent(code)}`);
}
