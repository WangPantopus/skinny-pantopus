// ============================================================
// PERSONA PAYMENTS — Stripe Connect onboarding + status (P1.7)
// Audience Profile design v2 §8.1, §10.
// ============================================================

import { get, post } from '../client';

export interface PersonaPaymentsStatus {
  hasAccount: boolean;
  ready: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  verificationStatus?: string | null;
}

// POST /api/personas/:id/payments/onboard
// Returns a fresh Stripe Connect Express onboarding URL. The client
// should navigate to it; Stripe redirects back to /app/audience/setup.
export async function startOnboarding(
  personaId: string,
): Promise<{ url: string; expiresAt?: number }> {
  return post<{ url: string; expiresAt?: number }>(
    `/api/personas/${encodeURIComponent(personaId)}/payments/onboard`,
  );
}

// GET /api/personas/:id/payments/status
export async function getOnboardingStatus(
  personaId: string,
): Promise<{ status: PersonaPaymentsStatus }> {
  return get<{ status: PersonaPaymentsStatus }>(
    `/api/personas/${encodeURIComponent(personaId)}/payments/status`,
  );
}
