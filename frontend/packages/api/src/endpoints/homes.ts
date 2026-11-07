// ============================================================
// HOME ENDPOINTS
// Home management, attach/detach, occupancy
// ============================================================

import { get, post, put, patch, del, RECORD_VOCABULARY } from '../client';
import type { RecordProvenance } from '@pantopus/types';
import type { 
  Home, 
  HomeOccupancy, 
  HomeFilters,
  ApiResponse 
} from '@pantopus/types';

// ============ ADDRESS CHECK ============

export interface ResidencyAddressSnapshot {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface AddressCheckResult {
  /** HOME_FOUND_PRIVATE: an "Invite only" Home is here; its id and address are not shared. */
  status: 'HOME_NOT_FOUND' | 'HOME_FOUND_UNCLAIMED' | 'HOME_FOUND_CLAIMED' | 'HOME_FOUND_PRIVATE';
  home_id?: string;
  is_multi_unit?: boolean;
  formatted_address?: string;
  residency_address?: ResidencyAddressSnapshot;
}

/**
 * Check if an address already exists and whether it has verified members.
 * Returns status only — never reveals member identities.
 */
export async function checkAddress(data: {
  address_id?: string;
  address: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}): Promise<AddressCheckResult> {
  return post<AddressCheckResult>('/api/homes/check-address', data);
}

export type PropertySuggestionTier = 'attom' | 'record' | 'heuristic' | 'llm';

/** Bundle from ATTOM /property/detail — same shape is persisted on create-home as niche_data.attom_property_detail */
export interface AttomPropertyDetailPayload {
  provider: string;
  endpoint: string;
  fetched_at: string;
  status: Record<string, unknown> | null;
  property: Record<string, unknown> | null;
  full_response: Record<string, unknown> | null;
}

export interface PropertySuggestionsResponse {
  suggestions: {
    home_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sq_ft: number | null;
    lot_sq_ft: number | null;
    year_built: number | null;
    description: string | null;
  };
  field_sources: Partial<Record<string, PropertySuggestionTier>>;
  /** Any tier but `heuristic` and `llm` means a public record was found for the address. */
  tiers_used: string[];
  llm_enabled: boolean;
  /**
   * Where the county-record lookup stands for a validated address (servers since November 2026):
   * 'pending' means ask again with `lookup: 'check'` for the record. `record_lookup` from servers
   * that know `vocabulary=2`.
   */
  attom_lookup?: 'found' | 'none' | 'pending' | 'unavailable';
  record_lookup?: 'found' | 'none' | 'pending' | 'unavailable';
  /** The lookup's outcome in the server's words. */
  lookup_message?: string;
  /** Where the record came from, once it names its source. */
  provenance?: RecordProvenance;
  /** A short tag per field ("County"), once the record names its source. */
  field_tags?: Partial<Record<string, string>>;
  /** One-tap answers for what the record lacks, once the lookup has had its say. */
  questions?: HouseholdQuestion[];
  /** The county's own page, where a person can check what's missing. */
  county_page?: CountyPage;
}

export interface CountyPage {
  url: string;
  label: string;
}

export interface HouseholdAnswer {
  label: string;
  value: string;
}

/** "Bedrooms? 1 2 3 4 Other": a tap answers it. */
export interface HouseholdQuestion {
  key: string;
  prompt: string;
  options: HouseholdAnswer[];
  other: string;
}

/** One fact in "Fix something" or "Add details", as the server words it. */
export interface HouseholdFact {
  key: string;
  label: string;
  /** What the page shows now. */
  value: string | null;
  /** What the field starts with. */
  current: string;
  /** "County record: 3", when the household's value differs from it. */
  note: string | null;
  input: 'number' | 'decimal' | 'year' | 'text';
  unit: string | null;
  options: HouseholdAnswer[];
  can_undo: boolean;
}

/** What someone who can edit may do with one group of facts; `section_id` is the card it sits under, or null for a card of its own. */
export interface HouseholdGroup {
  id: string;
  section_id: string | null;
  title: string;
  lead?: string;
  prompt: string | null;
  confirmed: string | null;
  fix: string | null;
  facts: HouseholdFact[];
  report: string | null;
  reported: string | null;
}

/** What the household has said, for those it's meant for (backend/services/householdFacts.js). */
export interface HouseholdPart {
  can_edit: boolean;
  sections: CountyRecordSection[];
  groups: HouseholdGroup[];
  questions: HouseholdQuestion[];
  county_page: CountyPage | null;
}

/** A change to one fact, or with `group` to every fact of a group that can take it. */
export type HouseholdFactChange =
  | { key: string; action: 'correct'; value: string }
  | { key: string; action: 'undo' }
  | { group: string; action: 'confirm' | 'undo' };

/** One label / value row of a county record, worded and formatted by the server. */
export interface CountyRecordRow {
  id: string;
  label: string;
  value: string;
  /** Numbers, measurements and codes (the apps draw them monospaced). */
  mono?: boolean;
  /** Where this row came from, when it isn't the footer's source ("From your household"). */
  tag?: string | null;
  /** What stands beside it ("County record: 3"). */
  note?: string | null;
}

export interface CountyRecordSection {
  id: string;
  title: string;
  rows: CountyRecordRow[];
  /** Caption under the section, e.g. the value estimate's "isn't an appraisal". */
  note?: string | null;
}

/** A verified owner's county record as labeled sections (backend/serializers/countyRecordSerializer.js). */
export interface CountyRecord {
  sections: CountyRecordSection[];
  /** Names the source and date: "From Clark County Assessor's weekly file · updated Oct 31, 2026" */
  footer: string | null;
  as_of: string | null;
  /** The labeled national floor: modeled figures, not a record of this home. */
  estimate?: boolean;
}

export interface HomePropertyDetailResponse {
  home: Home;
  /** The raw ATTOM bundle; verified owners only. */
  attom_property_detail: AttomPropertyDetailPayload | null;
  source: 'home' | 'cache' | 'attom' | 'unavailable' | string;
  /** Where the record came from, once it names its source. */
  provenance?: RecordProvenance;
  /**
   * OWNER_ONLY: the viewer isn't a verified owner, so only the Home's own facts come. LOOKUP_PENDING: the record
   * is being looked up; its arrival on the Home sends the `home:<id>` change signal.
   */
  unavailable_reason?: 'NO_PROPERTY_FOUND' | 'ATTOM_UNAVAILABLE' | 'ATTOM_NOT_CONFIGURED' | 'OWNER_ONLY' | 'LOOKUP_PENDING' | string | null;
  /** The county record as labeled sections; verified owners only (older servers leave it out). */
  county_record?: CountyRecord | null;
  /** What the household has said and can say; only for those it's meant for. */
  household?: HouseholdPart | null;
}

/**
 * Tiered property field hints for Add Home (ATTOM → heuristics → optional LLM).
 * `lookup: 'background'` answers at once and looks a missing county record up meanwhile
 * (`attom_lookup: 'pending'`); `lookup: 'check'` is the one follow-up, answered when that lookup ends.
 * Without it the server waits for ATTOM, as it does for older apps.
 */
export async function getPropertySuggestions(data: {
  address: string;
  unit_number?: string | null;
  city: string;
  state: string;
  zip_code: string;
  address_id?: string | null;
  classification?: {
    google_place_types?: string[];
    parcel_type?: string;
    building_type?: string;
  };
}, options?: { lookup?: 'background' | 'check' }): Promise<PropertySuggestionsResponse> {
  return post<PropertySuggestionsResponse>('/api/homes/property-suggestions', data,
    { params: { ...RECORD_VOCABULARY, ...(options?.lookup ? { lookup: options.lookup } : {}) } });
}

// ============ HOME CRUD ============

/**
 * Get homes with filters
 */
export async function getHomes(filters?: HomeFilters & {
  page?: number;
  limit?: number;
}): Promise<{ homes: Home[]; total: number }> {
  return get<{ homes: Home[]; total: number }>('/api/homes', filters);
}

/**
 * Get a single home by ID
 */
export async function getHome(homeId: string): Promise<{ home: Home }> {
  return get<{ home: Home }>(`/api/homes/${homeId}`);
}

/**
 * Get ATTOM-backed property details for a home, with backend backfill/cache.
 */
export async function getHomePropertyDetail(homeId: string): Promise<HomePropertyDetailResponse> {
  return get<HomePropertyDetailResponse>(`/api/homes/${homeId}/property-details`, RECORD_VOCABULARY);
}

/**
 * Create a new home profile
 */
export async function createHome(data: {
  request_id?: string;
  address: string;
  address_id?: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  home_type?: 'apartment' | 'house' | 'condo' | 'townhouse' | 'studio' | 'rv' | 'mobile_home' | 'trailer' | 'multi_unit' | 'other';
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  sq_ft?: number;
  lot_sq_ft?: number;
  year_built?: number;
  move_in_date?: string;
  is_owner?: boolean;
  /** "My home doesn't have a unit number" — clears only a MISSING_UNIT refusal. */
  no_unit_attestation?: boolean;
  role?: 'owner' | 'renter' | 'household' | 'property_manager' | 'guest';
  visibility?: 'private' | 'members' | 'public_preview';
  name?: string;
  description?: string;
  entry_instructions?: string;
  parking_instructions?: string;
  amenities?: Record<string, boolean>;
  wifi_name?: string;
  wifi_password?: string;
}): Promise<{ home: Home; message: string; requires_verification?: boolean }> {
  return post<{ home: Home; message: string; requires_verification?: boolean }>('/api/homes', data);
}

/**
 * Update home details
 */
export async function updateHome(homeId: string, data: Partial<{
  name: string | null;
  unit_number: string;
  home_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  public_info: Record<string, any>;
  household_facts: HouseholdFactChange[];
}>): Promise<{ home: Home }> {
  return patch<{ home: Home }>(`/api/homes/${homeId}`, data);
}

/**
 * "Report a problem" on a fact a household can't correct: it reaches Pantopus review, and nothing on the page changes.
 */
export async function reportRecordProblem(homeId: string, data: { section: string; field?: string | null; note?: string | null }): Promise<{ reported: boolean }> {
  return post<{ reported: boolean }>(`/api/homes/${homeId}/record-problem`, data);
}

/**
 * Delete a home
 */
export async function deleteHome(homeId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/homes/${homeId}`);
}

/**
 * Attach user to a home (move in)
 */
export async function attachToHome(homeId: string, data: {
  relationship: 'owner' | 'tenant' | 'roommate' | 'guest' | 'sublease';
  is_primary_residence: boolean;
  move_in_date: string;
  verification_code?: string;
}): Promise<{ occupancy: HomeOccupancy }> {
  return post<{ occupancy: HomeOccupancy }>(`/api/homes/${homeId}/attach`, data);
}

/**
 * Detach user from a home (admin action, requires members.manage)
 */
export async function detachFromHome(homeId: string, data?: {
  move_out_date?: string;
}): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/homes/${homeId}/detach`, data);
}

/**
 * Leave a home (self-service move-out for any occupant)
 */
export async function leaveHome(homeId: string): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/homes/${homeId}/move-out`, {});
}

/**
 * Get home occupants
 */
export interface HomeMemberReference {
  id: string;
  home_id: string;
  user_id: string;
  role: string;
  role_base: string | null;
  is_active: boolean;
  verification_status: string;
  start_at: string | null;
  end_at: string | null;
  access_start_at: string | null;
  access_end_at: string | null;
  created_at: string;
  user: { id: string; username: string; name: null; profile_picture_url: string | null };
  display_name: string;
  username: string;
  avatar_url: string | null;
  joined_at: string;
}
export interface HomePendingInviteReference {
  id: string;
  user_id: string | null;
  role: string;
  is_active: false;
  email: string | null;
  name: string;
  invited_by: string | null;
  created_at: string;
}
export async function getHomeOccupants(homeId: string): Promise<{
  occupants: HomeMemberReference[];
  pendingInvites: HomePendingInviteReference[];
}> {
  return get(`/api/homes/${homeId}/occupants`);
}

/**
 * Occupancy as returned by GET /api/homes/my-homes — the resident's
 * relationship to one of their places. Distinct from the legacy
 * HomeOccupancy shape: the list endpoint carries the verification status
 * and display role rather than the raw move-in record.
 */
export interface MyHomeOccupancy {
  id: string | null;
  role?: string;
  role_base?: string;
  is_active?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  access_end_at?: string | null;
  /** 'verified' lifts the place to the verified (T4) tier unless verification_source says it isn't address proof. */
  verification_status?: 'pending' | 'verified' | 'rejected' | 'moved_out' | string | null;
  /** Where verified access came from: 'address' or 'legacy' proof, or 'household' consent or a 'claim' (both "Claimed"). */
  verification_source?: 'address' | 'household' | 'legacy' | 'claim' | string | null;
}

/** One of the current user's places (GET /api/homes/my-homes). */
export interface MyHome extends Omit<Home, 'location' | 'address' | 'city' | 'state' | 'zip_code' | 'country' | 'created_at' | 'updated_at'> {
  /** Shared fields are absent from personal verification entries. */
  address: string | null;
  address2?: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  created_at?: string;
  updated_at?: string;
  /** PostGIS point parsed by the endpoint; null when unset. */
  location: Home['location'] | null;
  /** Optional display name (Home column not in the base Home type). */
  name?: string | null;
  occupancy: MyHomeOccupancy | null;
  /** Shared household access, exact private setup, or personal verification progress. */
  access_kind?: 'shared' | 'private_setup' | 'verification';
  has_home_access?: boolean;
  /** Effective authority; independent from the caller's residency/ownership record. */
  role_base?: string | null;
  /** HomeOwner status — distinguishes verified owners from pending. */
  ownership_status?: 'verified' | 'pending' | 'rejected' | null;
  verification_tier?: string | null;
  /** Deep-link target for an in-progress claim. */
  pending_claim_id?: string | null;
  /** That claim's kind: 'resident' (a renter's residency document) or 'owner'; older servers omit it. */
  pending_claim_type?: string | null;
  can_delete_home?: boolean;
  /**
   * Your own private setup whose instant claim (home_instant_claim) is held: the address watch sent it to review,
   * and it stays held until the address is verified by mail. Older servers omit it.
   */
  claim_held?: boolean;
}

/**
 * Get current user's homes (owned + occupied).
 */
export async function getMyHomes(): Promise<{ homes: MyHome[]; primary_home?: PrimaryHome | null }> {
  // Older servers omit primary_home; null explicitly means no current residence.
  return get<{ homes: MyHome[]; primary_home?: PrimaryHome | null }>('/api/homes/my-homes');
}

/**
 * Claim your own private setup at once (behind the home_instant_claim flag). A held claim stays a private
 * setup until the address is verified by mail.
 */
export async function instantClaimHome(homeId: string): Promise<
  { claimed: true; home_id: string; settles_at: string | null } | { claimed: false; held: true; message: string }
> {
  return post(`/api/homes/${homeId}/instant-claim`, {});
}

/**
 * Get current user's primary residence
 */
export type PrimaryHome = Home & Pick<MyHome, 'occupancy' | 'access_kind' | 'has_home_access' | 'role_base' | 'can_delete_home'>;

export async function getPrimaryHome(): Promise<{ home: PrimaryHome | null }> {
  return get<{ home: PrimaryHome | null }>('/api/homes/primary');
}

/**
 * Verify home ownership/tenancy
 */
export async function verifyHomeOccupancy(homeId: string, data: {
  verification_method: 'landlord' | 'escrow' | 'utility_bill' | 'lease';
  verification_document?: string;
}): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/homes/${homeId}/verify`, data);
}

/**
 * Update home public info (WiFi, house rules, etc.)
 */
export async function updateHomePublicInfo(homeId: string, data: {
  wifi_password?: string;
  house_rules?: string;
  parking_info?: string;
  [key: string]: any;
}): Promise<{ home: Home }> {
  return put<{ home: Home }>(`/api/homes/${homeId}/public-info`, data);
}

/**
 * Search homes by address
 */
export async function searchHomes(query: string): Promise<{ homes: Home[] }> {
  return get<{ homes: Home[] }>('/api/homes/search', { q: query });
}

/**
 * Get homes near a location
 */
export async function getNearbyHomes(params: {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
  limit?: number;
}): Promise<{ homes: Home[] }> {
  return get<{ homes: Home[] }>('/api/homes/nearby', params);
}

/**
 * Invite someone to a home
 */
export interface HomeInvitationCreated {
  invitation: { id: string; token: string; home_id: string; proposed_role: string };
  emailSent: boolean;
}

export async function inviteToHome(homeId: string, data: {
  email?: string;
  user_id?: string;
  username?: string;
  relationship: string;
  preset_key?: string;
  message?: string;
  start_at?: string;
  end_at?: string;
}): Promise<HomeInvitationCreated> {
  return post<HomeInvitationCreated>(`/api/homes/${homeId}/invite`, data);
}

/**
 * Accept home invitation
 */
export async function acceptHomeInvitation(invitationId: string): Promise<{ 
  occupancy: HomeOccupancy 
}> {
  return post<{ occupancy: HomeOccupancy }>(`/api/homes/invitations/${invitationId}/accept`);
}

/**
 * Reject home invitation
 */
export async function rejectHomeInvitation(invitationId: string): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/homes/invitations/${invitationId}/reject`);
}

/**
 * Get home invitations
 */
export async function getHomeInvitations(): Promise<{ invitations: any[] }> {
  return get<{ invitations: any[] }>('/api/homes/invitations');
}

/**
 * Right after signing in or up: the newest household invitation emailed to this address before it had an
 * account, with a link of its own (`/invite/<token>`), once; null when there is none.
 */
export async function getNextHomeInvitation(): Promise<{ token: string | null }> {
  return get<{ token: string | null }>('/api/homes/invitations/next');
}

/**
 * Look up an invitation by token (public — no auth required)
 */
export async function getInviteByToken(token: string): Promise<{
  invitation: any;
  home?: any;
  inviter?: any;
  expired?: boolean;
  alreadyUsed?: boolean;
}> {
  return get(`/api/homes/invitations/token/${token}`);
}

/**
 * Accept an invitation by token (requires auth)
 */
export async function acceptInviteByToken(token: string): Promise<{
  occupancy: any;
  homeId: string;
}> {
  return post(`/api/homes/invitations/token/${token}/accept`);
}

/**
 * Decline an invitation by token (requires auth)
 */
export async function declineInviteByToken(token: string): Promise<ApiResponse> {
  return post(`/api/homes/invitations/token/${token}/decline`);
}

// ============ RESIDENCY CLAIMS ============

/** Applicant-owned submitted identity and saved review, not current Home data. */
export interface PersonalResidencyRequest {
  id: string;
  home_id: string | null;
  submitted_address: string | null;
  claimed_role: string | null;
  status: 'pending' | 'verified' | 'rejected';
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface PersonalResidencyProgress {
  home_id: string;
  request: PersonalResidencyRequest | null;
  current_access: 'shared' | 'private_setup' | 'none';
  next_step: 'home' | 'household_review' | 'address_verification' | 'resubmit' | 'access_review' | 'ownership_verification' | 'unavailable';
  /**
   * Probation (a request nobody in the household answered in 7 days, home_residency_probation): 'active' until
   * someone there says yes or the address is verified by mail; 'ended' after a no, when proof by mail is the way
   * back; 'review' while Pantopus reviews that proof; 'declined' when Pantopus kept the household's no (they can send
   * proof again; an approval restores the membership). Older servers omit it.
   */
  probation?: 'active' | 'ended' | 'review' | 'declined' | null;
}
export async function getMyResidencyRequests(after?: string): Promise<{ requests: PersonalResidencyRequest[]; next_cursor: string | null }> {
  return get('/api/homes/my-residency', after ? { after } : undefined);
}
export async function getMyResidencyProgress(homeId: string): Promise<PersonalResidencyProgress> {
  return get(`/api/homes/${homeId}/my-residency`);
}

export interface ResidencyClaim {
  id: string;
  home_id: string;
  user_id: string;
  claimed_address?: string;
  status: 'pending' | 'verified' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
  created_at: string;
  updated_at: string;
  home?: any;
  claimant?: any;
}

export interface HomeDiscoverItem {
  id: string;
  name?: string;
  address: string;
  city: string;
  state: string;
  zipcode?: string;
  home_type?: string;
  visibility: string;
  owner?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string | null;
  } | null;
  is_member?: boolean;
  claim_status?: 'pending' | 'verified' | 'rejected' | null;
  /** True when the house number and unit are hidden from this searcher (they didn't type the number). */
  address_redacted?: boolean;
}

/**
 * Submit a residency claim for a home
 */
export async function submitResidencyClaim(
  homeId: string,
  claimedAddress?: string,
  claimedRole?: string,
): Promise<{
  message: string;
  claim: ResidencyClaim;
}> {
  return post(`/api/homes/${homeId}/claim`, {
    claimed_address: claimedAddress,
    claimed_role: claimedRole,
  });
}

/**
 * Get pending residency claims for a home (owners/admins only)
 */
export async function getHomeClaims(homeId: string): Promise<import('./homeResidencyClaims').Response> {
  return get(`/api/homes/${homeId}/claims`);
}

export type ResidencyReviewAction = 'approve' | 'reject';
export type ResidencyReviewRole = 'lease_resident' | 'member' | 'restricted_member' | 'guest' | 'service_provider';
export interface ResidencyReviewCommand {
  action: ResidencyReviewAction; role: ResidencyReviewRole | null; reason: string | null;
  request_id: string; review_token: string;
}
export interface ResidencyReviewReceipt {
  id: string; home_id: string; claim_id: string; actor_id: string; request_id: string;
  action: ResidencyReviewAction; legacy_request: boolean; request_hash: string; review_token: string;
  created_at: string; result: { status: 'verified' | 'rejected'; reviewed_at: string; occupancy_id: string | null; role_base: string | null };
}
export interface ResidencyReview {
  ok: true; home_id: string;
  residency_session: { actor_id: string; home_id: string; session_scope: string };
  claim: { id: string; home_id: string; user_id: string; status: string; claimed_role: string | null;
    claimed_address: string | null; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
    created_at: string; updated_at: string; review_token: string };
  occupancy: { id: string; user_id: string; role: string | null; role_base: string | null; age_band: string | null;
    is_active: boolean; verification_status: string | null; start_at: string | null; end_at: string | null;
    access_start_at: string | null; access_end_at: string | null; verified_at: string | null; verification_expires_at: string | null;
    /** Where their access came from ('probation': nobody answered their request in 7 days); older servers omit it. */
    verification_source?: string | null } | null;
}
export interface ResidencyReviewResponse extends ResidencyReview {
  claim_id: string; target_id: string; action: ResidencyReviewAction; replayed: boolean;
  receipt: ResidencyReviewReceipt; message: string;
}
export async function getResidencyReview(homeId: string, claimId: string, sessionScope?: string): Promise<ResidencyReview> {
  return get(`/api/homes/${homeId}/claim/${claimId}/review`, undefined,
    sessionScope ? { headers: { 'X-Pantopus-Session-Scope': sessionScope } } : undefined);
}
export async function decideResidencyReview(homeId: string, claimId: string, command: ResidencyReviewCommand,
  sessionScope: string): Promise<ResidencyReviewResponse> {
  return post(`/api/homes/${homeId}/claim/${claimId}/${command.action}`, {
    request_id: command.request_id, review_token: command.review_token,
    ...(command.action === 'approve' ? { proposed_role: command.role } : { reason: command.reason }),
  }, { headers: { 'X-Pantopus-Session-Scope': sessionScope } });
}

/**
 * Approve a residency claim
 */
export async function approveResidencyClaim(homeId: string, claimId: string, proposedRole?: string): Promise<{
  message: string;
  occupancy: any;
}> {
  return post(`/api/homes/${homeId}/claim/${claimId}/approve`, {
    proposed_role: proposedRole || 'member',
  });
}

/**
 * Reject a residency claim
 */
export async function rejectResidencyClaim(homeId: string, claimId: string, reason?: string): Promise<{
  message: string;
}> {
  return post(`/api/homes/${homeId}/claim/${claimId}/reject`, { reason });
}

/**
 * Get my residency claims
 */
/** Personal submitted fields only; current private Home metadata is never joined. */
export async function getMyClaims(after?: string): Promise<{ claims: ResidencyClaim[]; next_cursor: string | null }> {
  return get('/api/homes/my-claims', after ? { after } : undefined);
}

/**
 * Discover/search public-preview homes.
 */
export async function discoverHomes(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<{ homes: HomeDiscoverItem[] }> {
  return get('/api/homes/discover', params);
}

/**
 * Get a public home profile preview by home id.
 */
export async function getPublicHomeProfile(homeId: string): Promise<{
  home: HomeDiscoverItem & { description?: string | null; created_at?: string };
  owner?: HomeDiscoverItem['owner'];
  /** True when at least one verified owner exists on HomeOwner (not only Home.owner_id). */
  has_verified_owner?: boolean;
  is_member: boolean;
  claim?: { id: string; status: 'pending' | 'verified' | 'rejected'; created_at: string } | null;
}> {
  return get(`/api/homes/${homeId}/public-profile`);
}

/**
 * Ask verified owner(s) to add you to the household (notification to owners).
 */
export async function requestHouseholdAccessFromOwner(
  homeId: string,
  data?: { requested_identity?: 'owner' | 'resident' | 'household_member' | 'guest' },
): Promise<{ ok: boolean; notified_owners: number }> {
  return post(`/api/homes/${homeId}/request-household-from-owner`, data ?? {});
}

export interface HouseholdAccessRequestRow {
  id: string;
  home_id: string;
  requester_user_id: string;
  requested_identity: 'owner' | 'resident' | 'household_member' | 'guest';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    username?: string | null;
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    profile_picture_url?: string | null;
  } | null;
}

export async function getHouseholdAccessRequests(
  homeId: string,
  params?: { status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all' },
): Promise<{ requests: HouseholdAccessRequestRow[] }> {
  return get(`/api/homes/${homeId}/household-access-requests`, params);
}

export async function approveHouseholdAccessRequest(
  homeId: string,
  requestId: string,
): Promise<{ ok: boolean; message?: string }> {
  return post(`/api/homes/${homeId}/household-access-requests/${requestId}/approve`, {});
}

export async function rejectHouseholdAccessRequest(
  homeId: string,
  requestId: string,
): Promise<{ ok: boolean }> {
  return post(`/api/homes/${homeId}/household-access-requests/${requestId}/reject`, {});
}
