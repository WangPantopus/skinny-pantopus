// ============================================================
// ADDRESS VALIDATION ENDPOINTS
// Pipeline: Google → Smarty → DecisionEngine → persist
// Mounted at /api/v1/address in the backend
// ============================================================

import { get, post } from '../client';

// ── Types ───────────────────────────────────────────────────

export type AddressVerdictStatus =
  | 'OK'
  | 'MISSING_UNIT'
  | 'MISSING_STREET_NUMBER'
  | 'UNVERIFIED_STREET_NUMBER'
  | 'PO_BOX'
  | 'MULTIPLE_MATCHES'
  | 'BUSINESS'
  | 'MIXED_USE'
  | 'UNDELIVERABLE'
  | 'LOW_CONFIDENCE'
  | 'SERVICE_ERROR'
  | 'CONFLICT';

export type NormalizedAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  plus4?: string;
  lat: number;
  lng: number;
};

export type DeliverabilityResult = {
  dpv_match_code: string;
  rdi_type: 'residential' | 'commercial';
  missing_secondary: boolean;
  commercial_mailbox: boolean;
  vacant_flag?: boolean;
  footnotes: string[];
};

export type PlaceClassification = {
  google_place_types: string[];
  parcel_type: string;
  building_type: string;
};

export type AddressCandidate = {
  address: NormalizedAddress;
  confidence: number;
};

export type ExistingHousehold = {
  home_id: string;
  member_count: number;
  active_roles: string[];
};

export type AddressVerdict = {
  status: AddressVerdictStatus;
  reasons: string[];
  confidence: number;
  normalized?: NormalizedAddress;
  deliverability?: DeliverabilityResult;
  classification?: PlaceClassification;
  candidates: AddressCandidate[];
  next_actions: string[];
  existing_household?: ExistingHousehold;
};

export type ValidateAddressResponse = {
  verdict: AddressVerdict;
  address_id: string | null;
};

export type ValidateAddressInput = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
};

export type ValidateUnitInput = {
  address_id: string;
  unit: string;
};

export type ClaimAddressInput = {
  address_id: string;
  unit?: string;
};

export type AddressClaim = {
  id: string;
  user_id: string;
  address_id: string;
  unit?: string | null;
  unit_number?: string | null;
  claim_status: 'pending' | 'verified' | 'rejected' | 'expired';
  verification_method: string;
  confidence: number;
  verdict_status: string;
  created_at: string;
  updated_at: string;
};

// ── API Calls ───────────────────────────────────────────────

/** Full address validation pipeline: Google → Smarty → DecisionEngine → persist */
export async function validateAddress(input: ValidateAddressInput): Promise<ValidateAddressResponse> {
  return post<ValidateAddressResponse>('/api/v1/address/validate', input);
}

/** Re-validate with a unit/apt number */
export async function validateUnit(input: ValidateUnitInput): Promise<ValidateAddressResponse> {
  return post<ValidateAddressResponse>('/api/v1/address/validate/unit', input);
}

/** Create an AddressClaim after successful validation */
export async function claimAddress(input: ClaimAddressInput): Promise<{ message: string; claim: AddressClaim }> {
  return post<{ message: string; claim: AddressClaim }>('/api/v1/address/claim', input);
}

// ── Mail Verification Types ──────────────────────────────────

export type MailVerificationStatus =
  | 'pending'    // code sent, waiting for user to enter
  | 'confirmed'  // code accepted
  | 'expired'    // code timed out
  | 'locked';    // too many failed attempts

export type MailVerifyStartInput = {
  address_id: string;
  unit?: string;
};

export type MailVerifyStartResponse = {
  verification_id: string;
  address_id: string;
  status: MailVerificationStatus;
  expires_at: string;
  cooldown_until: string;
  max_resends: number;
  resends_remaining: number;
};

export type MailVerifyConfirmInput = {
  verification_id: string;
  code: string;
};

export type MailVerifyConfirmResponse = {
  status: 'confirmed' | 'wrong_code' | 'expired' | 'locked';
  attempts_remaining?: number;
  locked_until?: string;
  occupancy_id?: string | null;
  claim?: AddressClaim;
};

export type MailVerifyStatusResponse = {
  verification_id: string;
  status: MailVerificationStatus;
  expires_at: string;
  cooldown_until: string;
  resends_remaining: number;
};

// ── Mail Verification API Calls ──────────────────────────────

/** Start mail verification — sends a code to the physical address */
export async function startMailVerification(input: MailVerifyStartInput): Promise<MailVerifyStartResponse> {
  return post<MailVerifyStartResponse>('/api/v1/address/verify/mail/start', input);
}

/** Confirm mail verification code */
export async function confirmMailVerification(input: MailVerifyConfirmInput): Promise<MailVerifyConfirmResponse> {
  return post<MailVerifyConfirmResponse>('/api/v1/address/verify/mail/confirm', input);
}

/** Resend mail verification code (respects cooldown) */
export async function resendMailVerification(verificationId: string): Promise<MailVerifyStartResponse> {
  return post<MailVerifyStartResponse>(`/api/v1/address/verify/mail/${verificationId}/resend`);
}

/** Check current mail verification status */
export async function getMailVerificationStatus(verificationId: string): Promise<MailVerifyStatusResponse> {
  return get<MailVerifyStatusResponse>(`/api/v1/address/verify/mail/${verificationId}`);
}
