// ============================================================
// LISTINGS / MARKETPLACE ENDPOINTS
// Browse, create, manage marketplace listings
// ============================================================

import { get, post, patch, del } from '../client';

// ============ TYPES ============
// Re-exported from canonical sources — no local definitions.

export type {
  ListingCategory,
  ListingCondition,
  ListingStatus,
  ListingLocationPrecision as LocationPrecision,
  ListingVisibilityScope as VisibilityScope,
  ListingLayer,
  ListingType,
} from '@pantopus/types';

import type {
  ListingCategory,
  ListingCondition,
  ListingStatus,
  ListingLocationPrecision as LocationPrecision,
  ListingVisibilityScope as VisibilityScope,
  ListingLayer,
  ListingType,
} from '@pantopus/types';

// Listing creator shape. After P0.4 the backend returns the new identity
// shape (handle / displayName / avatarUrl) for marketplace listings; the
// legacy fields below remain typed-optional so consumers migrating away
// from the old keys can do so incrementally.
export interface ListingCreator {
  id: string;
  /** P0.4: new canonical handle. Reads should prefer this over username. */
  handle?: string | null;
  /** P0.4: new canonical display name. Reads should prefer this over name/first_name. */
  displayName?: string;
  /** P0.4: new canonical avatar URL. Reads should prefer this over profile_picture_url. */
  avatarUrl?: string | null;
  /** Legacy, may still be populated on some surfaces; prefer `handle`. */
  username?: string;
  /** Legacy, may still be populated on some surfaces; prefer `displayName`. */
  name?: string;
  first_name?: string;
  last_name?: string;
  /** Legacy, may still be populated on some surfaces; prefer `avatarUrl`. */
  profile_picture_url?: string;
}

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: ListingCategory;
  price: number | null;
  is_free: boolean;
  is_negotiable: boolean;
  condition?: ListingCondition;
  status: ListingStatus;
  media_urls: string[];
  media_types: string[];
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  location_address?: string | null;
  location_precision: LocationPrecision;
  visibility_scope: VisibilityScope;
  radius_miles?: number | null;
  tags: string[];
  save_count: number;
  view_count: number;
  message_count: number;
  is_boosted: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  distance_meters?: number | null;
  creator?: ListingCreator;
  userHasSaved?: boolean;
  // Marketplace redesign fields
  layer: ListingLayer;
  listing_type: ListingType;
  home_id?: string | null;
  is_address_attached: boolean;
  quality_score: number;
  risk_score: number;
  context_tags: string[];
  is_wanted: boolean;
  budget_max?: number | null;
  carousel_score?: number | null;
  active_offer_count?: number;
}

// ============ MARKETPLACE BROWSE REDESIGN ============

export interface MarketplaceBrowseParams {
  south: number;
  west: number;
  north: number;
  east: number;
  category?: string;
  listing_type?: ListingType;
  is_free?: boolean;
  is_wanted?: boolean;
  condition?: ListingCondition;
  min_price?: number;
  max_price?: number;
  layer?: ListingLayer;
  trust_only?: boolean;
  search?: string;
  sort?: 'newest' | 'nearest' | 'price_low' | 'price_high';
  cursor?: string;
  limit?: number;
  ref_lat?: number;
  ref_lng?: number;
  remote_only?: boolean;
  include_remote?: boolean;
  created_after?: string;
}

export interface MarketplaceBrowseResponse {
  listings: Listing[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
  meta: {
    total_in_bounds: number;
    free_count: number;
    bounds_used: { south: number; west: number; north: number; east: number };
    expanded?: boolean;
    fuzzy_match?: boolean;
  };
}

export interface ListingCategoryCluster {
  category: string;
  count: number;
  price_min: number | null;
  price_max: number | null;
  newest_at: string;
  representative_image?: string | null;
}

export interface MarketplaceDiscoverResponse {
  sections: {
    free_nearby: Listing[];
    just_listed: Listing[];
    nearby_deals: Listing[];
    by_category: ListingCategoryCluster[];
    wanted_nearby: Listing[];
  };
  total_active: number;
  free_count: number;
}

export interface MarketplaceAutocompleteResponse {
  titles: string[];
  categories: string[];
}

/**
 * Browse listings within a bounding box — unified endpoint for map + grid.
 * Replaces getNearbyListings and getListingsInBounds for Browse Mode.
 */
export async function browseListings(params: MarketplaceBrowseParams): Promise<MarketplaceBrowseResponse> {
  return get('/api/listings/browse', params);
}

/**
 * Discover listings — curated sections for Discovery Mode landing.
 */
export async function discoverListings(params: {
  lat: number;
  lng: number;
  radius?: number;
}): Promise<MarketplaceDiscoverResponse> {
  return get('/api/listings/discover', params);
}

/**
 * Autocomplete listings — lightweight search dropdown.
 */
export async function autocompleteListings(params: {
  q: string;
  lat?: number;
  lng?: number;
  limit?: number;
}): Promise<MarketplaceAutocompleteResponse> {
  return get('/api/listings/autocomplete', params);
}

// ============ BROWSE (LEGACY) ============

export async function getListings(params?: {
  limit?: number;
  offset?: number;
  category?: ListingCategory;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  isFree?: boolean;
  q?: string;
}): Promise<{ listings: Listing[]; pagination: { limit: number; offset: number; hasMore: boolean } }> {
  return get('/api/listings/search', params);
}

export async function getNearbyListings(params: {
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  radius?: number; // radius in meters (takes precedence on backend)
  category?: ListingCategory;
  layer?: ListingLayer;
  listingType?: ListingType;
  trustOnly?: boolean;
  isWanted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ listings: Listing[] }> {
  return get('/api/listings/nearby', params);
}

export async function getListingsInBounds(params: {
  south: number;
  west: number;
  north: number;
  east: number;
  category?: ListingCategory;
  layer?: ListingLayer;
  limit?: number;
}): Promise<{ listings: Listing[] }> {
  return get('/api/listings/in-bounds', params);
}

export async function searchListings(params: {
  q: string;
  category?: ListingCategory;
  layer?: ListingLayer;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  isFree?: boolean;
  trustOnly?: boolean;
  isWanted?: boolean;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
}): Promise<{ listings: Listing[]; pagination: { limit: number; offset: number; hasMore: boolean } }> {
  return get('/api/listings/search', params);
}

export async function getCarouselListings(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  layer?: ListingLayer;
}): Promise<{ listings: Listing[] }> {
  return get('/api/listings/carousel', params);
}

export async function getCategories(): Promise<{ categories: { key: string; label: string; count: number }[] }> {
  return get('/api/listings/categories');
}

// ============ DETAIL ============

export async function getListing(listingId: string): Promise<{ listing: Listing }> {
  return get(`/api/listings/${listingId}`);
}

// ============ CREATE / UPDATE / DELETE ============

export async function createListing(data: {
  title: string;
  description?: string;
  category: ListingCategory;
  price?: number;
  isFree?: boolean;
  isNegotiable?: boolean;
  condition?: ListingCondition;
  mediaUrls?: string[];
  mediaTypes?: string[];
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  locationPrecision?: LocationPrecision;
  visibilityScope?: VisibilityScope;
  radiusMiles?: number;
  tags?: string[];
  expiresAt?: string;
  // Marketplace redesign fields
  layer?: ListingLayer;
  listingType?: ListingType;
  homeId?: string;
  isAddressAttached?: boolean;
  isWanted?: boolean;
  budgetMax?: number;
}): Promise<{ message: string; listing: Listing }> {
  return post('/api/listings', data);
}

export async function refreshListing(listingId: string): Promise<{ message: string; listing: Listing }> {
  return post(`/api/listings/${listingId}/refresh`);
}

export async function updateListing(listingId: string, data: {
  title?: string;
  description?: string;
  category?: ListingCategory;
  price?: number;
  isFree?: boolean;
  isNegotiable?: boolean;
  condition?: ListingCondition;
  mediaUrls?: string[];
  mediaTypes?: string[];
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  locationPrecision?: LocationPrecision;
  visibilityScope?: VisibilityScope;
  radiusMiles?: number;
  tags?: string[];
}): Promise<{ message: string; listing: Listing }> {
  return patch(`/api/listings/${listingId}`, data);
}

export async function updateListingStatus(listingId: string, status: ListingStatus): Promise<{ message: string; listing: Listing }> {
  return patch(`/api/listings/${listingId}/status`, { status });
}

export async function deleteListing(listingId: string): Promise<{ message: string }> {
  return del(`/api/listings/${listingId}`);
}

// ============ SAVE / UNSAVE ============

export async function toggleSave(listingId: string): Promise<{ saved: boolean; saveCount: number }> {
  return post(`/api/listings/${listingId}/save`);
}

export async function getSavedListings(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ listings: Listing[] }> {
  return get('/api/listings/saved', params);
}

// ============ MY LISTINGS ============

export async function getMyListings(params?: {
  limit?: number;
  offset?: number;
  status?: ListingStatus;
}): Promise<{
  listings: Listing[];
  pagination?: { limit: number; offset: number; total?: number | null; hasMore?: boolean };
}> {
  return get('/api/listings/me', params);
}

// ============ USER LISTINGS ============

export async function getUserListings(userId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ listings: Listing[] }> {
  return get(`/api/listings/user/${userId}`, params);
}

// ============ MESSAGES ============

export async function sendMessage(listingId: string, data: {
  message: string;
}): Promise<{ message: string }> {
  return post(`/api/listings/${listingId}/message`, data);
}

export async function getMessages(listingId: string): Promise<{ messages: any[] }> {
  return get(`/api/listings/${listingId}/messages`);
}

// ============ REPORT ============

export async function reportListing(listingId: string, data: {
  reason: 'spam' | 'prohibited' | 'counterfeit' | 'scam' | 'other';
  details?: string;
}): Promise<{ message: string }> {
  return post(`/api/listings/${listingId}/report`, data);
}

// ============ SHARE TO FEED ============

export async function shareToFeed(listingId: string, data: {
  content?: string;
}): Promise<{ message: string; post: any }> {
  return post(`/api/listings/${listingId}/share-to-feed`, data);
}

// ============ QUESTIONS ============

export async function getListingQuestions(listingId: string): Promise<{ questions: any[] }> {
  return get(`/api/listings/${listingId}/questions`);
}

export async function askListingQuestion(
  listingId: string,
  question: string,
  attachments: string[] = []
): Promise<{ question: any }> {
  return post(`/api/listings/${listingId}/questions`, { question, attachments });
}

export async function answerListingQuestion(
  listingId: string,
  questionId: string,
  answer: string,
  attachments: string[] = []
): Promise<{ question: any }> {
  return post(`/api/listings/${listingId}/questions/${questionId}/answer`, { answer, attachments });
}

export async function togglePinListingQuestion(listingId: string, questionId: string): Promise<{ question: any }> {
  return post(`/api/listings/${listingId}/questions/${questionId}/pin`);
}

export async function toggleUpvoteListingQuestion(listingId: string, questionId: string): Promise<{ upvoted: boolean }> {
  return post(`/api/listings/${listingId}/questions/${questionId}/upvote`);
}

export async function deleteListingQuestion(listingId: string, questionId: string): Promise<{ deleted: boolean }> {
  return del(`/api/listings/${listingId}/questions/${questionId}`);
}

// ============ ADDRESS REVEAL (Progressive Location Disclosure) ============

export async function revealAddress(listingId: string, userId: string): Promise<{ success: boolean; message: string }> {
  return post(`/api/listings/${listingId}/reveal-address`, { userId });
}

export async function getAddressGrants(listingId: string): Promise<{ grants: Array<{
  id: string;
  grantee_user_id: string;
  granted_at: string;
  grantee: { id: string; username: string; name: string; profile_picture_url: string | null };
}> }> {
  return get(`/api/listings/${listingId}/address-grants`);
}

export async function revokeAddressGrant(listingId: string, userId: string): Promise<{ success: boolean; message: string }> {
  return del(`/api/listings/${listingId}/address-grants/${userId}`);
}

// ============ LISTING OFFERS ============

export type ListingOfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'withdrawn' | 'completed';

export interface ListingOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number | null;
  message?: string;
  status: ListingOfferStatus;
  parent_offer_id?: string | null;
  counter_amount?: number | null;
  counter_message?: string;
  expires_at: string;
  responded_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  buyer?: ListingCreator;
  seller?: ListingCreator;
}

export async function createOffer(
  listingId: string,
  params: { amount?: number | null; message?: string },
): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers`, params);
}

export async function getListingOffers(listingId: string): Promise<{ offers: ListingOffer[] }> {
  return get(`/api/listings/${listingId}/offers`);
}

export async function counterOffer(
  listingId: string,
  offerId: string,
  params: { counterAmount: number; counterMessage?: string },
): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers/${offerId}/counter`, params);
}

export async function acceptOffer(listingId: string, offerId: string): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers/${offerId}/accept`);
}

export async function declineOffer(listingId: string, offerId: string): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers/${offerId}/decline`);
}

export async function withdrawOffer(listingId: string, offerId: string): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers/${offerId}/withdraw`);
}

export async function completeTransaction(listingId: string, offerId: string): Promise<{ offer: ListingOffer }> {
  return post(`/api/listings/${listingId}/offers/${offerId}/complete`);
}

// ============ LISTING TRADES ============

export type TradeStatus = 'proposed' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export interface ListingTrade {
  id: string;
  target_listing_id: string;
  target_user_id: string;
  proposer_id: string;
  offered_listing_ids: string[];
  message?: string;
  status: TradeStatus;
  cash_supplement: number;
  responded_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  target_listing?: Listing;
  offered_listings?: Listing[];
  proposer?: ListingCreator;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  label?: string;
  query?: string;
  filters: Record<string, any>;
  notify_new_matches: boolean;
  last_matched_at?: string;
  created_at: string;
}

export interface SellerAnalytics {
  overview: {
    total_active_listings: number;
    total_views_30d: number;
    total_saves_30d: number;
    total_offers_30d: number;
    total_sales_30d: number;
    total_revenue_30d: number;
    conversion_rate: number;
    avg_time_to_sell_hours: number | null;
  };
  listings: Array<{
    id: string;
    title: string;
    views: number;
    saves: number;
    offers: number;
    status: string;
    days_listed: number;
  }>;
  reputation: ReputationScore | null;
}

export async function proposeTrade(
  listingId: string,
  params: { offeredListingIds: string[]; message?: string; cashSupplement?: number },
): Promise<{ trade: ListingTrade }> {
  return post(`/api/listings/${listingId}/trades`, params);
}

export async function getListingTrades(listingId: string): Promise<{ trades: ListingTrade[] }> {
  return get(`/api/listings/${listingId}/trades`);
}

export async function respondToTrade(
  tradeId: string,
  action: 'accept' | 'decline',
): Promise<{ trade: ListingTrade }> {
  return post(`/api/trades/${tradeId}/respond`, { action });
}

export async function completeTrade(tradeId: string): Promise<{ trade: ListingTrade }> {
  return post(`/api/trades/${tradeId}/complete`);
}

export async function cancelTrade(tradeId: string): Promise<{ trade: ListingTrade }> {
  return post(`/api/trades/${tradeId}/cancel`);
}

// ============ SAVED SEARCHES ============

export async function createSavedSearch(
  params: { query?: string; filters: Record<string, any>; label?: string },
): Promise<{ search: SavedSearch }> {
  return post('/api/marketplace/saved-searches', params);
}

export async function getSavedSearches(): Promise<{ searches: SavedSearch[] }> {
  return get('/api/marketplace/saved-searches');
}

export async function deleteSavedSearch(id: string): Promise<{ deleted: boolean }> {
  return del(`/api/marketplace/saved-searches/${id}`);
}

// ============ SELLER ANALYTICS ============

export async function getSellerAnalytics(): Promise<SellerAnalytics> {
  return get('/api/marketplace/seller-analytics');
}

// ============ REPUTATION ============

export interface ReputationScore {
  user_id: string;
  avg_rating: number;
  total_ratings: number;
  total_sales: number;
  total_purchases: number;
  total_trades: number;
  total_gigs_completed: number;
  avg_response_time_min: number | null;
  is_fast_responder: boolean;
  is_top_seller: boolean;
  member_since: string | null;
  badges: string[];
}

// ============ PRICE INTELLIGENCE ============

export interface PriceSuggestion {
  low: number;
  median: number;
  high: number;
  basis: string;
  comparable_count: number;
}

// ============ TRANSACTION REVIEWS ============

export interface TransactionReview {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  context: 'listing_sale' | 'listing_trade' | 'gig';
  listing_id?: string;
  offer_id?: string;
  gig_id?: string;
  rating: number;
  comment?: string;
  communication_rating?: number | null;
  accuracy_rating?: number | null;
  punctuality_rating?: number | null;
  is_buyer: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: ListingCreator;
}

// ============ PHASE 2 ENDPOINTS ============

export async function getSimilarListings(listingId: string): Promise<{ listings: Listing[] }> {
  return get(`/api/listings/${listingId}/similar`);
}

export async function getPriceSuggestion(params: {
  category: string;
  lat?: number;
  lng?: number;
}): Promise<{ suggestion: PriceSuggestion | null }> {
  const query = new URLSearchParams({ category: params.category });
  if (params.lat != null) query.set('lat', String(params.lat));
  if (params.lng != null) query.set('lng', String(params.lng));
  return get(`/api/marketplace/price-suggestion?${query.toString()}`);
}

export async function getUserReputation(userId: string): Promise<{ reputation: ReputationScore }> {
  return get(`/api/marketplace/reputation/${userId}`);
}

export async function createTransactionReview(params: {
  reviewed_id: string;
  context: string;
  offer_id?: string;
  listing_id?: string;
  rating: number;
  comment?: string;
}): Promise<{ review: TransactionReview }> {
  return post('/api/transaction-reviews', params);
}

export async function getUserTransactionReviews(userId: string): Promise<{
  reviews: TransactionReview[];
  average_rating: number;
  total: number;
}> {
  return get(`/api/transaction-reviews/user/${userId}`);
}
