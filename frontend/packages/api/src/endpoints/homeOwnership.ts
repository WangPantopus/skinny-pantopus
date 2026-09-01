// ============================================================
// HOME OWNERSHIP ENDPOINTS
// Claims, owners, security settings, quorum, disputes
// ============================================================

import { get, post, del, patch } from '../client';

// ============================================================
// TYPES
// ============================================================

export type OwnerVerificationTier = 'weak' | 'standard' | 'strong' | 'legal';
export type OwnerStatus = 'pending' | 'verified' | 'disputed' | 'revoked';
export type ClaimState = 'under_review' | 'approved' | 'rejected' | 'revoked';
export type ClaimPhaseV2 =
  | 'initiated'
  | 'evidence_submitted'
  | 'under_review'
  | 'verified'
  | 'challenged'
  | 'withdrawn'
  | 'expired'
  | 'merged_into_household'
  | 'rejected';
export type ClaimRoutingClassification = 'standalone_claim' | 'parallel_claim' | 'challenge_claim' | 'merge_candidate';
export type SecurityState = 'normal' | 'claim_window' | 'review_required' | 'disputed' | 'frozen' | 'frozen_silent';
export type TenureMode = 'unknown' | 'owner_occupied' | 'rental' | 'managed_property';
export type PrivacyMaskLevel = 'normal' | 'high' | 'invite_only_discovery';
export type MemberAttachPolicy = 'open_invite' | 'admin_approval' | 'verified_only';
export type OwnerClaimPolicy = 'open' | 'review_required';
export type HouseholdResolutionState = 'unclaimed' | 'pending_single_claim' | 'contested' | 'verified_household' | 'disputed';

export interface HomeOwner {
  id: string;
  subject_type: 'user' | 'business' | 'trust';
  subject_id: string;
  owner_status: OwnerStatus;
  is_primary_owner: boolean;
  added_via: string;
  verification_tier: OwnerVerificationTier;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string | null;
  } | null;
}

export interface OwnershipClaim {
  id: string;
  home_id: string;
  claim_type: string;
  method: string;
  status: ClaimState;
  claim_phase_v2?: ClaimPhaseV2 | null;
  routing_classification?: ClaimRoutingClassification | null;
  created_at: string;
  updated_at: string;
}

export interface OwnershipClaimDetail {
  id: string;
  home_id: string;
  claim_type: string;
  state: string;
  claim_phase_v2?: ClaimPhaseV2 | null;
  challenge_state?: string;
  routing_classification?: ClaimRoutingClassification | null;
  claim_strength?: string | null;
  method: string;
  risk_score: number;
  claimant: {
    masked: boolean;
    account_age_days?: number | null;
    method: string;
    risk_score: number;
  };
  evidence: Array<{
    id: string;
    evidence_type: string;
    provider: string;
    status: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface SecuritySettings {
  security_state: SecurityState;
  claim_window_ends_at: string | null;
  owner_claim_policy: OwnerClaimPolicy;
  member_attach_policy: MemberAttachPolicy;
  privacy_mask_level: PrivacyMaskLevel;
  tenure_mode: TenureMode;
  claim_window_active: boolean;
  owner_count: number;
}

export interface QuorumAction {
  id: string;
  home_id: string;
  action_type: string;
  state: string;
  risk_tier: number;
  required_rule: string;
  required_approvals: number;
  min_rejects_to_block: number;
  expires_at: string;
  passive_approval_at: string | null;
  metadata: Record<string, unknown>;
  proposer?: { id: string; username: string; name: string };
  votes?: Array<{
    id: string;
    voter_user_id: string;
    vote: 'approve' | 'reject';
    voted_at: string;
  }>;
  created_at: string;
}

export interface DisputeInfo {
  active: boolean;
  security_state: SecurityState;
  claims: Array<{
    id: string;
    claim_type: string;
    state: string;
    method: string;
    risk_score: number;
    evidence: Array<{ id: string; evidence_type: string; status: string; created_at: string }>;
    created_at: string;
  }>;
  timeline: Array<{
    action: string;
    actor_user_id: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  restricted_actions: string[];
}

export interface OwnershipClaimSubmissionResponse {
  message: string;
  claim: {
    id?: string;
    status: string;
    claim_phase_v2?: ClaimPhaseV2 | null;
    routing_classification?: ClaimRoutingClassification | null;
  };
  home_resolution?: HouseholdResolutionState;
  next_step?: string;
}

export interface OwnershipClaimComparison {
  home_id: string;
  home: {
    id: string;
    name: string | null;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    security_state: SecurityState;
    household_resolution_state: HouseholdResolutionState;
    household_resolution_updated_at: string | null;
  };
  household_resolution_state: HouseholdResolutionState;
  incumbent: {
    owners: Array<{
      id: string;
      home_id: string;
      subject_id: string;
      owner_status: OwnerStatus;
      is_primary_owner: boolean;
      verification_tier: string | null;
      added_via: string;
      created_at: string;
      updated_at: string;
      user: {
        id: string;
        username?: string;
        name?: string;
        email?: string;
        profile_picture_url?: string | null;
      } | null;
    }>;
    has_verified_owner: boolean;
    challenge_state: 'none' | 'challenged';
  };
  claims: Array<{
    id: string;
    home_id: string;
    claimant_user_id: string;
    claimant: {
      id: string;
      username?: string;
      name?: string;
      email?: string;
      profile_picture_url?: string | null;
    } | null;
    claim_type: string;
    state: string;
    claim_phase_v2: ClaimPhaseV2 | null;
    terminal_reason: string;
    challenge_state: string;
    claim_strength: string | null;
    routing_classification: ClaimRoutingClassification | null;
    identity_status: string;
    merged_into_claim_id: string | null;
    expires_at: string | null;
    method: string;
    risk_score: number;
    created_at: string;
    updated_at: string;
    evidence: Array<{
      id: string;
      claim_id?: string;
      evidence_type: string;
      provider: string;
      status: string;
      confidence_level?: string | null;
      storage_ref?: string | null;
      metadata?: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    }>;
  }>;
}

// ============================================================
// OWNERSHIP CLAIMS
// ============================================================

export async function submitOwnershipClaim(homeId: string, data: {
  claim_type?: 'owner' | 'admin' | 'resident';
  method: 'invite' | 'vouch' | 'doc_upload' | 'escrow_agent' | 'landlord_portal' | 'property_data_match';
}): Promise<OwnershipClaimSubmissionResponse> {
  return post(`/api/homes/${homeId}/ownership-claims`, data);
}

export async function getMyOwnershipClaims(): Promise<{ claims: OwnershipClaim[] }> {
  return get('/api/homes/my-ownership-claims');
}

/** Claimant deletes their own in-progress claim (hard delete). */
export async function deleteMyOwnershipClaim(homeId: string, claimId: string): Promise<{ ok: boolean; deleted: boolean }> {
  return del(`/api/homes/${homeId}/ownership-claims/${claimId}`);
}

export async function getHomeOwnershipClaims(homeId: string): Promise<{ claims: OwnershipClaimDetail[] }> {
  return get(`/api/homes/${homeId}/ownership-claims`);
}

export async function getOwnershipClaimDetail(homeId: string, claimId: string): Promise<{ claim: OwnershipClaimDetail }> {
  return get(`/api/homes/${homeId}/ownership-claims/${claimId}`);
}

export async function getOwnershipClaimComparison(homeId: string): Promise<OwnershipClaimComparison> {
  return get(`/api/homes/${homeId}/ownership-claims/compare`);
}

export async function reviewOwnershipClaim(homeId: string, claimId: string, data: {
  action: 'approve' | 'reject' | 'flag';
  note?: string;
}): Promise<{ message: string; state: string }> {
  return post(`/api/homes/${homeId}/ownership-claims/${claimId}/review`, data);
}

export async function uploadClaimEvidence(homeId: string, claimId: string, data: {
  evidence_type: 'deed' | 'closing_disclosure' | 'tax_bill' | 'utility_bill' | 'lease' | 'idv' | 'escrow_attestation' | 'title_match';
  provider?: string;
  storage_ref?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ evidence: { id: string; evidence_type: string; status: string } }> {
  return post(`/api/homes/${homeId}/ownership-claims/${claimId}/evidence`, data);
}

export async function resolveOwnershipClaimRelationship(homeId: string, claimId: string, data: {
  action: 'invite_to_household' | 'decline_relationship' | 'flag_unknown_person';
  note?: string;
}): Promise<{
  message: string;
  action: string;
  claim: {
    id: string;
    routing_classification?: ClaimRoutingClassification | null;
    claim_phase_v2?: ClaimPhaseV2 | null;
    challenge_state?: string;
    claim_strength?: string | null;
  };
  invitation?: {
    id: string;
    status: string;
    expires_at: string | null;
  };
  home_resolution_state?: HouseholdResolutionState;
}> {
  return post(`/api/homes/${homeId}/ownership-claims/${claimId}/resolve-relationship`, data);
}

export async function acceptOwnershipClaimMerge(homeId: string, claimId: string, data: {
  invitation_id?: string | null;
} = {}): Promise<{
  message: string;
  claim: {
    id: string;
    state: string;
    claim_phase_v2: ClaimPhaseV2;
    terminal_reason: string;
    merged_into_claim_id: string | null;
  };
  home_resolution_state: HouseholdResolutionState;
  occupancy?: unknown;
}> {
  return post(`/api/homes/${homeId}/ownership-claims/${claimId}/accept-merge`, data);
}

export async function challengeOwnershipClaim(homeId: string, claimId: string, data: {
  note?: string;
} = {}): Promise<{
  message: string;
  claim: {
    id: string;
    routing_classification: ClaimRoutingClassification;
    claim_phase_v2: ClaimPhaseV2;
    challenge_state: string;
    claim_strength: string | null;
  };
  home_resolution_state: HouseholdResolutionState;
}> {
  return post(`/api/homes/${homeId}/ownership-claims/${claimId}/challenge`, data);
}

// ============================================================
// OWNERS
// ============================================================

export async function getHomeOwners(homeId: string): Promise<{ owners: HomeOwner[] }> {
  return get(`/api/homes/${homeId}/owners`);
}

export async function inviteCoOwner(homeId: string, data: {
  email?: string | null;
  phone?: string | null;
  user_id?: string | null;
  fast_track?: boolean;
}): Promise<{ message: string; claim_id: string }> {
  return post(`/api/homes/${homeId}/owners/invite`, data);
}

export async function transferOwnership(homeId: string, data: {
  buyer_email?: string | null;
  buyer_phone?: string | null;
  buyer_user_id?: string | null;
  effective_date?: string | null;
}): Promise<{ message: string; quorum_action_id?: string; required_approvals?: number }> {
  return post(`/api/homes/${homeId}/owners/transfer`, data);
}

export async function removeOwner(homeId: string, ownerId: string): Promise<{
  message: string;
  quorum_action_id?: string;
}> {
  return del(`/api/homes/${homeId}/owners/${ownerId}`);
}

// ============================================================
// SECURITY SETTINGS
// ============================================================

export async function getSecuritySettings(homeId: string): Promise<{ security: SecuritySettings }> {
  return get(`/api/homes/${homeId}/security`);
}

export async function updateSecuritySettings(homeId: string, data: {
  owner_claim_policy?: OwnerClaimPolicy;
  member_attach_policy?: MemberAttachPolicy;
  privacy_mask_level?: PrivacyMaskLevel;
  tenure_mode?: TenureMode;
}): Promise<{ message: string; security?: SecuritySettings; quorum_action_id?: string; pending?: boolean }> {
  return patch(`/api/homes/${homeId}/security`, data);
}

// ============================================================
// QUORUM ACTIONS
// ============================================================

export async function getQuorumActions(homeId: string): Promise<{ actions: QuorumAction[] }> {
  return get(`/api/homes/${homeId}/quorum-actions`);
}

export async function proposeQuorumAction(homeId: string, data: {
  action_type: string;
  metadata?: Record<string, unknown>;
}): Promise<{ action: QuorumAction; auto_approved?: boolean }> {
  return post(`/api/homes/${homeId}/quorum-actions`, data);
}

export async function voteOnQuorumAction(homeId: string, actionId: string, data: {
  vote: 'approve' | 'reject';
  reason?: string;
}): Promise<{ message: string; action_state: string; approvals: number; rejections: number }> {
  return post(`/api/homes/${homeId}/quorum-actions/${actionId}/vote`, data);
}

// ============================================================
// DISPUTE
// ============================================================

export async function getDisputeDetails(homeId: string): Promise<{ dispute: DisputeInfo }> {
  return get(`/api/homes/${homeId}/dispute`);
}

// ============================================================
// POSTCARD VERIFICATION
// ============================================================

export async function requestPostcardCode(homeId: string): Promise<{
  message: string;
  postcard: { id: string; requested_at: string; expires_at: string };
}> {
  return post(`/api/homes/${homeId}/request-postcard`);
}

export async function verifyPostcardCode(homeId: string, code: string): Promise<{
  message: string;
  occupancy: any;
}> {
  return post(`/api/homes/${homeId}/verify-postcard`, { code });
}
