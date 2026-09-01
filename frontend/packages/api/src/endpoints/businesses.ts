// ============================================================
// BUSINESS ENDPOINTS
// Business CRUD, locations, hours, catalog, pages & blocks
// ============================================================

import { get, post, put, del, patch } from '../client';
import type {
  ValidateBusinessAddressRequest,
  BusinessAddressVerdict,
  CreateBusinessLocationRequest,
  BusinessLocationEnhanced,
  BusinessMailingAddress,
} from '@pantopus/types';

// ---- Types ----

export interface BusinessUser {
  id: string;
  username: string;
  name: string;
  email: string;
  account_type: 'business';
  profile_picture_url?: string;
  cover_photo_url?: string;
  bio?: string;
  tagline?: string;
  average_rating?: number;
  review_count?: number;
  profile?: BusinessProfile | null;
}

export interface BusinessProfile {
  business_user_id: string;
  business_type: string;
  categories: string[];
  description?: string;
  logo_file_id?: string;
  banner_file_id?: string;
  public_email?: string;
  public_phone?: string;
  website?: string;
  social_links?: Record<string, string>;
  primary_location_id?: string;
  founded_year?: number;
  employee_count?: string;
  service_area?: Record<string, any>;
  is_published: boolean;
  published_at?: string;
  theme?: Record<string, any>;
  attributes?: Record<string, any>;
  verification_status?: string;
  verification_tier?: string;
  verified_at?: string;
  profile_completeness?: number;
  avg_response_minutes?: number | null;
  active_from?: string | null;
  active_until?: string | null;
}

export interface BusinessLocation {
  id: string;
  business_user_id: string;
  label: string;
  is_primary: boolean;
  address: string;
  address2?: string;
  city: string;
  state?: string;
  zipcode?: string;
  country: string;
  location?: { latitude: number; longitude: number } | null;
  timezone?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  sort_order: number;
}

export interface BusinessHours {
  id: string;
  location_id: string;
  day_of_week: number;
  open_time?: string;
  close_time?: string;
  is_closed: boolean;
  notes?: string;
}

export interface BusinessSpecialHours {
  id: string;
  location_id: string;
  date: string;
  label?: string;
  open_time?: string;
  close_time?: string;
  is_closed: boolean;
  notes?: string;
}

export interface CatalogCategory {
  id: string;
  business_user_id: string;
  name: string;
  description?: string;
  slug?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CatalogItem {
  id: string;
  business_user_id: string;
  category_id?: string;
  name: string;
  description?: string;
  kind: 'service' | 'product' | 'menu_item' | 'class' | 'rental' | 'membership' | 'other';
  price_cents?: number;
  price_max_cents?: number;
  price_unit?: string;
  currency: string;
  duration_minutes?: number;
  image_file_id?: string;
  image_url?: string;
  gallery_file_ids?: string[];
  status: 'active' | 'draft' | 'archived';
  is_featured?: boolean;
  available_at_location_ids?: string[];
  tags: string[];
  details?: Record<string, any>;
  sort_order: number;
  category?: { id: string; name: string; slug?: string };
}

export interface BusinessPage {
  id: string;
  business_user_id: string;
  slug: string;
  title: string;
  description?: string;
  is_default: boolean;
  show_in_nav: boolean;
  nav_order: number;
  icon_key?: string;
  draft_revision: number;
  published_revision: number;
  published_at?: string;
  seo?: Record<string, any>;
  theme?: Record<string, any>;
}

export interface PageBlock {
  id: string;
  page_id: string;
  revision: number;
  block_type: string;
  schema_version: number;
  sort_order: number;
  data: Record<string, any>;
  settings?: Record<string, any>;
  location_id?: string;
  show_from?: string;
  show_until?: string;
  is_visible: boolean;
}

export interface BusinessMembership {
  id: string;
  role_base: string;
  title?: string;
  joined_at: string;
  business_user_id: string;
  business?: BusinessUser;
  profile?: BusinessProfile | null;
}

export interface BusinessDiscoverItem {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  city?: string;
  state?: string;
  average_rating?: number;
  review_count?: number;
  business_type?: string;
  categories?: string[];
  description?: string;
  public_phone?: string;
  website?: string;
  following?: boolean;
}

// ---- Onboarding & Verification Types ----

export interface OnboardingChecklistItem {
  key: string;
  done: boolean;
  label: string;
  action: string | null;
}

export interface OnboardingStatus {
  checklist: OnboardingChecklistItem[];
  completed_count: number;
  total_count: number;
  profile_completeness: number;
}

export interface VerificationEvidence {
  id: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
}

export interface VerificationStatus {
  verification_status: 'unverified' | 'self_attested' | 'document_verified' | 'government_verified';
  verification_tier: string;
  verified_at?: string;
  evidence: VerificationEvidence[];
  can_self_attest: boolean;
  can_upload_evidence: boolean;
}

export interface FoundingOfferStatus {
  total_slots: number;
  slots_claimed: number;
  slots_remaining: number;
  is_offer_active: boolean;
  user_businesses: Array<{
    business_user_id: string;
    slot_number: number;
    claimed_at: string;
    status: string;
  }>;
}

export interface FoundingSlotClaim {
  slot_number: number;
  claimed_at: string;
  status: string;
  message: string;
}

export interface BusinessDashboardResponse {
  business: BusinessUser;
  profile: BusinessProfile;
  locations: BusinessLocation[];
  team: any[];
  catalog: any[];
  pages: any[];
  access: { hasAccess: boolean; isOwner: boolean; role_base: string | null };
  onboarding: OnboardingStatus;
}

// ---- Username Check ----

/**
 * Check if a business username is available (no auth required).
 */
export async function checkUsername(username: string): Promise<{ available: boolean; reason?: 'reserved' | 'taken' | 'invalid' }> {
  return get('/api/businesses/check-username', { username });
}

// ---- Business CRUD ----

/**
 * Create a new business
 */
export async function createBusiness(data: {
  username: string;
  name: string;
  email: string;
  business_type?: string;
  categories?: string[];
  description?: string;
  public_phone?: string;
  website?: string;
}): Promise<{ message: string; business: BusinessUser }> {
  return post('/api/businesses', data);
}

/**
 * Create a business with optional location + hours in a single atomic call.
 * Used by the refactored wizard to eliminate ghost accounts.
 */
export async function createBusinessFull(data: {
  username: string;
  name: string;
  email: string;
  business_type?: string;
  categories?: string[];
  description?: string;
  public_phone?: string;
  website?: string;
  location?: {
    label?: string;
    address: string;
    city: string;
    state?: string;
    zipcode?: string;
    country?: string;
  } | null;
  hours?: {
    day_of_week: number;
    open_time?: string;
    close_time?: string;
    is_closed?: boolean;
  }[] | null;
}): Promise<{ message: string; business: BusinessUser; location_id: string | null }> {
  return post('/api/businesses/create-full', data);
}

/**
 * List businesses the current user is a member of
 */
export async function getMyBusinesses(): Promise<{ businesses: BusinessMembership[] }> {
  return get<{ businesses: BusinessMembership[] }>('/api/businesses/my-businesses');
}

/**
 * Get business details (admin view)
 */
export async function getBusiness(businessId: string): Promise<{
  business: BusinessUser;
  profile: BusinessProfile | null;
  locations: BusinessLocation[];
  access: { hasAccess: boolean; isOwner: boolean; role_base: string | null };
}> {
  return get(`/api/businesses/${businessId}`);
}

/**
 * Get business dashboard aggregate
 */
export async function getBusinessDashboard(businessId: string): Promise<BusinessDashboardResponse> {
  return get(`/api/businesses/${businessId}/dashboard`);
}

/**
 * Update business profile
 */
export async function updateBusiness(businessId: string, data: Partial<{
  name: string;
  tagline: string;
  bio: string;
  business_type: string;
  categories: string[];
  description: string;
  public_email: string;
  public_phone: string;
  website: string;
  social_links: Record<string, string>;
  founded_year: number;
  employee_count: string;
  service_area: Record<string, any>;
  theme: Record<string, any>;
  attributes: Record<string, any>;
  is_published: boolean;
  active_from: string;
  active_until: string;
}>): Promise<{ message: string }> {
  return patch(`/api/businesses/${businessId}`, data);
}

/**
 * Publish business profile
 */
export async function publishBusiness(businessId: string): Promise<{ message: string }> {
  return post(`/api/businesses/${businessId}/publish`);
}

/**
 * Unpublish business profile
 */
export async function unpublishBusiness(businessId: string): Promise<{ message: string }> {
  return post(`/api/businesses/${businessId}/unpublish`);
}

/**
 * Delete a business (owner only)
 */
export async function deleteBusiness(businessId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}`);
}

// ---- Locations ----

export async function createLocation(businessId: string, data: {
  label?: string;
  is_primary?: boolean;
  address: string;
  address2?: string;
  city: string;
  state?: string;
  zipcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  phone?: string;
  email?: string;
}): Promise<{ location: BusinessLocation }> {
  return post(`/api/businesses/${businessId}/locations`, data);
}

export async function getLocations(businessId: string): Promise<{ locations: BusinessLocation[] }> {
  return get(`/api/businesses/${businessId}/locations`);
}

export async function updateLocation(businessId: string, locationId: string, data: Partial<{
  label: string;
  is_primary: boolean;
  address: string;
  address2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  phone: string;
  email: string;
  is_active: boolean;
  show_exact_location: boolean;
}>): Promise<{ location: BusinessLocation }> {
  return patch(`/api/businesses/${businessId}/locations/${locationId}`, data);
}

export async function deleteLocation(businessId: string, locationId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/locations/${locationId}`);
}

export async function validateBusinessAddress(
  businessId: string,
  data: ValidateBusinessAddressRequest
): Promise<{ verdict: BusinessAddressVerdict }> {
  return post<{ verdict: BusinessAddressVerdict }>(
    `/api/businesses/${businessId}/validate-address`,
    data
  );
}

export async function createLocationWithDecision(
  businessId: string,
  data: CreateBusinessLocationRequest
): Promise<{ location: BusinessLocationEnhanced; verdict: BusinessAddressVerdict }> {
  return post<{ location: BusinessLocationEnhanced; verdict: BusinessAddressVerdict }>(
    `/api/businesses/${businessId}/locations`,
    data
  );
}

export async function createMailingAddress(
  businessId: string,
  data: {
    address: string;
    address2?: string;
    city: string;
    state?: string;
    zipcode?: string;
    country?: string;
  }
): Promise<{ mailing_address: BusinessMailingAddress }> {
  return post<{ mailing_address: BusinessMailingAddress }>(
    `/api/businesses/${businessId}/mailing-address`,
    data
  );
}

// ---- Hours ----

export async function setLocationHours(businessId: string, locationId: string, data: {
  hours: Array<{
    day_of_week: number;
    open_time?: string;
    close_time?: string;
    is_closed: boolean;
    notes?: string;
  }>;
}): Promise<{ hours: BusinessHours[] }> {
  return put(`/api/businesses/${businessId}/locations/${locationId}/hours`, data);
}

export async function getLocationHours(businessId: string, locationId: string): Promise<{ hours: BusinessHours[] }> {
  return get(`/api/businesses/${businessId}/locations/${locationId}/hours`);
}

export async function addSpecialHours(businessId: string, locationId: string, data: {
  date: string;
  label?: string;
  open_time?: string;
  close_time?: string;
  is_closed: boolean;
  notes?: string;
}): Promise<{ specialHour: BusinessSpecialHours }> {
  return post(`/api/businesses/${businessId}/locations/${locationId}/special-hours`, data);
}

export async function getSpecialHours(businessId: string, locationId: string): Promise<{ specialHours: BusinessSpecialHours[] }> {
  return get(`/api/businesses/${businessId}/locations/${locationId}/special-hours`);
}

export async function deleteSpecialHours(businessId: string, locationId: string, shId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/locations/${locationId}/special-hours/${shId}`);
}

// ---- Catalog Categories ----

export async function createCatalogCategory(businessId: string, data: {
  name: string;
  description?: string;
  slug?: string;
  sort_order?: number;
}): Promise<{ category: CatalogCategory }> {
  return post(`/api/businesses/${businessId}/catalog/categories`, data);
}

export async function getCatalogCategories(businessId: string): Promise<{ categories: CatalogCategory[] }> {
  return get(`/api/businesses/${businessId}/catalog/categories`);
}

export async function updateCatalogCategory(businessId: string, catId: string, data: Partial<{
  name: string;
  description: string;
  slug: string;
  sort_order: number;
}>): Promise<{ category: CatalogCategory }> {
  return patch(`/api/businesses/${businessId}/catalog/categories/${catId}`, data);
}

export async function deleteCatalogCategory(businessId: string, catId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/catalog/categories/${catId}`);
}

// ---- Catalog Items ----

export async function createCatalogItem(businessId: string, data: {
  name: string;
  category_id?: string;
  description?: string;
  kind?: string;
  price_cents?: number;
  price_max_cents?: number;
  price_unit?: string;
  currency?: string;
  duration_minutes?: number;
  image_file_id?: string;
  image_url?: string;
  gallery_file_ids?: string[];
  status?: string;
  is_featured?: boolean;
  available_at_location_ids?: string[];
  tags?: string[];
  details?: Record<string, any>;
  sort_order?: number;
}): Promise<{ item: CatalogItem }> {
  return post(`/api/businesses/${businessId}/catalog/items`, data);
}

export async function getCatalogItems(businessId: string, params?: {
  kind?: string;
  category_id?: string;
  status?: string;
  is_featured?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CatalogItem[] }> {
  return get(`/api/businesses/${businessId}/catalog/items`, params);
}

export async function updateCatalogItem(businessId: string, itemId: string, data: Partial<{
  name: string;
  category_id: string;
  description: string;
  kind: string;
  price_cents: number;
  price_max_cents: number;
  price_unit: string;
  currency: string;
  duration_minutes: number;
  image_file_id: string;
  image_url: string;
  gallery_file_ids: string[];
  status: string;
  is_featured: boolean;
  available_at_location_ids: string[];
  tags: string[];
  details: Record<string, any>;
  sort_order: number;
}>): Promise<{ item: CatalogItem }> {
  return patch(`/api/businesses/${businessId}/catalog/items/${itemId}`, data);
}

export async function deleteCatalogItem(businessId: string, itemId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/catalog/items/${itemId}`);
}

// ---- Pages ----

export async function createPage(businessId: string, data: {
  slug: string;
  title: string;
  description?: string;
  is_default?: boolean;
  show_in_nav?: boolean;
  nav_order?: number;
  icon_key?: string;
  seo?: Record<string, any>;
  theme?: Record<string, any>;
}): Promise<{ page: BusinessPage }> {
  return post(`/api/businesses/${businessId}/pages`, data);
}

export async function getPages(businessId: string): Promise<{ pages: BusinessPage[] }> {
  return get(`/api/businesses/${businessId}/pages`);
}

export async function updatePage(businessId: string, pageId: string, data: Partial<{
  slug: string;
  title: string;
  description: string;
  is_default: boolean;
  show_in_nav: boolean;
  nav_order: number;
  icon_key: string;
  seo: Record<string, any>;
  theme: Record<string, any>;
}>): Promise<{ page: BusinessPage }> {
  return patch(`/api/businesses/${businessId}/pages/${pageId}`, data);
}

export async function deletePage(businessId: string, pageId: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/pages/${pageId}`);
}

// ---- Page Blocks ----

export async function getPageBlocks(businessId: string, pageId: string, params?: {
  revision?: 'draft' | 'published';
}): Promise<{
  blocks: PageBlock[];
  revision: number;
  draft_revision: number;
  published_revision: number;
}> {
  return get(`/api/businesses/${businessId}/pages/${pageId}/blocks`, params);
}

export async function saveDraftBlocks(businessId: string, pageId: string, data: {
  blocks: Array<{
    id?: string;
    block_type: string;
    schema_version?: number;
    sort_order: number;
    data: Record<string, any>;
    settings?: Record<string, any>;
    location_id?: string;
    show_from?: string;
    show_until?: string;
    is_visible?: boolean;
  }>;
}): Promise<{ blocks: PageBlock[]; draft_revision: number }> {
  return put(`/api/businesses/${businessId}/pages/${pageId}/blocks`, data);
}

export async function publishPage(businessId: string, pageId: string, data?: {
  notes?: string;
}): Promise<{ message: string; published_revision: number }> {
  return post(`/api/businesses/${businessId}/pages/${pageId}/publish`, data);
}

export async function getPageRevisions(businessId: string, pageId: string): Promise<{
  revisions: Array<{
    id: string;
    page_id: string;
    revision: number;
    published_at: string;
    notes?: string;
    publisher?: { id: string; username: string; name: string; profile_picture_url?: string };
  }>;
}> {
  return get(`/api/businesses/${businessId}/pages/${pageId}/revisions`);
}

// ---- Public Profile ----

export async function getPublicBusinessProfile(username: string): Promise<{
  business: BusinessUser;
  profile: BusinessProfile;
  locations: BusinessLocation[];
  hours: BusinessHours[];
  pages: BusinessPage[];
  defaultPage: (BusinessPage & { blocks: PageBlock[] }) | null;
  catalog: CatalogItem[];
  founding_slot?: { slot_number: number } | null;
}> {
  return get(`/api/businesses/public/${username}`);
}

/**
 * Discover/search published businesses.
 */
export async function discoverBusinesses(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<{ businesses: BusinessDiscoverItem[] }> {
  return get('/api/businesses/discover', params);
}

// ---- Discovery Search ----

export type DiscoverySort = 'relevance' | 'distance' | 'rating' | 'fastest_response';

export interface CatalogPreviewItem {
  name: string;
  price_cents?: number;
  price_unit?: string;
  currency: string;
  kind: string;
}

export interface DiscoverySearchResult {
  business_user_id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  categories: string[];
  description?: string;
  business_type?: string;
  logo_file_id?: string;
  average_rating: number | null;
  review_count: number;
  distance_miles: number;
  distance_meters: number;
  neighbor_count: number;
  endorsement_count: number;
  is_new_business: boolean;
  is_open_now: boolean | null;
  city?: string;
  state?: string;
  avg_response_minutes: number | null;
  profile_completeness: number;
  accepts_gigs: boolean;
  verification_status: string;
  verification_badge: 'verified' | 'gov_verified' | null;
  founding_badge: boolean;
  address_verified: boolean;
  catalog_preview: CatalogPreviewItem[];
}

export interface DiscoverySearchResponse {
  results: DiscoverySearchResult[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
    has_more: boolean;
  };
  sort: DiscoverySort;
  sort_label: string;
  filters_active: {
    categories: string[];
    radius_miles: number;
    open_now: boolean;
    worked_nearby: boolean;
    accepts_gigs: boolean;
    new_on_pantopus: boolean;
    verified_only: boolean;
    rating_min: number | null;
    entity_type: string[];
    founding_only: boolean;
  };
  banner: string | null;
}

/**
 * Search nearby businesses with composite ranking.
 * Uses the viewer's current location for distance + neighbor trust.
 */
export async function searchNearbyBusinesses(params: {
  q?: string;
  lat: number;
  lng: number;
  radius_miles?: number;
  categories?: string;
  sort?: DiscoverySort;
  open_now?: boolean;
  worked_nearby?: boolean;
  accepts_gigs?: boolean;
  new_on_pantopus?: boolean;
  verified_only?: boolean;
  rating_min?: number;
  entity_type?: string;
  founding_only?: boolean;
  viewer_home_id?: string;
  page?: number;
  page_size?: number;
}): Promise<DiscoverySearchResponse> {
  return get('/api/businesses/search', params);
}

// ---- Map Markers ----

export interface MapBusinessMarker {
  business_user_id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
  latitude: number;
  longitude: number;
  categories: string[];
  business_type?: string;
  average_rating: number | null;
  review_count: number;
  completed_gigs: number;
  is_open_now: boolean | null;
  is_new_business: boolean;
  pin_tier: 'small' | 'medium' | 'large';
  /** Whether the business has a verified address (decision_status: 'ok') */
  verified: boolean;
  /** Whether this is a home-based business showing approximate location */
  is_home_based?: boolean;
}

export interface MapBusinessesResponse {
  markers: MapBusinessMarker[];
  count: number;
  nearest_activity_center?: { latitude: number; longitude: number } | null;
}

/**
 * Get businesses within a map viewport bounding box.
 * Returns lightweight pin data for map rendering.
 */
export async function getBusinessesForMap(params: {
  south: number;
  west: number;
  north: number;
  east: number;
  categories?: string;
  open_now?: boolean;
  limit?: number;
}): Promise<MapBusinessesResponse> {
  return get('/api/businesses/map', params);
}

/**
 * Get the personalized neighbor trust count for a business.
 */
export async function getNeighborTrustCount(businessId: string, params?: {
  category?: string;
  radius_miles?: number;
  viewer_home_id?: string;
}): Promise<{
  count: number;
  radius_miles: number;
  label: string | null;
  show: boolean;
  is_new_business: boolean;
  category: string | null;
}> {
  return get(`/api/businesses/${businessId}/neighbor-count`, params);
}

/**
 * Get the combined trust score (transaction + endorsement).
 */
export async function getCombinedTrust(businessId: string, params?: {
  radius_miles?: number;
  viewer_home_id?: string;
}): Promise<{
  transaction_count: number;
  endorsement_count: number;
  combined_trust_score: number;
  display_label: string | null;
  is_new_business: boolean;
}> {
  return get(`/api/businesses/${businessId}/combined-trust`, params);
}

// ---- Endorsements (Phase 7) ----

export interface EndorsementInfo {
  count: number;
  by_category: Array<{ category: string; count: number }>;
  show: boolean;
}

/**
 * Get endorsement count for a business (proximity-filtered).
 */
export async function getEndorsements(businessId: string, params?: {
  category?: string;
  radius_miles?: number;
  viewer_home_id?: string;
}): Promise<EndorsementInfo> {
  return get(`/api/businesses/${businessId}/endorsements`, params);
}

/**
 * Endorse a business for a specific service category.
 */
export async function endorseBusiness(businessId: string, data: {
  category: string;
}): Promise<{ message: string; endorsement: { id: string; category: string; created_at: string } }> {
  return post(`/api/businesses/${businessId}/endorsements`, data);
}

/**
 * Retract an endorsement for a specific category.
 */
export async function retractEndorsement(businessId: string, category: string): Promise<{ message: string }> {
  return del(`/api/businesses/${businessId}/endorsements/${encodeURIComponent(category)}`);
}

/**
 * Get the categories the current user has endorsed for this business.
 */
export async function getMyEndorsements(businessId: string): Promise<{
  endorsed_categories: string[];
}> {
  return get(`/api/businesses/${businessId}/endorsements/mine`);
}

/**
 * Get the full public business profile (SEO-friendly route).
 */
export async function getPublicBusinessPage(username: string): Promise<{
  business: BusinessUser & { bio?: string; tagline?: string };
  profile: BusinessProfile & { avg_response_minutes?: number };
  locations: BusinessLocation[];
  hours: BusinessHours[];
  catalog: CatalogItem[];
  review_summary: {
    average_rating: number | null;
    review_count: number;
    distribution: Record<number, number>;
  };
  trust: {
    is_new_business: boolean;
    verification_status: string;
    verified_at: string | null;
    verification_badge: 'verified' | 'gov_verified' | null;
  };
  pages: BusinessPage[];
  defaultPage: (BusinessPage & { blocks: PageBlock[] }) | null;
}> {
  return get(`/api/b/${username}`);
}

/**
 * Get one published public business page by slug.
 */
export async function getPublicBusinessPageBySlug(username: string, slug: string): Promise<{
  business: BusinessUser & { bio?: string; tagline?: string };
  profile: BusinessProfile & { avg_response_minutes?: number };
  locations: BusinessLocation[];
  hours: BusinessHours[];
  catalog: CatalogItem[];
  review_summary: {
    average_rating: number | null;
    review_count: number;
    distribution: Record<number, number>;
  };
  trust: {
    is_new_business: boolean;
    verification_status: string;
    verified_at: string | null;
    verification_badge: 'verified' | 'gov_verified' | null;
  };
  pages: BusinessPage[];
  defaultPage: BusinessPage | null;
  currentPage: (BusinessPage & { blocks: PageBlock[] }) | null;
}> {
  return get(`/api/b/${username}/${slug}`);
}

// ---- Reviews ----

export interface BusinessReview {
  id: string;
  gig_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  media_urls?: string[];
  owner_response?: string;
  owner_responded_at?: string;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar?: string;
  reviewer?: {
    id: string;
    username: string;
    name?: string;
    first_name?: string;
    profile_picture_url?: string;
  };
  gig_title?: string;
}

/**
 * Get all reviews for a business
 */
export async function getBusinessReviews(businessId: string, params?: {
  page?: number;
  limit?: number;
  rating?: number;
}): Promise<{
  reviews: BusinessReview[];
  total: number;
  average_rating: number;
  distribution: Record<number, number>;
  page: number;
  limit: number;
}> {
  return get(`/api/businesses/${businessId}/reviews`, params);
}

/**
 * Respond to a review as the business owner
 */
export async function respondToReview(businessId: string, reviewId: string, data: {
  response: string;
}): Promise<{ message: string }> {
  return post(`/api/businesses/${businessId}/reviews/${reviewId}/respond`, data);
}

// ---- Follow / Unfollow ----

export async function followBusiness(businessId: string): Promise<{ following: boolean }> {
  return post(`/api/businesses/${businessId}/follow`);
}

export async function unfollowBusiness(businessId: string): Promise<{ following: boolean }> {
  return del(`/api/businesses/${businessId}/follow`);
}

export async function getFollowStatus(businessId: string): Promise<{
  following: boolean;
  follower_count: number;
}> {
  return get(`/api/businesses/${businessId}/follow/status`);
}

// ---- Profile Views ----

export async function logProfileView(businessId: string, source?: string): Promise<{ logged: boolean }> {
  return post(`/api/businesses/${businessId}/views`, { source: source || 'direct_link' });
}

// ---- Business Inbox ----

export async function startBusinessInquiry(businessId: string, subject?: string): Promise<{
  roomId: string;
  existing: boolean;
}> {
  return post(`/api/businesses/${businessId}/inbox/start`, { subject });
}

// ---- Insights ----

export interface BusinessInsights {
  period: string;
  days: number;
  views: {
    total: number;
    trend: number;
    by_day: Array<{ date: string; count: number }>;
    by_source: Array<{ source: string; count: number }>;
  };
  followers: {
    total: number;
    new: number;
    trend: number;
  };
  reviews: {
    count: number;
    trend: number;
    average_rating: number;
  };
}

export async function getBusinessInsights(businessId: string, period?: '7d' | '30d' | '90d'): Promise<BusinessInsights> {
  return get(`/api/businesses/${businessId}/insights`, period ? { period } : undefined);
}

// ---- Catalog Reorder ----

export async function reorderCatalogItems(businessId: string, items: Array<{ id: string; sort_order: number }>): Promise<{
  message: string;
  count: number;
}> {
  return post(`/api/businesses/${businessId}/catalog/items/reorder`, { items });
}

// ---- Catalog Checkout (Donate / Purchase) ----

export interface CatalogCheckoutResult {
  client_secret: string;
  payment_intent_id: string;
  payment_id: string;
  amount_cents: number;
  fee_cents: number;
  net_to_business: number;
  tax_deductible?: boolean;
  item_name: string;
}

export async function donateToCatalogItem(
  businessId: string,
  itemId: string,
  data: { amount_cents: number; donor_user_id?: string },
): Promise<CatalogCheckoutResult> {
  return post(`/api/businesses/${businessId}/catalog/${itemId}/donate`, data);
}

export async function purchaseCatalogItem(
  businessId: string,
  itemId: string,
  data?: { payment_method_id?: string },
): Promise<CatalogCheckoutResult> {
  return post(`/api/businesses/${businessId}/catalog/${itemId}/purchase`, data || {});
}

// ---- Catalog Booking Request ----

export async function requestCatalogBooking(
  businessId: string,
  itemId: string,
): Promise<{ booking_id: string; item_name: string; business_name: string; avg_response_minutes: number | null }> {
  return post(`/api/businesses/${businessId}/catalog/${itemId}/request`, {});
}

// ---- Page Revision Restore ----

export async function restorePageRevision(businessId: string, pageId: string, revision: number): Promise<{
  message: string;
  restored_revision: number;
  draft_revision: number;
}> {
  return post(`/api/businesses/${businessId}/pages/${pageId}/revisions/${revision}/restore`);
}

// ---- Business Private (Legal/Finance) ----

export interface BusinessPrivateData {
  business_user_id: string;
  legal_name?: string;
  tax_id_last4?: string;
  support_email?: string;
  banking_info?: Record<string, any>;
  legal_doc_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export async function getBusinessPrivate(businessId: string): Promise<{ private: BusinessPrivateData }> {
  return get(`/api/businesses/${businessId}/private`);
}

export async function updateBusinessPrivate(businessId: string, data: Partial<{
  legal_name: string;
  tax_id_last4: string;
  support_email: string;
  banking_info: Record<string, any>;
  legal_doc_ids: string[];
}>): Promise<{ private: BusinessPrivateData }> {
  return patch(`/api/businesses/${businessId}/private`, data);
}

// ---- Verification ----

export const getVerificationStatus = (businessId: string) =>
  get<VerificationStatus>(`/api/businesses/${businessId}/verify/status`);

export const selfAttest = (businessId: string, data: { legal_name: string; address_confirmed: boolean }) =>
  post<{ verification_status: string; message: string }>(`/api/businesses/${businessId}/verify/self-attest`, data);

export const uploadVerificationEvidence = (businessId: string, data: { evidence_type: string; file_id: string }) =>
  post<{ evidence_id: string; status: string; message: string }>(`/api/businesses/${businessId}/verify/upload-evidence`, data);

export const reviewVerificationEvidence = (businessId: string, data: { evidence_id: string; decision: 'approved' | 'rejected'; notes?: string }) =>
  post<{ verification_status: string; evidence_status: string }>(`/api/businesses/${businessId}/verify/review`, data);

// ---- Founding Offer ----

export const getFoundingOfferStatus = () =>
  get<FoundingOfferStatus>('/api/businesses/founding-offer/status');

export const claimFoundingOffer = (businessId: string) =>
  post<FoundingSlotClaim>(`/api/businesses/${businessId}/founding-offer/claim`);

// ---- Business Posts ----

export const createBusinessPost = (businessId: string, data: {
  content: string;
  title?: string;
  postType?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  tags?: string[];
  audience?: string;
  targetPlaceId?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  eventDate?: string;
  eventEndDate?: string;
  eventVenue?: string;
  dealExpiresAt?: string;
  dealBusinessName?: string;
  serviceCategory?: string;
}) =>
  post<{ message: string; post: any }>(`/api/businesses/${businessId}/posts`, data);

export const getBusinessPosts = (businessId: string, params?: { page?: number; page_size?: number }) =>
  get<{ posts: any[]; pagination: any }>(`/api/businesses/${businessId}/posts`, params);

export const getMatchedPosts = (businessId: string, params?: { page?: number; page_size?: number }) =>
  get<{ posts: any[]; pagination: any }>(`/api/businesses/${businessId}/matched-posts`, params);

// ---- Business Stripe Connect ----

export const connectBusinessStripe = (businessId: string, data?: { country?: string; businessType?: string }) =>
  post<{ message: string; account: any; stripeAccountId: string }>(`/api/businesses/${businessId}/stripe/connect`, data || {});

export const getBusinessStripeAccount = (businessId: string) =>
  get<{ account: any }>(`/api/businesses/${businessId}/stripe/account`);

export const refreshBusinessStripeLink = (businessId: string) =>
  post<{ accountLink: string; expiresAt: string }>(`/api/businesses/${businessId}/stripe/refresh-link`);

export const getBusinessStripeDashboardLink = (businessId: string) =>
  post<{ dashboardUrl: string }>(`/api/businesses/${businessId}/stripe/dashboard-link`);

// ---- Business Invoices ----

export interface InvoiceLineItem {
  description: string;
  amount_cents: number;
  quantity: number;
}

export interface BusinessInvoice {
  id: string;
  business_user_id: string;
  recipient_user_id: string;
  gig_id: string | null;
  line_items: InvoiceLineItem[];
  subtotal_cents: number;
  fee_cents: number;
  total_cents: number;
  currency: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'void' | 'overdue';
  due_date: string | null;
  memo: string | null;
  created_at: string;
  paid_at: string | null;
  payment_id: string | null;
  recipient?: { id: string; name: string; username: string; profile_picture_url?: string };
  business?: { id: string; name: string; username: string; profile_picture_url?: string };
}

export const createBusinessInvoice = (businessId: string, data: {
  recipient_user_id: string;
  line_items: InvoiceLineItem[];
  gig_id?: string | null;
  due_date?: string | null;
  memo?: string | null;
}) =>
  post<{ invoice: BusinessInvoice }>(`/api/businesses/${businessId}/invoices`, data);

export const getBusinessInvoices = (businessId: string, params?: { page?: number; page_size?: number; status?: string }) =>
  get<{ invoices: BusinessInvoice[]; pagination: { page: number; page_size: number; total: number } }>(`/api/businesses/${businessId}/invoices`, params);

export const getBusinessInvoice = (businessId: string, invoiceId: string) =>
  get<{ invoice: BusinessInvoice }>(`/api/businesses/${businessId}/invoices/${invoiceId}`);

export const voidBusinessInvoice = (businessId: string, invoiceId: string) =>
  patch<{ invoice: BusinessInvoice }>(`/api/businesses/${businessId}/invoices/${invoiceId}`, { status: 'void' });

export const payInvoice = (invoiceId: string, data?: { payment_method_id?: string }) =>
  post<{ client_secret: string; payment_intent_id: string; payment_id: string; amount_cents: number; fee_cents: number }>(
    `/api/businesses/invoices/${invoiceId}/pay`, data || {}
  );

export const getReceivedInvoices = (params?: { page?: number; page_size?: number }) =>
  get<{ invoices: BusinessInvoice[]; pagination: { page: number; page_size: number; total: number } }>('/api/businesses/invoices/received', params);

export const getReceivedInvoice = (invoiceId: string) =>
  get<{ invoice: BusinessInvoice }>(`/api/businesses/invoices/${invoiceId}`);

export const confirmInvoicePayment = (invoiceId: string) =>
  post<{ invoice: BusinessInvoice }>(`/api/businesses/invoices/${invoiceId}/confirm`, {});
