// ============================================================
// HOME ENDPOINTS
// Home management, attach/detach, occupancy
// ============================================================

import { get, post, put, del } from '../client';
import type { 
  Home, 
  HomeOccupancy, 
  HomeFilters,
  ApiResponse 
} from '@pantopus/types';

// ============ ADDRESS CHECK ============

export interface AddressCheckResult {
  status: 'HOME_NOT_FOUND' | 'HOME_FOUND_UNCLAIMED' | 'HOME_FOUND_CLAIMED';
  home_id?: string;
  is_multi_unit?: boolean;
  formatted_address?: string;
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

export type PropertySuggestionTier = 'attom' | 'heuristic' | 'llm';

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
  tiers_used: string[];
  llm_enabled: boolean;
  attom_property_detail: AttomPropertyDetailPayload | null;
}

export interface HomePropertyDetailResponse {
  home: Home;
  attom_property_detail: AttomPropertyDetailPayload | null;
  source: 'home' | 'cache' | 'attom' | 'unavailable' | string;
  unavailable_reason?: 'NO_PROPERTY_FOUND' | 'ATTOM_UNAVAILABLE' | 'ATTOM_NOT_CONFIGURED' | string | null;
}

/**
 * Tiered property field hints for Add Home (ATTOM → heuristics → optional LLM).
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
}): Promise<PropertySuggestionsResponse> {
  return post<PropertySuggestionsResponse>('/api/homes/property-suggestions', data);
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
  return get<HomePropertyDetailResponse>(`/api/homes/${homeId}/property-details`);
}

/**
 * Create a new home profile
 */
export async function createHome(data: {
  address: string;
  address_id?: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  latitude: number;
  longitude: number;
  home_type?: 'apartment' | 'house' | 'condo' | 'townhouse' | 'studio' | 'rv' | 'mobile_home' | 'trailer' | 'multi_unit' | 'other';
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  sq_ft?: number;
  lot_sq_ft?: number;
  year_built?: number;
  move_in_date?: string;
  is_owner?: boolean;
  role?: 'owner' | 'renter' | 'household' | 'property_manager' | 'guest';
  visibility?: 'private' | 'members' | 'public_preview';
  name?: string;
  description?: string;
  entry_instructions?: string;
  parking_instructions?: string;
  amenities?: Record<string, boolean>;
  wifi_name?: string;
  wifi_password?: string;
  attom_property_detail?: AttomPropertyDetailPayload | null;
}): Promise<{ home: Home; message: string; requires_verification?: boolean }> {
  return post<{ home: Home; message: string; requires_verification?: boolean }>('/api/homes', data);
}

/**
 * Update home details
 */
export async function updateHome(homeId: string, data: Partial<{
  unit_number: string;
  home_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  public_info: Record<string, any>;
}>): Promise<{ home: Home }> {
  return put<{ home: Home }>(`/api/homes/${homeId}`, data);
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
export async function getHomeOccupants(homeId: string): Promise<{ 
  occupants: (HomeOccupancy & { 
    user: { 
      id: string; 
      username: string; 
      name: string; 
      profile_picture_url?: string; 
    } 
  })[] 
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
  /** 'verified' lifts the place to the verified (T4) tier. */
  verification_status?: 'pending' | 'verified' | 'rejected' | 'moved_out' | string | null;
}

/** One of the current user's places (GET /api/homes/my-homes). */
export interface MyHome extends Omit<Home, 'location'> {
  /** PostGIS point parsed by the endpoint; null when unset. */
  location: Home['location'] | null;
  /** Optional display name (Home column not in the base Home type). */
  name?: string | null;
  occupancy: MyHomeOccupancy;
  /** HomeOwner status — distinguishes verified owners from pending. */
  ownership_status?: 'verified' | 'pending' | 'rejected' | null;
  verification_tier?: string | null;
  /** Deep-link target for an in-progress ownership claim. */
  pending_claim_id?: string | null;
  can_delete_home?: boolean;
}

/**
 * Get current user's homes (owned + occupied).
 */
export async function getMyHomes(): Promise<{ homes: MyHome[] }> {
  return get<{ homes: MyHome[] }>('/api/homes/my-homes');
}

/**
 * Get current user's primary residence
 */
export async function getPrimaryHome(): Promise<{ home: Home | null }> {
  return get<{ home: Home | null }>('/api/homes/primary');
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
export async function inviteToHome(homeId: string, data: {
  email?: string;
  user_id?: string;
  username?: string;
  relationship: string;
  preset_key?: string;
  message?: string;
  start_at?: string;
  end_at?: string;
}): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/homes/${homeId}/invite`, data);
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
export async function getHomeClaims(homeId: string): Promise<{ claims: ResidencyClaim[] }> {
  return get(`/api/homes/${homeId}/claims`);
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
export async function getMyClaims(): Promise<{ claims: ResidencyClaim[] }> {
  return get('/api/homes/my-claims');
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
